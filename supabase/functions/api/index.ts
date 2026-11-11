// Off-road planner API: Claude prompt parsing (server-side key), shared route library, GPX/KML import proxy.
// Access is gated by a shared group code (env GROUP_CODE) sent in the x-group-code header.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const MODEL = "claude-sonnet-5-5"; // trip parsing needs world knowledge (history, trails) + web search
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-group-code, authorization, apikey",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "x-tile-updated",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json; charset=utf-8" } });

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const LIST_FIELDS = "id,created_at,name,created_by,source,region,tags,notes,driven,stats,offroad_url,trip_id,version,change";
const EDITABLE = ["name", "tags", "notes", "driven", "region", "offroad_url"];
const TRIP_WIDE = ["name", "tags", "notes", "driven", "region"]; // the same for every version of a trip
const CONTENT = ["coords", "waypoints", "stats", "params"]; // the chosen alternative of this version

// Daily caps protect the owner's API key if the group code leaks. Limits live in app_config (cap_*).
const capCache: Record<string, { v: number; t: number }> = {};
async function cap(kind: string, dflt: number) {
  const c = capCache[kind];
  if (c && Date.now() - c.t < 300_000) return c.v;
  const { data } = await db.from("app_config").select("v").eq("k", "cap_" + kind).maybeSingle();
  const v = Number(data?.v) || dflt; capCache[kind] = { v, t: Date.now() }; return v;
}
async function underQuota(kind: string, dflt: number) {
  const { data, error } = await db.rpc("use_quota", { k: kind, cap: await cap(kind, dflt) });
  return error ? true : data === true; // never block on a counting failure
}
const overQuota = (what: string) => json({ error: `הגעתם למכסה היומית של ${what}. היא מתאפסת בחצות.`, quota: true }, 429);

