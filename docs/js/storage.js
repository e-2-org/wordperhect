/**
 * Stands in for the original's server scripts, keeping texts in the browser
 *
 * The piece loaded and saved with loadVariables, so the requests and answers
 * are kept as they were (see perhect.php and lib/wordPerhect.php):
 *  - tips.asp?action=rd       the tips: jname0, jname1... and loaded=1
 *  - perhect<N>.asp?action=rd the texts saved on paper N: count, name1, m1... and loaded=1
 *  - perhect<N>.asp?action=sg save m (the text) as name on paper N
 *
 * Texts are kept in localStorage, so each visitor sees only their own. If
 * localStorage isn't available (private browsing, blocked storage) texts are
 * kept for as long as the page is open.
 */
const KEY = 'wordperhect:paper';
const memory = {};

function load(paper) {
    try {
        const json = localStorage.getItem(KEY + paper);
        if (json) return JSON.parse(json);
    } catch (e) {
        /* fall back to memory */
    }
    return memory[paper] || [];
}

function store(paper, texts) {
    memory[paper] = texts;
    try {
        localStorage.setItem(KEY + paper, JSON.stringify(texts));
    } catch (e) {
        /* kept in memory only */
    }
}

/* papers are 1 to 9 (the original allowed up to 10), anything else is paper 1 */
const paperOf = url => {
    const n = parseInt((url.match(/(\d+)/) || [])[1], 10);
    return n > 0 && n < 11 ? n : 1;
};

export default class Storage {
    constructor(tipsUrl) {
        this.tips = fetch(tipsUrl)
            .then(r => (r.ok ? r.text() : ''))
            .then(text => text.split(/\r?\n/).filter(line => line.trim()).map(line => line.split('|')[0].trim()))
            .catch(() => []);
    }
    /**
     * @param {string} url the request the piece made
     * @param {object} vars the variables it sent
     * @returns {Promise<object>} the variables to load
     */
    async request(url, vars) {
        if (/tips\.asp/i.test(url)) {
            const tips = await this.tips;
            const out = { loaded: '1' };
            tips.forEach((tip, i) => out['jname' + i] = tip);
            return out;
        }
        const paper = paperOf(url);
        if (/action=sg/i.test(url)) {
            const text = String(vars.m || '').trim();
            if (!text) return { m: '', cconfirm: '1' };
            const name = String(vars.name || '').trim() || 'untitled';
            store(paper, [...load(paper), { name, text, date: Date.now() }]);
            return { m: 'Thank you - your message has been entered', confirm: '1' };
        }
        if (/action=rd/i.test(url)) {
            const texts = load(paper);
            const out = { count: String(texts.length) };
            texts.forEach((t, i) => {
                out['name' + (i + 1)] = t.name;
                out['m' + (i + 1)] = t.text;
            });
            out.loaded = '1';
            return out;
        }
        return null;
    }
}
