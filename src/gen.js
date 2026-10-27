/* ============================================================================
   GEN — the Arda world engine. Deterministic procedural Earth-like surface
   generated from authored geography rasters. Shared by the page and workers.
   ========================================================================== */
const GEN = (() => {
'use strict';
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const MI = 1609.344;
const LAT0 = 52, MLAT = 69.05, MLON = 69.17;
const EARTH_C = 40075016.686;

function toLL(X, Y) {
  const lat = LAT0 + Y / MLAT;
  const c = Math.cos(lat * D2R);
  let lon = X / (MLON * Math.max(c, 1e-4));
  return [lon, lat];
}
function toXY(lon, lat) { return [lon * MLON * Math.cos(lat * D2R), (lat - LAT0) * MLAT]; }

/* ---------------- noise ---------------- */
const P = new Uint8Array(512);
(function seedPerm(seed) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = seed >>> 0;
  for (let i = 255; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
})(3019);

// gradient noise; the gradients from tables (same values as a switch on the hash, much faster in the hot loop)
const GXT = new Float64Array([1, -1, 1, -1, 1.41, -1.41, 0, 0]), GYT = new Float64Array([1, 1, -1, -1, 0, 0, 1.41, -1.41]);
function noise(x, y) {
  let X = Math.floor(x), Y = Math.floor(y);
  x -= X; y -= Y; X &= 255; Y &= 255;
  const u = x * x * x * (x * (x * 6 - 15) + 10), v = y * y * y * (y * (y * 6 - 15) + 10);
  const a = P[X] + Y, b = P[X + 1] + Y;
  const h00 = P[a] & 7, h10 = P[b] & 7, h01 = P[a + 1] & 7, h11 = P[b + 1] & 7, x1 = x - 1, y1 = y - 1;
  const g00 = GXT[h00] * x + GYT[h00] * y, g10 = GXT[h10] * x1 + GYT[h10] * y;
  const g01 = GXT[h01] * x + GYT[h01] * y1, g11 = GXT[h11] * x1 + GYT[h11] * y1;
  const l0 = g00 + u * (g10 - g00), l1 = g01 + u * (g11 - g01);
  return (l0 + v * (l1 - l0)) * 1.25;
}
function grad(h, x, y) { h &= 7; return GXT[h] * x + GYT[h] * y; }
function fbm(x, y, oct) {
  let s = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise(x, y); n += a;
    const nx = 1.62 * x - 1.18 * y + 17.3, ny = 1.18 * x + 1.62 * y - 9.1;
    x = nx; y = ny; a *= 0.5;
  }
  return s / n;
}
/* adaptive fbm: features from `big` miles down to `small` miles, amplitude ∝ scale^H */
function fbmA(X, Y, big, small, H, seed) {
  let s = 0, scale = big, amp = 1, x = X / big + seed * 13.7, y = Y / big - seed * 7.3;
  const f = Math.pow(0.5, H);
  while (scale > small * 0.5) {
    const w = scale < small ? (scale / small - 0.5) * 2 : 1;
    s += amp * w * noise(x, y);
    const nx = 1.62 * x - 1.18 * y + 5.1, ny = 1.18 * x + 1.62 * y + 3.7;
    x = nx; y = ny; amp *= f; scale *= 0.5;
  }
  return s;
}
function ridgedA(X, Y, big, small) {
  let s = 0, scale = big, amp = 0.55, x = X / big + 31.1, y = Y / big - 12.9, wt = 1;
  while (scale > small * 0.5) {
    const fade = scale < small ? (scale / small - 0.5) * 2 : 1;
    let n = 1 - Math.abs(noise(x, y));
    n *= n;
    const v = n * wt;
    wt = Math.min(1, v * 1.8);
    s += v * amp * fade;
    const nx = 1.62 * x - 1.18 * y + 5.1, ny = 1.18 * x + 1.62 * y + 3.7;
    x = nx; y = ny; amp *= 0.5; scale *= 0.5;
  }
  return s;
}
function hash2(ix, iy, s) {
  let h = (ix * 374761393 + iy * 668265263 + s * 144664) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const sat = v => v < 0 ? 0 : v > 1 ? 1 : v;
const sstep = (a, b, v) => { const t = sat((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

/* ---------------- rasters ---------------- */
let M = null, G = null, PEAKS = [], NUM = null, VEC = null, FLATS = [];
const NCH = 16;
const CH = { land:0, cont:1, mtn:2, hill:3, forest:4, gold:5, dark:6, marsh:7, arid:8, farm:9, ash:10, valley:11, uplift:12, grass:13, ice:14, lake:15 };

function init(data) {
  M = data.main; G = data.glob; PEAKS = data.peaks || []; RANGEPAL = data.ranges || []; NUM = data.numenor; FLATS = data.flats || [];
  initCoast(data.coast);
  if (data.vectors) initVectors(data.vectors);
  initTex(data.tex); MOUTHS = data.mouths || []; PINS = data.pins || []; initValleys(data.valleys);
  // river floors need the finished terrain, so they are measured last: once, in the page, then handed to the workers
  if (data.vectors) { if (!data.riverFloors) data.riverFloors = measureRiverFloors(); initRiverCarve(data.riverFloors); }
}

/* ---------------- the coast, drawn where the vector coast is ----------------
   Within COAST_BAND miles of the vector coast (src/shores.js: the books' coast, its islands and inland seas) the
   land/sea sign comes from the signed distance to those rings, not from the blurred and warped land raster, so the
   drawn shore is the vector shore with only a fraction of a mile of fine detail added. Further out the raster rules. */
const COAST_BAND = 8, CC = 4;
let CSEG = null, CGRID = null;
function initCoast(c) {
  CSEG = null; CGRID = null; if (!c || !c.rings) return;
  const segs = [];
  c.rings.forEach((r, ri) => {
    let A2 = 0; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; A2 += a[0] * b[1] - b[0] * a[1]; }
    const k = (A2 > 0 ? 1 : -1) * (c.land[ri] ? 1 : -1), n = r.length, base = segs.length;
    for (let i = 0; i < n; i++) { const a = r[i], b = r[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-9;
      segs.push({ a, b, nx: -dy / L * k, ny: dx / L * k, prev: base + (i + n - 1) % n, next: base + (i + 1) % n }); }
  });
  CSEG = segs; CGRID = new Map();
  segs.forEach((g, i) => {
    const x0 = Math.floor((Math.min(g.a[0], g.b[0]) - COAST_BAND) / CC), x1 = Math.floor((Math.max(g.a[0], g.b[0]) + COAST_BAND) / CC);
    const y0 = Math.floor((Math.min(g.a[1], g.b[1]) - COAST_BAND) / CC), y1 = Math.floor((Math.max(g.a[1], g.b[1]) + COAST_BAND) / CC);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const key = x * 65536 + y; let l = CGRID.get(key); if (!l) CGRID.set(key, l = []); l.push(i); }
  });
}
// signed distance (miles, + on land) to the nearest vector shore, or null beyond the band
function coastSD(X, Y) {
  if (!CGRID) return null;
  const l = CGRID.get(Math.floor(X / CC) * 65536 + Math.floor(Y / CC)); if (!l) return null;
  let best = Infinity, bi = -1, bt = 0;
  for (let j = 0; j < l.length; j++) { const g = CSEG[l[j]], dx = g.b[0] - g.a[0], dy = g.b[1] - g.a[1], L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((X - g.a[0]) * dx + (Y - g.a[1]) * dy) / L)) : 0, ex = g.a[0] + t * dx - X, ey = g.a[1] + t * dy - Y, d = ex * ex + ey * ey;
    if (d < best) { best = d; bi = l[j]; bt = t; } }
  if (bi < 0) return null;
  const d = Math.sqrt(best); if (d > COAST_BAND) return null;
  const g = CSEG[bi]; let nx = g.nx, ny = g.ny, px, py;
  // at a vertex, the side is judged against the mean of the two segments' normals (no false flips at sharp corners)
  if (bt <= 0) { const o = CSEG[g.prev]; nx += o.nx; ny += o.ny; px = g.a[0]; py = g.a[1]; }
  else if (bt >= 1) { const o = CSEG[g.next]; nx += o.nx; ny += o.ny; px = g.b[0]; py = g.b[1]; }
  else { px = g.a[0] + bt * (g.b[0] - g.a[0]); py = g.a[1] + bt * (g.b[1] - g.a[1]); }
  return (X - px) * nx + (Y - py) * ny >= 0 ? d : -d;
}

/* ---------------- photographic land cover ----------------
   Texture patches cut from real satellite imagery of Earth landscapes chosen as analogues (src/textures.js,
   docs/ANALOGUES.md). Each class has a fine patch (10-30 m/px) and a coarse one (80-250 m/px); both are turned into
   mip pyramids of brightness ratios (patch / its mean), sampled in world metres at the pixel's footprint, twice at
   different rotations and offsets mixed by noise so the repeat does not show. The colour is the analogue's own mean
   colour times that detail. */
let TX = null, MOUTHS = [], PINS = [];
/* The ranges' drainage network (rasters.js): segments binned on an 8-mile grid for lookup. */
let VS = null, VOFF = null, VIDX = null;
const VC = 8, VX0 = -2400, VY0 = -3300, VNX = Math.ceil(6300 / VC), VNY = Math.ceil(5300 / VC);
const valleyW = A => Math.min(8, 1.8 + 1.0 * Math.sqrt(A / 6));        // half-width in miles, by area drained
function initValleys(v) {
  VS = v && v.length ? v : null; if (!VS) return;
  const n = VS.length / 5, cnt = new Int32Array(VNX * VNY + 1), cells = [];
  for (let s = 0; s < n; s++) {
    const o = s * 5, w = valleyW(VS[o + 4]) + 2.5;
    const i0 = Math.max(0, Math.floor((Math.min(VS[o], VS[o + 2]) - w - VX0) / VC)), i1 = Math.min(VNX - 1, Math.floor((Math.max(VS[o], VS[o + 2]) + w - VX0) / VC));
    const j0 = Math.max(0, Math.floor((Math.min(VS[o + 1], VS[o + 3]) - w - VY0) / VC)), j1 = Math.min(VNY - 1, Math.floor((Math.max(VS[o + 1], VS[o + 3]) + w - VY0) / VC));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { cells.push(j * VNX + i, s); cnt[j * VNX + i + 1]++; }
  }
  for (let i = 1; i < cnt.length; i++) cnt[i] += cnt[i - 1];
  VOFF = cnt; VIDX = new Int32Array(cells.length / 2); const fill = Int32Array.from(cnt);
  for (let t = 0; t < cells.length; t += 2) VIDX[fill[cells[t]]++] = cells[t + 1];
}
// how much of a valley floor (X, Y) lies in: 0 on the ridges, rising to 1 on the floor of a big valley; small valleys
// are shallower. Valley sides are concave, floors flat where the valley is wide.
function valleyAt(X, Y) {
  if (!VS) return 0;
  const qx = X + 0.9 * noise(X / 5 + 3, Y / 5), qy = Y + 0.9 * noise(X / 5, Y / 5 - 6);     // meanders: no straight runs
  const i = Math.floor((qx - VX0) / VC), j = Math.floor((qy - VY0) / VC);
  if (i < 0 || j < 0 || i >= VNX || j >= VNY) return 0;
  const c = j * VNX + i;
  let best = 0;
  for (let t = VOFF[c]; t < VOFF[c + 1]; t++) {
    const o = VIDX[t] * 5, ax = VS[o], ay = VS[o + 1], dx = VS[o + 2] - ax, dy = VS[o + 3] - ay, A = VS[o + 4];
    const L = dx * dx + dy * dy, u = L ? Math.max(0, Math.min(1, ((qx - ax) * dx + (qy - ay) * dy) / L)) : 0;
    const d = Math.hypot(ax + u * dx - qx, ay + u * dy - qy), w = valleyW(A);
    if (d >= w) continue;
    const v = sstep(w, w * 0.22, d) * (0.35 + 0.65 * sat(Math.log(A / 6) / Math.log(60)));
    if (v > best) best = v;
  }
  return best;
}
// bright specks in a forest patch (tracks, a stream, a slip) repeat as marks: forests keep only gentle highlights
const CLAMP = { forest: 1.2, beech: 1.25, taiga: 1.25 };
const TXI = {};
const MI_M = 1609.344;
function pyramid(rgb, N, hi = 1.6) {
  const levels = [];
  let n = N, a = new Float32Array(N * N * 3), m = [0, 0, 0];
  for (let i = 0; i < N * N; i++) for (let c = 0; c < 3; c++) m[c] += rgb[i * 3 + c];
  for (let c = 0; c < 3; c++) m[c] = Math.max(1, m[c] / (N * N));
  for (let i = 0; i < N * N; i++) for (let c = 0; c < 3; c++) a[i * 3 + c] = rgb[i * 3 + c] / m[c];
  levels.push(a);
  while (n > 1) {
    const h = n >> 1, b = new Float32Array(h * h * 3);
    for (let j = 0; j < h; j++) for (let i = 0; i < h; i++) for (let c = 0; c < 3; c++)
      b[(j * h + i) * 3 + c] = 0.25 * (a[((2 * j) * n + 2 * i) * 3 + c] + a[((2 * j) * n + 2 * i + 1) * 3 + c] + a[((2 * j + 1) * n + 2 * i) * 3 + c] + a[((2 * j + 1) * n + 2 * i + 1) * 3 + c]);
    levels.push(b); a = b; n = h;
  }
  // each level relative to its own neighbourhood (three levels up, bilinear), so neighbouring cells of different local
  // tone do not show as blocks; done once here rather than per pixel
  const out = [];
  for (let l = 0; l < levels.length; l++) {
    const lm = Math.min(l + 3, levels.length - 1), nl = N >> l, nm = N >> lm, src = levels[l], up = levels[lm];
    if (lm === l) { out.push(src); continue; }
    const d = new Float32Array(src.length), acc = [0, 0, 0];
    for (let j = 0; j < nl; j++) for (let i = 0; i < nl; i++) {
      acc[0] = acc[1] = acc[2] = 0;
      txLevel(up, nm, (i + 0.5) * nm / nl, (j + 0.5) * nm / nl, acc, 1);
      const q = (j * nl + i) * 3;
      for (let c = 0; c < 3; c++) d[q + c] = Math.min(hi, Math.max(0.35, src[q + c] / Math.max(0.05, acc[c])));
    }
    out.push(d);
  }
  return out;
}
function initTex(t) {
  TX = null;
  if (!t || !t.cls) return;
  TX = { N: t.N, water: t.water, cls: t.cls.map((c, k) => { TXI[c.name] = k; return { name: c.name, mean: c.mean, tf: c.tf, tc: c.tc, fine: pyramid(c.fine, t.N, CLAMP[c.name]), coarse: pyramid(c.coarse, t.N, CLAMP[c.name]) }; }) };
}
// bilinear sample of one mip level, wrapping; adds w × rgb into acc
function txLevel(lv, n, u, v, acc, w) {
  u -= 0.5; v -= 0.5;
  const fu = Math.floor(u), fv = Math.floor(v), du = u - fu, dv = v - fv;
  const i0 = ((fu % n) + n) % n, j0 = ((fv % n) + n) % n, i1 = (i0 + 1) % n, j1 = (j0 + 1) % n;
  const a = (j0 * n + i0) * 3, b = (j0 * n + i1) * 3, c = (j1 * n + i0) * 3, d = (j1 * n + i1) * 3;
  const wa = (1 - du) * (1 - dv) * w, wb = du * (1 - dv) * w, wc = (1 - du) * dv * w, wd = du * dv * w;
  acc[0] += lv[a] * wa + lv[b] * wb + lv[c] * wc + lv[d] * wd;
  acc[1] += lv[a + 1] * wa + lv[b + 1] * wb + lv[c + 1] * wc + lv[d + 1] * wd;
  acc[2] += lv[a + 2] * wa + lv[b + 2] * wb + lv[c + 2] * wc + lv[d + 2] * wd;
}
// detail ratio of one pyramid at world point (metres xm, ym) for a footprint of pm metres per pixel; multiplies into out.
// Anti-repeat: the plane is cut into patch-sized cells, each showing the patch at its own offset, turn and mirror;
// neighbouring cells cross-fade (variance kept) so no seam or repeat shows. Detail fades out where the whole patch
// would be only a few dozen pixels across (the repeat would read as a pattern) - there the mean colour stands alone.
const tacc = [0, 0, 0], DIR = [1, 0];
function txPyr(pyr, res, xm, ym, pm, seed, out) {
  const N = Math.round(Math.sqrt(pyr[0].length / 3));
  const P = N * res / pm;                                 // patch size on screen, px
  const fade = sstep(16, 70, P);
  if (fade <= 0) return;
  const L = Math.log2(Math.max(pm / res, 1));
  const l0 = Math.min(Math.floor(L), pyr.length - 1), l1 = Math.min(l0 + 1, pyr.length - 1), t = L - Math.floor(L);
  const u = xm / res, v = ym / res, gu = u / N - 0.5, gv = v / N - 0.5;
  const i0 = Math.floor(gu), j0 = Math.floor(gv);
  const wx = sstep(0.2, 0.8, gu - i0), wy = sstep(0.2, 0.8, gv - j0);
  let ar = 0, ag = 0, ab = 0, ww = 0;
  for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) {
    const w = (a ? wx : 1 - wx) * (b ? wy : 1 - wy);
    if (w < 0.004) continue;
    const ci = i0 + a, cj = j0 + b;
    // each cell turned about its centre by an angle that drifts slowly across the land (like the grain of real ground),
    // so neighbours share their grain and a direction never repeats far; random turns would read as brushwork
    const th = 1.3 * noise(ci * 0.07 + seed * 0.37, cj * 0.07 - seed * 0.21), co = Math.cos(th), sn = Math.sin(th);
    const cu = (ci + 1) * N, cv = (cj + 1) * N, du = u - cu, dv = v - cv;
    const su = cu + du * co - dv * sn + hash2(ci, cj, seed + 1) * N * 8, sv = cv + du * sn + dv * co + hash2(ci, cj, seed + 2) * N * 8;
    tacc[0] = tacc[1] = tacc[2] = 0;
    txLevel(pyr[l0], N >> l0, su / (1 << l0), sv / (1 << l0), tacc, 1 - t);
    if (t > 0.02) txLevel(pyr[l1], N >> l1, su / (1 << l1), sv / (1 << l1), tacc, t);
    ar += w * (tacc[0] - 1); ag += w * (tacc[1] - 1); ab += w * (tacc[2] - 1); ww += w * w;
  }
  const k = fade / Math.sqrt(Math.max(ww, 1e-4));
  out[0] *= Math.max(0.2, 1 + ar * k); out[1] *= Math.max(0.2, 1 + ag * k); out[2] *= Math.max(0.2, 1 + ab * k);
}
const tcol = [0, 0, 0];
// colour of class k at (X, Y) miles, pixel footprint pix miles → tcol
function txColor(k, X, Y, pix, lite) {
  const c = TX.cls[k], pm = pix * MI_M, xm = X * MI_M, ym = -Y * MI_M;
  tcol[0] = c.mean[0]; tcol[1] = c.mean[1]; tcol[2] = c.mean[2];
  txPyr(c.coarse, c.tc, xm, ym, pm, 100 + 7 * k, tcol);
  if (!lite) txPyr(c.fine, c.tf, xm, ym, pm, 300 + 7 * k, tcol);
  return tcol;
}
// land-cover layers gathered while the procedural colour is built, then painted again from the real patches
const PL = { n: 0, k: new Int16Array(24), t: new Float32Array(24), c: new Float32Array(72) };
function plAdd(name, t) { if (TX && t > 0.04 && PL.n < 24) { PL.k[PL.n] = TXI[name]; PL.t[PL.n] = t; PL.n++; } }
// a plain colour among the layers (water in the bogs, lava channels): kept over the patches beneath it
function plRGB(r, g, b, t) { if (TX && t > 0.02 && PL.n < 24) { PL.k[PL.n] = -1; PL.t[PL.n] = t; PL.c[PL.n * 3] = r; PL.c[PL.n * 3 + 1] = g; PL.c[PL.n * 3 + 2] = b; PL.n++; } }

// the mountain ranges' own colours (Earth analogues, see rasters.js): rp.w is how strongly the nearest range's
// character applies here (1 on its crest, fading to 0 at its reach), rp.r that range
let RANGEPAL = [];
const rp = { w: 0, r: null };
function rangeAt(X, Y) {
  rp.w = 0; rp.r = null;
  for (const r of RANGEPAL) {
    if (X < r.bb[0] || X > r.bb[2] || Y < r.bb[1] || Y > r.bb[3]) continue;
    let d = 1e9; const P = r.pts;
    for (let i = 0; i < P.length - 1; i++) {
      const ax = P[i][0], ay = P[i][1], dx = P[i + 1][0] - ax, dy = P[i + 1][1] - ay, L = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((X - ax) * dx + (Y - ay) * dy) / L)); d = Math.min(d, Math.hypot(X - ax - dx * t, Y - ay - dy * t));
    }
    const w = 1 - Math.min(1, Math.max(0, (d - r.reach * 0.35) / (r.reach * 0.65)));
    if (w > rp.w) { rp.w = w; rp.r = r; }
  }
  return rp;
}
const F = new Float32Array(NCH);
function sampleMain(X, Y) {
  const px = (X - M.x0) / M.res - 0.5, py = (M.y1 - Y) / M.res - 0.5;
  if (px < 0 || py < 0 || px >= M.W - 1 || py >= M.H - 1) { F.fill(0); return 0; }
  const ix = px | 0, iy = py | 0, fx = px - ix, fy = py - iy;
  const i = iy * M.W + ix, W = M.W;
  const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
  const ch = M.ch;
  for (let c = 0; c < NCH; c++) {
    const a = ch[c];
    F[c] = (a[i] * w00 + a[i + 1] * w10 + a[i + W] * w01 + a[i + W + 1] * w11) * (1 / 255);
  }
  const ex = Math.min(X - M.x0, M.x0 + M.W * M.res - X), ey = Math.min(Y - (M.y1 - M.H * M.res), M.y1 - Y);
  return sat(Math.min(ex, ey) / 220);
}
function sample1(c, X, Y) {
  const px = (X - M.x0) / M.res - 0.5, py = (M.y1 - Y) / M.res - 0.5;
  if (px < 0 || py < 0 || px >= M.W - 1 || py >= M.H - 1) return 0;
  const ix = px | 0, iy = py | 0, fx = px - ix, fy = py - iy, i = iy * M.W + ix, a = M.ch[c], W = M.W;
  return ((a[i] * (1 - fx) + a[i + 1] * fx) * (1 - fy) + (a[i + W] * (1 - fx) + a[i + W + 1] * fx) * fy) / 255;
}
const GF = new Float32Array(4);
function sampleGlob(lon, lat) {
  let px = (lon + 180) / 360 * G.W - 0.5, py = (90 - lat) / 180 * G.H - 0.5;
  px = ((px % G.W) + G.W) % G.W; py = clamp(py, 0, G.H - 1.001);
  const ix = px | 0, iy = py | 0, fx = px - ix, fy = py - iy;
  const ix1 = (ix + 1) % G.W;
  const r0 = iy * G.W, r1 = r0 + G.W;
  for (let c = 0; c < 4; c++) {
    const a = G.ch[c];
    GF[c] = ((a[r0 + ix] * (1 - fx) + a[r0 + ix1] * fx) * (1 - fy) + (a[r1 + ix] * (1 - fx) + a[r1 + ix1] * fx) * fy) / 255;
  }
}

