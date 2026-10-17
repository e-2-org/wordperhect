/**
 * Extracts Word Perhect from the original Flash 4 movies
 *
 * The SWF files are read directly for everything that describes how the piece
 * is put together: the timelines (what is placed where on each frame, frame
 * labels, which frames have scripts), buttons, static text and text fields.
 *
 * The vector artwork (shapes) and the fonts are taken from an export made by
 * JPEXS FFDec (https://github.com/jindrapetrik/jpexs-decompiler), which turns
 * Flash shapes into SVG and Flash fonts into WOFF.
 *
 * The scripts themselves are not extracted: they were ported by hand to
 * docs/js/scripts.js, using FFDec's decompiled ActionScript as the reference.
 *
 * Output, for each movie (perhect, help, tip):
 *  - docs/data/<movie>.json   the movie: timelines and symbols
 *  - docs/assets/images/       the scanned papers (JPEG, as in the SWF)
 *  - docs/assets/fonts/        the handwriting fonts (WOFF)
 * and docs/data/tips.txt, the tips of the day (from lib/tips.txt)
 *
 * Usage: node _scripts/extract.js --ffdec /path/to/ffdec-cli.jar
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs');
const MOVIES = ['perhect', 'help', 'tip'];

const args = process.argv.slice(2);
const ffdecJar = args[args.indexOf('--ffdec') + 1];
if (!args.includes('--ffdec') || !ffdecJar || !fs.existsSync(ffdecJar)) {
    console.error('Usage: node _scripts/extract.js --ffdec /path/to/ffdec-cli.jar');
    process.exit(1);
}

/**
 * Bit and byte reader for SWF data (little endian bytes, big endian bits)
 */
class Reader {
    constructor(buf, pos = 0, end = buf.length) {
        this.buf = buf;
        this.pos = pos;
        this.end = end;
        this.bitPos = 0;
    }
    align() {
        if (this.bitPos) {
            this.bitPos = 0;
            this.pos++;
        }
    }
    u8() { this.align(); return this.buf[this.pos++]; }
    u16() { this.align(); const v = this.buf.readUInt16LE(this.pos); this.pos += 2; return v; }
    s16() { this.align(); const v = this.buf.readInt16LE(this.pos); this.pos += 2; return v; }
    u32() { this.align(); const v = this.buf.readUInt32LE(this.pos); this.pos += 4; return v; }
    bytes(n) { this.align(); const v = this.buf.subarray(this.pos, this.pos + n); this.pos += n; return v; }
    string() {
        this.align();
        const end = this.buf.indexOf(0, this.pos);
        /* Flash 4 strings are in the system code page */
        const s = this.buf.subarray(this.pos, end).toString('latin1');
        this.pos = end + 1;
        return s;
    }
    ub(n) {
        let v = 0;
        for (let i = 0; i < n; i++) {
            const bit = (this.buf[this.pos] >> (7 - this.bitPos)) & 1;
            v = (v << 1) | bit;
            if (++this.bitPos === 8) {
                this.bitPos = 0;
                this.pos++;
            }
        }
        return v >>> 0;
    }
    sb(n) {
        if (!n) return 0;
        const v = this.ub(n);
        return v & (1 << (n - 1)) ? v - (1 << n) : v;
    }
    /* fixed 16.16 */
    fb(n) { return this.sb(n) / 65536; }
    rect() {
        this.align();
        const n = this.ub(5);
        const r = [this.sb(n), this.sb(n), this.sb(n), this.sb(n)].map(v => v / 20);
        this.align();
        return { x: r[0], y: r[2], w: r[1] - r[0], h: r[3] - r[2] };
    }
    /* [a, b, c, d, tx, ty] as for an SVG matrix, translation in pixels */
    matrix() {
        this.align();
        let a = 1, b = 0, c = 0, d = 1;
        if (this.ub(1)) {
            const n = this.ub(5);
            a = this.fb(n);
            d = this.fb(n);
        }
        if (this.ub(1)) {
            const n = this.ub(5);
            b = this.fb(n);
            c = this.fb(n);
        }
        const n = this.ub(5);
        const tx = this.sb(n) / 20;
        const ty = this.sb(n) / 20;
        this.align();
        return [round(a), round(b), round(c), round(d), round(tx), round(ty)];
    }
    /* colour transform: [rMult, gMult, bMult, aMult, rAdd, gAdd, bAdd, aAdd], multipliers 0-1 */
    cxform(alpha) {
        this.align();
        const hasAdd = this.ub(1);
        const hasMult = this.ub(1);
        const n = this.ub(4);
        const cx = [1, 1, 1, 1, 0, 0, 0, 0];
        if (hasMult) {
            for (let i = 0; i < (alpha ? 4 : 3); i++) cx[i] = round(this.sb(n) / 256);
        }
        if (hasAdd) {
            for (let i = 0; i < (alpha ? 4 : 3); i++) cx[4 + i] = this.sb(n);
        }
        this.align();
        return cx;
    }
    rgb() { return '#' + [this.u8(), this.u8(), this.u8()].map(v => v.toString(16).padStart(2, '0')).join(''); }
}

