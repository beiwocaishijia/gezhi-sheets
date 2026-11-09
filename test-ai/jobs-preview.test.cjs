const test = require('node:test');
const assert = require('node:assert/strict');
const { Jobs, validateResult, batches } = require('../server/jobs.cjs');
const { Storage } = require('../server/storage.cjs');
const { JobRequest } = require('../shared/contracts.cjs');
const { temporary, book, request, finished } = require('./helpers.cjs');
async function setup(t, b, complete) {
    const storage = new Storage(await temporary(t));
    const saved = await storage.create(b);
    const jobs = new Jobs(storage, { complete });
    await jobs.init();
    return { storage, jobs, b: saved };
}
const fill = (rows) => ({ kind: 'fill', rows: rows.map((r) => ({ rowId: r.rowId, values: ['摘要'] })) });

test('row IDs, rather than response order, control preview; missing, duplicate and invented IDs are rejected', async () => {
    const b = book(),
        req = JobRequest.parse(request(b));
    const rows = [{ rowId: 'r0' }, { rowId: 'r1' }, { rowId: 'r2' }];
    const good = {
        kind: 'fill',
        rows: [
            { rowId: 'r2', values: [null] },
            { rowId: 'r0', values: ['=1+1'] },
            { rowId: 'r1', values: ['text'] },
        ],
    };
    validateResult(good, req, b.sheets[0], rows);
    for (const ids of [
        ['r0', 'r1'],
        ['r0', 'r1', 'r1'],
        ['r0', 'r1', 'r99'],
    ])
        assert.throws(() => validateResult(fill(ids.map((rowId) => ({ rowId }))), req, b.sheets[0], rows), /缺行|重复|字段/);
    const { makePreview } = await import('../app/preview.js');
    const before = JSON.stringify(b);
    const preview = makePreview(b, { request: req, result: good });
    assert.equal(JSON.stringify(b), before);
    assert.equal(preview.next.sheets[0].data[0][2], "'=1+1");
    assert.equal(preview.next.sheets[0].data[2][2], '');
    assert.throws(() => makePreview({ ...b, revision: 1 }, { request: req, result: good }), /版本/);
});
test('preview blocks read-only and merged structure, supports editable tables and mapped append without executing text', async () => {
    const { makePreview } = await import('../app/preview.js');
    const b = book();
    const req = request(b);
    const job = { request: req, result: fill([{ rowId: 'r0' }]) };
    b.sheets[0].columns[1].readOnly = true;
    assert.throws(() => makePreview(b, job, { targets: [1] }), /只读/);
    b.sheets[0].mergeCells.A1 = [2, 1];
    assert.throws(() => makePreview(b, job), /合并/);
    b.sheets[0].mergeCells = {};
    const table = { request: req, result: { kind: 'table', columns: ['客户', '金额'], rows: [['=danger', 9]] } };
    assert.throws(() => makePreview(b, table, { tableTarget: 'append', mapping: [0, 1] }), /只读/);
    delete b.sheets[0].columns[1].readOnly;
    assert.equal(makePreview(b, table, { tableTarget: 'append', mapping: [0, 1] }).next.sheets[0].data[3][0], "'=danger");
    assert.equal(makePreview(b, table).next.sheets.length, 2);
});
test('duplicate suggestions only annotate; unchecked suggestions are excluded', async () => {
    const { makePreview } = await import('../app/preview.js');
    const b = book(),
        req = request(b, { kind: 'clean', fields: [] });
    const result = {
        kind: 'clean',
        suggestions: [
            { rowId: 'r0', column: 0, value: '甲', reason: '与第3行可能重复' },
            { rowId: 'r2', column: 0, value: '甲', reason: '与第1行可能重复' },
        ],
    };
    const p = makePreview(b, { request: req, result }, { preset: 'duplicates', excluded: new Set([1]) });
    assert.equal(p.next.sheets[0].data.length, 3);
    assert.equal(p.next.sheets[0].data[0][0], '张三');
    assert.equal(p.next.sheets[0].data[2][2], '');
    assert.ok(p.next.sheets[0].data[0][2].includes('可能重复'));
});
test('formula preview trials every selected row and respects relative/absolute references', async () => {
    const { makePreview } = await import('../app/preview.js');
    const b = book([
        ['A', 2],
        ['B', 3],
    ]);
    const result = { kind: 'formula', formula: '=B1*$B$1', explanation: '计算' };
    const p = makePreview(b, { request: request(b, { kind: 'formula' }), result });
    assert.equal(p.next.sheets[0].data[1][2], '=B2*$B$1');
    assert.ok(p.changes.some((c) => c.reason === '试算：6'));
    assert.throws(() => makePreview(b, { request: request(b), result: { ...result, formula: '=1/0' } }), /试算失败/);
});
test('operations sort complete records and styles, append rows/columns and conditionally highlight', async () => {
    const { makePreview } = await import('../app/preview.js');
    const b = book([
        ['小', 2],
        ['大', 5],
    ]);
    b.sheets[0].style.A1 = 'font-weight: bold';
    const result = {
        kind: 'operations',
        actions: [
            { type: 'sortRows', column: 1, direction: 'desc' },
            { type: 'highlight', filters: [{ column: 1, op: 'gt', value: 3 }], columns: [1], color: 'yellow' },
            { type: 'insertColumns', titles: ['备注'] },
        ],
    };
    const p = makePreview(b, { request: request(b, { kind: 'operate' }), result });
    assert.deepEqual(p.next.sheets[0].data, [
        ['大', 5, ''],
        ['小', 2, ''],
    ]);
    assert.equal(p.next.sheets[0].style.A2, 'font-weight: bold');
    assert.match(p.next.sheets[0].style.B1, /fff1b8/);
    assert.throws(() => makePreview(b, { request: request(b, { range: [1, 0, 1, 1] }), result }), /整表/);
});
test('jobs split 41 rows into 20/20/1 with concurrency two, preserve successful chunks and retry only failures', async (t) => {
    let active = 0,
        maxActive = 0,
        calls = [];
    let fail = true;
    const { jobs, b, storage } = await setup(t, book(Array.from({ length: 41 }, (_, i) => ['行' + i, i])), async (id, model, messages) => {
        const context = JSON.parse(messages[1].content),
            rows = context.rows;
        calls.push(rows[0].rowId);
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 20));
        active--;
        if (rows[0].rowId === 'r20' && fail) {
            fail = false;
            throw new Error('临时测试失败');
        }
        return fill(rows.reverse());
    });
    const created = await jobs.create(request(b));
    const first = await finished(jobs, created.id);
    assert.equal(first.status, 'failed');
    assert.equal(first.completed, 2);
    assert.equal(maxActive, 2);
    assert.equal(first.total, 3);
    await jobs.retry(created.id);
    const result = await finished(jobs, created.id);
    assert.equal(result.status, 'completed');
    assert.equal(result.result.rows.length, 41);
    assert.deepEqual(calls.sort(), ['r0', 'r20', 'r20', 'r40']);
    assert.deepEqual((await storage.get(b.id)).sheets, b.sheets);
});
test('cancellation ignores a late response and stale workbook versions reject retries', async (t) => {
    let release;
    const { jobs, b, storage } = await setup(
        t,
        book(),
        async () =>
            new Promise((resolve) => {
                release = () => resolve(fill([{ rowId: 'r0' }, { rowId: 'r1' }, { rowId: 'r2' }]));
            })
    );
    const created = await jobs.create(request(b));
    while (!release) await new Promise((r) => setTimeout(r, 5));
    await jobs.cancel(created.id);
    release();
    const result = await finished(jobs, created.id);
    assert.equal(result.status, 'cancelled');
    assert.equal(result.result, null);
    await storage.save(b.id, b);
    await assert.rejects(jobs.retry(created.id), (e) => e.code === 'STALE');
    await assert.rejects(jobs.create(request(b)), (e) => e.code === 'STALE');
});
test('statistical questions execute a restricted plan against all selected rows including blank records', async (t) => {
    const { jobs, b } = await setup(
        t,
        book([
            ['甲', 0.1],
            ['甲', 0.2],
            ['', null],
        ]),
        async () => ({
            kind: 'query',
            query: {
                filters: [],
                groupBy: [],
                aggregates: [
                    { op: 'sum', column: 1, name: '总金额' },
                    { op: 'count', name: '行数' },
                ],
                limit: 10,
            },
        })
    );
    const created = await jobs.create(request(b, { kind: 'ask', fields: [] }));
    const result = await finished(jobs, created.id);
    assert.equal(result.status, 'completed');
    assert.deepEqual(result.result.rows, [['0.3', 3]]);
    assert.equal(result.result.coveredRows, 3);
});
test('text questions summarize every batch and validate cited row IDs', async (t) => {
    const calls = [];
    const { jobs, b } = await setup(t, book(Array.from({ length: 21 }, (_, i) => ['客户' + i, i])), async (id, model, messages) => {
        const ctx = JSON.parse(messages[1].content);
        calls.push(ctx);
        if (messages[0].content.includes('统计由程序执行')) return { kind: 'summary' };
        return { kind: 'answer', answer: ctx.summaries ? '合并全部批次' : '本批归纳', citations: ctx.rows.length ? [ctx.rows[0].rowId] : [] };
    });
    const created = await jobs.create(request(b, { kind: 'ask', fields: [] }));
    const result = await finished(jobs, created.id);
    assert.equal(result.status, 'completed');
    assert.equal(result.coveredRows, 21);
    assert.equal(result.result.answer, '合并全部批次');
    assert.equal(calls.length, 4);
});
test('all structured task types reject out-of-scope fields, wrong shape and JavaScript formulas', () => {
    const b = book(),
        rows = [{ rowId: 'r0' }];
    assert.throws(() => validateResult({ kind: 'table', columns: ['x'], rows: [[1, 2]] }, JobRequest.parse(request(b, { kind: 'table' })), b.sheets[0], rows));
    assert.throws(() =>
        validateResult({ kind: 'formula', formula: '=eval("1")', explanation: 'x' }, JobRequest.parse(request(b, { kind: 'formula' })), b.sheets[0], rows)
    );
    assert.throws(() =>
        validateResult(
            { kind: 'operations', explanation: 'x', actions: [{ type: 'setCells', cells: [{ rowId: 'r99', column: 0, value: 1 }] }] },
            JobRequest.parse(request(b, { kind: 'operate' })),
            b.sheets[0],
            rows
        )
    );
    assert.throws(() =>
        validateResult(
            { kind: 'query', query: { filters: [], groupBy: [], aggregates: [{ op: 'sum', column: 99, name: 'X' }] } },
            JobRequest.parse(request(b, { kind: 'ask' })),
            b.sheets[0],
            rows,
            'planner'
        )
    );
    assert.throws(() => batches([{ rowId: 'r0', values: { 0: 'x'.repeat(40001) } }]), /过长/);
});
test('row-targeted edits still refer to original records after a preceding sort', async () => {
    const { makePreview } = await import('../app/preview.js');
    const b = book([
        ['小', 2],
        ['大', 5],
    ]);
    const result = {
        kind: 'operations',
        actions: [
            { type: 'insertColumns', titles: ['备注'] },
            { type: 'sortRows', column: 1, direction: 'desc' },
            { type: 'setCells', cells: [{ rowId: 'r0', column: 0, value: '原来的小' }] },
        ],
    };
    const p = makePreview(b, { request: request(b, { kind: 'operate' }), result });
    assert.equal(p.next.sheets[0].data[0][0], '大');
    assert.equal(p.next.sheets[0].data[1][0], "'原来的小");
});
test('read-only cells are protected from text and style changes', async () => {
    const { makePreview } = await import('../app/preview.js');
    const b = book();
    b.sheets[0].readOnlyCells = ['A1'];
    assert.throws(() => makePreview(b, { request: request(b), result: fill([{ rowId: 'r0' }]) }, { targets: [0] }), /只读/);
    assert.throws(
        () =>
            makePreview(b, {
                request: request(b),
                result: { kind: 'operations', actions: [{ type: 'highlight', filters: [], columns: [0], color: 'yellow' }] },
            }),
        /只读/
    );
});
test('duplicate detection includes complete cross-batch candidate records within the 20-row limit', async (t) => {
    const rows = Array.from({ length: 24 }, (_, i) => ['客户' + i + '独特信息' + i, i]);
    rows[23] = [...rows[0]];
    let found = false;
    const { jobs, b } = await setup(t, book(rows), async (id, model, messages) => {
        const ctx = JSON.parse(messages[1].content);
        assert.ok(ctx.rows.length + ctx.referenceRows.length <= 20);
        if (ctx.rows.some((r) => r.rowId === 'r0')) found = ctx.referenceRows.some((r) => r.rowId === 'r23');
        return { kind: 'clean', suggestions: [] };
    });
    const created = await jobs.create(request(b, { kind: 'clean', cleanMode: 'duplicates', fields: [] }));
    assert.equal((await finished(jobs, created.id)).status, 'completed');
    assert.equal(found, true);
});
test('formula requests include the source expression; operation planning executes conditions in the program', async (t) => {
    let context;
    const { jobs, b } = await setup(
        t,
        book([
            ['甲', '=1/0'],
            ['乙', 4],
        ]),
        async (id, model, messages) => {
            context = JSON.parse(messages[1].content);
            return { kind: 'formula', explanation: '原公式除数为零' };
        }
    );
    const created = await jobs.create(request(b, { kind: 'formula', fields: [] }));
    await finished(jobs, created.id);
    assert.equal(context.sourceFormulas[0].value, '=1/0');
    assert.equal(context.rows.length, 1);
    const { makePreview } = await import('../app/preview.js');
    const result = { kind: 'operations', actions: [{ type: 'fillCells', filters: [{ column: 1, op: 'gt', value: 3 }], columns: [0], value: '待确认' }] };
    const p = makePreview(b, { request: request(b, { kind: 'operate' }), result });
    assert.equal(p.next.sheets[0].data[0][0], '甲');
    assert.equal(p.next.sheets[0].data[1][0], "'待确认");
});
