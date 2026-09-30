/* Tile, patch and weather worker. GEN and WX are prepended to this source. */
const HAS_OC = typeof OffscreenCanvas !== 'undefined';
let WXS = null;           // weather static grid

function tileBBox(z, x, y) {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const [i, j] of [[0, 0], [256, 0], [0, 256], [256, 256], [128, 0], [128, 256], [0, 128], [256, 128]]) {
    const ll = GEN.tileLL(z, x, y, i, j, 256);
    const p = GEN.toXY(ll[0], ll[1]);
    minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]);
  }
  return [minx, miny, maxx, maxy];
}
const merc = lat => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));

async function imgTile(m) {
  const n = 256;
  const r = GEN.imageryTile(m.z, m.x, m.y, n, m.mode);
  const img = new ImageData(r.rgba, n, n);
  if (!HAS_OC) return createImageBitmap(img);
  const cv = new OffscreenCanvas(n, n);
  const ctx = cv.getContext('2d');
  ctx.putImageData(img, 0, 0);
  if (m.z >= 5) {
    const zz = Math.pow(2, m.z);
    const proj = (X, Y) => {
      const ll = GEN.toLL(X, Y);
      return [((ll[0] + 180) / 360 * zz - m.x) * n, ((1 - merc(ll[1]) / Math.PI) / 2 * zz - m.y) * n];
    };
    const [, latc] = GEN.tileLL(m.z, m.x, m.y, 128, 128, 256);
    const pix = GEN.EARTH_C * Math.cos(latc * Math.PI / 180) / (n * zz) / GEN.MI;
    GEN.drawVectors(ctx, proj, tileBBox(m.z, m.x, m.y), pix, m.mode);
  }
  return cv.transferToImageBitmap();
}

function demTile(m) {
  const px = GEN.demTile(m.z, m.x, m.y, 256);
  return createImageBitmap(new ImageData(px, 256, 256), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
}

/* ---------- ground patches ---------- */
function patchHeights(m) {
  const n = m.n, out = new Float32Array(n * n), water = new Uint8Array(n * n);
  const half = m.half / GEN.MI, step = 2 * half / (n - 1);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const X = m.X + (-half + i * step), Y = m.Y + (half - j * step);
    let h = GEN.evaluate(X, Y, step);
    if (GEN.R.s <= 0) { h = Math.min(h, -2); water[j * n + i] = 1; }
    if (GEN.F[15] > 0.5 && GEN.R.s > 0) { h = Math.min(h, GEN.R.base * 0.7 - 4); water[j * n + i] = 2; }
    out[j * n + i] = h;
  }
  return { h: out, water };
}
async function patchTexture(m) {
  const n = m.tex, half = m.half / GEN.MI, pix = 2 * half / n;
  const rows = m.r1 - m.r0;
  const g = GEN.renderGrid(n, rows, (i, j) => [m.X - half + (i + 0.5) * pix, m.Y + half - (m.r0 + j + 0.5) * pix], pix, 0, false);
  const img = new ImageData(g.rgba, n, rows);
  if (!HAS_OC) return createImageBitmap(img);
  const cv = new OffscreenCanvas(n, rows);
  const ctx = cv.getContext('2d');
  ctx.putImageData(img, 0, 0);
  const proj = (X, Y) => [(X - (m.X - half)) / pix, ((m.Y + half) - Y) / pix - m.r0];
  const y1 = m.Y + half - m.r0 * pix, y0 = m.Y + half - m.r1 * pix;
  GEN.drawVectors(ctx, proj, [m.X - half, y0, m.X + half, y1], pix, 0);
  return cv.transferToImageBitmap();
}
function patchTrees(m) {
  // forest density on a coarse lattice, trees on a fine jittered lattice
  const half = m.half, cs = m.cell, nC = Math.ceil(2 * half / cs) + 1;
  const dens = new Float32Array(nC * nC), kind = new Uint8Array(nC * nC);
  const pixMi = cs / GEN.MI;
  for (let j = 0; j < nC; j++) for (let i = 0; i < nC; i++) {
    const X = m.X + (-half + i * cs) / GEN.MI, Y = m.Y + (half - j * cs) / GEN.MI;
    const h = GEN.evaluate(X, Y, pixMi);
    if (GEN.R.s <= 0 || GEN.F[15] > 0.5) continue;
    GEN.colorAt ? 0 : 0;
    const F = GEN.F;
    const T = GEN.tempAt(GEN.R.lat, h);
    let fd = F[4];
    const Mst = GEN.moistAt(X, Y, GEN.R.lat, GEN.R.wm);
    const wild = GEN.sstep(0.1, 0.55, GEN.fbm(X * 0.03 + 7, Y * 0.03, 4) + 0.35 * (Mst - 0.5)) * Mst * 0.7 * GEN.sstep(-4, 3, T) * (1 - F[8]) * (1 - F[9] * 0.8) * (1 - F[13] * 0.9);
    fd = Math.max(fd * (0.7 + 0.3 * GEN.sat(Mst + 0.3)), wild * 0.55);
    const treeline = 2600 - Math.max(0, Math.abs(GEN.R.lat) - 40) * 55;
    fd *= GEN.sstep(treeline, treeline - 500, h);
    fd = GEN.sstep(0.3, 0.52, fd + 0.28 * GEN.fbmA(X, Y, 4, 0.003, 0.8, 40));
    // hedgerow and farm trees
    if (F[9] > 0.2) fd = Math.max(fd, 0.05);
    if (F[7] > 0.3) fd *= 0.4;
    dens[j * nC + i] = fd;
    const conifer = T < 3 || h > treeline - 700;
    kind[j * nC + i] = F[5] > 0.5 ? 2 : F[6] > 0.5 ? 3 : conifer ? 1 : 0;
  }
  const trees = [];
  const sp = m.spacing, nT = Math.floor(2 * m.treeHalf / sp);
  for (let j = 0; j < nT; j++) for (let i = 0; i < nT; i++) {
    const ex = -m.treeHalf + (i + GEN.hash2(i + m.seed, j, 3)) * sp, ny = m.treeHalf - (j + GEN.hash2(i + m.seed, j, 5)) * sp;
    const ci = (ex + half) / cs, cj = (half - ny) / cs;
    const ii = Math.floor(ci), jj = Math.floor(cj);
    if (ii < 0 || jj < 0 || ii >= nC - 1 || jj >= nC - 1) continue;
    const fx = ci - ii, fy = cj - jj;
    const d = dens[jj * nC + ii] * (1 - fx) * (1 - fy) + dens[jj * nC + ii + 1] * fx * (1 - fy) + dens[(jj + 1) * nC + ii] * (1 - fx) * fy + dens[(jj + 1) * nC + ii + 1] * fx * fy;
    if (GEN.hash2(i + m.seed, j, 7) > d) continue;
    trees.push(ex, ny, kind[jj * nC + ii], 0.7 + 0.6 * GEN.hash2(i, j + m.seed, 9));
  }
  return new Float32Array(trees);
}

