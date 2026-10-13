/**
 * Printing: just the paper, with what is written on it
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { open } = require('./support/perhect');

/* what the print copy holds, and anything it refers to that isn't inside it */
const printCopy = page => page.evaluate(() => {
    const out = document.getElementById('print');
    const outside = [];
    out.querySelectorAll('*').forEach(el => {
        for (const attr of el.attributes) {
            const ids = [...attr.value.matchAll(/url\(#([^)]+)\)/g)].map(m => m[1]);
            if (/^(xlink:)?href$/.test(attr.name) && attr.value.startsWith('#')) ids.push(attr.value.slice(1));
            ids.forEach(id => {
                if (!out.contains(document.getElementById(id))) outside.push(id);
            });
        }
    });
    return {
        svgs: out.querySelectorAll('svg').length,
        images: [...out.querySelectorAll('pattern image')].map(i => i.getAttribute('href')),
        text: out.textContent,
        outside,
    };
});

describe('print', () => {
    let wp;
    before(async () => {
        wp = await open();
        await wp.start({ paper: 2 });
        await wp.type('hello paper');
    });
    after(() => wp.close());

    it('prints from the toolbar, after "messy - do you mind?" and "Tough!"', async () => {
        await wp.press(373);
        await wp.press(711);
        await wp.press(718);
        assert.equal(await wp.printed(), 1);
    });

    it('prints the paper with the text on it', async () => {
        const copy = await printCopy(wp.page);
        assert.equal(copy.svgs, 1);
        assert.ok(copy.text.includes('hello paper'), 'the text is in the print copy');
    });

    /* the paper scans are pattern fills: when the copy referred to the hidden stage's patterns, they didn't print */
    it('includes the scanned paper, and refers only to itself', async () => {
        const copy = await printCopy(wp.page);
        assert.equal(copy.images.length, 1, 'one paper scan');
        assert.match(copy.images[0], /^assets\/images\/perhect-\d+\.jpg$/);
        assert.deepEqual(copy.outside, [], 'ids the print copy refers to outside itself');
    });

    it('prints from the file menu too', async () => {
        await wp.press(608);
        await wp.press(613);
        assert.equal(await wp.printed(), 2);
        assert.deepEqual((await printCopy(wp.page)).outside, []);
    });

    it('has no script errors', () => assert.deepEqual(wp.errors, []));
});
