Word Perhect: HTML port
=======================

Word Perhect by Tomoko Takahashi and Jon Pollard, commissioned and produced by e-2 and Chisenhale Gallery, rebuilt to run without Flash.

Only the SWF files survive, so the piece is rebuilt from them:

* `_scripts/extract.js` reads `perhect.swf`, `help.swf` and `tip.swf` and writes everything that describes the piece to `port/data/*.json`: the timelines (what is placed where on each frame, frame labels), buttons, static text and text fields. The vector artwork and the handwriting fonts come from an export by [JPEXS FFDec](https://github.com/jindrapetrik/jpexs-decompiler), which the script runs. The scanned papers are copied out as the original JPEGs.
* `js/flash.js` plays those timelines as SVG, at the original 12 frames a second, with Flash 4's rules for paths, variables, buttons, masks and text fields.
* `js/scripts.js` is the original ActionScript, ported to JavaScript by hand from FFDec's decompiled scripts. Repeated scripts (tooltips, the thesaurus, alerts, the paper and pen choices) are written once with a table.
* `js/storage.js` stands in for the original's PHP and database (`perhect.php`, `lib/`), answering the same requests from `localStorage`, so each visitor sees only the texts they have saved.

```
node _scripts/extract.js --ffdec /path/to/ffdec-cli.jar   # regenerate port/data and port/assets
```

The page needs to be served over HTTP (it loads JSON and fonts), e.g. `npx http-server` in the repository root, then open `/port/`.

The original movie can be run for comparison in `/reference/`, which plays the SWF in [Ruffle](https://ruffle.rs) with a service worker standing in for the server.

Things kept from the original
-----------------------------

* Backspace doesn't delete: it scribbles over the last letter (it adds a `*`, which the handwriting draws as a scribble).
* Only the keys the original listened for can be typed; `"` types `'`.
* The receipt, cigarette insert and travel card are found in your pocket but labelled "my bag" in the toolbar: the script hard-codes the location for each paper.
* Two scripts target a quoted string rather than a clip, so do nothing, as in Flash.
