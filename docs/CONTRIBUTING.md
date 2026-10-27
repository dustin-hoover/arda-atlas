# Arda Atlas — contributor notes

Procedural, Earth-like globe of Middle-earth. Plain JavaScript, no framework, no bundler: `build.js`
concatenates `src/` into a single HTML page. Read README.md for the file map.

**Arda is the first world of the Other Worldly Project.** Before starting a new world (next: A Song of Ice and Fire),
read `docs/otherworldly/` in this order: LAWS.md (binding), PLAYBOOK.md, WORLD_SPEC.md (data contract and the repack
plan), got/PLAN.md. Starter code lives in `worlds/` (`npm run worlds` validates packages and runs their tests).

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
- **No published map's line-work is in the repo** (docs/otherworldly/LAWS.md I.2a: descriptions first,
  published maps only as generalities, real Earth geography for detail). Positions were once read from
  Christopher Tolkien's general map (a thin-plate-spline warp fitted to ~45 places); that is allowed.
  Shapes are ours: `COAST` is only a coarse skeleton (tools/generalize/generalize.py), the drawn coast
  is built on it from real Earth coastlines (tools/continents/reshape.py -> src/shores.js); `COAST` is an
  internal positions layer and is never drawn. Forest, marsh and island outlines that were once sampled from an
  atlas were redrawn from position and text (tools/generalize/redraw_text.py), and tools/qa/trace_check.py (run by
  `npm run audit`) fails if more than 20% of any of them lies within 2 mi of the old trace; the atlas hill-country layer was
  dropped (`RELIEF` is empty; foothills come from the ranges' geology).
- Coastal places and river mouths are pinned to the shore by `tools/continents/anchors.json` (reshape.py
  straightens the coast there; the renderer's coast wobble fades out at the pins). `npm run audit` first runs
  `tools/qa/qa_geo.js`, which fails if a river runs over sea > 0.75 mi, a mouth or anchored port is > 1 mi
  from shore, the coast crosses itself or the island count changes. After any coast change, re-run the router
  (tools/routing/README.md) and `npm run audit`. `FAST=1 python3 tools/continents/reshape.py` reuses the
  cached field to iterate on pins in seconds.
- Mountain valleys come from a drainage network (rasters.js `drainage`, priority flood into the lowland and the
  authored rivers); a frame that turns across the land must never be measured from a far origin (it bends into
  arcs or stripes) - fix the frame per district or per cell.
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

## Hosting constraints (body-only host)
`dist/index.html` must stay body-only with a `<title>` near the top. That host's CSP allows scripts
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
- Travel modes live in `GEO.MODES` (geo.js), shared by the map (`modeAt`) and the router (route.py maps ride→walk,
  barrel/blackship→boat). Mounted sprites are side views (`horseGrid`, `eagleGrid`, `boatGrid`) facing right; the
  map mirrors them when the party heads west on screen. A cluster takes its first member's mode.
- Preview: render a sprite sheet in the page with AVATARS.drawFigure / AVATARS.icon (see tools/shots/avatars.png).
- Headless screenshots can catch symbol layers mid-fade after jumpTo: pan by a pixel and wait before shooting.

## Side characters and battles
- Side characters are ordinary journeys (some stationary: Elrond, Galadriel, Saruman, the Eye of Sauron) with `with`
  windows to travel inside another party (Uglúk's band, Treebeard, Gollum, Faramir). `C[id].special` marks sprites
  that aren't head-on-body: `ent` (Treebeard, taller), `eye` (Sauron), `dragon` (Smaug asleep on the hoard; in flight
  `dragonGrid`, with fire in the `fire` mode) and `spider` (Shelob, on her web); the Nine fly on `fellGrid` fell beasts.
- `GEO.BATTLES`: name, story, at, from/to, src, two sides with banner and `units` ([kind, how many to draw] — a
  picture of the army's make-up, not a count). AVATARS.battle(b, frame) draws them; the map hangs battles below
  their point and travellers stand above theirs. A 170 ms loop animates battles, flyers and the Eye while paused.
- Group rows lay figures out by their own widths (`xsOf`), so wide sprites (Shelob, Treebeard) don't overlap.
- WX.parse('… 16.0') is noon like '… 16': use a fraction such as 15.99 for the night before.

## Travellers in the ground view
- app.js `travellersAt(t)` (shared clustering in `clusterLive`) and `battlesAt(t)` are passed to GROUND.open as
  `travellers`/`battles`. ground.js `updateTravellers` keeps one THREE.Sprite per party (icon canvases from
  AVATARS as Nearest-filtered CanvasTextures, cached), standing on `groundAt`, ~man-high near and scaled up with
  distance (to 30 km), fliers 120 m up, mounts mirrored by travel direction against the camera's right vector;
  name tags are DOM (#gtrav) like the place labels. Tapping a traveller on the map opens a card whose Ground view
  sets you down ~15 m south of them, facing north.
- Group `lead` lists the figures a scene puts front and centre when the company is drawn in two rows.
- The ground view keeps its own clock: `RATES` (stopped, ×1, ×10 default, 1 min/s, 10 min/s, 1 h/s) via [ ] or the « » buttons;
  story time follows the real clock (uncapped dt), travellers glide on their velocities between 170 ms refreshes, and the
  map takes the time back on exit (`onExit(t)`).
- Stories open at their `start` (the slider begins at the left). The War opens at the Long-expected Party (3001 9 22);
  `warpOf` shrinks spells with no movement within ±30 days to a sliver (weight 0.0005), and `warpRate` keeps the
  pace of the eventful days, so the seventeen quiet years pass in seconds.
- Battles within ARMY_NEAR raise their units as sprite ranks (`buildArmy`); the Muster adds tents. Special towers
  (Orthanc, Barad-dûr, Morgul, Ecthelion) are `solids`: travellers and the camera are pushed to their foot.
- The slider is warped by activity (`warpOf`: parties moving, events, battles per day), so rests in Rivendell and
  Lórien take little track; playback runs at an even slider pace (`warpRate`). Ticks use the same warp.

## Orodruin and Minas Tirith
- Terrain: PEAKS kind 'volcano' is base (2/3 of h) + steep ash-cone; kind 'knee' (Hill of Guard) is seven terraces
  at the city's arc radii (60 + 95k m) plus a ridge `to` Mindolluin (`reach` widens the peak's search box; rasters.js
  passes `to`/`reach` to the worker).
- Map: `landmarks-art` layer (AVATARS.landmark 'doom' / 'city'); `doomHeat(t)` is 0 in The Hobbit (dormant until
  2954), 1 in the War, 2 for two days from the Ring's end (3019 3 25.4).
- Ground: `W3far` (world3d.js) adds the crater fire, lava ribbons, the plume (scaled up with distance so it marks the
  east from all over Mordor), a lathe of the true profile when Orodruin lies beyond the far terrain, and a far model
  of Minas Tirith shown while the city is outside the near patch. GROUND.open takes `heat`.
- Durin's Bane (`balrog` special, `balrogGrid`): in Moria in the War and The Hobbit; in the War it follows
  'Gandalf and Durin's Bane' from the Bridge (15 Jan) up the Endless Stair to Zirakzigil (fight 23-25 Jan). Groups
  'The Bridge of Khazad-dûm' / 'The Battle of the Peak' come before the Fellowship. Group windows: a bare date means
  noon, so windows that must include the morning start at the day before (e.g. '3019 1 14.99').
- Map image ids must be ASCII (MapLibre silently skips 'Khazad-dûm', 'Sméagol', 'Lothlórien' in icon-image); app.js
  strips accents from avatar ids.
- GEO.FIREWORKS (Gandalf's at the Party, 3001 9 22 evening, the dragon at the end): map art via
  AVATARS.landmark('fireworks', frame, dragon) in the landmarks layer (offset above the party with `off`), and particle
  bursts plus a flying dragon glow in the ground view (W3far, `o.fireworks`).
- The Hobbit opens in 2463 with the Finding of the Ring (Déagol, Sméagol; Gollum under the mountains by 2470), then
  Smaug's coming in 2770 (Withered Heath → Erebor and Dale; Thrór, Thráin and Thorin flee south), Bilbo's birth in
  2890, and the Quest from 2941. The Tale of Years gives only years for 2463 and 2770; the days are marked as not
  recorded. `warpOf` caps each quiet spell at 2.5 day-weights however long, and counts a day as busy only when a
  party covers half a mile or more.

## Rivers and coast as rendered (round 4)
- The drawn coast is the vector coast: within 8 mi of src/shores.js (coast, sea islands, inland seas) the land/sea
  sign comes from the signed distance to those rings (`GEN.coastSD`), with only a few hundred yards of fine detail.
  Islands standing in rivers or lakes on the land (Cair Andros, Tol Brandir) are not treated as sea shores.
- A river is drawn on `riverLine` (its authored course cut into ≤1.5 mi spans before meanders are added, calm over
  its last 4 mi), and its valley is carved along that same line (`riverCarve`). Floors are measured once at startup
  in the page (`measureRiverFloors`): the lowest ground across each half-mile section, a running minimum from the
  source, capped where rivers meet or branch, and graded back from the mouth at a few metres a mile; the workers get
  the floors in DATA. Deep cuts through ranges become V-shaped gorges.
- `npm run audit` runs tools/qa/qa_render.py, which measures all of this in the browser.
