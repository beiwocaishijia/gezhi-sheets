title: VueJS Spreadsheet
keywords: Jspreadsheet, Jexcel, JavaScript, Vue.js, Vue data grid, spreadsheet-like controls, Excel-like data grid, Vue.js spreadsheet, Jspreadsheet Vue wrapper, Vue integration, JavaScript spreadsheet, spreadsheet controls
description: Build advanced data grid applications with intuitive spreadsheet-like controls using Jspreadsheet Vue.js wrapper

# Vue Spreadsheet

Jspreadsheet CE version 5 introduces a VueJS wrapper, enabling developers to create advanced data grid solutions with intuitive spreadsheet-like controls seamlessly integrated with VueJS version 3.

## Documentation

### Using the Vue Data Grid Wrapper

To start using the Jspreadsheet Vue wrapper, first install the package:

```bash
npm install @jspreadsheet-ce/vue@5.0.0-beta.3
```

### Adding CSS to Your Project

To apply styles, import the necessary CSS files:

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

#### Creating Your First Jspreadsheet Vue Data Grid

Learn how to build a web-based spreadsheet using the Jspreadsheet Vue wrapper, seamlessly integrating advanced data grid functionality into your Vue.js applications.

{.ignore}
```vue
<template>
    <Spreadsheet ref="spreadsheet">
        <Worksheet :data="data" :columns="columns" />
    </Spreadsheet>
    <input type="button" value="getData" @click="getData" />
</template>

<script>
import { ref } from "vue";
import { Spreadsheet, Worksheet } from "@jspreadsheet-ce/vue";

import "jsuites/dist/jsuites.css";
import "jspreadsheet-ce/dist/jspreadsheet.css";

export default {
    components: {
        Spreadsheet,
        Worksheet,
    },
    setup() {
        // Worksheet data
        const data = ref([
            ["US", "Cheese", "2019-02-12"],
            ["CA", "Apples", "2019-03-01"],
            ["CA", "Carrots", "2018-11-10"],
            ["BR", "Oranges", "2019-01-12"],
        ]);

        // Columns
        const columns = ref([
            { width: "300px" },
            { width: "200px" },
            { width: "200px" },
        ]);

        // Reference for the spreadsheet
        const spreadsheet = ref(null);

        // Method to get data
        const getData = () => {
            console.log(spreadsheet.value.current[0].getData());
        };

        return {
            data,
            columns,
            spreadsheet,
            getData,
        };
    },
};
</script>
```
 

## Customizations

You can also create your wrapper for Jspreadsheet. This approach offers developers enhanced flexibility and control over the implementation, allowing for tailored integration and custom behaviours.

### Wrapper for VueJS 3

To integrate Jspreadsheet directly with Vue 3, initialize the library within a Vue component using the mounted lifecycle hook. This method allows you to harness the power of Jspreadsheet while maintaining control over its behaviour and styling.

{.ignore}
```vue
<template>
  <Jspreadsheet :options="Options" />
</template>

<script>
import Jspreadsheet from "./components/Jspreadsheet";

export default {
  components: {
    Jspreadsheet,
  },
  setup() {
    const Options = {
      worksheets: [
        {
          search: true,
          data: [
            [42, 42, 42, 42],
            [42, 42, 42, 42],
          ],
          columns: [
            { title: "First Column", width: 100 },
            { title: "Second Column", width: 150 },
            { title: "Third Column", width: 200 },
            { title: "Fourth Column", width: 250 },
          ],
        },
      ]
    };
    return { Options };
  },
};
</script>
```
  

### Integration with Vue2


{.ignore}
```html
<html>
<script src="https://cdnjs.cloudflare.com/ajax/libs/vue/2.6.10/vue.min.js"></script>

<script src="https://bossanova.uk/jspreadsheet/v5/jspreadsheet.js"></script>
<script src="https://jsuites.net/v5/jsuites.js"></script>
<link rel="stylesheet" href="https://bossanova.uk/jspreadsheet/v5/jspreadsheet.css" type="text/css" />
<link rel="stylesheet" href="https://jsuites.net/v5/jsuites.css" type="text/css" />

<div id="spreadsheet"></div>

<br>

<input type="button" value="Add new row" onclick="vm.insertRow()" />

<script>
let options = {
    worksheets: [{
        data:[[]],
        minDimensions:[8,10],
    }],
}

let vm = new Vue({
    el: '#spreadsheet',
    mounted: function() {
        let spreadsheet = jspreadsheet(this.$el, options);
        Object.assign(this, spreadsheet);
    }
}); 
</script>
```
 
