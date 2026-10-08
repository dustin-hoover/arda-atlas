# The Other Worldly Project

Arda Atlas is the first world of a family of explorable fictional worlds. Each world is a procedural,
Earth-like globe with canon geography, a timeline of its stories, the important characters moving across
it, battles, landmarks, weather and a walkable ground view. Every world is built with the same engine,
the same conventions and the same laws.

| World | Status | Package |
|---|---|---|
| Arda (Tolkien: The Hobbit, The Lord of the Rings) | live: https://dustin-hoover.github.io/arda-atlas/ | this repo (`src/`) |
| The Known World (A Song of Ice and Fire) | next: planned, starter code in `worlds/got/` | [got/PLAN.md](got/PLAN.md) |
| Dungeon Crawler Carl | announced | — |
| Harry Potter | announced | — |

## Documents
- [PLAYBOOK.md](PLAYBOOK.md): how to build a world, step by step, the way Arda was built.
- [LAWS.md](LAWS.md): the rules every world obeys (copyright and trademarks, sources, workflow). Read first.
- [WORLD_SPEC.md](WORLD_SPEC.md): the data contract a world package fills in, and the repack plan that turns
  this repo's Arda-specific code into a shared engine.
- [got/PLAN.md](got/PLAN.md): the strategy for A Song of Ice and Fire.

## The shape of the grand project
- **One engine, many worlds.** `engine/` (today's `src/` minus Arda's data) renders any world package in
  `worlds/<id>/`: geography, calendar, stories, cast, sprites, landmarks, sources.
- **Landing page.** A gallery of worlds. The visitor turns worlds on and off, picks a story and scrubs its
  timeline; each world opens on its own globe (worlds don't share a planet or a scale). Scale-dependent: the
  globe shows realms and the main companies when zoomed out, then places, side characters and battles, then
  the ground view.
- **Each world builds to its own page** (`site/<id>/`), loaded lazily from the landing page, so one world
  never slows another.
- **Arda stays live** at its current address while the engine is extracted; the repack happens behind it
  and is verified screen by screen before the address switches.
