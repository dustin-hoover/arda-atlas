"""Shores for the unwritten edges of Arda (writes src/shores.js).

Only the north-west of Middle-earth has a coast from the books' maps (Christopher Tolkien's general map, traced into
GEO.COAST from Forochel round to the coast of Harad). The rest of that outline - the long north shore, the whole east
coast and the far south - and the distant Dark Land and Land of the Sun are unwritten: smooth guesses that read as
blobs from orbit. Here they are given real-looking shores made from Earth's, never recognisably:

  * the unwritten coasts of Middle-earth: strips of real coastline are laid along the old guessed outline, bent to
    follow it (the strip's along-shore distance runs along our coast, its distance inland runs inland), some of them
    mirrored. Gulfs, peninsulas, fjords and island chains come with them. Every authored feature (ranges, forests,
    deserts, rivers, places) stays on land, and the books' coast is kept exactly.
  * the Dark Land and the Land of the Sun: whole Earth landmasses turned, mirrored, scaled and warped onto the places
    the early cosmology maps give them.

Source: Natural Earth 1:10m land and minor islands (public domain), downloaded to tools/continents/cache/.
Run: python3 tools/continents/reshape.py
"""
import json, math, os, sys, urllib.request
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from skimage.measure import find_contours, approximate_polygon

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
CACHE = os.path.join(HERE, 'cache'); os.makedirs(CACHE, exist_ok=True)
NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/'
KM = 1.609344

# ---------------------------------------------------------------- Earth
def earth_rings():
    rings = []
    for f in ('ne_10m_land.geojson', 'ne_10m_minor_islands.geojson'):
        p = os.path.join(CACHE, f)
        if not os.path.exists(p): urllib.request.urlretrieve(NE + f, p)
        for ft in json.load(open(p))['features']:
            g = ft['geometry']
            polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
            for poly in polys: rings.append(poly)
    return rings
RINGS = earth_rings()

def earth_mask(lon0, lon1, lat0, lat1, res):
    """Earth land in a lon/lat box, res degrees per pixel; returns (mask, sampler(lon, lat) -> 0/1)."""
    W, H = int(round((lon1 - lon0) / res)), int(round((lat1 - lat0) / res))
    im = Image.new('L', (W, H), 0); d = ImageDraw.Draw(im)
    P = lambda r: [((x - lon0) / res, (lat1 - y) / res) for x, y in r]
    for poly in RINGS:
        xs = [p[0] for p in poly[0]]; ys = [p[1] for p in poly[0]]
        if max(xs) < lon0 or min(xs) > lon1 or max(ys) < lat0 or min(ys) > lat1: continue
        d.polygon(P(poly[0]), fill=1)
        for hole in poly[1:]: d.polygon(P(hole), fill=0)
    m = np.array(im, np.uint8)
    def at(lon, lat):
        i = np.clip(((lon - lon0) / res).astype(int), 0, W - 1); j = np.clip(((lat1 - lat) / res).astype(int), 0, H - 1)
        ok = (lon >= lon0) & (lon < lon1) & (lat >= lat0) & (lat < lat1)
        return np.where(ok, m[j, i], 0)
    return m, at

def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

