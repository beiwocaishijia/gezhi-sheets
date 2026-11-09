const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { parseFormula, evaluateFormula, shiftFormula } = require('../shared/formula.cjs');
const { runQuery, numeric } = require('../shared/analytics.cjs');
const { Query } = require('../shared/contracts.cjs');
const { book } = require('./helpers.cjs');

test('whitelisted formula grammar handles references, escaped strings, arithmetic and conditional evaluation', () => {
    const data = [
        [2, 3, "'0007"],
        [4, null, "'=1+1"],
    ];
    assert.equal(evaluateFormula('=SUM(A1:B2)', data), 9);
    assert.equal(evaluateFormula('=IF(A1>1,ROUND(AVERAGE(A1:A2),1),1/0)', data), 3);
    assert.equal(evaluateFormula('=C1&" / "&C2', data), '0007 / =1+1');
    assert.equal(evaluateFormula('=AND(NOT(FALSE),OR(TRUE,FALSE),ABS(-2)=2)', data), true);
    assert.equal(evaluateFormula('="Say ""hi"""', data), 'Say "hi"');
    assert.equal(evaluateFormula('=MAX(A1:B2)-MIN(A1:B2)+COUNT(A1:B2)+COUNTA(A1:B2)', data), 8);
});
test('formula grammar rejects code, external references, unapproved functions and cycles', () => {
    for (const f of [
        '=globalThis.alert(1)',
        '=SUM.constructor("return 1")()',
        '=WEBSERVICE("https://x")',
        '=Sheet2!A1',
        '=A1;process.exit()',
        '=SUM(A1',
        '=1e999',
    ])
        assert.throws(() => parseFormula(f));
    assert.throws(() => evaluateFormula('=A1', [['=A1']]), /循环/);
    assert.throws(() => evaluateFormula('=1/0', []), /零/);
});
test('relative fill and Excel header relocation leave string literals and exponent numbers intact', () => {
    assert.equal(shiftFormula('=A1+$B$2+1E10+"A1"', 2), '=A3+$B$2+1E10+"A1"');
    assert.equal(shiftFormula('=A1+$B$2', 1, true), '=A2+$B$3');
    assert.throws(() => shiftFormula('=A1', -1), /范围/);
});
test('statistics use exact decimal arithmetic, treat missing data as unknown and support grouping/filtering/top N', () => {
    const b = book([
        ['甲', 0.1],
        ['甲', 0.2],
        ['甲', null],
        ['乙', '未提供'],
        ['丙', 9],
    ]);
    const q = Query.parse({
        filters: [{ column: 0, op: 'ne', value: '丙' }],
        groupBy: [0],
        aggregates: [
            { op: 'sum', column: 1, name: '总额' },
            { op: 'average', column: 1, name: '均值' },
            { op: 'count', name: '记录数' },
        ],
        orderBy: { field: '总额', direction: 'desc' },
        limit: 2,
    });
    const r = runQuery(b.sheets[0], [0, 1, 2, 3, 4], q);
    assert.deepEqual(r.rows, [
        ['甲', '0.3', '0.15', 3],
        ['乙', null, null, 1],
    ]);
    assert.equal(r.matchedRows, 4);
    assert.equal(numeric('未提供'), null);
    assert.equal(numeric('￥1,200.30').toString(), '1200.3');
});
test('XLSX round trip preserves Chinese, literal formula text, leading zeroes, multiple sheets and absolute references', async () => {
    const { newBook, newSheet, excelBuffer, readFile, convertImport } = await import('../app/files.js');
    const original = newBook('中文', [
        newSheet('订单', ['编号', '数量', '公式', '文本'], [["'0007", 2, '=$B$1*B1', "'=SUM(1,2)"]]),
        newSheet('第二张', ['备注'], [["'中文"]]),
    ]);
    const buffer = await excelBuffer(original);
    const excel = new ExcelJS.Workbook();
    await excel.xlsx.load(buffer);
    assert.equal(excel.worksheets[0].getCell('C2').formula, '$B$2*B2');
    const file = { name: '中文.xlsx', size: buffer.length, arrayBuffer: async () => buffer };
    const restored = convertImport(await readFile(file));
    assert.deepEqual(
        restored.sheets.map((s) => s.data),
        original.sheets.map((s) => s.data)
    );
});
test('CSV header choice and trailing empty rows preserve identifiers and formula-like text', async () => {
    const { readFile, convertImport } = await import('../app/files.js');
    const raw = await readFile({ name: '编号.csv', size: 80, text: async () => '编号,内容\r\n0001,=1+1\r\n\r\n' });
    assert.deepEqual(convertImport(raw).sheets[0].data, [["'0001", "'=1+1"]]);
    assert.equal(convertImport(raw, false).sheets[0].data.length, 2);
});
test('unsupported imported formula falls back to cached value with a visible warning', async () => {
    const { readFile, convertImport } = await import('../app/files.js');
    const wb = new ExcelJS.Workbook(),
        ws = wb.addWorksheet('缓存');
    ws.addRow(['值']);
    ws.addRow([{ formula: 'VLOOKUP(A2,A2:B3,2,FALSE)', result: '0007' }]);
    const bytes = await wb.xlsx.writeBuffer();
    const raw = await readFile({ name: '缓存.xlsx', size: bytes.length, arrayBuffer: async () => bytes });
    assert.equal(raw.warnings.length, 1);
    assert.equal(convertImport(raw).sheets[0].data[0][0], "'0007");
});
test('CSV export escapes formula-like headers as well as cell text; safe computed results remain numeric', async () => {
    const { csvContent, newSheet } = await import('../app/files.js');
    const text = csvContent(newSheet('导出', ['=1+1', '值'], [["'=SUM(1,2)", '=1+2']]));
    const parsed = require('papaparse').parse(text).data;
    assert.deepEqual(parsed[0], ["'=1+1", '值']);
    assert.deepEqual(parsed[1], ["'=SUM(1,2)", '3']);
});
test('Excel export resolves colliding long worksheet names without looping and ROUND handles negative halves', async () => {
    const { newBook, newSheet, excelBuffer } = await import('../app/files.js');
    const name = 'A'.repeat(25);
    const b = newBook('名称', [newSheet(name), newSheet(name + '_2'), newSheet(name)]);
    const out = new ExcelJS.Workbook();
    await out.xlsx.load(await excelBuffer(b));
    assert.equal(new Set(out.worksheets.map((s) => s.name)).size, 3);
    assert.equal(evaluateFormula('=ROUND(-1.5,0)', []), -2);
    assert.equal(evaluateFormula('=ROUND(1.005,2)', []), 1.01);
});
