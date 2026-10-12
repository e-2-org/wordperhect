/**
 * A small Flash 4 style timeline runtime, drawing into SVG
 *
 * Plays the movies extracted from the original SWFs (port/data/*.json, made by
 * _scripts/extract.js): timelines of shapes, static text, text fields, buttons
 * and movie clips, at the movie's frame rate. It does no ActionScript: the
 * scripts were ported by hand (scripts.js) and are run by the runtime when a
 * frame is entered or a button event happens, with an API modelled on the
 * Flash 4 actions they used (Script, below).
 *
 * Flash 4 conventions kept here:
 *  - frames are numbered from 1
 *  - targets use slash syntax ("/paper/p1", "../thes", "_level99")
 *  - variables live on timelines ("/:pap", "../:m", "count")
 *  - names (of variables and instances) are not case sensitive
 *  - variables are strings: == compares numerically, add joins strings
 */
const SVG_NS = 'http://www.w3.org/2000/svg';
const XHTML_NS = 'http://www.w3.org/1999/xhtml';

const svg = (name, attrs = {}) => {
    const el = document.createElementNS(SVG_NS, name);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
};
const IDENTITY = [1, 0, 0, 1, 0, 0];
const multiply = (m, n) => [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/**
 * Flash 4 values: everything is a string, numbers are converted when needed
 */
const num = v => {
    if (typeof v === 'number') return v;
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
};
const str = v => (v === undefined || v === null ? '' : typeof v === 'number' ? String(Math.round(v * 1e9) / 1e9) : String(v));

/* Flash key codes for keys which aren't characters */
const KEY_CODES = {
    ArrowLeft: 1, ArrowRight: 2, Home: 3, End: 4, Insert: 5, Delete: 6, Backspace: 8, Enter: 13,
    ArrowUp: 14, ArrowDown: 15, PageUp: 16, PageDown: 17, Tab: 18, Escape: 19,
};

/**
 * Something on the display list: shape, text, text field, button or clip
 */
class DisplayObject {
    constructor(player, movie, id) {
        this.player = player;
        this.movie = movie;
        this.id = id;
        this.def = movie.symbols[id];
        this.parent = null;
        this.matrix = IDENTITY;
        this.cx = null;
        this.name = '';
        this.visible = true;
        /* set once a script moves, scales or rotates it: the timeline no longer does */
        this.scripted = false;
        /* <g> in its parent, carrying any mask; <g> inside it, carrying the transform */
        this.el = svg('g');
        this.inner = svg('g');
        this.el.appendChild(this.inner);
    }
    setMatrix(m) {
        this.matrix = m;
        this.inner.setAttribute('transform', `matrix(${m.join(' ')})`);
    }
    setColorTransform(cx) {
        this.cx = cx;
        this.inner.removeAttribute('opacity');
        this.inner.removeAttribute('filter');
        if (!cx) return;
        const [rm, gm, bm, am, ra, ga, ba, aa] = cx;
        if (rm === 1 && gm === 1 && bm === 1 && !ra && !ga && !ba && !aa) {
            this.inner.setAttribute('opacity', am);
        } else {
            this.inner.setAttribute('filter', `url(#${this.player.colorFilter(cx)})`);
        }
    }
    setVisible(v) {
        this.visible = v;
        this.el.style.display = v ? '' : 'none';
    }
    /* remove from the stage */
    destroy() {
        this.removed = true;
        this.el.remove();
    }
    /* bounds in its parent's coordinates */
    bounds() {
        let box;
        try {
            box = this.inner.getBBox();
        } catch (e) {
            return { x: this.matrix[4], y: this.matrix[5], w: 0, h: 0 };
        }
        const pts = [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]]
            .map(([x, y]) => apply(this.matrix, x, y));
        const xs = pts.map(p => p[0]);
        const ys = pts.map(p => p[1]);
        return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    }
    get level() {
        let o = this;
        while (o.parent) o = o.parent;
        return o;
    }
}

class Shape extends DisplayObject {
    constructor(player, movie, id) {
        super(player, movie, id);
        const use = svg('use', { href: '#' + player.define(movie, id) });
        this.inner.appendChild(use);
    }
}

/* static text, drawn in the movie's fonts glyph by glyph */
class Text extends DisplayObject {
    constructor(player, movie, id) {
        super(player, movie, id);
        const g = svg('g', { transform: `matrix(${this.def.matrix.join(' ')})` });
        this.def.runs.forEach(run => {
            const text = svg('text', {
                x: run.x.join(' '),
                y: run.y,
                'font-family': player.font(movie, run.font),
                'font-size': run.size,
                fill: run.color,
            });
            text.textContent = run.text;
            g.appendChild(text);
        });
        this.inner.appendChild(g);
    }
}

