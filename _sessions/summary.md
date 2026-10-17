# Word Perhect: session summaries

Summaries of two Claude Code sessions on the `html-port` branch, oldest first. The full conversations are in [transcript.md](transcript.md).

## Word Perhect HTML port: session summary

8 October 2026, working with Claude Code on the `html-port` branch. The full conversation is in [transcript.md](transcript.md).

### Where things stood

Word Perhect (Tomoko Takahashi and Jon Pollard, commissioned by e-2 and Chisenhale Gallery) is a hand-drawn word processor. Visitors choose something to write on (a receipt, a travel card, cardboard…), a handwriting and a size, and type in the artist's handwriting. Only the Flash movies survive (`perhect.swf`, `help.swf`, `tip.swf`), not their source files. Saved texts went to a PHP and MySQL back-end (`perhect.php`, `lib/`), which was not to be rebuilt; LocalStorage replaces it.

### Assessment

- The SWFs are Flash 4, uncompressed: vector artwork and simple scripts, nothing compiled as ActionScript 3.
- The handwriting is three embedded fonts: `t2 neat` (224 characters), `t2messy` and `t2hardly` (83 each).
- The papers are nine scanned JPEGs: tissue/cigarette insert, receipt, bill, tube ticket, photo envelope, A–Z, plug cover, cardboard, calendar.
- Typing was done with an invisible button listening for 77 keys, each adding its character to the text.
- The back-end was three requests: `perhectN.asp?action=rd` (texts saved on paper N), `perhectN.asp?action=sg` (save) and `tips.asp?action=rd` (tips of the day).
- The original runs in Ruffle once a stand-in answers those requests.

Two routes were weighed: run the original under Ruffle with a LocalStorage stand-in, or port it fully to HTML and JavaScript. The full port was chosen, with the Ruffle version kept as a reference.

### What was built