const round = v => Math.round(v * 10000) / 10000;

/* tags in a block of SWF data */
function* tags(buf, pos, end) {
    const r = new Reader(buf, pos, end);
    while (r.pos < end) {
        const h = r.u16();
        const code = h >> 6;
        let len = h & 63;
        if (len === 63) len = r.u32();
        const start = r.pos;
        r.pos += len;
        yield { code, start, len };
        if (code === 0) break;
    }
}

/**
 * Button condition flags (DefineButton2), as the event names used in the port
 */
const BUTTON_EVENTS = [
    [0x0001, 'rollOver'], [0x0002, 'rollOut'], [0x0004, 'press'], [0x0008, 'release'],
    [0x0010, 'dragOut'], [0x0020, 'dragOver'], [0x0040, 'releaseOutside'],
    [0x0080, 'dragOver'], [0x0100, 'dragOut'],
];

function readMovie(name, ffdecDir) {
    const swf = fs.readFileSync(path.join(ROOT, name + '.swf'));
    if (swf.toString('latin1', 0, 3) !== 'FWS') throw new Error(`${name}.swf: only uncompressed SWF files are supported`);
    const r = new Reader(swf, 8);
    const stage = r.rect();
    const fps = r.u16() / 256;
    const frameCount = r.u16();
    const movie = { width: stage.w, height: stage.h, fps, frameCount, background: '#ffffff', root: null, symbols: {} };
    const symbols = movie.symbols;
    const fonts = {};
    const images = {};
    const warnings = [];

    /* a timeline (the movie or a sprite): one entry per frame, each a list of display list changes */
    function timeline(pos, end) {
        const frames = [];
        let frame = { ops: [] };
        for (const t of tags(swf, pos, end)) {
            const r = new Reader(swf, t.start, t.start + t.len);
            switch (t.code) {
                case 1: /* ShowFrame */
                    frames.push(frame);
                    frame = { ops: [] };
                    break;
                case 43: /* FrameLabel */
                    frame.label = r.string();
                    break;
                case 12: /* DoAction */
                    frame.scripts = (frame.scripts || 0) + 1;
                    break;
                case 26: { /* PlaceObject2 */
                    const flags = r.u8();
                    const op = { op: 'place', depth: r.u16() };
                    if (flags & 0x01) op.move = true;
                    if (flags & 0x02) op.char = r.u16();
                    if (flags & 0x04) op.matrix = r.matrix();
                    if (flags & 0x08) op.cx = r.cxform(true);
                    if (flags & 0x10) op.ratio = r.u16();
                    if (flags & 0x20) op.name = r.string();
                    if (flags & 0x40) op.clipDepth = r.u16();
                    frame.ops.push(op);
                    break;
                }
                case 4: { /* PlaceObject */
                    const op = { op: 'place', char: r.u16(), depth: r.u16(), matrix: r.matrix() };
                    if (r.pos < r.end) op.cx = r.cxform(false);
                    frame.ops.push(op);
                    break;
                }
                case 28: /* RemoveObject2 */
                    frame.ops.push({ op: 'remove', depth: r.u16() });
                    break;
                case 5: /* RemoveObject */
                    r.u16();
                    frame.ops.push({ op: 'remove', depth: r.u16() });
                    break;
                case 9: /* SetBackgroundColor */
                    movie.background = r.rgb();
                    break;
                default:
                    if (!timeline.ignored.has(t.code)) {
                        defineSymbol(t, r);
                    }
            }
        }
        return frames.map(f => {
            if (!f.ops.length) delete f.ops;
            return f;
        });
    }
    timeline.ignored = new Set([0, 24, 8]);

    function defineSymbol(t, r) {
        switch (t.code) {
            case 2: case 22: case 32: { /* DefineShape, 2, 3 */
                const id = r.u16();
                symbols[id] = { type: 'shape', bounds: r.rect() };
                break;
            }
            case 21: { /* DefineBitsJPEG2 */
                const id = r.u16();
                let data = r.bytes(t.len - 2);
                /* Flash 4 JPEGs have their tables and image as separate streams: join them by dropping the EOI/SOI pair between */
                const join = data.indexOf(Buffer.from([0xff, 0xd9, 0xff, 0xd8]));
                if (join !== -1) data = Buffer.concat([data.subarray(0, join), data.subarray(join + 4)]);
                images[id] = data;
                symbols[id] = { type: 'image', file: `assets/images/${name}-${id}.jpg`, ...jpegSize(data) };
                break;
            }
            case 10: { /* DefineFont: glyphs only, the character codes come from DefineFontInfo */
                const id = r.u16();
                fonts[id] = { id, codes: [] };
                break;
            }
            case 13: { /* DefineFontInfo */
                const id = r.u16();
                const nameLen = r.u8();
                const fontName = r.bytes(nameLen).toString('latin1');
                const flags = r.u8();
                const codes = [];
                while (r.pos < r.end) codes.push(flags & 1 ? r.u16() : r.u8());
                Object.assign(fonts[id], { name: fontName, codes });
                break;
            }
            case 48: { /* DefineFont2 */
                const id = r.u16();
                const flags = r.u8();
                r.u8();
                const fontName = r.bytes(r.u8()).toString('latin1');
                const count = r.u16();
                const wideOffsets = flags & 0x08;
                const offsetsStart = r.pos;
                const offsets = [];
                for (let i = 0; i <= count; i++) offsets.push(wideOffsets ? r.u32() : r.u16());
                r.pos = offsetsStart + offsets[count];
                const codes = [];
                for (let i = 0; i < count; i++) codes.push(flags & 0x04 ? r.u16() : r.u8());
                const font = { id, name: fontName, codes };
                if (flags & 0x80) {
                    /* layout, in 1024ths of the font size */
                    font.ascent = r.u16();
                    font.descent = r.u16();
                    font.leading = r.s16();
                }
                fonts[id] = font;
                break;
            }
            case 11: case 33: /* DefineText, DefineText2 */
                defineText(t.code === 33, r);
                break;
            case 37: /* DefineEditText */
                defineEditText(r);
                break;
            case 34: /* DefineButton2 */
                defineButton(r, t);
                break;
            case 39: { /* DefineSprite */
                const id = r.u16();
                r.u16();
                symbols[id] = { type: 'sprite', frames: timeline(r.pos, t.start + t.len) };
                break;
            }
            default:
                warnings.push(`unhandled tag ${t.code}`);
        }
    }

    function defineText(alpha, r) {
        const id = r.u16();
        const bounds = r.rect();
        const matrix = r.matrix();
        const glyphBits = r.u8();
        const advanceBits = r.u8();
        const runs = [];
        let font, size, color = '#000000', x = 0, y = 0;
        for (;;) {
            const flags = r.u8();
            if (!flags) break;
            if (flags & 0x08) font = r.u16();
            if (flags & 0x04) {
                color = r.rgb();
                if (alpha) r.u8();
            }
            if (flags & 0x01) x = r.s16() / 20;
            if (flags & 0x02) y = r.s16() / 20;
            if (flags & 0x08) size = r.u16() / 20;
            const count = r.u8();
            const xs = [];
            let text = '';
            for (let i = 0; i < count; i++) {
                const glyph = r.ub(glyphBits);
                const advance = r.sb(advanceBits) / 20;
                text += String.fromCharCode(fonts[font].codes[glyph]);
                xs.push(round(x));
                x += advance;
            }
            r.align();
            runs.push({ font, size, color, y: round(y), x: xs, text });
        }
        symbols[id] = { type: 'text', bounds, matrix, runs };
    }

    function defineEditText(r) {
        const id = r.u16();
        const bounds = r.rect();
        const f1 = r.u8();
        const f2 = r.u8();
        const field = {
            type: 'edittext',
            bounds,
            wordWrap: !!(f1 & 0x40),
            multiline: !!(f1 & 0x20),
            password: !!(f1 & 0x10),
            readOnly: !!(f1 & 0x08),
            noSelect: !!(f2 & 0x10),
            border: !!(f2 & 0x08),
            html: !!(f2 & 0x02),
            useOutlines: !!(f2 & 0x01),
        };
        if (f1 & 0x01) {
            field.font = r.u16();
            field.size = r.u16() / 20;
        }
        if (f1 & 0x04) {
            field.color = r.rgb();
            field.alpha = r.u8() / 255;
        }
        if (f1 & 0x02) field.maxLength = r.u16();
        if (f2 & 0x20) {
            field.align = ['left', 'right', 'center', 'justify'][r.u8()];
            field.leftMargin = r.u16() / 20;
            field.rightMargin = r.u16() / 20;
            field.indent = r.u16() / 20;
            field.leading = r.s16() / 20;
        }
        field.variable = r.string();
        if (f1 & 0x80) field.text = r.string();
        symbols[id] = field;
    }

    function defineButton(r, t) {
        const id = r.u16();
        const trackAsMenu = !!(r.u8() & 1);
        const actionOffset = r.u16();
        const actionsStart = actionOffset ? r.pos - 2 + actionOffset : t.start + t.len;
        const records = [];
        while (r.pos < actionsStart) {
            const flags = r.u8();
            if (!flags) break;
            const rec = {
                states: (flags & 1 ? 'u' : '') + (flags & 2 ? 'o' : '') + (flags & 4 ? 'd' : '') + (flags & 8 ? 'h' : ''),
                char: r.u16(),
                depth: r.u16(),
                matrix: r.matrix(),
            };
            const cx = r.cxform(true);
            if (cx.some((v, i) => v !== (i < 4 ? 1 : 0))) rec.cx = cx;
            records.push(rec);
        }
        /* the conditions each action runs on, in order: the port's scripts are matched to these */
        const actions = [];
        if (actionOffset) {
            let pos = actionsStart;
            for (;;) {
                const next = swf.readUInt16LE(pos);
                const cond = swf.readUInt16LE(pos + 2);
                const events = BUTTON_EVENTS.filter(([bit]) => cond & bit).map(([, ev]) => ev);
                const key = cond >> 9;
                if (key) events.push('key:' + key);
                actions.push([...new Set(events)]);
                if (!next) break;
                pos += next;
            }
        }
        symbols[id] = { type: 'button', trackAsMenu, records, actions };
    }

    const root = timeline(r.pos, swf.length);
    movie.root = { type: 'sprite', frames: root };

    /* fonts: the WOFF files exported by FFDec, with the metrics from the SWF */
    const fontDir = path.join(ffdecDir, 'fonts');
    const fontFiles = fs.existsSync(fontDir) ? fs.readdirSync(fontDir) : [];
    Object.values(fonts).forEach(font => {
        const file = fontFiles.find(f => f.startsWith(font.id + '_'));
        if (!file) {
            warnings.push(`no exported font for font ${font.id}`);
            return;
        }
        const out = `assets/fonts/${name}-${font.id}.woff`;
        fs.copyFileSync(path.join(fontDir, file), path.join(OUT, out));
        symbols[font.id] = {
            type: 'font',
            name: font.name,
            family: `${name}-${font.id}`,
            file: out,
            ascent: font.ascent,
            descent: font.descent,
            leading: font.leading,
            /* the characters the font has: Flash didn't draw the others */
            chars: String.fromCharCode(...font.codes),
        };
    });

    /* images */
    Object.entries(images).forEach(([id, data]) => fs.writeFileSync(path.join(OUT, symbols[id].file), data));

    /* shapes: the SVG exported by FFDec, with its own coordinates kept and images linked rather than embedded */
    Object.entries(symbols).filter(([, s]) => s.type === 'shape').forEach(([id, shape]) => {
        const file = path.join(ffdecDir, 'shapes', id + '.svg');
        if (!fs.existsSync(file)) {
            warnings.push(`no exported SVG for shape ${id}`);
            return;
        }
        shape.svg = shapeSvg(fs.readFileSync(file, 'utf8'), id, images, symbols, warnings);
    });

    return { movie, warnings };
}

