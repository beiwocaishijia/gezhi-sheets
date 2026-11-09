const { AppError } = require('./storage.cjs');
const CATALOG = {
    glm: { name: 'GLM · 智谱', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-5.3', 'glm-5.3-flash', 'glm-4.7-flash'], list: false },
    kimi: { name: 'Kimi · 月之暗面', baseUrl: 'https://api.moonshot.cn/v1', models: ['kimi-k3.1-pro', 'kimi-k2.5', 'moonshot-v1-32k'], list: true },
    doubao: {
        name: '豆包 · 火山方舟',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        models: ['doubao-seed-2-1-lite-260915', 'doubao-seed-2-1-pro-260915', 'doubao-seed-2-1-turbo-260628'],
        list: true,
    },
    deepseek: { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', models: ['deepseek-flash', 'deepseek-v4-pro'], list: true },
    qwen: { name: 'Qwen · 千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-plus', 'qwen-flash', 'qwen3.8-max'], list: true },
};
function validateBase(id, raw) {
    let u;
    try {
        u = new URL(raw);
    } catch {
        throw new AppError('API 地址无效');
    }
    if (u.protocol !== 'https:' || u.username || u.password || u.port || u.search || u.hash) throw new AppError('请使用厂商官方 HTTPS API 地址');
    const base = raw.replace(/\/$/, '');
    if (id === 'qwen') {
        if (
            !/^(dashscope(?:-intl|-us)?\.aliyuncs\.com|[a-zA-Z0-9-]+\.(?:cn-beijing|ap-southeast-1|ap-northeast-1|us-east-1)\.maas\.aliyuncs\.com)$/.test(
                u.hostname
            ) ||
            u.pathname.replace(/\/$/, '') !== '/compatible-mode/v1'
        )
            throw new AppError('千问地址需为官方地域或工作空间地址');
    } else if (base !== CATALOG[id]?.baseUrl) throw new AppError('首版仅支持该厂商的官方普通 API 地址');
    return base;
}
function providerError(status, body, providerId) {
    const code = String(body?.error?.code || body?.error?.type || body?.code || '').toLowerCase();
    const message = String(body?.error?.message || body?.message || '').toLowerCase();
    if (/throttling|ratelimit|rate_limit|ratequota/.test(code) || (providerId === 'qwen' && status === 429 && /insufficient_quota|allocationquota/.test(code)))
        return new AppError('请求频率或每分钟 Token 额度超过限制，请稍后重试', 'RATE_LIMIT', 429);
    if (
        status === 402 ||
        /balance|arrear|overdue|freetier|quota|insufficient/.test(code) ||
        /余额|欠费|额度不足|insufficient balance|overdue balance/.test(message)
    )
        return new AppError('余额或配额不足，请前往厂商控制台检查', 'QUOTA', 402);
    if (status === 401) return new AppError('API Key 无效或地域不匹配，请检查配置', 'AUTH', 401);
    if (status === 403 || status === 404) return new AppError('模型未开通、无权限或模型 ID 不正确', 'MODEL_ACCESS', 400);
    if (status === 429) return new AppError('请求频率超过限制，请稍后重试', 'RATE_LIMIT', 429);
    if (status >= 500) return new AppError('模型服务暂时不可用，请稍后重试', 'UPSTREAM', 502);
    return new AppError('模型拒绝了请求参数；请检查模型、JSON 模式和输入长度', 'PROVIDER_INPUT', 400);
}
async function delay(ms, signal) {
    await new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(new AppError('任务已取消', 'CANCELLED', 499));
        const timer = setTimeout(done, ms);
        function done() {
            signal?.removeEventListener('abort', cancel);
            resolve();
        }
        function cancel() {
            clearTimeout(timer);
            reject(new AppError('任务已取消', 'CANCELLED', 499));
        }
        signal?.addEventListener('abort', cancel, { once: true });
    });
}
class Providers {
    constructor(vault, fetchImpl = fetch) {
        this.vault = vault;
        this.fetch = fetchImpl;
    }
    async models(id) {
        const config = await this.vault.get(id);
        const presets = CATALOG[id].models.map((id) => ({ id, source: 'preset' }));
        if (!CATALOG[id].list) return { models: presets, note: '官方预设不代表账户已开通；可手动输入模型 ID' };
        try {
            const r = await this.fetch(validateBase(id, config.baseUrl) + '/models', {
                headers: { Authorization: 'Bearer ' + config.apiKey },
                redirect: 'error',
                signal: AbortSignal.timeout(15000),
            });
            if (!r.ok) return { models: presets, note: '无法获取账户模型列表，显示预设；可手动输入模型 ID' };
            const data = await r.json();
            const models = (data.data || [])
                .filter((m) => typeof m.id === 'string' && !/embedding|rerank|seedream|seedance|image|tts|asr/i.test(m.id))
                .map((m) => ({ id: m.id, source: 'api' }));
            return { models: models.length ? models : presets, note: models.length ? '列表来自厂商接口；是否可调用以连接测试为准' : '显示官方预设' };
        } catch {
            return { models: presets, note: '读取列表失败，可使用预设或手动输入' };
        }
    }
    async complete(id, model, messages, { signal, onUsage } = {}) {
        const config = await this.vault.get(id);
        const url = validateBase(id, config.baseUrl) + '/chat/completions';
        const body = { model, messages, stream: true, max_tokens: 8192 };
        if (config.format !== 'prompt') body.response_format = { type: 'json_object' };
        if (id === 'qwen' && /^(qwen3|qwen-plus|qwen-flash|qwen-turbo)/.test(model)) body.enable_thinking = false;
        if (
            (id === 'glm' && /^glm-(?:[5-9]|4\.[567])/.test(model)) ||
            (id === 'kimi' && /^kimi-k(?:2\.5|3)/.test(model)) ||
            (id === 'doubao' && /^doubao-seed/.test(model)) ||
            (id === 'deepseek' && /^deepseek-(?:flash|v4)/.test(model))
        )
            body.thinking = { type: 'disabled' };
        for (let attempt = 0; attempt < 3; attempt++) {
            if (signal?.aborted) throw new AppError('任务已取消', 'CANCELLED', 499);
            try {
                const combined = signal ? AbortSignal.any([signal, AbortSignal.timeout(180000)]) : AbortSignal.timeout(180000);
                const response = await this.fetch(url, {
                    method: 'POST',
                    headers: { Authorization: 'Bearer ' + config.apiKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    signal: combined,
                    redirect: 'error',
                });
                if (!response.ok) {
                    let errorBody;
                    try {
                        errorBody = await response.json();
                    } catch {
                        /* Some providers return a plain-text error page. */
                    }
                    const error = providerError(response.status, errorBody, id);
                    if (['RATE_LIMIT', 'UPSTREAM'].includes(error.code) && attempt < 2) {
                        await delay(500 * 2 ** attempt, signal);
                        continue;
                    }
                    throw error;
                }
                let content = '',
                    finish,
                    usage;
                const accept = (part) => {
                    if (part.error) throw providerError(400, part, id);
                    if (part.usage) usage = part.usage;
                    const choice = part.choices?.[0];
                    if (choice) {
                        content += choice.delta?.content ?? choice.message?.content ?? '';
                        finish = choice.finish_reason || finish;
                    }
                    if (content.length > 2000000) throw new AppError('模型返回内容过大', 'OUTPUT_LIMIT', 502);
                };
                if (response.headers.get('content-type')?.includes('text/event-stream')) {
                    let buffer = '';
                    const decoder = new TextDecoder();
                    for await (const chunk of response.body) {
                        buffer += decoder.decode(chunk, { stream: true });
                        if (buffer.length > 2000000) throw new AppError('模型返回内容过大', 'OUTPUT_LIMIT', 502);
                        let n;
                        while ((n = buffer.indexOf('\n')) >= 0) {
                            const line = buffer.slice(0, n).trim();
                            buffer = buffer.slice(n + 1);
                            if (line.startsWith('data:')) {
                                const raw = line.slice(5).trim();
                                if (raw && raw !== '[DONE]') accept(JSON.parse(raw));
                            }
                        }
                    }
                    const last = (buffer + decoder.decode()).trim();
                    if (last.startsWith('data:') && last.slice(5).trim() !== '[DONE]') accept(JSON.parse(last.slice(5)));
                } else accept(await response.json());
                if (signal?.aborted) throw new AppError('任务已取消', 'CANCELLED', 499);
                if (usage) onUsage?.(usage);
                if (finish === 'length') throw new AppError('模型输出被截断，请减少每次处理内容后重试', 'TRUNCATED', 502);
                if (!content.trim()) throw new AppError('模型未返回可用正文，请切换模型或重试', 'EMPTY_RESULT', 502);
                const clean = content
                    .trim()
                    .replace(/^```(?:json)?\s*/i, '')
                    .replace(/\s*```$/, '');
                try {
                    return JSON.parse(clean);
                } catch {
                    throw new AppError('模型未返回完整 JSON，可重试或切换 JSON 模式', 'INVALID_JSON', 502);
                }
            } catch (error) {
                if (signal?.aborted) throw new AppError('任务已取消', 'CANCELLED', 499);
                if (error instanceof AppError) throw error;
                if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new AppError('模型响应超时，请重试', 'TIMEOUT', 504);
                if (error instanceof SyntaxError) throw new AppError('模型流式响应格式异常', 'INVALID_JSON', 502);
                throw new AppError('无法连接模型服务，请检查网络与 API 地址', 'NETWORK', 502);
            }
        }
    }
}
module.exports = { Providers, CATALOG, validateBase, providerError };