# ---------------------------------------------------------------- coastal sectors
# Each stretch of the guessed outline (from the books' coast at Forochel, east along the north shore, south down the
# east coast and west along the south, back to the books' coast in Harad: land always on the right) is given a real
# region of Earth, moved whole: two points on its real coast (land on their right, or on their left when mirrored)
# are set on the two ends of the stretch, and everything around them comes along - gulfs, peninsulas, islands.
# Sectors run round the whole coast skeleton (land on the right), from the Ice Bay of Forochel east along the north
# shore, down the east coast, west along the south, and north up the west coast the books describe. Each is given
# by the skeleton points it spans (a, b: Arda miles). On the west coast (written=True) the Earth coast only adds
# detail - no more than ~18 miles either way of the skeleton - so the forms the books name stay where they are.
SECTORS = [
    dict(name='Arctic coast, White Sea to the Lena', mirror=False, p1=(40.5, 64.6), p2=(128.5, 72.6), a=(40, 656), b=(2574, 503)),
    dict(name='Kamchatka and the Sea of Okhotsk (mirrored)', mirror=True, p1=(135.5, 43.5), p2=(178.0, 64.6), a=(2574, 503), b=(2620, -1540)),
    dict(name='South China coast (mirrored)', mirror=True, p1=(106.5, 20.5), p2=(122.0, 31.0), a=(2620, -1540), b=(1654, -2440)),
    dict(name='Northern Mediterranean (mirrored)', mirror=True, p1=(-5.6, 36.0), p2=(36.0, 36.8), a=(1654, -2440), b=(-294, -2394),
         exclude=[[(-20, 0), (-20, 35.95), (-5.4, 35.95), (-1.0, 35.3), (8.5, 37.0), (10.3, 37.5), (11.4, 37.15), (11.4, 34.0),
                   (20.0, 32.2), (25.0, 32.3), (33.0, 31.4), (34.3, 31.2), (35.0, 29.0), (60, 0)],
                  [(35.75, 25), (35.75, 36.6), (36.4, 37.4), (50, 40), (50, 25)], [(-20, 35.95), (-20, 46), (-5.7, 46), (-5.7, 35.95)]]),
    dict(name='Western India', mirror=False, p1=(76.6, 8.6), p2=(69.0, 22.3), a=(-294, -2394), b=(78, -1350)),
    # the coasts the books describe: detail only
    # (on the books' coast a real coast is laid along ours point by point: `line` follows it, land on the right)
    dict(name='Atlantic Morocco, Cape Juby to Tangier', a=(78, -1350), b=(572, -773), written=True,
         line=[(-12.9, 27.95), (-11.5, 28.3), (-10.3, 29.2), (-9.85, 30.63), (-9.6, 31.5), (-9.3, 32.3), (-8.7, 33.2), (-7.6, 33.6), (-6.8, 34.1), (-6.3, 35.0), (-5.95, 35.75)]),
    dict(name='South coast of England, Dover to Land\'s End', a=(572, -773), b=(-6, -720), written=True,
         line=[(1.4, 51.1), (0.3, 50.75), (-0.8, 50.75), (-1.5, 50.65), (-2.4, 50.6), (-3.4, 50.6), (-4.2, 50.3), (-5.0, 50.05), (-5.7, 50.05)],
         exclude=[[(-6.0, 50.9), (2.5, 50.9), (2.5, 46), (-6.0, 46)]]),
    dict(name='West and north coasts of Ireland, Mizen Head to Fair Head', a=(-6, -720), b=(-330, -104), written=True,
         line=[(-9.8, 51.45), (-10.3, 52.0), (-9.9, 52.7), (-9.6, 53.2), (-10.1, 53.6), (-9.95, 54.2), (-8.8, 54.3), (-8.4, 54.9),
               (-7.4, 55.4), (-6.6, 55.25), (-6.05, 55.2)]),
    dict(name='Norwegian coast, Stavanger to the Varanger', a=(-330, -104), b=(40, 656), written=True,
         line=[(5.5, 58.9), (4.9, 60.4), (4.9, 61.5), (5.6, 62.4), (7.3, 63.2), (9.0, 63.8), (11.0, 65.0), (12.5, 66.5), (13.6, 67.8),
               (16.0, 68.9), (18.5, 69.8), (21.5, 70.3), (24.5, 71.0), (27.5, 70.9), (30.0, 70.4), (31.0, 70.0)]),
]
WRITTEN_A = 32.0   # miles: the most the Earth detail may move the books' coast skeleton
SRES = 3.0       # km per pixel of a sector's Earth raster
HALF = 160.0     # km of a strip either side of its line
STEP = 1.5       # km per strip pixel

