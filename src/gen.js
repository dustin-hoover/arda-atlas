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

function noise(x, y) {
  let X = Math.floor(x), Y = Math.floor(y);
  x -= X; y -= Y; X &= 255; Y &= 255;
  const u = x * x * x * (x * (x * 6 - 15) + 10), v = y * y * y * (y * (y * 6 - 15) + 10);
  const a = P[X] + Y, b = P[X + 1] + Y;
  const g00 = grad(P[a], x, y), g10 = grad(P[b], x - 1, y), g01 = grad(P[a + 1], x, y - 1), g11 = grad(P[b + 1], x - 1, y - 1);
  const l0 = g00 + u * (g10 - g00), l1 = g01 + u * (g11 - g01);
  return (l0 + v * (l1 - l0)) * 1.25;
}
function grad(h, x, y) {
  switch (h & 7) {
    case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y;
    case 4: return x * 1.41; case 5: return -x * 1.41; case 6: return y * 1.41; default: return -y * 1.41;
  }
}
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
  M = data.main; G = data.glob; PEAKS = data.peaks || []; NUM = data.numenor; FLATS = data.flats || [];
  if (data.vectors) initVectors(data.vectors);
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
const R = { h: 0, s: 0, wx: 0, wy: 0, wm: 0, lat: 0, lon: 0, base: 0, mtn: 0, stream: 0 };

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
    if (dx > p.r || dx < -p.r || dy > p.r || dy < -p.r) continue;
    const d = Math.sqrt(dx * dx + dy * dy) / p.r;
    if (d >= 1) continue;
    let prof;
    if (p.kind === 'volcano') {
      prof = Math.pow(1 - d, 1.35);
      if (d < 0.09) prof -= (0.09 - d) * 2.2;
      prof *= 1 + 0.08 * noise(X * 3, Y * 3);
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
  // domain warp for organic outlines
  const w1x = fbm(X * 0.0062 + 11.3, Y * 0.0062 + 7.1, 3) * 15, w1y = fbm(X * 0.0062 - 5.2, Y * 0.0062 + 19.7, 3) * 15;
  const w2x = noise(X * 0.035 + 3.3, Y * 0.035 - 1.1) * 3.2, w2y = noise(X * 0.035 - 8.4, Y * 0.035 + 2.2) * 3.2;
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
  const s = land - 0.5 + cd * 0.2;
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
      h += mm * 5200 * (0.12 + 0.88 * Math.pow(r, 1.35));
    }
    // regional roughness: rolling country, low hills, broken ground
    const rough = sat(0.35 + 0.9 * fbm(X * 0.004 + 71, Y * 0.004 - 12, 3));
    h += (25 + 190 * rough) * (0.5 + 0.5 * fbmA(X, Y, 14, Math.max(pix * 1.1, 0.01), 0.75, 3)) * (1 - F[15]);
    h += (12 + 420 * mtn + 140 * hill + 30 * inland) * fbmA(X, Y, 3, Math.max(pix * 1.1, 0.002), 0.8, 2);
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
    const v = F[11];
    if (v > 0.01) { const floor = Math.min(h, base * 0.75 + 6); h += (floor - h) * sstep(0, 0.8, v); }
    const lk = F[15];
    if (lk > 0.05) h = mix(h, base * 0.7 - 4, sstep(0.15, 0.55, lk));
    for (let k = 0; k < FLATS.length; k++) {
      const f = FLATS[k];
      const dx = X - f.x, dy = Y - f.y;
      if (dx > f.r || dx < -f.r || dy > f.r || dy < -f.r) continue;
      const d = Math.sqrt(dx * dx + dy * dy) / f.r;
      if (d < 1) { const t = sstep(1, 0.2, d) * 0.85; h = mix(h, Math.min(h, base + f.lift + (h - base) * 0.25), t); str *= 1 - t; R.stream = str; }
    }
    if (PEAKS.length) h += peakAt(X, Y, pix);
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
  // a rotated grid of blocks; each block split into strips of varying width
  const th = 0.6 * noise(X * 0.05 + 11, Y * 0.05 - 7) + (hobbit ? 0.3 : 0.9);
  const c = Math.cos(th), s = Math.sin(th);
  let u = (X * c + Y * s) / cell, v = (-X * s + Y * c) / cell;
  u += 0.18 * noise(u * 0.35, v * 0.35); v += 0.18 * noise(u * 0.35 + 5, v * 0.35 - 3);
  const bi = Math.floor(u), bj = Math.floor(v * 0.7);
  const fu = u - bi, fv = v * 0.7 - bj;
  const pid = hash2(bi, bj, 11);
  const vert = hash2(bi, bj, 13) < 0.5;
  const ns = 1 + Math.floor(hash2(bi, bj, 15) * (hobbit ? 3 : 5));
  const q = vert ? fu : fv;
  const sid = Math.floor(q * ns);
  const k = hash2(sid + bi * 7, bj, 17);
  let col;
  if (pid < 0.3) col = FC[3 + Math.floor(k * 2)];
  else col = FC[Math.floor(k * FC.length)];
  const eu = Math.min(fu, 1 - fu) * cell, ev = Math.min(fv, 1 - fv) * cell / 0.7;
  const es = Math.min(q * ns - sid, sid + 1 - q * ns) / ns * cell * (vert ? 1 : 1 / 0.7);
  const edge = Math.min(eu, ev);
  const hedgeW = hobbit ? 0.006 : 0.004;
  let hedge = edge < hedgeW + pix * 0.5 ? sat(1 - (edge - hedgeW) / (pix + 1e-6)) : 0;
  if (es < 0.0015 + pix * 0.5 && pid >= 0.3 && pix < 0.006) hedge = Math.max(hedge, 0.2 * sat(1 - (es - 0.0015) / (pix + 1e-6)));
  const tram = (pix < cell * 0.03) ? 0.05 * Math.sin((vert ? fv : fu) * cell / 0.004) : 0;
  const trees = hedge > 0.5 && hash2(Math.floor(X / 0.007), Math.floor(Y / 0.007), 21) < 0.3 ? 1 : 0;
  return [col[0] * (1 + tram), col[1] * (1 + tram), col[2] * (1 + tram), hedge, trees];
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
    const ice = F[14];
    if (ice > 0.05) {
      const floe = fbmA(X, Y, 8, Math.max(pix, 0.002), 0.9, 8);
      const cov = sstep(0.1, 0.6, ice + 0.4 * floe);
      blend(222, 230, 238, cov * 0.95);
    }
    const lake = F[15];
    if (lake > 0.4 && depth < 5) blend(24, 58, 74, 0.8);
    if (depth < 3 && pix < 0.01) blend(210, 214, 206, sat(1 - depth / 3) * 0.35);
    return tmp3;
  }
  const T = tempAt(lat, h);
  const Mst = moistAt(X, Y, lat, wm);
  const arid = F[8];
  // ---- base ground ----
  const veg = sat(Mst * 1.35 - 0.15);
  setc(134, 124, 84);                            // dry steppe
  blend(68, 90, 42, veg);                        // lush grass
  if (T > 18) blend(158, 142, 82, sat((T - 18) / 6) * (1 - veg) * 0.8);   // savanna
  if (T > 20 && Mst > 0.7) blend(38, 70, 32, sat((Mst - 0.7) * 4) * sat((T - 20) / 4)); // jungle
  if (T < 3) blend(122, 118, 92, sat((3 - T) / 5));   // tundra
  const g = F[13];
  if (g > 0.02) {
    const gp = fbmA(X, Y, 1.5, Math.max(pix * 1.3, 0.004), 0.75, 51);
    blend(158 + 18 * gp, 144 + 10 * gp, 84, g * 0.5);
    blend(96, 112, 60, g * sat(-gp * 1.8) * 0.5);
  }
  // landcover variety: scrub, heath, bare ground, riparian green
  const lc1 = fbm(X * 0.05 + 21, Y * 0.05 - 4, 4), lc2 = fbmA(X, Y, 1.2, Math.max(pix * 1.5, 0.004), 0.6, 30);
  blend(120, 112, 74, sat(lc1 * 1.6) * 0.28);                  // dry grass patches
  blend(54, 76, 38, sat(-lc1 * 1.6) * 0.45 * veg);             // lush hollows
  blend(112, 96, 78, sat((F[3] + sat(h / 1500)) * 0.8) * sat(lc2 + 0.2) * 0.45);   // heath on hills
  const lv = lc2 * 0.1 + 0.07 * fbm(X * 0.012 - 30, Y * 0.012 + 8, 3) + 0.07 * fbmA(X, Y, 3, Math.max(pix * 1.5, 0.01), 0.7, 33); tmp3[0] *= 1 + lv; tmp3[1] *= 1 + lv * 0.9; tmp3[2] *= 1 + lv * 0.7;
  if (R.stream > 0) blend(56, 78, 40, R.stream * 0.55 * veg + 0.1 * R.stream);
  // alpine grassland and mountain rock tones by elevation
  const alp = sstep(900, 2200, h);
  if (alp > 0) blend(126, 118, 92, alp * 0.55);
  // arid / desert
  const hot = sstep(9, 19, T);
  let desert = sat(arid * 1.1 - 0.05);
  if (wm < 1) desert = Math.max(desert, sat((0.32 - Mst) * 3) * (1 - wm));
  if (desert > 0.01) {
    const dn = fbm(X * 0.02, Y * 0.02, 3);
    const dr = 212 + 18 * dn, dg = 178 + 10 * dn, db = 120;
    const cr = 132, cg = 112, cb = 82;
    blend(mix(cr, dr, hot), mix(cg, dg, hot), mix(cb, db, hot), desert);
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
    if (pix < cell * 0.22) {
      const f = fields(X, Y, cell, pix, hob);
      const t = sat((cell * 0.22 - pix) / (cell * 0.12)) * pf;
      blend(118, 128, 76, favg * (1 - t));
      const k = 0.4 + 0.6 * sat((cell * 0.08 - pix) / (cell * 0.05));
      blend(118 + (f[0] - 118) * k, 128 + (f[1] - 128) * k, 76 + (f[2] - 76) * k, t * 0.85);
      if (f[3] > 0) blend(f[4] ? 44 : 70, f[4] ? 62 : 86, f[4] ? 34 : 48, f[3] * t * 0.85 * sat((0.012 - pix) / 0.006));
    } else {
      blend(118, 128, 76, favg);
      const fn = fbm(X / cell * 0.8, Y / cell * 0.8, 3);
      tmp3[0] *= 1 + 0.08 * fn * pf; tmp3[1] *= 1 + 0.06 * fn * pf;
    }
  }
  // natural woodland and forests
  let fd = F[4];
  if (farm > 0.2) fd = Math.max(fd, sstep(0.42, 0.5, fbm(X * 0.9 + 3, Y * 0.9 - 8, 3) + 0.15 * noise(X * 6, Y * 6)) * 0.9 * sat(farm));
  const temperate = sstep(-4, 3, T) * (1 - sstep(24, 30, T));
  const wild = sstep(0.1, 0.55, fbm(X * 0.03 + 7, Y * 0.03, 4) + 0.35 * (Mst - 0.5)) * Mst * 0.7 * temperate * (1 - arid) * (1 - F[9] * 0.8) * (1 - g * 0.9);
  fd = Math.max(fd * (0.7 + 0.3 * sat(Mst + 0.3)), wild * (wm < 1 ? 1 : 0.55));
  const treeline = 2600 - Math.max(0, Math.abs(lat) - 40) * 55;
  fd *= sstep(treeline, treeline - 500, h);
  fd *= 1 - sstep(0.55, 0.9, slope) * 0.6;
  if (fd > 0.01) {
    const conifer = sat(sstep(8, 1, T + 0.004 * 0) + sstep(treeline - 1200, treeline - 400, h));
    let fr = mix(50, 30, conifer), fg = mix(70, 50, conifer), fb = mix(36, 34, conifer);
    const dk = F[6];
    if (dk > 0) { fr = mix(fr, 22, dk); fg = mix(fg, 36, dk); fb = mix(fb, 24, dk); }
    const gold = F[5];
    if (gold > 0) { const gm = gold * (0.35 + 0.35 * sat(0.5 + fbm(X * 0.6, Y * 0.6, 3))); fr = mix(fr, 168, gm); fg = mix(fg, 140, gm); fb = mix(fb, 52, gm); }
    if (T > 22) { fr *= 0.8; fg *= 1.05; }
    const mott = fbmA(X, Y, 0.6, Math.max(pix, 0.002), 0.7, 9);
    fr *= 1 + 0.12 * mott; fg *= 1 + 0.14 * mott; fb *= 1 + 0.1 * mott;
    let dens = sstep(0.3, 0.52, fd + 0.28 * fbmA(X, Y, 4, Math.max(pix, 0.003), 0.8, 40));
    if (pix < 0.008) {
      const c = canopy(X, Y, gold > 0.5 ? 0.012 : 0.0065);
      const gap = c < -0.5;
      const lit = 1 + 0.32 * c * sat((0.008 - pix) / 0.004);
      if (gap) dens *= sat(1 - (0.8 - fd) * 1.5);
      fr *= lit; fg *= lit; fb *= lit;
    }
    blend(fr, fg, fb, dens);
  }
  // marsh
  const marsh = F[7];
  if (marsh > 0.02) {
    blend(74, 84, 52, marsh * 0.8);
    const pools = fbmA(X, Y, 0.8, Math.max(pix, 0.002), 0.8, 12);
    if (pools > 0.18) blend(46, 64, 62, sat((pools - 0.18) * 6) * marsh);
  }
  // ash and slag of Mordor
  const ash = F[10];
  if (ash > 0.02) {
    const an = fbm(X * 0.08, Y * 0.08, 4);
    const af = sstep(0.25, 0.55, ash + 0.3 * fbmA(X, Y, 6, Math.max(pix, 0.003), 0.8, 44));
    blend(62 + 12 * an, 57 + 10 * an, 54 + 8 * an, af * 0.94);
    const dO = Math.hypot(X - 860, Y + 565);
    if (dO < 30) {
      const flows = Math.abs(noise(Math.atan2(Y + 565, X - 860) * 6, dO * 0.25));
      if (flows < 0.07) blend(98, 34, 16, (1 - flows / 0.07) * sat(1 - dO / 30) * 0.9);
      blend(40, 36, 36, sat(1 - dO / 12) * 0.6);
    }
  }
  // alpine: rock on steep slopes and high ground, snow above the snowline
  const rock = Math.max(sstep(0.5, 0.95, slope), sstep(treeline + 200, treeline + 900, h) * 0.85);
  if (rock > 0.01) {
    const rn = fbm(X * 0.3, Y * 0.3, 3);
    const dark = ash > 0.3 ? 0.55 : 0;
    blend(mix(124, 70, dark) + 14 * rn, mix(114, 64, dark) + 12 * rn, mix(104, 60, dark) + 10 * rn, rock);
  }
  const Tsnow = T + 8.5 + 8 * slope;
  let snow = sstep(-1, -4.5, Tsnow);
  snow = Math.max(snow, F[14] * 0.9 * sstep(0.2, 0.7, F[14] + 0.3 * fbm(X * 0.05, Y * 0.05, 3)));
  if (snow > 0.01) {
    const sn = fbmA(X, Y, 2, Math.max(pix, 0.002), 0.8, 14);
    snow = sat(snow + sn * 0.35 * snow);
    blend(238, 242, 247, snow);
  }
  // beaches
  if (s < 0.025 && h < 8 && slope < 0.5) blend(204, 190, 152, sat(1 - s / 0.025) * 0.8);
  // lakes at coarse scale
  if (F[15] > 0.55 && pix > 0.3) blend(26, 58, 74, sstep(0.55, 0.75, F[15]));
  return tmp3;
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
function renderGrid(n, m, coordFn, pix, mode, shade, sun) {
  const W = n + 2, H = m + 2;
  const E = new Float32Array(W * H), S = new Float32Array(W * H);
  const FS = new Float32Array(n * m * NCH), RS = new Float32Array(n * m * 5);
  const XS = new Float64Array(W * H), YS = new Float64Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i;
    const c = coordFn(i - 1, j - 1);
    XS[k] = c[0]; YS[k] = c[1];
    E[k] = evaluate(c[0], c[1], pix);
    S[k] = R.s;
    if (i > 0 && j > 0 && i <= n && j <= m) {
      const q = (j - 1) * n + (i - 1);
      FS.set(F, q * NCH);
      RS[q * 5] = R.s; RS[q * 5 + 1] = R.lat; RS[q * 5 + 2] = R.wm; RS[q * 5 + 3] = R.stream; RS[q * 5 + 4] = R.base;
    }
  }
  const out = new Uint8ClampedArray(n * m * 4);
  const cellM = pix * MI;
  const sx = sun ? sun[0] : -0.55, sy = sun ? sun[1] : 0.55, sz = sun ? sun[2] : 0.63;
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
    const k = (j + 1) * W + (i + 1);
    const q = j * n + i;
    const X = XS[k], Y = YS[k];
    for (let c = 0; c < NCH; c++) F[c] = FS[q * NCH + c];
    R.s = RS[q * 5]; R.lat = RS[q * 5 + 1]; R.wm = RS[q * 5 + 2]; R.stream = RS[q * 5 + 3]; R.base = RS[q * 5 + 4];
    const land = R.s > 0;
    const h = E[k];
    const hl = land ? E[k - 1] : 0, hr = land ? E[k + 1] : 0, hu = land ? E[k - W] : 0, hd = land ? E[k + W] : 0;
    const dx = land ? (Math.max(hr, 0) - Math.max(hl, 0)) / (2 * cellM) : 0, dy = land ? (Math.max(hu, 0) - Math.max(hd, 0)) / (2 * cellM) : 0;
    const gm = Math.sqrt(dx * dx + dy * dy);
    const slope = sat(gm / 1.2);
    let dsea;
    if (mode === 1) {
      const gsx = (S[k + 1] - S[k - 1]) / 2, gsy = (S[k - W] - S[k + W]) / 2;
      const gs = Math.sqrt(gsx * gsx + gsy * gsy) + 1e-6;
      dsea = -S[k] / gs * pix;
    }
    const c = colorAt(X, Y, h, slope, pix, mode, dsea);
    let r = c[0], g = c[1], b = c[2];
    if (shade && land) {
      const ex = (mode === 1 ? 2.2 : 1.5) * (pix > 0.3 ? Math.min(6, 1 + pix * 0.5) : 1);
      const nx = -dx * ex, ny = -dy * ex;
      const nl = Math.sqrt(nx * nx + ny * ny + 1);
      const lam = (nx * sx + ny * sy + sz) / nl;
      let f = mode === 1 ? 0.55 + 0.6 * lam : 0.4 + 0.8 * lam;
      f = clamp(f, 0.28, 1.25);
      r *= f; g *= f; b *= f;
    }
    if (mode === 0) { r = r * 0.96 + 4; g = g * 0.97 + 5; b = b * 0.98 + 9; }
    const o = q * 4;
    out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
  }
  return { rgba: out, E, W, H };
}

