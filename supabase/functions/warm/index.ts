// Background trail-data warmer. Called by pg_cron every few minutes: takes the most-due area from
// public.tile_queue, downloads it from Overpass, compacts it exactly like the app does
// (src/engine.js splitToTiles, format v2) and stores it in the shared tile cache.
// One area per call keeps us gentle on the public Overpass servers and inside the edge time limit.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const TILE = 0.25;
const REFRESH_DAYS = 21;
const MIRRORS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

// --- must stay identical to src/app.html overpassQuery() and src/engine.js POI_TYPES ---
const POI_Q = ['node["tourism"="viewpoint"]', 'node["natural"="spring"]', 'nwr["tourism"="camp_site"]', 'node["tourism"="picnic_site"]', 'node["natural"="peak"]["name"]', 'node["historic"]["name"]', 'node["natural"="water"]["name"]'];
function overpassQuery(bb: string) {
  return `[out:json][timeout:120];
(way["highway"~"^(track|unclassified|tertiary|secondary|primary|trunk|tertiary_link|secondary_link|primary_link|trunk_link)$"](${bb});way["highway"~"^(path|service)$"]["motor_vehicle"!~"no|private"]["surface"~"^(unpaved|gravel|fine_gravel|dirt|ground|sand|compacted|rock|pebblestone|earth|mud)$"](${bb});way["highway"="path"]["4wd_only"="yes"](${bb}););out geom qt;
(${POI_Q.map((q) => q + `(${bb});`).join("")});out center qt;
(way["landuse"="military"](${bb});relation["landuse"="military"](${bb});way["military"~"^(danger_area|training_area|range)$"](${bb});relation["military"~"^(danger_area|training_area|range)$"](${bb}););out geom qt;`;
}
// --- port of src/engine.js splitToTiles for a single tile ---
const WAY_TAGS = ["highway", "tracktype", "surface", "smoothness", "4wd_only", "access", "motor_vehicle", "motorcar", "vehicle", "oneway", "name", "name:he", "ref"];
const POI_TAGS = ["tourism", "natural", "historic", "name", "name:he", "image", "wikimedia_commons", "wikidata", "operator", "owner", "operator:he", "operator:en", "fee", "drinking_water", "toilets"];
const MIL_TAGS = ["landuse", "military", "name", "name:en"];
const pick = (t: any, keys: string[]) => { const o: any = {}; for (const k of keys) if (t[k] != null) o[k] = t[k]; return o; };
const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
const flatGeom = (g: any[]) => { const f: number[] = []; for (const p of g || []) if (p) f.push(r6(p.lat), r6(p.lon)); return f; };
const geomBox = (f: number[]) => { let s = 90, n = -90, w = 180, e = -180; for (let i = 0; i < f.length; i += 2) { if (f[i] < s) s = f[i]; if (f[i] > n) n = f[i]; if (f[i + 1] < w) w = f[i + 1]; if (f[i + 1] > e) e = f[i + 1]; } return [s, w, n, e]; };
const boxHit = (a: number[], b: number[]) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
function compactTile(elements: any[], box: number[]) {
  const out: any = { w: [], p: [], m: [] };
  const isMil = (t: any) => t && (t.landuse === "military" || t.military);
  for (const el of elements) {
    const t = el.tags || {};
    if (el.type === "way" && t.highway && el.geometry) {
      const f = flatGeom(el.geometry); if (boxHit(geomBox(f), box)) out.w.push([el.id, el.nodes, f, pick(t, WAY_TAGS)]);
    } else if (isMil(t) && (el.geometry || el.members)) {
      const rings = el.type === "way" ? [flatGeom(el.geometry)] : (el.members || []).filter((m: any) => m.role !== "inner" && m.geometry && m.geometry.length > 3).map((m: any) => flatGeom(m.geometry));
      if (rings.length && boxHit(geomBox(rings.flat()), box)) out.m.push([el.type[0] + el.id, rings, pick(t, MIL_TAGS)]);
    } else if (el.type === "node" || el.center) {
      const la = el.type === "node" ? el.lat : el.center.lat, lo = el.type === "node" ? el.lon : el.center.lon;
      if (la >= box[0] && la < box[2] && lo >= box[1] && lo < box[3]) out.p.push([el.type[0], el.id, r6(la), r6(lo), pick(t, POI_TAGS)]);
    }
  }
  return out;
}
async function gzip(s: string) {
  return new Uint8Array(await new Response(new Blob([s]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
}

Deno.serve(async (req) => {
  const t0 = Date.now();
  const { data: cfg } = await db.from("app_config").select("v").eq("k", "warm_token").single();
  if (!cfg || req.headers.get("x-warm-token") !== cfg.v) return new Response("no", { status: 401 });

  // most-due area (never fetched first, by priority; then oldest), claimed atomically
  const { data: rows, error: pickErr } = await db.rpc("pick_due_tile", { refresh_days: REFRESH_DAYS });
  if (pickErr) return Response.json({ ok: false, err: pickErr.message }, { status: 500 });
  const row = rows?.[0];
  if (!row) return Response.json({ ok: true, idle: true });

  const box = [row.i * TILE, row.j * TILE, (row.i + 1) * TILE, (row.j + 1) * TILE];
  const q = overpassQuery(box.map((x) => +x.toFixed(4)).join(","));
  let elements: any[] | null = null, used = "", err = "";
  for (const m of MIRRORS) {
    if (Date.now() - t0 > 60_000) break;
    try {
      const r = await fetch(m, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "offroad-planner/1.0 (background cache, 1 req / 3 min)" }, signal: AbortSignal.timeout(80_000) });
      if (!r.ok) { err = `${m} ${r.status}`; continue; }
      const j = await r.json();
      if (j.remark && /runtime error|timed out|out of memory/i.test(j.remark)) { err = `${m} ${j.remark}`.slice(0, 200); continue; }
      elements = j.elements; used = m; break;
    } catch (e) { err = `${m} ${(e as Error).message}`.slice(0, 200); }
  }
  if (!elements) {
    await db.from("tile_queue").update({ fails: row.fails + 1 }).eq("key", row.key);
    console.error("warm fail", row.key, err);
    return Response.json({ ok: false, key: row.key, err });
  }
  const tile = { ...compactTile(elements, box), at: Date.now(), key: row.key };
  const gz = await gzip(JSON.stringify(tile));
  const { error } = await db.storage.from("osm-tiles").upload(row.key + ".json.gz", gz, { upsert: true, contentType: "application/gzip" });
  if (error) { console.error("upload", row.key, error.message); return Response.json({ ok: false, key: row.key, err: error.message }); }
  await db.from("tile_queue").update({ last_ok: new Date().toISOString(), fails: 0, bytes: gz.length }).eq("key", row.key);
  return Response.json({ ok: true, key: row.key, ways: tile.w.length, pois: tile.p.length, mil: tile.m.length, kb: Math.round(gz.length / 1024), via: used, ms: Date.now() - t0 });
});
