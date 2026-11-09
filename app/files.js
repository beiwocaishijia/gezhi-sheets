import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import formulas from '../shared/formula.cjs';
const { literal, textValue, parseFormula, evaluateFormula, address } = formulas;
const nonempty = (row) => row.some((v) => textValue(v) !== '' && v !== null && v !== undefined);
export function newSheet(name = '工作表 1', columns = ['内容', '备注'], data = [['', '']]) {
    return { id: crypto.randomUUID(), name, columns: columns.map((title) => ({ title, width: 180 })), data, style: {}, mergeCells: {}, readOnlyCells: [] };
}
export function newBook(name = '未命名工作簿', sheets = [newSheet()]) {
    return { id: crypto.randomUUID(), name, revision: 0, sheets, activeSheetId: sheets[0].id };
}
export function sampleBook() {
    const feedback = [
        '每天手工整理销售数据，月底汇总很麻烦。',
        '新员工总问同样的问题，希望他们能自己查资料。',
        '想把客服聊天记录自动归类，找出经常被问的问题。',
        '每天要核对很多采购单，怕漏掉数量和交付要求。',
        '产品说明都是英文，希望批量翻译成中文。',
        '销售拜访结束后，写跟进记录太花时间。',
        '希望按部门查看费用汇总，目前都靠人工相加。',
        '同一家供应商有好几个不同的写法，数据很乱。',
        '想从客户留言中提取需求，但没有明确说预算。',
        '需要给一百件商品写短简介，保持风格统一。',
    ];
    return newBook('客户反馈 · 示例', [
        newSheet(
            '客户反馈',
            ['客户编号', '客户原话', '跟进状态'],
            feedback.map((v, i) => [literal(String(i + 1).padStart(4, '0')), literal(v), literal(i % 3 === 0 ? '待跟进' : '已记录')])
        ),
    ]);
}
export async function readFile(file) {
    if (file.size > 10 * 1024 * 1024) throw new Error('文件超过 10 MB，请拆分后导入');
    const warnings = [];
    let sheets = [];
    if (/\.csv$/i.test(file.name)) {
        const parsed = Papa.parse(await file.text(), { skipEmptyLines: false });
        if (parsed.errors.some((e) => e.type === 'Quotes')) throw new Error('CSV 引号格式不完整');
        sheets = [{ name: file.name.replace(/\.csv$/i, ''), rows: parsed.data.map((row) => row.map(literal)) }];
    } else if (/\.xlsx$/i.test(file.name)) {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(await file.arrayBuffer());
        sheets = wb.worksheets.map((ws) => {
            if (ws.rowCount > 1001 || ws.columnCount > 100) throw new Error(`“${ws.name}” 超过首版 1000 行数据或 100 列的范围，请拆分文件`);
            const rows = [],
                formulaResults = {};
            for (let y = 1; y <= ws.rowCount; y++) {
                const row = [];
                for (let x = 1; x <= ws.columnCount; x++) {
                    const cell = ws.getCell(y, x),
                        v = cell.value;
                    if (v?.formula || v?.sharedFormula) {
                        formulaResults[address(x - 1, y - 1)] = typeof v.result === 'string' ? literal(v.result) : v.result ?? '';
                        try {
                            const f = '=' + cell.formula;
                            parseFormula(f);
                            row.push(f);
                        } catch {
                            row.push(formulaResults[address(x - 1, y - 1)]);
                            warnings.push(`${ws.name}!${cell.address} 的公式不受支持，已使用缓存值`);
                        }
                    } else if (v instanceof Date) row.push(literal(v.toISOString().replace(/T00:00:00\.000Z$/, '')));
                    else if (v?.richText) row.push(literal(v.richText.map((t) => t.text).join('')));
                    else if (v && typeof v === 'object') row.push(literal(v.text ?? v.result ?? ''));
                    else row.push(typeof v === 'string' ? literal(v) : v ?? '');
                }
                rows.push(row);
            }
            return { name: ws.name, rows, formulaResults };
        });
    } else throw new Error('请选择 .xlsx 或 .csv 文件');
    for (const sheet of sheets) {
        while (sheet.rows.length && !nonempty(sheet.rows.at(-1))) sheet.rows.pop();
        if (sheet.rows.length > 1001) throw new Error('每张表最多支持 1000 行数据（另加标题行）');
    }
    return { name: file.name.replace(/\.(xlsx|csv)$/i, ''), sheets, warnings, sourceWarnings: [...warnings] };
}
export function convertImport(raw, firstHeader = true, selected = raw.sheets.map((s, i) => i)) {
    raw.warnings = [...(raw.sourceWarnings || raw.warnings)];
    if (selected.length > 20) throw new Error('每个工作簿最多支持 20 张工作表');
    const sheets = selected.map((index) => {
        const source = raw.sheets[index];
        const width = Math.max(1, ...source.rows.map((r) => r.length));
        if (width > 100) throw new Error('首版最多支持 100 列');
        const titles = Array.from({ length: width }, (_, x) => (firstHeader ? String(textValue(source.rows[0]?.[x] ?? '') || `列 ${x + 1}`) : `列 ${x + 1}`));
        if (titles.some((t) => t.length > 120)) throw new Error('列标题不能超过 120 字符，可取消“首行作为标题”或缩短原文件标题');
        const offset = firstHeader ? 1 : 0;
        const data = source.rows.slice(offset).map((row, y) =>
            Array.from({ length: width }, (_, x) => {
                const v = row[x] ?? '';
                if (typeof v === 'string' && v.startsWith('=')) {
                    try {
                        return formulas.shiftFormula(v, -offset, true);
                    } catch {
                        const warning = `${source.name}!${address(x, y + offset)} 引用了标题或范围外的单元格，已使用缓存值`;
                        if (!raw.warnings.includes(warning)) raw.warnings.push(warning);
                        return source.formulaResults?.[address(x, y + offset)] ?? '';
                    }
                }
                return v;
            })
        );
        if (data.length > 1000) throw new Error('每张表最多 1000 行数据');
        return newSheet(source.name, titles, data.length ? data : [Array(width).fill('')]);
    });
    if (!sheets.length) throw new Error('至少选择一张工作表');
    return newBook(raw.name, sheets);
}
function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export async function excelBuffer(book) {
    const wb = new ExcelJS.Workbook();
    const names = new Set();
    for (const s of book.sheets) {
        let name = s.name.replace(/[\\/*?:[\]]/g, ' ').slice(0, 28) || '工作表';
        const baseName = name;
        let suffix = 2;
        while (names.has(name)) name = baseName.slice(0, 25) + '_' + suffix++;
        names.add(name);
        const ws = wb.addWorksheet(name);
        ws.addRow(s.columns.map((c) => c.title));
        s.columns.forEach((c, x) => (ws.getColumn(x + 1).width = Math.max(10, c.width / 7)));
        s.data.forEach((r, y) =>
            ws.addRow(
                r.map((v, x) => {
                    if (typeof v === 'string' && v.startsWith('=')) {
                        try {
                            parseFormula(v);
                            return { formula: formulas.shiftFormula(v, 1, true, 1001).slice(1), result: evaluateFormula(v, s.data, new Set([address(x, y)])) };
                        } catch {
                            return textValue(v);
                        }
                    }
                    return textValue(v);
                })
            )
        );
        ws.getRow(1).font = { bold: true };
    }
    return wb.xlsx.writeBuffer();
}
export async function exportExcel(book) {
    download(new Blob([await excelBuffer(book)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), book.name + '.xlsx');
}
export function csvContent(sheet) {
    const escapeCsv = (value) => (typeof value === 'string' && /^[=+\-@\t\r\n]/.test(value) ? "'" + value : value);
    const rows = [
        sheet.columns.map((c) => escapeCsv(c.title)),
        ...sheet.data.map((r, y) =>
            r.map((v, x) => {
                let value = textValue(v);
                if (typeof v === 'string' && v.startsWith('=')) {
                    try {
                        value = evaluateFormula(v, sheet.data, new Set([address(x, y)]));
                    } catch {
                        value = '#ERROR';
                    }
                }
                return escapeCsv(value);
            })
        ),
    ];
    return '\uFEFF' + Papa.unparse(rows);
}
export function exportCsv(sheet) {
    download(new Blob([csvContent(sheet)], { type: 'text/csv;charset=utf-8;' }), sheet.name + '.csv');
}
