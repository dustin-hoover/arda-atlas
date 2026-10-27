"""Redraw the forests, marshes and islands whose outlines once came from a published atlas, from position and text only.

What is kept from the old shape is only where the region lies and roughly how big it is (its area and the axis of
its spread). The outline itself is ours: an ellipse of that size bent by noise of our own seed, then fitted to what
the books say bounds it (the rivers and roads beside it, the coast). Each shape is redrawn with a fresh seed until no
more than MAX_HUG of its outline lies within 2 miles of the traced outline (tools/qa/trace_check.py measures the
same thing). Rewrites src/geo.js in place.

Run: python3 tools/generalize/redraw_text.py
"""
import json, math, os, re, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from skimage.measure import find_contours, approximate_polygon

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
GEO = os.path.join(ROOT, 'src', 'geo.js')
sys.path.insert(0, os.path.join(ROOT, 'tools', 'qa'))
import trace_check as tc

RES = 0.5
MAX_HUG = 0.15


def geo():
    js = ("global.self=global;require('%s/src/gen.js');require('%s/src/geo.js');require('%s/src/shores.js');const G=self.GEO;"
          "console.log(JSON.stringify({F:G.FORESTS,M:G.MARSHES,I:G.ISLANDS,R:G.RIVERS,O:G.ROADS,P:G.PLACES,C:self.SHORES.coast}))") % (ROOT, ROOT, ROOT)
    return json.loads(subprocess.check_output(['node', '-e', js]))


def noise(h, w, scale_px, rng):
    f = np.zeros((h, w))
    for k, amp in ((1, 1.0), (2, 0.45), (4, 0.2)):
        f += amp * ndimage.gaussian_filter(rng.randn(h, w), max(1.0, scale_px / k))
    return f / (f.std() + 1e-9)


def raster(poly, x0, y1, shape):
    """Boolean grid (rows from y1 downward, RES miles per cell) of the cells inside the polygon."""
    im = Image.new('1', (shape[1], shape[0]), 0)
    ImageDraw.Draw(im).polygon([((x - x0) / RES, (y1 - y) / RES) for x, y in poly], fill=1)
    return np.array(im, bool)


def side(X, Y, line, ref):
    """+1 where (X, Y) lies on the same side of the polyline as ref, judged by the nearest segment; and the distance."""
    A = np.array(line, float); B = A[1:]; A = A[:-1]; d = B - A; L = np.maximum((d ** 2).sum(1), 1e-12)
    def one(px, py):
        q = np.stack([px, py], -1)[..., None, :]
        t = np.clip(((q - A) * d).sum(-1) / L, 0, 1); c = A + t[..., None] * d
        dist = np.sqrt(((q - c) ** 2).sum(-1)); i = dist.argmin(-1)
        dd = np.take_along_axis(dist, i[..., None], -1)[..., 0]
        cr = d[i, 0] * (py - A[i, 1]) - d[i, 1] * (px - A[i, 0])
        return np.sign(cr), dd
    s, dd = one(X, Y); s0, _ = one(np.array([ref[0]]), np.array([ref[1]]))
    return s == s0[0], dd


def shape(e, spec, G, trace, land_path):
    pts = np.array(e['pts'], float)
    x0, y0 = pts.min(0) - 40; x1, y1 = pts.max(0) + 40
    xs = np.arange(x0, x1, RES); ys = np.arange(y1, y0, -RES)
    X, Y = np.meshgrid(xs, ys)
    inside = raster(pts, x0, y1, X.shape)
    A = inside.sum() * RES * RES
    cx, cy = (X[inside].mean(), Y[inside].mean()) if 'centre' not in spec else spec['centre']
    if 'axes' in spec:
        a, b, ang = spec['axes']
    else:
        cov = np.cov(np.stack([X[inside] - cx, Y[inside] - cy]))
        w, v = np.linalg.eigh(cov); a, b = 2 * np.sqrt(w[1]), 2 * np.sqrt(w[0]); ang = math.atan2(v[1, 1], v[0, 1])
        k = math.sqrt(A / (math.pi * a * b)); a, b = a * k, b * k
    keep = np.ones(X.shape, bool)
    for line, ref, gap in spec.get('beside', []):
        s, dd = side(X, Y, line, ref); keep &= s & (dd > gap)
    if spec.get('land') or spec.get('sea'):
        L = raster(land_path, x0, y1, X.shape)
        keep &= ndimage.binary_erosion(L, iterations=2) if spec.get('land') else ~ndimage.binary_dilation(L, iterations=6)
    for f in spec.get('also', []): keep &= f(X, Y)
    best = None
    for seed in range(40):
        rng = np.random.RandomState(7000 + seed * 13 + len(e['name']))
        u = ((X - cx) * math.cos(ang) + (Y - cy) * math.sin(ang)) / a
        v = (-(X - cx) * math.sin(ang) + (Y - cy) * math.cos(ang)) / b
        r = np.sqrt(u * u + v * v)
        f = 1 - r + spec.get('wob', 0.3) * noise(*X.shape, b * 0.9 / RES, rng) + 0.07 * noise(*X.shape, 3 / RES, rng)
        m = (f > 0) & keep
        lab, n = ndimage.label(m)
        if not n: continue
        sizes = ndimage.sum(m, lab, range(1, n + 1)); part = lab == (1 + sizes.argmax())
        part = ndimage.binary_fill_holes(part)
        cs = find_contours(np.pad(part, 1).astype(float), 0.5)
        ring = approximate_polygon(max(cs, key=len), tolerance=0.9)[:-1]
        out = [[round(float(x0 + (c - 1) * RES), 1), round(float(y1 - (rr - 1) * RES), 1)] for rr, c in ring]
        if len(out) < 6: continue
        hug = float((tc.seg_dist(tc.dens(out), trace) < tc.HUG).mean())
        area = part.sum() * RES * RES
        score = hug + 0.5 * abs(area / A - 1)
        if best is None or score < best[0]: best = (score, hug, area, out)
        if hug <= MAX_HUG and abs(area / A - 1) < 0.35: break
    return best, A


