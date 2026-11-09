const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Providers, CATALOG, validateBase, providerError } = require('../server/providers.cjs');
const { Storage, readJson } = require('../server/storage.cjs');
const { Vault, dpapi } = require('../server/vault.cjs');
const { createApp } = require('../server/app.cjs');
const { temporary, book, sse } = require('./helpers.cjs');
const mockVault = (id) => ({ get: async () => ({ apiKey: 'protocol-test-key', baseUrl: CATALOG[id].baseUrl, format: 'json_object' }) });
test('vendor-specific rate quotas and account debts are not confused with model permissions', () => {
    assert.equal(providerError(429, { error: { code: 'Throttling.RateQuota' } }, 'qwen').code, 'RATE_LIMIT');
    assert.equal(providerError(429, { error: { code: 'insufficient_quota' } }, 'qwen').code, 'RATE_LIMIT');
    assert.equal(providerError(403, { error: { code: 'AccountOverdueError' } }, 'doubao').code, 'QUOTA');
    assert.equal(providerError(429, { error: { code: '1113', message: '账户余额不足' } }, 'glm').code, 'QUOTA');
});

for (const id of Object.keys(CATALOG))
    test(`${id}: official endpoint, bearer auth, model, JSON and UTF-8 streaming protocol`, async () => {
        let calls = 0,
            usage;
        const providers = new Providers(mockVault(id), async (url, options) => {
            calls++;
            assert.equal(url, CATALOG[id].baseUrl + '/chat/completions');
            assert.equal(options.headers.Authorization, 'Bearer protocol-test-key');
            const body = JSON.parse(options.body);
            assert.equal(body.model, CATALOG[id].models[0]);
            assert.equal(body.stream, true);
            assert.deepEqual(body.response_format, { type: 'json_object' });
            if (id === 'qwen') assert.equal(body.enable_thinking, false);
            else assert.deepEqual(body.thinking, { type: 'disabled' });
            return sse({ ok: true, 中文: '逐行对应' });
        });
        assert.deepEqual(await providers.complete(id, CATALOG[id].models[0], [{ role: 'user', content: 'JSON' }], { onUsage: (u) => (usage = u) }), {
            ok: true,
            中文: '逐行对应',
        });
        assert.equal(calls, 1);
        assert.equal(usage.prompt_tokens, 12);
    });
