#!/usr/bin/env python3
"""Toyota dealers and workshops from OpenStreetMap, worldwide, as one small file for the app:
{"built": iso, "items": [[lat, lon, {name, kind, addr, city, country, phone, website, email, hours}], ...]}
Asked from the public Overpass servers in regional boxes, with retries across mirrors.
Each box's answer is kept beside the file, so a run that the servers cut short is continued by the next one."""
import json, os, sys, time, urllib.parse, urllib.request, datetime

MIRRORS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
# (south, west, north, east): Europe in four, then the rest of the world
# smaller boxes where shops are dense (Europe, east Asia, north America): a heavy query times out on a busy server
def grid(s, w, n, e, rows, cols): return [(s + (n - s) * i / rows, w + (e - w) * j / cols, s + (n - s) * (i + 1) / rows, w + (e - w) * (j + 1) / cols) for i in range(rows) for j in range(cols)]
BOXES = (grid(34, -25, 72, 45, 3, 4) + [(-36, -25, 34, 65)] + grid(34, 45, 72, 180, 1, 2) + grid(-12, 65, 34, 180, 2, 2)
         + [(-60, 65, -12, 180), (-60, -180, 15, -25)] + grid(15, -180, 72, -25, 2, 3))
SKIP = ("material handling", "forklift", "gabelstapler", "chariot", "carretilla", "rent a car", "rental", "tsusho")

VER = 2            # bump when item() changes what it keeps: parts built by an older version are asked again
FRESH = 25 * 86400  # a part younger than this is not asked again
BUDGET = 200 * 60   # seconds for the whole run; what was fetched is published even when some boxes are still missing

def ask(q, deadline):
    """Elements, or None when the servers kept failing (the box is tried again later in the run, or in the next run)."""
    last = None
    for attempt in range(4):
        if time.time() > deadline: return None
        url = MIRRORS[attempt % len(MIRRORS)]
        try:
            req = urllib.request.Request(url, data=urllib.parse.urlencode({"data": q}).encode(), headers={"User-Agent": "offroad-planner garages build (github.com/chemik13/offroad)"})
            with urllib.request.urlopen(req, timeout=240) as r:
                j = json.loads(r.read().decode())
            if "elements" in j and not (j.get("remark") or "").startswith("runtime error"): return j["elements"]
            last = j.get("remark")
        except Exception as e: last = e
        print(f"  retry ({last})", file=sys.stderr); time.sleep(20 + 20 * attempt)
    return None

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
    """out/parts/<box>.json holds each box's answer, so a run continues from where the last one stopped.
    out/toyota.json is rewritten only when every box has an answer (a fresh one, or failing that an older one)."""
    parts = os.path.join(out, "parts"); os.makedirs(parts, exist_ok=True)
    deadline, now, have, changed = time.time() + BUDGET, time.time(), {}, False
    def path(b): return os.path.join(parts, "_".join(str(round(x, 2)) for x in b) + ".json")
    todo = []
    for b in BOXES:
        try: p = json.load(open(path(b), encoding="utf-8"))
        except Exception: p = None
        if p: have[b] = p
        if not p or p.get("v") != VER or now - p.get("at", 0) > FRESH: todo.append(b)
    print(f"{len(BOXES) - len(todo)} boxes up to date, {len(todo)} to ask")
    while todo and time.time() < deadline:
        left = []
        for b in todo:
            box = "(%s,%s,%s,%s)" % b
            q = ('[out:json][timeout:180];(' + "".join(f'nwr["shop"~"^(car|car_repair)$"]{f}{box};' for f in ('["brand"~"toyota",i]', '["name"~"toyota",i]', '["operator"~"toyota",i]', '["brand:wikidata"="Q53268"]')) + ');out center tags;')
            els = ask(q, deadline)
            if els is None: left.append(b); print(f"{box}: no answer, later"); continue
            rows = [[el["type"], el["id"], it] for el in els for it in [item(el)] if it]
            have[b] = {"v": VER, "at": int(time.time()), "items": rows}; changed = True
            json.dump(have[b], open(path(b), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
            print(f"{box}: {len(els)} found, {len(rows)} kept", flush=True); time.sleep(5)
        todo = left
        if todo and time.time() < deadline: time.sleep(120)
    if os.environ.get("GITHUB_OUTPUT") and changed: open(os.environ["GITHUB_OUTPUT"], "a").write("changed=1\n")
    missing = [b for b in BOXES if b not in have]
    if missing: raise SystemExit(f"{len(missing)} boxes still without an answer: parts saved, toyota.json left as it was")
    if todo: print(f"{len(todo)} boxes use their older answer; the next run asks them again")
    if not changed: print("nothing new"); return
    seen, items = set(), []
    for b in BOXES:
        for tp, id_, it in have[b]["items"]:
            if (tp, id_) not in seen: seen.add((tp, id_)); items.append(it)
    if len(items) < 1500: raise SystemExit(f"only {len(items)} garages: not publishing")
    built = datetime.datetime.fromtimestamp(max(p["at"] for p in have.values()), datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    json.dump({"built": built, "items": items}, open(os.path.join(out, "toyota.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"{len(items)} garages -> toyota.json")

if __name__ == "__main__": main(sys.argv[1])
