#!/usr/bin/env python3
"""Country shapes and land borders for the app, from Natural Earth (public domain, 1:10m), cut to Europe and the Near East.
  python3 tools/build_borders.py <ne_10m_admin_0_countries.geojson> <ne_10m_admin_0_boundary_lines_land.geojson> borders.json
Output: {"c": [[cc, english, hebrew, colour 0-6, [ring, ...]], ...], "l": [line, ...]}
A ring / line is a flat list of integers: lat*1e4, lon*1e4, then deltas. Outer rings only (enclaves are their own country's ring)."""
import json, sys

BOX = (27.0, -25.0, 72.0, 50.0)  # south, west, north, east
TOL = 0.0015                      # simplification, degrees (~150 m)

def simplify(pts, tol):
    if len(pts) < 3: return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True; stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop(); (ax, ay), (bx, by) = pts[a], pts[b]; dx, dy = bx - ax, by - ay; L = dx * dx + dy * dy; best, bi = 0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            if L == 0: d = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L)); d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
            if d > best: best, bi = d, i
        if best > tol * tol: keep[bi] = True; stack += [(a, bi), (bi, b)]
    return [p for p, k in zip(pts, keep) if k]

def inbox(pts): return any(BOX[1] <= x <= BOX[3] and BOX[0] <= y <= BOX[2] for x, y in pts)
def area(pts): return abs(sum(pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1] for i in range(len(pts) - 1))) / 2
def pack(pts):
    out, la0, lo0 = [], 0, 0
    for x, y in pts:
        la, lo = round(y * 1e4), round(x * 1e4)
        if out and la == la0 and lo == lo0: continue
        out += [la - la0, lo - lo0]; la0, lo0 = la, lo
    return out

def main(countries, lines, out):
    C = []
    for f in json.load(open(countries, encoding="utf-8"))["features"]:
        p = f["properties"]; g = f["geometry"]
        cc = p.get("ISO_A2_EH") if p.get("ISO_A2_EH") not in (None, "-99") else p.get("ISO_A2")
        if cc in (None, "-99"): cc = {"KOS": "XK", "CYN": "CY"}.get(p.get("ADM0_A3"))
        if not cc: continue
        if cc == "PS": continue   # the app has its own rules there (Area A); no line is drawn inside Israel's routing area
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        rings = []
        for poly in polys:
            ring = [(x, y) for x, y, *_ in poly[0]]
            if not inbox(ring) or area(ring) < 0.004: continue   # far away, or an islet (a route never tells countries apart there)
            ring = simplify(ring, TOL)
            if len(ring) >= 4: rings.append(pack(ring))
        if rings: C.append([cc, p.get("NAME_EN") or p.get("NAME"), p.get("NAME_HE") or "", int(p.get("MAPCOLOR7") or 1) - 1, rings])
    Ls = []
    for f in json.load(open(lines, encoding="utf-8"))["features"]:
        g = f["geometry"]
        if {f["properties"].get("ADM0_A3_L"), f["properties"].get("ADM0_A3_R")} >= {"PSX", "ISR"}: continue
        for part in (g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]):
            pts = [(x, y) for x, y, *_ in part]
            if inbox(pts):
                pts = simplify(pts, TOL / 2)
                if len(pts) >= 2: Ls.append(pack(pts))
    json.dump({"c": C, "l": Ls}, open(out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(len(C), "countries,", sum(len(c[4]) for c in C), "rings,", len(Ls), "border lines")

if __name__ == "__main__": main(*sys.argv[1:4])
