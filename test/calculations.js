const { expect } = require('chai');

const jspreadsheet = require('../dist/index.js');

describe('Calculations', () => {
    const addedFormulaGlobals = [];

    before(() => {
        // The engine registers real formula functions on window; JSDOM's Node global is separate.
        for (const name of ['SUM', 'IF']) {
            if (!(name in globalThis)) {
                globalThis[name] = window[name];
                addedFormulaGlobals.push(name);
            }
        }
    });

    after(() => {
        for (const name of addedFormulaGlobals) {
            delete globalThis[name];
        }
    });

    it('Testing formula chain', () => {
        let test = jspreadsheet(root, {
            worksheets: [
                {
                    data: [
                        ['1', ''],
                        ['', ''],
                        ['', ''],
                        ['', ''],
                        ['', ''],
                    ],
                },
            ],
        });

        test[0].setValue('B5', '=B3+A1');
        test[0].setValue('B3', '=A1+1');
        test[0].setValue('A1', '2');

        expect(test[0].getValue('B5', true)).to.equal('5');
    });

    it('Keeps special characters inside string literals', () => {
        let test = jspreadsheet(root, {
            worksheets: [
                {
                    data: [
                        ['="Total: $"&"100"', '="Smith & Co"', '="A1 <> $B$2 ^ 2!"', '="Say ""hi"" & bye"'],
                        ['10', '="Value: $"&A2', '=B1&" "&A2', '="a=b"&"!"'],
                    ],
                },
            ],
        });

        expect(test[0].getValue('A1', true)).to.equal('Total: $100');
        expect(test[0].getValue('B1', true)).to.equal('Smith &amp; Co');
        expect(test[0].getValue('C1', true)).to.equal('A1 &lt;&gt; $B$2 ^ 2!');
        expect(test[0].getValue('D1', true)).to.equal('Say "hi" &amp; bye');
        expect(test[0].getValue('B2', true)).to.equal('Value: $10');
        expect(test[0].getValue('C2', true)).to.equal('Smith &amp; Co 10');
        expect(test[0].getValue('D2', true)).to.equal('a=b!');
    });

    it('Does not treat quoted references as dependencies or self-references', () => {
        const sheet = jspreadsheet(root, {
            worksheets: [
                {
                    data: [
                        ['="A1:A2 / $A$1 / B1"', '="A1"'],
                        ['12', '13'],
                    ],
                },
            ],
        })[0];

        expect(sheet.getValue('A1', true)).to.equal('A1:A2 / $A$1 / B1');
        expect(sheet.getValue('B1', true)).to.equal('A1');
        expect(sheet.formula.A2).to.equal(undefined);
        expect(sheet.formula.B1).to.equal(undefined);
    });

    it('Evaluates operators and absolute references outside string literals', () => {
        const sheet = jspreadsheet(root, {
            worksheets: [{ data: [[2, 3, '=IF($A$1<>$B$1,"$A$1 <> $B$1: ","equal")&($A$1^$B$1)']] }],
        })[0];

        expect(sheet.getValue('C1', true)).to.equal('$A$1 &lt;&gt; $B$1: 8');
        sheet.setValue('A1', 3);
        expect(sheet.getValue('C1', true)).to.equal('equal27');
    });

    it('Preserves quoted ranges while expanding and recalculating actual ranges', () => {
        const sheet = jspreadsheet(root, {
            worksheets: [
                {
                    data: [
                        [2, '="A1:A2 = "&SUM($A$1:$A$2)'],
                        [3, ''],
                    ],
                },
            ],
        })[0];

        expect(sheet.getValue('B1', true)).to.equal('A1:A2 = 5');
        sheet.setValue('A2', 7);
        expect(sheet.getValue('B1', true)).to.equal('A1:A2 = 9');
    });

    it('Preserves empty and numeric strings, escaped quotes, backslashes, and Unicode', () => {
        const sheet = jspreadsheet(root, { worksheets: [{ data: [['']] }] })[0];
        const values = ['', '00100', 'Say "hi" and ""', 'C:\\new\\A1:B2', '你好 😀\n\t\u2028\u2029', '$ & <> ^ ! ='];

        for (const value of values) {
            const expression = '="' + value.replace(/"/g, '""') + '"';
            expect(sheet.executeFormula(expression, 0, 0), expression).to.equal(value);
        }
    });

    it('Preserves referenced text and calculated strings through formula chains', () => {
        const value = 'A1:B2 $ & <> ^ ! "ok" C:\\new';
        const sheet = jspreadsheet(root, {
            autoCasting: false,
            worksheets: [{ data: [[value, '=A1&" tail"', '=B1&"!"']] }],
        })[0];

        expect(sheet.executeFormula('=C1', 3, 0)).to.equal(value + ' tail!');
        sheet.setValue('A1', 'D1:E2 "changed"');
        expect(sheet.executeFormula('=C1', 3, 0)).to.equal('D1:E2 "changed" tail!');
    });

    it('Exposes readable literals to formula hooks and protects their replacement expressions', () => {
        let observed;
        const sheet = jspreadsheet(root, {
            worksheets: [{ data: [['', 5]] }],
            onbeforeformula(instance, expression) {
                observed = expression;
                return '="Value: $ & "&B1';
            },
        })[0];

        expect(sheet.executeFormula('="Cost $: "&$B$1', 0, 0)).to.equal('Value: $ & 5');
        expect(observed).to.equal('="Cost $: "&B1');
    });

    it('Keeps formula cancellation returning the expression with its original literal text', () => {
        const sheet = jspreadsheet(root, {
            worksheets: [{ data: [['']] }],
            onbeforeformula: () => false,
        })[0];
        const expression = '="A1:A2 $ & ""hi"""';

        expect(sheet.executeFormula(expression, 0, 0)).to.equal(expression);
    });

    it('Still rejects real self-references and circular references', () => {
        const sheet = jspreadsheet(root, {
            worksheets: [{ data: [['=B1', '=A1']] }],
        })[0];

        expect(sheet.executeFormula('=A1', 0, 0)).to.equal('#ERROR');
        expect(sheet.executeFormula('=A1', 2, 0)).to.equal('#ERROR');
    });

    describe('Test updating formulas when adding new rows', () => {
        it('1', () => {
            let test = jspreadsheet(root, {
                worksheets: [
                    {
                        data: [
                            ['1', '2', '3', '=SUM(A2:C2)'],
                            ['4', '5', '6', '=SUM(A2:C2)'],
                            ['7', '8', '9', '=SUM(A2:C2)'],
                        ],
                        worksheetName: 'sheet1',
                    },
                ],
            });

            test[0].insertRow(1, 1, true);

            expect(test[0].getValue('D1')).to.equal('=SUM(A3:C3)');
            expect(test[0].getValue('D2')).to.equal('');
            expect(test[0].getValue('D3')).to.equal('=SUM(A3:C3)');
            expect(test[0].getValue('D4')).to.equal('=SUM(A3:C3)');
        });

        it('2', () => {
            let test = jspreadsheet(root, {
                worksheets: [
                    {
                        data: [
                            ['1', '2', '3', '=SUM(A2:C3)'],
                            ['4', '5', '6', '=SUM(A2:C3)'],
                            ['7', '8', '9', '=SUM(A2:C3)'],
                            ['10', '11', '12', '=SUM(A2:C3)'],
                        ],
                        worksheetName: 'sheet1',
                    },
                ],
            });

            test[0].insertRow(1, 1, true);

            expect(test[0].getValue('D1')).to.equal('=SUM(A3:C4)');
            expect(test[0].getValue('D2')).to.equal('');
            expect(test[0].getValue('D3')).to.equal('=SUM(A3:C4)');
            expect(test[0].getValue('D4')).to.equal('=SUM(A3:C4)');
            expect(test[0].getValue('D5')).to.equal('=SUM(A3:C4)');
        });

        it('3', () => {
            let test = jspreadsheet(root, {
                worksheets: [
                    {
                        data: [
                            ['1', '2', '3', '=SUM(A2:C3)'],
                            ['4', '5', '6', '=SUM(A2:C3)'],
                            ['7', '8', '9', '=SUM(A2:C3)'],
                            ['10', '11', '12', '=SUM(A2:C3)'],
                        ],
                        worksheetName: 'sheet1',
                    },
                ],
            });

            test[0].insertRow(1, 1, false);

            expect(test[0].getValue('D1')).to.equal('=SUM(A2:C4)');
            expect(test[0].getValue('D2')).to.equal('=SUM(A2:C4)');
            expect(test[0].getValue('D3')).to.equal('');
            expect(test[0].getValue('D4')).to.equal('=SUM(A2:C4)');
            expect(test[0].getValue('D5')).to.equal('=SUM(A2:C4)');
        });

        it('4', () => {
            let test = jspreadsheet(root, {
                worksheets: [
                    {
                        data: [
                            ['1', '2', '3', '=SUM(A2:C3)'],
                            ['4', '5', '6', '=SUM(A2:C3)'],
                            ['7', '8', '9', '=SUM(A2:C3)'],
                            ['10', '11', '12', '=SUM(A2:C3)'],
                        ],
                        worksheetName: 'sheet1',
                    },
                ],
            });

            test[0].insertRow(1, 2, true);

            expect(test[0].getValue('D1')).to.equal('=SUM(A2:C4)');
            expect(test[0].getValue('D2')).to.equal('=SUM(A2:C4)');
            expect(test[0].getValue('D3')).to.equal('');
            expect(test[0].getValue('D4')).to.equal('=SUM(A2:C4)');
            expect(test[0].getValue('D5')).to.equal('=SUM(A2:C4)');
        });

        it('5', () => {
            let test = jspreadsheet(root, {
                worksheets: [
                    {
                        data: [
                            ['1', '2', '3', '=SUM(A2:C3)'],
                            ['4', '5', '6', '=SUM(A2:C3)'],
                            ['7', '8', '9', '=SUM(A2:C3)'],
                            ['10', '11', '12', '=SUM(A2:C3)'],
                        ],
                        worksheetName: 'sheet1',
                    },
                ],
            });

            test[0].insertRow(1, 2, false);

            expect(test[0].getValue('D1')).to.equal('=SUM(A2:C3)');
            expect(test[0].getValue('D2')).to.equal('=SUM(A2:C3)');
            expect(test[0].getValue('D3')).to.equal('=SUM(A2:C3)');
            expect(test[0].getValue('D4')).to.equal('');
            expect(test[0].getValue('D5')).to.equal('=SUM(A2:C3)');
        });
    });

    describe('Test updating formulas when adding new columns', () => {
        it('1', () => {
            let test = jspreadsheet(root, {
                worksheets: [
                    {
                        data: [
                            ['1', '2', '3'],
                            ['4', '5', '6'],
                            ['7', '8', '9'],
                            ['=SUM(B1:B3)', '=SUM(B1:B3)', '=SUM(B1:B3)'],
                        ],
                        worksheetName: 'sheet1',
                    },
                ],
            });

            test[0].insertColumn(1, 1, true);

            expect(test[0].getValue('A4')).to.equal('=SUM(C1:C3)');
            expect(test[0].getValue('B4')).to.equal('');
            expect(test[0].getValue('C4')).to.equal('=SUM(C1:C3)');
            expect(test[0].getValue('D4')).to.equal('=SUM(C1:C3)');
        });

        it('2', () => {
            let test = jspreadsheet(root, {
                worksheets: [
                    {
                        data: [
                            ['1', '2', '3', '4'],
                            ['5', '6', '7', '8'],
                            ['9', '10', '11', '12'],
                            ['=SUM(B1:C3)', '=SUM(B1:C3)', '=SUM(B1:C3)', '=SUM(B1:C3)'],
                        ],
                        worksheetName: 'sheet1',
                    },
                ],
            });

            test[0].insertColumn(1, 1, true);

            expect(test[0].getValue('A4')).to.equal('=SUM(C1:D3)');
            expect(test[0].getValue('B4')).to.equal('');
            expect(test[0].getValue('C4')).to.equal('=SUM(C1:D3)');
            expect(test[0].getValue('D4')).to.equal('=SUM(C1:D3)');
            expect(test[0].getValue('E4')).to.equal('=SUM(C1:D3)');
        });

        it('3', () => {
            let test = jspreadsheet(root, {
                worksheets: [
                    {
                        data: [
                            ['1', '2', '3', '4'],
                            ['5', '6', '7', '8'],
                            ['9', '10', '11', '12'],
                            ['=SUM(B1:C3)', '=SUM(B1:C3)', '=SUM(B1:C3)', '=SUM(B1:C3)'],
                        ],
                        worksheetName: 'sheet1',
                    },
                ],
            });

            test[0].insertColumn(1, 1, false);

            expect(test[0].getValue('A4')).to.equal('=SUM(B1:D3)');
            expect(test[0].getValue('B4')).to.equal('=SUM(B1:D3)');
            expect(test[0].getValue('C4')).to.equal('');
            expect(test[0].getValue('D4')).to.equal('=SUM(B1:D3)');
            expect(test[0].getValue('E4')).to.equal('=SUM(B1:D3)');
        });

        it('4', () => {
            let test = jspreadsheet(root, {
                worksheets: [
                    {
                        data: [
                            ['1', '2', '3', '4'],
                            ['5', '6', '7', '8'],
                            ['9', '10', '11', '12'],
                            ['=SUM(B1:C3)', '=SUM(B1:C3)', '=SUM(B1:C3)', '=SUM(B1:C3)'],
                        ],
                        worksheetName: 'sheet1',
                    },
                ],
            });

            test[0].insertColumn(1, 2, true);

            expect(test[0].getValue('A4')).to.equal('=SUM(B1:D3)');
            expect(test[0].getValue('B4')).to.equal('=SUM(B1:D3)');
            expect(test[0].getValue('C4')).to.equal('');
            expect(test[0].getValue('D4')).to.equal('=SUM(B1:D3)');
            expect(test[0].getValue('E4')).to.equal('=SUM(B1:D3)');
        });

        it('5', () => {
            let test = jspreadsheet(root, {
                worksheets: [
                    {
                        data: [
                            ['1', '2', '3', '4'],
                            ['5', '6', '7', '8'],
                            ['9', '10', '11', '12'],
                            ['=SUM(B1:C3)', '=SUM(B1:C3)', '=SUM(B1:C3)', '=SUM(B1:C3)'],
                        ],
                        worksheetName: 'sheet1',
                    },
                ],
            });

            test[0].insertColumn(1, 2, false);

            expect(test[0].getValue('A4')).to.equal('=SUM(B1:C3)');
            expect(test[0].getValue('B4')).to.equal('=SUM(B1:C3)');
            expect(test[0].getValue('C4')).to.equal('=SUM(B1:C3)');
            expect(test[0].getValue('D4')).to.equal('');
            expect(test[0].getValue('E4')).to.equal('=SUM(B1:C3)');
        });

        it('6', () => {
            let test = jspreadsheet(root, {
                worksheets: [
                    {
                        data: [[1, 2, 3], [1, 2, 3], [1, 2, 3], [1, 2, 3], [1, 2, 3], ['=SUM(A1:A4)']],
                        minDimensions: [5, 5],
                    },
                ],
            });

            test[0].deleteRow(1);

            expect(test[0].getValue('A5')).to.equal('=SUM(A1:A3)');
        });
    });
});