function imageryTile(z, x, y, n, mode) {
  const [, latc] = tileLL(z, x, y, n / 2, n / 2, n);
  const pix = EARTH_C * Math.cos(latc * D2R) / (n * Math.pow(2, z)) / MI;
  return renderGrid(n, n, (i, j) => { const ll = tileLL(z, x, y, i + 0.5, j + 0.5, n); return toXY(ll[0], ll[1]); }, pix, mode, true);
}

/* ---------------- vectors (rivers, lakes, roads, settlements) ---------------- */
let RIV = [], ROADS = [], LAKES = [], SETTLE = [], WALLS = [], BUCKET = new Map();
const BK = 40;
function densify(pts, rough, seed, minLen) {
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
        const off = r * L * rough;
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
function initVectors(v) {
  BUCKET = new Map();
  RIV = v.rivers.map((r, i) => {
    const pts = densify(r.pts, 0.2, i + 1, 0.12);
    // split into chunks for bucketing, carry width along
    const L = [0]; for (let k = 1; k < pts.length; k++) L.push(L[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    const tot = L[L.length - 1] || 1;
    const chunks = [];
    for (let s = 0; s < pts.length - 1; s += 60) {
      const e = Math.min(pts.length, s + 61);
      chunks.push({ pts: pts.slice(s, e), w0: mix(r.w0, r.w1, Math.pow(L[s] / tot, 0.8)), w1: mix(r.w0, r.w1, Math.pow(L[e - 1] / tot, 0.8)) });
    }
    return { name: r.name, chunks };
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
};
function buildings(si) {
  if (BCACHE.has(si)) return BCACHE.get(si);
  const s = SETTLE[si];
  const st = STYLE[s.culture] || STYLE.bree;
  const out = [];
  const rM = s.r * MI;
  const n = Math.round(st.dens * s.r * s.r * Math.PI);
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
    const w = mix(st.w[0], st.w[1], hash2(si, tries, 41)), d = mix(st.d[0], st.d[1], hash2(si, tries, 43));
    const col = st.roof[Math.floor(hash2(si, tries, 45) * st.roof.length)];
    out.push({ x: s.x + ex / MI, y: s.y + ny / MI, w, d, a: ang, c: col, h: st.h * (0.8 + 0.5 * hash2(si, tries, 47)), round: st.round || (s.culture === 'hobbit' && hash2(si, tries, 49) < 0.7) ? 1 : 0, ruin: st.ruin || 0 });
  }
  // special structures
  const sp = [];
  if (s.culture === 'minastirith') {
    for (let k = 0; k < 7; k++) sp.push({ type: 'arc', x: s.x, y: s.y, r: (60 + k * 95) / MI, a0: -Math.PI * 0.62, a1: Math.PI * 0.62, w: 5 + (7 - k) * 1.2, h: 14 + k * 2, c: [236, 236, 230] });
    sp.push({ type: 'tower', x: s.x - 0.01, y: s.y, r: 9, h: 90, c: [246, 246, 244] });
  }
  if (s.culture === 'isengard') {
    sp.push({ type: 'arc', x: s.x, y: s.y, r: 0.5, a0: -Math.PI, a1: Math.PI, w: 30, h: 30, c: [52, 52, 56] });
    sp.push({ type: 'tower', x: s.x, y: s.y, r: 22, h: 150, c: [26, 26, 30], square: 1 });
  }
  if (s.culture === 'rohan') {
    sp.push({ type: 'arc', x: s.x, y: s.y, r: s.r * 0.9, a0: -Math.PI, a1: Math.PI, w: 3, h: 5, c: [120, 96, 64] });
    if (s.name === 'Edoras') out.push({ x: s.x + 0.001, y: s.y + 0.002, w: 48, d: 18, a: 0.2, c: [214, 176, 64], h: 16, round: 0 });
  }
  if (s.culture === 'mordor' && s.name === 'Barad-dûr') sp.push({ type: 'tower', x: s.x, y: s.y, r: 60, h: 420, c: [18, 16, 18], square: 1 });
  if (s.culture === 'morgul') sp.push({ type: 'tower', x: s.x, y: s.y, r: 14, h: 110, c: [170, 196, 184] });
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

return { D2R, MI, EARTH_C, toLL, toXY, noise, fbm, fbmA, hash2, sat, sstep, mix, clamp, init, evaluate, F, R, CH, tempAt, moistAt,
  demTile, imageryTile, renderGrid, tileLL, drawVectors, buildingsNear, numenorField };
})();
if (typeof self !== 'undefined') self.GEN = GEN;
