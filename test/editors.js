const { expect } = require('chai');
const jspreadsheet = require('../dist/index.js');

const createFixture = (value = 'Existing value', openEditor) => {
    const calls = [];
    const editor = {
        openEditor:
            openEditor ||
            function (cell, value, x, y, instance, options, event, empty) {
                calls.push({ cell, value, x, y, instance, options, event });
                const input = document.createElement('input');
                input.value = empty === true ? '' : value;
                cell.textContent = '';
                cell.appendChild(input);
            },
        closeEditor(cell) {
            return cell.querySelector('input').value;
        },
        updateCell(cell, value) {
            cell.textContent = value;
        },
    };
    const sheet = jspreadsheet(root, {
        worksheets: [{ data: [[value]], columns: [{ type: editor }] }],
    })[0];
    return { sheet, cell: sheet.records[0][0].element, calls };
};

describe('Custom editor empty mode', () => {
    it('opens an empty input while preserving the stored value and existing callback arguments', () => {
        const { sheet, cell, calls } = createFixture();
        const event = new window.KeyboardEvent('keydown', { key: 'a' });

        sheet.openEditor(cell, true, event);

        expect(cell.querySelector('input').value).to.eq('');
        expect(sheet.getValue('A1')).to.eq('Existing value');
        expect(calls[0]).to.deep.eq({
            cell,
            value: 'Existing value',
            x: 0,
            y: 0,
            instance: sheet,
            options: sheet.options.columns[0],
            event,
        });
        sheet.closeEditor(cell, false);
    });

    it('preserves zero when empty mode is false', () => {
        const { sheet, cell } = createFixture(0);
        sheet.openEditor(cell, false);
        expect(cell.querySelector('input').value).to.eq('0');
        sheet.closeEditor(cell, false);
    });

    it('preserves the existing value when empty mode is omitted', () => {
        const { sheet, cell } = createFixture();
        sheet.openEditor(cell);
        expect(cell.querySelector('input').value).to.eq('Existing value');
        sheet.closeEditor(cell, false);
    });

    it('saves replacement text and supports undo and redo', () => {
        const { sheet, cell } = createFixture();
        sheet.openEditor(cell, true);
        expect(cell.querySelector('input').value).to.eq('');
        cell.querySelector('input').value = 'Replacement';
        sheet.closeEditor(cell, true);

        expect(sheet.getValue('A1')).to.eq('Replacement');
        expect(cell.textContent).to.eq('Replacement');
        sheet.undo();
        expect(sheet.getValue('A1')).to.eq('Existing value');
        expect(cell.textContent).to.eq('Existing value');
        sheet.redo();
        expect(sheet.getValue('A1')).to.eq('Replacement');
    });

    it('restores the old value when an empty-mode edit is cancelled', () => {
        const { sheet, cell } = createFixture();
        sheet.openEditor(cell, true);
        expect(cell.querySelector('input').value).to.eq('');
        cell.querySelector('input').value = 'Discarded';
        sheet.closeEditor(cell, false);

        expect(sheet.getValue('A1')).to.eq('Existing value');
        expect(cell.textContent).to.eq('Existing value');
        expect(sheet.edition).to.eq(null);
    });

    it('keeps legacy seven-argument editors working without changing the event position', () => {
        let observedEvent;
        const legacyEditor = function (cell, value, x, y, instance, options, event) {
            observedEvent = event;
            const input = document.createElement('input');
            input.value = value;
            cell.textContent = '';
            cell.appendChild(input);
        };
        const { sheet, cell } = createFixture('Legacy value', legacyEditor);
        const event = new window.MouseEvent('dblclick');
        sheet.openEditor(cell, true, event);

        expect(cell.querySelector('input').value).to.eq('Legacy value');
        expect(observedEvent).to.eq(event);
        sheet.closeEditor(cell, false);
    });
});
