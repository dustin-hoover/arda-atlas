# Arda Atlas — notes for Claude Code

Procedural, Earth-like globe of Middle-earth. Plain JavaScript, no framework, no bundler: `build.js`
concatenates `src/` into a single HTML page. Read README.md for the file map.

## Commands
- `npm run dev` — build and serve at http://localhost:8765/dist/preview.html
- `npm run build` — rebuild `dist/` and `site/` after any change in `src/`
- `npm run check` — syntax-check every source file
- `tools/tiles.html` — fastest way to judge terrain/imagery changes (no map, no WebGL)
- `python tools/app_test.py '<json steps>'` — headless screenshots; steps: waitready, eval, idle, sleep, shot, click, key

## Coordinates
- Canon data is in **miles**: X east, Y north of Hobbiton. `GEN.toLL(X,Y)` / `GEN.toXY(lon,lat)` convert
  with a sinusoidal mapping anchored at Hobbiton = (0°, 52°N), so ground miles are preserved.
- Key anchors: Rivendell (421,17), Minas Tirith (725,-599), Orodruin (840,-554), Edoras (438,-479).
- Hill country (`RELIEF`) and most forest outlines come from Karen Wynn Fonstad's atlas, sampled onto
  the same frame (`tools/refit/fonstad.py`).
- Positions are fitted to Christopher Tolkien's general map: `COAST` is traced from it and everything
  else was moved onto it with a thin-plate-spline warp fitted to ~45 matching places.
- Shire Reckoning time `t` = days since 2 Yule T.A. 3018; `WX.parse('3019 3 25')` → t. Months 1–12 are
  Afteryule…Foreyule, 30 days each, with 3 Lithe days after month 6.

## How rendering works
1. `RASTERS.build(GEO)` draws canon polygons/lines into 16 Uint8 channels at 4 mi/px
   (land, cont, mtn, hill, forest, gold, dark, marsh, arid, farm, ash, valley, uplift, grass, ice, lake)
   plus a 0.25° global raster for the rest of the planet.
2. The page and every worker call `GEN.init(data)`. `GEN.evaluate(X,Y,pix)` returns elevation (m) and
   fills `GEN.F` (fields) and `GEN.R` (coast value `s`, lat, etc.). `pix` = pixel footprint in miles and
   caps the noise octaves, so detail scales with zoom.
3. MapLibre requests `arda://img/{z}/{x}/{y}/{mode}` and `arda://dem/{z}/{x}/{y}` via `addProtocol`;
   `app.js` queues them to a worker pool (newest first). Workers return ImageBitmaps.
4. Vectors (rivers, lakes, roads, walls, settlement buildings) are drawn into imagery tiles in the
   worker with OffscreenCanvas via `GEN.drawVectors`. Buildings are deterministic per settlement
   (`GEN.buildingsNear`) so the imagery, the MapLibre fill-extrusions and the ground view agree.
5. The worker source is the concatenated text of `<script id="src-gen">`, `<script id="src-wx">` and
   `<script id="src-worker" type="text/plain">`, turned into a Blob URL. So `gen.js` and `wx.js` must
   work both in the page and in a worker, and must attach their globals to `self`.

## Gotchas already paid for
- **Terrarium encoding must floor.** Writing `v/256` into a Uint8ClampedArray rounds, which made
  256 m cliffs. Use `vi = Math.floor(v); R = vi >> 8; G = vi & 255; B = floor((v - vi) * 256)`.
- **DEM detail is fixed at z≥8** (`pix ≥ 0.06 mi`) so neighbouring DEM zooms agree; otherwise draped
  lines show steps at tile seams.
- **Ocean and lakes are clamped in the DEM** (sea to 0 m, lakes to lake level). Bathymetry lives only in
  the imagery colours.
- **No `glyphs` URL in the style.** MapLibre then draws every label locally with TinySDF using the
  `text-font` names as CSS families (IM Fell English, Alegreya Sans). Italic is selected by putting
  a name containing "Italic" first: `['IM Fell English Italic', 'IM Fell English']`. Fonts must finish
  loading before the map is created.
- **Don't use `text-variable-anchor`** on point labels: with globe + terrain + pitch it hid every label.
- Canvas sources (weather) are refreshed with `source.play()` then `pause()` a moment later.
- Zoom expressions are allowed in layer `filter`s (used for region labels).
- None of the `src/*.js` files may contain a closing script tag string; `build.js` refuses to build.