def build_strip(st):
    """Earth land along a real coast, in (along, across) coordinates: signed distance (km, + land) per strip pixel."""
    pts = np.array(st['line'], float)
    lon, lat = [pts[0, 0]], [pts[0, 1]]
    for (a0, b0), (a1, b1) in zip(pts[:-1], pts[1:]):
        km = math.hypot((a1 - a0) * 111.32 * math.cos(math.radians((b0 + b1) / 2)), (b1 - b0) * 111.32)
        n = max(1, int(km / STEP))
        for k in range(1, n + 1): lon.append(a0 + (a1 - a0) * k / n); lat.append(b0 + (b1 - b0) * k / n)
    lon, lat = np.array(lon), np.array(lat)
    dx = np.gradient(lon) * 111.32 * np.cos(np.radians(lat)); dy = np.gradient(lat) * 111.32
    dx = ndimage.gaussian_filter1d(dx, 25, mode='nearest'); dy = ndimage.gaussian_filter1d(dy, 25, mode='nearest')
    l = np.hypot(dx, dy); tx, ty = dx / l, dy / l
    nx, ny = ty, -tx                                         # to the right: toward the land
    L = float(np.hypot(np.diff(lon) * 111.32 * np.cos(np.radians(lat[:-1])), np.diff(lat) * 111.32).sum())
    v = np.arange(-HALF, HALF + STEP, STEP)
    LON = lon[:, None] + v[None, :] * nx[:, None] / (111.32 * np.cos(np.radians(lat[:, None])))
    LAT = lat[:, None] + v[None, :] * ny[:, None] / 111.32
    _, at = earth_mask(LON.min() - 1, LON.max() + 1, LAT.min() - 1, LAT.max() + 1, 0.01)
    M = at(LON, LAT).astype(bool)
    sdf = (ndimage.distance_transform_edt(M) - ndimage.distance_transform_edt(~M)) * STEP
    return dict(sdf=sdf, L=L, nu=len(lon), nv=len(v))

def sector_sdf(sec, margin=1600.0):
    """Earth land around the sector, in a local km plane centred between p1 and p2: signed distance (km, + land)."""
    lon0 = (sec['p1'][0] + sec['p2'][0]) / 2; lat0 = (sec['p1'][1] + sec['p2'][1]) / 2
    toxy = lambda lo, la: ((lo - lon0) * 111.32 * math.cos(math.radians(lat0)), (la - lat0) * 111.32)
    q1, q2 = toxy(*sec['p1']), toxy(*sec['p2'])
    R = max(abs(q1[0]), abs(q1[1]), abs(q2[0]), abs(q2[1])) + margin
    n = int(2 * R / SRES)
    xs = np.linspace(-R, R, n); X, Y = np.meshgrid(xs, -xs)
    LAT = lat0 + Y / 111.32; LON = lon0 + X / (111.32 * math.cos(math.radians(lat0)))
    _, at = earth_mask(LON.min() - 1, LON.max() + 1, LAT.min() - 1, LAT.max() + 1, 0.02)
    M = at(LON, LAT).astype(bool)
    if sec.get('exclude'):
        # the grid is affine in lon/lat, so the polygon can be drawn straight onto it
        dlon = LON[0, 1] - LON[0, 0]; dlat = LAT[0, 0] - LAT[1, 0]
        im = Image.new('L', (M.shape[1], M.shape[0]), 0); dr = ImageDraw.Draw(im)
        for poly in sec['exclude']: dr.polygon([((lo - LON[0, 0]) / dlon, (LAT[0, 0] - la) / dlat) for lo, la in poly], fill=1)
        M &= ~np.array(im, bool)
    sdf = (ndimage.distance_transform_edt(M) - ndimage.distance_transform_edt(~M)) * SRES
    return dict(sdf=sdf, R=R, n=n, q1=complex(*q1), q2=complex(*q2))

# ---------------------------------------------------------------- Middle-earth
def geo():
    import subprocess
    js = ("global.self=global;require('%s/src/geo.js');const G=self.GEO;console.log(JSON.stringify({COAST:G.COAST,ISLANDS:G.ISLANDS,"
          "RANGES:G.RANGES,FORESTS:G.FORESTS,ARID:G.ARID,MARSHES:G.MARSHES,LAKES:G.LAKES,FARMS:G.FARMS,GRASS:G.GRASS,ICE:G.ICE,UPLIFT:G.UPLIFT,"
          "RIVERS:G.RIVERS.map(r=>({name:r.name,pts:r.pts})),PLACES:G.PLACES.filter(p=>p[2]!=null).map(p=>[p[2],p[3]]),PLACESN:G.PLACES.filter(p=>p[2]!=null).map(p=>[p[0],p[2],p[3]]),SEA:G.SEA_LABELS}))") % ROOT
    return json.loads(subprocess.check_output(['node', '-e', js]))

G = geo()
RES = 2.0
X0, X1, Y0, Y1 = -900.0, 4100.0, -3500.0, 2000.0
W, H = int((X1 - X0) / RES), int((Y1 - Y0) / RES)
px = lambda p: ((p[0] - X0) / RES, (Y1 - p[1]) / RES)
def poly_mask(polys, width=0):
    im = Image.new('L', (W, H), 0); d = ImageDraw.Draw(im)
    for pts in polys:
        if len(pts) > 2: d.polygon([px(p) for p in pts], fill=1)
    return np.array(im, bool)
