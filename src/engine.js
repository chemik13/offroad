// ===== ENGINE (pure logic, no DOM) =====
const POI_TYPES = {
  viewpoint: { he: 'תצפית', q: 'node["tourism"="viewpoint"]' },
  spring:    { he: 'מעיין', q: 'node["natural"="spring"]' },
  nightcamp: { he: 'חניון לילה', q: 'nwr["tourism"="camp_site"]' },
  camp:      { he: 'חניון יום / פיקניק', q: 'node["tourism"="picnic_site"]' },
  peak:      { he: 'פסגה',  q: 'node["natural"="peak"]["name"]' },
  historic:  { he: 'אתר היסטורי', q: 'node["historic"]["name"]' },
  water:     { he: 'גב / בור מים', q: 'node["natural"="water"]["name"]' },
};
const DIFF = {
  0: { he: 'כביש', speed: 55 },
  1: { he: 'קל מאוד (ירוק)', speed: 35 },
  2: { he: 'קל (ירוק)', speed: 24 },
  3: { he: 'בינוני (כחול)', speed: 14 },
  4: { he: 'קשה (אדום)', speed: 8 },
  5: { he: 'קשה מאוד (שחור)', speed: 4 },
};
const TARGET_D = { easy: 2, medium: 3, hard: 4 };
const VEHICLE_MAX = { stock: 3, raised: 4, lockers: 5 };
const AVG_SPEED = { easy: 22, medium: 15, hard: 9 };

function hav(a1, o1, a2, o2) {
  const R = 6371000, r = Math.PI / 180;
  const da = (a2 - a1) * r, dO = (o2 - o1) * r;
  const s = Math.sin(da / 2) ** 2 + Math.cos(a1 * r) * Math.cos(a2 * r) * Math.sin(dO / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Area A (Palestinian Authority, entry forbidden to Israeli citizens). Coarse, conservative zones
// around the main Area A towns: [lat, lon, radius_km, name]. Not an official map.
const AREA_A = [
  [32.462, 35.296, 4.0, 'ג׳נין'], [32.410, 35.280, 2.2, 'קבאטיה'], [32.452, 35.170, 1.6, 'יעבד'], [32.410, 35.200, 1.6, 'עראבה'],
  [32.322, 35.370, 2.5, 'טובאס'], [32.312, 35.030, 3.5, 'טול כרם'], [32.312, 35.120, 1.5, 'ענבתא'], [32.190, 34.970, 2.6, 'קלקיליה'],
  [32.222, 35.258, 5.0, 'שכם'], [32.083, 35.180, 2.0, 'סלפית'], [31.905, 35.205, 5.0, 'רמאללה ואל-בירה'], [31.860, 35.455, 4.5, 'יריחו'],
  [31.705, 35.200, 4.0, 'בית לחם'], [31.630, 35.160, 1.5, 'בית פג׳אר'], [31.620, 35.100, 1.5, 'בית אומר'], [31.585, 35.100, 2.0, 'חלחול'],
  [31.585, 35.020, 1.5, 'תרקומיא'], [31.530, 35.095, 4.0, 'חברון'], [31.520, 35.160, 2.0, 'בני נעים'], [31.510, 35.030, 2.5, 'דורא'],
  [31.450, 35.090, 3.0, 'יטא'], [31.400, 35.070, 2.0, 'סמוע'], [31.410, 34.970, 2.0, 'א-דאהריה'],
];
// Rough outline of Judea & Samaria, for a soft warning only.
const JS_RING = [[32.55, 35.20], [32.52, 35.56], [31.78, 35.56], [31.47, 35.45], [31.35, 35.20], [31.35, 34.90], [31.50, 34.87], [31.85, 35.00], [32.05, 34.98], [32.20, 34.95], [32.32, 35.02], [32.45, 35.08]];
function inAreaA(la, lo) {
  if (la < 31.3 || la > 32.6 || lo < 34.85 || lo > 35.6) return null;
  for (const [a, o, r, n] of AREA_A) if (hav(la, lo, a, o) <= r * 1000) return n;
  return null;
}

function wayInfo(t) {
  const hw = t.highway;
  if (!hw) return null;
  const no = v => v === 'no' || v === 'private';
  if (no(t.access) || no(t.motor_vehicle) || no(t.motorcar) || no(t.vehicle)) return null;
  if (t.smoothness === 'impassable') return null;
  if (hw === 'path') {
    const ok = t['4wd_only'] === 'yes' || t.motorcar === 'yes' || t.motor_vehicle === 'yes';
    if (!ok) return null;
  }
  const pavedSurf = ['asphalt', 'paved', 'concrete', 'paving_stones', 'chipseal'].includes(t.surface);
  const unpavedSurf = t.surface && !pavedSurf;
  if (hw !== 'track' && hw !== 'path' && !unpavedSurf) return { d: 0, asph: true, unk: false };
  if (hw === 'track' && pavedSurf) return { d: 0, asph: true, unk: false };
  let d = { grade1: 1, grade2: 2, grade3: 3, grade4: 4, grade5: 5 }[t.tracktype];
  const unk = !d && !t.smoothness;
  if (!d) d = hw === 'track' || hw === 'path' ? 3 : 2;
  const sm = { bad: 3, very_bad: 4, horrible: 5, very_horrible: 5 }[t.smoothness];
  if (sm) d = Math.max(d, sm);
  if (t['4wd_only'] === 'yes') d = Math.max(d, 4);
  if (t.surface === 'sand') d = Math.max(d, 3);
  return { d, asph: false, unk };
}

function pointInRing(lat, lon, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ai, oi] = ring[i], [aj, oj] = ring[j];
    if ((oi > lon) !== (oj > lon) && lat < ((aj - ai) * (lon - oi)) / (oj - oi) + ai) inside = !inside;
  }
  return inside;
}

