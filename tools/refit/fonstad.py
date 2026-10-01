"""Fonstad detail layer: hill country, forests and marshes from Karen Wynn Fonstad's Third Age map
(the stitched 3314x2363 copy of her Atlas of Middle-earth plates; not in the repo, save it as f3.png).

Geometry stays on the Tolkien-map fit. fanchors.json pairs atlas miles (current geo.js) with
Fonstad pixels: ~36 places and river mouths plus ridge-crest points snapped from the main ranges.
fwarp.py fits a thin-plate spline atlas -> Fonstad px, so her map is sampled *into* our frame.

Steps (python3 fonstad.py), each writes an intermediate next to this file:
  1. masks: brown hachures + blue-grey rock -> relief density; blue stipple -> forest density
  2. resample both onto a 2-mile atlas grid (fgrid.npz)
  3. forests: threshold, clean, vectorise -> fforests.json (matched to named forests by hand in geo.js)
  4. relief: three contour levels -> frelief.json, written to GEO.RELIEF (drawn into the hills channel)
"""
import json, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd
from scipy.ndimage import map_coordinates
from skimage import measure
exec(open('fwarp.py').read())

a = np.array(Image.open('f3.png').convert('RGB')).astype(int); R, G, B = a[..., 0], a[..., 1], a[..., 2]
brown = (R > 110) & (R - B > 70) & (G < 185) & (G > 40)
rock = (R > 90) & (R < 200) & (B - R >= 8) & (B < 235) & (np.abs(R - G) < 20)
stip = (R > 150) & (R < 232) & (B - R >= 4) & (np.abs(R - G) < 10)
Rl = nd.gaussian_filter((brown | rock).astype(float), 14); Fo = nd.gaussian_filter(stip.astype(float), 16)
H, W = Rl.shape

X0, X1, Y0, Y1, S = -600, 1500, -1150, 620, 2.0
xs = np.arange(X0, X1, S) + S / 2; ys = np.arange(Y1, Y0, -S) - S / 2
gx, gy = np.meshgrid(xs, ys); pts = np.c_[gx.ravel(), gy.ravel()]
fp = np.vstack([to_f(pts[i:i + 200000]) for i in range(0, len(pts), 200000)])
ins = ((fp[:, 0] >= 8) & (fp[:, 0] < W - 8) & (fp[:, 1] >= 8) & (fp[:, 1] < H - 8)).reshape(gx.shape)
rel = map_coordinates(Rl, [fp[:, 1], fp[:, 0]], order=1).reshape(gx.shape) * ins
fo = map_coordinates(Fo, [fp[:, 1], fp[:, 0]], order=1).reshape(gx.shape) * ins

geo = json.load(open('geo.json'))   # export of src/geo.js (COAST, LAKES)
img = Image.new('L', gx.shape[::-1], 0); d = ImageDraw.Draw(img)
P = lambda q: [((x - X0) / S, (Y1 - y) / S) for x, y in q]
d.polygon(P(geo['COAST']), fill=255)
for L in geo['LAKES']: d.polygon(P(L['pts']), fill=0)
land = np.array(img) > 0

def vec(mask, min_area, tol):
    lab, n = nd.label(mask); out = []
    for k in range(1, n + 1):
        c = nd.binary_fill_holes(lab == k)
        if c.sum() * S * S < min_area: continue
        cc = max(measure.find_contours(np.pad(c, 1).astype(float), 0.5), key=len) - 1
        cc = measure.approximate_polygon(cc, tolerance=tol)
        yy, xx = np.nonzero(c)
        out.append({'c': [round(X0 + (xx.mean() + .5) * S), round(Y1 - (yy.mean() + .5) * S)], 'area': int(c.sum() * S * S),
                    'pts': [[round(X0 + (x + .5) * S, 1), round(Y1 - (y + .5) * S, 1)] for y, x in cc][:-1]})
    return out

m = (fo > 0.03) & (rel < 0.12) & land & ins
m = nd.binary_fill_holes(nd.binary_closing(nd.binary_opening(m, iterations=2), iterations=3))
json.dump(sorted(vec(m, 60, 1.0), key=lambda c: -c['area']), open('fforests.json', 'w'))

r = nd.gaussian_filter(rel, 1.0) * land
relief = []
for th, v in [(0.08, 0.15), (0.16, 0.28), (0.26, 0.4)]:
    relief += [{'v': v, 'pts': [[round(x), round(y)] for x, y in c['pts']]} for c in vec(nd.binary_opening(r > th), 80, 1.2) if len(c['pts']) >= 3]
json.dump(relief, open('frelief.json', 'w'))
print('forests', len(json.load(open('fforests.json'))), 'relief polygons', len(relief))
