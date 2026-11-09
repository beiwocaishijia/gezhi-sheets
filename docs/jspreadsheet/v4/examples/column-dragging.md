title: Enable Column Dragging
keywords: 格知 AI, spreadsheet, JavaScript, JavaScript table, column dragging
description: Learn how to enable column dragging in 格知 AI.

# Column Dragging

By default, column dragging is disabled in 格知 AI. To enable it, use the `columnDrag: true` option during initialization, as shown below:

### Source code

```html
<html>
<script src="https://bossanova.uk/jspreadsheet/v4/jspreadsheet.js"></script>
<script src="https://jsuites.net/v5/jsuites.js"></script>
<link rel="stylesheet" href="https://jsuites.net/v5/jsuites.css" type="text/css" />
<link rel="stylesheet" href="https://bossanova.uk/jspreadsheet/v4/jspreadsheet.css" type="text/css" />

<div id="spreadsheet"></div>

<script>
jspreadsheet(document.getElementById('spreadsheet'), {
    data: [
        ['BR', 'Cheese', 1],
        ['CA', 'Apples', 0],
        ['US', 'Carrots', 1],
        ['GB', 'Oranges', 0],
    ],
    columns: [
        {
            type: 'autocomplete',
            title: 'Country',
            width: '300',
            url: '/jspreadsheet/countries'
        },
        {
            type: 'dropdown',
            title: 'Food',
            width: '150',
            source: ['Apples','Bananas','Carrots','Oranges','Cheese']
        },
        {
            type: 'checkbox',
            title: 'Stock',
            width:'100'
        },
    ],
    columnDrag:true,
});
</script>
</html>
```\