## Hosting constraints (claude.ai artifact)
`dist/index.html` must stay body-only with a `<title>` near the top. The artifact CSP allows scripts
only from cdnjs, jsDelivr, unpkg; stylesheets only from Google Fonts; no fetch/XHR to other hosts,
no iframes, no downloads. Blob workers, WebGL, Web Audio (after a click) and dynamic `import()` from
jsDelivr all work. On a normal static host (`site/`) none of these limits apply.

## Where to take it next
See `dist/blueprint.html`: canon in PostGIS with provenance, eroded 30 m terrain, a conditioned
diffusion model for imagery, 3D Tiles for cities, and street-level panoramas along the road network.
Phase 1 is porting `gen.js` to run server-side and caching tiles as PMTiles.

## Ground view content (src/world3d.js)
- `world3d.js` is appended to `ground.js` at build time and shares its scope (THREE, MI, G, groundAt).
- `W3town` models named landmarks (`special.kind`: orthanc, baraddur, morgul, ecthelion; `gate`, `mallorn`,
  `prow`) and per-house detail (elven halls and towers, smial gardens, doors, windows, chimneys).
- `havens` (a place with `havens:1`) builds the Grey Havens quays against the nearest shore inside the near
  patch (water = `hAt <= 0.6`; hAt is meaningless outside ±2600 m) and the ship, which sails at dusk on
  29 Halimath 3021. Such a place must sit within ~2 km of the coast.
- `W3people` places instanced townsfolk by settlement culture (`FOLK` → `KIN`); arms and legs swing in
  the vertex shader, walking is a tiny agent loop in `userData.update`.
- `W3hall('erebor' | 'moria')` builds the walkable interiors; `floorAt(x, z)` is the collision/height
  model (null = wall or chasm). `ARDA.openHalls(kind, placeName)` opens one.
- Hall floors are level-aware: `floorAt(x, z, yRef)` picks the highest floor within a step of the
  walker's height, so galleries can pass over the hall floor; `solid` regions (stairs, piers, plinths)
  are walls to anyone below. `rooms` name the place line; `ceilings` cap how high Space lifts you.
  Erebor's extra rooms live in `ereborMore()`; `spawns.gate` / `spawns.door` are the two ways in.
- Erebor is a `kind: 'lonely'` peak (six spurs, the gate valley); Ravenhill and the Side Door are
  `feature` settlements (no houses, one model each).
- Realm, sub-region and peoples polygons are generated by `tools/borders/borders.py` (shared borders,
  coast-clipped, snapped to rivers and crests); polygons may carry extra rings in `parts`.
- Journeys: edit waypoints in `geo.js`, then re-run `tools/routing/route.py` (see its README) so
  `src/routes.js` follows the terrain; journeys missing from routes.js fall back to straight legs.
- Orchards are a share of farm parcels (`GEN.orchardAt`); the worker emits them as tree kind 4.

## Source ledger (src/sources.js)
- Every place needs an entry (grade + references); every textual distance or date worth keeping becomes a
  `STATEMENTS` test. `npm run audit` measures the map against them and writes docs/SOURCES.md.
- Facts and references only: no quotations, no copied artwork.
- The terrain's large-scale domain warp (gen.js evaluate, `w1`) is kept small (4 mi): the coast is traced from
  Tolkien's map and places, rivers and roads are not warped, so a bigger warp pulls the shore away from them.
  Places of type `port` get a town flat down to ~4 m so havens sit on the water.

## Traveller avatars (src/avatars.js)
- Pixel heads are composed in code on a 14×16 grid from parts (hair style, beard, hat, ears) per character in `C`;
  `JOURNEY[story][name]` lists who travels in each journey (`[id, from, to]` for part of it).
- updateJourneys clusters parties within 2 mi into one badge; `GROUPS` gives named companies (the Fellowship,
  the Three Hunters, Thorin and Company, the Nine…) their own design, with `when` limiting a name to its days.
- Journeys take `with: [[leader, from, to]]` in geo.js: while together they follow the leader's exact path.
- Bodies (`B`): outfit colours and gear (staff, bow, axe, sword, shield, pack); `figGrid(id, frame)` stacks the
  head on a body with a four-frame front-facing walk. Icons are cached per company and frame; the map swaps
  frames (150 ms) only while the clock plays and the party is moving.
- Preview: render a sprite sheet in the page with AVATARS.drawFigure / AVATARS.icon (see tools/shots/avatars.png).
- Headless screenshots can catch symbol layers mid-fade after jumpTo: pan by a pixel and wait before shooting.