// Build graph from Overpass elements
function buildGraph(elements) {
  const idx = new Map();
  const lat = [], lon = [];
  const eA = [], eB = [], eLen = [], eD = [], eAsph = [], eMil = [], eAA = [], eJS = [], eUnk = [], eOne = [], eName = [];
  const mil = [];
  const pois = [];
  const ways = [];
  for (const el of elements) {
    if (el.tags && (el.type === 'node' || el.center) && !el.tags.highway) {
      const plat = el.type === 'node' ? el.lat : el.center.lat, plon = el.type === 'node' ? el.lon : el.center.lon;
      for (const [k, def] of Object.entries(POI_TYPES)) {
        if (matchPoi(k, el.tags)) {
          const t = el.tags;
          const poi = { type: k, lat: plat, lon: plon, name: t['name:he'] || t.name || def.he, img: t.image, commons: t.wikimedia_commons, wd: t.wikidata };
          if (k === 'nightcamp') { poi.auth = campAuth(t); poi.fee = t.fee; poi.water = t.drinking_water; poi.toilets = t.toilets; if (!t.name && !t['name:he']) poi.name = poi.auth ? 'חניון לילה' : 'אתר קמפינג'; }
          pois.push(poi); break;
        }
      }
      continue;
    } else if (el.type === 'way' && el.tags && el.tags.highway) {
      ways.push(el);
    } else if (el.tags && (el.tags.landuse === 'military' || el.tags.military)) {
      const rings = [];
      if (el.type === 'way' && el.geometry) rings.push(el.geometry.map(g => [g.lat, g.lon]));
      if (el.type === 'relation' && el.members) {
        for (const m of el.members) if (m.role !== 'inner' && m.geometry && m.geometry.length > 3) rings.push(m.geometry.map(g => [g.lat, g.lon]));
      }
      for (const r of rings) {
        let s = 90, n = -90, w = 180, e = -180;
        for (const [a, o] of r) { s = Math.min(s, a); n = Math.max(n, a); w = Math.min(w, o); e = Math.max(e, o); }
        const km2 = (n - s) * 111 * (e - w) * 96;
        const t = el.tags, nm = (t.name || '') + ' ' + (t['name:en'] || '');
        const firing = ['danger_area', 'training_area', 'range'].includes(t.military) || /שטח אש|firing/i.test(nm);
        const base = ['base', 'barracks', 'airfield', 'naval_base'].includes(t.military) || (!firing && km2 < 4);
        mil.push({ r, s, n, w, e, kind: base ? 2 : 1, name: t.name || (base ? 'בסיס צבאי' : 'שטח אש') });
      }
    }
  }
  if (ways.length) {
    let s = 90, n = -90, w = 180, ee = -180;
    for (const wy of ways) for (const g of wy.geometry || []) { if (g.lat < s) s = g.lat; if (g.lat > n) n = g.lat; if (g.lon < w) w = g.lon; if (g.lon > ee) ee = g.lon; }
    for (const [nm, la, lo, op] of KNOWN_CAMPS) {
      if (la < s || la > n || lo < w || lo > ee) continue;
      const dup = pois.find(p => p.type === 'nightcamp' && hav(p.lat, p.lon, la, lo) < 1200);
      if (dup) { dup.auth = dup.auth || op; if (!/חניון/.test(dup.name)) dup.name = nm; }
      else pois.push({ type: 'nightcamp', lat: la, lon: lo, name: nm, auth: op });
    }
  }
  const inMil = (a, o) => { let k = 0; for (const m of mil) if (a >= m.s && a <= m.n && o >= m.w && o <= m.e && pointInRing(a, o, m.r)) k = Math.max(k, m.kind); return k; };
  const nid = (id, g) => {
    let i = idx.get(id);
    if (i === undefined) { i = lat.length; idx.set(id, i); lat.push(g.lat); lon.push(g.lon); }
    return i;
  };
  for (const w of ways) {
    const info = wayInfo(w.tags);
    if (!info || !w.geometry || !w.nodes) continue;
    const one = !info.asph ? false : (w.tags.oneway === 'yes');
    const name = w.tags['name:he'] || w.tags.name || w.tags.ref || '';
    const g = w.geometry;
    const mid = g[g.length >> 1];
    const m = mil.length ? inMil(mid.lat, mid.lon) : 0;
    for (let i = 0; i + 1 < w.nodes.length; i++) {
      if (!g[i] || !g[i + 1]) continue;
      const a = nid(w.nodes[i], g[i]), b = nid(w.nodes[i + 1], g[i + 1]);
      eA.push(a); eB.push(b); eLen.push(hav(g[i].lat, g[i].lon, g[i + 1].lat, g[i + 1].lon));
      eD.push(info.d); eAsph.push(info.asph ? 1 : 0); eMil.push(m); { const ma = (g[i].lat + g[i + 1].lat) / 2, mo = (g[i].lon + g[i + 1].lon) / 2; eAA.push(inAreaA(ma, mo) ? 1 : 0); eJS.push(ma > 31.3 && ma < 32.6 && mo > 34.85 && pointInRing(ma, mo, JS_RING) ? 1 : 0); } eUnk.push(info.unk ? 1 : 0); eOne.push(one ? 1 : 0); eName.push(name);
    }
  }
  const N = lat.length, E = eA.length;
  const deg = new Int32Array(N + 1);
  for (let e = 0; e < E; e++) { deg[eA[e]]++; deg[eB[e]]++; }
  const start = new Int32Array(N + 1);
  for (let i = 0; i < N; i++) start[i + 1] = start[i] + deg[i];
  const fill = start.slice(0, N);
  const adj = new Int32Array(start[N]);
  for (let e = 0; e < E; e++) { adj[fill[eA[e]]++] = e; adj[fill[eB[e]]++] = e; }
  return {
    N, E, lat: Float64Array.from(lat), lon: Float64Array.from(lon), start, adj,
    eA: Int32Array.from(eA), eB: Int32Array.from(eB), eLen: Float64Array.from(eLen),
    eD: Uint8Array.from(eD), eAsph: Uint8Array.from(eAsph), eMil: Uint8Array.from(eMil), eAA: Uint8Array.from(eAA), eJS: Uint8Array.from(eJS),
    eUnk: Uint8Array.from(eUnk), eOne: Uint8Array.from(eOne), eName, pois, mil,
  };
}

// Authorized night camps: operated by INPA (רט"ג) or KKL, or explicitly named "חניון לילה".
const AUTH_OPS = /רשות הטבע|רט"?ג|רטג|nature and parks|inpa|קק"?ל|קרן קיימת|kkl|jnf|מועצה אזורית/i;
function campAuth(t) {
  const op = [t.operator, t.owner, t['operator:he'], t['operator:en']].filter(Boolean).join(' ');
  if (AUTH_OPS.test(op)) return /קק"?ל|קרן קיימת|kkl|jnf/i.test(op) ? 'קק"ל' : /מועצה/.test(op) ? 'מועצה אזורית' : 'רט"ג';
  if (/חניון לילה/.test((t['name:he'] || '') + ' ' + (t.name || ''))) return 'חניון לילה מוסדר';
  return null;
}
// Well-known authorized night camps (seed; merged with OSM, deduped within 1.2 km). Coordinates approximate.
const KNOWN_CAMPS = [
  ['חניון לילה בארות', 30.588, 34.889, 'רט"ג'], ['חניון לילה ממשית', 31.026, 35.064, 'רט"ג'], ['חניון לילה מצדה מערב', 31.316, 35.347, 'רט"ג'],
  ['חניון לילה חורשת טל', 33.219, 35.628, 'רט"ג'], ['חניון לילה כוכב הירדן', 32.595, 35.521, 'רט"ג'], ['חניון לילה הקסטל', 31.795, 35.144, 'רט"ג'],
];
function matchPoi(k, t) {
  switch (k) {
    case 'viewpoint': return t.tourism === 'viewpoint';
    case 'spring': return t.natural === 'spring';
    case 'nightcamp': return t.tourism === 'camp_site';
    case 'camp': return t.tourism === 'picnic_site';
    case 'peak': return t.natural === 'peak' && !!t.name;
    case 'historic': return !!t.historic && !!t.name;
    case 'water': return t.natural === 'water' && !!t.name;
  }
  return false;
}