/* Results of the last evaluate() call */
const R = { h: 0, s: 0, wx: 0, wy: 0, wm: 0, lat: 0, lon: 0, base: 0, mtn: 0, stream: 0, mt: 0, vly: 0 };

function numenorField(X, Y) {
  if (!NUM) return 0;
  const dx = X - NUM.cx, dy = Y - NUM.cy;
  const d = Math.hypot(dx, dy);
  if (d > NUM.r * 1.25) return 0;
  const a = Math.atan2(dy, dx) + Math.PI / 2;
  const star = 0.5 + 0.5 * Math.pow(Math.abs(Math.cos(a * 2.5)), 1.6);
  const rr = NUM.r * (0.42 + 0.58 * star);
  return sstep(rr, rr * 0.75, d);
}

function peakAt(X, Y, pix) {
  let add = 0;
  for (let k = 0; k < PEAKS.length; k++) {
    const p = PEAKS[k];
    const dx = X - p.x, dy = Y - p.y;
    const reach = p.reach || p.r;
    if (dx > reach || dx < -reach || dy > reach || dy < -reach) continue;
    const d = Math.sqrt(dx * dx + dy * dy) / p.r;
    if (d >= reach / p.r) continue;
    let prof;
    if (p.kind === 'volcano') {
      // Orodruin (LR VI.3): a huge base about two thirds of the mountain's height, its shoulders broad and
      // scarred, and on it a steep ash-cone half as high again, with a fiery crater at the top
      const base = 0.66 * Math.pow(sat((1 - d) / 0.62), 1.25), cone = 0.36 * Math.pow(Math.max(0, 1 - d / 0.2), 1.15);
      prof = base + cone;
      if (d < 0.035) prof -= (0.035 - d) * 4.5;
      // after the Ring is unmade the Mountain is shattered (our staging of LR VI.3-4): the ash-cone is gone, the
      // shoulders split by rifts, and a ragged crater opens in the base where the Sammath Naur was
      if (DOOM) {
        const ang = Math.atan2(dy, dx), jag = 0.5 + 0.5 * Math.sin(ang * 7 + 1.3) * Math.sin(ang * 3.1);
        prof = base * (1 - 0.32 * Math.pow(Math.max(0, 1 - d / 0.42), 1.3)) + 0.05 * jag * Math.max(0, 1 - Math.abs(d - 0.36) / 0.08);
        prof -= 0.05 * Math.max(0, 1 - Math.abs(Math.sin(ang * 2 + 0.6)) * 30) * sat((1 - d) / 0.3);          // the rifts
      }
      prof *= 1 + 0.06 * noise(X * 3, Y * 3) * sat(d * 4);
    } else if (p.kind === 'knee') {
      // the Hill of Guard: seven terraces, one under each circle of Minas Tirith, each a hundred feet above the
      // last, on a shoulder of Mindolluin that runs back west into the mountain
      const dm = d * p.r * MI, R0 = 60, step = 95, lift = p.h / 7.6, edge = R0 + 7 * step;
      let terr = 0;
      if (dm < edge) { terr = p.h - lift * 7; for (let k = 0; k < 7; k++) terr += lift * sstep(R0 + k * step + 16, R0 + k * step, dm); }
      else terr = (p.h - lift * 7) * sstep(p.r * MI, edge, dm);
      let ridge = 0;
      if (p.to) {
        const vx = p.to[0] - p.x, vy = p.to[1] - p.y, L = Math.hypot(vx, vy), t = (dx * vx + dy * vy) / (L * L);
        if (t > -0.01 && t < 1) { const q = Math.abs(dx * vy - dy * vx) / L, w = 0.2 + 0.7 * Math.max(0, t); ridge = p.h * (1 + 2.2 * Math.max(0, t)) * Math.exp(-Math.pow(q / w, 2)); }
      }
      prof = Math.max(terr, ridge) / p.h;
    } else if (p.kind === 'lonely') {
      // the Lonely Mountain: a steep central massif and six great spurs; the River Running leaves the
      // Front Gate down the valley between the two southern spurs
      const ang = Math.atan2(dy, dx), dr = d * p.r;
      const adiff = a => Math.abs(((ang - a) % 6.2832 + 9.4248) % 6.2832 - 3.1416);
      let spur = 0;
      for (let k = 0; k < 6; k++) { const da = adiff(p.gate + (k + 0.5) * Math.PI / 3); spur = Math.max(spur, Math.exp(-Math.pow(da * dr / (0.9 + 0.12 * dr), 2))); }
      const core = Math.pow(Math.max(0, 1 - d / 0.34), 1.1);
      prof = Math.max(core, spur * Math.pow(Math.max(0, 1 - d / 0.85), 1.4) * 0.5);
      prof *= 1 - 0.75 * Math.exp(-Math.pow(adiff(p.gate) * dr / 0.7, 2)) * sstep(0.22, 0.4, d);
      if (pix < 0.2) prof *= 1 + 0.18 * ridgedA(X, Y, 0.9, Math.max(pix, 0.004)) * sat(d * 3);
    } else if (p.kind === 'hill') {
      prof = 0.5 + 0.5 * Math.cos(Math.PI * d);
      prof *= prof;
    } else {
      const ang = Math.atan2(dy, dx);
      const ridges = 0.75 + 0.25 * Math.abs(Math.sin(ang * 3 + p.x));
      prof = Math.pow(1 - d, 1.9) * ridges;
      if (pix < 0.2) prof *= 1 + 0.15 * ridgedA(X, Y, 1.2, Math.max(pix, 0.004));
    }
    if (p.kind === 'seamount') continue;
    add += p.h * prof;
  }
  return add;
}