/**
 * Text field showing (and for input fields, setting) a variable
 */
class EditText extends DisplayObject {
    constructor(player, movie, id) {
        super(player, movie, id);
        const d = this.def;
        const b = d.bounds;
        const fo = svg('foreignObject', { x: b.x, y: b.y, width: b.w, height: b.h });
        const editable = !d.readOnly;
        const field = document.createElementNS(XHTML_NS, editable ? (d.multiline ? 'textarea' : 'input') : 'div');
        field.className = 'field';
        const font = d.font ? movie.symbols[d.font] : null;
        this.chars = font && font.chars ? new Set(font.chars) : null;
        const style = field.style;
        style.fontFamily = font ? `"${player.font(movie, d.font)}"` : 'serif';
        style.fontSize = (d.size || 12) + 'px';
        /*
         * Flash put the first line's baseline the font's ascent below a 2px
         * gutter, and the lines (ascent + descent + the field's leading) apart.
         * The font's ascent and descent are given to the browser (see font()),
         * so CSS spaces the lines the same; half the leading goes above the
         * first line in CSS, which the top margin takes back.
         */
        if (font && font.ascent !== undefined) {
            const leading = d.leading || 0;
            style.lineHeight = ((font.ascent + font.descent) / 1024 * d.size + leading) + 'px';
            style.marginTop = (-leading / 2) + 'px';
        }
        style.color = d.color || '#000';
        style.textAlign = d.align || 'left';
        style.whiteSpace = d.multiline ? (d.wordWrap ? 'pre-wrap' : 'pre') : 'pre';
        if (d.border) field.classList.add('border');
        if (d.noSelect) field.classList.add('noselect');
        if (editable) {
            if (d.maxLength) field.maxLength = d.maxLength;
            if (d.password) field.type = 'password';
            field.spellcheck = false;
            field.autocomplete = 'off';
            field.addEventListener('input', () => {
                this.value = field.value;
                player.setVar(this.parent, d.variable, field.value);
            });
            /* keys typed into a field are for the field, not for key buttons */
            field.addEventListener('keydown', e => e.stopPropagation());
        }
        fo.appendChild(field);
        this.inner.appendChild(fo);
        this.field = field;
        this.editable = editable;
        this.value = null;
        player.fields.add(this);
    }
    /* show the variable's current value */
    refresh() {
        if (!this.parent) return;
        let v = this.def.variable ? str(this.player.getVar(this.parent, this.def.variable)) : str(this.def.text);
        if (v === this.value) return;
        this.value = v;
        /* Flash uses \r for new lines */
        v = v.replace(/\r\n?/g, '\n');
        /* Flash didn't draw characters the field's font doesn't have, where a browser would use another font */
        if (this.chars && !this.editable) v = [...v].filter(c => c === '\n' || this.chars.has(c)).join('');
        if (this.editable) {
            if (this.field.value !== v) this.field.value = v;
        } else {
            this.field.textContent = v;
        }
    }
    destroy() {
        super.destroy();
        this.player.fields.delete(this);
    }
}

/**
 * Button: up, over and down states, a hit area, and events
 */
class Button extends DisplayObject {
    constructor(player, movie, id) {
        super(player, movie, id);
        this.state = null;
        this.content = svg('g', { class: 'button-state' });
        this.hit = svg('g', { class: 'button-hit' });
        this.inner.append(this.content, this.hit);
        this.objects = [];
        /* the ported scripts, by event: press, release, rollOver, key:65 etc. */
        this.handlers = player.scripts.button(movie, id);
        const events = new Set(this.def.actions.flat());
        events.forEach(e => {
            if (!this.handlers[e]) console.warn(`${movie.name} button ${id}: no script for ${e}`);
        });
        /* buttons with only key presses are invisible key catchers */
        if ([...events].some(e => !e.startsWith('key:'))) {
            this.hit.classList.add('active');
        }
        this.def.records.filter(r => r.states.includes('h')).forEach(r => {
            const o = player.create(movie, r.char);
            o.setMatrix(r.matrix);
            o.inner.querySelectorAll('*').forEach(el => el.removeAttribute('filter'));
            this.hit.appendChild(o.el);
        });
        this.hit.button = this;
        this.setState('u');
        player.buttons.add(this);
    }
    setState(state) {
        if (state === this.state) return;
        this.state = state;
        this.objects.forEach(o => o.destroy());
        this.objects = [];
        this.def.records.filter(r => r.states.includes(state)).sort((a, b) => a.depth - b.depth).forEach(r => {
            const o = this.player.create(this.movie, r.char);
            o.parent = this.parent;
            o.setMatrix(r.matrix);
            if (r.cx) o.setColorTransform(r.cx);
            this.content.appendChild(o.el);
            this.objects.push(o);
            if (o instanceof Clip) o.start();
        });
    }
    /* the clips in the button's current state play like the clip the button is in */
    advance() {
        this.objects.forEach(o => o instanceof Clip && o.advance());
    }
    fire(event) {
        const fn = this.handlers[event];
        if (!fn) return false;
        this.player.run(this.parent, fn, `${this.movie.name} button ${this.id} ${event}`);
        return true;
    }
    destroy() {
        this.objects.forEach(o => o.destroy());
        super.destroy();
        this.player.buttons.delete(this);
        this.player.pointer.removed(this);
    }
}

