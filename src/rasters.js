/* Rasterises the authored geography into the field rasters used by GEN. */
const RASTERS = (() => {
const RES = 4, X0 = -2300, X1 = 3100, Y0 = -2900, Y1 = 1000;
const W = (X1 - X0) / RES, H = (Y1 - Y0) / RES;
const GW = 1440, GH = 720;

function boxBlur(a, w, h, r, passes) {
  if (r < 1) return a;
  const tmp = new Float32Array(w * h);
  let src = Float32Array.from(a);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[row + x] = acc / (2 * r + 1);
        acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        src[y * w + x] = acc / (2 * r + 1);
        acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = src[i] + 0.5;
  return out;
}

function build(GEO) {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const px = p => [(p[0] - X0) / RES, (Y1 - p[1]) / RES];
  const path = pts => { ctx.beginPath(); pts.forEach((p, i) => { const q = px(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); };
  const grey = v => { const c = Math.round(Math.max(0, Math.min(1, v)) * 255); return `rgb(${c},${c},${c})`; };
  const begin = () => { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighten'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; };
  const grab = () => { const d = ctx.getImageData(0, 0, W, H).data; const o = new Uint8Array(W * H); for (let i = 0; i < o.length; i++) o[i] = d[i * 4]; return o; };
  const polys = (list, val) => { for (const f of list) { if (f.circle) { const q = px(f.circle); ctx.beginPath(); ctx.arc(q[0], q[1], f.circle[2] / RES, 0, 7); } else { path(f.pts); ctx.closePath(); } ctx.fillStyle = grey(val(f)); ctx.fill(); } };
  const lines = (list, width, val) => { for (const f of list) { path(f.pts); ctx.lineWidth = width(f); ctx.strokeStyle = grey(val(f)); ctx.stroke(); } };
  const ch = [];

  begin(); polys([{ pts: GEO.COAST }].concat(GEO.ISLANDS), () => 1);
  const landRaw = grab();
  ch[0] = boxBlur(landRaw, W, H, 1, 2);
  ch[1] = boxBlur(landRaw, W, H, 18, 3);
  begin(); lines(GEO.RANGES, f => f.w / RES, f => f.h / 5200); ch[2] = boxBlur(grab(), W, H, 2, 2);
  begin(); lines(GEO.HILLS, f => f.w / RES, f => f.h / 1200); polys(GEO.RELIEF || [], f => f.v); ch[3] = boxBlur(grab(), W, H, 2, 2);
  { const foot = boxBlur(ch[2], W, H, 7, 3); for (let i = 0; i < foot.length; i++) ch[3][i] = Math.max(ch[3][i], Math.min(255, foot[i] * 1.6)); }
  begin(); polys(GEO.FORESTS, f => f.dens); ch[4] = boxBlur(grab(), W, H, 1, 2);
  begin(); polys(GEO.FORESTS.filter(f => f.gold), f => f.gold); ch[5] = boxBlur(grab(), W, H, 1, 2);
  begin(); polys(GEO.FORESTS.filter(f => f.dark), f => f.dark); ch[6] = boxBlur(grab(), W, H, 2, 2);
  begin(); polys(GEO.MARSHES, () => 1); ch[7] = boxBlur(grab(), W, H, 1, 2);
  begin(); polys(GEO.ARID, f => f.v); ch[8] = boxBlur(grab(), W, H, 9, 3);
  begin(); polys(GEO.FARMS, f => f.v); ch[9] = boxBlur(grab(), W, H, 2, 2);
  begin(); polys(GEO.ASH, f => f.v); ch[10] = boxBlur(grab(), W, H, 2, 2);
  begin(); lines(GEO.RIVERS, f => [0, 5, 3.5, 2.4, 1.6, 1.1][f.rank] || 1, f => [0, 1, 0.85, 0.65, 0.45, 0.3][f.rank] || 0.3); ch[11] = boxBlur(grab(), W, H, 2, 2);
  begin(); polys(GEO.UPLIFT, f => f.v); ch[12] = boxBlur(grab(), W, H, 7, 3);
  begin(); polys(GEO.GRASS, f => f.v); ch[13] = boxBlur(grab(), W, H, 6, 3);
  begin(); polys(GEO.ICE, f => f.v); ch[14] = boxBlur(grab(), W, H, 3, 2);
  begin(); polys(GEO.LAKES, () => 1); ch[15] = boxBlur(grab(), W, H, 1, 1);

  // ---------- global raster ----------
  const gc = document.createElement('canvas');
  gc.width = GW; gc.height = GH;
  const g = gc.getContext('2d', { willReadFrequently: true });
  const gp = ll => [(ll[0] + 180) / 360 * GW, (90 - ll[1]) / 180 * GH];
  const gbegin = () => { g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, GW, GH); g.globalCompositeOperation = 'lighten'; g.lineCap = 'round'; };
  const ggrab = () => { const d = g.getImageData(0, 0, GW, GH).data; const o = new Float32Array(GW * GH); for (let i = 0; i < o.length; i++) o[i] = d[i * 4] / 255; return o; };
  const mePoly = pts => { g.beginPath(); pts.forEach((p, i) => { const q = gp(GEN.toLL(p[0], p[1])); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.closePath(); };
  const llPoly = pts => { g.beginPath(); pts.forEach((p, i) => { const q = gp(p); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.closePath(); };
  const DARK = [[18, 6], [30, 4], [45, 2], [60, -4], [75, -12], [85, -25], [82, -38], [70, -48], [50, -52], [35, -45], [25, -32], [20, -18], [16, -6]];
  const SUN = [[88, 55], [100, 62], [120, 64], [140, 58], [150, 45], [148, 30], [140, 15], [128, 5], [112, 0], [100, 8], [92, 20], [88, 35]];
  gbegin(); g.fillStyle = '#fff';
  mePoly(GEO.COAST); g.fill(); GEO.ISLANDS.forEach(i => { mePoly(i.pts); g.fill(); });
  llPoly(DARK); g.fill(); llPoly(SUN); g.fill();
  const gl0 = ggrab();
  const glb = (() => { const u = new Uint8Array(GW * GH); for (let i = 0; i < u.length; i++) u[i] = gl0[i] * 255; return boxBlur(u, GW, GH, 5, 2); })();
  const gl = new Float32Array(GW * GH);
  // procedural New Lands (western hemisphere) and polar lands
  const gm = new Float32Array(GW * GH), gi = new Float32Array(GW * GH);
  for (let y = 0; y < GH; y++) {
    const lat = 90 - (y + 0.5) / GH * 180;
    for (let x = 0; x < GW; x++) {
      const lon = (x + 0.5) / GW * 360 - 180;
      const k = y * GW + x;
      const inME = lon > -40 && lon < 72 && lat > 8 && lat < 75;
      let l = inME ? gl0[k] : GEN.sat((glb[k] / 255 - 0.5 + 0.38 * GEN.fbm(lon * 0.09 + 2, lat * 0.09 - 7, 5)) * 5);
      const inW = GEN.sstep(-178, -168, lon) * GEN.sstep(-58, -68, lon);
      const inE = GEN.sstep(150, 158, lon) * GEN.sstep(179, 175, lon);
      const wx = lon + 22 * GEN.fbm(lon * 0.02, lat * 0.025 + 4, 4), wy = lat + 16 * GEN.fbm(lon * 0.02 + 8, lat * 0.025, 4);
      const cx = wx * 0.032, cy = wy * 0.04;
      const n = GEN.fbm(cx + 3.1, cy - 1.7, 7) + 0.45 * GEN.fbm(cx * 2.7 + 9, cy * 2.7, 5) - 0.05;
      if (inW > 0 && Math.abs(lat) < 72) l = Math.max(l, GEN.sat((n + 0.08 + 0.12 * inW) * 5) * inW);
      if (inE > 0 && Math.abs(lat) < 60) l = Math.max(l, GEN.sat((n - 0.1) * 5) * inE);
      const darkS = GEN.sstep(-40, -55, lat) * GEN.sstep(-10, 10, lon) * GEN.sstep(95, 85, lon);
      if (darkS > 0) l = Math.max(l, GEN.sat((n + 0.2) * 4) * darkS * 0.0);
      if (lat < -66) l = Math.max(l, GEN.sat((n + 0.35 + (-66 - lat) * 0.06) * 5));
      if (lat > 76 && (lon < -70 || lon > 80)) l = Math.max(l, GEN.sat((n + (lat - 76) * 0.04) * 5));
      gl[k] = l;
      const r = 1 - Math.abs(GEN.noise(lon * 0.09 + 20, lat * 0.07));
      gm[k] = GEN.sstep(0.72, 0.95, r) * GEN.sat(0.45 + GEN.fbm(lon * 0.03, lat * 0.03, 3)) * 0.7;
      gi[k] = GEN.sstep(70, 80, Math.abs(lat)) + (lat < -64 ? 1 : 0);
    }
  }
  // mountains of the authored ranges also in the global raster
  gbegin(); GEO.RANGES.forEach(r => { g.beginPath(); r.pts.forEach((p, i) => { const q = gp(GEN.toLL(p[0], p[1])); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.lineWidth = Math.max(1, r.w / 17); const c = Math.round(r.h / 5200 * 255); g.strokeStyle = `rgb(${c},${c},${c})`; g.stroke(); });
  const gmr = ggrab();
  const G0 = new Uint8Array(GW * GH), G2 = new Uint8Array(GW * GH), G3 = new Uint8Array(GW * GH);
  for (let i = 0; i < G0.length; i++) {
    G0[i] = gl[i] * 255;
    G2[i] = Math.max(gmr[i], gm[i] * (gl[i] > 0.5 ? 1 : 0)) * 255;
    G3[i] = Math.min(1, gi[i]) * 255;
  }
  const G1 = boxBlur(G0, GW, GH, 5, 3);
  return {
    main: { W, H, x0: X0, y1: Y1, res: RES, ch },
    glob: { W: GW, H: GH, ch: [boxBlur(G0, GW, GH, 1, 1), G1, boxBlur(G2, GW, GH, 1, 1), boxBlur(G3, GW, GH, 1, 1)] },
    peaks: GEO.PEAKS.map(p => ({ x: p.x, y: p.y, h: p.h, r: p.r, kind: p.kind, gate: p.gate, to: p.to, reach: p.reach })),
    // each range's character from its Earth analogue (src/analogues.js): colour tints for its forests, meadows and
    // rock (hue and saturation from the analogue, brightness kept near the engine's own), and how much bare rock shows
    ranges: (() => {
      const A = self.ANALOGUES || {}, lum = c => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
      const DEF = { forest: [40, 60, 35], meadow: [126, 118, 92], rock: [124, 114, 104] };
      const mean = k => { const v = Object.values(A).map(a => a[k]).filter(Boolean); return v.length ? v.reduce((s, c) => s + lum(c), 0) / v.length : 1; };
      const M = { forest: mean('forest'), meadow: mean('meadow'), rock: mean('rock') };
      const tint = (k, c) => { if (!c) return [1, 1, 1]; const d = DEF[k], b = Math.pow(lum(c) / M[k], 0.5);
        return d.map((dv, i) => Math.max(0.55, Math.min(1.7, (c[i] / lum(c)) / (dv / lum(d)) * b))); };
      return GEO.RANGES.filter(r => A[r.name]).map(r => { const a = A[r.name], xs = r.pts.map(p => p[0]), ys = r.pts.map(p => p[1]), reach = r.w * 0.9 + 6;
        return { pts: r.pts, reach, bb: [Math.min(...xs) - reach, Math.min(...ys) - reach, Math.max(...xs) + reach, Math.max(...ys) + reach],
          f: tint('forest', a.forest), m: tint('meadow', a.meadow), k: tint('rock', a.rock), bare: a.shares ? a.shares.bare : 0 }; });
    })(),
    flats: GEO.PLACES.filter(p => p[7] && p[7].r >= 0.3 && p[7].culture !== 'minastirith').map(p => ({ x: p[2], y: p[3], r: p[7].r * 1.6 + 0.3, lift: p[7].culture === 'hobbit' ? 30 : 20, sea: p[1] === 'port' ? 1 : 0 })),
    numenor: GEO.NUMENOR,
    vectors: {
      rivers: GEO.RIVERS.map(r => ({ name: r.name, pts: r.pts, w0: r.w0, w1: r.w1 })),
      roads: GEO.ROADS.map(r => ({ name: r.name, pts: r.pts, cls: r.cls })),
      lakes: GEO.LAKES.map(l => ({ pts: l.pts })),
      walls: GEO.WALLS.map(w => ({ name: w.name, pts: w.pts, circle: w.circle })),
      settlements: GEO.PLACES.filter(p => p[7] && p[7].culture && p[7].r).map(p => ({ name: p[0], x: p[2], y: p[3], r: p[7].r, culture: p[7].culture, gate: p[7].gate, feature: p[7].feature, havens: p[7].havens })),
    },
  };
}
return { build };
})();