/* Main surface evaluation. X,Y miles; pix = pixel footprint in miles. */
function evaluate(X, Y, pix) {
  R.mt = 0; R.vly = 0;
  // domain warp for organic outlines
  // (none at the river mouths and harbours the coast is pinned to: the shore stays where it was put)
  let pk = 1;
  for (let i = 0; i < PINS.length; i++) { const dx = X - PINS[i][0], dy = Y - PINS[i][1], d2 = dx * dx + dy * dy; if (d2 < 400) pk = Math.min(pk, sstep(2, 20, Math.sqrt(d2))); }
  const w1x = fbm(X * 0.0062 + 11.3, Y * 0.0062 + 7.1, 3) * 4 * pk, w1y = fbm(X * 0.0062 - 5.2, Y * 0.0062 + 19.7, 3) * 4 * pk;
  const w2x = noise(X * 0.035 + 3.3, Y * 0.035 - 1.1) * 3.2 * pk, w2y = noise(X * 0.035 - 8.4, Y * 0.035 + 2.2) * 3.2 * pk;
  const WX = X + w1x + w2x, WY = Y + w1y + w2y;
  const ll = toLL(WX, WY);
  const lat = LAT0 + Y / MLAT, lon = ll[0];
  const wm = sampleMain(WX, WY);
  let land = F[0], cont = F[1], mtn = F[2], ice = F[14];
  if (wm < 1) {
    sampleGlob(lon, ll[1]);
    const g = 1 - wm;
    land = land * wm + GF[0] * g; cont = cont * wm + GF[1] * g; mtn = mtn * wm + GF[2] * g; ice = ice * wm + GF[3] * g;
    for (let c = 3; c < NCH; c++) if (c !== 14) F[c] *= wm;
    F[0] = land; F[1] = cont; F[2] = mtn; F[14] = ice;
  }
  R.wx = WX; R.wy = WY; R.wm = wm; R.lat = lat; R.lon = lon;
  {
    const bx = X + 150 * fbm(X * 0.0022 + 5, Y * 0.0022, 4), by = Y + 150 * fbm(X * 0.0022, Y * 0.0022 + 9, 4);
    const bn = fbm(X * 0.012 + 50, Y * 0.012 - 30, 4), bl = fbm(X * 0.0045 - 20, Y * 0.0045 + 41, 4);
    const ar = sample1(8, bx, by) * wm, gr = sample1(13, bx, by) * wm;
    F[8] = sat(ar * (0.75 + 1.1 * bl + 0.5 * bn) + 0.15 * bn * ar);
    F[13] = sat(gr * (1 + 0.6 * bn));
    F[12] = F[12] * (1 + 0.3 * bn);
  }

  const cd = fbmA(X, Y, 28, Math.max(pix * 1.2, 0.0015), 0.92, 1);
  const sd = coastSD(X, Y);
  // near the coast: the vector shore, roughened by a few hundred yards at most; further out, the land raster
  const s = sd === null ? land - 0.5 + cd * 0.2 * (0.25 + 0.75 * pk) : sd * 0.06 + cd * 0.012;
  R.s = s; R.stream = 0;
  let h;
  if (s > 0) {
    const inland = sat((cont - 0.5) * 2.2);
    let base = 12 + 250 * inland + 1500 * F[12];
    base += 110 * fbm(X * 0.011, Y * 0.011, 3) * (0.3 + inland);
    // procedural uplands outside the authored world
    if (wm < 1) base += (1 - wm) * 500 * sat(fbm(X * 0.002 + 40, Y * 0.002, 3) + 0.2);
    h = base;
    const hill = F[3];
    if (hill > 0.004) h += hill * 1200 * (0.5 + 0.5 * fbm(X * 0.09 + 40, Y * 0.09, 4));
    if (mtn > 0.002) {
      const r = ridgedA(X, Y, 26, Math.max(pix * 1.1, 0.003));
      const mm = sstep(0, 0.35, mtn) * mtn;
      // the main valleys: the ranges' drainage network, tributaries joining trunks as real valleys do; inside them
      // the crags give way to the valley's own smoother floor and sides
      const u1 = valleyAt(X, Y);
      h += mm * 5200 * (0.12 + 0.88 * Math.pow(r, 1.35)) * (1 - 0.65 * u1);
      // valleys that drain: troughs run downhill from the crest (along the slope of the range's own mass), with
      // tributaries joining them at an angle and gullies feeding those, as in real mountains, instead of looping
      // the direction of the slope at a point (from the range's mass, sampled wide so the 8-bit raster's steps
      // do not make it wobble); where the slope is too gentle to read, a slowly turning default
      const slopeDir = (x, y) => {
        const ge = 10, gx = sample1(2, x + ge, y) - sample1(2, x - ge, y), gy = sample1(2, x, y + ge) - sample1(2, x, y - ge);
        const gl = Math.hypot(gx, gy), gk = sstep(0.01, 0.05, gl), a0 = 3 * noise(x / 300 + 5, y / 300);
        let ux = mix(Math.cos(a0), gl > 1e-6 ? -gy / gl : 1, gk), uy = mix(Math.sin(a0), gl > 1e-6 ? gx / gl : 0, gk);
        const l = Math.hypot(ux, uy) || 1; DIR[0] = ux / l; DIR[1] = uy / l;
      };
      const wq = 0.9 * noise(X / 30 + 3.1, Y / 30 - 8.4);
      // each pattern is laid out in local cells (coordinates from the cell's centre, blended between cells), so its
      // spacing holds as its direction turns across a range; measured from one far origin it would crowd into stripes
      const drain = (P, ang, seed) => {
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const C = P * 2.2, gxc = X / C - 0.5, gyc = Y / C - 0.5, i0 = Math.floor(gxc), j0 = Math.floor(gyc);
        const fx = sstep(0, 1, gxc - i0), fy = sstep(0, 1, gyc - j0);
        let acc = 0;
        for (let b = 0; b < 2; b++) for (let a2 = 0; a2 < 2; a2++) {
          const w = (a2 ? fx : 1 - fx) * (b ? fy : 1 - fy);
          if (w < 0.002) continue;
          const ci = i0 + a2, cj = j0 + b, dx = X - (ci + 0.5) * C, dy = Y - (cj + 0.5) * C;
          slopeDir((ci + 0.5) * C, (cj + 0.5) * C);                     // one direction per cell: straight-ish troughs, no wobble
          const ux = DIR[0] * ca - DIR[1] * sa, uy = DIR[0] * sa + DIR[1] * ca;
          const across = (dx * ux + dy * uy) / P + hash2(ci, cj, seed) * 7 + 0.35 * noise(X / (P * 1.7) + seed, Y / (P * 1.7));
          const along = (dx * -uy + dy * ux) / (P * 1.8) + hash2(ci, cj, seed + 1) * 7;
          acc = Math.max(acc, (1 - Math.abs(noise(across + seed, along - seed * 0.7))) * Math.min(1, w * 2.2));   // a cell's valleys fade out by its edge, where the next cell's take over: junctions, no seams
        }
        return acc;
      };
      const side = noise(X / 9 + 4, Y / 9 - 2) > 0 ? 1 : -1;
      const u2 = drain(6.5, 0.6 * side, 17);
      const u3 = 0;
      // only the lines' cores are valleys (narrow floors, wide ridges between); tributaries fade out on the high
      // ground and toward the main valleys' floors, gullies are slight
      const c1 = u1, c2 = sstep(0.68, 0.96, u2) * sstep(0.15, 0.6, 1 - c1) * sstep(0.05, 0.45, noise(X / 6 + 9, Y / 6 - 3)),   // tributaries here and there, never ranks of them
        c3 = sstep(0.86, 0.99, u3) * (1 - c1) * (1 - c2 * 0.7) * 0.6;
      R.mt = sstep(0, 0.35, mtn);
      R.vly = Math.max(c1, c2 * 0.7);
      h -= mm * 5200 * (0.5 * c1 * (2 - c1) + 0.2 * c2 + 0.05 * c3) + mm * 900 * fbmA(X, Y, 1.2, Math.max(pix * 1.1, 0.002), 0.85, 6) * (1 - c1);
    }
    // regional roughness: rolling country, low hills, broken ground
    const rough = sat(0.35 + 0.9 * fbm(X * 0.004 + 71, Y * 0.004 - 12, 3));
    h += (25 + 190 * rough) * (0.5 + 0.5 * fbmA(X, Y, 14, Math.max(pix * 1.1, 0.01), 0.75, 3)) * (1 - F[15]);
    h += (12 + 420 * mtn + 140 * hill + 30 * inland) * fbmA(X, Y, 3, Math.max(pix * 1.1, 0.002), 0.8, 2);
    // rolling lowland: swells and hollows of a few tens of metres over a mile or two, so the ground reads close up
    h += (14 + 26 * rough) * fbmA(X * 0.8 + 41, Y * 0.8 - 13, 2.5, Math.max(pix * 1.1, 0.004), 0.75, 81) * (1 - F[15]) * (1 - sat(mtn * 3));
    // drainage: a procedural stream network carved into the land
    let str = 0;
    {
      const qx = X * 0.09 + 2.3 * noise(X * 0.03, Y * 0.03), qy = Y * 0.09 + 2.3 * noise(X * 0.03 + 5, Y * 0.03);
      const v1 = 1 - Math.abs(noise(qx, qy));
      const v2 = 1 - Math.abs(noise(qx * 2.3 + 11, qy * 2.3 - 3));
      const w1 = Math.max(0.018, pix * 0.09), w2 = Math.max(0.03, pix * 0.2);
      const s1 = sstep(1 - w1 * 3, 1 - w1 * 0.3, v1), s2 = sstep(1 - w2 * 2, 1 - w2 * 0.2, v2) * 0.6;
      str = Math.max(s1, s2) * (1 - sstep(0.3, 0.7, F[8])) * (1 - F[10]) * sstep(0.35, 0.08, pix) * sstep(-0.25, 0.25, noise(X * 0.04 + 7, Y * 0.04 - 3));
      const cv1 = sstep(0.45, 1, v1), cv2 = sstep(0.6, 1, v2);
      h -= (5 + 30 * rough + 70 * hill + 160 * mtn) * Math.max(cv1 * cv1, 0.5 * cv2 * cv2);
    }
    R.stream = str;
    h *= sstep(0, 0.07, s);
    const lk = F[15];
    if (lk > 0.05) h = mix(h, base * 0.7 - 4, sstep(0.15, 0.55, lk));
    for (let k = 0; k < FLATS.length; k++) {
      const f = FLATS[k];
      const dx = X - f.x, dy = Y - f.y;
      if (dx > f.r || dx < -f.r || dy > f.r || dy < -f.r) continue;
      const d = Math.sqrt(dx * dx + dy * dy) / f.r;
      if (d < 1 && f.sea) { const t = sstep(1, 0.25, d); h = mix(h, Math.min(h, 4 + (h - 4) * 0.03), t); str *= 1 - t; R.stream = str; }   // havens lie on the shore
      else if (d < 1) { const t = sstep(1, 0.2, d) * 0.85; h = mix(h, Math.min(h, base + f.lift + (h - base) * 0.25), t); str *= 1 - t; R.stream = str; }
    }
    if (PEAKS.length) h += peakAt(X, Y, pix);
    if (RCGRID && !NOCARVE) h = riverCarve(X, Y, h);
    R.base = base;
    if (h < 0.6) h = 0.6;
  } else {
    const shelf = sstep(0, 0.1, -s);
    const deep = sstep(0.36, 0.08, cont);
    h = -4 - 150 * shelf - 3900 * deep * (0.6 + 0.4 * shelf);
    h += 320 * fbm(X * 0.005 + 3, Y * 0.005, 4) * deep;
    // a mid-ocean ridge running down the Great Sea
    const rdg = Math.exp(-Math.pow((X + 900 + 120 * Math.sin(Y * 0.004)) / 90, 2));
    h += rdg * 1900 * (0.7 + 0.3 * noise(X * 0.02, Y * 0.02)) * deep;
    const nf = numenorField(X, Y);
    if (nf > 0) {
      const top = -520 + 260 * fbm(X * 0.02, Y * 0.02, 3);
      h = mix(h, Math.max(h, top), nf);
      const dm = Math.hypot(X - NUM.cx, Y - NUM.cy);
      if (dm < 22) h = Math.max(h, -60 - dm * 18);
    }
    R.base = 0;
  }
  R.h = h; R.mtn = mtn;
  return h;
}

/* ---------------- climate ---------------- */
let DOOM = 0;
function setDoom(v) { DOOM = +v || 0; }
function tempAt(lat, h) {
  const c = Math.cos(Math.abs(lat) * D2R);
  return 34 * Math.pow(c, 1.5) - 9 - 0.0065 * Math.max(h, 0);
}
function moistAt(X, Y, lat, wm) {
  const alat = Math.abs(lat);
  let m = 0.62 - 0.6 * F[8] + 0.25 * F[7] + 0.12 * F[4] - 0.22 * sat((F[1] - 0.6) * 2.4);
  m += 0.2 * fbm(X * 0.004 + 9, Y * 0.004, 3) + 0.22 * fbm(X * 0.0013 - 17, Y * 0.0013 + 5, 3);
  if (wm < 1) {
    let g = 0.55 + 0.35 * fbm(X * 0.0025 - 4, Y * 0.0025, 3);
    g -= 0.45 * Math.exp(-Math.pow((alat - 24) / 8, 2));
    g += 0.3 * Math.exp(-Math.pow(alat / 9, 2));
    g -= 0.2 * sat((F[1] - 0.65) * 3);
    m = m * wm + g * (1 - wm);
  }
  return sat(m);
}

/* ---------------- colour ---------------- */
const tmp3 = [0, 0, 0];
function setc(r, g, b) { tmp3[0] = r; tmp3[1] = g; tmp3[2] = b; }
function blend(r, g, b, t) { tmp3[0] += (r - tmp3[0]) * t; tmp3[1] += (g - tmp3[1]) * t; tmp3[2] += (b - tmp3[2]) * t; }