function factors(G, p) {
  const f = new Float64Array(G.E);
  const maxD = VEHICLE_MAX[p.vehicle] || 4;
  const tD = TARGET_D[p.difficulty] || 3;
  for (let e = 0; e < G.E; e++) {
    const d = G.eD[e];
    if (G.eMil[e] === 2) { f[e] = Infinity; continue; }
    if (G.eAA[e] && !p.allow_area_a) { f[e] = Infinity; continue; }
    if (G.eMil[e] === 1 && p.avoid_military) { f[e] = Infinity; continue; }
    if (G.eAsph[e]) { f[e] = p.avoid_asphalt ? 4 : 1.6; continue; }
    if (d > maxD) { f[e] = Infinity; continue; }
    f[e] = 1 + 0.45 * Math.abs(d - tD) + (G.eUnk[e] ? 0.15 : 0);
  }
  return f;
}

class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v; k.push(key); v.push(val);
    let i = k.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= k[i]) break; [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; }
  }
  pop() {
    const k = this.k, v = this.v; const tk = k[0], tv = v[0];
    const lk = k.pop(), lv = v.pop();
    if (k.length) {
      k[0] = lk; v[0] = lv; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < k.length && k[l] < k[m]) m = l;
        if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m;
      }
    }
    return [tk, tv];
  }
}

function dijkstra(G, src, fac, used, maxCost, target = -1) {
  const dist = new Float64Array(G.N).fill(Infinity);
  const len = new Float64Array(G.N).fill(Infinity);
  const prev = new Int32Array(G.N).fill(-1);
  dist[src] = 0; len[src] = 0;
  const h = new Heap(); h.push(0, src);
  while (h.size) {
    const [d, u] = h.pop();
    if (d > dist[u]) continue;
    if (u === target || d > maxCost) break;
    for (let j = G.start[u]; j < G.start[u + 1]; j++) {
      const e = G.adj[j];
      const fwd = G.eA[e] === u;
      if (!fwd && G.eOne[e]) continue;
      const v = fwd ? G.eB[e] : G.eA[e];
      let c = G.eLen[e] * fac[e];
      if (c === Infinity) continue;
      if (used && used[e]) c *= 4;
      const nd = d + c;
      if (nd < dist[v]) { dist[v] = nd; len[v] = len[u] + G.eLen[e]; prev[v] = e; h.push(nd, v); }
    }
  }
  return { dist, len, prev, src };
}

function pathEdges(G, R, t) {
  if (R.dist[t] === Infinity) return null;
  const edges = []; let u = t;
  while (u !== R.src) {
    const e = R.prev[u]; if (e < 0) return null;
    edges.push(e); u = G.eA[e] === u ? G.eB[e] : G.eA[e];
  }
  return edges.reverse();
}

function nearestNode(G, la, lo, fac, maxM = 3000) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < G.N; i++) {
    const dl = (G.lat[i] - la) * 111000, dO = (G.lon[i] - lo) * 96000;
    const d2 = dl * dl + dO * dO;
    if (d2 < bd) {
      let ok = false;
      for (let j = G.start[i]; j < G.start[i + 1]; j++) if (fac[G.adj[j]] !== Infinity) { ok = true; break; }
      if (ok) { bd = d2; best = i; }
    }
  }
  return Math.sqrt(bd) <= maxM ? best : -1;
}

function buildRoute(G, fac, stops, maxCost, used = new Uint8Array(G.E)) {
  const edges = [];
  for (let i = 0; i + 1 < stops.length; i++) {
    if (stops[i] === stops[i + 1]) continue;
    const R = dijkstra(G, stops[i], fac, used, maxCost, stops[i + 1]);
    const p = pathEdges(G, R, stops[i + 1]);
    if (!p) return null;
    for (const e of p) { used[e] = 1; edges.push(e); }
  }
  return edges;
}

function routeStats(G, edges, startNode) {
  let len = 0, hrs = 0, asph = 0, mil = 0, unk = 0, maxD = 0, reuse = 0, aa = 0, js = 0;
  const byD = [0, 0, 0, 0, 0, 0];
  const seen = new Uint8Array(G.E);
  const coords = [];
  let u = startNode;
  coords.push([G.lat[u], G.lon[u]]);
  const segs = [];
  for (const e of edges) {
    const L = G.eLen[e], d = G.eD[e];
    len += L; hrs += L / 1000 / DIFF[d].speed; byD[d] += L;
    if (G.eAsph[e]) asph += L; else maxD = Math.max(maxD, d);
    if (G.eMil[e]) mil += L; if (G.eUnk[e]) unk += L; if (G.eAA[e]) aa += L; if (G.eJS[e]) js += L;
    if (seen[e]) reuse += L; seen[e] = 1;
    const v = G.eA[e] === u ? G.eB[e] : G.eA[e];
    coords.push([G.lat[v], G.lon[v]]);
    const last = segs[segs.length - 1];
    if (last && last.d === d) last.pts.push([G.lat[v], G.lon[v]]);
    else segs.push({ d, pts: [[G.lat[u], G.lon[u]], [G.lat[v], G.lon[v]]] });
    u = v;
  }
  return { len, hrs, asph, mil, unk, aa, js, maxD, reuse, byD, coords, segs };
}

function snapPois(G, fac, types, R0, minL, maxL, authOnly = true) {
  const out = [];
  for (const p of G.pois) {
    if (types.length && !types.includes(p.type)) continue;
    if (p.type === 'nightcamp' && !p.auth && authOnly) continue;
    const n = nearestNode(G, p.lat, p.lon, fac, 500);
    if (n < 0 || R0.len[n] < minL || R0.len[n] > maxL) continue;
    if (out.some(o => o.node === n)) continue;
    out.push({ ...p, node: n });
  }
  return out;
}

