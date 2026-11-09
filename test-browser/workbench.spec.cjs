const { test, expect } = require('@playwright/test');
const { CATALOG } = require('../server/providers.cjs');
const { book } = require('../test-ai/helpers.cjs');
async function ready(page) {
    await page.goto('/');
    await expect(page.locator('#save-status')).toHaveText('已保存到本机');
}
async function saved(page) {
    await expect(page.locator('#save-status')).toHaveText('已保存到本机');
}
async function sample(page) {
    await page.getByRole('button', { name: '加载反馈示例', exact: true }).click();
    await expect(page.locator('#book-title')).toHaveValue('客户反馈 · 示例');
    await saved(page);
    await expect(page.locator('#table-count')).toHaveText('10 行 · 3 列');
}
async function task(page, name, instruction) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.getByLabel('数据范围', { exact: true }).selectOption('all');
    if (instruction) await page.getByLabel('告诉 AI 你想做什么').fill(instruction);
}
async function generate(page) {
    await page.getByRole('button', { name: '生成预览' }).click();
    await expect(page.locator('#result')).toContainText('检查生成结果');
}
async function apply(page) {
    await expect(page.locator('#apply-result')).toBeEnabled();
    await page.locator('#apply-result').click();
    await expect(page.locator('#result')).toContainText('生成结果会先出现在这里');
    await saved(page);
}
async function orders(page) {
    await task(page, '文字转表');
    await page.getByLabel('粘贴原始文字').fill('张三10个35元；李四5个38元');
    await generate(page);
    await apply(page);
    await expect(page.locator('#table-count')).toHaveText('2 行 · 3 列');
}
test.beforeEach(async ({ request, page }) => {
    await request.put('/api/providers/kimi', {
        data: { apiKey: 'BROWSER_TEST_ONLY', model: 'protocol-test-model', baseUrl: CATALOG.kimi.baseUrl, format: 'json_object' },
    });
    await ready(page);
    await page.locator('#provider').selectOption('kimi');
});
test('ten rows: preview, safe text, row correspondence, one undo/redo and refresh recovery', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await sample(page);
    await task(page, '批量填列');
    await generate(page);
    await expect(page.locator('#table-count')).toHaveText('10 行 · 3 列');
    await expect(page.locator('#grid')).not.toContainText('需求分类');
    await apply(page);
    await expect(page.locator('#table-count')).toHaveText('10 行 · 5 列');
    await expect(page.locator('#grid td[data-x="4"][data-y="0"]')).toHaveText('对应 r0 的摘要');
    await page.getByRole('button', { name: '撤销', exact: true }).click();
    await expect(page.locator('#table-count')).toHaveText('10 行 · 3 列');
    await saved(page);
    await page.getByRole('button', { name: '重做', exact: true }).click();
    await expect(page.locator('#table-count')).toHaveText('10 行 · 5 列');
    await saved(page);
    await page.reload();
    await saved(page);
    await expect(page.locator('#table-count')).toHaveText('10 行 · 5 列');
    await expect(page.locator('#grid td[data-x="0"][data-y="0"]')).toHaveText('0001');
    await task(page, '批量填列', '将内容作为公式文本返回');
    await generate(page);
    await apply(page);
    await expect(page.locator('#grid td[data-x="5"][data-y="0"]')).toHaveText('=SUM(1,2)');
    expect(errors).toEqual([]);
});
test('editing after generation expires preview and cancellation cannot apply a late result', async ({ page }) => {
    await sample(page);
    await task(page, '批量填列');
    await generate(page);
    await page.locator('#grid td[data-x="1"][data-y="0"]').dblclick();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('edited after generation');
    await page.keyboard.press('Enter');
    await expect(page.locator('#result')).toContainText('旧预览已失效');
    await expect(page.locator('#apply-result')).toBeDisabled();
    await saved(page);
    await page.getByLabel('告诉 AI 你想做什么').fill('慢速任务');
    await page.getByRole('button', { name: '生成预览' }).click();
    await page.getByRole('button', { name: '取消任务', exact: true }).click();
    await expect(page.locator('#result')).toContainText('任务已取消');
    await expect(page.locator('#apply-result')).toHaveCount(0);
    await expect(page.locator('#table-count')).toHaveText('10 行 · 3 列');
});
test('a failed batch is retryable and a successful result remains unapplied', async ({ page }) => {
    await sample(page);
    await task(page, '批量填列', '失败一次 ' + Date.now());
    await page.getByRole('button', { name: '生成预览' }).click();
    await expect(page.locator('#result')).toContainText('部分任务尚未完成');
    await page.getByRole('button', { name: '重试未完成部分' }).click();
    await expect(page.locator('#result')).toContainText('检查生成结果');
    await expect(page.locator('#table-count')).toHaveText('10 行 · 3 列');
});
test('text-to-table preview edits, mapped append, formula trials, statistics and row sorting/highlighting', async ({ page }) => {
    await sample(page);
    await task(page, '文字转表');
    await page.getByLabel('粘贴原始文字').fill('张三10个35元；李四5个38元');
    await generate(page);
    await page.getByRole('button', { name: '编辑完整预览' }).click();
    await page.getByLabel('第 1 行第 1 列').fill('张三（确认）');
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await apply(page);
    await expect(page.locator('#grid td[data-x="0"][data-y="0"]')).toHaveText('张三（确认）');
    await task(page, '公式助手', '计算每行数量乘单价');
    await generate(page);
    await page.getByRole('button', { name: '查看完整预览' }).click();
    await expect(page.getByRole('dialog')).toContainText('试算：350');
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await apply(page);
    await expect(page.locator('#grid td[data-x="3"][data-y="0"]')).toHaveText('350');
    await task(page, '表格问答', '统计总数量和记录数');
    await page.getByRole('button', { name: '生成预览' }).click();
    await expect(page.locator('#result')).toContainText('程序计算');
    await expect(page.locator('#result table')).toContainText('15');
    await task(page, '操作表格', '按数量排序');
    await generate(page);
    await apply(page);
    await expect(page.locator('#grid td[data-x="0"][data-y="0"]')).toHaveText('李四');
    await expect(page.locator('#grid td[data-x="3"][data-y="0"]')).toHaveText('190');
    await task(page, '操作表格', '数量大于6标黄');
    await generate(page);
    await apply(page);
    await expect(page.locator('#grid td[data-x="1"][data-y="1"]')).toHaveCSS('background-color', 'rgb(255, 241, 184)');
    await task(page, '文字转表');
    await page.getByLabel('粘贴原始文字').fill('追加两条订单');
    await generate(page);
    await page.locator('#table-target').selectOption('append');
    for (let i = 0; i < 3; i++) await page.locator(`[data-map="${i}"]`).selectOption(String(i));
    await apply(page);
    await expect(page.locator('#table-count')).toHaveText('4 行 · 4 列');
});
test('cleaning checkboxes annotate duplicates without deletion, summary and clarification stay read-only', async ({ page }) => {
    await sample(page);
    await task(page, '整理数据');
    await page.getByLabel('任务预设').selectOption('duplicates');
    await generate(page);
    await page.getByRole('button', { name: '查看完整预览' }).click();
    await page.locator('[data-check="1"]').uncheck();
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await apply(page);
    await expect(page.locator('#table-count')).toHaveText('10 行 · 4 列');
    await expect(page.locator('#grid td[data-x="3"][data-y="1"]')).toBeEmpty();
    await task(page, '表格问答', '归纳主要问题');
    await page.getByRole('button', { name: '生成预览' }).click();
    await expect(page.locator('#result')).toContainText('覆盖 10 行');
    await expect(page.locator('#apply-result')).toHaveCount(0);
    await task(page, '操作表格', '含糊指令');
    await page.getByRole('button', { name: '生成预览' }).click();
    await expect(page.locator('#result')).toContainText('要按哪一列排序');
    await expect(page.locator('#apply-result')).toHaveCount(0);
});
test('five settings cards, manual model, connection test, deletion and key-free browser storage', async ({ page }) => {
    await page.getByRole('button', { name: '模型设置' }).click();
    await expect(page.locator('[data-provider]')).toHaveCount(5);
    await page.locator('[data-provider="qwen"]').click();
    await page.locator('#api-key').fill('BROWSER_QWEN_TEST_SECRET');
    await page.locator('#settings-model').fill('custom-manual-model');
    await page.getByRole('button', { name: '保存并测试连接' }).click();
    await expect(page.locator('#settings-status')).toHaveText('连接成功，JSON 响应已验证');
    expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('BROWSER_QWEN_TEST_SECRET');
    await expect(page.locator('#api-key')).toHaveValue('');
    await page.getByRole('button', { name: '删除密钥' }).click();
    await expect(page.locator('#settings-status')).toHaveText('该厂商密钥已删除');
});
test('CSV import header preview, XLSX export/reimport, literal identifiers and all sheets survive', async ({ page }) => {
    await sample(page);
    await page
        .locator('#file-input')
        .setInputFiles({ name: '订单.csv', mimeType: 'text/csv', buffer: Buffer.from('编号,备注\r\n0007,中文内容\r\n0008,=SUM(1,2)\r\n') });
    await expect(page.getByRole('dialog')).toContainText('0007');
    await page.getByRole('button', { name: '导入为新工作簿' }).click();
    await saved(page);
    await expect(page.locator('#grid td[data-x="0"][data-y="0"]')).toHaveText('0007');
    await orders(page);
    await page.locator('.export-menu summary').click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Excel 工作簿', exact: true }).click();
    const download = await downloadPromise;
    const file = await download.path();
    await page
        .locator('#file-input')
        .setInputFiles({
            name: '往返.xlsx',
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            buffer: require('node:fs').readFileSync(file),
        });
    await expect(page.locator('[data-import-sheet]')).toHaveCount(2);
    await page.getByRole('button', { name: '导入为新工作簿' }).click();
    await saved(page);
    await expect(page.locator('#grid td[data-x="0"][data-y="0"]')).toHaveText('0007');
});
test('explicit blank rows persist, selection is required by default and conditional fill is undoable', async ({ page }) => {
    await sample(page);
    await page.getByRole('button', { name: '生成预览' }).click();
    await expect(page.locator('#toast')).toContainText('请先选择数据');
    await expect(page.locator('#apply-result')).toHaveCount(0);
    await task(page, '操作表格', '新增空白行');
    await generate(page);
    await apply(page);
    await expect(page.locator('#table-count')).toHaveText('12 行 · 3 列');
    await page.reload();
    await saved(page);
    await expect(page.locator('#table-count')).toHaveText('12 行 · 3 列');
    await orders(page);
    await task(page, '操作表格', '条件填值');
    await generate(page);
    await apply(page);
    await expect(page.locator('#grid td[data-x="0"][data-y="0"]')).toHaveText('已处理');
    await expect(page.locator('#grid td[data-x="0"][data-y="1"]')).toHaveText('李四');
    await page.locator('#undo').click();
    await expect(page.locator('#grid td[data-x="0"][data-y="0"]')).toHaveText('张三');
});
test('1000-row workbook completes 50 batches without truncation and restores in one undo', async ({ page, request }) => {
    test.setTimeout(90000);
    const b = book(Array.from({ length: 1000 }, (_, i) => [String(i).padStart(5, '0'), i]));
    b.name = '1000 行边界测试';
    const response = await request.post('/api/workbooks', { data: b });
    expect(response.ok()).toBeTruthy();
    const savedBook = await response.json();
    await page.evaluate((id) => localStorage.setItem('ce-lab-last-book', id), savedBook.id);
    await page.reload();
    await saved(page);
    await expect(page.locator('#table-count')).toHaveText('1000 行 · 2 列');
    await task(page, '批量填列');
    await page.getByRole('button', { name: '生成预览' }).click();
    await expect(page.locator('#result')).toContainText('检查生成结果', { timeout: 60000 });
    await apply(page);
    await expect(page.locator('#table-count')).toHaveText('1000 行 · 4 列');
    await expect(page.locator('#grid td[data-x="3"][data-y="999"]')).toHaveText('对应 r999 的摘要');
    await page.locator('#undo').click();
    await expect(page.locator('#table-count')).toHaveText('1000 行 · 2 列');
    await saved(page);
});