// farmland: Voronoi parcels subdivided into strip fields, with hedgerows
const FC = [[190,170,112],[170,152,104],[150,140,96],[104,124,66],[88,112,58],[124,104,78],[112,92,70],[140,134,90],[96,116,64],[118,128,74]];
function fields(X, Y, cell, pix, hobbit) {
  // irregular parcels (a jittered lattice in a warped frame): each parcel its own crop, stubble or plough and its own
  // furrow direction, hedged round. Field systems differ by district - their lie and the size of their fields - but
  // within one the frame is fixed (a frame turning across the land, measured from a far origin, bends into arcs)
  const rg = noise(X * 0.045 + 11, Y * 0.045 - 7), k3 = rg > 0.22 ? 1 : rg < -0.22 ? 2 : 0;
  const th0 = [0.35, 1.05, 1.62][k3] + (hobbit ? -0.4 : 0), sz = [1, 1.3, 0.82][k3];
  const c = Math.cos(th0), s = Math.sin(th0);
  const wx = X + cell * 0.3 * noise(X / cell * 0.35, Y / cell * 0.35), wy = Y + cell * 0.3 * noise(X / cell * 0.35 + 7, Y / cell * 0.35 - 3);
  const u = (wx * c + wy * s) / (cell * sz), v = (-wx * s + wy * c) / (cell * sz * 0.72);
  const iu = Math.floor(u), iv = Math.floor(v);
  let d1 = 9, d2 = 9, ci = k3 * 99991, cj = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const a = iu + i + k3 * 99991, b = iv + j;
    const dx = u - (a - k3 * 99991 + 0.1 + 0.8 * hash2(a, b, 31)), dy = v - (b + 0.1 + 0.8 * hash2(a, b, 32)), d = dx * dx + dy * dy;
    if (d < d1) { d2 = d1; d1 = d; ci = a; cj = b; } else if (d < d2) d2 = d;
  }
  const edge = (Math.sqrt(d2) - Math.sqrt(d1)) * 0.5 * cell * sz * 0.8;     // miles to the parcel's edge (near enough)
  const pid = hash2(ci, cj, 11), k = hash2(ci, cj, 17);
  const col = pid < 0.3 ? FC[3 + Math.floor(k * 2)] : FC[Math.floor(k * FC.length)];
  const th = th0 + (hash2(ci, cj, 19) - 0.5) * 1.2, ct = Math.cos(th), st = Math.sin(th);
  const hedgeW = hobbit ? 0.006 : 0.004;
  // (only where a hedge is at least a pixel and a half wide: thinner lines shimmer into moiré in tilted views)
  const hedge = edge < hedgeW + pix * 0.5 ? sat(1 - (edge - hedgeW) / (pix + 1e-6)) * sstep(hedgeW * 1.4, hedgeW * 0.6, pix) : 0;
  const tram = 0.05 * Math.sin((X * ct + Y * st) / 0.004) * sstep(0.0035, 0.0015, pix);   // furrows, only where several pixels apart
  const trees = hedge > 0.5 && hash2(Math.floor(X / 0.007), Math.floor(Y / 0.007), 21) < 0.3 ? 1 : 0;
  const orch = pid >= 0.3 && pid < 0.36 && edge > 0.008 ? 1 : 0;      // orchard parcel (one field in sixteen or so)
  return [col[0] * (1 + tram), col[1] * (1 + tram), col[2] * (1 + tram), hedge, trees, orch, th];
}
/* Orchard rows: trees on a 7 m lattice aligned with the parcel grid. Uses F from the last evaluate().
   Returns null outside orchards, else { d: distance to the nearest tree in miles, tx, ty: that tree }. */
const ORCH_SP = 0.0044;
function orchardAt(X, Y, farm = F[9]) {
  if (farm <= 0.2) return null;
  const hob = farm > 0.85 && Math.abs(Y) < 120 && X > -80 && X < 70;
  const f = fields(X, Y, hob ? 0.2 : 0.34, 0.0005, hob);
  if (!f[5] || f[3] > 0.05) return null;
  const c = Math.cos(f[6]), s = Math.sin(f[6]);
  const a = X * c + Y * s, b = -X * s + Y * c;
  const ia = Math.round(a / ORCH_SP), ib = Math.round(b / ORCH_SP);
  const ta = ia * ORCH_SP, tb = ib * ORCH_SP;
  return { d: Math.hypot(a - ta, b - tb), tx: ta * c - tb * s, ty: ta * s + tb * c, ia, ib };
}

// tree crowns at high zoom: returns light factor (−1 gap … +1 sunlit crown)
function canopy(X, Y, spacing) {
  const gx = X / spacing, gy = Y / spacing;
  const ix = Math.floor(gx), iy = Math.floor(gy);
  let best = 9, lx = 0, ly = 0, rad = 0.5;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = ix + i, cy = iy + j;
    const px = cx + hash2(cx, cy, 21), py = cy + hash2(cx, cy, 23);
    const r = 0.45 + 0.35 * hash2(cx, cy, 25);
    const dx = gx - px, dy = gy - py;
    const d = Math.sqrt(dx * dx + dy * dy) / r;
    if (d < best) { best = d; lx = dx / r; ly = dy / r; rad = r; }
  }
  if (best > 1) return -1;
  // sun from the north-west: lit where (−x,+y)
  const lit = (-lx * 0.6 + ly * 0.6) * 0.8 + 0.25 * (1 - best);
  return clamp(lit, -0.9, 1);
}

/* colour at a point, using F/R from the evaluate() just done.
   mode: 0 satellite, 1 parchment, 2 hypsometric.  shade = hillshade factor. */
