const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { Workbook } = require('../shared/contracts.cjs');
class AppError extends Error {
    constructor(message, code = 'INVALID_INPUT', status = 400) {
        super(message);
        this.code = code;
        this.status = status;
    }
}
async function readJson(file, fallback) {
    try {
        return JSON.parse(await fs.readFile(file, 'utf8'));
    } catch (e) {
        if (e.code === 'ENOENT') return fallback;
        try {
            return JSON.parse(await fs.readFile(file + '.bak', 'utf8'));
        } catch {
            throw new AppError('本地文件损坏，未覆盖原文件，请检查备份', 'STORAGE_CORRUPT', 500);
        }
    }
}
async function atomicWrite(file, value, backup = true) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = file + '.' + crypto.randomUUID() + '.tmp';
    try {
        await fs.writeFile(tmp, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 });
        if (backup) {
            try {
                const old = await fs.readFile(file, 'utf8');
                JSON.parse(old);
                await fs.writeFile(file + '.bak', old, { mode: 0o600 });
            } catch (e) {
                if (e.code !== 'ENOENT' && !(e instanceof SyntaxError)) throw e;
            }
        }
        await fs.rename(tmp, file);
    } catch (e) {
        await fs.rm(tmp, { force: true }).catch(() => {});
        throw e;
    }
}
class Storage {
    constructor(root) {
        this.root = root;
        this.locks = new Map();
    }
    file(group, id) {
        if (!/^[a-z0-9-]{1,80}$/i.test(id)) throw new AppError('无效标识');
        return path.join(this.root, group, id + '.json');
    }
    async locked(key, fn) {
        const previous = this.locks.get(key) || Promise.resolve();
        const next = previous.catch(() => {}).then(fn);
        this.locks.set(key, next);
        try {
            return await next;
        } finally {
            if (this.locks.get(key) === next) this.locks.delete(key);
        }
    }
    async list() {
        const dir = path.join(this.root, 'workbooks');
        await fs.mkdir(dir, { recursive: true });
        const names = (await fs.readdir(dir)).filter((n) => n.endsWith('.json'));
        const books = await Promise.all(names.map((n) => readJson(path.join(dir, n))));
        return books
            .filter(Boolean)
            .map((b) => ({ id: b.id, name: b.name, revision: b.revision, updatedAt: b.updatedAt }))
            .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    }
    async get(id) {
        const book = await readJson(this.file('workbooks', id));
        if (!book) throw new AppError('工作簿不存在', 'NOT_FOUND', 404);
        return Workbook.parse(book);
    }
    async create(input) {
        const book = Workbook.parse(input);
        return this.locked(book.id, async () => {
            if (await readJson(this.file('workbooks', book.id))) throw new AppError('工作簿已存在', 'CONFLICT', 409);
            book.revision = 0;
            book.updatedAt = new Date().toISOString();
            await atomicWrite(this.file('workbooks', book.id), book);
            return book;
        });
    }
    async save(id, input) {
        const book = Workbook.parse(input);
        if (id !== book.id) throw new AppError('工作簿标识不匹配');
        return this.locked(id, async () => {
            const old = await this.get(id);
            if (old.revision !== book.revision) throw new AppError('工作簿已在其他窗口更新，请重新打开后再编辑', 'CONFLICT', 409);
            book.revision++;
            book.updatedAt = new Date().toISOString();
            await atomicWrite(this.file('workbooks', id), book);
            return book;
        });
    }
}
module.exports = { Storage, AppError, readJson, atomicWrite };
