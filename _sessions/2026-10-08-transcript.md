# Word Perhect HTML port - session transcript

Transcript of a Claude Code session on 2026-10-08 (ending about 10:20 UTC). Tool calls are shown as one-line notes; their output is omitted. Message times weren't recorded, so only the date is given. Claude's longer replies are shortened where they repeat what the summary records.

---

## User - 2026-10-08

Thanks - I have a new project

## Claude

Happy to help. What's the new project? If it's in one of the repos here, tell me which one and where you'd like to start.

## User - 2026-10-08

/mnt/data/home/repos/wordperhect - this was a project with artist Tomoko Takahashi. I don't have the Flash source files for this project unfortunately, just the SWFs. It was a re-imagining of a word processing program as an interactive web app, where users could use different media (back of a utility bill, receipt, etc.) to type on in the artist's handwriting. The app used a PHP and database back-end to save the things people typed, but I don't want to replicate this (replace it with LocalStorage). I'm initially interested in just how much of this piece can be ported to a JavaScript / HTML app

## Claude

I'll start by looking at what's in the repo and which SWF tools are available here.

> *Bash: List wordperhect repo contents and available tools*

> *Bash: Read page, PHP endpoint and library*

Next I'll check the SWF headers and tags (with a small Python parser), the old ASP back-end, and the saved data.

> *Bash: Parse SWF headers and count tag types*

These are Flash 4 files, which is good news: a simple scripting model and vector artwork, nothing compiled as ActionScript 3. Next I'll check whether a SWF decompiler is already installed.

> *Bash: Look for installed SWF decompilers*

> *Bash: Check whether JPEXS flatpak is installed*

JPEXS (the usual SWF decompiler) isn't installed. Flash 4 files are simple enough to inspect with my own parser, so I'll extend it.

> *Bash: Extract fonts, text fields, labels and actions from perhect.swf*

The handwriting is embedded as three vector fonts: "t2 neat" (224 characters) and "t2messy" and "t2hardly" (83 characters each). Those can be converted into web fonts, which is the core of the port.

> *Bash: Show remaining labels and action strings*

> *Bash: Inspect keypress buttons and URL calls*

Typing worked through 77 invisible key buttons, each appending its character to the text variable `m`. The server calls are `perhect<N>.asp?action=rd`, a save call, and `tips.asp`.

> *Bash: List embedded JPEG sizes*

> *Bash: Make a contact sheet of the JPEGs*

> *Read: contact sheet of the papers*

The papers are scanned JPEGs: a tissue, a receipt, the back of a bill, a tube ticket, a photo lab form, an A–Z map, a plug cover, some cardboard and a calendar page. To see the interface, I'll try running the SWF under Ruffle.

> *Bash: Set up a Ruffle test page in the scratchpad*

> *Bash: Screenshot the SWF running under Ruffle (blank: the extension's copy of Ruffle won't register outside the extension)*

> *Bash: Run SWF with self-hosted Ruffle from unpkg*

> *Read: Ruffle screenshots*

Ruffle runs the piece, so I can drive it like a user and see each screen.

> *Bash: Click "From my pocket", probe the location choice, read the frame scripts*

The intro waits for a server response (frame 211 loops until `loaded` is 1). I'll make the test server answer the old `.asp` calls with empty data.

> *Bash: Pick the receipt with a fake back-end; choose pen and size; open the editor and type*

> *Read: screenshots of the pen screen and editor*

The whole piece runs under Ruffle. Last, the old saved texts.

> *Bash: Inspect old saved texts, schema and tips*

Almost all of Word Perhect can be ported. The SWFs hold everything needed: the handwriting, the papers, all the drawn interface and every script. What has to be done by hand is rewriting the behaviour.

