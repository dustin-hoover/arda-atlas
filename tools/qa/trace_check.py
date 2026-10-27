"""How much of each outline still hugs the shapes once sampled from a published atlas (commit 4bc9892)?

Those shapes are not kept in the tree; this reads them from git history only to measure distance from them.
For every forest, marsh and island named in TRACED, the current outline is densified to 0.5 mi and each sample's
distance to the old traced outline is measured. A shape passes when no more than MAX_HUG of its outline lies
within HUG miles of the trace.

Run: python3 tools/qa/trace_check.py        (exit 1 when a shape fails)
"""
import json, os, subprocess, sys
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
TRACE_REV = '4bc9892'
HUG, MAX_HUG = 2.0, 0.20
TRACED = {'FORESTS': ['Mirkwood', 'Lothlórien', 'Fangorn', 'Old Forest', 'Chetwood', 'Eryn Vorn', 'Trollshaws',
                      'Woods of Lindon', 'Drúadan Forest'],
          'MARSHES': ['Nîn-in-Eilph', 'Ethir Anduin'],
          'ISLANDS': ['Tolfalas']}

DUMP = ("global.self=global;const fs=require('fs');eval(fs.readFileSync(process.argv[1],'utf8')+';global.G=GEO');"
        "console.log(JSON.stringify({FORESTS:G.FORESTS,MARSHES:G.MARSHES,ISLANDS:G.ISLANDS}))")


def load(src_text):
    p = os.path.join(ROOT, 'tools', 'qa', '.trace_tmp.js')
    open(p, 'w', encoding='utf8').write(src_text)
    try:
        return json.loads(subprocess.check_output(['node', '-e', DUMP, p], cwd=ROOT))
    finally:
        os.remove(p)


def dens(pts, step=0.5):
    out = []
    for a, b in zip(pts, pts[1:] + pts[:1]):
        n = max(1, int(np.hypot(b[0] - a[0], b[1] - a[1]) / step))
        for k in range(n):
            t = k / n; out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return np.array(out)


def seg_dist(P, ring):
    A = np.array(ring, float); B = np.roll(A, -1, 0); d = B - A
    L = np.maximum((d ** 2).sum(1), 1e-12)
    best = np.full(len(P), np.inf)
    for i in range(0, len(P), 2000):
        q = P[i:i + 2000, None, :]
        t = np.clip(((q - A) * d).sum(2) / L, 0, 1)
        c = A + t[..., None] * d
        best[i:i + 2000] = np.sqrt(((q - c) ** 2).sum(2)).min(1)
    return best


def main():
    old = load(subprocess.check_output(['git', 'show', TRACE_REV + ':src/geo.js'], cwd=ROOT).decode('utf8'))
    new = load(open(os.path.join(ROOT, 'src', 'geo.js'), encoding='utf8').read())
    bad = 0
    for key, names in TRACED.items():
        for n in names:
            o = [e for e in old[key] if e['name'] == n]; c = [e for e in new[key] if e['name'] == n]
            if not o or not c:
                print(f'{n:16s} (not in both versions)'); continue
            P = np.concatenate([dens(e['pts']) for e in c])
            d = np.min([seg_dist(P, e['pts']) for e in o], 0)
            hug = float((d < HUG).mean()); ok = hug <= MAX_HUG; bad += not ok
            print(f'{n:16s} median {np.median(d):5.1f} mi  within {HUG:g} mi: {100 * hug:4.0f}%  {"ok" if ok else "HUGS THE TRACE"}')
    print('TRACE-PASS' if not bad else f'TRACE-FAIL {bad}')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