/**
 * Movie clip: a timeline with its own display list and variables
 */
class Clip extends DisplayObject {
    constructor(player, movie, id, def) {
        super(player, movie, id);
        if (def) this.def = def;
        this.frames = this.def.frames;
        this.frame = 0;
        this.playing = true;
        this.children = new Map();
        this.vars = {};
        this.labels = {};
        this.frames.forEach((f, i) => {
            if (f.label) this.labels[f.label.toLowerCase()] = i + 1;
        });
        this.dragging = false;
    }
    /* enter frame 1: called once the clip is in place */
    start() {
        this.goto(1, true);
    }
    get totalFrames() {
        return this.frames.length;
    }
    frameNumber(frame) {
        if (typeof frame === 'string' && isNaN(frame)) return this.labels[frame.toLowerCase()] || 0;
        return Math.floor(num(frame));
    }
    /*
     * Move the playhead and queue the frame's scripts. Playing on applies the
     * next frame's changes; a jump goes straight to the display list of the
     * frame it jumps to, so what was placed and removed in between never appears.
     */
    goto(frame, force = false) {
        frame = Math.max(1, Math.min(frame, this.frames.length));
        if (frame === this.frame && !force) return;
        if (frame === this.frame + 1) {
            this.applyFrame(frame);
        } else {
            this.rebuild(frame);
        }
        this.frame = frame;
        if (this.frames[frame - 1].scripts) this.player.queue(this, frame);
        this.layout();
    }
    /* apply one frame's display list changes, after the frame before */
    applyFrame(f) {
        (this.frames[f - 1].ops || []).forEach(op => {
            if (op.op === 'remove') {
                this.removeChild(op.depth);
                return;
            }
            let o = this.children.get(op.depth);
            if (!op.move || (op.char !== undefined && (!o || o.id !== op.char))) {
                /* a new object, or a different character at the same depth */
                const prev = o;
                if (prev) this.removeChild(op.depth);
                o = this.player.create(this.movie, op.char);
                o.depth = op.depth;
                o.placed = f;
                o.parent = this;
                o.setMatrix(op.matrix || (prev && op.move ? prev.matrix : IDENTITY));
                if (op.cx) o.setColorTransform(op.cx);
                o.name = op.name || (prev && op.move ? prev.name : '');
                o.clipDepth = op.clipDepth || 0;
                this.children.set(op.depth, o);
                this.insert(o);
                if (o instanceof Clip) o.start();
            } else if (o) {
                if (op.matrix && !o.scripted) o.setMatrix(op.matrix);
                if (op.cx) o.setColorTransform(op.cx);
                if (op.name) o.name = op.name;
            }
        });
    }
    /*
     * Work out the display list at a frame from the start, keeping the
     * objects already on stage that were placed by the same frame
     */
    rebuild(frame) {
        const want = new Map();
        for (let f = 1; f <= frame; f++) {
            (this.frames[f - 1].ops || []).forEach(op => {
                if (op.op === 'remove') {
                    want.delete(op.depth);
                    return;
                }
                const prev = want.get(op.depth);
                if (!op.move || (op.char !== undefined && (!prev || prev.char !== op.char))) {
                    want.set(op.depth, {
                        char: op.char,
                        placed: f,
                        matrix: op.matrix || (prev && op.move ? prev.matrix : IDENTITY),
                        cx: op.cx || null,
                        name: op.name || (prev && op.move ? prev.name : ''),
                        clipDepth: op.clipDepth || 0,
                    });
                } else if (prev) {
                    if (op.matrix) prev.matrix = op.matrix;
                    if (op.cx) prev.cx = op.cx;
                    if (op.name) prev.name = op.name;
                }
            });
        }
        [...this.children].forEach(([depth, o]) => {
            const w = want.get(depth);
            if (!w || w.char !== o.id || w.placed !== o.placed) this.removeChild(depth);
        });
        want.forEach((w, depth) => {
            let o = this.children.get(depth);
            if (o) {
                if (!o.scripted) o.setMatrix(w.matrix);
                o.setColorTransform(w.cx);
                return;
            }
            o = this.player.create(this.movie, w.char);
            Object.assign(o, { depth, placed: w.placed, parent: this, name: w.name, clipDepth: w.clipDepth });
            o.setMatrix(w.matrix);
            if (w.cx) o.setColorTransform(w.cx);
            this.children.set(depth, o);
            this.insert(o);
            if (o instanceof Clip) o.start();
        });
    }
    /* put a child's element in depth order */
    insert(o) {
        const after = [...this.children.values()].filter(c => c.depth > o.depth && c.el.parentNode === this.inner)
            .sort((a, b) => a.depth - b.depth)[0];
        this.inner.insertBefore(o.el, after ? after.el : null);
    }
    removeChild(depth) {
        const o = this.children.get(depth);
        if (!o) return;
        o.destroy();
        this.children.delete(depth);
    }
    destroy() {
        this.children.forEach(o => o.destroy());
        this.children.clear();
        super.destroy();
        this.player.clips.delete(this);
    }
    /* masks: a shape with a clip depth masks the depths above it, up to the clip depth */
    layout() {
        const masks = [...this.children.values()].filter(o => o.clipDepth);
        this.children.forEach(o => {
            const mask = masks.find(m => o.depth > m.depth && o.depth <= m.clipDepth);
            if (mask) {
                o.el.setAttribute('clip-path', `url(#${this.player.clipPath(mask)})`);
            } else {
                o.el.removeAttribute('clip-path');
            }
        });
        masks.forEach(m => m.el.style.display = 'none');
    }
    /* one tick: play, then let the clips inside play */
    advance() {
        if (this.playing && this.frames.length > 1) {
            this.goto(this.frame === this.frames.length ? 1 : this.frame + 1);
        }
        [...this.children.values()].forEach(o => {
            if (o.parent === this && (o instanceof Clip || o instanceof Button)) o.advance();
        });
    }
    child(name) {
        name = name.toLowerCase();
        return [...this.children.values()].find(o => o.name && o.name.toLowerCase() === name && o instanceof Clip) || null;
    }
    /* the clip's path, as Flash 4's _target */
    get target() {
        if (!this.parent) return this.levelNumber ? `_level${this.levelNumber}` : '/';
        const parentPath = this.parent.target;
        return (parentPath === '/' ? '' : parentPath) + '/' + this.name;
    }
    getVar(name) {
        return this.vars[name.toLowerCase()];
    }
    setVar(name, value) {
        this.vars[name.toLowerCase()] = value;
    }
}

