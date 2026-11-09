const Decimal = require('decimal.js');
const FUNCTIONS = ['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'COUNTA', 'IF', 'ROUND', 'ABS', 'AND', 'OR', 'NOT'];
const columnName = (x) => {
    let s = '';
    for (x++; x; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
    return s;
};
const address = (x, y) => columnName(x) + (y + 1);
const coords = (ref) => {
    const m = /^\$?([A-Z]+)\$?([1-9]\d*)$/.exec(ref);
    if (!m) throw new Error('无效单元格引用');
    return [Array.from(m[1]).reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1, Number(m[2]) - 1];
};
const textValue = (v) => (typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v);
const literal = (v) => (v === null || v === undefined ? '' : typeof v === 'string' ? "'" + v : v);

function parseFormula(source) {
    if (typeof source !== 'string' || !source.startsWith('=') || source.length > 4000) throw new Error('公式必须以 = 开头且不超过 4000 字符');
    const tokens = [];
    let p = 1;
    while (p < source.length) {
        if (/\s/.test(source[p])) {
            p++;
            continue;
        }
        const rest = source.slice(p);
        const m = /^("(?:[^"]|"")*"|\$?[A-Za-z]+\$?[1-9]\d*|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z]+|<>|<=|>=|[+\-*/^&=<>(),:])/.exec(rest);
        if (!m) throw new Error('公式包含不支持的语法：' + rest.slice(0, 15));
        tokens.push(m[0]);
        p += m[0].length;
    }
    let i = 0;
    let depth = 0;
    const precedence = { '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, '&': 2, '+': 3, '-': 3, '*': 4, '/': 4, '^': 5 };
    function expression(min = 0) {
        if (++depth > 60) throw new Error('公式嵌套过深');
        let left = primary();
        while (precedence[tokens[i]] >= min) {
            const op = tokens[i++];
            const right = expression(precedence[op] + (op === '^' ? 0 : 1));
            left = { type: 'op', op, left, right };
        }
        depth--;
        return left;
    }
    function primary() {
        const token = tokens[i++];
        if (!token) throw new Error('公式不完整');
        if (token === '+' || token === '-') return { type: 'unary', op: token, value: expression(5) };
        if (token === '(') {
            const value = expression();
            if (tokens[i++] !== ')') throw new Error('缺少右括号');
            return value;
        }
        if (token.startsWith('"')) return { type: 'value', value: token.slice(1, -1).replace(/""/g, '"') };
        if (/^(?:\d|\.)/.test(token)) {
            const value = Number(token);
            if (!Number.isFinite(value)) throw new Error('数值超出范围');
            return { type: 'value', value };
        }
        const upper = token.toUpperCase();
        if (/^\$?[A-Z]+\$?\d+$/.test(upper)) {
            coords(upper);
            if (tokens[i] === ':') {
                i++;
                const end = (tokens[i++] || '').toUpperCase();
                coords(end);
                return { type: 'range', start: upper, end };
            }
            return { type: 'ref', ref: upper };
        }
        if (upper === 'TRUE' || upper === 'FALSE') return { type: 'value', value: upper === 'TRUE' };
        if (!FUNCTIONS.includes(upper)) throw new Error('暂不支持函数或名称：' + token);
        if (tokens[i++] !== '(') throw new Error('函数缺少括号');
        const args = [];
        if (tokens[i] !== ')') {
            do {
                args.push(expression());
            } while (tokens[i] === ',' && i++);
        }
        if (tokens[i++] !== ')') throw new Error('函数参数或括号不完整');
        if (
            (upper === 'IF' && (args.length < 2 || args.length > 3)) ||
            (['ABS', 'NOT'].includes(upper) && args.length !== 1) ||
            (upper === 'ROUND' && (args.length < 1 || args.length > 2))
        )
            throw new Error('函数参数数量错误');
        return { type: 'call', name: upper, args };
    }
    const ast = expression();
    if (i !== tokens.length) throw new Error('公式包含多余内容');
    return ast;
}

function evaluateFormula(source, data, trail = new Set()) {
    const ast = parseFormula(source);
    const number = (v) => {
        if (v === '' || v === null || v === undefined) return 0;
        const n = Number(v);
        if (!Number.isFinite(n)) throw new Error('引用内容不是数字');
        return n;
    };
    const cell = (ref) => {
        const [x, y] = coords(ref);
        if (x > 16383 || y > 999) throw new Error('引用超出支持范围');
        const id = address(x, y);
        if (trail.has(id)) throw new Error('循环引用');
        const v = data[y]?.[x] ?? '';
        if (typeof v === 'string' && v.startsWith("'")) return v.slice(1);
        if (typeof v === 'string' && v.startsWith('=')) return evaluateFormula(v, data, new Set([...trail, id]));
        return v;
    };
    function run(node) {
        if (node.type === 'value') return node.value;
        if (node.type === 'ref') return cell(node.ref);
        if (node.type === 'range') {
            const [x1, y1] = coords(node.start),
                [x2, y2] = coords(node.end);
            const out = [];
            if ((Math.abs(x2 - x1) + 1) * (Math.abs(y2 - y1) + 1) > 100000) throw new Error('公式范围过大');
            for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) out.push(cell(address(x, y)));
            return out;
        }
        if (node.type === 'unary') return (node.op === '-' ? -1 : 1) * number(run(node.value));
        if (node.type === 'op') {
            const a = run(node.left),
                b = run(node.right);
            switch (node.op) {
                case '&':
                    return String(a ?? '') + String(b ?? '');
                case '=':
                    return a == b;
                case '<>':
                    return a != b;
                case '<':
                    return a < b;
                case '>':
                    return a > b;
                case '<=':
                    return a <= b;
                case '>=':
                    return a >= b;
                case '+':
                    return number(a) + number(b);
                case '-':
                    return number(a) - number(b);
                case '*':
                    return number(a) * number(b);
                case '/':
                    if (number(b) === 0) throw new Error('除数为零');
                    return number(a) / number(b);
                case '^':
                    return number(a) ** number(b);
            }
        }
        if (node.name === 'IF') return run(node.args[0]) ? run(node.args[1]) : node.args[2] ? run(node.args[2]) : false;
        const args = node.args.map(run).flat(Infinity);
        const nums = args.filter((v) => v !== '' && v !== null && v !== undefined && typeof v !== 'boolean' && Number.isFinite(Number(v))).map(Number);
        switch (node.name) {
            case 'SUM':
                return nums.reduce((a, b) => a + b, 0);
            case 'AVERAGE':
                if (!nums.length) throw new Error('没有可计算的数字');
                return nums.reduce((a, b) => a + b, 0) / nums.length;
            case 'MIN':
                return nums.length ? Math.min(...nums) : 0;
            case 'MAX':
                return nums.length ? Math.max(...nums) : 0;
            case 'COUNT':
                return nums.length;
            case 'COUNTA':
                return args.filter((v) => v !== '' && v !== null && v !== undefined).length;
            case 'ABS':
                return Math.abs(number(args[0]));
            case 'ROUND': {
                const digits = number(args[1] ?? 0);
                if (!Number.isInteger(digits) || Math.abs(digits) > 15) throw new Error('小数位超出范围');
                return new Decimal(number(args[0]))
                    .div(new Decimal(10).pow(-digits))
                    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
                    .mul(new Decimal(10).pow(-digits))
                    .toNumber();
            }
            case 'AND':
                return args.every(Boolean);
            case 'OR':
                return args.some(Boolean);
            case 'NOT':
                return !args[0];
        }
        throw new Error('不支持的公式');
    }
    const result = run(ast);
    if (typeof result === 'number' && !Number.isFinite(result)) throw new Error('计算结果超出范围');
    return result;
}
function shiftFormula(source, delta, includeAbsolute = false, maxRow = 1000) {
    parseFormula(source);
    const shifted = source.replace(/("(?:[^"]|"")*")|(?<![A-Za-z0-9_.])(\$?[A-Za-z]+)(\$?)([1-9]\d*)(?![A-Za-z0-9_.])/g, (match, text, col, fixed, row) => {
        if (text || (fixed && !includeAbsolute)) return match;
        const next = Number(row) + delta;
        if (next < 1 || next > maxRow) throw new Error('调整后的引用超出范围');
        return col + fixed + next;
    });
    parseFormula(shifted);
    return shifted;
}
module.exports = { FUNCTIONS, parseFormula, evaluateFormula, shiftFormula, columnName, address, coords, literal, textValue };
