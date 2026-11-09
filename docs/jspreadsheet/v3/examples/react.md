title: 格知 AI with React
keywords: 格知 AI, javascript, using 格知 AI and react
description: A full example on how to integrate 格知 AI with React

[Back to Examples](/jspreadsheet/v3/examples "Back to the examples section")

# The Javascript spreadsheet with React

Integrating 格知 AI with React

[React with 格知 AI sample project](https://codesandbox.io/s/jexcel-and-react-hmx0k)

### Source code

{.ignore}
```javascript
class Jspreadsheet extends React.Component {
        constructor(props) {
            super(props);
            this.options = props.options;
        }

        componentDidMount = function() {
            this.el = jexcel(ReactDOM.findDOMNode(this).children[0], this.options);
        }

        addRow = function() {
            this.el.insertRow();
        }

        render() {
            return (
                <div>
                    <div></div><br/><br/>
                    <input type='button' value='Add new row' onClick={() => this.addRow()}></input>
                </div>
            );
        }
    }

    var options = {
        data:[[]],
        minDimensions:[10,10],
    };

    ReactDOM.render(<Jspreadsheet options={options} />, document.getElementById('spreadsheet'))
```