function colorAt(X, Y, h, slope, pix, mode, dsea) {
  const lat = R.lat, s = R.s, wm = R.wm;
  if (mode === 1) return parchmentColor(X, Y, h, slope, pix, dsea);
  if (mode === 2) return hypsoColor(X, Y, h, slope, pix);
  if (s <= 0) {
    // ---- ocean ----
    const depth = -h;
    const t1 = sstep(0, 60, depth), t2 = sstep(40, 400, depth), t3 = sstep(300, 3500, depth);
    const warm = sstep(18, 26, tempAt(lat, 0));
    setc(mix(70, 30, 0) + warm * 20, 150 + warm * 20, 150 + warm * 20);
    blend(26, 86, 110, t1);
    blend(16, 52, 84, t2);
    blend(9, 26, 54, t3);
    const n = fbmA(X, Y, 20, Math.max(pix, 0.003), 0.7, 5);
    tmp3[0] *= 1 + 0.05 * n; tmp3[1] *= 1 + 0.06 * n; tmp3[2] *= 1 + 0.05 * n;
    if (TX) {
      // water colours read from real coasts: sand shallows, the inshore shelf, open water; silt plumes off river mouths
      // a pale turquoise band within a mile or two of the shore, teal-blue over the continental shelf, deep navy beyond;
      // sand showing through right at the water's edge (our own colours, read from many real coasts)
      const W = TX.water, near = sstep(-0.085, -0.004, R.s + 0.012 * n), shelfT = sstep(900, 60, depth + 40 * n);
      let wr = mix(W.deep[0] + 2, 14, shelfT), wg = mix(W.deep[1] + 6, 54, shelfT), wb = mix(W.deep[2] + 16, 86, shelfT);
      wr = mix(wr, 48, near * 0.7); wg = mix(wg, 132, near * 0.7); wb = mix(wb, 132, near * 0.7);
      const edge = sstep(-0.014, -0.001, R.s);
      wr = mix(wr, W.shallow[0] + 40, edge * 0.5); wg = mix(wg, W.shallow[1] + 20, edge * 0.5); wb = mix(wb, W.shallow[2], edge * 0.5);
      const b = 1 - shelfT;
      const cold = 1 - warm;
      wr = mix(wr, wr * 0.8, cold * b); wg = mix(wg, wg * 0.85, cold * b);
      let pl = 0;
      for (const m of MOUTHS) {
        const dx = X - m.x, dy = Y - m.y;
        if (Math.abs(dx) > 40 || Math.abs(dy) > 40) continue;
        const r = 3.5 + Math.sqrt(m.w) * 0.85;
        const d = Math.sqrt(dx * dx + dy * dy) * (1 + 0.55 * noise(X * 0.2 + 3, Y * 0.2 - 1) + 0.25 * noise(X * 0.8 - 5, Y * 0.8));
        pl = Math.max(pl, sat(1 - d / r));
      }
      // silt off the river mouths: tan clouds fading and breaking up seaward
      if (pl > 0) { pl = Math.pow(pl, 1.1) * sstep(300, 5, depth); wr = mix(wr, 150, pl * 0.6); wg = mix(wg, 128, pl * 0.6); wb = mix(wb, 84, pl * 0.55); }
      blend(wr, wg, wb, 0.9);
    }
    const ice = F[14];
    if (ice > 0.05) {
      // near the poles the map grid pinches to a point: take the floes' noise in polar coordinates there instead
      let fX = X, fY = Y;
      if (Math.abs(lat) > 62) { const pr = (90 - Math.abs(lat)) * 69, a = R.lon * D2R; fX = pr * Math.cos(a) + (lat > 0 ? 5000 : -5000); fY = pr * Math.sin(a); }
      const floe = fbmA(fX, fY, 30, Math.max(pix * 2.5, 0.002), 0.85, 8);   // floes and leads, not a pixel dither
      const cov = sstep(0.1, 0.6, ice + 0.4 * floe);
      if (TX && TXI.seaice !== undefined) { const c = txColor(TXI.seaice, fX, fY, pix); blend(c[0], c[1], c[2], cov * 0.95); }
      else blend(222, 230, 238, cov * 0.95);
    }
    const lake = F[15];
    // lakes darker and clearer than the sea, with a paler rim of shallows
    if (lake > 0.4 && depth < 5) { blend(16, 40, 54, 0.85); blend(40, 92, 96, sstep(0.75, 0.45, lake) * 0.6); }
    if (depth < 3 && pix < 0.01) blend(210, 214, 206, sat(1 - depth / 3) * 0.35);
    return tmp3;
  }
  const T = tempAt(lat, h);
  const Mst = moistAt(X, Y, lat, wm);
  const arid = F[8];
  PL.n = 0; FIELDV = 0; FDN = 0; FARMP = 0;
  // ---- base ground ----
  const veg = sat(Mst * 1.35 - 0.15);
  setc(134, 124, 84);                            // dry steppe
  blend(68, 90, 42, veg);                        // lush grass
  if (T > 18) blend(158, 142, 82, sat((T - 18) / 6) * (1 - veg) * 0.8);   // savanna
  if (T > 20 && Mst > 0.7) blend(38, 70, 32, sat((Mst - 0.7) * 4) * sat((T - 20) / 4)); // jungle
  if (T < 3) blend(122, 118, 92, sat((3 - T) / 5));   // tundra
  const g = F[13];
  if (g > 0.02) {
    // the grasslands: green and long in Rohan and the dales (LR III.2: 'green fields', 'the grass was long'), turning
    // to straw only where the land is dry (the Brown Lands, the Wold, the steppe)
    const gp = fbmA(X, Y, 1.5, Math.max(pix * 1.3, 0.004), 0.75, 51), dryG = sat(arid * 2.5);
    blend(98 + 16 * gp, 124 + 10 * gp, 60, g * 0.55 * (1 - dryG));
    blend(158 + 18 * gp, 144 + 10 * gp, 84, g * 0.5 * dryG);
    blend(86, 108, 54, g * sat(-gp * 1.8) * 0.45);
  }
  // landcover variety: scrub, heath, bare ground, riparian green
  const lc1 = fbm(X * 0.05 + 21, Y * 0.05 - 4, 4), lc2 = fbmA(X, Y, 1.2, Math.max(pix * 1.5, 0.004), 0.6, 30);
  blend(120, 112, 74, sat(lc1 * 1.6) * 0.28);                  // dry grass patches
  blend(54, 76, 38, sat(-lc1 * 1.6) * 0.45 * veg);             // lush hollows
  blend(112, 96, 78, sat((F[3] + sat(h / 1500)) * 0.8) * sat(lc2 + 0.2) * 0.45);   // heath on hills
  const lv = lc2 * 0.1 + 0.07 * fbm(X * 0.012 - 30, Y * 0.012 + 8, 3) + 0.07 * fbmA(X, Y, 3, Math.max(pix * 1.5, 0.01), 0.7, 33); tmp3[0] *= 1 + lv; tmp3[1] *= 1 + lv * 0.9; tmp3[2] *= 1 + lv * 0.7;
  if (R.stream > 0) blend(56, 78, 40, R.stream * 0.55 * veg + 0.1 * R.stream);
  // real ground: tussock grassland by default, steppe where dry (Rhûn), green pasture where wet, brown schist downs on
  // the hills, savanna in the hot south, tundra in the cold north
  plAdd('tussock', 1 - 0.88 * sat(g * 1.2) * (1 - sat(arid * 2.5)));        // Rohan's grass is green and long, not tussock
  if (g > 0.05) plRGB(92 + 14 * lc1, 116 + 10 * lc1, 54, sat(g * 1.1) * (1 - sat(arid * 2.5)) * 0.58);   // ... and green over the whole Mark
  plAdd('steppe', sat((0.5 - veg) * 3) * (X > 1000 || wm < 1 ? 1 : 0.4));
  plAdd('pasture', Math.max(sstep(0.18, 0.55, veg + 0.15 * lc1) * (1 - 0.85 * sat(g * 1.5) * sat(arid * 2.5)),
    // the temperate west and the vales (Eriador, the Lone-lands, the vale of Anduin, Rohan) are green, not steppe-brown
    sstep(0.17, 0.36, Mst) * sstep(2, 6, T) * (1 - 0.55 * sat(g * 1.6) * sat(arid * 2.5)) * (1 - arid) * 0.85,
    // Rohan's long grass: green pasture texture across the grassland wherever it is not dry
    sat(g * 1.2) * (1 - sat(arid * 2.5)) * 0.8) * (1 - sat((T - 15) / 6)));
  plAdd('schist', sat(F[3] * 1.5) * (1 - 0.6 * veg) * sat(lc2 + 0.6));
  if (T > 18) plAdd('savanna', sat((T - 18) / 6) * (1 - veg) * 0.9);
  if (T < 3) plAdd('tundra', sat((3 - T) / 5));
  // alpine grassland and mountain rock tones by elevation
  const alp = sstep(900, 2200, h);
  const RP = h > 250 ? rangeAt(X, Y) : (rp.w = 0, rp);
  const tw = (a, i) => RP.w ? 1 + (RP.r[a][i] - 1) * RP.w : 1;
  if (alp > 0) blend(126 * tw('m', 0), 118 * tw('m', 1), 92 * tw('m', 2), alp * 0.55);
  plAdd('tussock', alp * 0.7);
  // on the ranges' lower slopes, meadow and scrub take the analogue's colour too
  if (RP.w > 0) blend(126 * tw('m', 0), 118 * tw('m', 1), 92 * tw('m', 2), RP.w * sstep(250, 900, h) * (1 - alp) * 0.6);
  // arid / desert
  const hot = sstep(9, 19, T);
  let desert = sat(arid * 1.1 - 0.05);
  if (wm < 1) desert = Math.max(desert, sat((0.32 - Mst) * 3) * (1 - wm));
  if (desert > 0.01) {
    const dn = fbm(X * 0.02, Y * 0.02, 3);
    const dr = 212 + 18 * dn, dg = 178 + 10 * dn, db = 120;
    const cr = 132, cg = 112, cb = 82;
    blend(mix(cr, dr, hot), mix(cg, dg, hot), mix(cb, db, hot), desert);
    plAdd('schist', desert * (1 - hot));
    plAdd('hamada', desert * hot);
    plAdd('sand', desert * hot * sstep(0.55, 0.85, desert + 0.3 * dn));
    if (hot > 0.5 && desert > 0.6 && pix < 0.2) {
      const dune = Math.abs(noise(X * 0.9 + noise(X * 0.1, Y * 0.1) * 2, Y * 0.35));
      const dl = (dune - 0.35) * 0.18 * sat((0.2 - pix) * 6);
      tmp3[0] *= 1 + dl; tmp3[1] *= 1 + dl; tmp3[2] *= 1 + dl;
    }
  }
  // farmland
  const farm = F[9];
  if (farm > 0.03) {
    const hob = F[9] > 0.85 && Math.abs(Y) < 120 && X > -80 && X < 70;
    const cell = hob ? 0.2 : 0.34;
    const pf = sstep(0.25, 0.6, farm + 0.35 * fbm(X * 0.08 + 3, Y * 0.08, 3));
    const favg = 0.5 * pf;
    plAdd(hob || lat > 49 ? 'pasture' : 'arable', pf * 0.95);
    if (pix < cell * 0.1) {
      const f = fields(X, Y, cell, pix, hob);
      const t = sat((cell * 0.22 - pix) / (cell * 0.12)) * pf;
      FIELDV = t * 0.85;
      blend(118, 128, 76, favg * (1 - t));
      const k = 0.4 + 0.6 * sat((cell * 0.08 - pix) / (cell * 0.05));
      blend(118 + (f[0] - 118) * k, 128 + (f[1] - 128) * k, 76 + (f[2] - 76) * k, t * 0.85);
      if (f[3] > 0) blend(f[4] ? 44 : 70, f[4] ? 62 : 86, f[4] ? 34 : 48, f[3] * t * 0.85 * sat((0.012 - pix) / 0.006));
      if (f[5] && pix < 0.006) {
        // orchard: grassy alleys between rows of round crowns
        const o = orchardAt(X, Y), r = ORCH_SP * 0.36;
        blend(96, 122, 62, t * 0.8);
        if (o) { const cr = sat((r - o.d) / Math.max(pix, 0.0003) + 0.5); blend(54, 86, 38, cr * t * sat((0.006 - pix) / 0.003)); }
      }
    } else {
      // middle zoom: single fields are too small to draw, but the patchwork still shows (each run of fields its own
      // crop or stubble); further out the blocks of farms, then only their average and the regional variety
      // (each level fades out before its parcels shrink to a couple of pixels: no shimmer or moiré)
      const ta = pf * sstep(cell * 0.6, cell * 0.25, pix), tb = pf * sstep(cell * 3.2, cell * 1.2, pix) * (1 - ta / Math.max(pf, 1e-6));
      blend(118, 128, 76, favg * (1 - ta - tb));
      if (tb > 0.01) { const f = fields(X + 31, Y - 17, cell * 5, pix, hob); blend(f[0], f[1], f[2], tb * 0.7); }
      if (ta > 0.01) { const f = fields(X, Y, cell, pix, hob); blend(f[0], f[1], f[2], ta * 0.8); }
      const t = ta + tb;
      FIELDV = t;
      const fn = fbm(X / cell * 0.8, Y / cell * 0.8, 3);
      tmp3[0] *= 1 + 0.08 * fn * pf * (1 - t); tmp3[1] *= 1 + 0.06 * fn * pf * (1 - t);
    }
    FARMP = pf;
  }
  // natural woodland and forests
  let fd = F[4];
  if (farm > 0.2) fd = Math.max(fd, sstep(0.42, 0.5, fbm(X * 0.9 + 3, Y * 0.9 - 8, 3) + 0.15 * noise(X * 6, Y * 6)) * 0.9 * sat(farm));
  const temperate = sstep(-4, 3, T) * (1 - sstep(24, 30, T));
  const wild = sstep(0.1, 0.55, fbm(X * 0.03 + 7, Y * 0.03, 4) + 0.35 * (Mst - 0.5)) * Mst * 0.7 * temperate * (1 - arid) * (1 - F[9] * 0.8) * (1 - g * 0.9);
  fd = Math.max(fd * (0.7 + 0.3 * sat(Mst + 0.3)), wild * (wm < 1 ? 1 : 0.55));
  const treeline = 2600 - Math.max(0, Math.abs(lat) - 40) * 55;
  // montane forest: dark conifers fill the valleys and lower slopes of wet ranges
  if (R.mt > 0.05) fd = Math.max(fd, R.mt * sat((Mst - 0.22) * 3) * (1 - arid) * (0.35 + 0.65 * R.vly) * sstep(0.3, 0.55, 0.5 + 0.6 * fbm(X * 0.4 + 9, Y * 0.4 - 4, 3) + 0.7 * R.vly));
  fd *= sstep(treeline, treeline - 500, h);
  fd *= 1 - sstep(0.55, 0.9, slope) * 0.6;
  if (fd > 0.01) {
    const dk = F[6];
    const conifer = sat(sstep(8, 1, T + 0.004 * 0) + sstep(treeline - 1200, treeline - 400, h));
    let fr = mix(50, 30, conifer), fg = mix(70, 50, conifer), fb = mix(36, 34, conifer);
    if (dk > 0) { fr = mix(fr, 22, dk); fg = mix(fg, 36, dk); fb = mix(fb, 24, dk); }
    const gold = F[5];
    if (gold > 0) { const gm = gold * (0.35 + 0.35 * sat(0.5 + fbm(X * 0.6, Y * 0.6, 3)));
      if (GOLDS) { fr = mix(fr, 168, gm); fg = mix(fg, 140, gm); fb = mix(fb, 52, gm); }
      else { fr = mix(fr, 72, gm * 0.6); fg = mix(fg, 112, gm * 0.6); fb = mix(fb, 44, gm * 0.6);              // summer: fresh green crowns
        if (pix < 0.01 && hash2(Math.floor(X / 0.0025), Math.floor(Y / 0.0025), 77) < 0.08 * gold) { fr = 226; fg = 204; fb = 70; } }   // and yellow flowers in the glades
    }
    if (T > 22) { fr *= 0.8; fg *= 1.05; }
    if (RP.w > 0) { fr *= tw('f', 0); fg *= tw('f', 1); fb *= tw('f', 2); }
    // north-facing slopes and valley floors lie in shadow longer: their woods read darker
    { const sh = 1 - 0.14 * ASPN - 0.07 * R.vly + 0.05 * ASPS; fr *= sh; fg *= sh; fb *= sh; }
    if (gold > 0.3 && GOLDS) { const lg = 1 + 0.12 * gold; fr *= lg; fg *= lg; }          // Lórien's crowns catch the light
    const mott = fbmA(X, Y, 0.6, Math.max(pix, 0.002), 0.7, 9);
    fr *= 1 + 0.12 * mott; fg *= 1 + 0.14 * mott; fb *= 1 + 0.1 * mott;
    // the edge is a ragged zone, never a line: the canopy breaks into clumps and lone trees, then scrub, then grass
    const en = fbmA(X, Y, 10, Math.max(pix, 0.003), 0.8, 40), cl = fbmA(X, Y, 0.35, Math.max(pix, 0.002), 0.85, 41);
    let dens = sstep(0.32, 0.5, fd + 0.38 * en + 0.1 * cl);
    // the great dark woods (Mirkwood) close over entirely; lighter woods (the Trollshaws, Chetwood, Ithilien) are patchy
    if (dk > 0.85) dens = Math.max(dens, sstep(0.18, 0.4, fd + 0.2 * en));
    const patchy = sat((0.93 - F[4]) * 4) * (1 - sat(dk * 2));
    if (patchy > 0) dens *= 1 - patchy * 0.75 * sstep(-0.05, 0.3, fbmA(X * 0.8 - 17, Y * 0.8 + 5, 2, Math.max(pix, 0.01), 0.8, 43));
    // glades and thinner stands inside the wood (heath, bog, windthrow, old clearings)
    dens *= 1 - 0.55 * (1 - sat(F[6] * 1.15)) * sstep(0.3, 0.5, fbmA(X * 0.9 + 40, Y * 0.9, 3, Math.max(pix, 0.01), 0.8, 42)) * sat(fd * 1.5);   // (few in the dark woods)
    const fringe = sstep(0.08, 0.3, fd + 0.15 * en) * (1 - dens);
    if (fringe > 0) {
      blend(70, 82, 48, fringe * 0.35);                                   // scrub and bracken before the trees
      dens = Math.max(dens, fringe * sstep(0.25, 0.5, cl + 0.25 * sat(fd * 2)) * 0.95);   // copses and lone trees
    }
    if (pix < 0.008) {
      // crowns: broad in Lórien; in the old dark woods (Fangorn, the Old Forest) of every size, with gaps where giants fell
      const og = dk > 0.45 && dk < 0.85 ? 1 : 0;
      const c = canopy(X, Y, gold > 0.5 ? 0.012 : 0.0065 * (1 + og * 0.6 * (0.5 + 0.5 * noise(X / 0.05, Y / 0.05))));
      const gap = c < -0.5;
      const lit = 1 + 0.32 * c * sat((0.008 - pix) / 0.004);
      if (gap) dens *= sat(1 - (0.8 - fd) * 1.5);
      fr *= lit; fg *= lit; fb *= lit;
    }
    blend(fr, fg, fb, dens);
    FDN = dens;
    plAdd(T < 2 || Math.abs(lat) > 64 ? 'taiga' : (R.mt > 0.3 || gold > 0.3 || conifer > 0.6) ? 'beech' : 'forest', dens * (dk > 0.5 ? 1 : 0.95));
    // the mallorns' gold lies over the texture of their crowns, from autumn until spring; in summer they are green
    if (gold > 0.05 && GOLDS) { const gv = sat(0.5 + fbm(X * 0.6, Y * 0.6, 3)); plRGB(176 + 30 * gv, 146 + 22 * gv, 58, gold * dens * (0.38 + 0.2 * gv)); }
    if (gold > 0.05 && !GOLDS && pix < 0.01 && hash2(Math.floor(X / 0.0025), Math.floor(Y / 0.0025), 77) < 0.08 * gold) plRGB(226, 204, 70, 0.8);   // yellow flowers in the glades
  }
  // marsh
  const marsh = F[7];
  if (marsh > 0.02) {
    blend(74, 84, 52, marsh * 0.8);
    plAdd('bog', marsh * 0.85);
    const pools = fbmA(X, Y, 0.8, Math.max(pix, 0.002), 0.8, 12);
    if (pools > 0.18) { blend(46, 64, 62, sat((pools - 0.18) * 6) * marsh); plRGB(30, 46, 44, sat((pools - 0.18) * 6) * marsh); }
  }
  // ash and slag of Mordor
  const ash = F[10];
  if (ash > 0.02) {
    const an = fbm(X * 0.08, Y * 0.08, 4);
    const af = sstep(0.25, 0.55, ash + 0.3 * fbmA(X, Y, 6, Math.max(pix, 0.003), 0.8, 44));
    blend(62 + 12 * an, 57 + 10 * an, 54 + 8 * an, af * 0.94);
    const dO = Math.hypot(X - 840, Y + 554);
    // Mordor: Icelandic black ash plain, with black Icelandic lava fields spread over Gorgoroth and Hawaiian cinder and young
    // flows about the Mountain
    plAdd('ashplain', af * 0.94);
    // lava fields end in sharp margins, crinkled at every scale
    const lf = ash * 0.8 + 0.5 * fbm(X * 0.07 + 13, Y * 0.07 - 2, 4) + 0.12 * fbmA(X, Y, 2.5, Math.max(pix, 0.003), 0.8, 61);
    plAdd('blacklava', af * sstep(0.63, 0.63 + Math.max(0.01, pix * 0.25), lf) * 0.92);
    if (dO < 70) plAdd('cinder', sat(1 - dO / 70) * af * 0.85);
    if (dO < 25) plAdd('lava', sat(1 - dO / 25) * af);
    if (dO < 30) {
      const flows = Math.abs(noise(Math.atan2(Y + 554, X - 840) * 6, dO * 0.25));
      if (flows < 0.07) { blend(98, 34, 16, (1 - flows / 0.07) * sat(1 - dO / 30) * 0.9); plRGB(98, 34, 16, (1 - flows / 0.07) * sat(1 - dO / 30) * 0.9); }
      blend(40, 36, 36, sat(1 - dO / 12) * 0.6);
    }
  }
  // alpine: rock on steep slopes and high ground, snow above the snowline
  // bare rock: steep slopes and high ground, and more of it in ranges whose analogues are bare (the High Atlas)
  const bare = RP.w ? RP.r.bare * RP.w * sstep(300, 1200, h) * sat(0.4 + fbm(X * 0.2 + 5, Y * 0.2, 3)) : 0;
  const rock = Math.max(sstep(0.5, 0.95, slope), sstep(treeline + 200, treeline + 900, h) * 0.85, Math.min(0.85, bare * 2.2));
  if (rock > 0.01) {
    const rn = fbm(X * 0.3, Y * 0.3, 3);
    const dark = ash > 0.3 ? 0.55 : 0;
    blend((mix(124, 70, dark) + 14 * rn) * tw('k', 0), (mix(114, 64, dark) + 12 * rn) * tw('k', 1), (mix(104, 60, dark) + 10 * rn) * tw('k', 2), rock);
    if (!dark) { plAdd('scree', rock); plAdd('rock', rock * sstep(0.55, 0.9, slope + 0.3 * rn)); }
  }
  const Tsnow = T + 8.5 + 8 * slope * (1 - 0.6 * R.mt) - 2.5 * R.mt * (1 - R.vly) - 3.5 * ASPN + 2 * ASPS;   // in ranges snow lies on the high ridges between the valleys
  let snow = sstep(-1, -4.5, Tsnow);
  snow = Math.max(snow, F[14] * 0.9 * sstep(0.2, 0.7, F[14] + 0.3 * fbm(X * 0.05, Y * 0.05, 3)));
  if (snow > 0.01) {
    const sn = fbmA(X, Y, 2, Math.max(pix, 0.002), 0.8, 14);
    snow = sat(snow + sn * 0.35 * snow);
    blend(238, 242, 247, snow);
    plAdd('neve', snow);
  }
  if (PL.n) photo(X, Y, pix);
  groundVariety(X, Y, pix, (1 - desert) * (1 - snow) * (1 - rock) * (1 - sat(ash * 2)) * (1 - marsh), veg, T);
  // beaches
  if (s < 0.025 && h < 8 && slope < 0.5) blend(204, 190, 152, sat(1 - s / 0.025) * 0.8);
  // lakes at coarse scale
  if (F[15] > 0.55 && pix > 0.3) blend(26, 58, 74, sstep(0.55, 0.75, F[15]));
  return tmp3;
}

/* Repaint the land from the real patches gathered in PL, layer over layer as the procedural colour was built, and
   lay the result over it (keeping a little of the procedural colour, which carries the analogue tints). */
const pc = [0, 0, 0];
let FIELDV = 0, FDN = 0, FARMP = 0;
/* After the real patches: the variety real imagery has at every scale, which the patches lose where they are too
   small to draw (from orbit and middle zoom) - regional tone (soils, moisture: tens of miles), a mosaic of wild
   ground (dry grass, bracken, heath, scrub: miles down to yards) and the texture of canopy. Never flat at any scale. */
