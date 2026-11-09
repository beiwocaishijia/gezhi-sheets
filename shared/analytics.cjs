const Decimal = require('decimal.js');
const { evaluateFormula, textValue } = require('./formula.cjs');
function cellValue(sheet, y, x) {
    const v = sheet.data[y]?.[x] ?? '';
    if (typeof v === 'string' && v.startsWith('=')) {
        try {
            return evaluateFormula(v, sheet.data, new Set([require('./formula.cjs').address(x, y)]));
        } catch {
            return null;
        }
    }
    return textValue(v);
}
function numeric(value) {
    if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
    const text = String(value)
        .trim()
        .replace(/^[¥￥$]\s*/, '');
    if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(text)) return null;
    try {
        const n = new Decimal(text.replace(/,/g, ''));
        return n.isFinite() ? n : null;
    } catch {
        return null;
    }
}
function matches(sheet, y, filters) {
    return filters.every((f) => {
        const v = cellValue(sheet, y, f.column),
            t = textValue(f.value);
        if (f.op === 'empty') return v === null || v === '';
        if (f.op === 'notEmpty') return v !== null && v !== '';
        if (f.op === 'contains') return String(v ?? '').includes(String(t ?? ''));
        if (f.op === 'eq') return String(v ?? '') === String(t ?? '');
        if (f.op === 'ne') return String(v ?? '') !== String(t ?? '');
        const a = numeric(v),
            b = numeric(t);
        if (a === null || b === null) return false;
        return { gt: a.gt(b), gte: a.gte(b), lt: a.lt(b), lte: a.lte(b) }[f.op];
    });
}
function runQuery(sheet, rows, query) {
    const included = rows.filter((y) => matches(sheet, y, query.filters));
    const groups = new Map();
    if (!query.groupBy.length) groups.set('[]', { keys: [], rows: [] });
    for (const y of included) {
        const keys = query.groupBy.map((x) => cellValue(sheet, y, x));
        const id = JSON.stringify(keys);
        if (!groups.has(id)) groups.set(id, { keys, rows: [] });
        groups.get(id).rows.push(y);
    }
    const columns = [...query.groupBy.map((x) => sheet.columns[x].title), ...query.aggregates.map((a) => a.name)];
    if (new Set(columns).size !== columns.length) throw new Error('统计结果列名不能重复，请指定不同名称');
    const skipped = new Set();
    let result = [...groups.values()].map((g) => [
        ...g.keys,
        ...query.aggregates.map((a) => {
            if (a.op === 'count')
                return a.column === undefined
                    ? g.rows.length
                    : g.rows.filter((y) => {
                          const v = cellValue(sheet, y, a.column);
                          return v !== '' && v !== null;
                      }).length;
            if (a.column === undefined) throw new Error('统计操作缺少数字列');
            const nums = g.rows.map((y) => numeric(cellValue(sheet, y, a.column)));
            nums.forEach((n, i) => {
                if (n === null) skipped.add(g.rows[i] + ':' + a.column);
            });
            const valid = nums.filter((n) => n !== null);
            if (!valid.length) return null;
            if (a.op === 'min') return Decimal.min(...valid).toString();
            if (a.op === 'max') return Decimal.max(...valid).toString();
            const sum = valid.reduce((s, n) => s.plus(n), new Decimal(0));
            return (a.op === 'average' ? sum.div(valid.length) : sum).toString();
        }),
    ]);
    if (query.orderBy) {
        const x = columns.indexOf(query.orderBy.field);
        if (x < 0) throw new Error('排序字段不在统计结果中');
        result.sort((a, b) => {
            const av = numeric(a[x]),
                bv = numeric(b[x]);
            const cmp = av !== null && bv !== null ? av.cmp(bv) : String(a[x] ?? '').localeCompare(String(b[x] ?? ''), 'zh-CN');
            return query.orderBy.direction === 'desc' ? -cmp : cmp;
        });
    }
    return {
        kind: 'statistics',
        columns,
        rows: result.slice(0, query.limit),
        matchedRows: included.length,
        coveredRows: rows.length,
        skippedNumericValues: skipped.size,
        totalGroups: result.length,
    };
}
module.exports = { cellValue, numeric, matches, runQuery };