**Extractor** (`_scripts/extract.js`). Reads the three SWFs directly for the timelines (what is placed where on each frame, frame labels, which frames have scripts), buttons, static text and text fields, and writes `port/data/*.json`. It runs [JPEXS FFDec](https://github.com/jindrapetrik/jpexs-decompiler) to export the shapes as SVG and the fonts as WOFF.

- FFDec's shape SVGs are kept in the shapes' own coordinates. The scans embedded in them as base64 PNGs are swapped for links to the original JPEGs, matched by size.
- Flash 4 JPEGs hold their tables and image as two streams, joined by dropping the EOI/SOI pair between them.
- Font metrics are kept in 1024ths of the font size, with the list of characters each font has.
- `lib/tips.txt` is copied to `port/data/tips.txt`.
- Usage: `node _scripts/extract.js --ffdec /path/to/ffdec-cli.jar`

**Runtime** (`port/js/flash.js`). Plays the timelines as SVG at the original 12 frames a second, following Flash 4's rules:

- Slash-syntax targets (`/paper/p1`, `../thes`, `_level99`) and variables on timelines (`/:pap`, `../:m`); names aren't case sensitive.
- Values are strings; `==` compares numerically, so an unset variable equals 0.
- Nested `tellTarget` paths are resolved from the timeline the script is in, and unqualified variables inside a `tellTarget` belong to the target.
- Levels (`loadMovieNum`) for the help (level 17) and tip (level 99) movies.
- Buttons with up, over and down states and a hit area, mouse events and key presses.
- Masks (clip depth), colour transforms, dragging, `duplicateMovieClip`, `getProperty`/`setProperty`, `call`.
- Text fields bound to variables, in the handwriting fonts.

**Scripts** (`port/js/scripts.js`). All the original ActionScript (about 500 handlers, 212 different ones) ported by hand from FFDec's decompiled scripts. Families of repeated scripts are written once with a table: 26 tooltips, 61 thesaurus words, 18 alerts, the paper and pen choices, and 70 help topics.

**Storage** (`port/js/storage.js`). Answers the same three requests from LocalStorage (falling back to memory if it isn't available), so each visitor sees only their own texts. An empty text gives `cconfirm=1`, as the PHP did.

**Page** (`port/index.html`, `port/css/perhect.css`). Loads the movies and scales the 600x480 stage to fit the window. Print prints just the paper; quit tries to close the window, as the original did.

**Reference** (`reference/`). The original SWF in Ruffle (from unpkg), with a service worker (`reference/sw.js`) standing in for the server, keeping saved texts in the Cache API.

### Fixes found by comparing with the reference

Both versions were driven in headless Chrome with the same clicks and keys, and screenshots compared side by side.

- **Text field layout.** Font metrics had been divided by 20. They are now in 1024ths, passed to the browser as `ascent-override`/`descent-override`, and fields put the first baseline the ascent below a 2px gutter, with lines (ascent + descent + leading) apart, as Flash did. Typed text now wraps and spaces identically.
- **Hover.** The browser fires hover events when content changes under a still pointer, which closed the file menu when the help menu opened. Hover is now worked out by hit-testing on real pointer movement, as in Flash and Ruffle.
- **Timeline jumps.** Jumping forward played every frame in between, creating clips (and running their scripts) that the target frame doesn't have; this showed a stray "you may lose the existing text" alert. Jumps now go straight to the target frame's display list, and scripts queued for removed clips are skipped.
- **Masks.** SVG clip paths can't use a `<use>` pointing at a group, so masks clipped everything (the open dialog's list was empty). The mask's paths are now copied into the clip path.
- **Missing characters.** Flash didn't draw characters an embedded font lacks; the browser used a fallback font, showing printed `^` among delete's scribbles. Text fields now leave out characters their font doesn't have.
- **Tips.** The tips file hadn't been copied into the port.

### Findings

- Backspace doesn't delete: it replaces the last character with `*`, which the handwriting draws as a scribble. Delete (toolbar) replaces the last four characters with `^][}`; complete delete replaces the whole text with symbols.
- The messy handwriting's `i` is barely more than a dot, so "this" looks like "ths". (At first this looked like Ruffle dropping a key.)
- The credits text decodes as "Jon Qollard": the font draws its P in the Q slot. It renders correctly, as text and font use the same mapping.
- Only the keys the original listened for can be typed; `"` types `'`.
- The receipt, cigarette insert and travel card are found in your pocket, but the toolbar says "my bag": the script hard-codes the location for each paper.
- Two scripts `tellTarget` a quoted string rather than a clip, so do nothing (Ruffle logs "GotoFrame failed: Invalid target").
- In the Ruffle reference the name typed when saving isn't sent, so saved texts are "untitled"; the port sends it.
- The server's `config.php` (with database credentials) isn't in the repo, so the original limit on how many texts were listed isn't known; the port lists them all.

### Status

Uncommitted on `html-port`: `_scripts/`, `port/`, `reference/` and this folder. The old site files (`index.html`, `perhect.php`, `lib/`, `.htaccess`) are untouched. FFDec 26.3.0 was downloaded to a scratch folder, not the repo; re-running the extractor needs it downloaded again.

Run with any static server from the repository root (e.g. `npx http-server`), then open `/port/` and `/reference/`.

Remaining differences from the original:

- After delete, the port wraps the final scribble onto the next line where the original keeps it on the same line (a sub-pixel difference in text width on the narrow receipt).
- After clicking "help", the original keeps the label highlighted.

### Possible next steps

- Typing on phones and tablets: typing works through key presses, as in the original, so touch devices have no keyboard.
- Make the port the site: replace `index.html` and the `.htaccess` rewrites to `perhect.php`.
- Seed the open lists with the 199 visitor texts in `_old/text` (2000–2005), if wanted.
- Check print and quit by hand; they weren't tested in headless Chrome.

---

## Word Perhect: print fix and tests, session summary

13 October 2026, working with Claude Code on the `html-port` branch. The same session also got Tome working without the Cosmo Player plugin (see the `tome` repository). The full conversation is in [transcript.md](transcript.md).

### Print left out the paper

When testing the port, Pete found that printing left out the paper being written on.

**The cause.** The paper scans aren't CSS backgrounds. Each one is an SVG `<pattern>` fill holding the JPEG (`url(#s176-PatternID_176_1)` and so on), defined in the stage's `<defs>`. To print, `port/index.html` copies the paper clip and the `<defs>` into `#print`, and the print CSS hides the stage. The copy repeated every ID, and `url(#…)` and `href="#…"` find the first element with that ID in the document, which was the stage's own copy, hidden when printing. Browsers don't draw a pattern from a hidden tree. The handwriting and vector drawing printed, but the scan didn't.

**The fix** (`player.onprint` in `port/index.html`). The print copy now gives its elements their own IDs, with a `print-` prefix, and rewrites its `url(#…)` and `href="#…"` references to match.

**Checked** by going through the real route in headless Chrome: pocket, receipt, messy, normal, OK, type, print, "print out will be messy - do you mind?", Yes, "Tough!", OK. Before the fix, Chrome's print PDF (with its default settings, background graphics off) had only the handwriting. After it, the receipt prints with the handwriting on it.

### Tests

Pete asked for tests to run on the port. These are in `tests/`, using Node's built-in test runner and [Playwright](https://playwright.dev) 1.63.0 (the only dev dependency in the new `package.json`). They run with `npm install` and then `npm test`.

- **`tests/support/server.js`** is a static server for the repository on a free port, so the tests need nothing else running.
- **`tests/support/perhect.js`** opens the port in the installed Google Chrome, or in Playwright's own Chromium with `WP_BROWSER=chromium`. It replaces `print()` with a counter and collects page errors. Helpers:
  - `press(id)` presses a button by its character ID, the IDs `js/scripts.js` uses, with a real mouse click at a point where that button is topmost. So the port's own hit testing is exercised, and tests don't depend on window size. `press(id, { movie: 'tip' })` works for the other movies, and `press(844, { where: { MyRowNo: '1' } })` chooses between duplicated copies of a button by their clip's variables.
  - `start({ paper, pen, size })` goes through the wizard and closes the tip of the day.
  - `get('/:pap')`, `text()`, `waitForFrame()`, `waitForVar()` and `printed()` read the piece's state.
- **31 tests in five files**, each file also checking that no script raised an error:
  - `wizard.test.js`: OK needs a pen and a size; each of the nine papers reaches the editor with its name and location in the toolbar, one after another using "new", varying the pen and size; typing on each.
  - `editor.test.js`: typing; only the keys the original listened for, with `"` typing `'`; backspace scribbles (`*`); delete turns the last four letters into `^][}`; complete delete turns the text into rubbish.
  - `files.test.js`: save with a name, checking `localStorage`; then "new", open, the warning, "look in my pocket", the receipt, and the first row, which brings the text back.
  - `print.test.js`: print from the toolbar and from the file menu; the print copy has the text, the paper's scan, and no references to IDs outside itself. With the fix removed, these tests fail.
  - `menus.test.js`: help on level 17 from the toolbar, a tooltip on rolling over a tool, the file and help menus, and About.
- A full run takes about 80 seconds, one file at a time. It passed 31 of 31 twice.
- `port/README.md` has a new Tests section, and `.gitignore` leaves out `node_modules/`.

Button IDs found on the way, for writing more tests:

| Where | Buttons |
| --- | --- |
| Wizard locations | pocket `31`, bag `32`, studio `33` |
| Papers | `45`, `46`, `47` / `66`, `67`, `69` / `87`, `89`, `91` (the other buttons on those screens are the joke items) |
| Pens | `116`, `119`, `121` |
| Sizes | `124`, `126`, `128` |
| OK | `136` |
| Tip of the day | OK is `12` in the `tip` movie |
| Toolbar | print `373`, new `381`, open `385`, save `389`, delete `393`, complete delete `361`, help `431` |
| Print alert | Yes `711`, then OK `718` |
| Save | `726` to the "save as" dialog, then `867` |
| Open | warning OK `745`; look in `813` / `814` / `815`, then papers `825`–`827` / `831`–`833` / `837`–`839`; rows `844` |
| Menus | file `608` (closed by `610`), help `630` (closed by `631`); file menu `613`–`617`, help menu `633`–`636` |

### Status

Uncommitted on `html-port`: `port/index.html` (the fix), `port/README.md`, `package.json`, `package-lock.json`, `.gitignore`, `tests/` and these notes.

Noticed but left alone: the paper prints quite small, in the top-left of the page, with white space to its right. The print copy's view box comes from the clip's bounding box, which seems to be wider than the paper.

### Possible next steps

- Make the printed paper fill the page.
- Screenshot comparisons against the Ruffle reference, if wanted. They would be more fragile than the current checks on state.
- More tests: the thesaurus, the paper arrows, changing paper while writing, help topics, quit.
