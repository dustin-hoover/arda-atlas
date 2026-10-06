"""Tighten the overlay polygons (realms of each era, sub-regions, peoples) so they agree with each other and
with the map: clipped to the coastline, grown to meet their neighbours along one shared border, and with
borders drawn to the rivers and mountain crests that lie near them.

Method (1-mile raster): each polygon's interior, shrunk a little, seeds a marker; land far from every
polygon seeds a "nobody" marker; a marker-based watershed over a barrier image (rivers weighted by size,
mountain crests by height) then decides every pixel in the band between them. Borders therefore settle on
rivers and crests when one is close, and otherwise half-way, so neighbours always share one edge.
Sub-regions are tiled inside their parent realm the same way. Peoples take a realm's exact outline where
they mostly coincide with it. Rings are traced back to polygons and written into src/geo.js in place.

Input: tools/borders/geo.json (exported from src/geo.js; see README.md)."""
import json, math, os, re
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd
from skimage import measure
from skimage.segmentation import watershed

HERE = os.path.dirname(os.path.abspath(__file__))
GEOJS = os.path.join(HERE, '..', '..', 'src', 'geo.js')
G = json.load(open(os.path.join(HERE, 'geo.json')))
R = 1.0                    # miles per pixel
SHRINK, REACH = 5, 8       # marker erosion inside a polygon; how far a polygon may grow into empty land
TOL = 0.9                  # simplification tolerance (miles)


class Grid:
    def __init__(self, polys, margin=40):
        xs = [p[0] for q in polys for p in q]; ys = [p[1] for q in polys for p in q]
        self.x0, self.x1 = math.floor(min(xs) - margin), math.ceil(max(xs) + margin)
        self.y0, self.y1 = math.floor(min(ys) - margin), math.ceil(max(ys) + margin)
        self.W, self.H = int((self.x1 - self.x0) / R), int((self.y1 - self.y0) / R)
    def px(self, pts): return [((x - self.x0) / R, (self.y1 - y) / R) for x, y in pts]
    def poly(self, rings):
        im = Image.new('L', (self.W, self.H), 0); d = ImageDraw.Draw(im)
        for q in rings:
            if len(q) >= 3: d.polygon(self.px(q), fill=1)
        return np.array(im, bool)
    def lines(self, items):
        """items: (pts, width_px, value). Max-composited."""
        out = np.zeros((self.H, self.W), np.float32)
        for pts, w, v in sorted(items, key=lambda t: t[2]):
            im = Image.new('L', (self.W, self.H), 0); ImageDraw.Draw(im).line(self.px(pts), fill=255, width=max(1, int(round(w))), joint='curve')
            out = np.maximum(out, np.array(im, np.float32) / 255 * v)
        return out
    def rings(self, mask, min_px=30):
        """Trace a mask into rings (largest first), in miles."""
        lab, n = nd.label(mask)
        sizes = nd.sum(mask, lab, range(1, n + 1))
        out = []
        for k in np.argsort(sizes)[::-1]:
            if sizes[k] < min_px: break
            m = np.pad(lab == k + 1, 1)
            m = nd.binary_fill_holes(m)
            c = max(measure.find_contours(m.astype(float), 0.5), key=len) - 1
            c = measure.approximate_polygon(c, tolerance=TOL / R)
            pts = [[round(self.x0 + (x + 0.5) * R, 1), round(self.y1 - (y + 0.5) * R, 1)] for y, x in c]
            if pts[0] == pts[-1]: pts = pts[:-1]
            if len(pts) >= 3: out.append(pts)
        return out


def ring_of(f):
    if f.get('circle'):
        cx, cy, r = f['circle']; return [[cx + r * math.cos(a), cy + r * math.sin(a)] for a in np.linspace(0, 2 * math.pi, 48, endpoint=False)]
    return f['pts']


def setup(polys):
    g = Grid(polys)
    land = g.poly([G['COAST']] + G['ISLANDS'])
    # barrier: rivers by size, mountain crests by height
    rv = g.lines([(r['pts'], 1 + (r['rank'] <= 2), {1: 12, 2: 7, 3: 3.5, 4: 1.5}.get(r['rank'], 0.6)) for r in G['RIVERS']])
    mt = g.lines([(r['pts'], 2, r['h'] / 400) for r in G['RANGES']])
    barrier = np.maximum(nd.gaussian_filter(rv, 0.7) * 1.6, nd.gaussian_filter(mt, 2.0) * 1.4)
    return g, land, barrier


