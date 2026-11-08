// Runs the engine on the REAL weekly tiles (raw.githubusercontent.com/chemik13/offroad/tiles).
const E = require('../src/engine.js'); const zlib = require('zlib');
const BASE = 'https://raw.githubusercontent.com/chemik13/offroad/tiles/';
const cache = {};
async function tile(k) { if (k in cache) return cache[k]; const r = await fetch(BASE + k + '.json.gz'); cache[k] = r.ok ? JSON.parse(zlib.gunzipSync(Buffer.from(await r.arrayBuffer()))) : null; return cache[k]; }
async function graphFor(keys) { const ts = (await Promise.all(keys.map(tile))).filter(Boolean); return E.buildGraph(E.tilesToElements(ts)); }
const fmt = r => `${(r.len / 1000).toFixed(0)}km ${r.hrs.toFixed(1)}h maxD${r.maxD} mil${(r.mil / 1000).toFixed(1)} aa${(r.aa / 1000).toFixed(1)} reuse${(r.reuse / 1000).toFixed(1)} | ${r.pois.map(p => p.name).slice(0, 4).join(', ')}${r.days ? ' | days ' + r.days.map(d => (d.len / 1000).toFixed(0) + (d.camp ? '→' + d.camp.name : '')).join(' / ') : ''}`;
const CASES = [
  { name: 'Mitzpe 3h open, viewpoint', prompt: '3 שעות ממצפה רמון עם תצפית', start: [30.6097, 34.8017] },
  { name: 'Mitzpe → Be\'erot', prompt: 'ממצפה רמון עד חניון בארות', start: [30.6097, 34.8017], end: [30.588, 34.889] },
  { name: 'Golan loop 2h (weekday)', prompt: 'לופ של שעתיים בגולן מקצרין', start: [32.99, 35.69], date: '2026-11-10' },
  { name: 'Golan loop 2h (Saturday)', prompt: 'לופ של שעתיים בגולן מקצרין', start: [32.99, 35.69], date: '2026-11-14' },
  { name: 'Yatir easy stock', prompt: 'לופ של 3 שעות ביער יתיר, קל, רכב סטוק', start: [31.35, 35.0] },
  { name: 'Uvda 4 days via stops', prompt: '4 ימים', start: [31.25, 34.79], vias: [[30.6097, 34.8017], [30.10, 34.95]], end: [29.555, 34.951], multiVia: true },
  { name: 'Negev 2 days open', prompt: 'יומיים ממצפה רמון', start: [30.6097, 34.8017] },
];
(async () => {
  for (const c of CASES) {
    const p = { ...E.parseLocal(c.prompt), ...(c.date ? { date: c.date } : {}) };
    const pts = [c.start, ...(c.vias || []), ...(c.end ? [c.end] : [])];
    const L0 = E.targetLengthM(p); const rad = (p.days || 1) > 1 ? Math.min(50000, Math.max(15000, p.loop ? L0 * p.days / 3.2 : L0 * p.days * 0.45)) : Math.min(40000, Math.max(6000, p.loop ? L0 / 2.6 : L0 * 0.75));
    const keys = pts.length > 1 && c.multiVia ? E.corridorTiles(pts, 14000) : E.tilesFor([Math.min(...pts.map(q=>q[0])) - rad / 111000, Math.min(...pts.map(q=>q[1])) - rad / 96000, Math.max(...pts.map(q=>q[0])) + rad / 111000, Math.max(...pts.map(q=>q[1])) + rad / 96000]);
    const t0 = Date.now(); const G = await graphFor(keys); const t1 = Date.now();
    const milAvoid = (p.days || 1) > 1 ? E.multiMilitary ? undefined : undefined : undefined;
    const fac = E.factors(G, { ...p, avoid_military: c.multiVia ? E.multiMilitary({ ...p, days: 4 }) : (p.days || 1) > 1 ? E.multiMilitary(p) : E.resolveMilitary(p).avoid });
    const s = E.nearestNode(G, c.start[0], c.start[1], fac, 4000);
    const e = c.end ? E.nearestNode(G, c.end[0], c.end[1], fac, 4000) : -1;
    const vias = (c.vias || []).map(v => E.nearestNode(G, v[0], v[1], fac, 3000));
    let res;
    if (c.multiVia) { res = E.planMultiVia(G, { ...p, days: 4, poi_types: ['nightcamp'] }, { s, e, vias, viaPois: [] });
      if (!res.results.length || vias.some(v => v < 0)) { // app behaviour: retry through firing zones with a warning
        const p2 = { ...p, days: 4, poi_types: ['nightcamp'], military_mode: 'allow' }; const f2 = E.factors(G, { ...p2, avoid_military: false });
        const s2 = E.nearestNode(G, c.start[0], c.start[1], f2, 4000), e2 = E.nearestNode(G, c.end[0], c.end[1], f2, 4000), v2 = c.vias.map(v => E.nearestNode(G, v[0], v[1], f2, 3000));
        res = E.planMultiVia(G, p2, { s: s2, e: e2, vias: v2, viaPois: [] }); res.note = '[through firing zones] ' + (res.note || ''); } }
    else if ((p.days || 1) > 1) res = E.planMulti(G, p, { s, e, vias });
    else res = E.plan(G, p, { s, e, vias });
    console.log(`\n# ${c.name}  [${keys.length} tiles, N=${G.N}, load ${t1 - t0}ms, plan ${Date.now() - t1}ms, target ${((res.L || 0) / 1000).toFixed(0)}km]`);
    if (!res.results.length) console.log('  NO ROUTE:', res.reason);
    if (res.note) console.log('  note:', res.note);
    for (const r of res.results) console.log('  ', fmt(r));
  }
})();
