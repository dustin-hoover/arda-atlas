# Playbook: building a world

The order that worked for Arda. Each phase ends with a build, `npm run check`, `npm run audit`, screenshots,
a commit and the user's go-ahead to merge. Read [LAWS.md](LAWS.md) before phase 1.

## Phase 0: package and repack
1. Create `worlds/<id>/` from [WORLD_SPEC.md](WORLD_SPEC.md) (data, calendar, cast, sources).
2. If the engine is not yet extracted, do the repack steps in WORLD_SPEC.md first, one at a time, re-shooting
   Arda after each so nothing changes for its visitors.

## Phase 1: the frame
1. **Units and origin.** Canon data in miles, X east and Y north of a named origin (Arda: Hobbiton). Pick an
   origin near the heart of the story (ASOIAF: Winterfell or King's Landing).
2. **Projection.** Sinusoidal about the origin's latitude (`GEN.toLL` / `toXY`), so ground miles are kept.
   Choose the origin latitude from the world's climate (Arda: Hobbiton at 52°N).
3. **Scale.** Collect every distance the text gives (leagues, miles, days of travel at a stated pace) into
   `STATEMENTS`. Fit the scale to them, not to a published map's scale bar.
4. **Calendar.** Implement `parse('Y M D')` → days and `parts(t)` → display, with the gotcha that a whole
   day means noon (`'… 16'` and `'… 16.0'` are both noon; use `15.99` for the night before).

## Phase 2: canon geography
1. Places (`PLACES`): name, kind, X, Y, people, realm, a one-line note in our words, rank 1 to 5, and
   settlement data (culture, radius, population) for the ground view.
2. Coast, islands, ranges, peaks, rivers, lakes, forests, marshes, deserts, roads, walls: polylines and
   polygons in miles. Peaks have kinds (`mountain`, `hill`, `volcano`, `lonely`, `knee`, `seamount`).
3. Realms, regions and peoples come from `tools/borders/borders.py`: shared borders, clipped to the coast,
   snapped to rivers and crests. Peoples are drawn as solid outlines in a unique colour at 50% opacity.
4. Ledger every place in `sources.js`; run the audit until every firm statement holds.

## Phase 3: terrain and look
1. `RASTERS.build` turns canon into the 16 channels; `GEN.evaluate` turns them into elevation and colour.
2. Judge terrain in `tools/tiles.html` first (no WebGL), then on the globe.
3. Special landforms are profiles in `peakAt` (Orodruin's ash-cone, the Hill of Guard's seven terraces).
   Probe heights along a line with `GEN.evaluate` before and after.

## Phase 4: stories and time
1. `STORIES`: `{ title, start, end }`. Open each story at its first event (the slider starts at the left).
   Prologues belong in the story (Arda: The Hobbit opens with the Finding of the Ring in 2463).
2. `EVENTS[story]`: `[date, caption, X, Y]`, captions written by us.
3. The slider is warped by activity (`warpOf`): days with travel, events or battles are wide; quiet spells
   shrink to a capped sliver however long. Check the share each phase gets.
4. Playback speeds are the same in every world: 1 hour, 6 hours, 12 hours and 1 day per second (and 4 days).

## Phase 5: characters on the move
1. `JOURNEYS[story]`: `{ name, color, pts: [[X, Y, 'date']], with: [[leader, from, to]], hide }`. Stationary
   characters are journeys too (Elrond in Rivendell). `hide` removes the badge when the journey ends.
2. `MODES`: `[regex, from, to, mode]` (walk, ride, boat, barrel, blackship, sea, fly, fire, under).
3. Re-run the router after any journey change: export `geo.json`, run `tools/routing/route.py`, diff
   `routes.js` to make sure only the journeys you touched changed.
4. Cast (`avatars.js`): heads `C`, bodies `B`, `JOURNEY[story][name]` with time windows, `GROUPS` for named
   scenes (`when` windows; the first match wins, so specific scenes come before general companies).
5. Sweep the timeline (every half day) to prove a main character is never missing when the text has them
   somewhere.

## Phase 6: battles, landmarks and spectacle
1. `BATTLES`: sides, banners, unit kinds, outcome, source. Near battles raise sprite armies in the ground view.
2. Landmarks on the map (`landmarks-art`) and in the ground view (`W3town` kinds, `W3far` for things seen
   from afar: a volcano's plume, a white city across a plain). Things that change with the story take a state
   function (Arda: `doomHeat(t)`).
3. Spectacle is data plus a renderer (Arda: `FIREWORKS` at the Party; for ASOIAF: wildfire on the
   Blackwater, dragonfire, the Wall's ice).

## Phase 7: the ground view
Towns by culture, solids for great towers (no one stands inside them), halls for underground places,
weather and seasons, travellers and armies as sprites.

## Phase 8: polish and release
Tours, audio moods, mobile layout, the attribution and fan-project notice, then the user's go-ahead to
merge and a live check.

## Pitfalls already paid for (Arda)
- MapLibre silently skips `icon-image` ids with non-ASCII letters: keep image ids ASCII.
- A bare date is noon: a scene window that must include a morning starts the day before.
- Headless screenshots can catch symbols mid-fade or before the first render: set the time again after
  the map is idle and wait.
- Software rendering runs at ~0.2 fps: time-stepped effects (particles, camera easing) must be stepped
  by hand in tests, and the camera snaps when the ground under it jumps.
- Object literals with a repeated key keep the last one: check cast maps for duplicates after editing.
- Symbols behind 3D terrain are hidden: check scenes inside mountains from straight above as well.
- Keep the build's single page small enough for the artifact host; no closing script tags in sources.