/**
 * The scripts' view of a timeline: Flash 4 actions as methods
 *
 * Paths are relative to the timeline the script is in, or the one it has been
 * told to target (tellTarget). Values follow Flash 4: strings, with numeric
 * comparison.
 */
class Script {
    /**
     * @param {Player} player
     * @param {Clip} base the timeline the script is in
     * @param {Clip} clip the timeline it acts on (the same, unless in a tellTarget)
     */
    constructor(player, base, clip = base) {
        this.player = player;
        this.base = base;
        this.clip = clip;
    }
    /* variables */
    get(path) {
        return this.player.getVar(this.clip, path);
    }
    set(path, value) {
        this.player.setVar(this.clip, path, value);
    }
    /* timeline */
    gotoAndStop(frame) {
        if (!this.clip) return;
        this.clip.playing = false;
        const f = this.clip.frameNumber(frame);
        if (f) this.clip.goto(f);
    }
    gotoAndPlay(frame) {
        if (!this.clip) return;
        this.clip.playing = true;
        const f = this.clip.frameNumber(frame);
        if (f) this.clip.goto(f);
    }
    play() {
        if (this.clip) this.clip.playing = true;
    }
    stop() {
        if (this.clip) this.clip.playing = false;
    }
    nextFrame() {
        if (!this.clip) return;
        this.clip.playing = false;
        this.clip.goto(this.clip.frame + 1);
    }
    prevFrame() {
        if (!this.clip) return;
        this.clip.playing = false;
        this.clip.goto(this.clip.frame - 1);
    }
    /* run the actions in another timeline (tellTarget): as in Flash 4, the path is from the timeline the script is in */
    tell(path, fn) {
        fn(new Script(this.player, this.base, this.player.resolve(this.base, path)));
    }
    /* run a frame's script, leaving the playhead where it is */
    call(path) {
        let target = this.clip;
        let frame = path;
        const colon = path.lastIndexOf(':');
        if (colon !== -1) {
            target = this.player.resolve(this.clip, path.slice(0, colon));
            frame = path.slice(colon + 1);
        }
        if (!target) return;
        const f = target.frameNumber(frame);
        if (f) this.player.runFrame(target, f);
    }
    get target() {
        return this.clip ? this.clip.target : '';
    }
    /* properties */
    getProperty(path, prop) {
        const o = this.player.resolve(this.clip, path);
        return o ? this.player.getProperty(o, prop) : '';
    }
    setProperty(path, prop, value) {
        const o = this.player.resolve(this.clip, path);
        if (o) this.player.setProperty(o, prop, value);
    }
    duplicateMovieClip(path, name, depth) {
        const o = this.player.resolve(this.clip, path);
        if (!o || !o.parent) return;
        const parent = o.parent;
        depth = num(depth);
        parent.removeChild(depth);
        const copy = this.player.create(o.movie, o.id);
        Object.assign(copy, { depth, placed: 0, parent, name: str(name), clipDepth: 0 });
        copy.setMatrix(o.matrix);
        copy.setColorTransform(o.cx);
        parent.children.set(depth, copy);
        parent.insert(copy);
        copy.start();
    }
    startDrag(path, lockCenter, left, top, right, bottom) {
        const o = path ? this.player.resolve(this.clip, path) : this.clip;
        if (o) this.player.startDrag(o, num(lockCenter), left === undefined ? null : [left, top, right, bottom].map(num));
    }
    stopDrag() {
        this.player.stopDrag();
    }
    /* movies, variables and the world outside */
    loadMovieNum(url, level) {
        this.player.loadMovie(url, num(level));
    }
    unloadMovieNum(level) {
        this.player.unloadMovie(num(level));
    }
    /* the timeline's variables are sent, and the answer loaded into the target */
    loadVariables(url, path, method) {
        const target = path === undefined || path === '' ? this.clip : this.player.resolve(this.clip, path);
        this.player.loadVariables(url, this.clip, target, method);
    }
    loadVariablesNum(url, level, method) {
        this.player.loadVariables(url, this.clip, this.player.levels.get(num(level)), method);
    }
    getURL(url, window) {
        this.player.getURL(url, window);
    }
    fscommand(command, args) {
        this.player.fscommand(command, args);
    }
    print(path) {
        const o = this.player.resolve(this.clip, path);
        if (o) this.player.print(o);
    }
    /* Flash 4 functions */
    eq(a, b) {
        return num(a) === num(b);
    }
    lt(a, b) {
        return num(a) < num(b);
    }
    add(a, b) {
        return num(a) + num(b);
    }
    random(n) {
        return Math.floor(Math.random() * num(n));
    }
    int(v) {
        return Math.trunc(num(v));
    }
    length(s) {
        return str(s).length;
    }
    /* 1-based, as Flash 4's substring */
    substring(s, index, count) {
        s = str(s);
        index = Math.max(1, num(index));
        count = num(count);
        return count < 0 ? s.slice(index - 1) : s.slice(index - 1, index - 1 + count);
    }
}

