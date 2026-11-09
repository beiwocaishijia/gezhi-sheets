# 组件扩展与兼容

格知 AI 的工作台提供表格编辑与 AI 处理能力。应用包名为 `gezhi-sheets`，浏览器组件继续使用 `jspreadsheet` 兼容接口；版权与许可原文见 [LICENSE](../LICENSE)。

- `worksheet.batch(callback)`：同步批量修改形成一个历史步骤，异常回滚，支持完整撤销和重做。
- `formulaEvaluator`：可选的公式求值配置；工作台使用语法解析与白名单，原组件默认行为保持兼容。
- 前导单引号：显式文本显示、引用、保存及撤销行为一致；普通 AI 字符串不直接执行为公式。
- 自定义编辑器 `openEditor` 第八个参数 `empty`：`true` 从空输入框开始，保存前保留原值；原有七参数编辑器保持兼容。
- 公式字符串：正确保留 `$`、`&`、双引号、反斜杠与 Unicode；引号内的 `A1`、`A1:B2` 不再误识别为引用。

验证命令：

```powershell
npm run test:component
```

共 98 项组件测试，包含原有 93 项与新增的 5 项事务、文本、求值器测试。自定义编辑器用法见 [组件文档](jspreadsheet/docs/editors.md#starting-a-custom-editor-with-empty-content)。
