/**
 * The menus, help, and the toolbar's tooltips and alerts
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { open } = require('./support/perhect');

describe('toolbar and menus', () => {
    let wp;
    const onScreen = async () => new Set((await wp.buttons()).filter(b => b.movie === 'perhect').map(b => b.id));
    before(async () => {
        wp = await open();
        await wp.start({ paper: 2 });
    });
    after(() => wp.close());

    it('loads help on level 17 from the toolbar', async () => {
        await wp.press(431);
        await wp.page.waitForFunction(() => player.levels.get(17)?.el.isConnected);
    });

    it('shows a tooltip on rolling over a tool', async () => {
        const before = await wp.page.evaluate(() => player.resolve(null, '/tooltext')?.frame);
        await wp.page.evaluate(() => {
            const b = [...player.buttons].find(b => Number(b.id) === 373 && b.el.isConnected);
            const r = b.hit.getBoundingClientRect();
            window.toolPoint = [r.left + r.width / 2, r.top + r.height / 2];
        });
        const [x, y] = await wp.page.evaluate(() => window.toolPoint);
        await wp.page.mouse.move(x, y);
        await wp.page.waitForFunction(before => player.resolve(null, '/tooltext')?.frame !== before, before);
    });

    it('opens the file menu: print, new, open, save, quit', async () => {
        await wp.press(608);
        const buttons = await onScreen();
        [613, 614, 615, 616, 617].forEach(id => assert.ok(buttons.has(id), `button ${id}`));
        /* an open menu closes when the pointer moves off it, onto these */
        await wp.press(610);
    });

    it('opens the help menu: tip of the day, help on help, help, about', async () => {
        await wp.press(630);
        const buttons = await onScreen();
        [633, 634, 635, 636].forEach(id => assert.ok(buttons.has(id), `button ${id}`));
        await wp.press(631);
    });

    it('shows About from the help menu', async () => {
        await wp.press(630);
        await wp.press(636);
        await wp.page.waitForFunction(() => player.resolve(null, '/about').frame === 2);
    });

    it('has no script errors', () => assert.deepEqual(wp.errors, []));
});
