# Off-road route planner

A prompt-based 4x4 route planner for Israel, built for a group of friends. You type a request in Hebrew, for example "ממצפה רמון עד חניון בארות, בינוני, עם תצפית", and get route options on a topo map. Each route can be exported as GPX for the Off-Road app.

## How it works
- **Parsing.** Claude (via the Supabase edge function) turns the prompt into structured constraints. Without a group code, a basic Hebrew parser runs in the browser instead.
- **Data.** OSM tracks are fetched live from Overpass and rated by `tracktype` / `smoothness` / `4wd_only`.
- **Routing.** Routing runs in the browser (`src/engine.js`, Dijkstra plus candidate search):
  - Default is point-to-point. Loops are built only on request.
  - Vehicle level caps difficulty.
  - Firing zones open on Fri/Sat and Jewish holidays. Military bases are always blocked.
  - Area A is blocked unless explicitly allowed.
  - Overnight stops go only to authorized night camps.
- **Server.** Saved routes, the shared library and the GPX/KML import proxy live in a Supabase edge function (`supabase/functions/api`), gated by a group code.

## Layout
```
src/app.html        UI (Leaflet, Hebrew RTL)
src/engine.js       pure routing engine, also loadable in Node for tests
build.py            inlines engine.js into app.html -> index.html
index.html          built, self-contained page (deploy this)
supabase/           edge function + schema
tests/              synthetic engine test + Playwright e2e (mocked network)
```

## Build and test
```
python3 build.py
node tests/engine.synthetic.test.js
```

## Server secrets (Supabase → Edge Functions → Secrets)
- `GROUP_CODE`: shared code friends enter in ⚙.
- `ANTHROPIC_API_KEY`: used for prompt parsing.

Data © OpenStreetMap contributors (ODbL). Photos from Wikimedia Commons, credited per image.
