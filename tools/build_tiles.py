#!/usr/bin/env python3
"""Build the app's trail-data tiles from an OSM extract (e.g. Geofabrik israel-and-palestine-latest.osm.pbf).

Output matches the app's compact tile format v3 (see splitToTiles in src/engine.js):
  out/v3_<i>_<j>.json.gz  ->  {"w": [[id, nodeIds, flatLatLon, tags]], "p": [[t, id, lat, lon, tags]],
                               "m": [[id, [flatRing, ...], tags]], "at": ms, "key": "v3_i_j"}
(m holds military areas and nature reserves; p includes fuel, drinking water and caravan sites)
plus out/index.json. The selection mirrors overpassQuery() in src/app.html.

usage: build_tiles.py <extract.osm.pbf> <out_dir>
"""
import gzip, json, math, os, sys, time
import osmium

TILE = 0.25
VER = "v3"
BBOX = (29.3, 34.1, 33.5, 36.0)  # s, w, n, e: Israel incl. Golan, Judea & Samaria, Arava

MAIN_HW = {"track", "unclassified", "tertiary", "secondary", "primary", "trunk", "tertiary_link", "secondary_link", "primary_link", "trunk_link"}
UNPAVED = {"unpaved", "gravel", "fine_gravel", "dirt", "ground", "sand", "compacted", "rock", "pebblestone", "earth", "mud"}
WAY_TAGS = ["highway", "tracktype", "surface", "smoothness", "4wd_only", "access", "motor_vehicle", "motorcar", "vehicle", "oneway", "name", "name:he", "ref"]
POI_TAGS = ["amenity", "brand", "backcountry", "group_only", "website", "access", "tourism", "natural", "historic", "name", "name:he", "image", "wikimedia_commons", "wikidata", "operator", "owner", "operator:he", "operator:en", "fee", "drinking_water", "toilets"]
MIL_TAGS = ["landuse", "military", "leisure", "boundary", "protect_class", "name", "name:he", "name:en"]
MIL_KINDS = {"danger_area", "training_area", "range"}


def r6(x): return round(x, 6)
def pick(tags, keys): return {k: tags[k] for k in keys if k in tags}
def tile_of(lat, lon): return math.floor(lat / TILE), math.floor(lon / TILE)
def key(i, j): return f"{VER}_{i}_{j}"


def keep_way(t):
    hw = t.get("highway")
    if not hw: return False
    if hw in MAIN_HW: return True
    if hw in ("path", "service") and t.get("motor_vehicle") not in ("no", "private") and t.get("surface") in UNPAVED: return True
    if hw == "path" and t.get("4wd_only") == "yes": return True
    return False


def poi_node(t):
    return (t.get("tourism") in ("viewpoint", "camp_site", "caravan_site", "picnic_site") or t.get("amenity") in ("fuel", "drinking_water") or t.get("natural") == "spring"
            or (t.get("natural") in ("peak", "water") and "name" in t) or ("historic" in t and "name" in t))


def is_mil(t): return t.get("landuse") == "military" or t.get("military") in MIL_KINDS


def is_reserve(t):  # mirrors isReserve / RESERVE_Q in src/engine.js
    return (t.get("leisure") == "nature_reserve" or t.get("boundary") == "national_park"
            or (t.get("boundary") == "protected_area" and t.get("protect_class") in ("1a", "1b", "1", "2")))


class Builder(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.tiles = {}

    def T(self, i, j):
        k = key(i, j)
        if k not in self.tiles: self.tiles[k] = {"w": [], "p": [], "m": []}
        return self.tiles[k]

    def tiles_for_box(self, s, w, n, e):
        for i in range(math.floor(s / TILE), math.floor(n / TILE) + 1):
            for j in range(math.floor(w / TILE), math.floor(e / TILE) + 1):
                yield i, j

    def in_bbox(self, s, w, n, e): return n >= BBOX[0] and s <= BBOX[2] and e >= BBOX[1] and w <= BBOX[3]

    def node(self, n):
        t = {tg.k: tg.v for tg in n.tags}
        if not t or not poi_node(t) or not n.location.valid(): return
        la, lo = n.location.lat, n.location.lon
        if not self.in_bbox(la, lo, la, lo): return
        self.T(*tile_of(la, lo))["p"].append(["n", n.id, r6(la), r6(lo), pick(t, POI_TAGS)])

    def way(self, w):
        t = {tg.k: tg.v for tg in w.tags}
        if not keep_way(t): return
        flat, ids = [], []
        for nd in w.nodes:
            if not nd.location.valid(): return
            ids.append(nd.ref); flat += [r6(nd.location.lat), r6(nd.location.lon)]
        if len(ids) < 2: return
        lats, lons = flat[0::2], flat[1::2]
        s, n, wv, e = min(lats), max(lats), min(lons), max(lons)
        if not self.in_bbox(s, wv, n, e): return
        rec = [w.id, ids, flat, pick(t, WAY_TAGS)]
        for i, j in self.tiles_for_box(s, wv, n, e): self.T(i, j)["w"].append(rec)

    def area(self, a):
        t = {tg.k: tg.v for tg in a.tags}
        mil, camp = is_mil(t) or is_reserve(t), t.get("tourism") in ("camp_site", "caravan_site")
        if not (mil or camp): return
        rings = []
        try:
            for outer in a.outer_rings():
                rings.append([v for nd in outer for v in (r6(nd.lat), r6(nd.lon))])
        except Exception:
            return
        if not rings: return
        allv = [v for r in rings for v in r]; lats, lons = allv[0::2], allv[1::2]
        s, n, wv, e = min(lats), max(lats), min(lons), max(lons)
        if not self.in_bbox(s, wv, n, e): return
        tp = "w" if a.from_way() else "r"
        if mil:
            rec = [tp + str(a.orig_id()), rings, pick(t, MIL_TAGS)]
            for i, j in self.tiles_for_box(s, wv, n, e): self.T(i, j)["m"].append(rec)
        if camp:  # same as Overpass "out center": centre of the bounding box
            la, lo = (s + n) / 2, (wv + e) / 2
            self.T(*tile_of(la, lo))["p"].append([tp, a.orig_id(), r6(la), r6(lo), pick(t, POI_TAGS)])


def main(src, out):
    os.makedirs(out, exist_ok=True)
    t0 = time.time()
    b = Builder()
    b.apply_file(src, locations=True, idx="flex_mem")
    at = int(time.time() * 1000)
    keys, total = [], 0
    for k, tl in sorted(b.tiles.items()):
        tl.update({"at": at, "key": k})
        data = gzip.compress(json.dumps(tl, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), 9)
        with open(os.path.join(out, k + ".json.gz"), "wb") as f: f.write(data)
        keys.append(k); total += len(data)
    with open(os.path.join(out, "index.json"), "w") as f:
        json.dump({"version": VER, "at": at, "built": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "source": os.path.basename(src), "keys": keys}, f)
    print(f"{len(keys)} tiles, {total / 1e6:.1f} MB, {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
