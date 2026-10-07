"""Route every journey leg across the terrain, so the paths follow roads, valleys and passes instead of
cutting straight across mountains, rivers and lakes. Writes src/routes.js (dense [X, Y, t] waypoints).

Inputs: terrain.npz from sample.py, geo.json exported from src/geo.js (see README.md).
Legs travelled by boat, on an Eagle or by ship are listed in MODES and routed (or not) accordingly."""
import heapq, json, math, os, re
import numpy as np
from scipy import ndimage as nd

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'src', 'routes.js')
T = np.load(os.path.join(HERE, 'terrain.npz'))
A, (X0, X1, Y0, Y1, S) = T['a'], T['box']
H, W = A.shape[:2]
geo = json.load(open(os.path.join(HERE, 'geo.json')))

def doy(m, d): return 1 + (m - 1) * 30 + (d - 1) + (3 if m >= 7 else 0)
def parse(s):
    if isinstance(s, (int, float)): return s
    y, m, d = (float(v) for v in s.split())
    di = math.floor(d); fr = d - di
    return (y - 3018) * 365 + doy(int(m), di) + (fr or 0.5)

# Legs not walked come from GEO.MODES in src/geo.js (exported into geo.json): (journey name regex, from date,
# to date, mode). A leg takes the mode when it starts at or after `from` and ends at or before `to`.
ROUTE_AS = {'ride': 'walk', 'barrel': 'boat', 'blackship': 'boat', 'fire': 'fly'}
MODES = [(m[0], m[1], m[2], ROUTE_AS.get(m[3], m[3])) for m in geo['MODES']]

h, s, mtn, hill, forest, dark, marsh, lake = (A[..., i] for i in range(8))
water = (s <= 0) | (lake > 0.5)
gy, gx = np.gradient(nd.gaussian_filter(h, 1.0), S)
slope = np.hypot(gx, gy)                                   # metres per mile

def to_px(x, y): return (x - X0) / S - 0.5, (Y1 - y) / S - 0.5
def to_xy(c, r): return X0 + (c + 0.5) * S, Y1 - (r + 0.5) * S

def raster(lines, width_cells, value_fn):
    """Rasterise polylines onto the grid; each cell takes the max value of the lines that cross it."""
    out = np.zeros((H, W), np.float32)
    for L in lines:
        v = value_fn(L); pts = L['pts']
        for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
            n = int(max(abs(xb - xa), abs(yb - ya)) / (S * 0.4)) + 1
            for t in np.linspace(0, 1, n + 1):
                c, r = to_px(xa + (xb - xa) * t, ya + (yb - ya) * t)
                ci, ri = int(round(c)), int(round(r))
                for dr in range(-width_cells, width_cells + 1):
                    for dc in range(-width_cells, width_cells + 1):
                        rr, cc = ri + dr, ci + dc
                        if 0 <= rr < H and 0 <= cc < W and out[rr, cc] < v: out[rr, cc] = v
    return out

road = raster(geo['ROADS'], 0, lambda L: {1: 1.0, 2: 0.85, 3: 0.7}.get(L['cls'], 0.7))
road = np.maximum(road, nd.grey_dilation(road, size=3) * 0.6)
RIV_PEN = {1: 70, 2: 22, 3: 7, 4: 2.5, 5: 1}
river_pen = raster(geo['RIVERS'], 0, lambda L: RIV_PEN.get(L['rank'], 1))
navigable = raster([r for r in geo['RIVERS'] if r['rank'] <= 3], 0, lambda L: 1.0)

# --- walking cost per cell (≈ effort per mile)
walk = (1 + slope / 90 + (slope / 220) ** 2 + 9 * mtn + 0.8 * hill * 0 + 0.7 * forest + 1.6 * dark + 3.5 * marsh
        + np.maximum(0, h - 1300) / 250)
walk = walk * (1 - 0.62 * road)                            # roads are quick
walk = walk + river_pen * (1 - np.clip(road * 1.4, 0, 1))  # wide rivers only at bridges and fords
walk[water] = np.inf
# --- by boat: rivers and lakes; short carries over land are costly
boat = np.where(navigable > 0, 0.25, 30.0).astype(np.float32)
boat[(lake > 0.5)] = 0.25
boat[(s <= 0) & (lake <= 0.5)] = np.inf
# --- by ship: open water only
ship = np.where(s <= 0.02, 1.0, 400.0).astype(np.float32)

