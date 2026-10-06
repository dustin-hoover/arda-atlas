# Source ledger

`src/sources.js` records where everything on the atlas comes from, and statements in Tolkien's texts
that the map can be measured against. The atlas shows each place's grade and references in its card.

- `BIB`: the sources, primary first (Tolkien's texts and maps, the History of Middle-earth, Tolkien's
  annotations on the Baynes map), then secondary (Fonstad, Strachey, the Reader's Companion) and tertiary
  (Tolkien Gateway, the Encyclopedia of Arda, for cross-checks only).
- `PLACES`: `name: [grade, refs, note, chk]`. Grades: `map` (measured on Christopher Tolkien's general
  map), `atlas` (measured on Fonstad), `warp` (named on Tolkien's maps and fitted by the refit warp),
  `text` (placed from the text), `invented` (the atlas's own stand-in). `chk` turns to 1 when the
  references have been checked against the text itself.
- `STATEMENTS`: distances, latitudes and dates from the texts, each with a test the map must pass.
  `soft` marks places where Tolkien's own notes disagree with his published map; the map is kept and
  the disagreement reported.
- `TODO`: the reading list for the next passes.

`npm run audit` (`node tools/sources/audit.js --md docs/SOURCES.md`) checks that every place has an
entry, that grades agree with the anchor files in `tools/refit/`, and measures every statement. It
exits non-zero on ledger problems. After changing journeys, re-run the router first
(`tools/routing/README.md`).

Copyright: record facts (positions, distances, dates) with references and short paraphrases; never
quote passages or copy artwork.