/**
 * Pointer: hover, press and release for buttons
 *
 * As in Flash, which button the pointer is over is only worked out when the
 * pointer moves or is pressed, not when buttons appear or vanish under it.
 */
class Pointer {
    constructor(player) {
        this.player = player;
        this.over = null;
        this.pressed = null;
        window.addEventListener('pointermove', e => this.move(e));
        window.addEventListener('pointerdown', e => {
            if (e.button !== 0) return;
            this.move(e);
            if (this.over) this.down(this.over, e);
        });
        window.addEventListener('pointerup', e => this.up(e));
        window.addEventListener('pointercancel', e => this.up(e));
    }
    /* the topmost button under the pointer */
    hit(e) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const hit = el && el.closest && el.closest('.button-hit.active');
        return hit ? hit.button : null;
    }
    move(e) {
        const button = this.hit(e);
        if (button === this.over) return;
        if (this.over) this.leave(this.over);
        if (button) this.enter(button);
    }
    enter(button) {
        this.over = button;
        if (this.pressed === button) {
            button.setState('d');
            this.player.event(button, 'dragOver');
        } else if (!this.pressed) {
            button.setState('o');
            this.player.event(button, 'rollOver');
        }
    }
    leave(button) {
        if (this.over === button) this.over = null;
        if (this.pressed === button) {
            button.setState('o');
            this.player.event(button, 'dragOut');
        } else if (!this.pressed) {
            button.setState('u');
            this.player.event(button, 'rollOut');
        }
    }
    down(button, e) {
        e.preventDefault();
        this.pressed = button;
        this.over = button;
        button.setState('d');
        this.player.event(button, 'press');
    }
    up() {
        const button = this.pressed;
        if (!button) return;
        this.pressed = null;
        if (this.over === button) {
            button.setState('o');
            this.player.event(button, 'release');
        } else {
            button.setState('u');
            this.player.event(button, 'releaseOutside');
        }
    }
    removed(button) {
        if (this.over === button) this.over = null;
        if (this.pressed === button) this.pressed = null;
    }
}

