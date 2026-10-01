# Refitting the atlas to a published map

Scripts used to fit `src/geo.js` to Christopher Tolkien's general map of Middle-earth
(the redrawn 1920×2130 copy on Tolkien Gateway). The image itself is copyrighted and is not in the
repo; download it as `ct.png` into this folder to re-run anything. Positions only are taken from it.

**Frame.** `anchors.json → frame`: reference pixel → atlas miles is
`X = (px − 467) · 0.9202`, `Y = −(py − 571) · 0.9202` (Hobbiton at the origin, scaled so that
Minas Tirith lies 600 mi south, per Tolkien).

**Anchors.** `anchors.json → pairs`: `[name, atlasX, atlasY, refPx, refPy]`, ~50 places, river
mouths and range ends. The atlas columns are in the *pre-refit* frame (`git show 5f8e35e:src/geo.js`).

Pipeline (run from this folder, Python 3 with numpy, scipy, scikit-image, Pillow):

1. `land.py` – land mask from the map's ink (flood fill + hole fill) → `land.npy`.
2. `warp.py` – thin-plate spline from atlas miles to reference miles, fitted to the anchors.
3. `coast.py` – traced coast inside the map's frame, blended with the extrapolated far north,
   east and south → `coast_out.json`.
4. `apply.py 0 ../../src/geo.js` – warps every coordinate in a copy of the pre-refit `geo.js`
   (`geo.orig.js`) and writes the new `COAST`; `snap.py ../../src/geo.js` then joins river ends to
   the coast, lakes or their parent river.
5. `overlay.py 0 raw out.png` – draws atlas features over the reference to check the fit
   (export `geo.json` from `src/geo.js` first; see the node one-liner in the commit history).
`crop.py ct.png x0 y0 x1 y1 out.png [grid]` crops the map with a pixel grid for reading anchors.

## Fonstad detail layer

`fonstad.py` (with `fwarp.py` and `fanchors.json`) samples Karen Wynn Fonstad's Third Age map
into the Tolkien-fitted frame: her hachured hill country becomes `GEO.RELIEF` (drawn into the hills
channel), and her woodland outlines replaced Mirkwood, Fangorn, Lothlórien, Eryn Vorn, the Old
Forest, Trollshaws, Chetwood, Drúadan Forest and the Woods of Lindon, the Swanfleet and Ethir
Anduin marshes, and added the Woods of Rhûn. Coastline and positions are untouched.

Next passes: river courses (Anduin above the Gladden, Hoarwell, Greyflood), Mirkwood's outline, and
the Ered Mithrin; add anchors where the overlay disagrees and re-run.
