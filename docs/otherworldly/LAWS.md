# The Laws

Every world obeys these. When a law and a wish conflict, the law wins and the user is told why.
These are working rules for a fan project, not legal advice: before anything is sold, sponsored or
monetised, the project gets a review by an intellectual-property lawyer.

## I. Creative works belong to their authors
1. **Facts, not expression.** Record what the books state (place names, relative positions, distances,
   dates, who went where, who fought whom) in our own words. Never copy prose, dialogue, poems, songs or
   chapter text. Event captions are one-line summaries written by us.
2. **No copied artwork.** Never trace, scan, embed or redraw published maps, illustrations, book covers,
   film or TV frames, game art, logos or sigil artwork. Reference images may be used *locally* to read
   positions and are kept out of git (see `.gitignore`: `tools/refit/*.png`). Coastlines, mountains and
   forests are generalised and redrawn by our own procedures; when a position comes from reading a map, the
   ledger says so, and a shape must never reproduce the map's line-work.
3. **Books first, never screens.** Canon is the published text. Film and TV adaptations (and their sets,
   costumes, actors and music) are not sources. Character sprites come from the text's descriptions (hair,
   eyes, build, dress) and must not resemble any actor or a studio's character design.
4. **Heraldry from the text.** House arms are drawn from their written blazon (e.g. a grey direwolf on a
   white field) in our own pixel style, never copied from published sigil art.
5. **Names and marks.** Titles such as "Game of Thrones" (HBO), "A Song of Ice and Fire" (G.R.R. Martin),
   "Harry Potter" (Warner Bros./J.K. Rowling) and "Dungeon Crawler Carl" (Matt Dinniman) are used only to
   say which books a world follows. No logos, no title fonts, no stylised wordmarks, nothing that suggests
   endorsement. Each world page carries an attribution and an "unofficial fan project" notice.
6. **Wikis and fan maps are leads, not sources.** Fan wikis (often CC BY-SA) and fan-made maps are
   themselves protected works: use them to find the chapter that states a fact, then cite the chapter. Never
   paste wiki text or copy a fan map's geometry.
7. **No music, voices or audio from adaptations.** The generative score stays our own.

## II. Every fact has a source
1. Every place has a ledger entry: a grade (`text`, `map`, `atlas`, `inferred`) and references to chapters
   (`AGOT Bran I`, `LR VI.3`, `H I`). Every statement worth keeping becomes an audit test.
2. `npm run audit` must pass before a merge. A "note" marks a known disagreement between sources; the map
   keeps one reading and says which.
3. When the text gives only a year (or nothing), we pick a plausible day and the event says
   "(the day is not recorded)". Estimated dates carry a confidence in the ledger.
4. Where adaptations or later books contradict, the world declares its canon (for ASOIAF: the five
   published novels, with The World of Ice & Fire and Fire & Blood for history) and sticks to it.

## III. How we work
1. Develop on the session's feature branch. Commit with clear messages ending in the attribution trailers.
   Never put a model identifier in commits, code or docs.
2. Merge to main (fast-forward) only when the user says so, then confirm the live site serves the new build.
3. Verify before reporting: build, `npm run check`, `npm run audit`, and screenshots of every visible change
   (map and ground view). Report failures plainly.
4. Keep Arda live and unbroken while worlds are added. A world may change the engine only behind its own
   configuration, and Arda is re-shot after every engine change.
5. Respect the people in the stories' audiences: violent events are shown as map events and battle
   badges, never gratuitously.