/* ---------- weather ---------- */
function wxInit(m) {
  const { W, H, lon0, lon1, lat0, lat1, GW, GH } = m;
  const my0 = merc(lat1), my1 = merc(lat0);
  const latOf = v => (2 * Math.atan(Math.exp(my0 + (my1 - my0) * v)) - Math.PI / 2) * 180 / Math.PI;
  const st = [];
  const hs = new Float32Array(GW * GH);
  const pos = [];
  for (let j = 0; j < GH; j++) {
    const lat = latOf((j + 0.5) / GH);
    for (let i = 0; i < GW; i++) {
      const lon = lon0 + (lon1 - lon0) * (i + 0.5) / GW;
      const [X, Y] = GEN.toXY(lon, lat);
      const h = GEN.evaluate(X, Y, 8);
      const F = GEN.F;
      st.push({ X, Y, lat, lon, h: Math.max(0, h), land: GEN.R.s > 0 ? 1 : 0, arid: F[8], cont: GEN.sat((F[1] - 0.45) * 2), mtn: F[2], gx: 0, gy: 0 });
      hs[j * GW + i] = Math.max(0, h);
    }
  }
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const s = st[j * GW + i];
    const il = Math.max(0, i - 1), ir = Math.min(GW - 1, i + 1), ju = Math.max(0, j - 1), jd = Math.min(GH - 1, j + 1);
    const dxm = (st[j * GW + ir].X - st[j * GW + il].X) * GEN.MI || 1, dym = (st[ju * GW + i].Y - st[jd * GW + i].Y) * GEN.MI || 1;
    s.gx = (hs[j * GW + ir] - hs[j * GW + il]) / dxm;
    s.gy = (hs[ju * GW + i] - hs[jd * GW + i]) / dym;
  }
  // per-pixel X,Y for the render canvas
  const PX = new Float32Array(W * H), PY = new Float32Array(W * H), LAT = new Float32Array(H);
  for (let j = 0; j < H; j++) {
    const lat = latOf((j + 0.5) / H); LAT[j] = lat;
    for (let i = 0; i < W; i++) {
      const lon = lon0 + (lon1 - lon0) * (i + 0.5) / W;
      const p = GEN.toXY(lon, lat);
      PX[j * W + i] = p[0]; PY[j * W + i] = p[1];
    }
  }
  WXS = { ...m, st, PX, PY, LAT };
}