def line_mask(lines):
    im = Image.new('L', (W, H), 0); d = ImageDraw.Draw(im)
    for pts, w in lines: d.line([px(p) for p in pts], fill=1, width=max(1, int(round(w / RES))))
    return np.array(im, bool)

C = G['COAST']                              # the coast skeleton (src/geo.js; tools/generalize/generalize.py)
area = lambda P: sum(P[k][0] * P[(k + 1) % len(P)][1] - P[(k + 1) % len(P)][0] * P[k][1] for k in range(len(P)))
if area(C) > 0: C = C[::-1]                # clockwise in x-east, y-north: land on the right
k0 = min(range(len(C)), key=lambda k: math.dist(C[k], (40, 656)))
env = C[k0:] + C[:k0 + 1]                  # the whole loop, from the Ice Bay of Forochel round to it again
land0 = poly_mask([C])
ANCH = json.load(open(os.path.join(HERE, 'anchors.json')))

def dense(pts, step=1.0):
    out, s = [], [0.0]
    for a, b in zip(pts[:-1], pts[1:]):
        n = max(1, int(math.dist(a, b) / step))
        for k in range(n): out.append((a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n))
    out.append(tuple(pts[-1]))
    for a, b in zip(out[:-1], out[1:]): s.append(s[-1] + math.dist(a, b))
    return out, np.array(s)
envd, envs = dense(env)
Ls = envs[-1]
S_env = np.full((H, W), -1.0)
for (x, y), sv in zip(envd, envs):
    i, j = int((x - X0) / RES), int((Y1 - y) / RES)
    if 0 <= i < W and 0 <= j < H: S_env[j, i] = sv
dist_env, idx = ndimage.distance_transform_edt(S_env < 0, return_indices=True)
s_near = S_env[idx[0], idx[1]]; dist_env *= RES
d_env = np.where(land0, dist_env, -dist_env)                  # signed distance to the skeleton, + inland
def s_at(p): return float(envs[min(range(len(envd)), key=lambda k: (envd[k][0] - p[0]) ** 2 + (envd[k][1] - p[1]) ** 2)])
for sec in SECTORS:
    sec['sa'] = s_at(sec['a']); sec['sb'] = s_at(sec['b'])
    if sec['sb'] <= sec['sa']: sec['sb'] = Ls                 # the last stretch closes the loop

def env_at(sv):
    k = int(np.searchsorted(envs, sv)); k = min(max(k, 0), len(envd) - 1); return complex(*envd[k])
