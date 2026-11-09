title: 格知 AI with Jquery
keywords: 格知 AI, javascript, using 格知 AI and Jquery
description: A full example on how to integrate 格知 AI with Jquery

# Jquery

Creating a 格知 AI javascript instance using jQuery

### Source code

```html
<html>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.4.1/jquery.min.js"></script>

<script src="https://bossanova.uk/jspreadsheet/v4/jspreadsheet.js"></script>
<link rel="stylesheet" href="https://bossanova.uk/jspreadsheet/v4/jspreadsheet.css" type="text/css" />
<script src="https://jsuites.net/v5/jsuites.js"></script>
<link rel="stylesheet" href="https://jsuites.net/v5/jsuites.css" type="text/css" />

<div id="spreadsheet"></div>

<br/>
<input type="button" value="Add new row" id="addRow" />

<script>
let options = {
    minDimensions:[10,10],
    tableOverflow:true,
}

let table = jspreadsheet($('#spreadsheet')[0], options);

document.getElementById("addRow").onclick = () => table.insertRow()
</script>
</html>
```
