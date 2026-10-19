"""Redraw outlines that were sampled from a published atlas as our own shapes (rewrites src/geo.js in place).

The law (docs/otherworldly/LAWS.md I.2a): published maps may give only generalities - rough position and extent -
never line-work. Hill country (RELIEF) and the larger forest and marsh outlines were once sampled from Karen Wynn
Fonstad's atlas. Here each is reduced to its coarse extent (rasterised, blurred well beyond any line detail) and
given a new edge of our own (fractal noise of our own seed), then vectorised again. What survives from the source is
only where the region lies and roughly how big it is; the books' descriptions do the rest.

Run once: python3 tools/generalize/generalize.py   (idempotent in effect: re-running blurs our own shapes again)
"""
import json, math, os, re, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from skimage.measure import find_contours, approximate_polygon

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
GEO = os.path.join(ROOT, 'src', 'geo.js')
RES = 1.0          # miles per pixel
BLUR = 9.0         # miles: well beyond any line detail
EDGE = 7.0         # miles of our own edge roughness

FORESTS = {'Mirkwood', 'Lothlórien', 'Fangorn', 'Old Forest', 'Chetwood', 'Eryn Vorn', 'Trollshaws', 'Woods of Lindon', 'Woods of Rhûn'}
MARSHES = {'Nîn-in-Eilph', 'Ethir Anduin'}

def load():
    js = ("global.self=global;require('%s');const G=self.GEO;console.log(JSON.stringify({F:G.FORESTS,M:G.MARSHES,R:G.RELIEF,I:G.ISLANDS,C:G.COAST}))" % GEO)
    return json.loads(subprocess.check_output(['node', '-e', js]))

rng = np.random.RandomState(1937)
def noise_field(h, w, scale_px):
    f = np.zeros((h, w))
    for k, amp in ((1, 1.0), (2, 0.5), (4, 0.25)):
        f += amp * ndimage.gaussian_filter(rng.randn(h, w), max(1.0, scale_px / k))
    return f / (f.std() + 1e-9)

SKEL_BLUR = 34.0   # miles: the coast keeps only its continental shape; named gulfs are rebuilt from the books
def redraw(pts, blur=BLUR, edge=EDGE, min_area=30, res=None):
    global RES
    RES0 = RES
    if res: RES = res
    try: return _redraw(pts, blur, edge, min_area)
    finally: RES = RES0
def _redraw(pts, blur, edge, min_area):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    pad = 100
    x0, y0, x1, y1 = min(xs) - pad, min(ys) - pad, max(xs) + pad, max(ys) + pad
    W, H = int((x1 - x0) / RES) + 1, int((y1 - y0) / RES) + 1
    im = Image.new('L', (W, H), 0)
    ImageDraw.Draw(im).polygon([((x - x0) / RES, (y1 - y) / RES) for x, y in pts], fill=255)
    m = np.array(im, float) / 255
    area = m.sum()
    # blur in proportion to the region's size: only its rough extent survives, never its outline
    if min_area < 1e4: blur = max(blur, min(30.0, 0.2 * math.sqrt(area * RES * RES)))
    g = ndimage.gaussian_filter(m, blur / RES)
    # keep the area about the same: pick the threshold that preserves it, then roughen the edge with our noise
    t = np.quantile(g, 1 - area / g.size) if area > 0 else 0.5
    near = np.clip(g / max(t, 1e-6), 0, 1.5)                    # our edge noise only around the region, no specks far off
    f = g - t + (0.16 * noise_field(H, W, 22 / RES) * edge / 7 + 0.06 * noise_field(H, W, 6 / RES)) * t * near
    out = []
    lab, n = ndimage.label(f > 0)
    for i in range(1, n + 1):
        part = lab == i
        if part.sum() * RES * RES < min_area: continue
        cs = find_contours(np.pad(part, 1).astype(float), 0.5)
        r = approximate_polygon(max(cs, key=len), tolerance=0.8)
        out.append([[round(x0 + (c - 0.5) * RES, 1), round(y1 - (rr - 0.5) * RES, 1)] for rr, c in r[:-1]])
    out.sort(key=len, reverse=True)
    return out

def fmt(pts): return '[' + ','.join('[%g,%g]' % (x, y) for x, y in pts) + ']'

def main():
    G = load()
    src = open(GEO, encoding='utf8').read()
    # forests and marshes: replace the pts of each named entry (in order of appearance, as names repeat)
    for key, names in (('F', FORESTS), ('M', MARSHES)):
        for e in G[key]:
            if e['name'] not in names: continue
            old = fmt(e['pts'])
            # find the literal as written in geo.js (numbers may be formatted differently): match by the entry's name
            parts = redraw(e['pts'])
            if not parts: continue
            new = fmt(parts[0])
            pat = re.compile(r"(\{ name:'%s'[^\n]*?pts:)\[\[.*?\]\](\s*\})" % re.escape(e['name']))
            src, k = pat.subn(lambda mm: mm.group(1) + new + mm.group(2), src, count=1)
            # mark it as done so the next same-named entry is matched next time
            src = src.replace("{ name:'%s'" % e['name'], "{ name:'%s\u0000'" % e['name'], 1) if k else src
            print(e['name'], len(e['pts']), '->', len(parts[0]), file=sys.stderr)
    src = src.replace('\u0000', '')
    # hill country: the atlas's hachured hill country is dropped altogether. Foothills now come from the ranges'
    # own geology (src/rasters.js, rangeField) and named hills and downs from HILLS, which are ours.
    a = src.index('/* Hill country from Karen Wynn Fonstad')
    b = src.index('];', src.index('const RELIEF = [')) + 2
    src = src[:a] + ("/* Hill country beyond the named HILLS: none drawn here. Foothills come from the ranges' own geology\n"
                     "   (src/rasters.js, rangeField); hills and downs the books name are in HILLS. */\nconst RELIEF = [];") + src[b:]
    # the Trollshaws hills, drawn as a fine outline, become a simple line of our own
    src = re.sub(r"\{ name:'Trollshaws', h:420, w:30, pts:\[\[.*?\]\] \}",
                 "{ name:'Trollshaws', h:420, w:30, pts:[[341,4],[343,22],[352,36],[372,40]] }", src, count=1)
    # islands of the sea: the same treatment
    for e in G['I']:
        if e['name'] not in ('Tolfalas',): continue
        parts = redraw(e['pts'], blur=4, edge=4, min_area=20)
        if parts: src = re.sub(r"(\{ name:'%s', pts:)\[\[.*?\]\]" % re.escape(e['name']), lambda mm: mm.group(1) + fmt(parts[0]), src, count=1)
    # the coast: a coarse skeleton only (the large forms: the Gulf of Lhûn, the Bay of Belfalas, the Bay of Umbar,
    # the Ice Bay of Forochel); its detail is made by tools/continents/reshape.py from real Earth coasts
    skel = redraw(G['C'], blur=SKEL_BLUR, edge=3, min_area=1e5, res=2.0)[0]
    a = src.index('const COAST = [')
    b = src.index('];', a) + 2
    src = src[:a] + ("const COAST = [\n  // A coarse skeleton of Middle-earth's coast: where the general maps put the land, generalised far beyond\n"
                     "  // their line-work (tools/generalize/generalize.py). The drawn coast is built on it from real Earth\n"
                     "  // coastlines, turned and warped (tools/continents/reshape.py -> src/shores.js).\n  " + fmt(skel)[1:-1].replace('],[', '],\n  [', 0) + "\n];") + src[b:]
    open(GEO, 'w', encoding='utf8').write(src)

if __name__ == '__main__':
    main()
