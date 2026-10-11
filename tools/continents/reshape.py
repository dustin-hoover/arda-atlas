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
SECTORS = [
    # the north shore: the Arctic coast from the White Sea to the Lena - Kanin, Yamal and the Ob gulf, Gydan, Taymyr,
    # with Novaya Zemlya and Severnaya Zemlya off it
    dict(name='Arctic coast, White Sea to the Lena', mirror=False, p1=(40.5, 64.6), p2=(128.5, 72.6), s=(0.00, 0.27)),
    # the east coast: Chukotka and Kamchatka round the Sea of Okhotsk to the Amur and the Tatar Strait, mirrored
    dict(name='Kamchatka and the Sea of Okhotsk (mirrored)', mirror=True, p1=(135.5, 43.5), p2=(178.0, 64.6), s=(0.27, 0.52)),
    # the south-east: the China coast, Leizhou and Hainan, the Gulf of Tonkin, mirrored
    dict(name='South China coast (mirrored)', mirror=True, p1=(106.5, 20.5), p2=(122.0, 31.0), s=(0.52, 0.66)),
    # the south: the north shore of the Mediterranean, Gibraltar to Iskenderun, mirrored - the Italian and Greek
    # peninsulas, Anatolia's south coast, Sardinia, Sicily, Crete, Cyprus (Africa left out)
    dict(name='Northern Mediterranean (mirrored)', mirror=True, p1=(-5.6, 36.0), p2=(36.0, 36.8), s=(0.66, 0.88),
         exclude=[[(-20, 0), (-20, 35.95), (-5.4, 35.95), (-1.0, 35.3), (8.5, 37.0), (10.3, 37.5), (11.4, 37.15), (11.4, 34.0),
                   (20.0, 32.2), (25.0, 32.3), (33.0, 31.4), (34.3, 31.2), (35.0, 29.0), (60, 0)],
                  # and the Levant and Syria beyond Iskenderun, and Iberia beyond Gibraltar (only open sea past the ends)
                  [(35.75, 25), (35.75, 36.6), (36.4, 37.4), (50, 40), (50, 25)], [(-20, 35.95), (-20, 46), (-5.7, 46), (-5.7, 35.95)]]),
    # the south-west, up to Harad: the west coast of India, Kathiawar and the Gulf of Khambhat
    dict(name='Western India', mirror=False, p1=(76.6, 8.6), p2=(69.0, 22.3), s=(0.88, 1.00)),
]
SRES = 3.0       # km per pixel of a sector's Earth raster

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
          "RIVERS:G.RIVERS.map(r=>({pts:r.pts})),PLACES:G.PLACES.filter(p=>p[2]!=null).map(p=>[p[2],p[3]]),SEA:G.SEA_LABELS}))") % ROOT
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

C = G['COAST']; IA, IB = 1140, 151          # the books' coast runs from IB (Harad) to IA (Forochel) in index order
kept = C[IB:IA + 1]
env = C[IA:] + C[:IB + 1]                  # the guessed outline: north shore, east coast, south, round to Harad
land0 = poly_mask([C])
d0 = (ndimage.distance_transform_edt(land0) - ndimage.distance_transform_edt(~land0)) * RES     # miles, + inland

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
for (x, y), s in zip(envd, envs):
    i, j = int((x - X0) / RES), int((Y1 - y) / RES)
    if 0 <= i < W and 0 <= j < H: S_env[j, i] = s
dist_env, idx = ndimage.distance_transform_edt(S_env < 0, return_indices=True)
s_near = S_env[idx[0], idx[1]]; dist_env *= RES
keptd, _ = dense(kept)
K = np.ones((H, W), bool)
for x, y in keptd:
    i, j = int((x - X0) / RES), int((Y1 - y) / RES)
    if 0 <= i < W and 0 <= j < H: K[j, i] = False
dist_kept = ndimage.distance_transform_edt(K) * RES
d_env = np.where(land0, dist_env, -dist_env)                  # signed distance to the guessed outline, + inland

# how much each place is reshaped: nowhere near the books' coast, fully along the guessed outline
w = sstep(0, 260, s_near) * sstep(Ls, Ls - 260, s_near) * sstep(-40, 160, dist_kept - dist_env)

# sectors: each moved onto its stretch; blended where they meet
def env_at(sv):
    k = int(np.searchsorted(envs, sv)); k = min(max(k, 0), len(envd) - 1); return complex(*envd[k])
