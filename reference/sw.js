/**
 * Stands in for Word Perhect's server scripts, for the original movie in Ruffle
 *
 * Answers the requests perhect.php answered (see lib/wordPerhect.php), keeping
 * saved texts in the Cache API, and serves the movies from the folder above.
 */
const STORE = 'wordperhect-reference';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

const encode = vars => Object.entries(vars).map(([k, v]) => '&' + k + '=' + encodeURIComponent(v)).join('');
const reply = vars => new Response(encode(vars), { headers: { 'Content-Type': 'text/plain' } });

async function texts(paper) {
    const cache = await caches.open(STORE);
    const res = await cache.match('/texts/' + paper);
    return res ? res.json() : [];
}

async function saveTexts(paper, list) {
    const cache = await caches.open(STORE);
    await cache.put('/texts/' + paper, new Response(JSON.stringify(list)));
}

async function answer(request) {
    const url = new URL(request.url);
    const file = url.pathname.split('/').pop();
    if (file === 'tips.asp') {
        const res = await fetch('../lib/tips.txt');
        const lines = (await res.text()).split(/\r?\n/).filter(l => l.trim());
        const vars = {};
        lines.forEach((l, i) => vars['jname' + i] = l.split('|')[0].trim());
        vars.loaded = '1';
        return reply(vars);
    }
    const n = parseInt((file.match(/(\d+)/) || [])[1], 10);
    const paper = n > 0 && n < 11 ? n : 1;
    if (url.search.includes('action=sg')) {
        const body = new URLSearchParams(await request.text());
        const m = (body.get('m') || '').trim();
        if (!m) return reply({ m: '', cconfirm: '1' });
        const list = await texts(paper);
        list.push({ name: (body.get('name') || '').trim() || 'untitled', text: m, date: Date.now() });
        await saveTexts(paper, list);
        return reply({ m: 'Thank you - your message has been entered', confirm: '1' });
    }
    const list = await texts(paper);
    const vars = { count: String(list.length) };
    list.forEach((t, i) => {
        vars['name' + (i + 1)] = t.name;
        vars['m' + (i + 1)] = t.text;
    });
    vars.loaded = '1';
    return reply(vars);
}

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    if (url.origin !== location.origin) return;
    if (/\.asp$/i.test(url.pathname)) {
        e.respondWith(answer(e.request));
    } else if (/\/reference\/\w+\.swf$/i.test(url.pathname)) {
        e.respondWith(fetch('../' + url.pathname.split('/').pop()));
    }
});