Qx = X0 + (np.arange(W) + 0.5) * RES; Qy = Y1 - (np.arange(H) + 0.5) * RES
Q = Qx[None, :] + 1j * Qy[:, None]
f_new = np.zeros((H, W)); wsum = np.zeros((H, W))
near = np.abs(d_env) < 900
rw = np.random.RandomState(5)
WARP = (ndimage.gaussian_filter(rw.randn(H, W), 140 / RES) + 1j * ndimage.gaussian_filter(rw.randn(H, W), 140 / RES))
WARP *= 75.0 / np.abs(WARP).std()                                 # km: no borrowed coast matches its source
BEND = (ndimage.gaussian_filter(rw.randn(H, W), 380 / RES) + 1j * ndimage.gaussian_filter(rw.randn(H, W), 380 / RES))
BEND *= 190.0 / np.abs(BEND).std()                                # miles: broad lobes and bights on the unwritten coasts
written = np.zeros((H, W))
for sec in SECTORS:
    sa, sb = sec['sa'], sec['sb']
    if sec.get('written'):
        st = build_strip(sec)
        kpm = st['L'] / (sb - sa)                                    # Earth km per Arda mile along the coast
        u = (s_near - sa) * kpm
        v = d_env * kpm
        ui = np.clip((u / STEP).astype(int), 0, st['nu'] - 1); vi = np.clip(((v + HALF) / STEP).astype(int), 0, st['nv'] - 1)
        dev = st['sdf'][ui, vi] / kpm - d_env                         # the real coast's departure from its own line, in miles
        dev = np.where(np.abs(v) < HALF - 5, dev, 0)
        fs = d_env + WRITTEN_A * np.tanh(dev / WRITTEN_A)
        ramp = 60.0
        win = sstep(sa - ramp, sa + ramp, s_near) * sstep(sb + ramp, sb - ramp, s_near)
        if sb >= Ls - 1: win = sstep(sa - ramp, sa + ramp, s_near)
        win = ndimage.gaussian_filter(win * near, 10 / RES)
        written += win
        f_new += win * fs; wsum += win
        print(sec['name'], 'scale %.2f km/mi' % kpm, 'miles', round(sa), round(sb), file=sys.stderr)
        continue
    E = sector_sdf(sec)
    Ea, Eb = env_at(sa), env_at(sb)
    a = Eb - Ea; b = E['q2'] - E['q1']
    wv = (Q + (0 if sec.get('written') else BEND) - Ea) / a
    if sec['mirror']: wv = np.conj(wv)
    P = E['q1'] + wv * b + WARP
    kpm = abs(b) / abs(a)
    i = np.clip(((P.real + E['R']) / SRES).astype(int), 0, E['n'] - 1); j = np.clip(((E['R'] - P.imag) / SRES).astype(int), 0, E['n'] - 1)
    edge = np.maximum(np.abs(P.real), np.abs(P.imag))
    fs = E['sdf'][j, i] / kpm
    if sec.get('written'): fs = d_env + WRITTEN_A * np.tanh((fs - d_env) / WRITTEN_A)
    feather = sstep(E['R'] - 20, E['R'] - 400, edge)
    ramp = 120.0 if sec.get('written') else 260.0
    win = sstep(sa - ramp, sa + ramp, s_near) * sstep(sb + ramp, sb - ramp, s_near)
    if sa < 1: win = sstep(sb + ramp, sb - ramp, s_near)
    if sb >= Ls - 1: win = sstep(sa - ramp, sa + ramp, s_near)
    win = ndimage.gaussian_filter(win * near, 40 / RES) * feather
    if sec.get('written'): written += win
    f_new += win * fs; wsum += win
    print(sec['name'], 'scale %.2f km/mi' % kpm, 'miles', round(sa), round(sb), file=sys.stderr)
f_new = (f_new + np.maximum(0, 1 - wsum) * d_env) / np.maximum(wsum, 1)
written = np.clip(written / np.maximum(wsum, 1e-6), 0, 1) * (wsum > 0.05)
f_new = np.where(d_env > 700, np.maximum(f_new, d_env - 700), f_new)
cap = -620 + 120 * sstep(0.64 * Ls, 0.70 * Ls, s_near) + 330 * sstep(0.84 * Ls, 0.90 * Ls, s_near)
cap = cap * (1 - written) - 60 * written                          # the books' coast: islands close in only
_cn = ndimage.gaussian_filter(np.random.RandomState(8).randn(H, W), 30 / RES); cap += 90 * _cn / _cn.std() * (1 - written)
f = np.where(d_env < cap, np.minimum(f_new, -1 - (cap - d_env)), f_new)

def disk(p): return np.hypot(Qx[None, :] - p[0], Qy[:, None] - p[1])
def seg_dist(pts):
    d = np.full((H, W), 1e9)
    for (ax, ay), (bx, by) in zip(pts[:-1], pts[1:]):
        dx, dy = bx - ax, by - ay; l2 = dx * dx + dy * dy or 1
        t = np.clip(((Qx[None, :] - ax) * dx + (Qy[:, None] - ay) * dy) / l2, 0, 1)
        d = np.minimum(d, np.hypot(Qx[None, :] - ax - t * dx, Qy[:, None] - ay - t * dy))
    return d

# everything the books name stays on land, with a ragged margin of at least ~25 miles (a range that runs out to
# sea becomes a mountainous peninsula); places on the coast and river mouths are handled apart, below
coastal = {c[0] for c in ANCH['coastal']}
prot = poly_mask([r['pts'] for k in ('FORESTS', 'MARSHES', 'LAKES') for r in G[k] if 'pts' in r])
prot |= line_mask([(r['pts'], r['w']) for r in G['RANGES']])
prot |= line_mask([([q[1:], q[1:]], 10) for q in G['PLACESN'] if q[0] not in coastal])
prot &= land0
pd = ndimage.distance_transform_edt(~prot) * RES
rng = np.random.RandomState(11)
ragged = ndimage.gaussian_filter(rng.randn(H, W), 6 / RES); ragged /= ragged.std()
f = np.maximum(f, 25 + 9 * ragged - pd)
# rivers run on land to their mouths
for r in G['RIVERS']:
    f = np.maximum(f, (3 - seg_dist(r['pts'])) * (written > 0.5) - 1e3 * (written <= 0.5))   # on the books' coast only