function privateHost(h: string) {
  return /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?|.*\.internal$|.*\.local$)/i.test(h);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/api/, "") || "/";

  if (path === "/health") {
    return json({ ok: true, claude: !!Deno.env.get("ANTHROPIC_API_KEY"), group: !!Deno.env.get("GROUP_CODE") });
  }

  const code = Deno.env.get("GROUP_CODE");
  if (!code || req.headers.get("x-group-code") !== code) return json({ error: "קוד קבוצה שגוי" }, 401);

  try {
    // ---- thin Claude proxy: the client runs the tool loop; model, size and tool types are fixed here ----
    if (path === "/claude" && req.method === "POST") {
      const key = Deno.env.get("ANTHROPIC_API_KEY");
      if (!key) return json({ error: "מפתח Claude לא הוגדר בשרת" }, 503);
      if (!(await underQuota("claude", 150))) return overQuota("פענוח חכם");
      const b = await req.json();
      const tools = (Array.isArray(b.tools) ? b.tools : []).filter((t: any) => t && (t.input_schema || (t.type && /^web_search_\d+$/.test(t.type))))
        .map((t: any) => t.type ? { type: t.type, name: "web_search", max_uses: Math.min(4, t.max_uses || 3) } : t); // note: user_location country IL is rejected by the API
      if (!Array.isArray(b.messages) || !b.messages.length || JSON.stringify(b.messages).length > 200_000) return json({ error: "בקשה לא תקינה" }, 400);
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: MODEL, max_tokens: Math.min(8000, b.max_tokens || 1500), system: String(b.system || "").slice(0, 6000), messages: b.messages, tools, ...(b.tool_choice?.type === "auto" ? { tool_choice: { type: "auto" } } : {}) }), // this model rejects forced tool_choice
      });
      const j = await r.json();
      if (!r.ok) {
        console.error("claude error", r.status, MODEL, JSON.stringify(j?.error || j).slice(0, 800), "tools:", tools.map((t: any) => t.type || t.name).join(","));
        return json({ error: "שגיאה מ-Claude", status: r.status, detail: j?.error?.message }, r.status === 400 ? 400 : 502);
      }
      console.log("claude ok", j?.stop_reason, JSON.stringify(j?.usage || {}), (j?.content || []).map((c: any) => c.type).join(","));
      return json(j);
    }

    // ---- Overpass relay: a second network path to OSM (own IP, own server slots); bytes pass through unparsed ----
    if (path === "/overpass" && req.method === "POST") {
      if (!(await underQuota("overpass", 400))) return overQuota("הורדות שבילים דרך השרת");
      const { q } = await req.json();
      if (typeof q !== "string" || q.length > 4000 || !q.startsWith("[out:json]")) return json({ error: "bad query" }, 400);
      const mirrors = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
      for (const m of mirrors) {
        try {
          const r = await fetch(m, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "offroad-planner/1.0 (group trip planner)" }, signal: AbortSignal.timeout(100_000) });
          if (r.ok) return new Response(r.body, { headers: { ...CORS, "content-type": "application/json" } });
        } catch { /* next mirror */ }
      }
      return json({ error: "overpass busy" }, 503);
    }

    // ---- road routing relay (OSRM demo server) for long trips: only route queries, fixed options ----
    if (path === "/osrm" && req.method === "GET") {
      if (!(await underQuota("overpass", 400))) return overQuota("חישובי דרכים דרך השרת");
      const pts = url.searchParams.get("path") || "";
      if (!/^-?\d{1,3}\.\d{1,6},-?\d{1,2}\.\d{1,6}(;-?\d{1,3}\.\d{1,6},-?\d{1,2}\.\d{1,6}){1,99}$/.test(pts)) return json({ error: "bad path" }, 400);
      try {
        const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${pts}?overview=full&geometries=geojson&steps=true`, { headers: { "user-agent": "offroad-planner/1.0 (group trip planner)" }, signal: AbortSignal.timeout(40_000) });
        return new Response(r.body, { status: r.status, headers: { ...CORS, "content-type": "application/json" } });
      } catch { return json({ error: "routing busy" }, 503); }
    }

    // ---- today's usage vs caps (shown in settings) ----
    if (path === "/usage" && req.method === "GET") {
      const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
      const { data } = await db.from("usage_daily").select("kind,n").eq("day", day);
      const used = Object.fromEntries((data || []).map((r: any) => [r.kind, r.n]));
      return json({ claude: { used: used.claude || 0, cap: await cap("claude", 150) }, overpass: { used: used.overpass || 0, cap: await cap("overpass", 400) } });
    }

    // ---- import proxy (fetch GPX/KML from a link, avoiding CORS) ----
    if (path === "/import" && req.method === "POST") {
      if (!(await underQuota("import", 100))) return overQuota("ייבוא מסלולים");
      const { url: target } = await req.json();
      let u: URL;
      try { u = new URL(target); } catch { return json({ error: "לינק לא תקין" }, 400); }
      if (!/^https?:$/.test(u.protocol) || privateHost(u.hostname)) return json({ error: "לינק לא נתמך" }, 400);
      const r = await fetch(u, { redirect: "follow", headers: { "user-agent": "offroad-planner/1.0" } });
      if (!r.ok) return json({ error: `האתר החזיר ${r.status}` }, 502);
      const buf = new Uint8Array(await r.arrayBuffer());
      if (buf.length > 8_000_000) return json({ error: "הקובץ גדול מדי" }, 413);
      const text = new TextDecoder().decode(buf);
      return json({ contentType: r.headers.get("content-type"), text, finalUrl: r.url });
    }

    // ---- shared OSM tile cache (compressed, pre-processed by the client) ----
    const t = path.match(/^\/tiles\/(v\d+_-?\d{1,4}_-?\d{1,4})$/);
    if (t) {
      const key = t[1] + ".json.gz";
      const bucket = db.storage.from("osm-tiles");
      if (req.method === "GET") {
        const { data, error } = await bucket.download(key);
        if (error || !data) return json({ error: "miss" }, 404);
        return new Response(data, { headers: { ...CORS, "content-type": "application/octet-stream", "cache-control": "private, max-age=3600" } });
      }
      if (req.method === "PUT") {
        const buf = new Uint8Array(await req.arrayBuffer());
        if (buf.length < 20 || buf.length > 20_000_000 || buf[0] !== 0x1f || buf[1] !== 0x8b) return json({ error: "bad tile" }, 400);
        const { error } = await bucket.upload(key, buf, { upsert: true, contentType: "application/gzip" });
        if (error) throw error;
        return json({ ok: true });
      }
    }

    // ---- route library ----
    // ---- versions of one trip ----
    const mv = path.match(/^\/routes\/([0-9a-f-]{36})\/versions$/);
    if (mv && req.method === "GET") {
      const { data: one, error: e1 } = await db.from("routes").select("trip_id").eq("id", mv[1]).single();
      if (e1 || !one) return json({ error: "המסלול לא נמצא" }, 404);
      const { data, error } = await db.from("routes").select("id,version,created_at,change,created_by,stats").eq("trip_id", one.trip_id).order("version", { ascending: false }).limit(200);
      if (error) throw error;
      return json({ versions: data });
    }

    const m = path.match(/^\/routes(?:\/([0-9a-f-]{36}))?$/);
    if (m) {
      const id = m[1];
      if (req.method === "GET" && !id) { // the library: latest version of every trip
        const { data, error } = await db.from("routes_latest").select(LIST_FIELDS + ",versions,first_at").order("created_at", { ascending: false }).limit(300);
        if (error) throw error;
        return json({ routes: data });
      }
      if (req.method === "GET" && id) {
        const { data, error } = await db.from("routes").select("*").eq("id", id).single();
        if (error) return json({ error: "המסלול לא נמצא" }, 404);
        return json({ route: data });
      }
      if (req.method === "POST" && !id) {
        const b = await req.json();
        if (!b.name || !Array.isArray(b.coords) || b.coords.length < 2 || b.coords.length > 50000) return json({ error: "מסלול לא תקין" }, 400);
        const row = {
          name: String(b.name).slice(0, 200), created_by: b.created_by ? String(b.created_by).slice(0, 60) : null,
          source: b.source === "imported" ? "imported" : "planned", source_url: b.source_url || null,
          prompt: b.prompt ? String(b.prompt).slice(0, 2000) : null, params: b.params || null,
          coords: b.coords, waypoints: Array.isArray(b.waypoints) ? b.waypoints.slice(0, 500) : [],
          stats: b.stats || {}, region: b.region || null, tags: Array.isArray(b.tags) ? b.tags.slice(0, 20).map(String) : [],
          notes: b.notes ? String(b.notes).slice(0, 4000) : null,
          change: b.change ? String(b.change).slice(0, 300) : null,
        };
        // a new version of an existing trip, or a new trip
        if (b.trip_id && /^[0-9a-f-]{36}$/.test(String(b.trip_id))) {
          const { data: last } = await db.from("routes").select("version").eq("trip_id", b.trip_id).order("version", { ascending: false }).limit(1).maybeSingle();
          if (!last) return json({ error: "הטיול לא נמצא" }, 404);
          Object.assign(row, { trip_id: b.trip_id, version: last.version + 1 });
        } else { const nid = crypto.randomUUID(); Object.assign(row, { id: nid, trip_id: nid, version: 1 }); }
        const { data, error } = await db.from("routes").insert(row).select(LIST_FIELDS).single();
        if (error) throw error;
        return json({ route: data }, 201);
      }
      if (req.method === "PATCH" && id) {
        const b = await req.json();
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const k of EDITABLE) if (k in b) patch[k] = b[k];
        if (Array.isArray(b.coords) && b.coords.length >= 2 && b.coords.length <= 50000) for (const k of CONTENT) if (k in b) patch[k] = b[k];
        const wide: Record<string, unknown> = {}; for (const k of TRIP_WIDE) if (k in b) wide[k] = b[k];
        if (Object.keys(wide).length) { const { data: one } = await db.from("routes").select("trip_id").eq("id", id).single(); if (one) await db.from("routes").update(wide).eq("trip_id", one.trip_id); }
        if ("offroad_url" in patch && patch.offroad_url !== null && !/^https:\/\/off-road\.io\/track\/\d{6,24}$/.test(String(patch.offroad_url))) return json({ error: "קישור Off-Road לא תקין" }, 400);
        const { data, error } = await db.from("routes").update(patch).eq("id", id).select(LIST_FIELDS).single();
        if (error) throw error;
        return json({ route: data });
      }
      if (req.method === "DELETE" && id) { // the whole trip, all its versions
        const { data: one } = await db.from("routes").select("trip_id").eq("id", id).single();
        const { error } = one ? await db.from("routes").delete().eq("trip_id", one.trip_id) : await db.from("routes").delete().eq("id", id);
        if (error) throw error;
        return json({ ok: true });
      }
    }

    // ---- preferred tracks for the group (GPX one person uploads once; the planner prefers trails on them) ----
    if (path === "/tracks" && req.method === "GET") {
      const full = url.searchParams.get("full") === "1";
      const { data, error } = await db.from("pref_tracks").select(full ? "name,km,created_by,created_at,pts" : "name,km,created_by,created_at").order("name");
      if (error) throw error;
      return json({ tracks: data });
    }
    if (path === "/tracks" && req.method === "POST") {
      const b = await req.json();
      const name = String(b.name || "").slice(0, 120).trim();
      if (!name || !Array.isArray(b.pts) || b.pts.length < 4 || b.pts.length > 4_000_000 || b.pts.some((x: unknown) => typeof x !== "number")) return json({ error: "מסלול לא תקין" }, 400);
      const { error } = await db.from("pref_tracks").upsert({ name, pts: b.pts, km: Math.round(Number(b.km) || 0), created_by: b.created_by ? String(b.created_by).slice(0, 60) : null, created_at: new Date().toISOString() });
      if (error) throw error;
      return json({ ok: true }, 201);
    }
    const tk = path.match(/^\/tracks\/(.+)$/);
    if (tk && req.method === "DELETE") {
      const { error } = await db.from("pref_tracks").delete().eq("name", decodeURIComponent(tk[1]));
      if (error) throw error;
      return json({ ok: true });
    }

    // ---- field reports (closed / harder / easier segments) ----
    if (path === "/reports" && req.method === "GET") {
      const b = ["s", "w", "n", "e"].map((k) => Number(url.searchParams.get(k)));
      if (b.some((x) => !isFinite(x))) return json({ error: "חסר תחום" }, 400);
      const { data, error } = await db.from("route_reports").select("*")
        .gte("lat", b[0]).lte("lat", b[2]).gte("lon", b[1]).lte("lon", b[3]).limit(1000);
      if (error) throw error;
      return json({ reports: data });
    }
    if (path === "/reports" && req.method === "POST") {
      const b = await req.json();
      const { data, error } = await db.from("route_reports").insert({
        route_id: b.route_id || null, lat: +b.lat, lon: +b.lon, kind: b.kind,
        note: b.note ? String(b.note).slice(0, 1000) : null, created_by: b.created_by ? String(b.created_by).slice(0, 60) : null,
      }).select("*").single();
      if (error) throw error;
      return json({ report: data }, 201);
    }

    return json({ error: "not found" }, 404);
  } catch (e) {
    return json({ error: "שגיאת שרת", detail: String((e as Error)?.message || e) }, 500);
  }
});