NB = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
def astar(cost, a, b):
    (ca, ra), (cb, rb) = (tuple(int(round(v)) for v in to_px(*a)), tuple(int(round(v)) for v in to_px(*b)))
    ca, cb = min(max(ca, 0), W - 1), min(max(cb, 0), W - 1); ra, rb = min(max(ra, 0), H - 1), min(max(rb, 0), H - 1)
    d = math.hypot(ca - cb, ra - rb); m = int(25 + d * 0.6)
    c0, c1 = max(0, min(ca, cb) - m), min(W, max(ca, cb) + m + 1)
    r0, r1 = max(0, min(ra, rb) - m), min(H, max(ra, rb) + m + 1)
    C = cost[r0:r1, c0:c1].copy()
    # endpoints may sit just off a shore or on a quay: step to the nearest passable cell
    fin = np.isfinite(C)
    if fin.any():
        _, (ir, ic) = nd.distance_transform_edt(~fin, return_indices=True)
        ra, ca = ir[ra - r0, ca - c0] + r0, ic[ra - r0, ca - c0] + c0
        rb, cb = ir[rb - r0, cb - c0] + r0, ic[rb - r0, cb - c0] + c0
    minc = float(np.nanmin(C[np.isfinite(C)])) if np.isfinite(C).any() else 1.0
    hh, ww = C.shape
    g = np.full((hh, ww), np.inf); g[ra - r0, ca - c0] = 0
    prev = -np.ones((hh, ww), np.int64)
    goal = (rb - r0, cb - c0)
    pq = [(0.0, ra - r0, ca - c0)]
    while pq:
        f, r, c = heapq.heappop(pq)
        if (r, c) == goal: break
        gr = g[r, c]
        if f - math.hypot(r - goal[0], c - goal[1]) * minc > gr + 1e-9: continue
        for dr, dc in NB:
            rr, cc = r + dr, c + dc
            if not (0 <= rr < hh and 0 <= cc < ww): continue
            k = C[rr, cc]
            if not np.isfinite(k): continue
            step = (math.sqrt(2) if dr and dc else 1.0) * (k + C[r, c]) * 0.5
            ng = gr + step
            if ng < g[rr, cc]:
                g[rr, cc] = ng; prev[rr, cc] = r * ww + c
                heapq.heappush(pq, (ng + math.hypot(rr - goal[0], cc - goal[1]) * minc, rr, cc))
    if not np.isfinite(g[goal]): return None
    path, cur = [], goal[0] * ww + goal[1]
    while cur >= 0:
        r, c = divmod(cur, ww); path.append(to_xy(c + c0, r + r0)); cur = prev[r, c]
    return path[::-1]

def rdp(pts, eps):
    if len(pts) < 3: return pts
    a, b = np.array(pts[0]), np.array(pts[-1]); ab = b - a; L = np.hypot(*ab) or 1e-9
    d = [abs(ab[0] * (p[1] - a[1]) - ab[1] * (p[0] - a[0])) / L for p in pts[1:-1]]
    i = int(np.argmax(d)) + 1
    if d[i - 1] > eps: return rdp(pts[:i + 1], eps)[:-1] + rdp(pts[i:], eps)
    return [pts[0], pts[-1]]

def chaikin(pts, n=2):
    for _ in range(n):
        q = [pts[0]]
        for p0, p1 in zip(pts, pts[1:]):
            q += [(0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]), (0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1])]
        q.append(pts[-1]); pts = q
    return pts

def mode_of(name, ta, tb):
    for rx, a, b, m in MODES:
        if re.search(rx, name) and ta >= parse(a) - 1e-6 and tb <= parse(b) + 1e-6: return m
    return 'walk'

COST = {'walk': walk, 'boat': boat, 'sea': ship}
out, stats = {}, {'legs': 0, 'routed': 0, 'failed': 0}
for story, js in geo['JOURNEYS'].items():
    out[story] = {}
    for j in js:
        P = [(p[0], p[1], parse(p[2])) for p in j['pts']]
        dense = [P[0]]
        for (xa, ya, ta), (xb, yb, tb) in zip(P, P[1:]):
            stats['legs'] += 1
            md = mode_of(j['name'], ta, tb)
            seg = None
            if md not in ('fly', 'under') and math.hypot(xb - xa, yb - ya) > 2.5 * S:
                path = astar(COST[md], (xa, ya), (xb, yb))
                if path is None: stats['failed'] += 1; print('  no route:', story, j['name'], md, (xa, ya), '->', (xb, yb))
                else:
                    stats['routed'] += 1
                    seg = chaikin(rdp([(xa, ya)] + path[1:-1] + [(xb, yb)], 0.9), 1)
            if seg is None: seg = [(xa, ya), (xb, yb)]
            # spread the leg's time along its routed length
            L = np.concatenate([[0], np.cumsum([math.hypot(q[0] - p[0], q[1] - p[1]) for p, q in zip(seg, seg[1:])])])
            tot = L[-1]
            for (x, y), l in zip(seg[1:], L[1:]): dense.append((x, y, ta + (tb - ta) * (l / tot if tot else 1.0)))   # a wait in place ends at tb
        out[story][j['name']] = [[round(x, 1), round(y, 1), round(t, 3)] for x, y, t in dense]

with open(OUT, 'w') as f:
    f.write('/* Journey routes across the terrain, generated by tools/routing/route.py. Do not edit by hand:\n'
            '   change the waypoints in geo.js and re-run the router. [X, Y, t] with t in days (WX.parse). */\n')
    f.write('const ROUTES = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
    f.write("if (typeof self !== 'undefined') self.ROUTES = ROUTES;\n")
n = sum(len(v) for st in out.values() for v in st.values())
print(stats, 'points', n, 'bytes', os.path.getsize(OUT))