function genericCands(G, s, R0, target, k) {
  const sectors = new Array(8).fill(null);
  for (let i = 0; i < G.N; i++) {
    const L = R0.len[i];
    if (!isFinite(L) || L < target * 0.6 || L > target * 1.4) continue;
    const ang = Math.atan2((G.lat[i] - G.lat[s]), (G.lon[i] - G.lon[s]) * 0.87);
    const sec = Math.floor(((ang + Math.PI) / (2 * Math.PI)) * 8) % 8;
    const crow = hav(G.lat[s], G.lon[s], G.lat[i], G.lon[i]);
    const sc = Math.abs(L - target) / target + (R0.dist[i] / L - 1) * 0.5 - crow / L * 0.8;
    if (!sectors[sec] || sc < sectors[sec].sc) sectors[sec] = { node: i, sc };
  }
  return sectors.filter(Boolean).sort((a, b) => a.sc - b.sc).slice(0, k)
    .map(c => ({ node: c.node, type: null, name: null, lat: G.lat[c.node], lon: G.lon[c.node] }));
}

function overlapRatio(a, b) {
  const s = new Set(a); let c = 0; for (const e of b) if (s.has(e)) c++;
  return c / Math.max(1, Math.min(a.length, b.length));
}

// Main planner. p: params; nodes: {s, e (or -1), vias: [node]}
function plan(G, p, nodes, onProgress = () => {}) {
  const fac = factors(G, { ...p, avoid_military: resolveMilitary(p).avoid });
  const L = targetLengthM(p);
  const maxCost = Math.max(L, 20000) * 6;
  const s = nodes.s;
  const results = [];
  const mk = (stops, poiList) => {
    const edges = buildRoute(G, fac, stops, maxCost);
    if (!edges || !edges.length) return null;
    const st = routeStats(G, edges, s);
    return { edges, stops, pois: poiList, ...st };
  };

  if (nodes.vias.length) {
    const end = p.loop ? s : (nodes.e >= 0 ? nodes.e : nodes.vias[nodes.vias.length - 1]);
    const stops = [s, ...nodes.vias, end];
    const r = mk(stops, nodes.viaPois || []);
    if (r) results.push(r);
    return { results, L };
  }

  onProgress('מחשב מרחקים מנקודת ההתחלה…');
  const R0 = dijkstra(G, s, fac, null, maxCost);

  if (!p.loop && nodes.e < 0) {
    // Open-ended one-way: pick a good end point about L away (prefer POIs / authorized night camps)
    const types = p.poi_types || [];
    let ends = snapPois(G, fac, types, R0, L * 0.55, L * 1.15).map(c => ({ ...c, w: c.type === 'nightcamp' ? 0.5 : 0.35 }));
    ends.push(...genericCands(G, s, R0, L * 0.9, 8).map(c => ({ ...c, w: 0 })));
    const crowOk = c => hav(G.lat[s], G.lon[s], G.lat[c.node], G.lon[c.node]) > R0.len[c.node] * 0.35;
    ends = ends.filter(crowOk);
    const mids = types.length ? snapPois(G, fac, types, R0, L * 0.2, L * 0.7) : [];
    onProgress(`בודק ${ends.length} נקודות סיום…`);
    const options = [];
    for (const en of ends) {
      options.push({ stops: [s, en.node], pois: en.type ? [en] : [], est: R0.len[en.node], w: en.w });
      for (const m of mids.slice(0, 6)) if (m.node !== en.node && R0.len[m.node] < R0.len[en.node]) options.push({ stops: [s, m.node, en.node], pois: [m, ...(en.type ? [en] : [])], est: R0.len[en.node] * 1.15, w: en.w + 0.35 });
    }
    options.sort((x, y) => (Math.abs(x.est - L) / L - x.w) - (Math.abs(y.est - L) / L - y.w));
    const built = [];
    for (const o of options.slice(0, 16)) {
      const r = mk(o.stops, o.pois);
      if (!r) continue;
      r.score = 2 * Math.abs(r.len - L) / L + (r.reuse / r.len) * 1.2 - o.w;
      built.push(r);
    }
    built.sort((x, y) => x.score - y.score);
    for (const r of built) {
      if (results.length >= 3) break;
      if (results.every(q => overlapRatio(q.edges, r.edges) < 0.6)) results.push(r);
    }
  } else if (p.loop || nodes.e < 0) {
    let cands = snapPois(G, fac, p.poi_types || [], R0, L * 0.1, L * 0.55);
    cands.sort((a, b) => Math.abs(R0.len[a.node] - L * 0.3) - Math.abs(R0.len[b.node] - L * 0.3));
    cands = cands.slice(0, 9);
    cands.push(...genericCands(G, s, R0, L * 0.33, Math.max(3, 12 - cands.length)));
    if (!cands.length) return { results, L };
    onProgress(`בודק ${cands.length} נקודות ביניים…`);
    const Rc = cands.map(c => dijkstra(G, c.node, fac, null, maxCost));
    const combos = [];
    for (let i = 0; i < cands.length; i++) for (let j = i; j < cands.length; j++) {
      const a = cands[i].node, b = cands[j].node;
      const total = i === j ? 2 * R0.len[a] : R0.len[a] + Rc[i].len[b] + Rc[j].len[s];
      if (!isFinite(total)) continue;
      const cost = i === j ? 2 * R0.dist[a] : R0.dist[a] + Rc[i].dist[b] + Rc[j].dist[s];
      const poiN = (cands[i].type ? 1 : 0) + (j !== i && cands[j].type ? 1 : 0);
      const sc = 2 * Math.abs(total - L) / L + (cost / total - 1) * 0.6 - 0.35 * poiN + (i === j ? 0.4 : 0);
      combos.push({ i, j, sc });
    }
    combos.sort((x, y) => x.sc - y.sc);
    onProgress('מרכיב מסלולים…');
    const built = [];
    for (const c of combos.slice(0, 8)) {
      const A = cands[c.i], B = cands[c.j];
      const stops = c.i === c.j ? [s, A.node, s] : [s, A.node, B.node, s];
      const poiList = [A, B].filter((x, k) => x.type && (k === 0 || c.i !== c.j));
      const r = mk(stops, poiList);
      if (!r) continue;
      r.score = 2 * Math.abs(r.len - L) / L + (r.reuse / r.len) * 1.2 - 0.35 * poiList.length;
      built.push(r);
    }
    built.sort((x, y) => x.score - y.score);
    for (const r of built) {
      if (results.length >= 3) break;
      if (results.every(q => overlapRatio(q.edges, r.edges) < 0.6)) results.push(r);
    }
  } else {
    const e = nodes.e;
    const direct = R0.len[e];
    if (!isFinite(direct)) return { results, L };
    const budget = p.duration_hours || p.distance_km ? Math.max(L, direct * 1.05) : direct * 1.5;
    let cands = snapPois(G, fac, p.poi_types || [], R0, 0, budget);
    onProgress(`בודק ${cands.length} נקודות עניין בדרך…`);
    const Re = dijkstra(G, e, fac, null, maxCost);
    cands = cands.filter(c => R0.len[c.node] + Re.len[c.node] <= budget * 1.15)
      .sort((a, b) => (R0.len[a.node] + Re.len[a.node]) - (R0.len[b.node] + Re.len[b.node])).slice(0, 8);
    const options = [{ stops: [s, e], pois: [] }];
    for (const c of cands) options.push({ stops: [s, c.node, e], pois: [c] });
    for (let i = 0; i < cands.length; i++) for (let j = i + 1; j < cands.length; j++) {
      const [a, b] = R0.len[cands[i].node] < R0.len[cands[j].node] ? [cands[i], cands[j]] : [cands[j], cands[i]];
      options.push({ stops: [s, a.node, b.node, e], pois: [a, b] });
    }
    const built = [];
    for (const o of options.slice(0, 24)) {
      const r = mk(o.stops, o.pois);
      if (!r) continue;
      const tgt = p.duration_hours || p.distance_km ? L : direct;
      r.score = Math.abs(r.len - tgt) / tgt + (r.reuse / r.len) * 1.2 - 0.3 * o.pois.length + (r.len > budget * 1.2 ? 1 : 0);
      built.push(r);
    }
    built.sort((x, y) => x.score - y.score);
    for (const r of built) {
      if (results.length >= 3) break;
      if (results.every(q => overlapRatio(q.edges, r.edges) < 0.7)) results.push(r);
    }
  }
  return { results, L };
}

