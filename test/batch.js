const { expect } = require('chai');
const jspreadsheet = require('../dist/index.js');

describe('Synchronous worksheet transactions and explicit text', () => {
    it('uses the supplied evaluator during transactions and dependency recalculation', () => {
        const {evaluateFormula,address} = require('../shared/formula.cjs');
        const s = jspreadsheet(root, {autoCasting:false,formulaEvaluator:(f,x,y,ws)=>evaluateFormula(f,ws.options.data,new Set([address(x,y)])),worksheets:[{data:[['2','3','=A1+B1']]}]})[0];
        expect(s.getValue('C1',true)).to.equal('5');
        s.batch(ws=>ws.setValue('A1','4'));expect(s.getValue('C1',true)).to.equal('7');
        s.undo();expect(s.getValue('C1',true)).to.equal('5');
    });
    function create() {
        return jspreadsheet(root, {
            worksheets: [
                {
                    data: [
                        ['001', 2],
                        ['002', 3],
                    ],
                    columns: [{ title: '编号' }, { title: '数量' }],
                },
            ],
        })[0];
    }
    it('undoes and redoes inserted columns, values and styles in one step', () => {
        const s = create();
        const before = JSON.stringify(s.getData());
        const index = s.historyIndex;
        s.batch((ws) => {
            ws.insertColumn(1, 1);
            ws.setValue('C1', "'=1+1");
            ws.setValue('C2', "'摘要");
            ws.setStyle('C1', 'background-color', '#fff1b8');
        });
        expect(s.historyIndex).to.equal(index + 1);
        expect(s.getValue('C1', true)).to.equal('=1+1');
        s.undo();
        expect(JSON.stringify(s.getData())).to.equal(before);
        expect(s.options.columns.length).to.equal(2);
        s.redo();
        expect(s.getValue('C2')).to.equal("'摘要");
        expect(s.getStyle('C1')).to.contain('background-color');
    });
    it('rolls back a thrown transaction without consuming history or redo', () => {
        const s = create();
        s.setValue('B1', 8);
        s.undo();
        const before = JSON.stringify(s.getData()),
            index = s.historyIndex;
        expect(() =>
            s.batch((ws) => {
                ws.insertRow(1, 0);
                ws.setValue('B1', 99);
                throw new Error('stop');
            })
        ).to.throw('stop');
        expect(JSON.stringify(s.getData())).to.equal(before);
        expect(s.historyIndex).to.equal(index);
        s.redo();
        expect(s.getValue('B1')).to.equal(8);
    });
    it('groups nested transactions and rejects asynchronous callbacks', () => {
        const s = create(),
            index = s.historyIndex;
        expect(() => s.batch(async () => {})).to.throw('synchronous');
        s.batch((ws) => {
            ws.setValue('B1', 7);
            ws.batch((inner) => inner.setValue('B2', 9));
        });
        expect(s.historyIndex).to.equal(index + 1);
        s.undo();
        expect(s.getValue('B1')).to.equal(2);
        expect(s.getValue('B2')).to.equal(3);
    });
    it('preserves literal formulas, leading zeroes and apostrophes through references and history', () => {
        const s = create();
        s.batch((ws) => {
            ws.setValue('A1', "'=1+1");
            ws.setValue('B1', '=A1&"!"');
            ws.setValue('A2', "'0008");
            ws.setValue('B2', '=A2&"件"');
        });
        expect(s.getValue('A1', true)).to.equal('=1+1');
        expect(s.getValue('B1', true)).to.equal('=1+1!');
        expect(s.getValue('B2', true)).to.equal('0008件');
        s.undo();
        s.redo();
        expect(s.getValue('A2')).to.equal("'0008");
        s.setValue('A1', "''原文");
        expect(s.getValue('A1', true)).to.equal("'原文");
    });
});