const TRAMP = [[-30, 150, 90, 200], [-15, 110, 110, 220], [-5, 90, 150, 230], [0, 150, 200, 240], [5, 110, 200, 170], [12, 150, 220, 110], [18, 230, 220, 100], [24, 240, 170, 70], [30, 230, 100, 60], [40, 150, 30, 60]];
function tcol(T) {
  let i = 0; while (i < TRAMP.length - 2 && T > TRAMP[i + 1][0]) i++;
  const a = TRAMP[i], b = TRAMP[i + 1], t = GEN.sat((T - a[0]) / (b[0] - a[0]));
  return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
}
function rcol(R, snow) {
  if (snow > 0.5) {
    if (R < 0.5) return [170, 200, 240, 150]; if (R < 2) return [120, 150, 240, 190]; return [170, 110, 230, 220];
  }
  if (R < 0.4) return [90, 200, 110, 140]; if (R < 1.5) return [40, 170, 60, 180]; if (R < 3) return [230, 220, 60, 200]; if (R < 6) return [240, 140, 40, 220]; return [220, 40, 50, 230];
}

function wxFrame(m) {
  const S = WXS; if (!S) return null;
  const t = m.t, sys = WX.systems(t);
  const { GW, GH, W, H, st } = S;
  const N = GW * GH;
  const C = new Float32Array(N), R = new Float32Array(N), T = new Float32Array(N), P = new Float32Array(N), U = new Float32Array(N), V = new Float32Array(N), SN = new Float32Array(N), DK = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    const s = st[k];
    const o = WX.sample(s.X, s.Y, t, s, sys, m.lore);
    C[k] = o.C; R[k] = o.R; T[k] = o.T; P[k] = o.P; U[k] = o.u; V[k] = o.v; SN[k] = o.snow; DK[k] = o.dark;
  }
  const bil = (A, u, v) => {
    const x = u * GW - 0.5, y = v * GH - 0.5;
    const ix = Math.max(0, Math.min(GW - 2, Math.floor(x))), iy = Math.max(0, Math.min(GH - 2, Math.floor(y)));
    const fx = GEN.sat(x - ix), fy = GEN.sat(y - iy), k = iy * GW + ix;
    return (A[k] * (1 - fx) + A[k + 1] * fx) * (1 - fy) + (A[k + GW] * (1 - fx) + A[k + GW + 1] * fx) * fy;
  };
  const res = { id: m.id, t, U, V, GW, GH, sys: sys.filter(s => !s.fixed && s.env > 0.35).map(s => ({ type: s.type, x: s.x, y: s.y })), layers: {} };
  const L = m.layers;
  const transfers = [];
  const drift = t * 420;
  if (L.clouds || L.radar) {
    const cl = L.clouds ? new Uint8ClampedArray(W * H * 4) : null;
    const rd = L.radar ? new Uint8ClampedArray(W * H * 4) : null;
    for (let j = 0; j < H; j++) {
      const v = (j + 0.5) / H;
      for (let i = 0; i < W; i++) {
        const u = (i + 0.5) / W, k = j * W + i;
        const X = S.PX[k], Y = S.PY[k];
        const c = bil(C, u, v), r = bil(R, u, v);
        const det = GEN.fbm((X - drift) / 70, (Y + t * 40) / 70, 5);
        const o = k * 4;
        if (cl) {
          let d = GEN.sat((c - 0.4) * 2.3 + 0.62 * det + 0.1);
          d = d * d * (3 - 2 * d);
          const grey = 250 - 70 * GEN.sat(r / 5) - 25 * GEN.sat(det);
          const dk = bil(DK, u, v);
          const edge = Math.min(i, W - 1 - i, j, H - 1 - j) / 40;
          const a = Math.max(d * 0.93, dk * 0.88) * (edge < 1 ? edge * edge * (3 - 2 * edge) : 1);
          const mixd = dk > d ? 1 : dk / (d + 1e-3) * 0.5;
          cl[o] = grey * (1 - mixd) + 44 * mixd; cl[o + 1] = grey * (1 - mixd) + 34 * mixd; cl[o + 2] = grey * (1 - mixd) + 30 * mixd; cl[o + 3] = a * 255;
        }
        if (rd && r > 0.05) {
          const cell = GEN.sat(0.55 + 0.9 * GEN.fbm((X - drift) / 22, (Y + t * 40) / 22, 3));
          const I = r * (0.4 + 1.2 * cell);
          if (I > 0.12) { const col = rcol(I, bil(SN, u, v)); rd[o] = col[0]; rd[o + 1] = col[1]; rd[o + 2] = col[2]; rd[o + 3] = col[3]; }
        }
      }
    }
    if (cl) res.layers.clouds = cl;
    if (rd) res.layers.radar = rd;
  }
  if (L.temp) {
    const tp = new Uint8ClampedArray(W * H * 4);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i, o = k * 4;
      const c = tcol(bil(T, (i + 0.5) / W, (j + 0.5) / H));
      tp[o] = c[0]; tp[o + 1] = c[1]; tp[o + 2] = c[2]; tp[o + 3] = 150;
    }
    res.layers.temp = tp;
  }
  for (const k in res.layers) transfers.push(res.layers[k].buffer);
  if (L.pressure) { res.P = P; }
  res.T = T; res.C = C; res.R = R;
  return { res, transfers };
}

