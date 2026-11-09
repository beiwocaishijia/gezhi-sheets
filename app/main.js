import jspreadsheet from '../src/index.js';
import '../src/jspreadsheet.css';
import 'jsuites/dist/jsuites.css';
import './style.css';
import { api } from './api.js';
import { newBook, newSheet, sampleBook, readFile, convertImport, exportExcel, exportCsv } from './files.js';
import { makePreview } from './preview.js';
import formulas from '../shared/formula.cjs';
const { address, textValue, parseFormula, literal } = formulas;
jspreadsheet.setDictionary({
    'Insert a new column before': '在左侧插入列',
    'Insert a new column after': '在右侧插入列',
    'Delete selected columns': '删除所选列',
    'Insert a new row before': '在上方插入行',
    'Insert a new row after': '在下方插入行',
    'Delete selected rows': '删除所选行',
    'Order ascending': '升序排序',
    'Order descending': '降序排序',
    'Rename this column': '重命名此列',
    Copy: '复制',
    Cut: '剪切',
    Paste: '粘贴',
    Undo: '撤销',
    Redo: '重做',
    'Save as': '另存为',
    About: '关于',
    'Are you sure?': '确定执行吗？',
    'This action will destroy any existing merged cells. Are you sure?': '该操作会拆分合并单元格，确定执行吗？',
});
const clone = (v) => JSON.parse(JSON.stringify(v));
const $ = (selector) => document.querySelector(selector);
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tasks = {
    fill: {
        title: '批量填列',
        eyebrow: '从内容到信息',
        description: '提取、分类、翻译或总结，让结果留在原始记录旁边。',
        instruction: '逐行提取需求类别和一句话需求摘要。没有提供的信息留空。',
    },
    table: {
        title: '文字转表',
        eyebrow: '让零散文字成为记录',
        description: '粘贴订单、留言或清单，先检查列名与数据，再放入表格。',
        instruction: '提取文字里的记录，生成清晰的列标题。缺失的字段留空。',
    },
    clean: {
        title: '整理数据',
        eyebrow: '把数据整理清楚',
        description: '比较原内容与修改建议，逐项选择需要采用的结果。',
        instruction: '统一选中数据里的名称写法，保留原始事实。给出每项建议的原因。',
    },
    ask: {
        title: '表格问答',
        eyebrow: '读懂当前数据',
        description: '归纳内容，或进行分组、求和与排名。精确统计由程序完成。',
        instruction: '这些记录里最值得关注的问题有哪些？请注明依据行。',
    },
    formula: {
        title: '公式助手',
        eyebrow: '用中文表达计算',
        description: '生成、解释和排查公式。应用前会验证语法并逐行试算。',
        instruction: '根据列标题生成计算公式，并解释它的含义。',
    },
    operate: {
        title: '操作表格',
        eyebrow: '先看变化，再执行',
        description: '新增行列、填值、整行排序或条件标色，始终由你确认。',
        instruction: '把跟进状态为“待跟进”的单元格标成黄色。',
    },
};
const state = {
    book: null,
    books: [],
    grid: null,
    selection: null,
    kind: 'fill',
    serial: 0,
    dirty: false,
    saving: null,
    loading: false,
    journal: [],
    future: [],
    last: null,
    pending: null,
    job: null,
    stream: null,
    providers: null,
    provider: '',
    model: '',
    saveTimer: null,
    saveError: null,
    renderSerial: 0,
};
function toast(message, error = false) {
    const host = $('#toast');
    host.textContent = message;
    host.className = 'toast visible' + (error ? ' error' : '');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => host.classList.remove('visible'), 6000);
}
function modal(title, content, wide = false) {
    const element = document.createElement('dialog');
    element.className = wide ? 'wide' : '';
    element.innerHTML = `<header><h2>${escape(
        title
    )}</h2><button class="quiet close-dialog" aria-label="关闭">关闭</button></header><div class="dialog-body">${content}</div>`;
    document.body.append(element);
    element.querySelector('.close-dialog').onclick = () => element.close();
    element.addEventListener('close', () => element.remove());
    element.showModal();
    return element;
}
function sheet() {
    return state.book.sheets.find((s) => s.id === state.book.activeSheetId);
}
function content(book) {
    const copy = clone(book);
    delete copy.revision;
    delete copy.updatedAt;
    return JSON.stringify(copy);
}
function readGrid() {
    if (!state.grid || state.loading) return;
    const s = sheet(),
        o = state.grid.options;
    s.columns = o.columns.map((c, x) => ({
        title: String(c.title || formulas.columnName(x)),
        width: Math.max(40, Math.min(1200, Number(c.width) || 160)),
        ...(c.readOnly ? { readOnly: true } : {}),
    }));
    s.data = o.data.map((r) => Array.from({ length: s.columns.length }, (_, x) => r[x] ?? ''));
    s.readOnlyCells = [];
    for (let y = 0; y < s.data.length; y++)
        for (let x = 0; x < s.columns.length; x++) {
            if (!s.columns[x].readOnly && state.grid.isReadOnly(x, y)) s.readOnlyCells.push(address(x, y));
        }
    s.style = Object.fromEntries(
        Object.entries(o.style || {})
            .map(([cell, style]) => [
                cell,
                style
                    .split(';')
                    .map((v) => v.trim())
                    .filter((v) => v && !/^(text-align:\s*left|white-space:\s*pre-wrap)$/.test(v))
                    .join('; '),
            ])
            .filter(([, style]) => style)
    );
    while (
        s.data.length > Math.max(1, state.logicalRows || 1) &&
        s.data
            .at(-1)
            .every((v, x) => (v === '' || v === null) && !s.readOnlyCells.includes(address(x, s.data.length - 1)) && !s.style[address(x, s.data.length - 1)])
    )
        s.data.pop();
    state.logicalRows = s.data.length;
    s.mergeCells = clone(o.mergeCells || {});
}
function changed() {
    if (state.loading) return;
    readGrid();
    if (state.last && content(state.book) === content(state.last)) return;
    if (state.last) state.journal.push(clone(state.last));
    if (state.journal.length > 30) state.journal.shift();
    state.future = [];
    state.serial++;
    state.last = clone(state.book);
    state.dirty = true;
    state.saveError = null;
    saveStatus();
    scheduleSave();
    renderFooter();
    renderHistory();
    if (state.pending) renderResult();
}
function scheduleSave() {
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => ensureSaved().catch((e) => toast(e.message, true)), 600);
}
async function ensureSaved() {
    clearTimeout(state.saveTimer);
    if (state.saving) {
        await state.saving;
        if (state.dirty) return ensureSaved();
        return;
    }
    if (!state.dirty) return;
    readGrid();
    const serial = state.serial,
        doc = clone(state.book);
    saveStatus('正在保存…');
    state.saving = api('/workbooks/' + doc.id, 'PUT', doc);
    try {
        const saved = await state.saving;
        if (state.book.id === saved.id) {
            state.book.revision = saved.revision;
            state.book.updatedAt = saved.updatedAt;
            state.dirty = state.serial !== serial;
            state.saveError = null;
            if (state.last) {
                state.last.revision = saved.revision;
                state.last.updatedAt = saved.updatedAt;
            }
            const option = $('#book-list')?.querySelector(`option[value="${saved.id}"]`);
            if (option) option.textContent = saved.name;
            saveStatus();
        }
    } catch (e) {
        state.saveError = e;
        saveStatus();
        throw e;
    } finally {
        state.saving = null;
    }
    if (state.dirty && !state.saveError) return ensureSaved();
}
function saveStatus(message) {
    $('#save-status').textContent = message || (state.saveError ? '保存失败 · 点击重试' : state.dirty ? '有未保存修改' : '已保存到本机');
    $('#save-status').classList.toggle('save-error', !!state.saveError);
}
function renderHistory() {
    $('#undo').disabled = !state.journal.length;
    $('#redo').disabled = !state.future.length;
}
async function history(forward = false) {
    if (state.loading) return;
    await ensureSaved();
    const from = forward ? state.future : state.journal,
        to = forward ? state.journal : state.future;
    if (!from.length) return;
    to.push(clone(state.book));
    const target = from.pop();
    target.revision = state.book.revision;
    state.book = target;
    $('#book-title').value = target.name;
    state.serial++;
    state.last = clone(target);
    state.dirty = true;
    await renderGrid();
    renderTabs();
    renderHistory();
    saveStatus();
    scheduleSave();
    renderResult();
}
function renderFooter() {
    const s = sheet();
    $('#table-count').textContent = `${s.data.length} 行 · ${s.columns.length} 列`;
    $('#range-status').textContent = state.selection
        ? `${address(state.selection[0], state.selection[1])}:${address(state.selection[2], state.selection[3])}`
        : '选择单元格开始';
    renderScope();
}
async function renderGrid() {
    state.loading = true;
    state.selection = null;
    state.grid = null;
    const serial = ++state.renderSerial;
    const root = $('#grid');
    if (root.spreadsheet) jspreadsheet.destroy(root, true);
    root.replaceChildren();
    const s = sheet();
    state.logicalRows = s.data.length;
    await new Promise((resolve, reject) => {
        try {
            const instances = jspreadsheet(root, {
                tabs: false,
                toolbar: false,
                allowExport: false,
                parseHTML: false,
                autoCasting: false,
                formulaEvaluator(expression, x, y, instance) {
                    return formulas.evaluateFormula(expression, instance.options.data, new Set([address(x, y)]));
                },
                worksheets: [
                    {
                        worksheetName: s.name,
                        data: clone(s.data),
                        columns: s.columns.map((c) => ({ ...c, type: 'text', align: 'left', wordWrap: true })),
                        style: clone(s.style),
                        mergeCells: clone(s.mergeCells),
                        minDimensions: [s.columns.length, 20],
                        tableOverflow: true,
                        tableWidth: '100%',
                        tableHeight: Math.max(280, window.innerHeight - 235) + 'px',
                        defaultColAlign: 'left',
                        allowComments: false,
                    },
                ],
                onload() {
                    if (serial === state.renderSerial) {
                        state.grid = instances[0];
                        for (const cell of s.readOnlyCells || []) state.grid.setReadOnly(cell, true);
                        state.loading = false;
                        renderFooter();
                    }
                    resolve();
                },
                onselection(instance, x1, y1, x2, y2) {
                    if (state.loading) return;
                    state.selection = [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
                    renderFooter();
                },
                onbeforechange(instance, cell, x, y, value) {
                    if (typeof value === 'string' && value.startsWith('=')) {
                        try {
                            parseFormula(value);
                        } catch (e) {
                            toast(e.message + '；已按普通文本保存', true);
                            return literal(value);
                        }
                    }
                },
                onbeforeinsertrow(instance, rows) {
                    if (instance.options.data.length + rows.length > 1000) {
                        toast('每张工作表最多 1000 行，请拆分数据', true);
                        return false;
                    }
                },
                onbeforeinsertcolumn(instance, columns) {
                    if (instance.options.columns.length + columns.length > 100) {
                        toast('每张工作表最多 100 列，请拆分数据', true);
                        return false;
                    }
                },
                onbeforepaste(instance, rows, x, y) {
                    if (Number(y) + rows.length > 1000 || Number(x) + Math.max(0, ...rows.map((r) => r.length)) > 100) {
                        toast('粘贴范围超过 1000 行或 100 列，请拆分数据', true);
                        return false;
                    }
                },
                oninsertrow(instance, rows) {
                    if (!state.loading) for (const row of rows) state.logicalRows = row.row <= state.logicalRows ? state.logicalRows + 1 : row.row + 1;
                },
                ondeleterow(instance, rows) {
                    if (!state.loading) state.logicalRows = Math.max(1, state.logicalRows - rows.filter((y) => y < state.logicalRows).length);
                },
                onevent(event) {
                    if (
                        !state.loading &&
                        /^(onafterchanges|oninsertrow|ondeleterow|oninsertcolumn|ondeletecolumn|onchangestyle|onchangeheader|onmoverow|onmovecolumn|onsort|onmerge|onunmerge|onresizecolumn|onbatch|onundo|onredo)$/.test(
                            event
                        )
                    ) {
                        queueMicrotask(changed);
                    }
                },
            });
        } catch (e) {
            state.loading = false;
            reject(e);
        }
    });
}
function renderTabs() {
    $('#sheets').innerHTML =
        state.book.sheets
            .map((s) => `<button class="sheet-tab ${s.id === state.book.activeSheetId ? 'selected' : ''}" data-id="${s.id}">${escape(s.name)}</button>`)
            .join('') + '<button id="add-sheet" class="add-tab" title="新增工作表">＋</button>';
    $('#sheets')
        .querySelectorAll('[data-id]')
        .forEach(
            (b) =>
                (b.onclick = async () => {
                    try {
                        await ensureSaved();
                        state.book.activeSheetId = b.dataset.id;
                        state.serial++;
                        state.last = clone(state.book);
                        state.dirty = true;
                        await renderGrid();
                        renderTabs();
                        scheduleSave();
                    } catch (e) {
                        toast(e.message, true);
                    }
                })
        );
    $('#add-sheet').onclick = () => {
        if (state.book.sheets.length >= 20) return toast('最多 20 张工作表', true);
        const d = modal(
            '新增工作表',
            '<label>工作表名称<input id="sheet-name" value="新工作表" maxlength="80"></label><button class="primary" id="create-sheet">创建</button>'
        );
        d.querySelector('#create-sheet').onclick = async () => {
            const name = d.querySelector('input').value.trim();
            if (!name) return;
            readGrid();
            const before = clone(state.book);
            const s = newSheet(name);
            state.book.sheets.push(s);
            state.book.activeSheetId = s.id;
            state.journal.push(before);
            state.future = [];
            state.serial++;
            state.last = clone(state.book);
            state.dirty = true;
            d.close();
            await renderGrid();
            renderTabs();
            renderHistory();
            scheduleSave();
        };
    };
}
async function loadBook(book) {
    if (isRunning()) throw new Error('请先取消或完成当前任务，再切换工作簿');
    state.stream?.close();
    state.stream = null;
    state.book = book;
    localStorage.setItem('ce-lab-last-book', book.id);
    state.journal = [];
    state.future = [];
    state.last = clone(book);
    state.dirty = false;
    state.pending = null;
    state.job = null;
    state.serial++;
    $('#book-title').value = book.name;
    await renderGrid();
    renderTabs();
    renderHistory();
    saveStatus();
    renderResult();
}
async function refreshBooks() {
    state.books = await api('/workbooks');
    $('#book-list').innerHTML = state.books
        .map((b) => `<option value="${b.id}" ${b.id === state.book?.id ? 'selected' : ''}>${escape(b.name)}</option>`)
        .join('');
}
async function createBook(book) {
    if (isRunning()) throw new Error('请先取消或完成当前任务，再新建工作簿');
    await ensureSaved();
    const saved = await api('/workbooks', 'POST', book);
    await loadBook(saved);
    await refreshBooks();
    toast('工作簿已创建并保存');
}
function modelChoice() {
    try {
        return JSON.parse(localStorage.getItem('ce-lab-choice') || '{}');
    } catch {
        return {};
    }
}
function rememberChoice() {
    localStorage.setItem('ce-lab-choice', JSON.stringify({ provider: state.provider, model: state.model }));
    let models = {};
    try {
        models = JSON.parse(localStorage.getItem('ce-lab-models') || '{}');
    } catch {
        /* Start a fresh preference map. */
    }
    models[state.provider] = state.model;
    localStorage.setItem('ce-lab-models', JSON.stringify(models));
}
function lastModel(provider) {
    try {
        return JSON.parse(localStorage.getItem('ce-lab-models') || '{}')[provider];
    } catch {
        return null;
    }
}
function refreshModelUI() {
    const { catalog, configs } = state.providers;
    $('#provider').innerHTML = Object.entries(catalog)
        .map(([id, p]) => `<option value="${id}">${escape(p.name)}${configs[id]?.configured ? '' : ' · 未配置'}</option>`)
        .join('');
    if (!catalog[state.provider]) state.provider = Object.keys(catalog).find((id) => configs[id]?.configured) || 'glm';
    $('#provider').value = state.provider;
    const config = configs[state.provider];
    if (!state.model) state.model = config?.model || catalog[state.provider].models[0];
    $('#model').value = state.model;
    $('#model').disabled = isRunning();
    $('#provider').disabled = isRunning();
    $('#models').innerHTML = catalog[state.provider].models.map((m) => `<option value="${escape(m)}"></option>`).join('');
    $('#model-state').textContent = config?.verifiedAt && config.verifiedModel === state.model ? '连接已验证' : '未验证';
    $('#model-state').classList.toggle('verified', !!(config?.verifiedAt && config.verifiedModel === state.model));
    $('#configure-hint').hidden = !!config?.configured;
    $('#generate').disabled = !config?.configured || isRunning();
}
async function refreshProviders() {
    state.providers = await api('/providers');
    refreshModelUI();
}
function providerSettings(initial = state.provider) {
    if (isRunning()) return toast('请先等待当前任务完成或取消任务');
    const d = modal(
        '模型与 API 配置',
        '<p class="muted">密钥由本机 Windows 账户加密保管。预设模型不代表你的账户已开通。</p><div id="provider-tabs" class="provider-tabs"></div><div id="provider-form"></div>',
        true
    );
    let selected = initial;
    const draw = () => {
        const catalog = state.providers.catalog,
            config = state.providers.configs[selected],
            preset = catalog[selected];
        d.querySelector('#provider-tabs').innerHTML = Object.entries(catalog)
            .map(
                ([id, p]) =>
                    `<button class="${id === selected ? 'selected' : ''}" data-provider="${id}">${escape(p.name.split(' · ')[0])}<small>${
                        state.providers.configs[id]?.configured ? '已配置' : '未配置'
                    }</small></button>`
            )
            .join('');
        d.querySelectorAll('[data-provider]').forEach(
            (b) =>
                (b.onclick = () => {
                    selected = b.dataset.provider;
                    draw();
                })
        );
        d.querySelector(
            '#provider-form'
        ).innerHTML = `<div class="settings-grid"><label>API Key<input id="api-key" type="password" autocomplete="new-password" placeholder="${escape(
            config?.maskedKey || '输入该厂商的 API Key'
        )}" maxlength="500"><span class="help">${
            config?.configured ? '留空保留现有密钥；输入新密钥后保存以替换。' : '只保存在本机，不会写入代码仓库。'
        }</span></label><label>模型 ID<input id="settings-model" list="settings-models" value="${escape(
            config?.model || preset.models[0]
        )}"><datalist id="settings-models">${preset.models.map((m) => `<option value="${escape(m)}"></option>`).join('')}</datalist><span class="help">${
            selected === 'doubao' ? '可填写 Model ID 或 ep- 开头的接入点 ID。' : '支持预设、搜索及手动输入模型 ID。'
        }</span></label></div><details><summary>高级设置</summary><label>官方 API 地址<input id="base-url" value="${escape(
            config?.baseUrl || preset.baseUrl
        )}" ${selected !== 'qwen' ? 'readonly' : ''}></label>${
            selected === 'qwen' ? '<p class="help">北京、新加坡等地域的 Key 不能混用；可填写官方工作空间专属地址。</p>' : ''
        }<label>结构化输出<select id="json-mode"><option value="json_object">JSON 模式（推荐）</option><option value="prompt">仅提示词约束（用于不支持 JSON 模式的模型）</option></select></label></details><div id="settings-status" class="inline-note">${
            config?.verifiedAt ? '上次验证：' + new Date(config.verifiedAt).toLocaleString() : '尚未进行真实连接测试'
        }</div><div class="dialog-actions"><button id="fetch-models" class="secondary">获取模型列表</button><button id="delete-key" class="quiet danger">删除密钥</button><span class="spacer"></span><button id="save-provider" class="secondary">保存配置</button><button id="test-provider" class="primary">保存并测试连接</button></div>`;
        d.querySelector('#json-mode').value = config?.format || 'json_object';
        const status = (message) => (d.querySelector('#settings-status').textContent = message);
        const save = async (test = false) => {
            const key = d.querySelector('#api-key').value.trim();
            const model = d.querySelector('#settings-model').value.trim();
            if (!model) throw new Error('请填写模型 ID');
            const body = {
                model,
                baseUrl: d.querySelector('#base-url').value.trim(),
                format: d.querySelector('#json-mode').value,
                ...(key ? { apiKey: key } : {}),
            };
            status('正在加密保存…');
            await api('/providers/' + selected, 'PUT', body);
            d.querySelector('#api-key').value = '';
            state.provider = selected;
            state.model = model;
            rememberChoice();
            try {
                if (test) {
                    status('正在进行真实 API 连接测试…');
                    await api('/providers/' + selected + '/test', 'POST', { model });
                    status('连接成功，JSON 响应已验证');
                } else status('已加密保存，尚未验证连接');
            } finally {
                await refreshProviders();
            }
        };
        const guarded = (fn) => async () => {
            d.querySelectorAll('button').forEach((b) => (b.disabled = true));
            try {
                await fn();
            } catch (e) {
                status(e.message);
            } finally {
                d.querySelectorAll('button').forEach((b) => (b.disabled = false));
            }
        };
        d.querySelector('#save-provider').onclick = guarded(() => save(false));
        d.querySelector('#test-provider').onclick = guarded(() => save(true));
        d.querySelector('#fetch-models').onclick = guarded(async () => {
            const response = await api('/providers/' + selected + '/models');
            d.querySelector('#settings-models').innerHTML = response.models
                .map((m) => `<option value="${escape(m.id)}" label="${m.source === 'api' ? '厂商返回' : '官方预设'}"></option>`)
                .join('');
            status(response.note);
        });
        d.querySelector('#delete-key').onclick = guarded(async () => {
            await api('/providers/' + selected, 'DELETE', {});
            await refreshProviders();
            draw();
            status('该厂商密钥已删除');
        });
    };
    draw();
}
function renderTask() {
    const task = tasks[state.kind];
    $('#task-tabs').innerHTML = Object.entries(tasks)
        .map(([id, t]) => `<button data-task="${id}" class="${id === state.kind ? 'selected' : ''}" ${isRunning() ? 'disabled' : ''}>${t.title}</button>`)
        .join('');
    $('#task-tabs')
        .querySelectorAll('button')
        .forEach(
            (b) =>
                (b.onclick = () => {
                    state.kind = b.dataset.task;
                    state.pending = null;
                    state.job = null;
                    renderTask();
                })
        );
    $('#task-eyebrow').textContent = task.eyebrow;
    $('#task-description').textContent = task.description;
    $('#instruction').value = task.instruction;
    $('#pasted-text-label').hidden = state.kind !== 'table';
    $('#preset-label').hidden = !['fill', 'clean'].includes(state.kind);
    $('#fields-label').hidden = state.kind !== 'fill';
    const presets =
        state.kind === 'clean'
            ? [
                  ['normalize', '统一名称'],
                  ['split', '信息拆分'],
                  ['missing', '缺失提示'],
                  ['duplicates', '疑似重复'],
              ]
            : [
                  ['extract', '提取信息'],
                  ['classify', '自动分类'],
                  ['summarize', '生成摘要'],
                  ['translate', '翻译成中文'],
                  ['custom', '自定义任务'],
              ];
    $('#preset').innerHTML = presets.map(([id, title]) => `<option value="${id}">${title}</option>`).join('');
    $('#fields').value = '需求类别，需求摘要';
    renderScope();
    renderResult();
}
function setPreset() {
    const p = $('#preset').value;
    const choices = {
        extract: ['逐行提取需求类别和一句话需求摘要，缺失信息留空。', '需求类别，需求摘要'],
        classify: ['根据每行内容给出简短的类别，类别名称保持一致。', '分类'],
        summarize: ['为每行内容生成一句话摘要，忠实保留关键事实。', '摘要'],
        translate: ['将每行内容翻译成自然的中文，保持事实与数字。', '中文译文'],
        custom: ['根据我的要求逐行处理选区内容。', 'AI 结果'],
        normalize: ['统一选区中同一名称的不同写法，逐项给出依据，不改变事实。', ''],
        split: ['将每行资料拆分为指定字段，原文没提供的内容留空。', '名称，规格，数量'],
        missing: ['只标记需要补充或人工确认的信息，不补造缺失内容，建议值保留原值。', ''],
        duplicates: ['寻找疑似重复记录，只标记并说明与哪一行相似；建议值保留原值，不删除记录。', ''],
    };
    const [instruction, fields] = choices[p];
    $('#instruction').value = instruction;
    $('#fields').value = fields;
    $('#fields-label').hidden = state.kind === 'clean' && p !== 'split';
}
function range() {
    const s = sheet();
    if ($('#scope').value === 'all') return [0, 0, s.columns.length - 1, Math.max(0, s.data.length - 1)];
    if (!state.selection) return null;
    const r = [...state.selection];
    r[2] = Math.min(r[2], s.columns.length - 1);
    r[3] = Math.min(r[3], Math.max(0, s.data.length - 1));
    if (r[1] > r[3]) return null;
    return r;
}
function renderScope() {
    if (!state.book) return;
    const r = range();
    $('#scope-detail').textContent = r
        ? `${address(r[0], r[1])}:${address(r[2], r[3])} · ${r[3] - r[1] + 1} 行 · ${r[2] - r[0] + 1} 列`
        : '先在表格中拖选需要处理的数据';
}
function isRunning() {
    return state.submitting || (!!state.job && ['queued', 'running'].includes(state.job.status));
}
async function generate() {
    if (isRunning()) return;
    state.submitting = true;
    refreshModelUI();
    try {
        changed();
        await ensureSaved();
        const s = sheet();
        let selected = range();
        if (state.kind === 'table') selected = [0, 0, s.columns.length - 1, Math.max(0, s.data.length - 1)];
        if (!selected) throw new Error('请先选择数据，或将数据范围切换为整张表');
        const fields = ['fill', 'clean'].includes(state.kind)
            ? $('#fields')
                  .value.split(/[,，\n]/)
                  .map((s) => s.trim())
                  .filter(Boolean)
            : [];
        if (state.kind === 'clean' && $('#preset').value !== 'split') fields.length = 0;
        const request = {
            kind: state.kind,
            cleanMode: state.kind === 'clean' ? $('#preset').value : 'normalize',
            providerId: state.provider,
            model: $('#model').value.trim(),
            workbookId: state.book.id,
            sheetId: s.id,
            revision: state.book.revision,
            range: selected,
            instruction: $('#instruction').value.trim(),
            fields,
            text: state.kind === 'table' ? $('#pasted-text').value : '',
        };
        state.model = request.model;
        rememberChoice();
        const snapshot = clone(state.book),
            snapshotSerial = state.serial;
        const job = await api('/ai/jobs', 'POST', request);
        state.submitting = false;
        state.job = job;
        state.pending = {
            job,
            serial: snapshotSerial,
            base: snapshot,
            options: { preset: $('#preset').value, targets: [], excluded: new Set(), tableTarget: 'new', mapping: [] },
        };
        watchJob(job.id);
        refreshModelUI();
        renderResult();
    } catch (e) {
        toast(e.message, true);
    } finally {
        state.submitting = false;
        refreshModelUI();
    }
}
function watchJob(id) {
    state.stream?.close();
    state.stream = new EventSource('/api/ai/jobs/' + id + '/events');
    state.stream.onmessage = (e) => {
        const job = JSON.parse(e.data);
        state.job = job;
        if (state.pending) state.pending.job = job;
        if (!['queued', 'running'].includes(job.status)) {
            state.stream.close();
            state.stream = null;
        }
        refreshModelUI();
        renderResult();
    };
    state.stream.onerror = () => {
        const progress = $('#job-progress');
        if (progress) progress.textContent = '连接中断，正在重新连接本地服务…';
    };
}
function pendingPreview() {
    const p = state.pending;
    if (!p || p.serial !== state.serial || state.book.id !== p.base.id || state.book.revision !== p.job.request.revision)
        throw new Error('表格已修改，旧预览已失效。请重新生成。');
    return makePreview(p.base, p.job, p.options);
}
function targetOptions(selected = -1) {
    return (
        `<option value="-1">新增结果列（保留原数据）</option>` +
        sheet()
            .columns.map(
                (c, x) =>
                    `<option value="${x}" ${x === Number(selected) ? 'selected' : ''}>${escape(c.title)} · ${formulas.columnName(x)}${
                        c.readOnly ? '（只读）' : ''
                    }</option>`
            )
            .join('')
    );
}
function renderResult() {
    const host = $('#result');
    const job = state.job;
    host.dataset.model = job ? `${state.providers.catalog[job.request.providerId]?.name || job.request.providerId} · ${job.request.model}` : '';
    $('#generate').hidden = isRunning();
    $('#cancel-job').hidden = !isRunning();
    $('#task-tabs')
        ?.querySelectorAll('button')
        .forEach((b) => (b.disabled = isRunning()));
    if (!job) {
        host.innerHTML =
            '<div class="empty-result"><span class="small-label">你来决定最后一步</span><p>生成结果会先出现在这里。<br>检查后再应用到表格。</p></div>';
        return;
    }
    if (isRunning()) {
        host.innerHTML = `<div class="progress-block"><span class="activity"></span><h3>正在处理数据</h3><p id="job-progress">已完成 ${job.completed} / ${
            job.total
        } 批次</p><progress value="${job.completed}" max="${Math.max(job.total, 1)}"></progress><p class="help">结果尚未写入表格，可以随时取消。</p></div>`;
        return;
    }
    if (['failed', 'interrupted', 'cancelled'].includes(job.status)) {
        host.innerHTML = `<div class="error-box"><h3>${job.status === 'cancelled' ? '任务已取消' : '部分任务尚未完成'}</h3><p>${escape(
            job.error || job.errors.map((e) => e.message).join('；') || '已保留完成的批次，可以重试未完成部分。'
        )}</p><p class="help">完成 ${job.completed}/${
            job.total
        } 批次，表格未被修改。</p><button id="retry-job" class="secondary">重试未完成部分</button></div>`;
        $('#retry-job').onclick = async () => {
            try {
                await ensureSaved();
                const retried = await api('/ai/jobs/' + job.id + '/retry', 'POST', {});
                state.job = retried;
                watchJob(job.id);
                renderResult();
            } catch (e) {
                toast(e.message, true);
            }
        };
        return;
    }
    const result = state.pending?.options.result || job.result;
    if (!result) {
        host.textContent = '任务完成，但没有可用结果。';
        return;
    }
    if (result.kind === 'clarify') {
        host.innerHTML = `<div class="answer"><span class="small-label">需要补充一点信息</span><p>${escape(
            result.question
        )}</p><button class="secondary" id="answer-clarification">在要求中补充回答</button></div>`;
        $('#answer-clarification').onclick = () => {
            $('#instruction').value += '\n需要澄清：' + result.question + '\n我的回答：';
            $('#instruction').focus();
        };
        return;
    }
    if (result.kind === 'answer') {
        host.innerHTML = `<div class="answer"><span class="small-label">AI 内容归纳 · 覆盖 ${job.coveredRows} 行</span><p class="answer-body">${escape(
            result.answer
        )}</p><p class="help">依据：${escape(
            result.citations.map((id) => '第 ' + (Number(id.slice(1)) + 1) + ' 行').join('、') || '未标注具体行，请结合原文检查'
        )}</p></div>`;
        return;
    }
    if (result.kind === 'statistics') {
        host.innerHTML = `<div class="answer"><span class="small-label">程序计算 · 非模型估算</span><p>覆盖 ${result.coveredRows} 行，符合条件 ${
            result.matchedRows
        } 行。</p>${miniTable(result.columns, result.rows)}<p class="help">忽略 ${result.skippedNumericValues} 个空值或非数字值；共 ${
            result.totalGroups
        } 组。</p></div>`;
        return;
    }
    if (result.kind === 'formula' && !result.formula) {
        host.innerHTML = `<div class="answer"><span class="small-label">公式说明</span><p class="answer-body">${escape(result.explanation)}</p></div>`;
        return;
    }
    let controls = '';
    const p = state.pending;
    if (['fill', 'formula'].includes(result.kind)) {
        const fields = result.kind === 'fill' ? job.request.fields : ['计算结果'];
        controls = fields
            .map((name, i) => `<label class="target-row">${escape(name)}<select data-target="${i}">${targetOptions(p.options.targets[i])}</select></label>`)
            .join('');
    }
    if (result.kind === 'table') {
        controls = `<label>放入哪里<select id="table-target"><option value="new">新建工作表</option><option value="append" ${
            p.options.tableTarget === 'append' ? 'selected' : ''
        }>追加到当前表</option></select></label>`;
        if (p.options.tableTarget === 'append')
            controls += result.columns
                .map(
                    (title, i) =>
                        `<label>${escape(title)}<select data-map="${i}"><option value="-1">请选择目标列</option>${sheet()
                            .columns.map((c, x) => `<option value="${x}" ${Number(p.options.mapping[i]) === x ? 'selected' : ''}>${escape(c.title)}</option>`)
                            .join('')}</select></label>`
                )
                .join('');
    }
    if (result.kind === 'clean')
        controls += `<p class="help">${result.suggestions.length} 项建议 · 可在完整预览中勾选采用。${
            ['duplicates', 'missing'].includes(p.options.preset) ? '将新增“整理建议”列，原内容保留。' : ''
        }</p>`;
    if (result.kind === 'operations') {
        const labels = {
            insertColumns: '新增列',
            appendRows: '新增记录',
            setCells: '填入内容',
            fillCells: '按条件填值',
            sortRows: '整行排序',
            highlight: '条件标色',
        };
        controls += `<p class="help">范围：${address(job.request.range[0], job.request.range[1])}:${address(
            job.request.range[2],
            job.request.range[3]
        )}</p><ol class="operation-steps">${result.actions
            .map(
                (a) =>
                    `<li>${labels[a.type]}${
                        a.titles
                            ? '：' + escape(a.titles.join('、'))
                            : a.type === 'sortRows'
                            ? '：' + escape(sheet().columns[a.column].title) + (a.direction === 'desc' ? '（降序）' : '（升序）')
                            : a.rows
                            ? '：' + a.rows.length + ' 行'
                            : a.cells
                            ? '：' + a.cells.length + ' 格'
                            : ''
                    }</li>`
            )
            .join('')}</ol>`;
    }
    let preview, error;
    try {
        preview = pendingPreview();
    } catch (e) {
        error = e.message;
    }
    host.innerHTML = `<div class="preview-block"><div class="result-head"><h3>检查生成结果</h3><span class="badge">未写入</span></div>${
        result.explanation ? `<p class="help">${escape(result.explanation)}</p>` : ''
    }${controls}${
        error
            ? `<div class="error-box">${escape(error)}</div>`
            : miniTable(
                  ['位置', '原内容', '建议内容'],
                  preview.changes.slice(0, 5).map((c) => [c.position, c.before || '空', c.after || '未提供'])
              )
    }<div class="preview-actions"><button id="expand-preview" class="secondary">${
        result.kind === 'table' ? '编辑完整预览' : '查看完整预览'
    }</button><button id="apply-result" class="primary" ${error || !preview?.changes.length ? 'disabled' : ''}>应用${
        preview ? ' ' + preview.changes.length + ' 项变化' : ''
    }</button></div><p class="help">应用后可一次撤销。${
        job.usage?.prompt_tokens ? '本次输入 ' + job.usage.prompt_tokens + ' / 输出 ' + (job.usage.completion_tokens || 0) + ' tokens' : ''
    }</p></div>`;
    host.querySelectorAll('[data-target]').forEach(
        (el) =>
            (el.onchange = () => {
                p.options.targets[Number(el.dataset.target)] = Number(el.value);
                renderResult();
            })
    );
    if ($('#table-target'))
        $('#table-target').onchange = (e) => {
            p.options.tableTarget = e.target.value;
            renderResult();
        };
    host.querySelectorAll('[data-map]').forEach(
        (el) =>
            (el.onchange = () => {
                p.options.mapping[Number(el.dataset.map)] = Number(el.value);
                renderResult();
            })
    );
    $('#expand-preview').onclick = expandedPreview;
    $('#apply-result').onclick = applyResult;
}
function miniTable(columns, rows) {
    return `<div class="preview-table-wrap"><table class="preview-table"><thead><tr>${columns
        .map((c) => `<th>${escape(c)}</th>`)
        .join('')}</tr></thead><tbody>${rows
        .map((r) => `<tr>${r.map((v) => `<td>${escape(v ?? '未提供')}</td>`).join('')}</tr>`)
        .join('')}</tbody></table></div>`;
}
function expandedPreview() {
    const p = state.pending;
    if (!p) return;
    let page = 0;
    const d = modal('完整修改预览', '<div id="preview-pages"></div>', true);
    const draw = () => {
        const result = p.options.result || p.job.result;
        let rows, columns;
        try {
            const preview = pendingPreview();
            rows = preview.changes.map((c) => [c.position, c.before, c.after, c.reason || '']);
            columns = ['位置', '原内容', '建议内容', '依据 / 试算'];
        } catch (e) {
            if (result.kind !== 'table' && result.kind !== 'clean') {
                d.querySelector('#preview-pages').textContent = e.message;
                return;
            }
            rows = [];
            columns = [];
        }
        let html = '';
        if (result.kind === 'table') {
            if (!p.options.result) p.options.result = clone(result);
            const r = p.options.result;
            html = `<p class="help">可编辑列名和内容；原始数字字段按数字保存，其他内容按文本保存。</p><div class="preview-table-wrap"><table class="editable-table"><thead><tr>${r.columns
                .map((c, x) => `<th><input data-col="${x}" value="${escape(c)}" aria-label="列标题 ${x + 1}"></th>`)
                .join('')}</tr></thead><tbody>${r.rows
                .slice(page * 25, (page + 1) * 25)
                .map(
                    (row, i) =>
                        `<tr>${row
                            .map(
                                (v, x) =>
                                    `<td><input data-row="${page * 25 + i}" data-x="${x}" value="${escape(v ?? '')}" aria-label="第 ${page * 25 + i + 1} 行第 ${
                                        x + 1
                                    } 列"></td>`
                            )
                            .join('')}</tr>`
                )
                .join('')}</tbody></table></div>`;
            rows = r.rows;
        } else if (result.kind === 'clean') {
            rows = result.suggestions;
            html = rows
                .slice(page * 25, (page + 1) * 25)
                .map((r, i) => {
                    const index = page * 25 + i;
                    return `<label class="suggestion"><input type="checkbox" data-check="${index}" ${
                        p.options.excluded.has(index) ? '' : 'checked'
                    }><span><strong>${address(r.column, Number(r.rowId.slice(1)))}</strong><small>原值：${escape(
                        textValue(p.base.sheets.find((s) => s.id === p.job.request.sheetId).data[Number(r.rowId.slice(1))]?.[r.column]) ?? '空'
                    )}</small>建议：${escape(r.value ?? '未提供')}<small>${escape(r.reason)}</small></span></label>`;
                })
                .join('');
        } else html = miniTable(columns, rows.slice(page * 25, (page + 1) * 25));
        html += `<div class="pager"><button class="secondary" id="prev-page" ${page === 0 ? 'disabled' : ''}>上一页</button><span>第 ${page + 1} / ${Math.max(
            1,
            Math.ceil(rows.length / 25)
        )} 页 · ${rows.length} 项</span><button class="secondary" id="next-page" ${(page + 1) * 25 >= rows.length ? 'disabled' : ''}>下一页</button></div>`;
        d.querySelector('#preview-pages').innerHTML = html;
        d.querySelector('#prev-page').onclick = () => {
            page--;
            draw();
        };
        d.querySelector('#next-page').onclick = () => {
            page++;
            draw();
        };
        d.querySelectorAll('[data-col]').forEach(
            (el) =>
                (el.onchange = () => {
                    p.options.result.columns[Number(el.dataset.col)] = el.value.trim();
                    renderResult();
                })
        );
        d.querySelectorAll('[data-row]').forEach(
            (el) =>
                (el.onchange = () => {
                    const y = Number(el.dataset.row),
                        x = Number(el.dataset.x),
                        old = p.options.result.rows[y][x];
                    p.options.result.rows[y][x] =
                        el.value === '' ? null : typeof old === 'number' && Number.isFinite(Number(el.value)) ? Number(el.value) : el.value;
                    renderResult();
                })
        );
        d.querySelectorAll('[data-check]').forEach(
            (el) =>
                (el.onchange = () => {
                    const index = Number(el.dataset.check);
                    if (el.checked) p.options.excluded.delete(index);
                    else p.options.excluded.add(index);
                    renderResult();
                })
        );
    };
    draw();
}
async function applyResult() {
    const button = $('#apply-result');
    button.disabled = true;
    try {
        changed();
        await ensureSaved();
        const preview = pendingPreview();
        if (!preview.changes.length) throw new Error('没有需要应用的变化');
        const before = clone(state.book),
            p = state.pending;
        const nextSheet = preview.next.sheets.find((s) => s.id === sheet().id);
        // Use the component transaction for edits on the active sheet, then rebuild from the validated snapshot.
        if (nextSheet && nextSheet.id === preview.next.activeSheetId) {
            state.loading = true;
            try {
                state.grid.batch((ws) => {
                    const oldCols = ws.options.columns.length;
                    if (nextSheet.columns.length > oldCols)
                        ws.insertColumn(nextSheet.columns.length - oldCols, oldCols - 1, false, nextSheet.columns.slice(oldCols));
                    if (nextSheet.data.length > ws.options.data.length)
                        ws.insertRow(nextSheet.data.length - ws.options.data.length, ws.options.data.length - 1, false);
                    const values = [];
                    nextSheet.data.forEach((r, y) =>
                        r.forEach((value, x) => {
                            if (value !== (ws.options.data[y]?.[x] ?? '')) values.push({ x, y, value });
                        })
                    );
                    if (values.length) ws.setValue(values);
                    if (Object.keys(nextSheet.style).length) ws.setStyle(nextSheet.style);
                });
            } finally {
                state.loading = false;
            }
        }
        state.book = preview.next;
        state.journal.push(before);
        state.future = [];
        state.serial++;
        state.last = clone(state.book);
        state.dirty = true;
        state.pending = null;
        state.job = null;
        await renderGrid();
        renderTabs();
        renderHistory();
        renderResult();
        await ensureSaved();
        toast(`已应用 ${preview.changes.length} 项变化，可一次撤销`);
    } catch (e) {
        toast(e.message, true);
        if (state.pending) renderResult();
    }
}
async function importFile(file) {
    if (!file) return;
    try {
        await ensureSaved();
        const raw = await readFile(file);
        const d = modal(
            '导入表格预览',
            '<div class="import-options"><label><input id="header-row" type="checkbox" checked> 第一行作为列标题</label><div id="import-sheets"></div></div><div id="import-preview"></div><div class="dialog-actions"><span class="spacer"></span><button id="confirm-import" class="primary">导入为新工作簿</button></div>',
            true
        );
        d.querySelector('#import-sheets').innerHTML = raw.sheets
            .map((s, i) => `<label><input type="checkbox" data-import-sheet="${i}" checked> ${escape(s.name)}</label>`)
            .join('');
        const preview = () => {
            const selected = [...d.querySelectorAll('[data-import-sheet]:checked')].map((el) => Number(el.dataset.importSheet));
            try {
                const b = convertImport(raw, d.querySelector('#header-row').checked, selected);
                d.querySelector('#import-preview').innerHTML =
                    b.sheets
                        .map(
                            (s) =>
                                `<h3>${escape(s.name)} · ${s.data.length} 行</h3>${miniTable(
                                    s.columns.map((c, x) => {
                                        const types = [
                                            ...new Set(
                                                s.data
                                                    .map((r) => r[x])
                                                    .filter((v) => v !== '' && v !== null)
                                                    .map((v) =>
                                                        typeof v === 'number'
                                                            ? '数字'
                                                            : typeof v === 'boolean'
                                                            ? '布尔值'
                                                            : typeof v === 'string' && v.startsWith('=')
                                                            ? '公式'
                                                            : '文本'
                                                    )
                                            ),
                                        ];
                                        return c.title + ' · ' + (types.join('/') || '空值');
                                    }),
                                    s.data.slice(0, 5).map((r) => r.map(textValue))
                                )}`
                        )
                        .join('') +
                    (raw.warnings.length ? `<p class="error-box">${escape(raw.warnings.slice(0, 10).join('；'))}（共 ${raw.warnings.length} 项）</p>` : '');
                d.querySelector('#confirm-import').disabled = false;
                return b;
            } catch (e) {
                d.querySelector('#import-preview').textContent = e.message;
                d.querySelector('#confirm-import').disabled = true;
            }
        };
        d.querySelectorAll('input').forEach((el) => (el.onchange = preview));
        preview();
        d.querySelector('#confirm-import').onclick = async () => {
            try {
                const b = preview();
                await createBook(b);
                d.close();
            } catch (e) {
                toast(e.message, true);
            }
        };
    } catch (e) {
        toast(e.message, true);
    }
}
function bind() {
    $('#settings').onclick = () => providerSettings();
    $('#configure-key').onclick = () => providerSettings();
    $('#provider').onchange = (e) => {
        state.provider = e.target.value;
        state.model = lastModel(state.provider) || state.providers.configs[state.provider]?.model || state.providers.catalog[state.provider].models[0];
        rememberChoice();
        refreshModelUI();
    };
    $('#model').onchange = (e) => {
        state.model = e.target.value.trim();
        rememberChoice();
        refreshModelUI();
    };
    $('#preset').onchange = setPreset;
    $('#scope').onchange = renderScope;
    $('#generate').onclick = generate;
    $('#cancel-job').onclick = async () => {
        try {
            await api('/ai/jobs/' + state.job.id + '/cancel', 'POST', {});
        } catch (e) {
            toast(e.message, true);
        }
    };
    $('#new-book').onclick = () => createBook(newBook()).catch((e) => toast(e.message, true));
    $('#sample-book').onclick = () => createBook(sampleBook()).catch((e) => toast(e.message, true));
    $('#book-list').onchange = async (e) => {
        try {
            await ensureSaved();
            await loadBook(await api('/workbooks/' + e.target.value));
        } catch (error) {
            toast(error.message, true);
        }
    };
    $('#book-title').onchange = () => {
        const name = $('#book-title').value.trim();
        if (!name) {
            $('#book-title').value = state.book.name;
            return;
        }
        state.book.name = name;
        changed();
    };
    $('#save-status').onclick = () => ensureSaved().catch((e) => toast(e.message, true));
    $('#undo').onclick = () => history().catch((e) => toast(e.message, true));
    $('#redo').onclick = () => history(true).catch((e) => toast(e.message, true));
    $('#import').onclick = () => $('#file-input').click();
    $('#file-input').onchange = (e) => {
        void importFile(e.target.files[0]);
        e.target.value = '';
    };
    $('#export-xlsx').onclick = async () => {
        try {
            changed();
            await exportExcel(state.book);
        } catch (e) {
            toast(e.message, true);
        }
    };
    $('#export-csv').onclick = () => {
        readGrid();
        exportCsv(sheet());
    };
    $('#toggle-ai').onclick = () => {
        $('#workspace').classList.toggle('ai-collapsed');
        $('#toggle-ai').setAttribute('aria-expanded', String(!$('#workspace').classList.contains('ai-collapsed')));
    };
    document.addEventListener(
        'keydown',
        (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                e.stopImmediatePropagation();
                void ensureSaved().catch((err) => toast(err.message, true));
                return;
            }
            if (e.target.closest('dialog') || e.target.closest('#ai-panel')) return;
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                e.stopImmediatePropagation();
                void history(e.shiftKey).catch((err) => toast(err.message, true));
            }
        },
        true
    );
    window.addEventListener('beforeunload', (e) => {
        if (state.dirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
}
async function start() {
    $(
        '#app'
    ).innerHTML = `<header class="app-header"><div class="brand"><span class="brand-mark">CE</span><div><strong>CE Lab</strong><small>AI 表格工作台</small></div></div><div class="book-heading"><input id="book-title" aria-label="工作簿名称" maxlength="120"><button id="save-status" class="save-state">正在加载…</button></div><div class="header-actions"><span class="local-pill"><i></i>本地工作空间</span><button id="settings" class="secondary">模型设置</button><button id="toggle-ai" class="dark-button" aria-expanded="true">AI 助手</button></div></header><main id="workspace"><section class="sheet-space"><div class="file-bar"><select id="book-list" aria-label="选择工作簿"></select><button id="new-book">新建</button><button id="import">导入</button><details class="export-menu"><summary>导出</summary><div><button id="export-xlsx">Excel 工作簿</button><button id="export-csv">当前表 CSV</button></div></details><span class="divider"></span><button id="undo" title="撤销 Ctrl+Z">撤销</button><button id="redo" title="重做 Ctrl+Shift+Z">重做</button><span class="spacer"></span><button id="sample-book" class="sample-button">加载反馈示例</button></div><div class="table-context"><span class="range-chip" id="range-status">选择单元格开始</span><span class="muted">双击编辑 · 支持从 Excel 粘贴 · 生成后再确认写入</span></div><div id="grid" aria-label="电子表格"></div><footer class="sheet-footer"><div id="sheets"></div><span id="table-count"></span></footer></section><aside id="ai-panel"><div class="ai-title"><span class="ai-emblem">AI</span><div><h1>表格助手</h1><p>让理解、整理和计算留在表格里</p></div></div><div class="model-controls"><label>模型服务<select id="provider"></select></label><label>当前模型<input id="model" list="models" autocomplete="off" aria-label="当前模型"><datalist id="models"></datalist></label><span id="model-state" class="model-state">未验证</span></div><div id="task-tabs" class="task-tabs"></div><section class="task-content"><span class="small-label" id="task-eyebrow"></span><p id="task-description" class="task-description"></p><div id="configure-hint" class="configure-hint"><strong>接入你的第一个模型</strong><p>选择厂商，填入 API Key，即可开始处理数据。</p><button id="configure-key" class="secondary">配置 API Key</button></div><label class="scope-label">数据范围<select id="scope" aria-label="数据范围"><option value="selection">当前选区</option><option value="all">整张工作表</option></select></label><div id="scope-detail" class="scope-detail"></div><label id="preset-label">任务预设<select id="preset"></select></label><label id="pasted-text-label" hidden>粘贴原始文字<textarea id="pasted-text" rows="5" placeholder="例如：张三订了 10 个黑色水杯，每个 35 元…"></textarea></label><label>告诉 AI 你想做什么<textarea id="instruction" rows="4" maxlength="12000"></textarea></label><label id="fields-label">输出字段<input id="fields" placeholder="字段之间用逗号分隔"></label><button id="generate" class="primary generate-button">生成预览 <span>→</span></button><button id="cancel-job" class="secondary generate-button" hidden>取消任务</button><p class="privacy-note">仅将指定范围发送给当前厂商，结果应用前不会修改表格。</p><div id="result"></div></section><footer class="ai-footer">你的数据范围 · 你的模型 · 你的决定</footer></aside></main><input id="file-input" type="file" accept=".csv,.xlsx" hidden><div id="toast" class="toast" role="status"></div>`;
    bind();
    renderTask();
    const choice = modelChoice();
    state.provider = choice.provider || '';
    state.model = choice.model || '';
    await refreshProviders();
    state.books = await api('/workbooks');
    const lastBookId = localStorage.getItem('ce-lab-last-book');
    const lastBook = state.books.find((b) => b.id === lastBookId) || state.books[0];
    const book = lastBook ? await api('/workbooks/' + lastBook.id) : await api('/workbooks', 'POST', newBook());
    await loadBook(book);
    await refreshBooks();
}
start().catch((e) => {
    const app = $('#app');
    app.innerHTML = `<div class="startup-error"><h1>CE Lab 暂时无法启动</h1><p>${escape(
        e.message
    )}</p><button onclick="location.reload()">重新连接</button></div>`;
});