# the Gulf of Lhûn, as the books describe it: a long gulf reaching in from the sea to the Grey Havens at its head,
# Forlond on its northern shore and Harlond on its southern (our own line, from those places' positions)
gw = seg_dist([(-440, -26), (-370, -14), (-318, -22), (-268, -14), (-226, -19), (-195, -8), (-172, -3), (-152, 0)])
gx = np.clip((Qx[None, :] + 152) / -288, 0, 1)                   # 0 at the head, 1 at the mouth
gr = ndimage.gaussian_filter(np.random.RandomState(21).randn(H, W), 3 / RES); gr /= gr.std()
f = np.minimum(f, gw - (6 + 19 * gx ** 1.2) * (1 + 0.3 * gr))   # wide enough at its head to be drawn
# places on the coast: on land, with open sea beside them where it lay (at the renderer's scale: its own warp of
# the coast reaches ~7 miles, its land raster is 4 miles a pixel)
for name, x, y, sx, sy in ANCH['coastal']:
    dx, dy = sx - x, sy - y; l = math.hypot(dx, dy) or 1; dx, dy = dx / l, dy / l
    f = np.minimum(f, disk((x + dx * 25, y + dy * 25)) - 14)          # sea from ~11 miles off
# river mouths: an estuary along the river's last miles, opening to the sea
for name, x, y, sx, sy in ANCH['mouths']:
    dx, dy = sx - x, sy - y; l = math.hypot(dx, dy) or 1; dx, dy = dx / l, dy / l
    f = np.minimum(f, disk((x + dx * 20, y + dy * 20)) - 13)          # open sea beyond the mouth
    f = np.minimum(f, seg_dist([(x - dx * 6, y - dy * 6), (x + dx * 10, y + dy * 10)]) - 4)   # the estuary
# the coastal places themselves stay on land, last of all (a harbour town at a river mouth keeps its ground)
for name, x, y, sx, sy in ANCH['coastal']:
    if name == 'Mithlond': continue
    f = np.maximum(f, 9 - disk((x, y)))
# the Grey Havens stand on the very shore at the gulf's head (the ground view builds their quays against it):
# water right up to them from the west, land from them eastward
f = np.maximum(f, 4 - disk((-157, -13.5)))
# (the Lune enters at the head, just north-east of them)
# the Mouths of Anduin: the river spreads into a marshy delta below Pelargir and empties into the Bay of Belfalas
# through many channels; the delta's front is the coast (the fan and channels are in src/geo.js)
AX, AY = 621.1, -738.2
rr = disk((AX, AY)); ang = np.degrees(np.arctan2(Qy[:, None] - AY, Qx[None, :] - AX)) % 360
infan = sstep(150, 162, ang) * sstep(266, 254, ang)
front = 52 + 5 * gr
f = np.where(infan > 0.5, np.maximum(f, np.minimum(front - rr, 8)), f)              # the delta is land...
f = np.where((infan > 0.5) & (rr < front + 22), np.minimum(f, front - rr), f)          # ...and the open bay just beyond it
land = f > 0
lab, n = ndimage.label(land)
main = lab[int((Y1 - 0) / RES), int((0 - X0) / RES)]
mainland = ndimage.binary_fill_holes(lab == main)
seas = mainland & ~land
lab2, n2 = ndimage.label(seas)
sizes = ndimage.sum(seas, lab2, range(1, n2 + 1))
seas = np.isin(lab2, [i + 1 for i, sz in enumerate(sizes) if sz * RES * RES > 600])

def rings(mask, min_area, tol=0.7):
    out = []
    lb, n = ndimage.label(mask)
    for i in range(1, n + 1):
        m = lb == i
        if m.sum() * RES * RES < min_area: continue
        cs = find_contours(np.pad(m, 1).astype(float), 0.5)
        r = max(cs, key=len)
        r = approximate_polygon(r, tolerance=tol)
        out.append([[round(X0 + (c - 0.5) * RES, 1), round(Y1 - (rr - 0.5) * RES, 1)] for rr, c in r[:-1]])
    return out

coast = max(rings(mainland, 1e6, tol=0.6), key=len)
islands = [r for r in rings(land & ~mainland, 40) if not any(math.dist(r[0], i['pts'][0]) < 30 for i in G['ISLANDS'])]
inland_seas = rings(seas, 600)
print('coast pts', len(coast), 'islands', len(islands), 'inland seas', len(inland_seas), file=sys.stderr)