/**
 * The player: levels, the frame loop, and everything the scripts reach
 */
class Player {
    /**
     * @param {Element} container where the stage goes
     * @param {object} options
     *  - movies: { name: movie data }, the first is level 0
     *  - scripts: the ported scripts (scripts.js)
     *  - server: replaces the original's server scripts (storage.js)
     */
    constructor(container, { movies, scripts, server }) {
        this.movies = movies;
        this.scripts = scripts;
        this.server = server;
        const main = Object.values(movies)[0];
        this.width = main.width;
        this.height = main.height;
        this.stage = svg('svg', { viewBox: `0 0 ${main.width} ${main.height}`, class: 'stage' });
        this.defs = svg('defs');
        this.stage.appendChild(this.defs);
        const bg = svg('rect', { width: main.width, height: main.height, fill: main.background });
        this.stage.appendChild(bg);
        container.appendChild(this.stage);
        this.defined = new Set();
        this.fonts = new Set();
        this.filters = new Map();
        this.levels = new Map();
        this.clips = new Set();
        this.buttons = new Set();
        this.fields = new Set();
        this.actions = [];
        this.pointer = new Pointer(this);
        this.drag = null;
        this.uid = 0;
        window.addEventListener('keydown', e => this.key(e));
        window.addEventListener('pointermove', e => this.dragMove(e));
        this.loadMovie(Object.keys(movies)[0], 0);
        this.render();
        this.timer = setInterval(() => this.tick(), 1000 / main.fps);
    }
    /* create a display object for a character */
    create(movie, id) {
        const def = movie.symbols[id];
        if (!def) throw new Error(`no character ${id}`);
        switch (def.type) {
            case 'shape': return new Shape(this, movie, id);
            case 'text': return new Text(this, movie, id);
            case 'edittext': return new EditText(this, movie, id);
            case 'button': return new Button(this, movie, id);
            case 'sprite': {
                const clip = new Clip(this, movie, id);
                this.clips.add(clip);
                return clip;
            }
            default: throw new Error(`can't place a ${def.type}`);
        }
    }
    /* shapes go in <defs> the first time they are used */
    define(movie, id) {
        const ref = `${movie.name}-${id}`;
        if (!this.defined.has(ref)) {
            const g = svg('g', { id: ref });
            g.innerHTML = movie.symbols[id].svg;
            this.defs.appendChild(g);
            this.defined.add(ref);
        }
        return ref;
    }
    /* fonts are loaded the first time they are used */
    font(movie, id) {
        const def = movie.symbols[id];
        if (!this.fonts.has(def.family)) {
            /* the SWF's own metrics, so text fields space their lines as Flash did */
            const metrics = def.ascent === undefined ? {} : {
                ascentOverride: (def.ascent / 1024 * 100) + '%',
                descentOverride: (def.descent / 1024 * 100) + '%',
                lineGapOverride: '0%',
            };
            const face = new FontFace(def.family, `url(${def.file})`, metrics);
            document.fonts.add(face);
            face.load();
            this.fonts.add(def.family);
        }
        return def.family;
    }
    colorFilter(cx) {
        const key = cx.join(',');
        if (!this.filters.has(key)) {
            const id = 'cx' + this.filters.size;
            const [rm, gm, bm, am, ra, ga, ba, aa] = cx;
            const f = svg('filter', { id, 'color-interpolation-filters': 'sRGB' });
            f.appendChild(svg('feColorMatrix', {
                type: 'matrix',
                values: `${rm} 0 0 0 ${ra / 255} 0 ${gm} 0 0 ${ga / 255} 0 0 ${bm} 0 ${ba / 255} 0 0 0 ${am} ${aa / 255}`,
            }));
            this.defs.appendChild(f);
            this.filters.set(key, id);
        }
        return this.filters.get(key);
    }
    clipPath(mask) {
        if (!mask.clipId) {
            mask.clipId = 'mask' + (++this.uid);
            const cp = svg('clipPath', { id: mask.clipId });
            /* a clip path can only hold shapes, so the mask's paths are copied in */
            const g = svg('g');
            g.innerHTML = mask.def.svg || '';
            g.querySelectorAll('path').forEach(path => {
                path.setAttribute('transform', `matrix(${mask.matrix.join(' ')})`);
                cp.appendChild(path);
            });
            this.defs.appendChild(cp);
        }
        return mask.clipId;
    }

