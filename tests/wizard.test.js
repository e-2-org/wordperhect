/**
 * The wizard: where the paper comes from, the paper, the pen and the size
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { open } = require('./support/perhect');

/* each paper's name and location in the toolbar, as js/scripts.js has them */
const PAPERS = {
    1: ['cig insert', 'my bag'],
    2: ['receipt', 'my bag'],
    3: ['travel card', 'my bag'],
    4: ['telephone bill back', 'my pocket'],
    5: ['photo envelope', 'my pocket'],
    6: ['back of an a-z', 'my pocket'],
    7: ['plug paper', 'my studio'],
    8: ['cardboard', 'my studio'],
    9: ['old calendar', 'my studio'],
};

describe('wizard', () => {
    let wp;
    before(async () => wp = await open());
    after(() => wp.close());

    it('needs a pen and a size before OK', async () => {
        await wp.press(31);
        await wp.press(45);
        await wp.press(136);
        await wp.page.waitForTimeout(500);
        assert.equal(await wp.page.evaluate(() => player.levels.get(0).frame), 225, 'still on the pen and size screen');
        assert.equal(await wp.page.evaluate(() => player.resolve(null, '/alert').frame > 1), true, 'the alert is showing');
        /* now choose them, and carry on to the editor */
        await wp.press(116);
        await wp.press(124);
        await wp.press(136);
        await wp.waitForFrame(249);
        await wp.press(12, { movie: 'tip' });
        await wp.press(381);
        await wp.waitForFrame(166);
    });

    /* one after the other, with "new" in between, as a visitor would */
    for (const [paper, [name, location]] of Object.entries(PAPERS)) {
        it(`reaches the editor with paper ${paper} (${name})`, async () => {
            const pen = (paper - 1) % 3 + 1;
            const size = (Math.floor((paper - 1) / 3)) % 3 + 1;
            await wp.start({ paper: Number(paper), pen, size });
            assert.equal(await wp.get('/:pap'), paper);
            assert.equal(await wp.get('/:pen'), String(pen));
            assert.equal(await wp.get('/:size'), String(size));
            assert.equal(await wp.get('/:papertype'), name);
            assert.equal(await wp.get('/:location'), location);
            await wp.type(`paper ${paper}`);
            assert.equal(await wp.text(), `paper ${paper}`);
            await wp.press(381);
            await wp.waitForFrame(166);
        });
    }

    it('has no script errors', () => assert.deepEqual(wp.errors, []));
});
