/**
 * Saving and opening: js/storage.js keeps the texts in localStorage, by paper
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { open } = require('./support/perhect');

describe('save and open', () => {
    let wp;
    before(async () => {
        wp = await open();
        await wp.start({ paper: 2 });
    });
    after(() => wp.close());

    it('saves the text under a name', async () => {
        await wp.type('my words');
        await wp.press(389);
        await wp.press(726);
        await wp.page.locator('input.field:visible').fill('test name');
        await wp.press(867);
        await wp.waitForFrame(256);
        const saved = await wp.page.evaluate(() => JSON.parse(localStorage.getItem('wordperhect:paper2')));
        assert.equal(saved.length, 1);
        assert.equal(saved[0].name, 'test name');
        assert.equal(saved[0].text, 'my words');
    });

    it('opens it again on a new page', async () => {
        await wp.press(381);
        await wp.start({ paper: 2 });
        assert.equal(await wp.text(), '');
        await wp.press(385);
        /* "you may lose the existing text" */
        await wp.press(745);
        /* look in my pocket, then the receipt: paper 2 */
        await wp.press(813);
        await wp.press(826);
        /* the list duplicates a template row for each text: the first text's row */
        await wp.press(844, { where: { MyRowNo: '1' } });
        await wp.waitForFrame(256);
        assert.equal(await wp.text(), 'my words');
    });

    it('has no script errors', () => assert.deepEqual(wp.errors, []));
});