    /**
     * Levels: movies loaded on top of each other (loadMovieNum)
     */
    loadMovie(url, level) {
        const name = url.replace(/\.swf$/i, '');
        const movie = this.movies[name];
        if (!movie) return;
        movie.name = name;
        this.unloadMovie(level);
        const root = new Clip(this, movie, 'root', movie.root);
        root.levelNumber = level;
        this.clips.add(root);
        this.levels.set(level, root);
        const after = [...this.levels].filter(([n]) => n > level).sort((a, b) => a[0] - b[0])[0];
        this.stage.insertBefore(root.el, after ? after[1].el : null);
        root.start();
        this.runActions();
    }
    unloadMovie(level) {
        const root = this.levels.get(level);
        if (!root) return;
        root.destroy();
        this.levels.delete(level);
    }

    /**
     * The frame loop
     */
    tick() {
        [...this.levels.keys()].sort((a, b) => a - b).forEach(n => {
            const root = this.levels.get(n);
            if (root) root.advance();
        });
        this.runActions();
        this.render();
    }
    /* frame scripts run once the display list for the frame is in place */
    queue(clip, frame) {
        this.actions.push([clip, frame]);
    }
    runActions() {
        let guard = 0;
        while (this.actions.length && guard++ < 1000) {
            const [clip, frame] = this.actions.shift();
            if (!clip.removed) this.runFrame(clip, frame);
        }
    }
    runFrame(clip, frame) {
        const fn = this.scripts.frame(clip.movie, clip.id, frame);
        if (fn) this.run(clip, fn, `${clip.movie.name} ${clip.id} frame ${frame}`);
        else console.warn(`no script for ${clip.movie.name} ${clip.id} frame ${frame}`);
    }
    run(clip, fn, where) {
        try {
            fn(new Script(this, clip));
        } catch (e) {
            console.error(`${where}:`, e);
        }
    }
    event(button, event) {
        if (this.debug) console.log(`${button.movie.name} button ${button.id} ${event}`, button.parent ? button.parent.target : '');
        if (button.fire(event)) {
            this.runActions();
            this.render();
        }
    }
    /* key presses go to every key button on stage listening for that key */
    key(e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const code = e.key.length === 1 ? e.key.charCodeAt(0) : KEY_CODES[e.key];
        if (!code) return;
        const event = 'key:' + code;
        let handled = false;
        [...this.buttons].forEach(b => {
            if (b.el.isConnected && b.fire(event)) handled = true;
        });
        if (handled) {
            e.preventDefault();
            this.runActions();
            this.render();
        }
    }
    render() {
        this.fields.forEach(f => f.refresh());
    }

