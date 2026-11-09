import formulas from '../shared/formula.cjs';
import analytics from '../shared/analytics.cjs';
import contracts from '../shared/contracts.cjs';
import { newSheet } from './files.js';
const { literal, textValue, address, coords, shiftFormula, evaluateFormula } = formulas;
const { matches, numeric, cellValue } = analytics;
const clone = (value) => JSON.parse(JSON.stringify(value));
export function makePreview(book, job, options = {}) {
    if (options.result && !contracts.Result.safeParse(options.result).success)
        throw new Error('编辑后的预览包含空标题、超长内容或不支持的数据类型，请检查后重试');
    if (book.id !== job.request.workbookId || book.revision !== job.request.revision) throw new Error('数据版本已变化，请重新生成');
    const next = clone(book),
        sheet = next.sheets.find((s) => s.id === job.request.sheetId),
        result = options.result || job.result,
        changes = [];
    if (!sheet) throw new Error('原工作表已不存在');
    const wholeSheet =
        job.request.range[0] === 0 &&
        job.request.range[1] === 0 &&
        job.request.range[2] === sheet.columns.length - 1 &&
        job.request.range[3] === sheet.data.length - 1;
    let rowOrder = sheet.data.map((_, y) => y);
    const protectedCell = (x, y) => sheet.columns[x]?.readOnly || sheet.readOnlyCells?.includes(address(x, y));
    const highlight = (x, y, color) => {
        if (protectedCell(x, y)) throw new Error(`${address(x, y)} 是只读单元格`);
        const key = address(x, y),
            before = sheet.style[key] || '';
        sheet.style[key] = before
            .split(';')
            .filter((v) => v.trim() && !/^\s*background(?:-color)?\s*:/i.test(v))
            .concat('background-color: ' + color)
            .join('; ');
        changes.push({ position: key, before, after: sheet.style[key], reason: '修改背景色' });
    };
    const structure = () => {
        if (Object.keys(sheet.mergeCells || {}).length) throw new Error('当前表有合并单元格，请先手动取消合并，再执行结构操作');
    };
    const addColumn = (title) => {
        structure();
        if (sheet.columns.length >= 100) throw new Error('列数不能超过 100');
        let name = title;
        let n = 2;
        while (sheet.columns.some((c) => c.title === name)) name = title + ' ' + n++;
        const x = sheet.columns.length;
        sheet.columns.push({ title: name, width: 210 });
        sheet.data.forEach((r) => {
            while (r.length <= x) r.push('');
        });
        changes.push({ position: '新增列', before: '', after: name });
        return x;
    };
    const write = (x, y, value, reason = '') => {
        if (!sheet.columns[x] || !sheet.data[y]) throw new Error('写入位置超出范围');
        if (protectedCell(x, y)) throw new Error(`${address(x, y)} 是只读单元格`);
        const before = sheet.data[y][x] ?? '';
        sheet.data[y][x] = value;
        changes.push({ position: address(x, y), before: String(textValue(before) ?? ''), after: String(textValue(value) ?? ''), reason });
    };
    const selected = Array.from({ length: job.request.range[3] - job.request.range[1] + 1 }, (_, i) => job.request.range[1] + i);
    if (result.kind === 'fill') {
        const fields = job.request.fields;
        const targets = fields.map((title, i) => {
            const x = Number(options.targets?.[i] ?? -1);
            return x < 0 ? addColumn(title) : x;
        });
        if (new Set(targets).size !== targets.length) throw new Error('多个输出字段不能写入同一列');
        for (const row of result.rows) {
            const y = Number(row.rowId.slice(1));
            row.values.forEach((v, i) => write(targets[i], y, literal(v), row.reason || ''));
        }
    } else if (result.kind === 'clean') {
        const suggestions = result.suggestions.filter((s, i) => !options.excluded?.has(i));
        const annotate = ['duplicates', 'missing'].includes(options.preset);
        let noteCol;
        if (annotate && suggestions.length) noteCol = addColumn('整理建议');
        for (const item of suggestions) {
            const y = Number(item.rowId.slice(1));
            if (annotate) {
                const existing = textValue(sheet.data[y][noteCol]);
                write(noteCol, y, literal([existing, item.reason].filter(Boolean).join('；')));
                highlight(item.column, y, '#fff1b8');
            } else write(item.column, y, literal(item.value), item.reason);
        }
    } else if (result.kind === 'table') {
        if (result.columns.some((c) => !c.trim())) throw new Error('列标题不能为空');
        if (result.rows.some((r) => r.length !== result.columns.length) || new Set(result.columns).size !== result.columns.length)
            throw new Error('表头或列数不一致');
        if (options.tableTarget === 'append') {
            structure();
            if (sheet.data.length + result.rows.length > 1000) throw new Error('追加后超过 1000 行');
            const map = result.columns.map((c, i) => Number(options.mapping?.[i] ?? -1));
            if (map.some((x) => x < 0 || !sheet.columns[x]) || new Set(map).size !== map.length) throw new Error('请为每个生成字段选择不同的目标列');
            if (map.some((x) => sheet.columns[x].readOnly)) throw new Error('目标包含只读列');
            for (const row of result.rows) {
                const y = sheet.data.length;
                sheet.data.push(Array(sheet.columns.length).fill(''));
                row.forEach((v, i) => write(map[i], y, literal(v)));
            }
        } else {
            if (next.sheets.length >= 20) throw new Error('最多支持 20 张工作表');
            const s = newSheet(
                options.sheetName || 'AI 整理',
                result.columns,
                result.rows.map((r) => r.map(literal))
            );
            if (!s.data.length) s.data = [Array(s.columns.length).fill('')];
            next.sheets.push(s);
            next.activeSheetId = s.id;
            result.rows.forEach((r, i) => changes.push({ position: s.name + ' · ' + (i + 1), before: '', after: r.map((v) => v ?? '未提供').join(' · ') }));
        }
    } else if (result.kind === 'formula' && result.formula) {
        const x = Number(options.targets?.[0] ?? -1) < 0 ? addColumn('计算结果') : Number(options.targets[0]);
        for (const y of selected) {
            const f = shiftFormula(result.formula, y - job.request.range[1]);
            try {
                const trial = evaluateFormula(f, sheet.data, new Set([address(x, y)]));
                write(x, y, f, '试算：' + String(trial));
            } catch (e) {
                throw new Error(`${address(x, y)} 试算失败：${e.message}`);
            }
        }
    } else if (result.kind === 'operations') {
        const colors = { yellow: '#fff1b8', green: '#d8f3e4', blue: '#dceafd', red: '#ffddd7' };
        for (const action of result.actions) {
            if (action.type === 'insertColumns') action.titles.forEach(addColumn);
            if (action.type === 'appendRows') {
                structure();
                if (sheet.data.length + action.rows.length > 1000) throw new Error('新增后超过 1000 行');
                for (const r of action.rows) {
                    if (r.length !== sheet.columns.length) throw new Error('新增行列数不匹配');
                    const y = sheet.data.length;
                    sheet.data.push(Array(sheet.columns.length).fill(''));
                    r.forEach((v, x) => write(x, y, literal(v)));
                }
            }
            if (action.type === 'setCells') for (const c of action.cells) write(c.column, rowOrder.indexOf(Number(c.rowId.slice(1))), literal(c.value));
            if (action.type === 'fillCells')
                for (const y of selected) if (matches(sheet, y, action.filters)) for (const x of action.columns) write(x, y, literal(action.value));
            if (action.type === 'highlight')
                for (const y of selected) if (matches(sheet, y, action.filters)) for (const x of action.columns) highlight(x, y, colors[action.color]);
            if (action.type === 'sortRows') {
                structure();
                if (!wholeSheet) throw new Error('整行排序需要整表范围');
                if (sheet.columns.some((c) => c.readOnly) || sheet.readOnlyCells?.length) throw new Error('排序会移动只读单元格，已阻止');
                const order = sheet.data
                    .map((r, y) => y)
                    .sort((a, b) => {
                        const av = cellValue(sheet, a, action.column),
                            bv = cellValue(sheet, b, action.column);
                        if (av === '' || av === null) return bv === '' || bv === null ? 0 : 1;
                        if (bv === '' || bv === null) return -1;
                        const an = numeric(av),
                            bn = numeric(bv);
                        const c = an !== null && bn !== null ? an.cmp(bn) : String(av).localeCompare(String(bv), 'zh-CN');
                        return action.direction === 'desc' ? -c : c;
                    });
                const newStyle = {};
                for (const [key, style] of Object.entries(sheet.style)) {
                    const [x, y] = coords(key);
                    const moved = order.indexOf(y);
                    newStyle[address(x, moved < 0 ? y : moved)] = style;
                }
                sheet.style = newStyle;
                sheet.data = order.map((oldY, newY) =>
                    sheet.data[oldY].map((v) => (typeof v === 'string' && v.startsWith('=') ? shiftFormula(v, newY - oldY) : v))
                );
                rowOrder = order.map((y) => rowOrder[y]);
                order.forEach((oldY, newY) => {
                    if (oldY !== newY) changes.push({ position: `第 ${newY + 1} 行`, before: `原第 ${newY + 1} 行`, after: `原第 ${oldY + 1} 行（整行移动）` });
                });
            }
        }
    } else return { next, changes: [], readOnly: true };
    return { next, changes };
}
