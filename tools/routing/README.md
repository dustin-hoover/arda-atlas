# Journey routing

The journeys in `src/geo.js` are sparse waypoints with dates. `route.py` turns each leg into a path that
follows the terrain and writes `src/routes.js`, which the app prefers over the raw waypoints.

1. `npm run serve`, then `PW_CHROME=… python3 sample.py` — samples the atlas's own terrain (height, coast,
   mountains, forest, marsh, lakes) on a 2-mile grid into `terrain.npz`. Re-run after terrain changes.
2. Export the geography the router needs:
   `node -e "global.self=global;const fs=require('fs');eval(fs.readFileSync('src/gen.js','utf8'));eval(fs.readFileSync('src/geo.js','utf8')+';global.GEO=GEO');fs.writeFileSync('tools/routing/geo.json',JSON.stringify({JOURNEYS:GEO.JOURNEYS,RIVERS:GEO.RIVERS.map(r=>({name:r.name,rank:r.rank,pts:r.pts})),ROADS:GEO.ROADS.map(r=>({name:r.name,cls:r.cls,pts:r.pts})),LAKES:GEO.LAKES.map(l=>({name:l.name,pts:l.pts})),MODES:GEO.MODES}))"`
3. `python3 route.py`, then `npm run build`.

Walking cost rises with slope, mountains, height, dark forest and marsh; roads cut it to about a third; wide
rivers can only be crossed cheaply where a road crosses them (bridges and fords); open water is impassable.
`GEO.MODES` in `src/geo.js` marks the legs travelled another way: boats on the Anduin and the Forest River follow
the rivers, the ship from Mithlond keeps to the sea, and Eagle flights and the underground passages (Moria,
the Paths of the Dead, Goblin-town) stay straight. Time along each leg is spread by routed distance.
