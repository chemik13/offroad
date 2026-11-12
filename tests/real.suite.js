// Real-network trip suite: what Claude would return (preset) -> planner -> automatic checks against what was asked.
// node tests/real.suite.js preview.html outdir [only-ids,comma]
const { chromium } = require('playwright');
const fs = require('fs');
// researched: what parseSmart marks on places Claude returns with coordinates (so they are not re-geocoded by name)
const S = (name, lat, lon, country, extra = {}) => ({ name, lat, lon, country, researched: true, ...extra });
const M = { difficulty: 'medium', poi_types: [], summary_he: 'בדיקה' };
const CASES = [
  { id: 'zagori-day', p: { ...M, country: 'GR', start: S('Monodendri', 39.885, 20.755, 'GR'), loop: true, duration_hours: 5 } },
  { id: 'durmitor-day', p: { ...M, country: 'ME', start: S('Zabljak', 43.155, 19.122, 'ME'), loop: true, duration_hours: 6 } },
  { id: 'mavrovo-day', p: { ...M, country: 'MK', start: S('Mavrovo', 41.65, 20.735, 'MK'), loop: true, duration_hours: 6 } },
  { id: 'estrela-day', p: { ...M, country: 'PT', start: S('Manteigas', 40.402, -7.539, 'PT'), loop: true, duration_hours: 5 } },
  { id: 'kazbegi-day', p: { ...M, country: 'GE', start: S('Stepantsminda', 42.657, 44.643, 'GE'), loop: true, duration_hours: 5 } },
  { id: 'assietta-day', p: { ...M, country: 'IT', start: S('Susa', 45.137, 7.05, 'IT'), end: S('Sestriere', 44.958, 6.879, 'IT'), loop: false, duration_hours: 6 } },
  { id: 'israel-day', p: { ...M, country: 'IL', start: S('מצפה רמון', 30.61, 34.80, 'IL'), loop: false, duration_hours: 4 } },
  { id: 'theth-2d', p: { ...M, country: 'AL', start: S('Shkoder', 42.068, 19.512, 'AL'), end: S('Theth', 42.395, 19.773, 'AL'), days: 2, poi_types: ['nightcamp'], loop: false } },
  { id: 'velebit-2d', p: { ...M, country: 'HR', start: S('Gospic', 44.546, 15.374, 'HR'), end: S('Zadar', 44.119, 15.231, 'HR'), days: 2, poi_types: ['nightcamp'], loop: false } },
  { id: 'tusheti-3d', allowReuse: 'Omalo is reached only by the Abano Pass road: a loop there must come back the same way', p: { ...M, country: 'GE', start: S('Telavi', 41.92, 45.473, 'GE'), via: [S('Omalo', 42.373, 45.632, 'GE')], days: 3, poi_types: ['nightcamp'], loop: true } },
  { id: 'sarajevo-mostar-3d', p: { ...M, country: 'BA', start: S('Sarajevo', 43.856, 18.413, 'BA'), end: S('Mostar', 43.343, 17.808, 'BA'), via: [S('Bjelasnica', 43.70, 18.25, 'BA', { area: true }), S('Prenj', 43.55, 17.95, 'BA', { area: true })], days: 3, max_km_per_day: 120, poi_types: ['nightcamp'], loop: false } },
  { id: 'fagaras-3d', p: { ...M, country: 'RO', start: S('Sibiu', 45.793, 24.152, 'RO'), end: S('Curtea de Arges', 45.139, 24.679, 'RO'), via: [S('Transalpina', 45.30, 23.73, 'RO', { area: true })], days: 3, poi_types: ['nightcamp'], loop: false } },
  { id: 'sardinia-4d', p: { ...M, country: 'IT', start: S('Olbia', 40.923, 9.498, 'IT'), via: [S('Supramonte', 40.20, 9.50, 'IT', { area: true }), S('Gennargentu', 39.99, 9.32, 'IT', { area: true })], days: 4, max_km_per_day: 150, offroad_share: 0.35, poi_types: ['nightcamp'], loop: true } },
  { id: 'tirana-thess-4d', p: { ...M, country: 'AL', start: S('Tirana', 41.327, 19.819, 'AL'), end: S('Thessaloniki', 40.64, 22.94, 'GR'), via: [S('Ohrid', 41.117, 20.802, 'MK'), S('Prespa (Pretor)', 40.975, 20.97, 'MK')], days: 4, max_km_per_day: 150, poi_types: ['nightcamp'], night_near_water: true, loop: false } },
  { id: 'brasov-5d', p: { ...M, country: 'RO', start: S('Brasov', 45.657, 25.601, 'RO'), via: [S('Bucegi', 45.40, 25.45, 'RO', { area: true }), S('Piatra Craiului', 45.53, 25.22, 'RO', { area: true }), S('Harghita', 46.40, 25.60, 'RO', { area: true })], days: 5, max_km_per_day: 150, offroad_share: 0.35, poi_types: ['nightcamp'], loop: true } },
  { id: 'peloponnese-5d', p: { ...M, country: 'GR', start: S('Patras', 38.246, 21.735, 'GR'), via: [S('Kalavryta', 38.032, 22.111, 'GR'), S('Mainalo', 37.65, 22.25, 'GR', { area: true }), S('Taygetos', 37.0, 22.35, 'GR', { area: true })], days: 5, max_km_per_day: 150, poi_types: ['nightcamp'], loop: true } },
  { id: 'split-kotor-4d', minOff: 33 /* the coast has little legal dirt; it used to look higher only by hopping onto farm tracks */, p: { ...M, country: 'HR', start: S('Split', 43.508, 16.44, 'HR'), end: S('Kotor', 42.424, 18.771, 'ME'), via: [S('Biokovo', 43.33, 17.05, 'HR', { area: true })], days: 4, max_km_per_day: 120, poi_types: ['nightcamp'], loop: false } },
  { id: 'lisbon-porto-4d', p: { ...M, country: 'PT', start: S('Lisboa', 38.72, -9.14, 'PT'), end: S('Porto', 41.15, -8.61, 'PT'), via: [S('Serra da Estrela', 40.32, -7.61, 'PT', { area: true })], days: 4, max_km_per_day: 150, offroad_share: 0.3, poi_types: ['nightcamp'], loop: false } },
  { id: 'portugal-tet-7d', p: { ...M, country: 'PT', start: S('Braganca', 41.806, -6.757, 'PT'), end: S('Faro', 37.019, -7.93, 'PT'), via: [S('Serra da Estrela', 40.32, -7.61, 'PT', { area: true }), S('Monsaraz', 38.44, -7.38, 'PT')], days: 7, max_km_per_day: 130, offroad_share: 0.35, poi_types: ['nightcamp'], loop: false } },
  { id: 'balkan-10d', minOff: 24 /* long transfers; honest share after hop removal */, p: { ...M, country: 'GR', start: S('Thessaloniki', 40.64, 22.94, 'GR'), end: S('Dubrovnik', 42.65, 18.09, 'HR'), via: [S('Ohrid', 41.117, 20.802, 'MK'), S('Theth', 42.395, 19.773, 'AL'), S('Durmitor', 43.15, 19.08, 'ME', { area: true })], days: 10, max_km_per_day: 120, offroad_share: 0.35, poi_types: ['nightcamp'], night_near_water: true, loop: false } },
  { id: 'dolomites-21d', p: { ...M, country: 'GR', start: S('Thessaloniki', 40.64, 22.94, 'GR'), days: 21, max_km_per_day: 100, offroad_share: 0.35, night_near_water: true, resupply_every_days: 2, poi_types: ['nightcamp'], loop: true,
    via: [S('Zagori', 39.88, 20.75, 'GR', { area: true }), S('Igoumenitsa', 39.505, 20.265, 'GR', { ferry_to_next: true, ferry_hours: 26 }), S('Venezia', 45.44, 12.32, 'IT'), S('Passo Giau', 46.48, 12.05, 'IT'), S('Lago di Braies', 46.69, 12.08, 'IT'), S('Venezia porto', 45.43, 12.31, 'IT', { ferry_to_next: true, ferry_hours: 26 }), S('Igoumenitsa port', 39.50, 20.26, 'GR'), S('Meteora', 39.71, 21.63, 'GR')] } },
];
const IL = (n, la, lo) => S(n, la, lo, 'IL');
const CASES_IL = [
  { id: 'il-uvda-4d', maxSide: 10, p: { ...M, country: 'IL', start: IL('מצפה רמון', 30.6097, 34.8013), end: IL('אילת', 29.5577, 34.9519), loop: false, days: 4, poi_types: ['historic', 'viewpoint', 'nightcamp'],
    via: [IL('מכתש רמון', 30.58, 34.81), IL('עין סהרונים', 30.39, 34.97), IL('בקעת עובדה (שדה אברהם)', 29.99, 34.92), IL('בקעת הירח', 29.83, 34.93), IL('מצפה הר יואש', 29.58, 34.93)].map(v => ({ ...v, area: true })) } },
  { id: 'il-ramon-avdat-picnic', wantPoi: 'camp', p: { ...M, country: 'IL', start: IL('מצפה רמון', 30.61, 34.80), end: IL('עין עבדת', 30.83, 34.77), loop: false, duration_hours: 4, poi_types: ['camp'] } },
  { id: 'il-raanana-agamon-picnic', trueEnd: [32.3729, 34.9357], p: { ...M, country: 'IL', start: IL('רעננה', 32.184, 34.871), end: IL('אגמון חפר', 32.368, 34.888), loop: false, duration_hours: 3, poi_types: ['camp'] } },
  { id: 'il-ramon-4h', p: { ...M, country: 'IL', start: IL('מצפה רמון', 30.61, 34.80), loop: false, duration_hours: 4 } },
  { id: 'il-ramon-loop-hard', p: { ...M, country: 'IL', start: IL('מצפה רמון', 30.61, 34.80), loop: true, duration_hours: 6, difficulty: 'hard' } },
  { id: 'il-ramon-beerot', p: { ...M, country: 'IL', start: IL('מצפה רמון', 30.61, 34.80), end: IL('חניון בארות', 30.588, 34.889), loop: false, poi_types: ['viewpoint'] } },
  { id: 'il-golan-half', p: { ...M, country: 'IL', start: IL('קצרין', 32.99, 35.69), loop: true, duration_hours: 4, poi_types: ['spring', 'viewpoint'] } },
  { id: 'il-menashe-2h', p: { ...M, country: 'IL', start: IL('רמות מנשה', 32.60, 35.05), loop: true, duration_hours: 2, difficulty: 'easy' } },
  { id: 'il-yatir-easy', p: { ...M, country: 'IL', start: IL('יער יתיר', 31.35, 35.00), loop: true, duration_hours: 3, difficulty: 'easy' } },
  { id: 'il-meron-loop', p: { ...M, country: 'IL', start: IL('מירון', 32.98, 35.43), loop: true, duration_hours: 4 } },
  { id: 'il-eilat-hard', p: { ...M, country: 'IL', start: IL('שחורת', 29.65, 34.93), loop: true, duration_hours: 7, difficulty: 'hard', avoid_asphalt: true } },
  { id: 'il-arava', p: { ...M, country: 'IL', start: IL('צופר', 30.56, 35.18), end: IL('פארן', 30.33, 35.15), loop: false, duration_hours: 5 } },
  { id: 'il-judean-desert', p: { ...M, country: 'IL', start: IL('מצפה שלם', 31.57, 35.40), end: IL('מצדה', 31.31, 35.36), loop: false, duration_hours: 6 } },
  { id: 'il-firing-weekday', p: { ...M, country: 'IL', start: IL('מצפה רמון', 30.61, 34.80), loop: true, duration_hours: 6, date: '2026-11-17' }, expectMil: 0 },
  { id: 'il-firing-saturday', p: { ...M, country: 'IL', start: IL('מצפה רמון', 30.61, 34.80), loop: true, duration_hours: 6, date: '2026-11-14' }, allowMil: true },
  { id: 'il-area-a', p: { ...M, country: 'IL', start: IL('מצפה יריחו', 31.82, 35.40), end: IL('נבי מוסא', 31.79, 35.43), loop: false, duration_hours: 3 }, expectAA: 0 },
  { id: 'il-2d-negev', p: { ...M, country: 'IL', start: IL('מצפה רמון', 30.61, 34.80), days: 2, poi_types: ['nightcamp', 'viewpoint'], loop: false } },
  { id: 'il-3d-loop-bs', p: { ...M, country: 'IL', start: IL('באר שבע', 31.25, 34.79), days: 3, poi_types: ['nightcamp'], loop: true } },
  { id: 'il-paran-long', p: { ...M, country: 'IL', start: IL('צופר', 30.56, 35.18), end: IL('אילת', 29.56, 34.95), loop: false, distance_km: 150 } },
  { id: 'il-golan-eilat-5d', p: { ...M, country: 'IL', start: IL('קצרין', 32.99, 35.69), end: IL('אילת', 29.56, 34.95), days: 5, max_km_per_day: 150, poi_types: ['nightcamp'], loop: false } },
  // "a 2-day trip around Jerusalem": the night must stay in the area (it went to Tel Ashkelon), and the page must not freeze
  { id: 'il-jerusalem-2d', maxNightKm: 30, p: { ...M, country: 'IL', start: IL('עין חמד', 31.795, 35.125), days: 2, stay_within_km: 25, poi_types: ['nightcamp', 'spring', 'viewpoint'], loop: true } },
  { id: 'il-galil-2d', p: { ...M, country: 'IL', start: IL('צפת', 32.965, 35.496), end: IL('קצרין', 32.99, 35.69), days: 2, poi_types: ['nightcamp', 'spring'], loop: false } },
];
(async () => {
  const [html, out = '/tmp/suite', only] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {});
  const rows = [];
  for (const c of (process.env.SUITE === 'il' ? CASES_IL : CASES).filter(c => !only || only.split(',').includes(c.id))) {
    const pg = await b.newPage({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true });
    const errs = []; pg.on('pageerror', e => errs.push(e.message)); if (process.env.DBG) pg.on('console', m => { if (/dbg|piece|stretch|seek/.test(m.text())) console.log('C', m.text().slice(0, 200)); });
    await pg.route(/tile\.|arcgis|fonts|opentopomap/, r => r.abort());
    await pg.route(/overpass|kumi|coffee|mail\.ru/, r => r.abort());
    await pg.route(/project-osrm/, async r => { try { const resp = await r.fetch({ timeout: 60000 }); await r.fulfill({ response: resp, headers: { ...resp.headers(), 'access-control-allow-origin': '*' } }); } catch { r.abort(); } });
    await pg.addInitScript(() => { window.__maxBlock = 0; try { new PerformanceObserver(l => { for (const e of l.getEntries()) { window.__maxBlock = Math.max(window.__maxBlock, e.duration); (window.__blocks = window.__blocks || []).push(Math.round(e.duration)); } }).observe({ type: 'longtask', buffered: true }); } catch {} });
    await pg.goto('file://' + html);
    const t0 = Date.now();
    let res;
    try {
      if (process.env.PROF) await pg.evaluate(() => { window.__tl = []; const st0 = window.status, T0 = performance.now(); window.status = function (m, ...a) { window.__tl.push([Math.round(performance.now() - T0), String(m).slice(0, 50)]); return st0.call(this, m, ...a); }; const f0 = window.fetch; window.__net = {}; window.fetch = async function (u, ...a) { const t = performance.now(); const k = String(u.url || u).replace(/^https?:\/\//, '').split(/[/?]/).slice(0, 4).join('/').replace(/[\d.,;-]{6,}.*/, '#'); try { return await f0.call(this, u, ...a); } finally { const q = window.__net[k] || (window.__net[k] = { n: 0, ms: 0 }); q.n++; q.ms += Math.round(performance.now() - t); } }; });
      if (process.env.PROF) await pg.evaluate(() => { window.__prof = {}; for (const n of ['tilesToElements', 'dijkstra', 'loadGraph', 'ensureTiles', 'tetMarkGraph', 'loadReports', 'geocode', 'render', 'buildGraph', 'plan', 'planMulti', 'planMultiVia', 'routeStats', 'snapPois', 'buildRoute', 'components', 'analyzeElevation', 'applyReports', 'factors']) { const f = window[n]; if (typeof f !== 'function') continue; window[n] = function (...a) { const t = performance.now(); if (n === 'planMulti') window.__G = a[0]; try { return f.apply(this, a); } finally { const d = performance.now() - t; const q = window.__prof[n] || (window.__prof[n] = { n: 0, ms: 0, max: 0 }); q.n++; q.ms += d; q.max = Math.max(q.max, d); } }; } });
      let cdp = null; if (process.env.CPU) { cdp = await pg.context().newCDPSession(pg); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start'); }
      await pg.evaluate(P => { run(true, JSON.parse(JSON.stringify(P))); }, { ...c.p, ...(process.env.EXTRA ? JSON.parse(process.env.EXTRA) : {}) });
      await pg.waitForTimeout(500);
      await pg.waitForFunction(() => !busy, null, { timeout: 300000 });
      if (process.env.PROF && process.env.CAMPS) console.log(JSON.stringify(await pg.evaluate(([la, lo]) => window.__G.pois.filter(c => c.type === 'nightcamp').map(c => [Math.round(hav(la, lo, c.lat, c.lon) / 1000), c.auth ? 'A' : '-', c.name]).sort((a, b) => a[0] - b[0]).slice(0, 25), [c.p.start.lat, c.p.start.lon])));
      if (cdp) { const { profile } = await cdp.send('Profiler.stop'); const self = {}; const byId = new Map(profile.nodes.map(n => [n.id, n])); const dt = profile.timeDeltas; profile.samples.forEach((id, i) => { const n = byId.get(id), k = (n.callFrame.functionName || '(anon)') + ':' + (n.callFrame.lineNumber + 1); self[k] = (self[k] || 0) + dt[i] / 1000; }); console.log('CPU', JSON.stringify(Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 28).map(([k, v]) => [k, Math.round(v)]))); }
      if (process.env.PROF) console.log('BLOCKS', JSON.stringify(await pg.evaluate(() => (window.__blocks || []).filter(x => x > 300).sort((a, b) => b - a).slice(0, 8))));
      if (process.env.PROF) { const tl = await pg.evaluate(() => window.__tl); const agg = {}; for (let i = 0; i < tl.length; i++) { const k = tl[i][1].replace(/[\d.]+/g, '#').slice(0, 34), d = (tl[i + 1]?.[0] ?? tl[i][0]) - tl[i][0]; agg[k] = (agg[k] || 0) + d; } console.log('TL', JSON.stringify(Object.entries(agg).filter(x => x[1] > 400).sort((a, b) => b[1] - a[1]).slice(0, 14))); console.log('NET', JSON.stringify(await pg.evaluate(() => Object.entries(window.__net).filter(x => x[1].ms > 300).sort((a, b) => b[1].ms - a[1].ms).slice(0, 10)))); }
      if (process.env.PROF) console.log(JSON.stringify(await pg.evaluate(() => Object.fromEntries(Object.entries(window.__prof).map(([k, v]) => [k, { n: v.n, ms: Math.round(v.ms), max: Math.round(v.max) }])))));
      res = await pg.evaluate(P => {
        const r = current?.res?.results?.[0];
        if (!r || document.getElementById('results').hidden) return { fail: document.getElementById('status').textContent };
        const p = current.p, D = r.days && r.days.length > 1 ? r.days : null;
        const near = (ll, max) => { let m = Infinity; for (let i = 0; i < r.coords.length; i += 1) { const d = hav(ll[0], ll[1], r.coords[i][0], r.coords[i][1]); if (d < m) m = d; } return m; };
        const viaMiss = (P.via || []).filter(v => near([v.lat, v.lon]) > (v.area ? 15000 : 8000)).map(v => v.name + ' ' + Math.round(near([v.lat, v.lon]) / 1000) + 'km');
        let jumps = 0; const jumpAt = []; for (const sg of r.segs) if (!sg.ferry) for (let i = 1; i < sg.pts.length; i++) { const d = hav(sg.pts[i - 1][0], sg.pts[i - 1][1], sg.pts[i][0], sg.pts[i][1]); if (d > (sg.road ? 6000 : 3000)) { jumps++; jumpAt.push(sg.pts[i - 1].map(x => x.toFixed(3)).join(',') + '→' + sg.pts[i].map(x => x.toFixed(3)).join(',') + ' ' + Math.round(d) + 'm road=' + !!sg.road); } }
        // driving the same ground twice (not counting the loop closing back home)
        const cell = new Map(); let again = 0, tot = 0;
        for (let i = 1; i < r.coords.length; i++) { const d = hav(r.coords[i - 1][0], r.coords[i - 1][1], r.coords[i][0], r.coords[i][1]); tot += d; const k = Math.round(r.coords[i][0] / 0.002) + ',' + Math.round(r.coords[i][1] / 0.0027); const f = cell.get(k); if (f != null && i - f > 40) again += d; else if (f == null) cell.set(k, i); }
        // running beside where it already drove (a parallel track counts): within ~400 m of ground covered more than 2 km earlier
        const first = new Map(); let side = 0, cum = 0;
        for (let i = 1; i < r.coords.length; i++) { const d = hav(r.coords[i - 1][0], r.coords[i - 1][1], r.coords[i][0], r.coords[i][1]); cum += d; const la = Math.round(r.coords[i][0] / 0.0036), lo = Math.round(r.coords[i][1] / 0.0042);
          let hit = false; for (let dx = -1; dx <= 1 && !hit; dx++) for (let dy = -1; dy <= 1 && !hit; dy++) { const f = first.get((la + dx) + ',' + (lo + dy)); if (f != null && f < cum - 2000) hit = true; }
          if (hit) side += d; const k = la + ',' + lo; if (!first.has(k)) first.set(k, cum); }
        const nights = D ? D.slice(0, -1).map(d => d.camp ? (d.camp.ferry ? 'ferry' : d.camp.type === 'dayend' ? 'none' : d.camp.wild ? (d.camp.lake ? 'wild-lake' : 'wild') : d.camp.lake ? 'lake' : 'camp') : 'none') : [];
        const startD = P.start ? hav(P.start.lat, P.start.lon, r.coords[0][0], r.coords[0][1]) : 0;
        const endLL = P.loop ? P.start : P.end; const endD = endLL ? hav(endLL.lat, endLL.lon, r.coords[r.coords.length - 1][0], r.coords[r.coords.length - 1][1]) : 0;
        // hopping: short dirt bits (< 2.5 km) between two road stretches
        let hops = 0, hopKm = 0; { const ss = r.segs.filter(sg => !sg.ferry); for (let i = 1; i + 1 < ss.length; i++) { const isRoad = sg => sg.road || sg.d === 0; if (isRoad(ss[i])) continue; let j = i, L = 0; while (j < ss.length && !isRoad(ss[j])) { for (let k = 1; k < ss[j].pts.length; k++) L += hav(ss[j].pts[k - 1][0], ss[j].pts[k - 1][1], ss[j].pts[k][0], ss[j].pts[k][1]); j++; } if (j < ss.length && isRoad(ss[i - 1]) && L < 2500) { hops++; hopKm += L; } i = j; } }
        const nightKm = D ? Math.max(0, ...D.slice(0, -1).filter(d => d.camp).map(d => Math.round(hav(P.start.lat, P.start.lon, d.camp.lat, d.camp.lon) / 1000))) : 0;
        return {
          nightKm, block: Math.round(window.__maxBlock || 0),
          hops, hopKm: Math.round(hopKm / 1000),
          days: D ? D.length : 1, km: Math.round(r.len / 1000), off: Math.round((r.len - r.asph) / r.len * 100), hrs: +r.hrs.toFixed(1), hrsAll: +(r.hrs + r.pois.filter(x => x.type !== 'nightcamp').length * 0.25).toFixed(1),
          dayKm: D ? D.map(d => Math.round(d.len / 1000)) : [Math.round(r.len / 1000)], dayOff: D ? D.map(d => Math.round((d.off ?? 0) / 1000)) : [],
          nights, viaMiss, jumps, jumpAt, milKm: +((r.mil || 0) / 1000).toFixed(1), aaKm: +((r.aa || 0) / 1000).toFixed(1), reuseKm: +((r.reuse || 0) / 1000).toFixed(1), again: Math.round(again / tot * 100), side: Math.round(side / tot * 100), startKm: +(startD / 1000).toFixed(1), endKm: +(endD / 1000).toFixed(1),
          warns: [...document.querySelectorAll('.warn')].map(x => x.textContent.slice(0, 110)).filter(t => !/OSM\. מצב השטח|מחוץ לישראל/.test(t)),
          last: r.coords[r.coords.length - 1], stopsText: document.getElementById('stopsBox').textContent.slice(0, 300), issues: (r.issues || []).map(t => t.slice(0, 110)), overland: !!r.overland, note: (r.note || '').slice(0, 160),
        };
      }, c.p);
    } catch (e) { res = { fail: 'timeout/exception: ' + e.message.slice(0, 120) }; }
    res.sec = Math.round((Date.now() - t0) / 1000); res.errs = errs;
    // checks against the request
    const P = { ...c.p, ...(process.env.EXTRA ? JSON.parse(process.env.EXTRA) : {}) }, bad = [];
    if (res.fail) bad.push('FAILED: ' + res.fail.slice(0, 140));
    else {
      if (c.maxSide != null && res.side > c.maxSide) bad.push(`drives beside ground already covered: ${res.side}%`);
      if (c.wantPoi && !/פיקניק/.test(res.stopsText || '')) bad.push('no picnic stop');
      if (c.trueEnd) { const [a1, o1] = c.trueEnd, [a2, o2] = res.last, d = Math.hypot((a1 - a2) * 111, (o1 - o2) * 94); if (d > 2) bad.push(`ended ${d.toFixed(1)} km from the real finish`); }
      if (c.maxNightKm && res.nightKm > c.maxNightKm) bad.push(`night ${res.nightKm} km from the start (area trip)`);
      if (res.block > 20000) bad.push(`page frozen for ${Math.round(res.block / 1000)}s at once`);
      if (P.days > 1 && res.days !== P.days) bad.push(`days ${res.days}≠${P.days}`);
      if (P.max_km_per_day && Math.max(...res.dayKm) > P.max_km_per_day * 1.25 && !res.warns.concat(res.issues).some(t => /ק"מ ליום|עוברים את/.test(t))) bad.push(`day km up to ${Math.max(...res.dayKm)} > ${P.max_km_per_day}`);
      const want = P.offroad_share ? P.offroad_share * 100 * 0.75 : res.overland ? 15 : 40;
      if (res.off < (c.minOff ?? want)) bad.push(`off-road ${res.off}% < ${Math.round(want)}%`);
      if (res.viaMiss.length) bad.push('missed: ' + res.viaMiss.join(', '));
      if (res.jumps) bad.push(`${res.jumps} straight jumps`);
      if (res.again > 35 && !c.allowReuse) bad.push(`${res.again}% driven twice`);
      if (res.startKm > 5) bad.push(`starts ${res.startKm} km away`);
      if (res.endKm > 5) bad.push(`ends ${res.endKm} km away`);
      const nn = res.nights.filter(x => x === 'none').length; if (res.nights.length && nn / res.nights.length > 0.3) bad.push(`${nn}/${res.nights.length} nights without camp`);
      if (P.night_near_water && res.nights.length && !res.nights.some(x => /lake/.test(x))) bad.push('no lakeside night');
      if (P.wild_camping) { let run = 0; for (const x of res.nights) { run = /^wild/.test(x) ? run + 1 : 0; if (run >= (P.camp_every_days || 2)) { bad.push('too many wild nights in a row'); break; } } }
      if (c.expectMil === 0 && res.milKm > 0) bad.push(`${res.milKm} km in firing zones on a weekday`);
      if (c.expectAA === 0 && res.aaKm > 0) bad.push(`${res.aaKm} km in Area A`);
      if (P.duration_hours && !P.days && Math.abs(res.hrsAll - P.duration_hours) / P.duration_hours > 0.4) bad.push(`${res.hrsAll}h vs ${P.duration_hours}h asked`);
      if (P.distance_km && Math.abs(res.km - P.distance_km) / P.distance_km > 0.35) bad.push(`${res.km}km vs ${P.distance_km}km asked`);
      if (res.sec > 120) bad.push(`slow ${res.sec}s`);
      if (res.errs.length) bad.push('page errors: ' + res.errs[0].slice(0, 80));
    }
    res.bad = bad;
    rows.push({ id: c.id, ...res });
    console.log(`${bad.length ? '✗' : '✓'} ${c.id.padEnd(20)} ${res.sec}s ${res.fail ? '' : `${res.days}d ${res.km}km off ${res.off}% nights[${(res.nights || []).join(',')}] dayKm[${(res.dayKm || []).join(" ")}] hops ${res.hops}/${res.hopKm}km block ${Math.round((res.block||0)/1000)}s nightKm ${res.nightKm}`}`);
    for (const x of bad) console.log('    - ' + x);
    await pg.screenshot({ path: `${out}/${c.id}.png` }).catch(() => {});
    await pg.close();
  }
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(rows, null, 1));
  console.log(`\n${rows.filter(r => !r.bad.length).length}/${rows.length} passed`);
  await b.close();
})();