# ---------------------------------------------------------------- far continents (lon/lat)
def transplant(name, src_box, centre_src, centre_dst, rot_deg, mirror, scale, warp_km, seed, res=0.1, box_dst=None):
    """An Earth landmass moved: local km plane about centre_src, mirrored, turned, scaled, warped, set at centre_dst."""
    _, at = earth_mask(*src_box, 0.03)
    lo0, lo1, la0, la1 = box_dst
    lons = np.arange(lo0, lo1, res); lats = np.arange(la1, la0, -res)
    LON, LAT = np.meshgrid(lons, lats)
    x = (LON - centre_dst[0]) * 111.32 * np.cos(np.radians(LAT)); y = (LAT - centre_dst[1]) * 111.32
    rng = np.random.RandomState(seed)
    def wn(a, b, k):   # smooth warp field
        f = rng.randn(*a.shape)
        return ndimage.gaussian_filter(f, k) * k * 0.9
    x = x + warp_km * wn(x, y, 18) ; y = y + warp_km * wn(x, y, 18)
    th = math.radians(-rot_deg)
    xr = (x * math.cos(th) - y * math.sin(th)) / scale; yr = (x * math.sin(th) + y * math.cos(th)) / scale
    if mirror: xr = -xr
    slat = centre_src[1] + yr / 111.32
    slon = centre_src[0] + xr / (111.32 * np.cos(np.radians(slat)))
    m = at(slon, slat).astype(bool)
    m = ndimage.binary_opening(m, iterations=1)
    lb, n = ndimage.label(m)
    out = []
    for i in range(1, n + 1):
        mm = lb == i
        if mm.sum() < 6: continue
        cs = find_contours(np.pad(mm, 1).astype(float), 0.5)
        r = approximate_polygon(max(cs, key=len), tolerance=0.6)
        out.append([[round(lo0 + (c - 0.5) * res, 2), round(la1 - (rr - 0.5) * res, 2)] for rr, c in r[:-1]])
    print(name, 'parts', len(out), file=sys.stderr)
    return out

far = {
    # the Dark Land (south): South America mirrored and turned, set where the cosmology maps put it
    'Dark Land': transplant('Dark Land', (-92, -28, -58, 14), (-60, -18), (50, -24), 160, True, 1.12, 160, 3, box_dst=(5, 100, -62, 12)),
    # the Land of the Sun (east): Australia with New Guinea and the island arcs north of it, turned on its side
    'Land of the Sun': transplant('Land of the Sun', (94, 160, -46, 9), (133, -22), (120, 33), 95, False, 1.45, 140, 7, box_dst=(80, 160, -8, 70)),
}

js = ('/* Shores for the unwritten edges of Arda, made from Earth\'s coastlines turned and bent (generated by\n'
      '   tools/continents/reshape.py; Natural Earth data, public domain). coast replaces GEO.COAST for drawing the land:\n'
      '   the books\' coast is kept exactly and only the guessed north, east and south shores change. */\n'
      'const SHORES = ' + json.dumps({'coast': coast, 'islands': islands, 'seas': inland_seas, 'far': far,
                                     'sectors': [s['name'] for s in SECTORS]}, separators=(',', ':')) + ';\n'
      'if (typeof self !== "undefined") self.SHORES = SHORES;\n')
open(os.path.join(ROOT, 'src', 'shores.js'), 'w').write(js)
# preview
im = Image.new('RGB', (W, H), (20, 30, 60)); d = ImageDraw.Draw(im)
d.polygon([px(p) for p in coast], fill=(90, 120, 70))
for r in islands: d.polygon([px(p) for p in r], fill=(90, 140, 70))
for r in inland_seas: d.polygon([px(p) for p in r], fill=(30, 50, 90))
d.line([px(p) for p in C] + [px(C[0])], fill=(255, 255, 255), width=1)
im.resize((W // 2, H // 2)).save(os.path.join(CACHE, 'preview.png'))
im.crop((int((-450 - X0) / RES), int((Y1 - 750) / RES), int((900 - X0) / RES), int((Y1 + 1450) / RES))).save(os.path.join(CACHE, 'preview_west.png'))
print('wrote src/shores.js', os.path.getsize(os.path.join(ROOT, 'src', 'shores.js')) // 1024, 'KB', file=sys.stderr)
