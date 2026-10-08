# The Known World: A Song of Ice and Fire

Strategy for the second world. Follows [../LAWS.md](../LAWS.md) and [../PLAYBOOK.md](../PLAYBOOK.md); starter
code is in `worlds/got/`. Facts below are marked **firm** (stated in the novels, chapter to be cited in the
ledger), **author** (said by the author outside the novels: usable, graded lower) or **verify** (believed
true; find the chapter before it becomes data).

## Canon
- **Canon:** the five published novels: A Game of Thrones (AGOT), A Clash of Kings (ACOK), A Storm of Swords
  (ASOS), A Feast for Crows (AFFC), A Dance with Dragons (ADWD). History from The World of Ice & Fire (TWOIAF)
  and Fire & Blood (F&B). The HBO series is not a source (see LAWS I.3): no actors' likenesses, no show
  geography, no show-only events.
- **Name on the page:** "The Known World: an unofficial atlas of A Song of Ice and Fire". The words "Game of
  Thrones" appear only in the attribution line naming the first novel.
- **Ledger citations by chapter:** `AGOT Bran I`, `ASOS Jaime VII`, `TWOIAF The Reign of the Dragons`.

## Frame and scale
- **Origin:** Winterfell (the story's first home and its northern pivot), X east and Y north in miles.
- **Origin latitude:** a cold-temperate one, about 55°N (our choice, documented as such).
- **Scale anchors:**
  - The Wall is about 300 miles long (**firm**, AGOT) and about 700 feet high (**firm**, AGOT).
  - Westeros is about 3,000 miles from the Wall to Dorne's south coast (**author**).
  - Every travel time with a known pace (the king's progress, ravens, ships between ports) becomes a
    `STATEMENTS` test (**verify** each).
- **Positions:** read from the text first. Where the text is silent, positions may be read from the published
  maps *locally* and graded `map`. Coastlines and ranges are our own generalised drawing (LAWS I.2): we never
  trace a published map's line-work.
- **Essos** reaches far to the east (Qarth, the Jade Sea, Asshai). The globe frame must hold both continents.
  Places beyond the stories' paths get rank 4–5 and coarse positions.

## Calendar
- **Era:** years After the Conquest (AC), counted from Aegon's Conquest (**firm**). The novels rarely give day
  dates; they speak of moons and years.
- **Engine calendar:** 365-day years of 12 numbered "moons". This is our modelling convention, not canon.
  Dates display as "the 3rd moon of 298 AC" (no invented month names). It is implemented and tested in
  `worlds/got/calendar.js`.
- **Seasons** last years, not months (**firm**): a long summer ends as the story opens. The weather model needs a
  world `season(t)` that overrides the yearly cycle with the canon seasons (autumn, then winter coming in the
  later books). **Verify** the exact announcements, which come from the Citadel's white ravens.
- **Dates:**
  - Each journey waypoint carries an estimated day and a confidence. Chapters are synchronised across POVs
    with the events that tie them (the Red Wedding, the Purple Wedding, the Blackwater).
  - The ledger records the reasoning in a line, in our words.
  - When only a year is known, the caption says "(the day is not recorded)" (LAWS II.3).

## Stories
1. **A Game of Thrones** (298–299 AC).
   - Opens with the prologue beyond the Wall and Bran's ride to an execution.
   - Robert's progress to Winterfell, Ned south, Jon to the Wall, Catelyn and Tyrion, Daenerys across the
     Dothraki Sea, and the war in the riverlands.
   - Ends with the dragons born.
2. **A Clash of Kings** (299 AC). The five kings, the Blackwater, Theon at Winterfell, Arya at Harrenhal,
   Daenerys at Qarth, the Fist of the First Men.
3. **A Storm of Swords** (299–300 AC).
   - Jaime and Brienne, the Red Wedding, the Purple Wedding.
   - Daenerys at Astapor, Yunkai and Meereen.
   - The battle beneath the Wall and Stannis at the Wall.
4. **A Feast for Crows and A Dance with Dragons** (300 AC). Told together, because the two books run in
   parallel.
5. **Histories** (prologue story, sparse days):
   - Aegon's Conquest (around 2 BC–1 AC).
   - The Dance of the Dragons (129–131 AC).
   - Robert's Rebellion (282–283 AC).

   **Verify** each year in TWOIAF.

## Cast: the first sprites
All drawn from the text's descriptions, in the established 14×16-head pixel style.
- **Starks:**
  - Eddard: dark hair, grey eyes.
  - Catelyn: auburn hair, blue eyes.
  - Robb, Sansa and Bran: auburn hair (Tully colouring).
  - Arya: long face, brown hair.
  - Rickon.
  - Jon Snow: dark hair, grey eyes, black of the Night's Watch from AGOT.
- **Lannisters:**
  - Cersei and Jaime: golden hair, green eyes.
  - Tyrion: a dwarf, pale blond hair, one green eye and one black.
  - Tywin.
- **Targaryens:**
  - Daenerys: silver-gold hair, violet eyes.
  - Viserys.
- **Others:** Robert, Stannis, Renly, Joffrey, Theon, Brienne, Sandor and Gregor Clegane, Samwell, Davos,
  Melisandre, Petyr Baelish, Varys, Jorah, Drogo, Missandei, Barristan, Gendry, Hodor, Meera and Jojen,
  Mance Rayder, Ygritte. **Verify** every colour cue before drawing.
- **Specials** (new sprite kinds):
  - **Direwolves:** Ghost (white, red eyes), Grey Wind, Lady, Nymeria, Summer, Shaggydog (black). **firm**
  - **Dragons:**
    - Drogon (black and red), Rhaegal (green and bronze), Viserion (cream and gold). **firm**
    - Their size grows with the timeline.
  - The Others and wights, giants (Wun Wun), the white ravens.
- **Heraldry for banners and battle badges, from the written arms:**
  - Stark: a grey direwolf on white.
  - Lannister: a golden lion on crimson.
  - Targaryen: a red three-headed dragon on black.
  - Baratheon: a crowned black stag on gold.
  - Greyjoy: a golden kraken on black.
  - Tully: a silver trout on blue and red.
  - Tyrell: a golden rose on green.
  - Martell: a red sun pierced by a golden spear.
  - Arryn: a moon and falcon on sky blue.

  **Verify** each tincture before drawing.

## Journeys: first wave
Robert's progress (King's Landing → Winterfell → back); Ned south; Jon to the Wall and beyond; Tyrion to the
Wall, the Eyrie, the clans' road, King's Landing and across the narrow sea; Catelyn; Arya's flight; Sansa;
Bran north beyond the Wall; Daenerys (Pentos → Vaes Dothrak → the Red Waste → Qarth → Astapor → Yunkai →
Meereen); Jaime and Brienne; Theon; Davos; Stannis to the Wall; Samwell to Oldtown.

Modes to add: `ship` (galleys on the narrow sea), `dragon` (later), `wheelhouse` (the queen's), `ice` (the Wall's
lift) as display variants mapped to the router's existing modes.

## Battles: first wave
Green Fork, Whispering Wood and the Camps, Oxcross, the Blackwater, the Fist of the First Men, the battle
beneath the Wall, the Red Wedding (as a massacre event, not a battle badge), Stannis at the Wall. Robert's
Rebellion battles (Trident, the Sack) in the histories story.

## Landmarks and spectacle
- The Wall, a 300-mile ice ridge with Castle Black, the Shadow Tower and Eastwatch. Use a new `wall` landform
  plus the existing `solids` (no one stands inside the ice).
- Winterfell's hot-spring towers and godswood; King's Landing's hills, Red Keep and Great Sept; the Eyrie on its
  mountain (reuse the `knee` profile idea); Harrenhal's melted towers; the Twins; Storm's End; the Hightower;
  Casterly Rock; Pyke on its sea stacks; the Titan of Braavos; the Great Pyramid of Meereen; Valyria's smoking
  ruins (reuse Orodruin's plume and lava).
- **Spectacle:**
  - wildfire on the Blackwater (green flames: reuse the fireworks particles);
  - dragonfire;
  - the Wall's blue-white glow;
  - weirwoods (white bark, red leaves) as a new tree kind.

## Phases
| Phase | Deliverable | Gate |
|---|---|---|
| 0 | Repack the engine (WORLD_SPEC steps 1–9); Arda unchanged | Arda screenshots identical, audit passes |
| 1 | GoT frame, calendar, ~120 places with ledger, coast and ranges drawn by us | audit: Wall length, place ledger complete |
| 2 | Terrain, realms (the seven kingdoms and Essos city-states), peoples | tiles.html review, globe screenshots |
| 3 | Story 1 journeys, cast sprites, direwolves, events | timeline sweep: main cast never missing |
| 4 | Battles, banners, the Wall, Winterfell, King's Landing ground models | ground-view shots |
| 5 | Stories 2–4, dragons growing, seasons | sweeps and shots per story |
| 6 | Histories, tours, landing page with Arda and the Known World | user go-ahead, live check |

## Open questions for the user
1. A new repository for the grand project, or grow it inside `arda-atlas` first?
2. Should the landing page live at the current Pages address, with Arda moving to `/arda/`?
3. Confirm the books-only canon (no HBO material), as LAWS require.