// Firing zones: usually open on Fri/Sat and Jewish holidays (incl. chol hamoed). Must still be verified per date.
function hebDay(d) {
  const f = new Intl.DateTimeFormat('en-u-ca-hebrew', { month: 'long', day: 'numeric', timeZone: 'Asia/Jerusalem' }).formatToParts(d);
  return { m: f.find(x => x.type === 'month').value, day: +f.find(x => x.type === 'day').value };
}
const HOLIDAYS = { Tishri: [[1, 2], [10, 10], [15, 22]], Nisan: [[15, 21]], Sivan: [[6, 6]] };
function dayInfo(iso) {
  const d = new Date(iso + 'T12:00:00+02:00');
  const wd = d.getUTCDay();
  if (wd === 5) return { open: true, why: 'יום שישי' };
  if (wd === 6) return { open: true, why: 'שבת' };
  try {
    const h = hebDay(d);
    for (const [a, b] of HOLIDAYS[h.m] || []) if (h.day >= a && h.day <= b) return { open: true, why: 'חג / חול המועד' };
    if (h.m === 'Tishri' && (h.day === 9 || h.day === 14)) return { open: true, why: 'ערב חג' };
    if (h.m === 'Nisan' && h.day === 14) return { open: true, why: 'ערב חג' };
  } catch {}
  return { open: false, why: 'יום חול' };
}
function resolveMilitary(p) {
  const mode = p.military_mode || (p.avoid_military === false ? 'allow' : 'auto');
  if (mode === 'avoid') return { avoid: true, info: null };
  if (mode === 'allow') return { avoid: false, info: null };
  const info = p.date ? dayInfo(p.date) : null;
  return { avoid: !(info && info.open), info };
}
function nextSaturday(from = new Date()) {
  const d = new Date(from); const wd = d.getDay();
  if (wd === 5 || wd === 6) return d.toISOString().slice(0, 10);
  d.setDate(d.getDate() + (6 - wd)); return d.toISOString().slice(0, 10);
}

