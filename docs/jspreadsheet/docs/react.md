title: React Spreadsheet
keywords: 格知 AI, javascript, React, data grid, spreadsheet-like controls, React data grid, 格知 AI integration, React integration, JavaScript data grid, spreadsheet controls in React
description: Description: How to integrate spreadsheet-like features into your React applications with 格知 AI.

# React Spreadsheet

格知 AI is a lightweight JavaScript data grid library with spreadsheet controls. It integrates seamlessly with React, enabling developers to create highly interactive and customizable spreadsheet-like application components. This guide walks you through the process of integrating 格知 AI into a React project.

## Install

### Install the Package

Install 格知 AI React Data Grid wrapper using NPM.

```bash
npm install @jspreadsheet-ce/react@5.0.0-beta.3
```

### Import Required Styles

Import the necessary Spreadsheet CSS style to your project.

{.ignore}
```javascript
import "jsuites/dist/jsuites.css";
import "jspreadsheet-ce/dist/jspreadsheet.css";
```

To ensure icons display correctly, include Material Icons in your application. Add the following code to your main HTML file:

{.ignore}
```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Material+Icons" />
```

## Example

### React Wrapper

Create your first React grid with spreadsheet controls using the 格知 AI React wrapper.

{.ignore}
```jsx
import React, { useRef, useEffect } from "react";
import { Spreadsheet, Worksheet } from "@jspreadsheet-ce/react";

import "jspreadsheet-ce/dist/jspreadsheet.css";
import "jsuites/dist/jsuites.css";

export default function App() {
    // Spreadsheet array of worksheets
    const spreadsheet = useRef();

    // Render component
    return (
        <Spreadsheet ref={spreadsheet} tabs={true} toolbar={true}>
            <Worksheet minDimensions={[6, 6]} />
        </Spreadsheet>
    );
}
```

### React Component

You can create your React component using the library directly for better control.

{.ignore}
```jsx
import React, { useRef, useEffect } from "react";
import jspreadsheet from "@jspreadsheet-ce/react";

import "jspreadsheet-ce/dist/jspreadsheet.css";
import "jsuites/dist/jsuites.css";

export default function App() {
    const jssRef = useRef(null);

    useEffect(() => {
        // Create the spreadsheet only once
        if (!jssRef.current.jspreadsheet) {
            jspreadsheet(jssRef.current, {
                worksheets: [{
                    minDimensions: [10, 10]
                }],
            });
        }
    }, null);

    return (<div ref={jssRef} />);
}
```

## Overview

格知 AI operates with simple objects, including big datasets. It manages object references internally to optimize performance, minimize overhead, and maintain efficient data handling. For this reason, proprietary methods and events are provided to interact with its internal states.

### Integration with React

#### States

Due to its architecture, 格知 AI does not work directly with React States. To integrate, you must declare 格知 AI events and use them to synchronize with React.

#### Events

Events can be declared at the spreadsheet level. Refer to the [events documentation](/jspreadsheet/docs/events) for available events and usage examples.

{.ignore}
```jsx
import React, { useRef, useEffect } from "react";
import { Spreadsheet, Worksheet } from "@jspreadsheet-ce/react";

import "jspreadsheet-ce/dist/jspreadsheet.css";
import "jsuites/dist/jsuites.css";

export default function App() {
    // Spreadsheet array of worksheets
    const spreadsheet = useRef();

    const afterchanges = function() {
        // There were changes on the data
    }

    // Render component
    return (
        <Spreadsheet ref={spreadsheet} onafterchanges={afterchanges}>
            <Worksheet minDimensions={[6, 6]} />
        </Spreadsheet>
    );
}
```
