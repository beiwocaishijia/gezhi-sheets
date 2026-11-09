const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
function book(
    rows = [
        ['张三', 0.1],
        ['李四', 0.2],
        ['张三', null],
    ],
    titles = ['客户', '金额']
) {
    const id = crypto.randomUUID();
    return {
        id: crypto.randomUUID(),
        name: '测试',
        revision: 0,
        activeSheetId: id,
        sheets: [{ id, name: '数据', columns: titles.map((title) => ({ title, width: 160 })), data: rows, style: {}, mergeCells: {} }],
    };
}
function request(b, extra = {}) {
    return {
        kind: 'fill',
        providerId: 'kimi',
        model: 'test-model',
        workbookId: b.id,
        sheetId: b.activeSheetId,
        revision: b.revision,
        range: [0, 0, b.sheets[0].columns.length - 1, b.sheets[0].data.length - 1],
        instruction: '提取信息',
        fields: ['摘要'],
        ...extra,
    };
}
async function temporary(t) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ce-lab-test-'));
    t.after(() => {
        const resolved = path.resolve(dir);
        if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('ce-lab-test-'))
            throw new Error('Unsafe test cleanup path');
        return fs.rm(resolved, { recursive: true, force: true });
    });
    return dir;
}
async function finished(jobs, id) {
    for (let i = 0; i < 1000; i++) {
        if (!jobs.controllers.has(id) && !['queued', 'running'].includes(jobs.get(id).status)) return jobs.public(jobs.get(id));
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('任务超时');
}
function sse(result, usage = { prompt_tokens: 12, completion_tokens: 8 }) {
    const content = JSON.stringify(result);
    const payload = [
        JSON.stringify({ choices: [{ delta: { content: content.slice(0, 7) } }] }),
        JSON.stringify({ choices: [{ delta: { content: content.slice(7) }, finish_reason: 'stop' }], usage }),
        '[DONE]',
    ]
        .map((v) => 'data: ' + v + '\n\n')
        .join('');
    const bytes = new TextEncoder().encode(payload);
    return new Response(
        new ReadableStream({
            start(c) {
                for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.slice(i, i + 7));
                c.close();
            },
        }),
        { headers: { 'content-type': 'text/event-stream' } }
    );
}
module.exports = { book, request, temporary, finished, sse };