    /**
     * Paths and variables
     */
    resolve(from, path) {
        path = str(path).trim();
        let o = from;
        if (path === '') return o;
        if (path.startsWith('_level')) {
            const m = path.match(/^_level(\d+)\/?/);
            o = this.levels.get(+m[1]);
            path = path.slice(m[0].length);
        } else if (path.startsWith('/')) {
            o = from ? from.level : this.levels.get(0);
            path = path.slice(1);
        }
        for (const part of path.split('/')) {
            if (!o) return null;
            if (part === '' || part === '.') continue;
            o = part === '..' ? o.parent : o.child(part);
        }
        return o;
    }
    /* "path:var", "path/:var" or "var" */
    splitVar(path) {
        path = str(path);
        const colon = path.lastIndexOf(':');
        if (colon === -1) return ['', path];
        return [path.slice(0, colon).replace(/\/$/, '') || (path.startsWith('/') ? '/' : ''), path.slice(colon + 1)];
    }
    getVar(clip, path) {
        const [target, name] = this.splitVar(path);
        const o = this.resolve(clip, target);
        return o ? o.getVar(name) : undefined;
    }
    setVar(clip, path, value) {
        const [target, name] = this.splitVar(path);
        const o = this.resolve(clip, target);
        if (o) o.setVar(name, typeof value === 'number' ? str(value) : value);
    }
    getProperty(o, prop) {
        const m = o.matrix;
        switch (prop) {
            case '_x': return m[4];
            case '_y': return m[5];
            case '_xscale': return Math.hypot(m[0], m[1]) * 100;
            case '_yscale': return Math.hypot(m[2], m[3]) * 100;
            case '_rotation': return Math.atan2(m[1], m[0]) * 180 / Math.PI;
            case '_alpha': return o.cx ? o.cx[3] * 100 : 100;
            case '_visible': return o.visible ? 1 : 0;
            case '_width': return o.bounds().w;
            case '_height': return o.bounds().h;
            case '_currentframe': return o.frame;
            case '_totalframes': return o.totalFrames;
            case '_framesloaded': return o.totalFrames;
            case '_name': return o.name;
            case '_target': return o.target;
            default: return '';
        }
    }
    setProperty(o, prop, value) {
        const v = num(value);
        const m = [...o.matrix];
        switch (prop) {
            case '_x': m[4] = v; break;
            case '_y': m[5] = v; break;
            case '_xscale': {
                const s = v / 100 / (Math.hypot(m[0], m[1]) || 1);
                m[0] *= s; m[1] *= s;
                break;
            }
            case '_yscale': {
                const s = v / 100 / (Math.hypot(m[2], m[3]) || 1);
                m[2] *= s; m[3] *= s;
                break;
            }
            case '_rotation': {
                const sx = Math.hypot(m[0], m[1]);
                const sy = Math.hypot(m[2], m[3]);
                const r = v * Math.PI / 180;
                m[0] = sx * Math.cos(r); m[1] = sx * Math.sin(r);
                m[2] = -sy * Math.sin(r); m[3] = sy * Math.cos(r);
                break;
            }
            case '_alpha': {
                const cx = o.cx ? [...o.cx] : [1, 1, 1, 1, 0, 0, 0, 0];
                cx[3] = v / 100;
                o.setColorTransform(cx);
                return;
            }
            case '_visible':
                o.setVisible(!!v);
                return;
            case '_name':
                o.name = str(value);
                return;
            default:
                return;
        }
        o.scripted = true;
        o.setMatrix(m);
    }

    /**
     * Dragging (startDrag): the clip follows the pointer, within the bounds
     */
    startDrag(clip, lockCenter, rect) {
        this.drag = { clip, lockCenter, rect, offset: null };
    }
    stopDrag() {
        this.drag = null;
    }
    dragMove(e) {
        const d = this.drag;
        if (!d || !d.clip.parent) return;
        const parent = d.clip.parent.inner;
        const ctm = parent.getScreenCTM();
        if (!ctm) return;
        const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
        if (!d.offset) d.offset = d.lockCenter ? [0, 0] : [d.clip.matrix[4] - p.x, d.clip.matrix[5] - p.y];
        let x = p.x + d.offset[0];
        let y = p.y + d.offset[1];
        if (d.rect) {
            x = Math.max(d.rect[0], Math.min(d.rect[2], x));
            y = Math.max(d.rect[1], Math.min(d.rect[3], y));
        }
        this.setProperty(d.clip, '_x', x);
        this.setProperty(d.clip, '_y', y);
    }

    /**
     * The world outside
     */
    loadVariables(url, from, target, method) {
        if (!target) return;
        /* answered after the script has run, as a server would be */
        Promise.resolve(this.server.request(url, from ? { ...from.vars } : {}, method)).then(vars => {
            if (!vars) return;
            Object.entries(vars).forEach(([k, v]) => target.setVar(k, v));
            this.render();
        });
    }
    getURL(url, window = '') {
        url = str(url);
        if (/^javascript:/i.test(url)) {
            this.fscommand('quit');
            return;
        }
        if (/^https?:/i.test(url)) {
            open(url, window === '_self' ? '_self' : '_blank', 'noopener');
        }
    }
    fscommand(command) {
        if (command === 'quit' && this.onquit) this.onquit();
    }
    print(o) {
        if (this.onprint) this.onprint(o);
    }
}

export { Player, num, str };