/* the size of a JPEG, from its start of frame marker */
function jpegSize(data) {
    let i = 2;
    while (i < data.length) {
        if (data[i] !== 0xff) {
            i++;
            continue;
        }
        const marker = data[i + 1];
        if (marker >= 0xc0 && marker <= 0xc3) return { height: data.readUInt16BE(i + 5), width: data.readUInt16BE(i + 7) };
        if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
            i += 2;
            continue;
        }
        i += 2 + data.readUInt16BE(i + 2);
    }
    return {};
}

/**
 * FFDec draws each shape inside <g transform="translate(-x, -y)"> so it starts
 * at 0,0: dropping that group keeps the shape's own coordinates, as placed in
 * the timeline. Ids are made unique to the shape, and embedded bitmaps (PNG
 * copies of the JPEGs) are swapped for links to the JPEGs, matched by size.
 */
function shapeSvg(svg, id, images, symbols, warnings) {
    const open = svg.match(/<g transform="matrix\(1\.0, 0\.0, 0\.0, 1\.0, [-\d.]+, [-\d.]+\)">/);
    if (!open) {
        warnings.push(`shape ${id}: unexpected SVG`);
        return '';
    }
    let inner = svg.slice(open.index + open[0].length, svg.lastIndexOf('</g>')).trim();
    inner = inner.replace(/\bid="([^"]+)"/g, `id="s${id}-$1"`).replace(/url\(#([^)]+)\)/g, `url(#s${id}-$1)`);
    inner = inner.replace(/xlink:href="data:image\/png;base64,([^"]+)"/gi, (m, b64) => {
        const png = Buffer.from(b64, 'base64');
        const width = png.readUInt32BE(16);
        const height = png.readUInt32BE(20);
        const match = Object.keys(images).filter(k => symbols[k].width === width && symbols[k].height === height);
        if (match.length !== 1) {
            warnings.push(`shape ${id}: can't match a ${width}x${height} image`);
            return m;
        }
        return `href="${symbols[match[0]].file}"`;
    });
    return inner.replace(/\s*\n\s*/g, '');
}

/**
 * Run it
 */
fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'assets/images'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'assets/fonts'), { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wordperhect-'));
try {
    MOVIES.forEach(name => {
        const dir = path.join(tmp, name);
        execFileSync('java', ['-jar', ffdecJar, '-format', 'shape:svg', '-export', 'shape,font', dir, path.join(ROOT, name + '.swf')], { stdio: 'ignore' });
        const { movie, warnings } = readMovie(name, dir);
        fs.writeFileSync(path.join(OUT, 'data', name + '.json'), JSON.stringify(movie));
        const count = type => Object.values(movie.symbols).filter(s => s.type === type).length;
        console.log(`${name}: ${movie.width}x${movie.height} @ ${movie.fps}fps, ${movie.root.frames.length} frames, ` +
            ['shape', 'sprite', 'button', 'text', 'edittext', 'font', 'image'].map(t => `${count(t)} ${t}s`).join(', '));
        [...new Set(warnings)].forEach(w => console.warn('  ' + w));
    });
} finally {
    fs.rmSync(tmp, { recursive: true, force: true });
}
/* the tips of the day, which the server read from a file */
fs.copyFileSync(path.join(ROOT, 'lib/tips.txt'), path.join(OUT, 'data/tips.txt'));
