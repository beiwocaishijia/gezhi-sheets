title: 格知 AI · 表格组件入门
keywords: 格知 AI, JavaScript, 表格组件, 集成
description: 在本地构建并集成格知 AI 的表格组件。

# 格知 AI · 表格组件入门

使用完整 AI 工作台请先阅读 [使用指南](../../USER-GUIDE.md)。本页面向在自己的页面中使用底层表格组件的开发者。

## 本地构建

在本仓库目录运行：

```powershell
npm ci
npm run build
```

构建结果位于 `dist/`。将组件资源与依赖正确放入你的网站静态目录；浏览器继续使用 `jspreadsheet` 接口。

## 页面集成示例

以下路径以从仓库根目录提供静态资源为例，实际集成时按部署位置调整。

```html
<link rel="stylesheet" href="/node_modules/jsuites/dist/jsuites.css">
<link rel="stylesheet" href="/dist/jspreadsheet.css">
<script src="/node_modules/jsuites/dist/jsuites.js"></script>
<script src="/node_modules/@jspreadsheet/formula/dist/index.js"></script>
<script src="/dist/index.js"></script>
<div id="sheet"></div>
<script>
jspreadsheet(document.getElementById('sheet'), {
    worksheets: [{ data: [['客户', '需求']], minDimensions: [2, 10] }]
});
</script>
```

AI 面板、本机保存和模型服务位于应用层，需要通过 `npm run dev` 或生产服务运行，不包含在独立表格组件中。

## 接口参考

| Method Description                                                                                                                       |
|------------------------------------------------------------------------------------------------------------------------------------------|
| Create a new spreadsheet.<br/>`jspreadsheet(element: HTMLDivElement \| HTMLTableElement, options: SpreadsheetOptions): WorksheetInstance[];`                                                     |
| Destroy a given spreadsheet.<br/>`jspreadsheet.destroy(element: JspreadsheetInstanceElement, destroyEventHandlers?: boolean): void;`                                     |
| Destroy all spreadsheets in all namespaces.<br/>`jspreadsheet.destroyAll(): void;`                                                              |
| Translate 格知 AI components and extensions.<br/>`jspreadsheet.setDictionary(translations: Record<string, string>): void;`                                 |
| Get a worksheet instance by name and namespace.<br/>`jspreadsheet.getWorksheetInstanceByName(worksheetName: string \| null \| undefined, namespace: string): WorksheetInstance \| Record<string, WorksheetInstance>;` |


## Examples

### Create a new data grid

You can create a new data grid with spreadsheet-like controls from an HTML table element, a JS array, a CSV, a JSON file or an Excel XLSX file.\

```html
<html>
<script src="https://bossanova.uk/jspreadsheet/v5/jspreadsheet.js"></script>
<script src="https://jsuites.net/v5/jsuites.js"></script>
<link rel="stylesheet" href="https://bossanova.uk/jspreadsheet/v5/jspreadsheet.css" type="text/css" />
<link rel="stylesheet" href="https://jsuites.net/v5/jsuites.css" type="text/css" />

<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Material+Icons" />

<div id='spreadsheet'></div>

<script>
// Create a new spreadsheet
jspreadsheet(document.getElementById('spreadsheet'), {
    worksheets: [{
        minDimensions: [6,6],
    }]
});
</script>
</html>
```

### Destroying The Data Grid

The following example shows how to dynamically destroy and recreate a new data grid.

```html
<html>
<script src="https://bossanova.uk/jspreadsheet/v5/jspreadsheet.js"></script>
<script src="https://jsuites.net/v5/jsuites.js"></script>
<link rel="stylesheet" href="https://bossanova.uk/jspreadsheet/v5/jspreadsheet.css" type="text/css" />
<link rel="stylesheet" href="https://jsuites.net/v5/jsuites.css" type="text/css" />
<link rel="canonical" href="https://bossanova.uk/jspreadsheet/docs/getting-started" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Material+Icons" />

<div id='jspreadsheet'></div>

<p><input type='button' value='Destroy' id="btn1" /> <input type='button' value='Create' id="btn2" /></p>

<script>
// Create a new spreadsheet
let create = function() {
    if (document.getElementById('jspreadsheet').spreadsheet) {
        destroy();
    }

    jspreadsheet(document.getElementById('jspreadsheet'), {
    	worksheets: [ { minDimensions:[5,5] } ]
    });
}

// Destroy the spreadsheet
let destroy = function() {
    jspreadsheet.destroy(document.getElementById('jspreadsheet'));
}

// Create the spreadsheet
jspreadsheet(document.getElementById('jspreadsheet'), {
    worksheets: [{
        minDimensions: [5,5],
    }]
});

document.getElementById("btn1").onclick = () => destroy()
document.getElementById("btn2").onclick = () => create()
</script>
</html>
```