test('provider models are labelled by source and manual models remain usable without fallback', async () => {
    const p = new Providers(mockVault('kimi'), async () => Response.json({ data: [{ id: 'custom-model' }, { id: 'embedding-test' }] }));
    assert.deepEqual((await p.models('kimi')).models, [{ id: 'custom-model', source: 'api' }]);
    const preset = await new Providers(mockVault('glm'), () => {
        throw new Error('must not call');
    }).models('glm');
    assert.equal(preset.models[0].source, 'preset');
});
test('rate limits retry twice at most; authentication and quota errors do not retry or leak keys', async () => {
    let calls = 0;
    const p = new Providers(mockVault('kimi'), async () => {
        calls++;
        return Response.json({ error: { code: 'rate_limit' } }, { status: 429 });
    });
    await assert.rejects(p.complete('kimi', 'm', []), (e) => e.code === 'RATE_LIMIT');
    assert.equal(calls, 3);
    for (const [status, code, expected] of [
        [401, 'invalid', 'AUTH'],
        [429, 'insufficient_quota', 'QUOTA'],
        [403, 'permission', 'MODEL_ACCESS'],
    ]) {
        let n = 0;
        const v = new Providers(mockVault('kimi'), async () => {
            n++;
            return Response.json({ error: { code, message: 'protocol-test-key' } }, { status });
        });
        await assert.rejects(v.complete('kimi', 'm', []), (e) => e.code === expected && !e.message.includes('protocol-test-key'));
        assert.equal(n, 1);
    }
});
test('invalid JSON, truncated content, cancellation and service errors are distinguished', async () => {
    for (const [content, finish, expected] of [
        ['not json', 'stop', 'INVALID_JSON'],
        ['{"x":', 'length', 'TRUNCATED'],
        ['', 'stop', 'EMPTY_RESULT'],
    ]) {
        const p = new Providers(mockVault('kimi'), async () => Response.json({ choices: [{ message: { content }, finish_reason: finish }] }));
        await assert.rejects(p.complete('kimi', 'm', []), (e) => e.code === expected);
    }
    const controller = new AbortController();
    controller.abort();
    let n = 0;
    await assert.rejects(
        new Providers(mockVault('kimi'), async () => {
            n++;
        }).complete('kimi', 'm', [], { signal: controller.signal }),
        (e) => e.code === 'CANCELLED'
    );
    assert.equal(n, 0);
    let attempts = 0;
    const p = new Providers(mockVault('kimi'), async () => (++attempts < 3 ? new Response('', { status: 503 }) : sse({ ok: true })));
    assert.equal((await p.complete('kimi', 'm', [])).ok, true);
    assert.equal(attempts, 3);
});
test('Qwen accepts official regional/workspace endpoints, rejects arbitrary destinations and redirects', () => {
    assert.equal(validateBase('qwen', 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'), 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1');
    assert.ok(validateBase('qwen', 'https://workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1'));
    for (const url of [
        'http://127.0.0.1',
        'https://dashscope.aliyuncs.com.evil.com/compatible-mode/v1',
        'https://u:p@dashscope.aliyuncs.com/compatible-mode/v1',
        'https://dashscope.aliyuncs.com/compatible-mode/v1?redirect=x',
    ])
        assert.throws(() => validateBase('qwen', url));
});
test('workbook storage rejects stale concurrent writes and recovers the last valid backup', async (t) => {
    const storage = new Storage(await temporary(t)),
        initial = await storage.create(book());
    const results = await Promise.allSettled([
        storage.save(initial.id, { ...initial, name: 'first' }),
        storage.save(initial.id, { ...initial, name: 'second' }),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(results.find((r) => r.status === 'rejected').reason.code, 'CONFLICT');
    const file = storage.file('workbooks', initial.id);
    assert.equal((await readJson(file + '.bak')).name, '测试');
    await fs.writeFile(file, '{broken');
    assert.equal((await storage.get(initial.id)).name, '测试');
    await storage.save(initial.id, { ...initial, name: 'recovered' });
    assert.equal((await storage.get(initial.id)).name, 'recovered');
});
test(
    'Windows DPAPI encrypts at rest, survives a new Vault instance and deletes without a retained key backup',
    { skip: process.platform !== 'win32' },
    async (t) => {
        const root = await temporary(t),
            storage = new Storage(root),
            vault = new Vault(storage),
            secret = 'ce-lab-dpapi-test-only-123456';
        await vault.put('kimi', { apiKey: secret, model: 'm', format: 'json_object', baseUrl: CATALOG.kimi.baseUrl });
        const onDisk = await fs.readFile(path.join(root, 'providers.json'), 'utf8');
        assert.ok(!onDisk.includes(secret));
        assert.equal((await new Vault(new Storage(root)).get('kimi')).apiKey, secret);
        const visible = JSON.stringify(await vault.public());
        assert.ok(!visible.includes(secret));
        assert.ok(!visible.includes('encryptedKey'));
        await vault.remove('kimi');
        assert.deepEqual(await vault.public(), {});
        await assert.rejects(fs.stat(path.join(root, 'providers.json.bak')), (e) => e.code === 'ENOENT');
    }
);
test('unavailable encryption fails closed and never creates a plain-text config', async (t) => {
    const root = await temporary(t),
        vault = new Vault(new Storage(root), async () => {
            throw new Error('encryption unavailable');
        });
    await assert.rejects(vault.put('kimi', { apiKey: 'test-secret', model: 'm', baseUrl: CATALOG.kimi.baseUrl }));
    await assert.rejects(fs.stat(path.join(root, 'providers.json')), (e) => e.code === 'ENOENT');
});
test('local HTTP API rejects cross-site writes, validates versions and never returns a complete key', async (t) => {
    const instance = await createApp({
        root: await temporary(t),
        crypt: async (s, decrypt) => (decrypt ? Buffer.from(s, 'base64').toString() : Buffer.from(s).toString('base64')),
        fetchImpl: async () => sse({ ok: true }),
    });
    const server = await new Promise((resolve) => {
        const s = instance.app.listen(0, '127.0.0.1', () => resolve(s));
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}`;
    const put = (route, value, extra = {}) =>
        fetch(base + route, { method: 'PUT', headers: { 'content-type': 'application/json', ...extra }, body: JSON.stringify(value) });
    const cfg = { apiKey: 'test-http-secret', model: 'm', baseUrl: CATALOG.kimi.baseUrl };
    assert.equal((await put('/api/providers/kimi', cfg, { Origin: 'https://foreign.test' })).status, 403);
    assert.equal((await put('/api/providers/kimi', cfg)).status, 200);
    assert.ok(!(await (await fetch(base + '/api/providers')).text()).includes(cfg.apiKey));
    const testResult = await fetch(base + '/api/providers/kimi/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(testResult.status, 200);
    const created = await instance.storage.create(book());
    assert.equal((await put('/api/workbooks/' + created.id, created)).status, 200);
    assert.equal((await put('/api/workbooks/' + created.id, created)).status, 409);
});
