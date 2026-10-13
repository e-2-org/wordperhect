/**
 * Writing: typing, the keys the piece knows, delete and complete delete
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { open } = require('./support/perhect');

describe('editor', () => {
    let wp;
    before(async () => {
        wp = await open();
        await wp.start({ paper: 2 });
    });
    after(() => wp.close());
    /* each test starts with an empty paper */
    beforeEach(() => wp.page.evaluate(() => player.setVar(null, '/paper/p2/size2/:m', '')));

    it('writes what is typed on the paper', async () => {
        await wp.type('Hello, paper.');
        assert.equal(await wp.text(), 'Hello, paper.');
    });

    it('only takes the keys the original listened for, and " types \'', async () => {
        await wp.type('a#b"c');
        assert.equal(await wp.text(), "ab'c");
    });

    it('scribbles over the last letter on backspace, rather than deleting it', async () => {
        await wp.type('abc');
        await wp.page.keyboard.press('Backspace');
        assert.equal(await wp.text(), 'ab*');
    });

    it('turns the last four letters into a scribble with delete', async () => {
        await wp.type('scribble');
        await wp.press(393);
        await wp.page.waitForFunction(() => player.getVar(null, '/paper/p2/size2/:m') !== 'scribble');
        assert.equal(await wp.text(), 'scri^][}');
    });

    it('turns the text into rubbish with complete delete', async () => {
        await wp.type('all of it');
        await wp.press(361);
        await wp.page.waitForFunction(() => player.getVar(null, '/paper/p2/size2/:m') !== 'all of it');
        assert.match(await wp.text(), /^\[ \] \[\*@@\*/);
    });

    it('has no script errors', () => assert.deepEqual(wp.errors, []));
});