def partition(g, masks, allowed, barrier, shrink=SHRINK, reach=REACH, fill=False):
    """Resolve a set of (possibly overlapping, gappy) masks into a clean partition of `allowed`."""
    n = len(masks)
    cover = np.sum(masks, axis=0)
    markers = np.zeros(allowed.shape, np.int32)
    for i, m in enumerate(masks):
        core = nd.binary_erosion(m, iterations=shrink) & (cover == 1) & allowed
        if core.sum() < 10: core = m & (cover == 1) & allowed
        if core.sum() < 3: core = m & allowed
        markers[core] = i + 1
    if not fill:
        far = nd.distance_transform_edt(cover == 0) > reach
        markers[far & allowed & (markers == 0)] = n + 1      # nobody's land
    lab = watershed(barrier, markers, mask=allowed)
    return [lab == i + 1 for i in range(n)]


def smooth(m):
    return m        # no per-region smoothing: it would pull neighbours' shared edges apart


out = {}                    # (block, era, name) -> rings
finals = {}                 # era -> {name: mask} on that era's grid, for admin and peoples

for era, realms in G['REALMS'].items():
    polys = [ring_of(r) for r in realms]
    g, land, barrier = setup(polys)
    masks = [g.poly([q]) for q in polys]
    if era == 'TA3018':
        # a realm includes its own sub-regions (Ithilien is Gondor's even where the realm outline missed it)
        for i, r in enumerate(realms):
            sub = [a['pts'] for a in G['ADMIN'] if a['parent'] == r['name'] or (r['name'] == 'Buckland' and a['name'] == 'Buckland')]
            if sub: masks[i] |= g.poly(sub)
    res = partition(g, masks, land, barrier)
    finals[era] = (g, land, barrier, {r['name']: m for r, m in zip(realms, res)})
    for r, m in zip(realms, res):
        if r.get('circle'): continue                          # Imladris stays a circle
        rs = g.rings(smooth(m))
        if rs: out[('REALMS', era, r['name'])] = rs
        else: print('  lost', era, r['name'])

# sub-regions tile their parent realm (TA3018)
g, land, barrier, F = finals['TA3018']
by_parent = {}
for a in G['ADMIN']: by_parent.setdefault(a['parent'], []).append(a)
for parent, units in by_parent.items():
    pm = F.get(parent)
    if parent == 'The Shire' and 'Buckland' in F: pm = pm | F['Buckland']
    if pm is None: print('  no parent', parent); continue
    masks = [g.poly([u['pts']]) for u in units]
    res = partition(g, masks, pm, barrier, shrink=3, reach=6)
    for u, m in zip(units, res):
        rs = g.rings(smooth(m), min_px=8)
        if rs: out[('ADMIN', None, u['name'])] = rs

# peoples: where a people mostly fills a realm, they take its exact outline; elsewhere clipped to land
realm_masks = F
for p in G['PEOPLES']:
    if p.get('circle'): continue
    m = g.poly([p['pts']]) & land
    if m.sum() == 0: continue
    res = m.copy()
    for name, rm in realm_masks.items():
        ov = (m & rm).sum(); size = rm.sum()
        if size == 0 or ov == 0: continue
        f = ov / size
        if f > 0.5: res |= rm                                 # mostly theirs: the whole realm, to its border
        elif f < 0.12 and ov / m.sum() < 0.12: res &= ~rm      # a sliver over a neighbour's border: trim it
    res = nd.binary_opening(res, iterations=2) & land
    rs = g.rings(res, min_px=20)
    if rs: out[('PEOPLES', None, p['name'])] = rs

# ---- write back into geo.js, in place
src = open(GEOJS).read()
fmt = lambda pts: '[' + ','.join('[%g,%g]' % (x, y) for x, y in pts) + ']'

def block_span(name):
    a = src.index('const %s = ' % name); b = src.index('\n};' if name == 'REALMS' else '\n];', a); return a, b

def sub_span(era):
    a, b = block_span('REALMS'); i = src.index("'%s': [" % era, a); j = src.index('\n  ],', i); return i, j

changed = 0
for (block, era, name), rs in out.items():
    a, b = sub_span(era) if block == 'REALMS' else block_span(block)
    seg = src[a:b]
    pat = re.compile(r"(\{ name:'" + re.escape(name.replace("'", "\\'")) + r"'[^\n]*?)pts:(\[\[[^\n]*?\]\]|[A-Za-z_.\[\]0-9]+)(, parts:\[[^\n]*?\]\]\])?")
    mm = pat.search(seg)
    if not mm: print('  not found', block, era, name); continue
    rep = mm.group(1) + 'pts:' + fmt(rs[0]) + (', parts:[' + ','.join(fmt(q) for q in rs[1:]) + ']' if len(rs) > 1 else '')
    seg = seg[:mm.start()] + rep + seg[mm.end():]
    src = src[:a] + seg + src[b:]
    changed += 1
open(GEOJS, 'w').write(src)
print('updated', changed, 'polygons; points', sum(len(q) for rs in out.values() for q in rs))
