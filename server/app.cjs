const express = require('express');
const { Storage, AppError } = require('./storage.cjs');
const { Vault } = require('./vault.cjs');
const { Providers, CATALOG, validateBase } = require('./providers.cjs');
const { Jobs } = require('./jobs.cjs');
const { ProviderId, ProviderConfig } = require('../shared/contracts.cjs');
async function createApp({ root, fetchImpl, crypt } = {}) {
    const storage = new Storage(root),
        vault = new Vault(storage, crypt),
        providers = new Providers(vault, fetchImpl),
        jobs = new Jobs(storage, providers);
    await jobs.init();
    const app = express();
    app.disable('x-powered-by');
    app.use('/api', (req, res, next) => {
        res.set('Cache-Control', 'no-store');
        if (!['127.0.0.1', 'localhost', '[::1]'].includes(req.hostname)) return res.status(403).json({ error: '仅允许本机访问' });
        const origin = req.get('Origin');
        if (origin) {
            try {
                const u = new URL(origin);
                if (u.host !== req.get('Host')) return res.status(403).json({ error: '不允许跨站调用本地服务' });
            } catch {
                return res.status(403).json({ error: '无效来源' });
            }
        }
        if (!['GET', 'HEAD'].includes(req.method) && !req.is('application/json')) return res.status(415).json({ error: '需要 application/json' });
        next();
    });
    app.use(express.json({ limit: '20mb' }));
    app.get('/api/health', (req, res) => res.json({ ok: true, app: '格知 AI', version: 1 }));
    app.get('/api/providers', async (req, res) => res.json({ catalog: CATALOG, configs: await vault.public() }));
    app.put('/api/providers/:id', async (req, res) => {
        const id = ProviderId.parse(req.params.id),
            input = ProviderConfig.parse(req.body);
        input.baseUrl = validateBase(id, input.baseUrl);
        res.json(await vault.put(id, input));
    });
    app.delete('/api/providers/:id', async (req, res) => {
        const id = ProviderId.parse(req.params.id);
        await vault.remove(id);
        res.json({ ok: true });
    });
    app.get('/api/providers/:id/models', async (req, res) => res.json(await providers.models(ProviderId.parse(req.params.id))));
    app.post('/api/providers/:id/test', async (req, res) => {
        const id = ProviderId.parse(req.params.id);
        const config = await vault.get(id);
        const model = typeof req.body.model === 'string' ? req.body.model : config.model;
        if (!model || model.length > 180) throw new AppError('模型 ID 无效');
        const result = await providers.complete(id, model, [
            { role: 'system', content: 'Return a JSON object with exactly one property: {"ok":true}.' },
            { role: 'user', content: 'Test connection; return JSON.' },
        ]);
        if (result?.ok !== true) throw new AppError('已收到响应，但 JSON 结构测试未通过', 'INVALID_RESULT', 502);
        await vault.verified(id, model);
        res.json({ ok: true, model, verifiedAt: new Date().toISOString() });
    });
    app.get('/api/workbooks', async (req, res) => res.json(await storage.list()));
    app.post('/api/workbooks', async (req, res) => res.status(201).json(await storage.create(req.body)));
    app.get('/api/workbooks/:id', async (req, res) => res.json(await storage.get(req.params.id)));
    app.put('/api/workbooks/:id', async (req, res) => res.json(await storage.save(req.params.id, req.body)));
    app.post('/api/ai/jobs', async (req, res) => res.status(202).json(await jobs.create(req.body)));
    app.get('/api/ai/jobs/:id', (req, res) => res.json(jobs.public(jobs.get(req.params.id))));
    app.post('/api/ai/jobs/:id/cancel', async (req, res) => res.json(await jobs.cancel(req.params.id)));
    app.post('/api/ai/jobs/:id/retry', async (req, res) => res.status(202).json(await jobs.retry(req.params.id)));
    app.get('/api/ai/jobs/:id/events', (req, res) => {
        const job = jobs.get(req.params.id);
        res.set({ 'Content-Type': 'text/event-stream', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.flushHeaders();
        const send = (state) => res.write('data: ' + JSON.stringify(state) + '\n\n');
        send(jobs.public(job));
        if (!jobs.listeners.has(job.id)) jobs.listeners.set(job.id, new Set());
        jobs.listeners.get(job.id).add(send);
        const heartbeat = setInterval(() => res.write(': keepalive\n\n'), 15000);
        req.on('close', () => {
            clearInterval(heartbeat);
            jobs.listeners.get(job.id)?.delete(send);
        });
    });
    app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在', code: 'NOT_FOUND' }));
    app.use((error, req, res, next) => {
        if (res.headersSent) return next(error);
        if (error.name === 'ZodError') return res.status(400).json({ error: '输入结构或数据范围不符合要求', code: 'VALIDATION' });
        if (error.type === 'entity.too.large') return res.status(413).json({ error: '数据过大，请拆分工作簿', code: 'INPUT_LIMIT' });
        res.status(error.status || 500).json({
            error: error instanceof AppError ? error.message : '本地服务处理失败，请重试；原数据不会被覆盖',
            code: error.code || 'INTERNAL',
        });
    });
    return { app, storage, vault, providers, jobs };
}
module.exports = { createApp };