function groundVariety(X, Y, pix, vegShare, veg, T) {
  const r1 = fbmA(X, Y, 140, Math.max(pix * 2, 14), 0.7, 71), r2 = fbmA(X, Y, 35, Math.max(pix * 2, 4), 0.6, 72);
  const k = 1 + 0.06 * r1 + 0.05 * r2;
  tmp3[0] *= k + 0.05 * r2; tmp3[1] *= k + 0.01 * r1; tmp3[2] *= k - 0.03 * r2;
  if (vegShare <= 0.02) return;
  const wild = vegShare * (1 - FARMP * 0.9) * (1 - FDN);
  if (wild > 0.02) {
    // patches of a few miles down to a few hundred yards, with irregular (warped) outlines
    // (turned off the noise lattice and warped, so no patch shows the grid it was drawn on)
    const qx = X * 0.83 - Y * 0.56, qy = X * 0.56 + Y * 0.83;
    const wx = qx + 2.6 * fbm(qx * 0.16 + 3, qy * 0.16, 2), wy = qy + 2.6 * fbm(qx * 0.16, qy * 0.16 - 7, 2);
    const a = fbmA(wx, wy, 5, Math.max(pix * 2, 0.04), 0.75, 73), b = fbmA(wy * 0.97 + 9, -wx * 0.97, 1.4, Math.max(pix * 2, 0.015), 0.8, 74);
    const temperate = sstep(-2, 4, T) * (1 - sstep(20, 26, T));
    blend(156, 142, 98, sstep(0.12, 0.42, a) * 0.32 * wild);                               // dry grass, sun-bleached
    blend(100, 104, 60, sstep(0.05, 0.3, b) * sstep(-0.3, 0.1, a) * 0.3 * wild * temperate);  // bracken and rough grazing
    blend(50, 66, 38, sstep(0.22, 0.45, -b) * sstep(-0.25, 0.15, -a) * 0.42 * wild * veg);   // scrub, gorse and thicket
    blend(110, 94, 76, sstep(0.25, 0.5, -a) * sstep(-0.1, 0.25, b) * 0.28 * wild);         // heath
  }
  if (FDN > 0.02) {
    // canopy: clusters of crowns lit and shaded, and gaps (seen from middle zoom, where single crowns are too small)
    // and stands of different age and kind: lighter broadleaf, darker conifer, in patches of a mile or two
    const c1 = fbmA(X, Y, 0.9, Math.max(pix * 1.5, 0.006), 0.85, 75), c2 = fbmA(X, Y, 6, Math.max(pix * 2, 0.1), 0.7, 76);
    const kk = 1 + FDN * (0.24 * c1 * sstep(0.003, 0.012, pix) + 0.16 * c2);
    tmp3[0] *= kk * (1 + 0.06 * c2 * FDN); tmp3[1] *= kk * (1 + 0.04 * c2 * FDN); tmp3[2] *= kk;
  }
}
function photo(X, Y, pix) {
  let i0 = 0;
  for (let i = PL.n - 1; i > 0; i--) if (PL.t[i] > 0.985) { i0 = i; break; }
  let c = PL.k[i0] < 0 ? PL.c.subarray(i0 * 3, i0 * 3 + 3) : txColor(PL.k[i0], X, Y, pix);
  pc[0] = c[0]; pc[1] = c[1]; pc[2] = c[2];
  for (let i = i0 + 1; i < PL.n; i++) {
    const t = PL.t[i];
    c = PL.k[i] < 0 ? PL.c.subarray(i * 3, i * 3 + 3) : txColor(PL.k[i], X, Y, pix, t < 0.3);   // a thin overlay needs no fine detail
    pc[0] += (c[0] - pc[0]) * t; pc[1] += (c[1] - pc[1]) * t; pc[2] += (c[2] - pc[2]) * t;
  }
  // where the hedged fields are drawn (close zoom), keep them and let the real patch only colour them
  blend(pc[0], pc[1], pc[2], 0.82 * (1 - 0.55 * FIELDV));
}

function hypsoColor(X, Y, h, slope, pix) {
  if (R.s <= 0) {
    const t = sstep(0, 4000, -h);
    setc(mix(174, 88, t), mix(208, 140, t), mix(226, 190, t));
    return tmp3;
  }
  const stops = [[0, 112, 160, 106], [150, 150, 188, 118], [400, 206, 214, 150], [800, 226, 206, 150], [1500, 196, 160, 116], [2500, 168, 128, 102], [3500, 206, 200, 196], [5000, 250, 250, 252]];
  let i = 0; while (i < stops.length - 2 && h > stops[i + 1][0]) i++;
  const a = stops[i], b = stops[i + 1];
  const t = sat((h - a[0]) / (b[0] - a[0]));
  setc(mix(a[1], b[1], t), mix(a[2], b[2], t), mix(a[3], b[3], t));
  if (F[4] > 0.2) blend(116, 150, 96, F[4] * 0.4);
  return tmp3;
}

function parchmentColor(X, Y, h, slope, pix, dsea) {
  const stain = fbm(X * 0.02 + 4, Y * 0.02, 4) * 0.5 + fbmA(X, Y, 0.6, Math.max(pix, 0.004), 0.6, 20) * 0.25;
  setc(236 + 10 * stain, 222 + 12 * stain, 188 + 14 * stain);
  if (R.s <= 0) {
    blend(214, 214, 196, 0.45);
    // ripple lines hugging the coast
    if (dsea !== undefined && dsea > 0) {
      const k = dsea / Math.max(pix, 0.2);
      const ln = [4, 9, 16];
      for (let i = 0; i < 3; i++) if (Math.abs(k - ln[i]) < 0.7) blend(96, 102, 102, 0.55 - i * 0.12);
    }
    return tmp3;
  }
  if (dsea !== undefined && dsea > -1.4 && dsea < 0.001) blend(66, 48, 34, 0.9);
  if (F[4] > 0.2) {
    blend(170, 184, 128, sat(F[4] - 0.1) * 0.55);
    if (pix < 3) {
      const gx = X / (pix * 6), gy = Y / (pix * 6);
      const ix = Math.floor(gx), iy = Math.floor(gy);
      const cx = ix + 0.5 + 0.3 * (hash2(ix, iy, 3) - 0.5), cy = iy + 0.5 + 0.3 * (hash2(ix, iy, 4) - 0.5);
      const d = Math.hypot(gx - cx, gy - cy);
      if (d < 0.22 && F[4] > 0.4) blend(84, 96, 58, 0.8);
    }
  }
  if (F[7] > 0.3) blend(170, 176, 150, 0.4);
  if (F[10] > 0.3) blend(160, 132, 112, F[10] * 0.5);
  const mt = sstep(500, 2500, h);
  blend(170, 136, 100, mt * 0.45);
  const cstep = h > 1200 ? 400 : 150;
  const cv = h / cstep;
  const frac = Math.abs(cv - Math.round(cv));
  if (frac < 0.06 * Math.max(1, 30 / Math.max(pix * 1609 / 30, 1))) blend(150, 110, 80, 0.25);
  return tmp3;
}

/* ---------------- tile rendering ---------------- */
function tileLL(z, x, y, px, py, n) {
  const zz = Math.pow(2, z);
  const lon = (x + px / n) / zz * 360 - 180;
  const my = Math.PI * (1 - 2 * (y + py / n) / zz);
  const lat = R2D * Math.atan(Math.sinh(my));
  return [lon, lat];
}

/* Elevation-only tile (terrarium). */
function demTile(z, x, y, n) {
  const out = new Uint8ClampedArray(n * n * 4);
  const [, latc] = tileLL(z, x, y, n / 2, n / 2, n);
  const pix0 = EARTH_C * Math.cos(latc * D2R) / (n * Math.pow(2, z)) / MI;
  const pix = z >= 8 ? Math.max(0.06, Math.min(pix0, 0.24)) : pix0;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const ll = tileLL(z, x, y, i + 0.5, j + 0.5, n);
      const xy = toXY(ll[0], ll[1]);
      let h = evaluate(xy[0], xy[1], pix);
      if (R.s <= 0) h = 0;
      if (F[15] > 0.5 && R.s > 0) h = Math.min(h, R.base * 0.7 - 4);
      const v = Math.max(0, h + 32768);
      const o = (j * n + i) * 4;
      const vi = Math.floor(v);
      out[o] = vi >> 8; out[o + 1] = vi & 255; out[o + 2] = Math.floor((v - vi) * 256); out[o + 3] = 255;
    }
  }
  return out;
}

/* Imagery for an arbitrary grid of points. coords(i,j) → [X,Y]. */
let ASPN = 0, ASPS = 0;                  // how far the surface being coloured faces north / south (snow lies longer on north faces)
function renderGrid(n, m, coordFn, pix, mode, shade, sun) {
  // a margin of B cells round the grid: the hillshade and the sky-view shading below read the ground a few cells off
  const B = shade ? 4 : 1, W = n + 2 * B, H = m + 2 * B;
  const E = new Float32Array(W * H), S = new Float32Array(W * H);
  const FS = new Float32Array(n * m * NCH), RS = new Float32Array(n * m * 8);
  const XS = new Float64Array(W * H), YS = new Float64Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i;
    const c = coordFn(i - B, j - B);
    XS[k] = c[0]; YS[k] = c[1];
    E[k] = evaluate(c[0], c[1], pix);
    S[k] = R.s;
    if (i >= B && j >= B && i < n + B && j < m + B) {
      const q = (j - B) * n + (i - B);
      FS.set(F, q * NCH);
      RS[q * 8] = R.s; RS[q * 8 + 1] = R.lat; RS[q * 8 + 2] = R.wm; RS[q * 8 + 3] = R.stream; RS[q * 8 + 4] = R.base; RS[q * 8 + 5] = R.mt; RS[q * 8 + 6] = R.vly; RS[q * 8 + 7] = R.lon;
    }
  }
  const out = new Uint8ClampedArray(n * m * 4);
  const cellM = pix * MI;
  const sx = sun ? sun[0] : -0.55, sy = sun ? sun[1] : 0.55, sz = sun ? sun[2] : 0.63;
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
    const k = (j + B) * W + (i + B);
    const q = j * n + i;
    const X = XS[k], Y = YS[k];
    for (let c = 0; c < NCH; c++) F[c] = FS[q * NCH + c];
    R.s = RS[q * 8]; R.lat = RS[q * 8 + 1]; R.wm = RS[q * 8 + 2]; R.stream = RS[q * 8 + 3]; R.base = RS[q * 8 + 4]; R.mt = RS[q * 8 + 5]; R.vly = RS[q * 8 + 6]; R.lon = RS[q * 8 + 7];
    const land = R.s > 0;
    const h = E[k];
    const hl = land ? E[k - 1] : 0, hr = land ? E[k + 1] : 0, hu = land ? E[k - W] : 0, hd = land ? E[k + W] : 0;
    const dx = land ? (Math.max(hr, 0) - Math.max(hl, 0)) / (2 * cellM) : 0, dy = land ? (Math.max(hu, 0) - Math.max(hd, 0)) / (2 * cellM) : 0;
    const gm = Math.sqrt(dx * dx + dy * dy);
    const slope = sat(gm / 1.2);
    ASPN = land && gm > 1e-6 ? sat(-dy / gm) * sstep(0.04, 0.3, slope) : 0; ASPS = land && gm > 1e-6 ? sat(dy / gm) * sstep(0.04, 0.3, slope) : 0;
    let dsea;
    if (mode === 1) {
      const gsx = (S[k + 1] - S[k - 1]) / 2, gsy = (S[k - W] - S[k + W]) / 2;
      const gs = Math.sqrt(gsx * gsx + gsy * gsy) + 1e-6;
      dsea = -S[k] / gs * pix;
    }
    const c = colorAt(X, Y, h, slope, pix, mode, dsea);
    let r = c[0], g = c[1], b = c[2];
    if (shade && land) {
      const mt = mode === 1 ? 0 : R.mt;
      const ex = (mode === 1 ? 2.2 : 1.5) * (pix > 0.3 ? Math.min(6, 1 + pix * 0.5) : 1) * (1 + 1.3 * mt);
      const nx = -dx * ex, ny = -dy * ex;
      const nl = Math.sqrt(nx * nx + ny * ny + 1);
      const lam = (nx * sx + ny * sy + sz) / nl;
      let f = mode === 1 ? 0.55 + 0.6 * lam : 0.4 + 0.8 * lam;
      if (mt > 0) f = mix(f, 0.27 + 1.0 * lam, mt);       // mountains: deep shadow faces, bright sunlit ones
      f = clamp(f, 0.28 - 0.14 * mt, 1.25 + 0.1 * mt);
      if (mode === 0 && B > 1) {
        // sky-view: hollows and valley floors see less of the sky and lie darker, ridges and crests catch more light
        const ring = (r) => (Math.max(E[k - r], 0) + Math.max(E[k + r], 0) + Math.max(E[k - r * W], 0) + Math.max(E[k + r * W], 0)) * 0.25 - h;
        const ao = (0.6 * ring(2) / (2 * cellM) + 0.4 * ring(4) / (4 * cellM)) * ex / 1.5;
        f *= (1 - 0.32 * sat(ao * 1.4)) * (1 + 0.12 * sat(-ao * 1.4));
      }
      r *= f; g *= f; b *= f;
    }
    if (mode === 0) { r = r * 0.96 + 4; g = g * 0.97 + 5; b = b * 0.98 + 9; }
    const nt = nightAt(R.lon, R.lat);
    if (nt > 0) { const k = 1 - nt; r *= k; g *= k; b *= k; }
    const o = q * 4;
    out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
  }
  return { rgba: out, E, W, H };
}

/* The far side of the world is left dark, like the night side of the Earth from space: nothing is known of it.
   Day is centred between Middle-earth, the Dark Land and the Land of the Sun; dusk falls from 92° to 104° away. */
const DAY_LON = 55 * D2R, DAY_LAT = 15 * D2R, DUSK0 = Math.cos(92 * D2R), DUSK1 = Math.cos(104 * D2R);
function nightAt(lon, lat) {
  const la = lat * D2R, c = Math.sin(la) * Math.sin(DAY_LAT) + Math.cos(la) * Math.cos(DAY_LAT) * Math.cos(lon * D2R - DAY_LON);
  return c >= DUSK0 ? 0 : c <= DUSK1 ? 1 : sstep(DUSK0, DUSK1, c);
}
let GOLDS = 1;                             // Lórien in its gold (1, autumn to spring) or green (0, summer)
function imageryTile(z, x, y, n, mode, gold) {
  GOLDS = gold == null ? 1 : gold;
  // a tile wholly on the night side is black: no need to build its ground
  if (z >= 3) {
    let all = true;
    for (let j = 0; j <= 4 && all; j++) for (let i = 0; i <= 4 && all; i++) { const ll = tileLL(z, x, y, i * n / 4, j * n / 4, n); if (nightAt(ll[0], ll[1]) < 1) all = false; }
    if (all) { const out = new Uint8ClampedArray(n * n * 4); for (let k = 3; k < out.length; k += 4) out[k] = 255; return { rgba: out, E: null, W: n + 2, H: n + 2 }; }
  }
  const [, latc] = tileLL(z, x, y, n / 2, n / 2, n);
  const pix = EARTH_C * Math.cos(latc * D2R) / (n * Math.pow(2, z)) / MI;
  return renderGrid(n, n, (i, j) => { const ll = tileLL(z, x, y, i + 0.5, j + 0.5, n); return toXY(ll[0], ll[1]); }, pix, mode, true);
}

