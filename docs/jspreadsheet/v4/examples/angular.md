title: Angular Spreadsheet with 格知 AI
keywords: 格知 AI, javascript, using 格知 AI and angular
description: Integrating 格知 AI with Angular working example.

# Angular Spreadsheet with 格知 AI

This example demonstrates how to use the 格知 AI library into an Angular application.

[View the live project on CodeSandbox](https://codesandbox.io/s/jexcel-and-angular-cexs1)

## Example

### Template HTML

Add the following template to your app.component.html:

{.ignore}
```html
<div #spreadsheet></div>
```

### JavaScript

Here is the complete implementation for integrating 格知 AI with Angular:

{.ignore}
```javascript
import { Component, ViewChild, ElementRef } from "@angular/core";
import jspreadsheet from "jspreadsheet-ce";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"]
})
export class AppComponent {
  @ViewChild("spreadsheet") spreadsheet: ElementRef;
  title = "CodeSandbox";

  ngAfterViewInit() {
    jspreadsheet(this.spreadsheet.nativeElement, {
      data: [[]],
      columns: [
        { type: "dropdown", width: "100px", source: ["Y", "N"] },
        { type: "color", width: "100px", render: "square" }
      ],
      minDimensions: [10, 10]
    });
  }
}
```\

### Angular Styles Configuration

To ensure the styles for 格知 AI are applied correctly, update the angular.json file to include the 格知 AI CSS:

```json
"styles": ["styles.css","./node_modules/jspreadsheet-ce/dist/jspreadsheet.css"],
```