/* Global low-detail cloud field for the rest of the planet. */
function globalClouds(m) {
  const { W, H, t } = m;
  const out = new Uint8ClampedArray(W * H * 4);
  const w = WX.winterness(t);
  for (let j = 0; j < H; j++) {
    const my = Math.PI * (1 - 2 * (j + 0.5) / H) * 0.93;
    const lat = Math.atan(Math.sinh(my)) * 180 / Math.PI;
    const al = Math.abs(lat);
    const band = 0.55 * Math.exp(-Math.pow((lat - 6 + 8 * w) / 7, 2)) + 0.45 * Math.exp(-Math.pow((al - 55) / 12, 2)) - 0.35 * Math.exp(-Math.pow((al - 25) / 8, 2));
    for (let i = 0; i < W; i++) {
      const lon = (i + 0.5) / W * 360 - 180;
      const x = lon * 0.35 - t * (al > 35 ? 5 : -2.5), y = lat * 0.35;
      const n = GEN.fbm(x * 0.35, y * 0.5, 6);
      let d = GEN.sat((band + 0.3 + 0.9 * n - 0.35) * 2.2);
      d = d * d * (3 - 2 * d);
      const o = (j * W + i) * 4;
      const g = 246 - 30 * GEN.sat(n);
      out[o] = g; out[o + 1] = g; out[o + 2] = g + 4; out[o + 3] = d * 235;
    }
  }
  return out;
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'init') { GEN.init(m.data); self.postMessage({ id: m.id, ok: 1 }); return; }
    if (m.type === 'dem') { const b = await demTile(m); self.postMessage({ id: m.id, bmp: b }, [b]); return; }
    if (m.type === 'img') { const b = await imgTile(m); self.postMessage({ id: m.id, bmp: b }, [b]); return; }
    if (m.type === 'ph') { const r = patchHeights(m); self.postMessage({ id: m.id, h: r.h, water: r.water }, [r.h.buffer, r.water.buffer]); return; }
    if (m.type === 'pt') { const b = await patchTexture(m); self.postMessage({ id: m.id, bmp: b }, [b]); return; }
    if (m.type === 'trees') { const t = patchTrees(m); const b = GEN.buildingsNear(m.X, m.Y, m.bHalf / GEN.MI); self.postMessage({ id: m.id, trees: t, buildings: b }, [t.buffer]); return; }
    if (m.type === 'wxinit') { wxInit(m); self.postMessage({ id: m.id, ok: 1 }); return; }
    if (m.type === 'wx') { const r = wxFrame(m); self.postMessage(r.res, r.transfers); return; }
    if (m.type === 'gclouds') { const c = globalClouds(m); self.postMessage({ id: m.id, rgba: c }, [c.buffer]); return; }
  } catch (err) {
    self.postMessage({ id: m.id, error: String(err && err.stack || err) });
  }
};
