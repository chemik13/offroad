// Real-network trip suite: what Claude would return (preset) -> planner -> automatic checks against what was asked.
// node tests/real.suite.js preview.html outdir [only-ids,comma]
const { chromium } = require('playwright');
const fs = require('fs');
const S = (name, lat, lon, country, extra = {}) => ({ name, lat, lon, country, ...extra });
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
  { id: 'tusheti-3d', p: { ...M, country: 'GE', start: S('Telavi', 41.92, 45.473, 'GE'), via: [S('Omalo', 42.373, 45.632, 'GE')], days: 3, poi_types: ['nightcamp'], loop: true } },
  { id: 'sarajevo-mostar-3d', p: { ...M, country: 'BA', start: S('Sarajevo', 43.856, 18.413, 'BA'), end: S('Mostar', 43.343, 17.808, 'BA'), via: [S('Bjelasnica', 43.70, 18.25, 'BA'), S('Prenj', 43.55, 17.95, 'BA')], days: 3, max_km_per_day: 120, poi_types: ['nightcamp'], loop: false } },
  { id: 'fagaras-3d', p: { ...M, country: 'RO', start: S('Sibiu', 45.793, 24.152, 'RO'), end: S('Curtea de Arges', 45.139, 24.679, 'RO'), via: [S('Transalpina', 45.30, 23.73, 'RO')], days: 3, poi_types: ['nightcamp'], loop: false } },
  { id: 'sardinia-4d', p: { ...M, country: 'IT', start: S('Olbia', 40.923, 9.498, 'IT'), via: [S('Supramonte', 40.20, 9.50, 'IT'), S('Gennargentu', 39.99, 9.32, 'IT')], days: 4, max_km_per_day: 150, offroad_share: 0.35, poi_types: ['nightcamp'], loop: true } },
  { id: 'tirana-thess-4d', p: { ...M, country: 'AL', start: S('Tirana', 41.327, 19.819, 'AL'), end: S('Thessaloniki', 40.64, 22.94, 'GR'), via: [S('Ohrid', 41.117, 20.802, 'MK'), S('Prespa', 40.85, 21.05, 'MK')], days: 4, max_km_per_day: 150, poi_types: ['nightcamp'], night_near_water: true, loop: false } },
  { id: 'brasov-5d', p: { ...M, country: 'RO', start: S('Brasov', 45.657, 25.601, 'RO'), via: [S('Bucegi', 45.40, 25.45, 'RO'), S('Piatra Craiului', 45.53, 25.22, 'RO'), S('Harghita', 46.40, 25.60, 'RO')], days: 5, max_km_per_day: 150, offroad_share: 0.35, poi_types: ['nightcamp'], loop: true } },
  { id: 'peloponnese-5d', p: { ...M, country: 'GR', start: S('Patras', 38.246, 21.735, 'GR'), via: [S('Kalavryta', 38.032, 22.111, 'GR'), S('Mainalo', 37.65, 22.25, 'GR'), S('Taygetos', 37.0, 22.35, 'GR')], days: 5, max_km_per_day: 150, poi_types: ['nightcamp'], loop: true } },
  { id: 'split-kotor-4d', p: { ...M, country: 'HR', start: S('Split', 43.508, 16.44, 'HR'), end: S('Kotor', 42.424, 18.771, 'ME'), via: [S('Biokovo', 43.33, 17.05, 'HR')], days: 4, max_km_per_day: 120, poi_types: ['nightcamp'], loop: false } },
  { id: 'lisbon-porto-4d', p: { ...M, country: 'PT', start: S('Lisboa', 38.72, -9.14, 'PT'), end: S('Porto', 41.15, -8.61, 'PT'), via: [S('Serra da Estrela', 40.32, -7.61, 'PT')], days: 4, max_km_per_day: 150, offroad_share: 0.3, poi_types: ['nightcamp'], loop: false } },
  { id: 'portugal-tet-7d', p: { ...M, country: 'PT', start: S('Braganca', 41.806, -6.757, 'PT'), end: S('Faro', 37.019, -7.93, 'PT'), via: [S('Serra da Estrela', 40.32, -7.61, 'PT'), S('Monsaraz', 38.44, -7.38, 'PT')], days: 7, max_km_per_day: 130, offroad_share: 0.35, poi_types: ['nightcamp'], loop: false } },
  { id: 'balkan-10d', p: { ...M, country: 'GR', start: S('Thessaloniki', 40.64, 22.94, 'GR'), end: S('Dubrovnik', 42.65, 18.09, 'HR'), via: [S('Ohrid', 41.117, 20.802, 'MK'), S('Theth', 42.395, 19.773, 'AL'), S('Durmitor', 43.15, 19.08, 'ME')], days: 10, max_km_per_day: 120, offroad_share: 0.35, poi_types: ['nightcamp'], night_near_water: true, loop: false } },
  { id: 'dolomites-21d', p: { ...M, country: 'GR', start: S('Thessaloniki', 40.64, 22.94, 'GR'), days: 21, max_km_per_day: 100, offroad_share: 0.35, night_near_water: true, resupply_every_days: 2, poi_types: ['nightcamp'], loop: true,
    via: [S('Zagori', 39.88, 20.75), S('Igoumenitsa', 39.505, 20.265, 'GR', { ferry_to_next: true, ferry_hours: 26 }), S('Venezia', 45.44, 12.32, 'IT'), S('Passo Giau', 46.48, 12.05, 'IT'), S('Lago di Braies', 46.69, 12.08, 'IT'), S('Venezia porto', 45.43, 12.31, 'IT', { ferry_to_next: true, ferry_hours: 26 }), S('Igoumenitsa port', 39.50, 20.26, 'GR'), S('Meteora', 39.71, 21.63, 'GR')] } },
];
(async () => {
  const [html, out = '/tmp/suite', only] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {});
  const rows = [];
  for (const c of CASES.filter(c => !only || only.split(',').includes(c.id))) {
    const pg = await b.newPage({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true });
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.route(/tile\.|arcgis|fonts|opentopomap/, r => r.abort());
    await pg.route(/overpass|kumi|coffee|mail\.ru/, r => r.abort());
    await pg.route(/project-osrm/, async r => { try { const resp = await r.fetch({ timeout: 60000 }); await r.fulfill({ response: resp, headers: { ...resp.headers(), 'access-control-allow-origin': '*' } }); } catch { r.abort(); } });
    await pg.goto('file://' + html);
    const t0 = Date.now();
    let res;
    try {
      await pg.evaluate(P => { run(true, JSON.parse(JSON.stringify(P))); }, { ...c.p, ...(process.env.EXTRA ? JSON.parse(process.env.EXTRA) : {}) });
      await pg.waitForTimeout(500);
      await pg.waitForFunction(() => !busy, null, { timeout: 300000 });
      res = await pg.evaluate(P => {
        const r = current?.res?.results?.[0];
        if (!r || document.getElementById('results').hidden) return { fail: document.getElementById('status').textContent };
        const p = current.p, D = r.days && r.days.length > 1 ? r.days : null;
        const near = (ll, max) => { let m = Infinity; for (let i = 0; i < r.coords.length; i += 1) { const d = hav(ll[0], ll[1], r.coords[i][0], r.coords[i][1]); if (d < m) m = d; } return m; };
        const viaMiss = (P.via || []).filter(v => near([v.lat, v.lon]) > 8000).map(v => v.name + ' ' + Math.round(near([v.lat, v.lon]) / 1000) + 'km');
        let jumps = 0; const jumpAt = []; for (const sg of r.segs) if (!sg.ferry) for (let i = 1; i < sg.pts.length; i++) { const d = hav(sg.pts[i - 1][0], sg.pts[i - 1][1], sg.pts[i][0], sg.pts[i][1]); if (d > (sg.road ? 6000 : 1500)) { jumps++; jumpAt.push(sg.pts[i - 1].map(x => x.toFixed(3)).join(',') + '→' + sg.pts[i].map(x => x.toFixed(3)).join(',') + ' ' + Math.round(d) + 'm road=' + !!sg.road); } }
        // driving the same ground twice (not counting the loop closing back home)
        const cell = new Map(); let again = 0, tot = 0;
        for (let i = 1; i < r.coords.length; i++) { const d = hav(r.coords[i - 1][0], r.coords[i - 1][1], r.coords[i][0], r.coords[i][1]); tot += d; const k = Math.round(r.coords[i][0] / 0.002) + ',' + Math.round(r.coords[i][1] / 0.0027); const f = cell.get(k); if (f != null && i - f > 40) again += d; else if (f == null) cell.set(k, i); }
        const nights = D ? D.slice(0, -1).map(d => d.camp ? (d.camp.ferry ? 'ferry' : d.camp.type === 'dayend' ? 'none' : d.camp.wild ? (d.camp.lake ? 'wild-lake' : 'wild') : d.camp.lake ? 'lake' : 'camp') : 'none') : [];
        const startD = P.start ? hav(P.start.lat, P.start.lon, r.coords[0][0], r.coords[0][1]) : 0;
        const endLL = P.loop ? P.start : P.end; const endD = endLL ? hav(endLL.lat, endLL.lon, r.coords[r.coords.length - 1][0], r.coords[r.coords.length - 1][1]) : 0;
        return {
          days: D ? D.length : 1, km: Math.round(r.len / 1000), off: Math.round((r.len - r.asph) / r.len * 100), hrs: +r.hrs.toFixed(1),
          dayKm: D ? D.map(d => Math.round(d.len / 1000)) : [Math.round(r.len / 1000)], dayOff: D ? D.map(d => Math.round((d.off ?? 0) / 1000)) : [],
          nights, viaMiss, jumps, jumpAt, again: Math.round(again / tot * 100), startKm: +(startD / 1000).toFixed(1), endKm: +(endD / 1000).toFixed(1),
          warns: [...document.querySelectorAll('.warn')].map(x => x.textContent.slice(0, 110)).filter(t => !/OSM\. מצב השטח|מחוץ לישראל/.test(t)),
          issues: (r.issues || []).map(t => t.slice(0, 110)), overland: !!r.overland, note: (r.note || '').slice(0, 160),
        };
      }, c.p);
    } catch (e) { res = { fail: 'timeout/exception: ' + e.message.slice(0, 120) }; }
    res.sec = Math.round((Date.now() - t0) / 1000); res.errs = errs;
    // checks against the request
    const P = c.p, bad = [];
    if (res.fail) bad.push('FAILED: ' + res.fail.slice(0, 140));
    else {
      if (P.days > 1 && res.days !== P.days) bad.push(`days ${res.days}≠${P.days}`);
      if (P.max_km_per_day && Math.max(...res.dayKm) > P.max_km_per_day * 1.25 && !res.warns.concat(res.issues).some(t => /ק"מ ליום|עוברים את/.test(t))) bad.push(`day km up to ${Math.max(...res.dayKm)} > ${P.max_km_per_day}`);
      const want = P.offroad_share ? P.offroad_share * 100 * 0.75 : res.overland ? 15 : 40;
      if (res.off < want) bad.push(`off-road ${res.off}% < ${Math.round(want)}%`);
      if (res.viaMiss.length) bad.push('missed: ' + res.viaMiss.join(', '));
      if (res.jumps) bad.push(`${res.jumps} straight jumps`);
      if (res.again > 35) bad.push(`${res.again}% driven twice`);
      if (res.startKm > 5) bad.push(`starts ${res.startKm} km away`);
      if (res.endKm > 5) bad.push(`ends ${res.endKm} km away`);
      const nn = res.nights.filter(x => x === 'none').length; if (res.nights.length && nn / res.nights.length > 0.3) bad.push(`${nn}/${res.nights.length} nights without camp`);
      if (P.night_near_water && res.nights.length && !res.nights.some(x => /lake/.test(x))) bad.push('no lakeside night');
      if (P.wild_camping) { let run = 0; for (const x of res.nights) { run = /^wild/.test(x) ? run + 1 : 0; if (run >= (P.camp_every_days || 2)) { bad.push('too many wild nights in a row'); break; } } }
      if (res.sec > 120) bad.push(`slow ${res.sec}s`);
      if (res.errs.length) bad.push('page errors: ' + res.errs[0].slice(0, 80));
    }
    res.bad = bad;
    rows.push({ id: c.id, ...res });
    console.log(`${bad.length ? '✗' : '✓'} ${c.id.padEnd(20)} ${res.sec}s ${res.fail ? '' : `${res.days}d ${res.km}km off ${res.off}% nights[${(res.nights || []).join(',')}] dayKm[${(res.dayKm || []).join(' ')}]`}`);
    for (const x of bad) console.log('    - ' + x);
    await pg.screenshot({ path: `${out}/${c.id}.png` }).catch(() => {});
    await pg.close();
  }
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(rows, null, 1));
  console.log(`\n${rows.filter(r => !r.bad.length).length}/${rows.length} passed`);
  await b.close();
})();