// Offline gazetteer: common jeep-trip anchors (approximate; routing snaps to the nearest track)
const PLACES = {
  // --- צפון וגולן ---
  'הר חרמון': [33.31, 35.78], 'חרמון': [33.31, 35.78], 'מגדל שמס': [33.27, 35.77], 'מסעדה': [33.23, 35.75], 'ברכת רם': [33.23, 35.77], 'בריכת רם': [33.23, 35.77],
  'מבצר נמרוד': [33.25, 35.71], 'נמרוד': [33.25, 35.71], 'בניאס': [33.25, 35.69], 'תל דן': [33.25, 35.65], 'מטולה': [33.28, 35.58], 'קריית שמונה': [33.21, 35.57],
  'הר בנטל': [33.13, 35.78], 'הר אביטל': [33.11, 35.79], 'מרום גולן': [33.13, 35.77], 'אל רום': [33.17, 35.77], 'רמת הגולן': [33.0, 35.75], 'גולן': [33.0, 35.75],
  'קצרין': [32.99, 35.69], 'יהודיה': [32.94, 35.70], 'שמורת יהודיה': [32.94, 35.70], 'מפל זוויתן': [32.96, 35.73], 'גמלא': [32.90, 35.74],
  'חמת גדר': [32.68, 35.66], 'מבוא חמה': [32.73, 35.65], 'עין גב': [32.78, 35.64], 'טבריה': [32.79, 35.53], 'כנרת': [32.82, 35.59], 'ארבל': [32.82, 35.50],
  'צפת': [32.96, 35.50], 'הר מירון': [32.99, 35.41], 'מירון': [32.98, 35.44], 'פקיעין': [32.98, 35.33], 'כרמיאל': [32.92, 35.30],
  'נהריה': [33.01, 35.10], 'ראש הנקרה': [33.09, 35.10], 'מבצר מונפור': [33.04, 35.23], 'נחל כזיב': [33.04, 35.20],
  'נצרת': [32.70, 35.30], 'הר תבור': [32.69, 35.39], 'עפולה': [32.61, 35.29], 'גלבוע': [32.47, 35.42], 'הר גלבוע': [32.47, 35.42],
  'בית שאן': [32.50, 35.50], 'גן השלושה': [32.50, 35.45], 'יקנעם': [32.66, 35.11], 'רמת מנשה': [32.60, 35.05],
  'דלית אל כרמל': [32.69, 35.05], 'מוחרקה': [32.67, 35.08], 'כרמל': [32.70, 35.03], 'חיפה': [32.79, 34.99], 'זכרון יעקב': [32.57, 34.95], 'חדרה': [32.43, 34.92],
  // --- מרכז ושפלה ---
  'נתניה': [32.33, 34.86], 'תל אביב': [32.08, 34.78], 'ראש העין': [32.09, 34.96], 'יער בן שמן': [31.95, 34.94], 'מודיעין': [31.90, 35.01],
  'לטרון': [31.84, 34.98], 'בית שמש': [31.75, 34.99], 'עמק האלה': [31.69, 34.95], 'בית גוברין': [31.60, 34.90], 'ירושלים': [31.78, 35.23],
  // --- מדבר יהודה וים המלח ---
  'ים המלח': [31.50, 35.47], 'קומראן': [31.74, 35.46], 'מצפה שלם': [31.57, 35.40], 'עין גדי': [31.46, 35.39], 'מצדה': [31.31, 35.36],
  'עין בוקק': [31.20, 35.36], 'נווה זוהר': [31.15, 35.37], 'סדום': [31.06, 35.39], 'ערד': [31.26, 35.21], 'יער יתיר': [31.35, 35.00],
  // --- צפון הנגב ---
  'באר שבע': [31.25, 34.79], 'להבים': [31.37, 34.81], 'יער להב': [31.38, 34.87], 'רהט': [31.39, 34.75], 'אופקים': [31.31, 34.62], 'נתיבות': [31.42, 34.59],
  'חלוצה': [31.10, 34.66], 'מצפה רביבים': [31.04, 34.72], 'משאבי שדה': [31.00, 34.79], 'טללים': [30.99, 34.78], 'דימונה': [31.07, 35.03], 'ירוחם': [30.99, 34.93],
  'המכתש הגדול': [30.94, 35.02], 'מכתש גדול': [30.94, 35.02], 'המכתש הקטן': [30.92, 35.21], 'מכתש קטן': [30.92, 35.21],
  // --- הר הנגב ---
  'שדה בוקר': [30.874, 34.791], 'מדרשת בן גוריון': [30.851, 34.783], 'מדרשת שדה בוקר': [30.851, 34.783], 'עין עבדת': [30.828, 34.767], 'עבדת': [30.794, 34.773],
  'עין עקב': [30.835, 34.808], 'נחל צין': [30.84, 34.78], 'הר הנגב': [30.7, 34.85], 'ניצנה': [30.87, 34.43], 'שבטה': [30.88, 34.63],
  'מצפה רמון': [30.6097, 34.8017], 'מכתש רמון': [30.6105, 34.8018], 'מרכז המבקרים רמון': [30.6105, 34.8018], 'חניון בארות': [30.588, 34.889], 'בארות': [30.588, 34.889],
  'הר ארדון': [30.598, 34.875], 'עין סהרונים': [30.585, 34.937], 'הר חריף': [30.397, 34.585], 'הר כרכום': [30.30, 34.74],
  // --- ערבה ואילת ---
  'חצבה': [30.776, 35.25], 'עין יהב': [30.66, 35.24], 'ספיר': [30.61, 35.19], 'צופר': [30.56, 35.18], 'פארן': [30.36, 35.15],
  'יטבתה': [29.896, 35.06], 'יוטבתה': [29.896, 35.06], 'תמנע': [29.77, 34.95], 'פארק תמנע': [29.77, 34.95], 'הרי אילת': [29.60, 34.92], 'הר יהודה': [31.72, 35.05], 'מדבר יהודה': [31.45, 35.30], 'אילת': [29.557, 34.952],
};
function lookupPlace(name) {
  if (!name) return null;
  const n = name.replace(/["'׳״]/g, '').replace(/^(ה|ב|מ|ל)(?=(מכתש|הר|עין|חניון))/, '').trim();
  if (PLACES[n]) return PLACES[n];
  let best = null, bl = 0;
  for (const k of Object.keys(PLACES)) if ((n.includes(k) || k.includes(n)) && k.length > bl && n.length >= 3) { best = PLACES[k]; bl = k.length; }
  return best;
}

// ---------- multi-day planning ----------
// Beam search over authorized night camps. Day k ends at a camp ~dayLen away; last day ends at the
// destination (given), back at the start (loop) or at a good open end. Returns up to 3 alternatives.
function addDays(iso, k) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); }
function multiMilitary(p) {
  const mode = p.military_mode || 'auto';
  if (mode !== 'auto') return resolveMilitary(p).avoid;
  const base = p.date || nextSaturday();
  for (let k = 0; k < (p.days || 1); k++) if (!dayInfo(addDays(base, k)).open) return true;
  return false;
}
function planMulti(G, p, nodes, onProgress = () => {}) {
  const N = Math.max(2, Math.min(7, p.days | 0));
  const fac = factors(G, { ...p, avoid_military: multiMilitary(p) });
  const dayL = targetLengthM({ ...p, distance_km: p.distance_km ? p.distance_km / N : null, duration_hours: p.hours_per_day || p.duration_hours || 6 });
  const maxCost = dayL * 6;
  const s = nodes.s, end = p.loop ? s : nodes.e;
  const types = (p.poi_types || []).filter(t => t !== 'nightcamp');
  const camps = G.pois.filter(c => c.type === 'nightcamp' && c.auth).map(c => ({ ...c, node: nearestNode(G, c.lat, c.lon, fac, 800) })).filter(c => c.node >= 0);
  const Rend = end >= 0 ? dijkstra(G, end, fac, null, Infinity) : null;
  const totalDirect = Rend ? Rend.len[s] : null;
  onProgress(`מצאתי ${camps.length} חניוני לילה מורשים באזור. מתכנן ${N} ימים…`);
  const Rcache = new Map();
  const Rfrom = n => { if (!Rcache.has(n)) Rcache.set(n, dijkstra(G, n, fac, null, maxCost * 2)); return Rcache.get(n); };
  // beam: {at, stops:[nodes], camps:[camp], score}
  let beam = [{ at: s, stops: [s], camps: [], score: 0 }];
  for (let k = 0; k < N - 1; k++) {
    onProgress(`יום ${k + 1}: מחפש חניון לילה…`);
    const next = [];
    for (const st of beam) {
      const R = Rfrom(st.at);
      const remainingDays = N - k - 1;
      const opts = [];
      for (const c of camps) {
        if (st.camps.some(x => x.node === c.node) || c.node === st.at) continue;
        const d = R.len[c.node];
        if (!isFinite(d) || d < dayL * 0.45 || d > dayL * 1.6) continue;
        let sc = Math.abs(d - dayL) / dayL;
        if (Rend) {
          const rem = Rend.len[c.node];
          if (!isFinite(rem)) continue;
          // remaining distance should fit the remaining days (not too much, not too little)
          const want = remainingDays * dayL;
          sc += 0.8 * Math.max(0, rem - want * 1.3) / dayL + (p.loop ? 0 : 0.4 * Math.max(0, want * 0.4 - rem) / dayL);
        }
        sc += (R.dist[c.node] / d - 1) * 0.4;
        opts.push({ c, sc });
      }
      opts.sort((a, b) => a.sc - b.sc);
      for (const o of opts.slice(0, 4)) next.push({ at: o.c.node, stops: [...st.stops, o.c.node], camps: [...st.camps, o.c], score: st.score + o.sc });
    }
    if (!next.length) return { results: [], L: dayL * N, reason: `לא מצאתי חניון לילה מורשה במרחק נסיעה של יום ${k + 1} (בערך ${(dayL / 1000).toFixed(0)} ק"מ). נסו להגדיל את שעות הנסיעה ביום, לשנות נקודת התחלה, או לבחור פחות ימים.` };
    next.sort((a, b) => a.score - b.score);
    beam = [];
    for (const n of next) { if (beam.length >= 4) break; if (!beam.some(b => b.at === n.at && b.stops.length === n.stops.length && b.stops[1] === n.stops[1])) beam.push(n); }
  }
  onProgress('מרכיב את הימים…');
  const results = [];
  for (const st of beam) {
    let finalStop = end;
    let lastPoi = null;
    if (finalStop < 0) {
      // open end on the last day: an end ~dayL away, prefer POIs
      const R = Rfrom(st.at);
      let ends = snapPois(G, fac, types, R, dayL * 0.5, dayL * 1.3).map(c => ({ ...c, w: 0.35 }));
      ends.push(...genericCands(G, st.at, R, dayL * 0.9, 6).map(c => ({ ...c, w: 0 })));
      ends = ends.filter(c => !st.stops.includes(c.node));
      ends.sort((a, b) => (Math.abs(R.len[a.node] - dayL) / dayL - a.w) - (Math.abs(R.len[b.node] - dayL) / dayL - b.w));
      if (!ends.length) continue;
      finalStop = ends[0].node; if (ends[0].type) lastPoi = ends[0];
    }
    const dayStops = [...st.stops, finalStop];
    const allEdges = [], days = [], pois = [];
    const used = new Uint8Array(G.E);
    let ok = true, edgeCount = 0;
    for (let k = 0; k < dayStops.length - 1; k++) {
      const a = dayStops[k], b = dayStops[k + 1];
      let seq = [a, b], mid = null;
      // one scenic stop per day if it does not add much
      if (types.length) {
        const R = Rfrom(a);
        const direct = R.len[b];
        const cands = snapPois(G, fac, types, R, direct * 0.2, direct * 0.8).filter(m => hav(G.lat[m.node], G.lon[m.node], G.lat[b], G.lon[b]) < direct * 0.8);
        cands.sort((x, y) => (R.len[x.node] + hav(G.lat[x.node], G.lon[x.node], G.lat[b], G.lon[b])) - (R.len[y.node] + hav(G.lat[y.node], G.lon[y.node], G.lat[b], G.lon[b])));
        if (cands[0]) { mid = cands[0]; seq = [a, mid.node, b]; }
      }
      const snap = used.slice();
      let edges = buildRoute(G, fac, seq, maxCost * 2, used);
      if (mid && edges) { const L = edges.reduce((s, e) => s + G.eLen[e], 0); const direct = Rfrom(a).len[b]; if (L > direct * 1.35) { used.set(snap); edges = buildRoute(G, fac, [a, b], maxCost * 2, used); mid = null; } }
      if (!edges || !edges.length) { ok = false; break; }
      const dl = edges.reduce((s, e) => s + G.eLen[e], 0);
      let dh = 0; for (const e of edges) dh += G.eLen[e] / 1000 / DIFF[G.eD[e]].speed;
      const camp = k < st.camps.length ? st.camps[k] : null;
      if (mid) pois.push({ ...mid, day: k + 1 });
      if (camp) pois.push({ ...camp, day: k + 1 });
      days.push({ from: edgeCount, to: edgeCount + edges.length, len: dl, hrs: dh, camp, mid, startNode: a, endNode: b });
      edgeCount += edges.length; allEdges.push(...edges);
    }
    if (!ok) continue;
    if (lastPoi) pois.push({ ...lastPoi, day: days.length });
    const stt = routeStats(G, allEdges, s);
    const r = { edges: allEdges, stops: dayStops, pois, ...stt, days };
    r.score = st.score + (stt.reuse / stt.len) * 1.5 + days.reduce((sum, d) => sum + Math.abs(d.len - dayL) / dayL, 0) * 0.5;
    results.push(r);
  }
  results.sort((a, b) => a.score - b.score);
  const out = [];
  for (const r of results) { if (out.length >= 3) break; if (out.every(q => overlapRatio(q.edges, r.edges) < 0.75)) out.push(r); }
  return { results: out, L: dayL * N, dayL, totalDirect };
}