/* ---------------- vectors (rivers, lakes, roads, settlements) ---------------- */
let RIV = [], ROADS = [], LAKES = [], SETTLE = [], WALLS = [], BUCKET = new Map();
const BK = 40;
function densify(pts, rough, seed, minLen, calm) {
  let out = pts.map(p => [p[0], p[1]]);
  for (let pass = 0; pass < 12; pass++) {
    const nxt = [out[0]];
    let changed = false;
    for (let i = 1; i < out.length; i++) {
      const a = out[i - 1], b = out[i];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const L = Math.hypot(dx, dy);
      if (L > minLen) {
        const r = (hash2(Math.round(a[0] * 97 + b[0] * 13), Math.round(a[1] * 89 + b[1] * 7), seed) - 0.5) * 2;
        const off = r * L * rough * (calm ? sstep(1, 4, Math.hypot(a[0] - calm[0], a[1] - calm[1])) : 1);
        nxt.push([(a[0] + b[0]) / 2 - dy / L * off, (a[1] + b[1]) / 2 + dx / L * off]);
        changed = true;
      }
      nxt.push(b);
    }
    out = nxt;
    if (!changed) break;
  }
  // Chaikin smoothing
  for (let k = 0; k < 2; k++) {
    const sm = [out[0]];
    for (let i = 0; i < out.length - 1; i++) {
      const a = out[i], b = out[i + 1];
      sm.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    sm.push(out[out.length - 1]);
    out = sm;
  }
  return out;
}
function addBucket(kind, idx, pts) {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const p of pts) { if (p[0] < minx) minx = p[0]; if (p[0] > maxx) maxx = p[0]; if (p[1] < miny) miny = p[1]; if (p[1] > maxy) maxy = p[1]; }
  for (let bx = Math.floor(minx / BK); bx <= Math.floor(maxx / BK); bx++)
    for (let by = Math.floor(miny / BK); by <= Math.floor(maxy / BK); by++) {
      const key = bx + ',' + by;
      if (!BUCKET.has(key)) BUCKET.set(key, []);
      BUCKET.get(key).push([kind, idx]);
    }
}
// The line a river is drawn along (and its valley carved along): the authored course cut into spans of at most
// 1.5 mi before its meanders are added, so it never strays more than about half a mile from that course, and drawn
// straighter over its last 4 miles so it meets the sea, a lake or its river where it was put.
function riverLine(pts, seed) {
  const sub = [pts[0]];
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.5));
    for (let k = 1; k <= n; k++) sub.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
  return densify(sub, 0.2, seed, 0.12, sub[sub.length - 1]);
}
function initVectors(v) {
  BUCKET = new Map();
  RIV = v.rivers.map((r, i) => {
    const pts = riverLine(r.pts, i + 1);
    // split into chunks for bucketing, carry width along
    const L = [0]; for (let k = 1; k < pts.length; k++) L.push(L[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    const tot = L[L.length - 1] || 1;
    const chunks = [];
    for (let s = 0; s < pts.length - 1; s += 60) {
      const e = Math.min(pts.length, s + 61);
      chunks.push({ pts: pts.slice(s, e), w0: mix(r.w0, r.w1, Math.pow(L[s] / tot, 0.8)), w1: mix(r.w0, r.w1, Math.pow(L[e - 1] / tot, 0.8)) });
    }
    return { name: r.name, rank: r.rank, chunks, pts };
  });
  RIV.forEach((r, i) => r.chunks.forEach((c, j) => addBucket('r', [i, j], c.pts)));
  ROADS = v.roads.map((r, i) => {
    const pts = densify(r.pts, 0.08, 100 + i, 0.05);
    const chunks = [];
    for (let s = 0; s < pts.length - 1; s += 60) chunks.push(pts.slice(s, Math.min(pts.length, s + 61)));
    return { name: r.name, cls: r.cls, chunks };
  });
  ROADS.forEach((r, i) => r.chunks.forEach((c, j) => addBucket('d', [i, j], c)));
  LAKES = v.lakes.map((l, i) => { const pts = densify(l.pts.concat([l.pts[0]]), 0.12, 300 + i, 0.08); addBucket('l', i, pts); return { pts }; });
  WALLS = v.walls || [];
  WALLS.forEach((w, i) => { const pts = w.pts || circlePts(w.circle, 72); w.pts2 = pts; addBucket('w', i, pts); });
  SETTLE = v.settlements || [];
  SETTLE.forEach((s, i) => addBucket('s', i, [[s.x - s.r * 1.3, s.y - s.r * 1.3], [s.x + s.r * 1.3, s.y + s.r * 1.3]]));
}
/* ---------------- river valleys ----------------
   Each river is carved along the very line it is drawn on. Its floor is measured at stations every half mile from
   source to mouth: the lowest ground across a 3.6-mile section of the valley, never higher than the floor upstream
   (water does not climb). Within a channel of a quarter mile or so the ground is cut down to that floor; beyond it the
   valley sides rise back to the land over the valley's half-width. */
const RSTEP = 0.5, RC = 2, VHALF = [0, 3.5, 2.6, 2.0, 1.6, 1.3];
let RST = null, RCGRID = null, NOCARVE = false;
function riverStations(pts) {
  const out = [pts[0].slice()]; let carry = 0;
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); let t = RSTEP - carry;
    while (t <= L) { out.push([a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L]); t += RSTEP; } carry = L - (t - RSTEP); }
  const e = pts[pts.length - 1], l = out[out.length - 1]; if (Math.hypot(e[0] - l[0], e[1] - l[1]) > 0.05) out.push(e.slice());
  return out;
}
function measureRiverFloors() {
  NOCARVE = true;
  const ST = RIV.map(r => riverStations(r.pts));
  // the lowest ground across each station's section of the valley
  const LO = ST.map(S => {
    const lo = new Float32Array(S.length);
    for (let k = 0; k < S.length; k++) {
      const a = S[Math.max(0, k - 1)], b = S[Math.min(S.length - 1, k + 1)], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      let m = Infinity;
      for (const o of [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2.1, -2.1]) { const h = evaluate(S[k][0] + nx * o, S[k][1] + ny * o, 0.25); m = Math.min(m, R.s > 0 ? h : 0); }
      lo[k] = m;
    }
    return lo;
  });
  NOCARVE = false;
  // where one river runs into another (a tributary's mouth, or a river that carries on under a new name), the
  // receiving river may stand no higher there than the river it receives: each river's floor is the running minimum of
  // its own sections and of the floors of the rivers that end beside it. A few rounds carry this down every chain.
  const ends = ST.map(S => S[S.length - 1]);
  const feeds = ST.map((S, ri) => { const m = new Map();
    ends.forEach((e, qi) => { if (qi === ri) return; let bk = -1, bd = 1.0;
      for (let k = 0; k < S.length; k++) { const d = Math.hypot(S[k][0] - e[0], S[k][1] - e[1]); if (d < bd) { bd = d; bk = k; } }
      if (bk >= 0) m.set(qi, bk); });
    return m; });
  // and the river a river runs into (its station beside this river's mouth), for grading back from the mouth
  const recv = ST.map((S, ri) => { const e = ends[ri]; let best = null, bd = 1.0;
    ST.forEach((Q, qi) => { if (qi === ri) return; for (let k = 0; k < Q.length; k++) { const d = Math.hypot(Q[k][0] - e[0], Q[k][1] - e[1]); if (d < bd) { bd = d; best = [qi, k]; } } });
    return best; });
  // a river falls gently to its mouth: from the sea, a lake or the river it joins, its floor may rise upstream by no
  // more than a few metres a mile (less for the great rivers), so it reaches the coast in a valley, not over a cliff
  const slope = ri => [2, 1.2, 1.6, 2.5, 3.5, 4.5][RIV[ri].rank] || 4.5;
  // a branch leaving another river (the mouths of the Ethir Anduin) starts no higher than that river where it leaves
  const from = ST.map((S, ri) => { const e = S[0]; let best = null, bd = 1.0;
    ST.forEach((Q, qi) => { if (qi === ri) return; for (let k = 0; k < Q.length - 1; k++) { const d = Math.hypot(Q[k][0] - e[0], Q[k][1] - e[1]); if (d < bd) { bd = d; best = [qi, k]; } } });
    return best; });
  // and wherever two rivers' channels run together (within 0.8 mi), the water there stands at the lower floor
  const near = ST.map(() => []), SG = new Map();
  ST.forEach((S, ri) => S.forEach((p, k) => { const key = Math.floor(p[0]) * 65536 + Math.floor(p[1]); let l = SG.get(key); if (!l) SG.set(key, l = []); l.push(ri, k); }));
  ST.forEach((S, ri) => S.forEach((p, k) => { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const l = SG.get((Math.floor(p[0]) + dx) * 65536 + Math.floor(p[1]) + dy); if (!l) continue;
    for (let j = 0; j < l.length; j += 2) if (l[j] !== ri && Math.hypot(ST[l[j]][l[j + 1]][0] - p[0], ST[l[j]][l[j + 1]][1] - p[1]) < 0.8) near[ri].push(k, l[j], l[j + 1]); } }));
  let F = LO.map(lo => Float32Array.from(lo));
  for (let round = 0; round < 8; round++) {
    F = ST.map((S, ri) => {
      const cap = new Float32Array(S.length).fill(Infinity);
      for (const [qi, k] of feeds[ri]) { const fq = F[qi]; cap[k] = Math.min(cap[k], fq[fq.length - 1]); }
      if (from[ri]) cap[0] = Math.min(cap[0], F[from[ri][0]][from[ri][1]]);
      const nr = near[ri]; for (let j = 0; j < nr.length; j += 3) cap[nr[j]] = Math.min(cap[nr[j]], F[nr[j + 1]][nr[j + 2]]);
      const f = new Float32Array(S.length); let run = Infinity;
      for (let k = 0; k < S.length; k++) { run = Math.min(run, LO[ri][k], cap[k]); f[k] = run; }
      let g = recv[ri] ? Math.min(f[S.length - 1], F[recv[ri][0]][recv[ri][1]]) : f[S.length - 1];
      for (let k = S.length - 1; k >= 0; k--) { if (k < S.length - 1) g += slope(ri) * RSTEP; f[k] = Math.min(f[k], g); g = f[k]; }
      return f;
    });
  }
  return F;
}
// The carve follows the drawn line itself, resampled every 0.15 mi (within a few yards of it), so the channel need be
// no wider than the river; the floor between stations is read off by distance along the line.
const RDENSE = 0.15;
function initRiverCarve(floors) {
  RST = RIV.map((r, i) => {
    const S = riverStations(r.pts), D = [r.pts[0].slice()]; let carry = 0;
    for (let k = 1; k < r.pts.length; k++) { const a = r.pts[k - 1], b = r.pts[k], L = Math.hypot(b[0] - a[0], b[1] - a[1]); let t = RDENSE - carry;
      while (t <= L) { D.push([a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L]); t += RDENSE; } carry = L - (t - RDENSE); }
    D.push(r.pts[r.pts.length - 1].slice());
    const fl = floors[i], f = new Float32Array(D.length);
    for (let j = 0; j < D.length; j++) { const u = Math.min(fl.length - 1, j * RDENSE / RSTEP), k = Math.floor(u), w = u - k; f[j] = k + 1 < fl.length ? fl[k] * (1 - w) + fl[k + 1] * w : fl[k]; }
    f[D.length - 1] = fl[fl.length - 1];
    return { S: D, f, V: VHALF[r.rank] || 1.3, cw: r.rank <= 1 ? 0.2 : 0.12 };
  });
  RCGRID = new Map();
  RST.forEach((q, ri) => { for (let k = 1; k < q.S.length; k++) { const a = q.S[k - 1], b = q.S[k];
    const x0 = Math.floor((Math.min(a[0], b[0]) - q.V) / RC), x1 = Math.floor((Math.max(a[0], b[0]) + q.V) / RC);
    const y0 = Math.floor((Math.min(a[1], b[1]) - q.V) / RC), y1 = Math.floor((Math.max(a[1], b[1]) + q.V) / RC);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const key = x * 65536 + y; let l = RCGRID.get(key); if (!l) RCGRID.set(key, l = []); l.push(ri, k); } } });
}
// In the channel the ground is set to the floor (a hollow below it fills, as water would); on the valley sides it is
// only ever lowered. Where valleys meet, the lowest wins.
function riverCarve(X, Y, h) {
  const l = RCGRID.get(Math.floor(X / RC) * 65536 + Math.floor(Y / RC)); if (!l) return h;
  let side = Infinity, chan = Infinity;
  for (let j = 0; j < l.length; j += 2) {
    const q = RST[l[j]], k = l[j + 1], a = q.S[k - 1], b = q.S[k], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((X - a[0]) * dx + (Y - a[1]) * dy) / L)) : 0, ex = a[0] + t * dx - X, ey = a[1] + t * dy - Y;
    const d = Math.sqrt(ex * ex + ey * ey); if (d >= q.V) continue;
    const f = q.f[k - 1] + (q.f[k] - q.f[k - 1]) * t;
    if (d <= q.cw) { if (f < chan) chan = f; continue; }
    if (h <= f) continue;
    // a broad, flat-bottomed vale in the lowland; deep through the mountains, a narrower V with broken sides
    const deep = sstep(80, 600, h - f), u = Math.min(1, (d - q.cw) / (q.V - q.cw) * (1 + 0.3 * deep * noise(X * 1.7 + 3, Y * 1.7 - 5)));
    const v = f + (h - f) * Math.pow(Math.max(0, u), 1.6 - 0.9 * deep);
    if (v < side) side = v;
  }
  return chan < Infinity ? Math.min(chan, side) : Math.min(h, side);
}
function circlePts(c, n) { const out = []; for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2; out.push([c[0] + Math.cos(a) * c[2], c[1] + Math.sin(a) * c[2]]); } return out; }

function query(minx, miny, maxx, maxy) {
  const seen = new Set(), res = [];
  for (let bx = Math.floor(minx / BK); bx <= Math.floor(maxx / BK); bx++)
    for (let by = Math.floor(miny / BK); by <= Math.floor(maxy / BK); by++) {
      const b = BUCKET.get(bx + ',' + by);
      if (!b) continue;
      for (const e of b) { const k = e[0] + e[1]; if (!seen.has(k)) { seen.add(k); res.push(e); } }
    }
  return res;
}

