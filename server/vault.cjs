const { spawn } = require('node:child_process');
const path = require('node:path');
const { readJson, atomicWrite, AppError } = require('./storage.cjs');
function dpapi(text, decrypt = false) {
    if (process.platform !== 'win32') return Promise.reject(new AppError('密钥加密目前需要 Windows DPAPI，不会保存明文密钥', 'ENCRYPTION_UNAVAILABLE', 503));
    const script = `$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; [Console]::InputEncoding=[Text.UTF8Encoding]::new($false); [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $inputValue=[Console]::In.ReadToEnd(); $bytes=${
        decrypt ? '[Convert]::FromBase64String($inputValue)' : '[Text.Encoding]::UTF8.GetBytes($inputValue)'
    }; $result=[Security.Cryptography.ProtectedData]::${
        decrypt ? 'Unprotect' : 'Protect'
    }($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write(${
        decrypt ? '[Text.Encoding]::UTF8.GetString($result)' : '[Convert]::ToBase64String($result)'
    });`;
    return new Promise((resolve, reject) => {
        const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
            windowsHide: true,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        let output = '';
        const timer = setTimeout(() => child.kill(), 15000);
        child.stdout.on('data', (d) => {
            output += d.toString('utf8');
        });
        child.stderr.resume();
        child.stdin.on('error', () => {});
        child.on('error', () => {
            clearTimeout(timer);
            reject(new AppError('无法启动 Windows 密钥加密服务', 'ENCRYPTION_UNAVAILABLE', 503));
        });
        child.on('close', (code) => {
            clearTimeout(timer);
            if (code === 0) resolve(output);
            else reject(new AppError('密钥解密或加密失败，请使用原 Windows 账户或重新配置', 'ENCRYPTION_FAILED', 503));
        });
        child.stdin.end(text);
    });
}
class Vault {
    constructor(storage, crypt = dpapi) {
        this.storage = storage;
        this.file = path.join(storage.root, 'providers.json');
        this.crypt = crypt;
    }
    async all() {
        return readJson(this.file, {});
    }
    async public() {
        const all = await this.all();
        return Object.fromEntries(
            Object.entries(all).map(([id, p]) => [
                id,
                {
                    model: p.model,
                    baseUrl: p.baseUrl,
                    format: p.format,
                    configured: !!p.encryptedKey,
                    maskedKey: p.maskedKey,
                    verifiedAt: p.verifiedAt || null,
                    verifiedModel: p.verifiedModel || null,
                },
            ])
        );
    }
    async put(id, input) {
        return this.storage.locked('providers', async () => {
            const all = await this.all();
            const old = all[id] || {};
            const { apiKey, ...config } = input;
            all[id] = { ...old, ...config, verifiedAt: null, verifiedModel: null };
            if (apiKey) {
                all[id].encryptedKey = await this.crypt(apiKey);
                all[id].maskedKey = apiKey.length > 8 ? '•••• ' + apiKey.slice(-4) : '••••';
            }
            if (!all[id].encryptedKey) throw new AppError('请填写 API Key');
            await atomicWrite(this.file, all, false);
            return (await this.public())[id];
        });
    }
    async remove(id) {
        return this.storage.locked('providers', async () => {
            const all = await this.all();
            delete all[id];
            await atomicWrite(this.file, all, false);
        });
    }
    async get(id) {
        const config = (await this.all())[id];
        if (!config?.encryptedKey) throw new AppError('请先配置该厂商的 API Key', 'KEY_REQUIRED', 400);
        return { ...config, apiKey: await this.crypt(config.encryptedKey, true) };
    }
    async verified(id, model) {
        return this.storage.locked('providers', async () => {
            const all = await this.all();
            if (all[id]) {
                all[id].verifiedAt = new Date().toISOString();
                all[id].verifiedModel = model;
                await atomicWrite(this.file, all, false);
            }
        });
    }
}
module.exports = { Vault, dpapi };
