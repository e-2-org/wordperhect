/**
 * Driving the port in a browser for the tests
 *
 * Buttons are pressed by their character id in the movie, the same ids
 * js/scripts.js uses, with a real mouse click on a point where the button is
 * the topmost thing under the pointer, so the port's own hit testing is used.
 */
const { chromium } = require('playwright');
const { serve } = require('./server');

/* how long to wait for something to happen on the stage (12 frames a second) */
const TIMEOUT = 15000;

/* the wizard's buttons: paper: [location, paper]; pen and size: the radio buttons */
const WIZARD = {
    paper: { 1: [31, 45], 2: [31, 46], 3: [31, 47], 4: [32, 66], 5: [32, 67], 6: [32, 69], 7: [33, 87], 8: [33, 89], 9: [33, 91] },
    pen: { 1: 116, 2: 119, 3: 121 },
    size: { 1: 124, 2: 126, 3: 128 },
    ok: 136,
};

/**
 * Start the server and a browser, and open the port with empty storage.
 * Use in before()/after(): const wp = await open(); ... await wp.close();
 */
async function open() {
    const server = await serve();
    /* the installed Google Chrome, or Playwright's own Chromium with WP_BROWSER=chromium
       (after npx playwright install chromium) */
    const browser = await chromium.launch(process.env.WP_BROWSER === 'chromium' ? {} : { channel: 'chrome' });
    const page = await browser.newPage({ viewport: { width: 750, height: 600 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    /* print() would open the print dialog: count the calls instead */
    await page.addInitScript(() => {
        window.printed = 0;
        window.print = () => window.printed++;
    });
    await page.goto(server.url + '/docs/');
    await page.waitForFunction(() => window.player);
    const wp = {
        page,
        errors,
        async close() {
            await browser.close();
            await server.close();
        },
        /* the buttons on screen now: [{ movie, id }] */
        buttons() {
            return page.evaluate(() => [...player.buttons]
                .filter(b => b.el.isConnected && b.hit.classList.contains('active') && b.hit.getClientRects().length)
                .map(b => ({ movie: b.movie.name, id: Number(b.id) })));
        },
        /*
         * wait for a button to be on screen, then click it
         * options: movie ('perhect', 'help' or 'tip'), and where: { var: value } to choose
         * between copies of a button by the variables of the clip it is in
         */
        async press(id, { movie = 'perhect', where = {} } = {}) {
            const point = await waitFor(page, ([id, movie, where]) => {
                for (const b of player.buttons) {
                    if (Number(b.id) !== id || b.movie.name !== movie || !b.el.isConnected) continue;
                    if (Object.entries(where).some(([name, value]) => String(b.parent?.getVar(name)) !== value)) continue;
                    for (const shape of b.hit.querySelectorAll('path, rect, use')) {
                        const r = shape.getBoundingClientRect();
                        if (!r.width || !r.height) continue;
                        /* a few points in the shape's box, to find one where the button is on top */
                        for (const [fx, fy] of [[.5, .5], [.25, .5], [.75, .5], [.5, .25], [.5, .75]]) {
                            const x = r.left + r.width * fx;
                            const y = r.top + r.height * fy;
                            const hit = document.elementFromPoint(x, y)?.closest('.button-hit.active');
                            if (hit && hit.button === b) return { x, y };
                        }
                    }
                }
                return null;
            }, [id, movie, where], `button ${id} in ${movie}`);
            await page.mouse.click(point.x, point.y);
        },
        /*
         * go through the wizard (after the intro, or after "new") to the editor,
         * and close the tip of the day: paper 1-9, pen 1 messy, 2 tidy, 3 hardly visible, size 1-3
         */
        async start({ paper = 2, pen = 1, size = 2 } = {}) {
            const [location, button] = WIZARD.paper[paper];
            await wp.press(location);
            await wp.press(button);
            await wp.press(WIZARD.pen[pen]);
            await wp.press(WIZARD.size[size]);
            await wp.press(WIZARD.ok);
            await wp.waitForFrame(249);
            await wp.press(12, { movie: 'tip' });
            await waitFor(page, () => !player.levels.get(99)?.el.isConnected || player.levels.get(99).frame === 22 || null, null, 'the tip to close');
        },
        /* a variable, by Flash path: '/:pap', '/paper/p2/size2/:m' */
        get(path) {
            return page.evaluate(path => player.getVar(null, path), path);
        },
        /* wait until a variable has a value */
        waitForVar(path, value) {
            return waitFor(page, ([path, value]) => String(player.getVar(null, path)) === value || null,
                [path, value], `${path} to be ${value}`);
        },
        /* wait until the main timeline is on a frame */
        waitForFrame(frame) {
            return waitFor(page, frame => player.levels.get(0).frame === frame || null, frame, `frame ${frame}`);
        },
        /* type with the keyboard, as a visitor would */
        async type(text) {
            await page.keyboard.type(text, { delay: 30 });
        },
        /* the text written on the chosen paper */
        text() {
            return page.evaluate(() => {
                const root = player.levels.get(0);
                return String(player.getVar(null, `/paper/p${root.getVar('pap')}/size${root.getVar('size')}/:m`) ?? '');
            });
        },
        printed() {
            return page.evaluate(() => window.printed);
        },
    };
    return wp;
}

/* wait until fn (run in the page) returns something other than null */
async function waitFor(page, fn, arg, what) {
    try {
        const handle = await page.waitForFunction(fn, arg, { timeout: TIMEOUT, polling: 100 });
        return handle.jsonValue();
    } catch (e) {
        throw new Error(`timed out waiting for ${what}`);
    }
}

module.exports = { open, WIZARD };