/* Deterministic buildings of a settlement (cached). */
const BCACHE = new Map();
const STYLE = {
  hobbit: { roof: [[116, 128, 70], [132, 112, 78], [150, 96, 70]], w: [7, 10], d: [6, 8], dens: 140, grid: 0, h: 4 },
  bree: { roof: [[150, 122, 74], [96, 94, 98], [134, 104, 70]], w: [9, 14], d: [7, 9], dens: 380, grid: 0, h: 7 },
  rohan: { roof: [[176, 146, 76], [160, 128, 68], [128, 100, 62]], w: [16, 26], d: [7, 10], dens: 320, grid: 0, h: 8 },
  gondor: { roof: [[196, 190, 180], [112, 118, 128], [176, 168, 158], [150, 146, 140]], w: [10, 18], d: [9, 14], dens: 1400, grid: 1, h: 11 },
  minastirith: { roof: [[222, 220, 214], [200, 198, 192], [180, 184, 190]], w: [9, 16], d: [8, 12], dens: 2600, grid: 2, h: 12 },
  osgiliath: { roof: [[140, 138, 132], [118, 116, 110], [160, 156, 148]], w: [10, 22], d: [8, 16], dens: 500, grid: 1, h: 6, ruin: 1 },
  elf: { roof: [[158, 170, 178], [182, 184, 176], [140, 150, 160]], w: [10, 16], d: [8, 12], dens: 90, grid: 0, h: 9 },
  lorien: { roof: [[200, 200, 190]], w: [4, 6], d: [4, 6], dens: 30, grid: 0, h: 20 },
  lake: { roof: [[112, 84, 62], [96, 80, 70], [130, 100, 72]], w: [8, 12], d: [6, 9], dens: 1600, grid: 0, h: 7 },
  dale: { roof: [[146, 84, 62], [124, 92, 76], [160, 104, 80]], w: [9, 15], d: [8, 11], dens: 900, grid: 1, h: 9 },
  harad: { roof: [[206, 186, 146], [196, 172, 132], [220, 200, 160]], w: [9, 16], d: [9, 16], dens: 2200, grid: 1, h: 7 },
  isengard: { roof: [[40, 40, 44]], w: [6, 10], d: [6, 10], dens: 60, grid: 0, h: 4 },
  mordor: { roof: [[38, 36, 38], [52, 48, 48]], w: [10, 30], d: [10, 24], dens: 300, grid: 0, h: 12 },
  morgul: { roof: [[150, 168, 158], [120, 134, 128]], w: [8, 14], d: [8, 12], dens: 700, grid: 0, h: 10 },
  east: { roof: [[180, 150, 110], [160, 120, 90], [190, 170, 130]], w: [6, 9], d: [6, 9], dens: 500, grid: 0, h: 3, round: 1 },
  beorning: { roof: [[150, 118, 70]], w: [26, 34], d: [9, 12], dens: 20, grid: 0, h: 9 },
  dwarf: { roof: [[112, 110, 106], [96, 94, 92], [128, 120, 110]], w: [8, 14], d: [8, 12], dens: 900, grid: 1, h: 7 },
  dunland: { roof: [[120, 100, 70], [102, 88, 62], [92, 80, 58]], w: [7, 11], d: [5, 7], dens: 160, grid: 0, h: 5 },
  woodmen: { roof: [[110, 90, 60], [96, 80, 56]], w: [8, 13], d: [6, 8], dens: 200, grid: 0, h: 6 },
  ruin: { roof: [[150, 146, 138], [130, 126, 120]], w: [8, 18], d: [8, 14], dens: 260, grid: 1, h: 5, ruin: 1 },
};
function buildings(si) {
  if (BCACHE.has(si)) return BCACHE.get(si);
  const s = SETTLE[si];
  const st = STYLE[s.culture] || STYLE.bree;
  const out = [];
  const rM = s.r * MI;
  const n = s.feature ? 0 : Math.round(st.dens * s.r * s.r * Math.PI);
  const orient = hash2(si, 1, 5) * Math.PI;
  let tries = 0;
  while (out.length < n && tries < n * 4) {
    tries++;
    const a = hash2(si, tries, 31) * Math.PI * 2;
    const rr = Math.pow(hash2(si, tries, 33), s.culture === 'minastirith' ? 0.8 : 0.6) * rM;
    let ex = Math.cos(a) * rr, ny = Math.sin(a) * rr;
    if (s.culture === 'minastirith' && ex < -30) continue;           // city faces east; the mountain is behind
    const keep = 1 - Math.pow(rr / rM, 2) * 0.6;
    if (hash2(si, tries, 35) > keep) continue;
    let ang = st.grid ? orient + Math.round(hash2(si, tries, 37) * 2) * Math.PI / 2 : hash2(si, tries, 39) * Math.PI;
    if (s.culture === 'minastirith') ang = Math.atan2(ny, ex) + Math.PI / 2;
    if (s.name !== 'Esgaroth') { evaluate(s.x + ex / MI, s.y + ny / MI, 0.01); if (R.s <= 0.004 || F[15] > 0.5) continue; }   // no houses in the sea or a lake (Lake-town stands on the water)
    const w = mix(st.w[0], st.w[1], hash2(si, tries, 41)), d = mix(st.d[0], st.d[1], hash2(si, tries, 43));
    const col = st.roof[Math.floor(hash2(si, tries, 45) * st.roof.length)];
    out.push({ x: s.x + ex / MI, y: s.y + ny / MI, w, d, a: ang, c: col, h: st.h * (0.8 + 0.5 * hash2(si, tries, 47)), round: st.round || (s.culture === 'hobbit' && hash2(si, tries, 49) < 0.7) ? 1 : 0, ruin: st.ruin || 0 });
  }
  // special structures
  const sp = [];
  if (s.culture === 'minastirith') {
    for (let k = 0; k < 7; k++) sp.push({ type: 'arc', x: s.x, y: s.y, r: (60 + k * 95) / MI, a0: -Math.PI * 0.62, a1: Math.PI * 0.62, w: 5 + (7 - k) * 1.2, h: 14 + k * 2, c: [236, 236, 230] });
    sp.push({ type: 'tower', kind: 'ecthelion', x: s.x - 0.01, y: s.y, r: 9, h: 90, c: [246, 246, 244] });
    sp.push({ type: 'prow', x: s.x, y: s.y, len: 620, c: [230, 230, 224] });
  }
  if (s.culture === 'isengard') {
    sp.push({ type: 'arc', x: s.x, y: s.y, r: 0.5, a0: -Math.PI, a1: Math.PI, w: 30, h: 30, c: [52, 52, 56] });
    sp.push({ type: 'tower', kind: 'orthanc', x: s.x, y: s.y, r: 22, h: 150, c: [26, 26, 30], square: 1 });
  }
  if (s.culture === 'rohan') {
    sp.push({ type: 'arc', x: s.x, y: s.y, r: s.r * 0.9, a0: -Math.PI, a1: Math.PI, w: 3, h: 5, c: [120, 96, 64] });
    if (s.name === 'Edoras') out.push({ x: s.x + 0.001, y: s.y + 0.002, w: 48, d: 18, a: 0.2, c: [214, 176, 64], h: 16, round: 0 });
  }
  if (s.culture === 'mordor' && s.name === 'Barad-dûr') sp.push({ type: 'tower', kind: 'baraddur', x: s.x, y: s.y, r: 60, h: 420, c: [18, 16, 18], square: 1 });
  if (s.culture === 'morgul') sp.push({ type: 'tower', kind: 'morgul', x: s.x, y: s.y, r: 14, h: 110, c: [170, 196, 184] });
  if (s.havens) sp.push({ type: 'havens', x: s.x, y: s.y, c: [226, 223, 214] });
  if (s.feature) sp.push({ type: 'feature', kind: s.feature, x: s.x, y: s.y, face: s.gate || 0, c: [120, 116, 110] });
  else if (s.gate) sp.push({ type: 'gate', x: s.x, y: s.y, face: s.gate, c: [120, 116, 110] });
  if (s.culture === 'lorien') sp.push({ type: 'mallorn', x: s.x, y: s.y, r: 18, h: 75, c: [190, 190, 180] });
  const res = { list: out, special: sp };
  BCACHE.set(si, res);
  return res;
}

/* Draw vectors to a 2D context. proj(X,Y) → [px,py]; pix = miles per pixel. */
function drawVectors(ctx, proj, bbox, pix, mode) {
  const items = query(bbox[0] - 2, bbox[1] - 2, bbox[2] + 2, bbox[3] + 2);
  const pm = pix * MI;                     // metres per pixel
  const water = mode === 1 ? 'rgb(150,170,176)' : 'rgb(30,62,76)';
  const bank = mode === 1 ? 'rgba(90,110,120,0.9)' : 'rgba(70,90,70,0.5)';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // lakes
  for (const e of items) if (e[0] === 'l') {
    const pts = LAKES[e[1]].pts;
    ctx.beginPath();
    pts.forEach((p, i) => { const q = proj(p[0], p[1]); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
    ctx.closePath();
    if (pm < 400) { ctx.strokeStyle = bank; ctx.lineWidth = Math.max(1, 25 / pm); ctx.stroke(); }
    ctx.fillStyle = water; ctx.fill();
  }
  // rivers
  for (const e of items) if (e[0] === 'r') {
    const ch = RIV[e[1][0]].chunks[e[1][1]];
    const wpx = (ch.w0 + ch.w1) / 2 / pm;
    if (wpx < 0.12 && mode !== 1) continue;
    const pts = ch.pts;
    const n = pts.length;
    ctx.globalAlpha = mode === 1 ? 0.9 : sat(wpx * 2.5 + 0.15);
    const segs = Math.max(1, Math.round(n / 12));
    for (let s = 0; s < segs; s++) {
      const a = Math.floor(s * (n - 1) / segs), b = Math.floor((s + 1) * (n - 1) / segs);
      const w = mix(ch.w0, ch.w1, (a + b) / 2 / (n - 1)) / pm;
      ctx.beginPath();
      for (let i = a; i <= b; i++) { const q = proj(pts[i][0], pts[i][1]); i === a ? ctx.moveTo(q[0], q[1]) : ctx.lineTo(q[0], q[1]); }
      if (w > 3 && mode !== 1) { ctx.strokeStyle = bank; ctx.lineWidth = w + Math.max(2, 14 / pm); ctx.stroke(); }
      ctx.strokeStyle = mode === 1 ? 'rgb(96,120,130)' : water;
      ctx.lineWidth = mode === 1 ? Math.max(0.8, Math.min(w, 3)) : Math.max(w, 0.7);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (mode === 1) return;
  // roads
  if (pm < 90) {
    for (const e of items) if (e[0] === 'd') {
      const r = ROADS[e[1][0]];
      const pts = r.chunks[e[1][1]];
      const wm = r.cls === 1 ? 9 : r.cls === 2 ? 6 : 3.5;
      const w = wm / pm;
      if (w < 0.15) continue;
      ctx.globalAlpha = sat(w * 2 + 0.2);
      ctx.beginPath();
      pts.forEach((p, i) => { const q = proj(p[0], p[1]); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
      ctx.strokeStyle = 'rgba(96,84,60,0.5)'; ctx.lineWidth = Math.max(w * 1.5, 0.6); ctx.stroke();
      ctx.strokeStyle = r.cls === 1 ? 'rgb(176,162,128)' : 'rgb(164,146,108)'; ctx.lineWidth = Math.max(w, 0.5); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  // walls
  if (pm < 120) for (const e of items) if (e[0] === 'w') {
    const w = WALLS[e[1]];
    ctx.beginPath();
    w.pts2.forEach((p, i) => { const q = proj(p[0], p[1]); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
    ctx.strokeStyle = w.name.includes('Isengard') ? 'rgb(40,40,44)' : 'rgb(150,146,138)';
    ctx.lineWidth = Math.max((w.name.includes('Isengard') ? 30 : 8) / pm, 0.6); ctx.stroke();
  }
  // settlements
  if (pm < 26) for (const e of items) if (e[0] === 's') {
    const B = buildings(e[1]);
    const shadowOff = Math.min(6, 4 / pm);
    for (const b of B.list) {
      const q = proj(b.x, b.y);
      const w = b.w / pm, d = b.d / pm;
      if (q[0] < -20 || q[1] < -20 || q[0] > 1e4 || q[1] > 1e4) continue;
      ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(-b.a);
      if (b.round) {
        ctx.fillStyle = 'rgba(30,40,20,0.35)'; ctx.beginPath(); ctx.arc(shadowOff * 0.6, shadowOff * 0.6, Math.max(w / 2, 0.6), 0, 7); ctx.fill();
        ctx.fillStyle = `rgb(${b.c[0]},${b.c[1]},${b.c[2]})`; ctx.beginPath(); ctx.arc(0, 0, Math.max(w / 2, 0.6), 0, 7); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(20,20,20,0.35)'; ctx.fillRect(-w / 2 + shadowOff, -d / 2 + shadowOff, w, d);
        ctx.fillStyle = `rgb(${b.c[0]},${b.c[1]},${b.c[2]})`;
        if (b.ruin) { ctx.globalAlpha = 0.7; ctx.fillRect(-w / 2, -d / 2, w * 0.6, d); ctx.globalAlpha = 1; }
        else ctx.fillRect(-w / 2, -d / 2, Math.max(w, 0.8), Math.max(d, 0.8));
        if (w > 3) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-w / 2, 0, w, d / 2); }
      }
      ctx.restore();
    }
    for (const sp of B.special) {
      const q = proj(sp.x, sp.y);
      if (sp.type === 'arc') {
        ctx.beginPath();
        const rpx = sp.r * MI / pm;
        ctx.arc(q[0], q[1], rpx, -sp.a1, -sp.a0);
        ctx.strokeStyle = `rgb(${sp.c[0]},${sp.c[1]},${sp.c[2]})`; ctx.lineWidth = Math.max(sp.w / pm, 0.7); ctx.stroke();
      } else if (sp.type === 'tower') {
        const rp = sp.r / pm;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] + sp.h / pm * 0.6, q[1] + sp.h / pm * 0.6); ctx.lineWidth = rp * 2; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.stroke();
        ctx.fillStyle = `rgb(${sp.c[0]},${sp.c[1]},${sp.c[2]})`;
        if (sp.square) ctx.fillRect(q[0] - rp, q[1] - rp, rp * 2, rp * 2);
        else { ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(rp, 0.8), 0, 7); ctx.fill(); }
      }
    }
  }
}

/* Buildings near a point for the ground explorer. */
function buildingsNear(X, Y, rad) {
  const items = query(X - rad, Y - rad, X + rad, Y + rad);
  const out = [], sp = [];
  for (const e of items) if (e[0] === 's') {
    const s = SETTLE[e[1]];
    const B = buildings(e[1]);
    for (const b of B.list) if (Math.abs(b.x - X) < rad && Math.abs(b.y - Y) < rad) out.push(Object.assign({ culture: s.culture }, b));
    for (const p of B.special) sp.push(Object.assign({ culture: s.culture }, p));
  }
  return { list: out, special: sp };
}

return { setDoom, nightAt, D2R, MI, EARTH_C, toLL, toXY, noise, fbm, fbmA, hash2, sat, sstep, mix, clamp, init, evaluate, F, R, CH, tempAt, moistAt,
  demTile, imageryTile, renderGrid, tileLL, drawVectors, buildingsNear, numenorField, orchardAt, valleyAt,
  drawnRivers: () => RIV.map(r => ({ name: r.name, pts: r.chunks.flatMap((c, k) => k ? c.pts.slice(1) : c.pts) })) };
})();
if (typeof self !== 'undefined') self.GEN = GEN;