## Jspreadsheet Pro

### More examples

If you are interested in using Jspreadsheet Pro, explore the following resources for advanced features and integrations. These examples demonstrate how to leverage Jspreadsheet Pro for creating advanced and feature-rich spreadsheets in Vue.js applications.

* [Vue Spreadsheet Pro](https://jspreadsheet.com/docs/vue)
* [Vue Spreadsheet with actions](https://codesandbox.io/s/vue3-spreadsheet-with-actions-chx7dw)
* [Vue Spreadsheet Editor](https://codesandbox.io/s/vue-spreadsheet-zpmf2)

{.pro}
> **Jspreadsheet Pro for Vue - Professional Spreadsheet Components**
>
> While Jspreadsheet CE provides core spreadsheet functionality for Vue, **Jspreadsheet Pro** offers enhanced Vue integration and enterprise features:
>
> **Enhanced Vue Integration:**
> - **TypeScript Support:** Full TypeScript definitions for Vue 3 with type-safe development
> - **Composition API:** Native Composition API support with custom composables
> - **Vue 3 Optimized:** Built specifically for Vue 3 with full reactivity system support
> - **Pinia Integration:** Built-in Pinia store integration for state management
> - **Nuxt Support:** Full SSR/SSG support for Nuxt 3 applications
> - **Vue DevTools:** Enhanced debugging with Vue DevTools integration
>
> **Professional Components:**
> - **Advanced Editors:** Conditional dropdowns, rich text, HTML editors with Vue reactivity
> - **Formula System:** 500+ Excel functions with Vue reactive bindings
> - **Conditional Formatting:** Visual rules, data bars, color scales, icon sets
> - **Data Validation:** Real-time validation with custom Vue components
> - **Import/Export:** Full Excel (.xlsx) import/export with formatting preservation
> - **Charts & Graphs:** Built-in Vue chart components for data visualization
>
> **Vue Reactivity Features:**
> - **Reactive Data Binding:** Two-way binding with Vue ref/reactive objects
> - **Computed Properties:** Use computed values for cell formulas
> - **Watchers:** Automatic updates when source data changes
> - **V-Model Support:** Full v-model binding for spreadsheet data
> - **Teleport Support:** Use Vue Teleport for dialogs and overlays
> - **Suspense Ready:** Async component loading with Suspense
>
> **Performance & Scale:**
> - **Virtual Scrolling:** Handle 100K+ rows with smooth scrolling
> - **Lazy Loading:** Load data on-demand for optimal performance
> - **Vue 3 Performance:** Optimized for Vue 3's improved rendering engine
> - **Web Workers:** Background processing for heavy calculations
> - **Memory Efficiency:** Optimized memory usage for large datasets
>
> **Developer Experience:**
> - **Vue-Specific Documentation:** Examples with Options API and Composition API
> - **Professional Support:** Priority support for Vue integration issues
> - **Regular Updates:** Continuous Vue 3 compatibility improvements
> - **Migration Tools:** Easy migration from CE to Pro with Vue examples
>
> **Vue-Specific Pro Features:**
> - **Custom Vue Components:** Use Vue components as cell editors and renderers
> - **Scoped Slots:** Advanced customization with scoped slots
> - **Event Integration:** Seamless integration with Vue event system
> - **Provide/Inject:** Share spreadsheet context across component tree
> - **Testing Support:** Vitest/Vue Test Utils integration examples
>
> Perfect for Vue applications requiring enterprise-grade spreadsheet functionality with professional support.
>
> **[Explore Jspreadsheet Pro Vue →](https://jspreadsheet.com/docs/vue)** | **[Compare CE vs Pro →](https://jspreadsheet.com/docs/getting-started)** | **[View Pricing →](https://jspreadsheet.com/pricing)**