function targetLengthM(p) {
  if (p.distance_km) return p.distance_km * 1000;
  const h = p.duration_hours || 3;
  const stops = (p.poi_types || []).length ? 0.4 : 0.2;
  const km = Math.max(0.5, h - stops) * (AVG_SPEED[p.difficulty] || 15);
  return Math.min(160, Math.max(6, km)) * 1000;
}

function toGPX(route, title) {
  const esc = s => String(s).replace(/[<&>"]/g, c => ({ '<': '&lt;', '&': '&amp;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = n => n.toFixed(6);
  const w = [];
  const [sa, so] = route.coords[0];
  const [ea, eo] = route.coords[route.coords.length - 1];
  const loop = Math.abs(sa - ea) < 1e-6 && Math.abs(so - eo) < 1e-6;
  w.push(`<wpt lat="${f(sa)}" lon="${f(so)}"><name>${loop ? 'התחלה / סיום' : 'התחלה'}</name><sym>Flag, Green</sym></wpt>`);
  if (!loop) w.push(`<wpt lat="${f(ea)}" lon="${f(eo)}"><name>סיום</name><sym>Flag, Red</sym></wpt>`);
  for (const p of route.pois) w.push(`<wpt lat="${f(p.lat)}" lon="${f(p.lon)}"><name>${esc(p.name)}</name><type>${esc((POI_TYPES[p.type]?.he || '') + (p.auth ? ' · מורשה (' + p.auth + ')' : ''))}</type>${p.type === 'nightcamp' ? '<sym>Campground</sym>' : ''}</wpt>`);
  const seg = cs => cs.map(([a, o]) => `<trkpt lat="${f(a)}" lon="${f(o)}"></trkpt>`).join('\n');
  const trks = route.days && route.days.length > 1
    ? route.days.map((d, k) => `<trk><name>${esc(`יום ${k + 1}${d.camp ? ' → ' + d.camp.name : ''}`)}</name><trkseg>\n${seg(route.coords.slice(d.from, d.to + 1))}\n</trkseg></trk>`).join('\n')
    : `<trk><name>${esc(title)}</name><trkseg>\n${seg(route.coords)}\n</trkseg></trk>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Off-road Planner" xmlns="http://www.topografix.com/GPX/1/1">
<metadata><name>${esc(title)}</name></metadata>
${w.join('\n')}
${trks}
</gpx>`;
}

// Fallback Hebrew parser when no API key
function parseLocal(text) {
  const t = text || '';
  const p = { start: null, end: null, loop: false, duration_hours: null, distance_km: null, difficulty: 'medium', vehicle: 'raised', poi_types: [], via: [], avoid_asphalt: false, military_mode: 'auto', allow_area_a: false };
  let m;
  if ((m = t.match(/(\d+(?:\.\d+)?)\s*שע/))) p.duration_hours = +m[1];
  else if (/שעתיים/.test(t)) p.duration_hours = 2;
  else if (/חצי יום/.test(t)) p.duration_hours = 4;
  else if (/יום שלם|כל היום|יום נסיעה|יום טיול/.test(t)) p.duration_hours = 7;
  else if (/שעה/.test(t)) p.duration_hours = 1;
  if ((m = t.match(/(\d+)\s*(ק"מ|קמ|קילומטר|km)/i))) p.distance_km = +m[1];
  const HEB_N = { 'שני': 2, 'שתי': 2, 'שלושה': 3, 'שלוש': 3, 'ארבעה': 4, 'ארבע': 4, 'חמישה': 5, 'חמש': 5 };
  if ((m = t.match(/(\d+)\s*ימים/))) p.days = +m[1];
  else if ((m = t.match(/(שני|שתי|שלושה|שלוש|ארבעה|ארבע|חמישה|חמש)\s*ימים/))) p.days = HEB_N[m[1]];
  else if (/יומיים/.test(t)) p.days = 2;
  else if (/סופ"?ש|סוף שבוע|שישי.?שבת/.test(t)) p.days = 2;
  if (p.days > 1) { if (!p.poi_types.includes('nightcamp')) p.poi_types.push('nightcamp'); if ((m = t.match(/(\d+)\s*שעות\s*(ביום|כל יום|ליום)/))) p.hours_per_day = +m[1]; p.duration_hours = null; }
  if (/קל|משפחת|ילדים/.test(t)) p.difficulty = 'easy';
  if (/קשה|אתגר|טכני|מאתגר/.test(t)) p.difficulty = 'hard';
  if (/סטוק|מקורי|רכב רגיל|פנאי/.test(t)) p.vehicle = 'stock';
  if (/נעילות|נעילה|ספיישל|ספישל/.test(t)) p.vehicle = 'lockers';
  if (/תצפית|נוף/.test(t)) p.poi_types.push('viewpoint');
  if (/מעיין|עין /.test(t)) p.poi_types.push('spring');
  if (/חניון לילה|חניוני לילה|לינה|ללון|קמפינג|לישון/.test(t)) p.poi_types.push('nightcamp');
  if (/פיקניק|חניון יום|(?<!חניון )חניון(?! לילה)/.test(t) && !/חניון לילה/.test(t)) p.poi_types.push('camp');
  if (/פסגה|פסגות/.test(t)) p.poi_types.push('peak');
  if (/עתיק|היסטור|ארכיאולוג/.test(t)) p.poi_types.push('historic');
  if (/(^|\s)(גב|גבים|בור מים|בורות מים)(?=\s|,|$)/.test(t)) p.poi_types.push('water');
  if (/בלי כביש|בלי אספלט|רק עפר|רק שטח/.test(t)) p.avoid_asphalt = true;
  const STOP = /^(סלול|עגלי|אתגר|וגבה|עיין|ים|קורי|כונית|שפחתי|דרום|צפון)/;
  const place = '([\\u0590-\\u05FF"\'\\- ]{2,25}?)(?=\\s*(?:,|\\.|$|\\sעם|\\sשל|\\sל|\\sעד|\\sו))';
  if ((m = t.match(new RegExp('(?:מאזור|באזור|ליד|סביב|יציאה מ|יוצאים מ|מתחילים ב|התחלה ב)\\s*' + place)))) p.start = { name: m[1].trim() };
  else if ((m = t.match(new RegExp('(?:^|\\s)מ' + place))) && !STOP.test(m[1])) p.start = { name: m[1].trim() };
  if ((m = t.match(/\sעד\s([֐-׿"'\- ]{2,25}?)(?=\s*(?:,|\.|$|\sעם|\sשל|\sו))/))) { p.end = { name: m[1].trim() }; p.loop = false; }
  if (p.end) p.end.name = p.end.name.replace(/\s+דרך\s.*$/, '').trim();
  // Fallback: find known places anywhere in the text (handles ב/מ/ל prefixes)
  const found = [];
  for (const k of Object.keys(PLACES)) { const i = t.indexOf(k); if (i >= 0) found.push({ k, i, j: i + k.length }); }
  found.sort((x, y) => x.i - y.i || y.k.length - x.k.length);
  const hits = found.filter((f, n) => !found.some((g, m) => m !== n && g.i <= f.i && g.j >= f.j && g.k.length > f.k.length));
  const untilIdx = t.search(/\sעד\s/);
  const REGIONS = ['מדבר יהודה', 'הר יהודה', 'רמת הגולן', 'גולן', 'הר הנגב', 'כרמל', 'הרי אילת', 'רמת מנשה'];
  if (p.start) { const h = hits.find(h => h.k.length > p.start.name.length && h.k.includes(p.start.name)); if (h) p.start = { name: h.k }; }
  if (!p.start || !lookupPlace(p.start.name)) { const h = hits.find(h => untilIdx < 0 || h.i < untilIdx); if (h) p.start = { name: h.k }; }
  if (untilIdx >= 0 && (!p.end || !lookupPlace(p.end.name))) { const h = hits.find(h => h.i > untilIdx); if (h) { p.end = { name: h.k }; p.loop = false; } }
  const viaIdx = t.search(/\sדרך\s/);
  if (viaIdx >= 0) for (const h of hits) if (h.i > viaIdx && !REGIONS.includes(h.k) && h.k !== p.start?.name && h.k !== p.end?.name) p.via.push({ name: h.k });
  p.loop = /לופ|מעגל|מעגלי|חזרה ל|חוזר ל|הלוך.?חזור/.test(t) && !p.end;
  const today = new Date(); const iso = d => d.toISOString().slice(0, 10);
  if (/היום/.test(t)) p.date = iso(today);
  else if (/מחר/.test(t)) { const d = new Date(today); d.setDate(d.getDate() + 1); p.date = iso(d); }
  else if (/שישי/.test(t)) { const d = new Date(today); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7)); p.date = iso(d); }
  else p.date = nextSaturday(today);
  if (/כולל שטחי? אש|גם בשטח אש/.test(t)) p.military_mode = 'allow';
  if (/בלי שטחי? אש|לא בשטח אש/.test(t)) p.military_mode = 'avoid';
  if (/(כולל|לפתוח|לאפשר|גם ב|מותר)\s*(את\s*)?שטח(י)?\s*(A|א'|א׳)(?![a-z\u0590-\u05FF])/i.test(t)) p.allow_area_a = true;
  return p;
}

if (typeof module !== 'undefined') module.exports = { planMulti, addDays, campAuth, KNOWN_CAMPS, AREA_A, inAreaA, lookupPlace, dayInfo, resolveMilitary, nextSaturday, buildGraph, plan, nearestNode, factors, toGPX, parseLocal, targetLengthM, wayInfo, POI_TYPES };
// ===== END ENGINE =====