Qx = X0 + (np.arange(W) + 0.5) * RES; Qy = Y1 - (np.arange(H) + 0.5) * RES
Q = Qx[None, :] + 1j * Qy[:, None]
f_new = np.zeros((H, W)); wsum = np.zeros((H, W))
near = np.abs(d_env) < 900
# a slow warp of the borrowed ground, so that no borrowed coast matches its source
rw = np.random.RandomState(5)
WARP = (ndimage.gaussian_filter(rw.randn(H, W), 140 / RES) + 1j * ndimage.gaussian_filter(rw.randn(H, W), 140 / RES))
WARP *= 75.0 / np.abs(WARP).std()                                 # km
# and a continental-scale bend (miles): broad lobes and bights, so the outline is nowhere a smooth round curve
BEND = (ndimage.gaussian_filter(rw.randn(H, W), 380 / RES) + 1j * ndimage.gaussian_filter(rw.randn(H, W), 380 / RES))
BEND *= 190.0 / np.abs(BEND).std()
for sec in SECTORS:
    E = sector_sdf(sec)
    sa, sb = sec['s'][0] * Ls, sec['s'][1] * Ls
    Ea, Eb = env_at(sa), env_at(sb)
    a = Eb - Ea; b = E['q2'] - E['q1']
    wv = (Q + BEND - Ea) / a
    if sec['mirror']: wv = np.conj(wv)
    P = E['q1'] + wv * b + WARP                                  # km in the sector's plane
    kpm = abs(b) / abs(a)                                        # Earth km per Arda mile
    i = np.clip(((P.real + E['R']) / SRES).astype(int), 0, E['n'] - 1); j = np.clip(((E['R'] - P.imag) / SRES).astype(int), 0, E['n'] - 1)
    edge = np.maximum(np.abs(P.real), np.abs(P.imag))
    fs = E['sdf'][j, i] / kpm
    feather = sstep(E['R'] - 20, E['R'] - 400, edge)              # fade to the old outline before the raster's edge
    ramp = 260.0
    win = sstep(sa - ramp, sa + ramp, s_near) * sstep(sb + ramp, sb - ramp, s_near)
    if sec['s'][0] == 0: win = sstep(sb + ramp, sb - ramp, s_near)
    if sec['s'][1] == 1: win = sstep(sa - ramp, sa + ramp, s_near)
    win = ndimage.gaussian_filter(win * near, 40 / RES) * feather    # smooth: no straight seams where sectors meet
    f_new += win * fs; wsum += win
    print(sec['name'], 'scale %.2f km/mi' % kpm, 'miles', round(sa), round(sb), file=sys.stderr)
f_new = (f_new + np.maximum(0, 1 - wsum) * d_env) / np.maximum(wsum, 1)      # where no sector reaches, the old outline
# deep inland stays land, the far ocean stays sea apart from islands the sectors bring
f_new = np.where(d_env > 700, np.maximum(f_new, d_env - 700), f_new)
# (further out off the east coast, where an island arc lies)
cap = -620 + 120 * sstep(0.64 * Ls, 0.70 * Ls, s_near) + 330 * sstep(0.84 * Ls, 0.90 * Ls, s_near)   # less far out in the south (the Dark Land) and south-west (the Straits)
_cn = ndimage.gaussian_filter(np.random.RandomState(8).randn(H, W), 30 / RES); cap += 90 * _cn / _cn.std()   # ragged, never a straight cut

f_new = np.where(d_env < cap, np.minimum(f_new, -1 - (cap - d_env)), f_new)
f = (1 - w) * d0 + w * f_new

# everything the books and our geography put there stays land
# (regional washes - deserts, grassland, uplift - may lose their coastal fringe; named features may not)
prot = poly_mask([r['pts'] for k in ('FORESTS', 'MARSHES', 'LAKES') for r in G[k] if 'pts' in r])
prot |= line_mask([(r['pts'], r['w']) for r in G['RANGES']]) | line_mask([(r['pts'], 4) for r in G['RIVERS']])
prot |= line_mask([([p, p], 10) for p in G['PLACES']])
prot &= land0
# the land reaches at least ~25 miles beyond each of them, with a ragged natural edge (a range running out to sea
# becomes a mountainous peninsula, not a straight-sided causeway)
pd = ndimage.distance_transform_edt(~prot) * RES
rng = np.random.RandomState(11)
ragged = ndimage.gaussian_filter(rng.randn(H, W), 6 / RES); ragged /= ragged.std()
f = np.maximum(f, 25 + 9 * ragged - pd)
land = f > 0
land &= ~((~land0) & (w < 0.02))                               # no new land off the books' coast
# the main land, its lakes and inland seas, and new islands
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

# main coast: the contour, with the books' coast spliced back in exactly
ring = max(rings(mainland, 1e6, tol=0.6), key=len)
ia = min(range(len(ring)), key=lambda k: math.dist(ring[k], C[IA])); ib = min(range(len(ring)), key=lambda k: math.dist(ring[k], C[IB]))
area = lambda P: sum(P[k][0] * P[(k + 1) % len(P)][1] - P[(k + 1) % len(P)][0] * P[k][1] for k in range(len(P)))
if (area(ring) > 0) != (area(C) > 0): ring = ring[::-1]; ia, ib = len(ring) - 1 - ia, len(ring) - 1 - ib
new_part = ring[ia:] + ring[:ib + 1] if ia > ib else ring[ia:ib + 1]
coast = [list(p) for p in kept] + new_part[1:-1]
islands = [r for r in rings(land & ~mainland, 40) if not any(math.dist(r[0], i['pts'][0]) < 30 for i in G['ISLANDS'])]
inland_seas = rings(seas, 600)
print('coast pts', len(coast), 'new part', len(new_part), 'islands', len(islands), 'inland seas', len(inland_seas), file=sys.stderr)

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
print('wrote src/shores.js', os.path.getsize(os.path.join(ROOT, 'src', 'shores.js')) // 1024, 'KB', file=sys.stderr)
