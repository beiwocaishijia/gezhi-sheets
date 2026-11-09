// Documentation capture only. Uses synthetic records and fixed model responses.
// Never imported by the application or connected to a real provider.
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const express = require('express');
const { createApp } = require('../../server/app.cjs');
const { CATALOG } = require('../../server/providers.cjs');

const examples = [
    ['0001', '每天手工整理销售数据，月底汇总很麻烦。', '报表自动化', '自动整理并汇总销售数据'],
    ['0002', '新员工总问同样的问题，希望他们能自己查资料。', '企业知识库', '支持员工自助查询常见问题'],
    ['0003', '产品说明都是英文，希望批量翻译成中文。', '多语言翻译', '批量翻译英文产品说明'],
];
async function simulatedFetch(url, options) {
    if (url.endsWith('/models')) return Response.json({ data: [{ id: 'readme-demo' }] });
    const messages = JSON.parse(options.body).messages;
    let result;
    if (messages[0].content.includes('exactly one property')) result = { ok: true };
    else {
        const ctx = JSON.parse(messages[1].content);
        if (messages[0].content.includes('"kind":"fill"')) {
            result = {
                kind: 'fill',
                rows: ctx.rows.map((r, i) => ({ rowId: r.rowId, values: [examples[i][2], examples[i][3]], reason: '根据本行客户原话提取' })),
            };
        } else if (messages[0].content.includes('"kind":"table"')) {
            result = { kind: 'table', columns: ['客户', '商品', '颜色', '数量', '单价'], rows: [['张三', '水杯', '黑色', 10, 35], ['李四', '水杯', '蓝色', 5, 38]] };
        } else if (messages[0].content.includes('"kind":"formula"')) {
            result = { kind: 'formula', formula: '=D1*E1', explanation: '数量 × 单价。程序将逐行试算，确认后填入金额列。' };
        } else if (messages[0].content.includes('"kind":"operations"')) {
            result = { kind: 'operations', explanation: '按数量从高到低排列完整记录。', actions: [{ type: 'sortRows', column: 3, direction: 'desc' }] };
        } else result = { kind: 'answer', answer: '这组客户关注报表自动化、知识查询和翻译效率。', citations: ctx.rows.map((r) => r.rowId) };
    }
    await new Promise((resolve) => setTimeout(resolve, 450));
    return Response.json({ choices: [{ message: { content: JSON.stringify(result) } }], usage: { prompt_tokens: 0, completion_tokens: 0 } });
}
async function main() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gezhi-readme-'));
    const { app, storage, vault } = await createApp({
        root,
        fetchImpl: simulatedFetch,
        crypt: async (s, decrypt) => (decrypt ? Buffer.from(s, 'base64').toString() : Buffer.from(s).toString('base64')),
    });
    await vault.put('kimi', { apiKey: 'DOCUMENTATION_DEMO_ONLY', model: 'readme-demo', baseUrl: CATALOG.kimi.baseUrl, format: 'json_object' });
    const sheetId = randomUUID();
    await storage.create({
        id: randomUUID(), name: '客户需求整理 · 演示数据', revision: 0, activeSheetId: sheetId,
        sheets: [{ id: sheetId, name: '客户反馈', columns: [{ title: '客户编号', width: 92 }, { title: '客户原话', width: 438 }], data: examples.map((r) => ["'" + r[0], r[1]]), style: {}, mergeCells: {}, readOnlyCells: [] }],
    });
    app.use(express.static(path.resolve(__dirname, '../../app-dist')));
    app.use('/readme-assets', express.static(path.resolve(__dirname, '../assets')));
    app.listen(8004, '127.0.0.1', () => console.log('Gezhi README capture on 8004; synthetic data and simulated AI only.'));
}
main().catch((e) => { console.error(e.message); process.exitCode = 1; });
