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

const LIST_FIELDS = "id,created_at,name,created_by,source,region,tags,notes,driven,stats,offroad_url";
const EDITABLE = ["name", "tags", "notes", "driven", "region", "offroad_url"];

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
      const b = await req.json();
      const tools = (Array.isArray(b.tools) ? b.tools : []).filter((t: any) => t && (t.input_schema || (t.type && /^web_search_\d+$/.test(t.type))))
        .map((t: any) => t.type ? { type: t.type, name: "web_search", max_uses: Math.min(4, t.max_uses || 3) } : t); // note: user_location country IL is rejected by the API
      if (!Array.isArray(b.messages) || !b.messages.length || JSON.stringify(b.messages).length > 200_000) return json({ error: "בקשה לא תקינה" }, 400);
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: MODEL, max_tokens: Math.min(2500, b.max_tokens || 1500), system: String(b.system || "").slice(0, 6000), messages: b.messages, tools, ...(b.tool_choice?.type === "auto" ? { tool_choice: { type: "auto" } } : {}) }), // this model rejects forced tool_choice
      });
      const j = await r.json();
      if (!r.ok) {
        console.error("claude error", r.status, MODEL, JSON.stringify(j?.error || j).slice(0, 800), "tools:", tools.map((t: any) => t.type || t.name).join(","));
        return json({ error: "שגיאה מ-Claude", status: r.status, detail: j?.error?.message }, r.status === 400 ? 400 : 502);
      }
      return json(j);
    }

    // ---- Overpass relay: a second network path to OSM (own IP, own server slots); bytes pass through unparsed ----
    if (path === "/overpass" && req.method === "POST") {
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

    // ---- import proxy (fetch GPX/KML from a link, avoiding CORS) ----
    if (path === "/import" && req.method === "POST") {
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
    const m = path.match(/^\/routes(?:\/([0-9a-f-]{36}))?$/);
    if (m) {
      const id = m[1];
      if (req.method === "GET" && !id) {
        const { data, error } = await db.from("routes").select(LIST_FIELDS).order("created_at", { ascending: false }).limit(300);
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
        };
        const { data, error } = await db.from("routes").insert(row).select(LIST_FIELDS).single();
        if (error) throw error;
        return json({ route: data }, 201);
      }
      if (req.method === "PATCH" && id) {
        const b = await req.json();
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const k of EDITABLE) if (k in b) patch[k] = b[k];
        if ("offroad_url" in patch && patch.offroad_url !== null && !/^https:\/\/off-road\.io\/track\/\d{6,24}$/.test(String(patch.offroad_url))) return json({ error: "קישור Off-Road לא תקין" }, 400);
        const { data, error } = await db.from("routes").update(patch).eq("id", id).select(LIST_FIELDS).single();
        if (error) throw error;
        return json({ route: data });
      }
      if (req.method === "DELETE" && id) {
        const { error } = await db.from("routes").delete().eq("id", id);
        if (error) throw error;
        return json({ ok: true });
      }
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