- **Taken straight out of the SWF:** the three handwriting fonts (convert to web fonts), the nine scanned papers, the hand-drawn interface (export to SVG), all text. No sound.
- **Rewritten:** about 220 frame scripts and 216 buttons, working like a state machine: the wizard, the editor (27 text areas, one per paper and size; 77 key buttons), the toolbar (mostly hand-drawn notes rather than real functions), help and tips.
- **The back-end is three calls**, easy to replace with LocalStorage. There are also 199 visitor texts from 2000–2005 in `_old/text` that could seed the "open" list.
- **Two ways:** run the original under Ruffle with LocalStorage answering the calls (quick, exactly like the original, but still Flash underneath), or a full HTML/JavaScript port (the proper long-term version).

My recommendation: do the full port, keeping option 1 as the reference. To start, I'd export the fonts and artwork with JPEXS FFDec, which I'd need to download from its GitHub releases. Is that OK?

## User - 2026-10-08

Yes, please get JPEXS FFDec, and do the full  HTML/JavaScript port with option 1 as a reference

## Claude

I'll start by downloading JPEXS FFDec into the scratchpad, kept apart from the repo.

> *Bash: Check repo state and latest JPEXS release*

> *Bash: Query latest JPEXS release without auth*

> *Bash: Download and unpack JPEXS FFDec 26.3.0*

> *Bash: Show FFDec CLI export options*

> *Bash: Export everything from the three SWFs*

> *Bash: Summarise perhect export*

FFDec exported the fonts as WOFF, the nine papers, 586 script files, and SVGs for the shapes, frames, clips and buttons. Next I'll map the scripts.

> *Bash: Map exported script layout; concatenate decompiled scripts for reading*

> *Read: decompiled scripts (several sections)*

> *Bash: Inspect FFDec SVG output format*

The artwork can be reassembled exactly: FFDec's shape SVGs keep their original coordinates. My plan follows the same approach as error404: an extractor pulls timelines, buttons and text fields into JSON and SVG; a small JavaScript renderer plays them as SVG; every script is rewritten by hand; LocalStorage replaces the server; the Ruffle version sits alongside for comparison.

> *Bash: Condense scripts and list remaining handlers*

> *Read: condensed scripts*

> *Bash: Count unique script handlers and API usage*

Progress update: once duplicates are removed there are 212 distinct handlers, about 1,500 lines, using a small set of Flash features. Porting them by hand on top of a small runtime is manageable.

> *Read: remaining scripts*

> *Bash: Check bitmap fills in shape SVGs and font tools; inspect exported WOFF font metrics*

> *Bash: Read special key handlers and help/tip scripts*

The Backspace key doesn't delete: it swaps the last character for a `*`. That's one of the piece's deliberate quirks, so the port will keep it.

> *Bash: Create branch and inspect site files*

> *Write: _scripts/extract.js*

> *Bash: Run the extractor (all nine paper images failed to match their shapes)*

> *Bash: Fix JPEG handling and rerun extractor*

> *Bash: Spot-check extracted symbols*

> *Bash: Read remaining help and tip scripts*

> *Bash: Survey masks, colour transforms and char swaps*

> *Write: port/js/flash.js*

> *Bash: Group identical script bodies; extract repeated handler families as tables*

> *Read: the handlers that don't fit a family*

Two Flash 4 rules matter for the port: nested `tellTarget` paths resolve from the timeline the script lives in, and unqualified variables inside a `tellTarget` belong to the target timeline.

> *Bash: List special-case typing keys*

> *Bash: Update runtime targeting and handler lookup*

> *Write: port/js/scripts.js*

> *Bash: Fix save path and read server settings*

> *Write: port/js/storage.js*

> *Edit: _scripts/extract.js (copy tips.txt)*

> *Write: port/index.html, port/css/perhect.css*

> *Write: reference/index.html, reference/sw.js*

> *Bash: Load the port in headless Chrome and capture errors*

> *Read: port screenshots*

The port runs. The intro and credits draw in Tomoko's handwriting, with no script errors. Now the same walkthrough on both versions.

> *Bash: Run the same walkthrough on port and reference*

> *Read: side-by-side screenshots*

The port matches the original screen for screen through the wizard and into the editor. One difference: the tip of the day is empty.

> *Bash: Inspect the tip movie's state in the port*

> *Bash: Rerun extractor and test tip, typing and keys*

