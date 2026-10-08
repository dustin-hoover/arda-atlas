# World package specification

A world is data plus a few small functions. The engine draws it. Today Arda's data and the engine share
`src/`; the repack (below) moves Arda into `worlds/arda/` without changing what visitors see.

## Layout
```
worlds/<id>/
  world.js      id, title, frame (origin name, origin latitude), canon declaration, attribution notice
  calendar.js   parse('Y M D') -> days, parts(t) -> { name, year, label }, era labels; a whole day is noon
  geo.js        PLACES, COAST, ISLANDS, RANGES, PEAKS, RIVERS, LAKES, FORESTS, MARSHES, ARID, ROADS, WALLS,
                REALMS, ADMIN, PEOPLES, REGION_LABELS, SEA_LABELS, JOURNEYS, MODES, BATTLES, STORIES,
                LORE_WEATHER, FIREWORKS (spectacles), LANDMARKS
  events.js     EVENTS[story] = [[date, caption, X, Y]], TOURS
  cast.js       C (heads), B (bodies), specials, JOURNEY[story][journey] casts, GROUPS (scenes)
  sprites.js    special sprites (dragons, direwolves, ...) and landmark art (map)
  ground.js     W3town kinds, halls, far landmarks (W3far), state functions (e.g. heat(t), season(t))
  sources.js    BIB (abbreviation -> book), PLACES ledger, STATEMENTS (audit tests)
  audio.js      moods per region and story (optional)
```

## Core records
| Record | Shape | Notes |
|---|---|---|
| Place | `[name, kind, X, Y, people, realm, note, {rank, culture, r, pop, ...}]` | X east, Y north, miles from the origin |
| Peak | `{ name, x, y, h, r, kind, to?, reach? }` | kinds: mountain, hill, volcano, lonely, knee, seamount |
| Journey | `{ name, color, pts: [[X, Y, date]], with?, hide? }` | routed by `tools/routing/route.py` |
| Mode | `[regex, from, to, mode]` | walk, ride, boat, barrel, blackship, sea, fly, fire, under |
| Battle | `{ name, story, at, from, to, src, muster?, sides: [{ name, note, banner, units }], outcome }` | units are a picture of the make-up, not a count |
| Story | `{ title, start, end }` | open at the first event; prologues inside the story |
| Event | `[date, caption, X, Y]` | captions are our own words |
| Group | `{ name, lead, order, frame, edge, emblem, when, test }` | first match wins |
| Statement | `{ id, src, conf, claim, test, soft? }` | `dist`, `south`, `east`, `spanX`, `route`, `at`, `crow` |

## Repack plan (Arda into the shared engine)
Do one step at a time; after each, rebuild Arda and compare screenshots before and after.
1. **Calendar.** `src/wx.js` holds Shire Reckoning (`MONTHS`, `parse`, `parts`) and the S.R./T.A. labels used by
   `app.js` `setTime`. Move them to `worlds/arda/calendar.js`; `wx.js` keeps the sun and weather maths.
2. **Frame.** `src/gen.js` `LAT0 = 52` and the Hobbiton origin (`toLL`) become `world.frame`.
3. **Data.** `src/geo.js` is already pure data: it moves to `worlds/arda/geo.js` as is. `src/sources.js` likewise.
4. **Events and tours.** `EVENTS`, `TOURS`, `HALL_TITLE` in `src/app.js` move to `worlds/arda/events.js`.
5. **Landmark art and state.** `LANDMARK_ART`, `doomHeat`, the fireworks loop in `app.js`, and `doomGrid`,
   `cityGrid`, `fireworksGrid` in `avatars.js` become world sprites plus state functions passed to the engine.
6. **Cast.** `C`, `B`, `JOURNEY`, `GROUPS` and the special grids (balrog, ent, eye, dragon, spider, trolls, warg,
   gem) in `src/avatars.js` move to `worlds/arda/cast.js` and `sprites.js`; the drawing code (`figGrid`, `icon`,
   `mounted`, `battle`, `drawGrid`) stays in the engine.
7. **Ground.** Arda's landmarks in `src/world3d.js` (orthanc, baraddur, morgul, ecthelion, havens, mallorn, prow,
   erebor and moria halls) and `W3far`'s Orodruin and Minas Tirith become world modules registered by kind.
8. **Names.** `window.ARDA`, the `arda://` tile protocol and `ARDA_*` globals become `WORLD`/`world://`, with
   aliases kept until nothing uses the old names.
9. **Build.** `build.js` takes `--world <id>` and writes `site/<id>/`; the landing page lists `worlds/registry.json`.

## Validation
`node worlds/validate.js <id>` checks a package's shape (required records, unique ids, ASCII image ids,
dates parse, every place ledgered, casts point at defined characters).
