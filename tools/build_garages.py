#!/usr/bin/env python3
"""Toyota dealers and workshops from OpenStreetMap, worldwide, as one small file for the app:
{"built": iso, "items": [[lat, lon, {name, kind, addr, city, country, phone, website, email, hours}], ...]}
Asked from the public Overpass servers in regional boxes, with retries across mirrors."""
import json, sys, time, urllib.parse, urllib.request, datetime

MIRRORS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
# (south, west, north, east): Europe in four, then the rest of the world
# smaller boxes where shops are dense (Europe, east Asia, north America): a heavy query times out on a busy server
def grid(s, w, n, e, rows, cols): return [(s + (n - s) * i / rows, w + (e - w) * j / cols, s + (n - s) * (i + 1) / rows, w + (e - w) * (j + 1) / cols) for i in range(rows) for j in range(cols)]
BOXES = (grid(34, -25, 72, 45, 3, 4) + [(-36, -25, 34, 65)] + grid(34, 45, 72, 180, 1, 2) + grid(-12, 65, 34, 180, 2, 2)
         + [(-60, 65, -12, 180), (-60, -180, 15, -25)] + grid(15, -180, 72, -25, 2, 3))
SKIP = ("material handling", "forklift", "gabelstapler", "chariot", "carretilla", "rent a car", "rental", "tsusho")

def ask(q):
    last = None
    for attempt in range(12):
        url = MIRRORS[attempt % len(MIRRORS)]
        try:
            req = urllib.request.Request(url, data=urllib.parse.urlencode({"data": q}).encode(), headers={"User-Agent": "offroad-planner garages build (github.com/chemik13/offroad)"})
            with urllib.request.urlopen(req, timeout=240) as r:
                j = json.loads(r.read().decode())
            if "elements" in j and not (j.get("remark") or "").startswith("runtime error"): return j["elements"]
            last = j.get("remark")
        except Exception as e: last = e
        print(f"  retry ({last})", file=sys.stderr); time.sleep(min(180, 20 + 20 * attempt))
    raise SystemExit(f"Overpass failed: {last}")

def first(t, *keys):
    for k in keys:
        if t.get(k): return t[k].strip()
    return ""

def item(e):
    t = e.get("tags") or {}
    la, lo = (e.get("lat"), e.get("lon")) if e["type"] == "node" else ((e.get("center") or {}).get("lat"), (e.get("center") or {}).get("lon"))
    if la is None: return None
    label = " ".join(t.get(k, "") for k in ("name", "brand", "operator", "description")).lower()
    if "toyota" not in label and t.get("brand:wikidata") != "Q53268": return None
    if any(s in label for s in SKIP): return None
    repair = t.get("shop") == "car_repair" or t.get("service:vehicle:car_repair") == "yes" or t.get("car_repair") == "yes"
    street = " ".join(x for x in (first(t, "addr:street"), first(t, "addr:housenumber")) if x)
    o = {"name": first(t, "name:en", "int_name", "name", "brand", "operator") or "Toyota", "kind": "repair" if repair else "dealer",
         "addr": street or first(t, "addr:full"), "city": first(t, "addr:city", "addr:town", "addr:village", "addr:place"), "country": first(t, "addr:country"),
         "phone": first(t, "phone", "contact:phone", "contact:mobile"), "website": first(t, "website", "contact:website", "url"),
         "email": first(t, "email", "contact:email"), "hours": first(t, "opening_hours:workshop", "opening_hours:repair", "opening_hours")}
    return [round(la, 5), round(lo, 5), {k: v for k, v in o.items() if v}]

def main(out):
    seen, items = set(), []
    for s, w, n, e in BOXES:
        b = f"({s},{w},{n},{e})"
        q = ('[out:json][timeout:180];(' + "".join(f'nwr["shop"~"^(car|car_repair)$"]{f}{b};' for f in ('["brand"~"toyota",i]', '["name"~"toyota",i]', '["operator"~"toyota",i]', '["brand:wikidata"="Q53268"]')) + ');out center tags;')
        els = ask(q); kept = 0
        for el in els:
            key = (el["type"], el["id"])
            if key in seen: continue
            seen.add(key); it = item(el)
            if it: items.append(it); kept += 1
        print(f"{b}: {len(els)} found, {kept} kept"); time.sleep(5)
    if len(items) < 1500: raise SystemExit(f"only {len(items)} garages: not publishing")
    json.dump({"built": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "items": items}, open(out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"{len(items)} garages -> {out}")

if __name__ == "__main__": main(sys.argv[1])
