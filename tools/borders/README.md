# Overlay borders

`borders.py` rebuilds the overlay polygons in `src/geo.js` (realms of every era, the sub-regions of the
Shire, Gondor, Rohan and Mordor, and the peoples) so they agree with each other and with the map.

- Clipped to the traced coastline; coastal realms reach the shore.
- Neighbours share one border: overlaps and gaps narrower than ~16 miles are resolved by a marker
  watershed over a barrier image, so borders settle on rivers (weighted by size) and mountain crests
  (by height) where those lie near, and half-way otherwise.
- A realm includes its own sub-regions; sub-regions tile their parent realm.
- A people that mostly fills a realm takes that realm's exact outline; slivers over a neighbour are trimmed.
- Polygons in several pieces (Lindon across the Gulf of Lune) keep the extra rings in `parts`.

Re-run after editing the coarse shapes or the rivers/ranges:

    node -e "global.self=global;const fs=require('fs');eval(fs.readFileSync('src/gen.js','utf8'));eval(fs.readFileSync('src/geo.js','utf8')+';global.GEO=GEO');fs.writeFileSync('tools/borders/geo.json',JSON.stringify({COAST:GEO.COAST,ISLANDS:GEO.ISLANDS.map(i=>i.pts),LAKES:GEO.LAKES.map(l=>({name:l.name,pts:l.pts})),RIVERS:GEO.RIVERS.map(r=>({name:r.name,rank:r.rank,pts:r.pts})),RANGES:GEO.RANGES.map(r=>({name:r.name,h:r.h,w:r.w,pts:r.pts})),REALMS:GEO.REALMS,ADMIN:GEO.ADMIN,PEOPLES:GEO.PEOPLES}))"
    python3 tools/borders/borders.py && npm run build

It works from the current polygons, so running it again on its own output is stable but not a substitute for
editing the source shapes (keep a copy of a hand edit before re-running).