def fmt(pts): return '[' + ','.join('[%g,%g]' % (x, y) for x, y in pts) + ']'


def main():
    G = geo()
    old = tc.load(subprocess.check_output(['git', 'show', tc.TRACE_REV + ':src/geo.js'], cwd=ROOT).decode('utf8'))
    R = {r['name']: r['pts'] for r in G['R']}; RD = {r['name']: r['pts'] for r in G['O']}
    P = {p[0]: (p[2], p[3]) for p in G['P']}
    land = G['C']
    near = lambda name, mi: (lambda X, Y: np.hypot(X - P[name][0], Y - P[name][1]) > mi)
    road_E = RD['Great East Road']
    SPECS = {
        # the Golden Wood: west of the Great River, on both banks of the Silverlode, the Naith in the angle of the two
        'Lothlórien': {'beside': [(R['Anduin'], P['Caras Galadhon'], 0.6)]},
        # the Entwood climbs the last eastern slopes of the Misty Mountains; Isengard stands outside it
        'Fangorn': {'also': [near('Isengard', 12)]},
        # east of the High Hay of Buckland, the Withywindle winding through it down to the Brandywine, Bombadil's house
        # at its eastern eaves and the Barrow-downs rising beyond (LR I.6-8)
        'Old Forest': {'centre': (96, -20), 'axes': (15, 10.5, math.radians(-12)), 'wob': 0.25,
                       'also': [lambda X, Y: X > 88.5], 'beside': [([[94.6, -15.1], [109.2, -7.7], [124.9, 0.1]], (95, -25), 2.5)]},
        # the Chetwood: north and east of Bree, above the Road
        'Chetwood': {'also': [near('Bree', 5)], 'beside': [(road_E, (135, 20), 1.5)]},
        'Eryn Vorn': {'land': True},
        'Woods of Lindon': {'land': True},
        'Nîn-in-Eilph': {},
        # the Trollshaws: wooded hills north of the Road, between the Hoarwell and the Loudwater
        'Trollshaws': {'beside': [(R['Mitheithel'], (375, 28), 1.5), (R['Bruinen'], (375, 28), 1.5), (road_E, (375, 28), 2.0)],
                       'also': [lambda X, Y: Y < 58], 'centre': (372, 27), 'axes': (40, 16, math.radians(8)), 'wob': 0.35},
        # Drúadan Forest: under the east end of the White Mountains in Anórien, about Eilenach and Amon Dîn,
        # its southern hills cut by the Stonewain Valley
        'Drúadan Forest': {'centre': (674, -574), 'axes': (25, 8.5, math.radians(-23)), 'wob': 0.28},
        'Tolfalas': {'sea': True},
    }
    src = open(GEO, encoding='utf8').read()
    for key, gk in (('F', 'FORESTS'), ('M', 'MARSHES'), ('I', 'ISLANDS')):
        for e in G[key]:
            if e['name'] not in SPECS: continue
            trace = [o['pts'] for o in old[gk] if o['name'] == e['name']][0]
            best, A = shape(e, SPECS[e['name']], G, trace, land)
            _, hug, area, out = best
            print(f"{e['name']:16s} area {A:6.0f} -> {area:6.0f} sq mi, {len(out):3d} pts, hugs the trace {100 * hug:3.0f}%", file=sys.stderr)
            # replace within that array only (HILLS has a 'Trollshaws' too)
            a = src.index('const %s = [' % gk); b = src.index('\n];', a)
            pat = re.compile(r"(\{ name:'%s'[^\n]*?pts:)\[\[.*?\]\]" % re.escape(e['name']))
            seg, k = pat.subn(lambda mm: mm.group(1) + fmt(out), src[a:b], count=1)
            assert k == 1, e['name']
            src = src[:a] + seg + src[b:]
    open(GEO, 'w', encoding='utf8').write(src)


if __name__ == '__main__':
    main()
