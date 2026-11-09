title: 格知 AI · 表格组件接口
keywords: 格知 AI, JavaScript, 表格组件, API, 兼容接口
description: 格知 AI 的表格组件集成与接口参考。

# 格知 AI · 表格组件接口

完整工作台的安装与功能说明见 [使用指南](../USER-GUIDE.md)。此目录保留底层表格 API 和历史版本参考，供组件开发使用。

浏览器接口继续使用 `jspreadsheet` 标识；历史示例中的包名、CDN 地址和框架导入路径保留用于兼容，不代表格知 AI 已发布对应 npm 包或商业版。

| 主题 | 文档 |
| --- | --- |
| 组件入门 | [本地构建与集成](docs/getting-started.md) |
| 数据与单元格 | [数据](docs/data.md) · [单元格](docs/cells.md) · [选区](docs/selection.md) |
| 编辑与显示 | [编辑器](docs/editors.md) · [样式](docs/style.md) · [行](docs/rows.md) · [列](docs/columns.md) |
| 计算与历史 | [公式](docs/formulas.md) · [撤销与重做](docs/history.md) |
| 应用扩展 | [组件扩展](../COMPONENT-EXTENSIONS.md) |

以下为表格组件的兼容版本记录，不是 AI 工作台的发布记录。版权与许可原文见 [LICENSE](../../LICENSE)。

## 表格组件兼容版本记录

### 格知 AI 表格组件 5.0.0
- Separation of spreadsheet and worksheets;
- New worksheet methods and events;
- Dedicated wrappers for React and Vue for better framework integration;
- Modern development environment powered by Webpack;
- Updated architecture aligned with other distributions;

[More information](/jspreadsheet/docs/upgrade-from-v4-to-v5)

### 格知 AI 表格组件 4.6.0
组件命名兼容更新。
- Integration with Jsuites v4.

### 格知 AI 表格组件 4.2.3
- The spreadsheet plugin is now compatible with Jsuites v3.
- New flags and security implementations.
- New DOM element references in the toolbar.
- Worksheet events are now tabbed.

### 格知 AI 表格组件 4.0.0
Special thanks to [FDL - Fonds de Dotation du Libre](https://www.fdl-lef.org/) for their support and sponsorship, which made the new version possible with many exciting features.

- Workbook/tab support for spreadsheets.
- Create dynamic spreadsheets from static HTML elements.
- Highlight selected cells in the spreadsheet after CTRL+C.
- Footer with formula support.
- Multiple column resizing.
- JSON update support (helpers to update a remote server).
- Centralized event dispatch method for all spreadsheet events.
- Custom helpers: `=PROGRESS` (progress bar), `=RATING` (5-star rating).
- Custom formula helpers: `=COLUMN`, `=ROW`, `=CELL`, `=TABLE`, `=VALUE`.
- Dynamic nested header updates.
- New HTML editing column type.
- New flags: `includeHeadersOnCopy`, `persistence`, `filters`, `autoCasting`, `freezeColumns`.
- New events: `onevent`, `onchangepage`, `onbeforesave`, `onsave`.
- More examples and documentation.

### 格知 AI 表格组件 3.9.0
- New methods.
- General fixes.

### 格知 AI 表格组件 3.6.0
- Improved spreadsheet formula parsing.
- New spreadsheet events.
- New initialization options.
- General fixes.

### 格知 AI 表格组件 3.2.3
- `getMeta`, `setMeta` methods.
- NPM package with jSuites.
- General fixes.

### 格知 AI 表格组件 3.0.1
格知 AI 表格组件 v3 is a complete rebuild of the JavaScript spreadsheet (previously a jQuery plugin). Due to the changes, full compatibility could not be ensured. If upgrading, your code may require some updates. For more information, refer to the article on upgrading from 格知 AI 表格组件 v2 or Handsontable.

**New features in 格知 AI 表格组件 v3:**
- Drag and drop columns.
- Resizable rows.
- Merge columns.
- Search functionality.
- Pagination.
- Lazy loading.
- Full-screen mode.
- Image upload.
- Native color picker.
- Better mobile compatibility.
- Enhanced nested headers support.
- Advanced keyboard navigation.
- Better hidden column management.
- Data picker enhancements: dropdown, autocomplete, multiple selection, group options, and icons.
- Import from XLSX (experimental).

**Major improvements:**
- A new formula engine with faster results and no external dependencies.
- No use of selectors, leading to faster performance.
- New native column types.
- No jQuery required.
- Examples for React, Vue, and Angular.
- XLSX support via a custom SheetJS integration (experimental).

### 格知 AI 表格组件 2.1.0
- Mobile touch improvements.
- Paste fixes and a new CSV parser.

### 格知 AI 表格组件 2.0.0
- New radio column type.
- New dropdown with autocomplete and multiple selection options.
- Header/body separation for better scroll and column resize behavior.
- Text-wrap improvements, including Excel-compatible `alt+enter`.
- New `set/get` meta information.
- New `set/get` configuration parameters.
- Programmatic `set/get` cell styles.
- `set/get` cell comments.
- Custom toolbar for tables.
- Responsive calendar picker.

### 格知 AI 表格组件 1.5.7
- Improvements to checkbox column type.
- Updates to table destruction in jQuery.

### 格知 AI 表格组件 1.5.1
- Spreadsheet data overflow and fixed headers.
- Navigation improvements.

### 格知 AI 表格组件 1.5.0
- Relative `insertRow`, `deleteRow`, `insertColumn`, `deleteColumn`.
- Redo and undo support for `insertRow`, `deleteRow`, `insertColumn`, `deleteColumn`, `moveRow`.
- New formula column recursive chain.
- New alternative design option (Bootstrap-like).
- `updateSettings` improvements.