> *Read: side-by-side screenshots*

> *Bash: Inspect tip text field and placement; compare glyph sizes across exported fonts*

> *Bash: Fix font metrics and text field line layout*

> *Bash: Compare typed text close up*

> *Read: close-up comparison*

The typed text is identical in both versions. One correction to what I said earlier: the "missing letter" in Ruffle ("ths" for "this") isn't a glitch. The messy handwriting's "i" is barely more than a dot, and the port draws it the same way.

> *Bash: Compare toolbar tooltips and an alert*

> *Bash: Compare thesaurus, delete and menus*

> *Read: side-by-side screenshots*

> *Bash: Inspect menu and delete button records; log button events while opening menus*

Opening the help menu swaps the button under the cursor, and Chrome fires a hover event without the mouse moving, so the file menu's closer reacts. Ruffle, like Flash, only re-tests when the mouse moves. I'll make the port do the same.

> *Bash: Switch to Flash-style hover and retest menus*

> *Read: side-by-side screenshots*

> *Bash: Open the save dialog in both versions*

The port shows an extra alert. Jumping forward along a timeline played every frame in between, creating clips whose scripts still ran. Flash goes straight to the target frame's state.

> *Bash: Fix timeline jumps and test saving*

Progress update: the port now matches the original through the wizard, typing, tooltips, alerts, the thesaurus, the menus and saving.

> *Bash: Save then open in both versions; choose receipt in the open dialog*

> *Bash: Inspect the open list clips in the port; inspect mask and list sprite definitions*

The list of saved texts doesn't show: SVG clip paths can't use a `<use>` that points at a group, so the mask hid everything. I'll copy the mask's paths into the clip path.

> *Bash: Fix masks and retest opening a saved text*

Opening a saved text now works. The Ruffle reference shows the saved name as "untitled" because Ruffle didn't send the typed name; that's a Ruffle quirk, not a port difference.

> *Bash: Open help; test help topic, scrolling and closing*

> *Bash: Test paper arrows and new*

> *Bash: Test delete, complete delete, bin and about*

Delete and complete delete add characters such as `^` that the handwriting fonts don't contain. Flash doesn't draw those; the browser falls back to another font. Text fields will now leave them out.

> *Bash: Drop characters missing from fonts and retest*

## User (sent while Claude was working) - 2026-10-08

I remember the delete key scribbling out the last character (not deleting it)

## Claude

Yes, the port keeps that. The Backspace key (labelled "delete" on a Mac) doesn't delete: the original script replaces the last character with `*`, and the handwriting fonts draw `*` as a scribble.

> *Bash: Compare Backspace scribbling in both*

Your memory is right, and the port matches it: "mistake" with two Backspaces becomes "mistak" plus a scribble in both versions.

> *Bash: Sweep remaining toolbar buttons for errors; contact sheet of the sweep*

> *Bash: Update extractor docs and add port README*

The HTML/JavaScript port of Word Perhect is working, with the original running in Ruffle beside it as the reference. Both were driven through every main part of the piece in headless Chrome and match screen for screen. Everything is on the `html-port` branch, uncommitted.

- **Checked against the original:** intro and credits, the wizard, typing and wrapping, tooltips, alerts, the thesaurus, delete and complete delete, the bin, the menus, save and open, help, tip of the day, About, the paper arrows and "new".
- **Differences that remain:** the port wraps delete's final scribble onto the next line on the narrow receipt; the original keeps the "help" label highlighted after clicking.
- **Before this could replace the live site:** typing on phones and tablets (there's no keyboard); making the port the site root; possibly seeding the open lists with the old visitor texts; FFDec lives in a scratch folder, not the repo.

## User - 2026-10-08

OK that sounds really good - I'll do some testing and see how it looks. Can you please write a summary and transcript of this session in a _sessions folder in the repo?

## Claude

> *Bash: Check for an existing sessions folder*

> *Write: _sessions/2026-10-08-summary.md*

> *Write: _sessions/2026-10-08-transcript.md*

I've written the summary and this transcript to `_sessions/` in the repo.
