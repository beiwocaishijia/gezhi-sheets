// Test-only protocol simulator. Production server/index.cjs never imports this module.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const webpack = require('webpack');
const middleware = require('webpack-dev-middleware');
const { createApp } = require('../server/app.cjs');
const { sse } = require('../test-ai/helpers.cjs');
const failed = new Set();
async function mockFetch(url, options) {
    if (url.endsWith('/models')) return Response.json({ data: [{ id: 'protocol-test-model' }] });
    const body = JSON.parse(options.body),
        system = body.messages[0].content;
    if (system.includes('exactly one property')) return sse({ ok: true });
    const ctx = JSON.parse(body.messages[1].content);
    if (ctx.task.includes('慢速')) await new Promise((resolve) => setTimeout(resolve, 1600));
    if (ctx.task.includes('失败一次') && !failed.has(ctx.task)) {
        failed.add(ctx.task);
        return Response.json({ choices: [{ message: { content: 'invalid JSON' } }] });
    }
    if (system.includes('统计由程序执行'))
        return sse(
            /统计|总数量|求和/.test(ctx.task)
                ? {
                      kind: 'query',
                      query: {
                          filters: [],
                          groupBy: [],
                          aggregates: [
                              { op: 'sum', column: 1, name: '总数量' },
                              { op: 'count', name: '记录数' },
                          ],
                          limit: 10,
                      },
                  }
                : { kind: 'summary' }
        );
    if (system.includes('"kind":"fill"'))
        return sse({
            kind: 'fill',
            rows: ctx.rows
                .slice()
                .reverse()
                .map((r, i) => ({
                    rowId: r.rowId,
                    values: ctx.fields.map((f, j) =>
                        ctx.task.includes('公式文本') ? '=SUM(1,2)' : j === 0 ? '需求分类' : j === 1 ? '对应 ' + r.rowId + ' 的摘要' : null
                    ),
                    reason: '根据当前记录',
                })),
        });
    if (system.includes('"kind":"table"'))
        return sse({
            kind: 'table',
            columns: ['客户', '数量', '单价'],
            rows: [
                ['张三', 10, 35],
                ['李四', 5, 38],
            ],
        });
    if (system.includes('"kind":"clean"'))
        return sse({
            kind: 'clean',
            suggestions: ctx.rows
                .slice(0, 2)
                .map((r, i) => ({
                    rowId: r.rowId,
                    column: ctx.columns[0].index,
                    value: '统一名称',
                    reason: i ? '疑似与第1行重复，请人工确认' : '疑似与第2行重复，请人工确认',
                })),
        });
    if (system.includes('"kind":"formula"'))
        return sse(
            ctx.task.includes('解释')
                ? { kind: 'formula', explanation: '这是数量乘以单价的计算。' }
                : { kind: 'formula', formula: '=B1*C1', explanation: '数量乘以单价，逐行填充。' }
        );
    if (system.includes('"kind":"operations"')) {
        if (ctx.task.includes('含糊')) return sse({ kind: 'clarify', question: '要按哪一列排序？' });
        const actions = ctx.task.includes('新增空白行')
            ? [{ type: 'appendRows', rows: [ctx.columns.map(() => null), ctx.columns.map(() => null)] }]
            : ctx.task.includes('条件填值')
            ? [{ type: 'fillCells', filters: [{ column: 1, op: 'gt', value: 6 }], columns: [0], value: '已处理' }]
            : ctx.task.includes('排序')
            ? [{ type: 'sortRows', column: 1, direction: 'asc' }]
            : ctx.task.includes('新增')
            ? [{ type: 'insertColumns', titles: ['AI 备注'] }]
            : [{ type: 'highlight', filters: [{ column: 1, op: 'gt', value: 6 }], columns: [1], color: 'yellow' }];
        return sse({ kind: 'operations', explanation: '按指定范围执行操作。', actions });
    }
    return sse({ kind: 'answer', answer: '已根据选中范围归纳，客户关注效率与数据整理。', citations: ctx.rows.slice(0, 2).map((r) => r.rowId) });
}
async function main() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ce-lab-browser-'));
    const { app } = await createApp({
        root,
        fetchImpl: mockFetch,
        crypt: async (s, decrypt) => (decrypt ? Buffer.from(s, 'base64').toString() : Buffer.from(s).toString('base64')),
    });
    const config = { ...require('../webpack.app.config.cjs'), mode: 'development' };
    app.use(middleware(webpack(config), { publicPath: '/', stats: 'errors-only' }));
    app.listen(8003, '127.0.0.1', () => console.log('格知 AI isolated browser-test server (simulated providers)'));
}
main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
