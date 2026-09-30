# Arda Atlas

A Google Earth–style globe of Middle-earth that looks like a real planet from orbit. Terrain,
satellite imagery, fields, forests, rooftops and weather are generated procedurally in the browser
from hand-placed geography; nothing is downloaded but code.

- **Globe:** MapLibre GL JS with 3D terrain, extruded buildings, Tolkien-style labels, three basemaps
  (Satellite, Red Book parchment, Relief)
- **GIS layers:** realms in three eras, farthings/fiefs/folds, peoples & tongues, roads, bridges &
  fords, beacons, palantír network, 100-mile grid; click-to-identify; measuring in miles and leagues
- **Time:** Shire-Reckoning timeline with the journeys of the Fellowship and of Bilbo
- **Weather:** deterministic fronts, clouds, radar, temperature, isobars, wind, day/night, recorded
  storms of the War of the Ring; one switch turns it all on or off
- **Ground view:** walkable three.js scene with streamed terrain, trees, grass, buildings and sky
- **Sound:** an original generative score that follows the region in view, plus weather ambience

## Run it

```bash
npm install          # maplibre-gl (for its CSS) and three (for local testing)
npm run dev          # builds, then serves http://localhost:8765/dist/preview.html
```

`npm run build` writes:

| File | Use |
| --- | --- |
| `dist/index.html` | Body-only page for publishing as a claude.ai artifact |
| `dist/preview.html` | Full document for local testing |
| `site/index.html`, `site/blueprint.html` | Full documents for any static host |

MapLibre, three.js and the fonts load from jsDelivr and Google Fonts at runtime, so the built page is
one file. Every push to `main` rebuilds and publishes `site/` to GitHub Pages
(`.github/workflows/pages.yml`): https://dustin-hoover.github.io/arda-atlas/

## Project layout

```
src/
  geo.js          canon geography (coast, ranges, rivers, places, realms, journeys…) in miles from Hobbiton
  rasters.js      rasterises geo.js into 16 field layers + a low-res global layer (runs once at startup)
  gen.js          the world engine: noise, elevation, colour, tiles, vectors, buildings (page + workers)
  wx.js           deterministic weather and the Shire calendar (page + workers)
  worker.js       Web Worker entry: DEM/imagery tiles, ground patches, weather frames
  app.js          MapLibre map, layers, UI panels, timeline, search, identify, tours
  audio.js        generative music and ambience (Web Audio)
  ground.js       three.js ground explorer (ES module)
  app.css         UI styles
  index.tpl.html  page template with /*PLACEHOLDER*/ slots filled by build.js
tools/
  tiles.html      tile lab: renders sample tiles at many zooms straight from gen.js (open via npm run serve)
  app_test.py     headless Playwright runner for screenshots of the full app
dist/blueprint.html  scaling blueprint (data volumes, generative pipeline, roadmap)
```

## Testing in a headless browser

```bash
pip install playwright && python -m playwright install chromium
npm run serve &
python tools/app_test.py '[["waitready"],["eval","ARDA.map.jumpTo({center:GEN.toLL(720,-600),zoom:14.5,pitch:62,bearing:270}); null"],["idle",120000],["shot","mt.png"]]'
```

Screenshots land in `tools/shots/`. The runner routes the CDN scripts to `node_modules`, so it works
offline. Software WebGL is slow: allow a minute or more per screenshot.

## Rights

A non-commercial fan work. Middle-earth and its names belong to the Tolkien Estate. Descriptions are
original; positions follow the published maps and Tolkien's statements of scale.
