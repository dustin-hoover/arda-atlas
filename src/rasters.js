/* Rasterises the authored geography into the field rasters used by GEN. */
const RASTERS = (() => {
const RES = 4, X0 = -2300, X1 = 3800, Y0 = -3200, Y1 = 1900;
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

/* ---------- mountain ranges as orogens ----------
   A range is not a ribbon of even width. Each is shaped by the story of how it rose (docs/RANGES.md, Geology):
   collision ranges have a steep inner side and a broad foreland of foothills and folded parallel ridges; old worn
   ranges are lower and rounder; high massifs alternate with low passes along the crest; width swells and pinches;
   the crest wanders off the drawn line; spurs run out between valleys so the outline is ragged, not smooth; free
   ends die away into foothills while ends that meet another range stay high (Gundabad, the Morannon corner).
   verge: which side of the drawn line is the foreland (+1 left of the drawing direction, -1 right);
   asym: how much broader the foreland side is; folds: parallel ridges on the foreland; spurs: lateral ridges;
   worn: rounded, eroded; inner: a lower parallel ridge on the inner side (the Morgai). */
const GEOLOGY = {
  'Hithaeglir':                     { verge: -1, asym: 0.45, folds: 0.35, spurs: 0.9, worn: 0 },     // west: the Ettenmoors, Trollshaws, Hollin
  'Ered Mithrin':                   { verge: -1, asym: 0.35, folds: 0.3, spurs: 0.7, worn: 0.1 },    // south: the dwarf-halls side
  'Ered Luin':                      { verge: 1, asym: 0.4, folds: 0.15, spurs: 0.6, worn: 0.6 },     // east to Eriador; sheer to the sea
  'Ered Nimrais':                   { verge: -1, asym: 0.55, folds: 0.2, spurs: 1, worn: 0 },        // long southern spurs between the rivers of Gondor
  'Ered Nimrais (Mindolluin spur)': { verge: -1, asym: 0.2, folds: 0, spurs: 0.4, worn: 0 },
  'Ephel Dúath':                    { verge: -1, asym: 0.5, folds: 0.25, spurs: 0.6, worn: 0, inner: 1 },   // Ithilien slopes; cliffs and the Morgai within
  'Ered Lithui':                    { verge: 1, asym: 0.35, folds: 0.2, spurs: 0.5, worn: 0.1 },     // north to the Dagorlad; sheer over Lithlad
  'Mountains of Angmar':            { verge: -1, asym: 0.3, folds: 0.2, spurs: 0.6, worn: 0.4 },
  'Iron Hills':                     { verge: -1, asym: 0.1, folds: 0, spurs: 0.5, worn: 0.8 },
  'Mountains of Mirkwood':          { verge: 1, asym: 0.1, folds: 0, spurs: 0.4, worn: 0.9 },
  'Orocarni':                       { verge: -1, asym: 0.5, folds: 0.6, spurs: 0.8, worn: 0 },       // Tian Shan-like: parallel ranges toward Rhûn
  'Ered Gorgoroth of the East':     { verge: -1, asym: 0.3, folds: 0.3, spurs: 0.6, worn: 0.2 },
  'Mountains of Harad':             { verge: 1, asym: 0.4, folds: 0.8, spurs: 0.5, worn: 0.1 },      // Atlas-like folds
  'Mountains of Far Harad':         { verge: -1, asym: 0.4, folds: 0.5, spurs: 0.7, worn: 0 },
  'Yellow Mountains':               { verge: 1, asym: 0.45, folds: 0.9, spurs: 0.4, worn: 0.2 },     // Zagros-like folds
  'Northern Heights':               { verge: -1, asym: 0.2, folds: 0.2, spurs: 0.5, worn: 0.7 },
};
// branch ridges: secondary ranges leaving the main crest at an angle, mostly on the foreland side, so that from above
// a range reads as a branching tree of ridges and not a tube
function branches(RANGES, seed0 = 0) {
  const out = [];
  RANGES.forEach((r, ri0) => {
    const ri = ri0 + seed0;
    const g = r.geo || GEOLOGY[r.name] || { verge: 1, worn: 0.2 };
    if (r.w < 14 || r.sub === 2) return;
    const P = r.pts, S = [0];
    for (let i = 1; i < P.length; i++) S.push(S[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const Lt = S[S.length - 1];
    let k = 1, n = 0;
    for (let s = r.w * (0.8 + GEN.hash2(ri, 0, 3)); s < Lt - r.w * 0.6; s += r.w * (1.2 + 1.1 * GEN.hash2(ri, n, 5)), n++) {
      if (s / Lt < 0.08 || s / Lt > 0.92 || GEN.hash2(ri, n, 7) > 0.8) continue;
      while (k < P.length - 1 && S[k] < s) k++;
      const a = P[k - 1], b = P[k], t = (s - S[k - 1]) / ((S[k] - S[k - 1]) || 1);
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      const tx = (b[0] - a[0]), ty = (b[1] - a[1]), tl = Math.hypot(tx, ty) || 1;
      const side = GEN.hash2(ri, n, 11) < 0.72 ? g.verge : -g.verge;             // most branches run out on the foreland
      const nx = -ty / tl * side, ny = tx / tl * side;                          // outward normal (+1 = left)
      const ang = (0.5 + 0.45 * GEN.hash2(ri, n, 13)) * Math.PI / 2, fw = GEN.hash2(ri, n, 17) < 0.5 ? 1 : -1;
      const dx = nx * Math.sin(ang) + tx / tl * Math.cos(ang) * fw, dy = ny * Math.sin(ang) + ty / tl * Math.cos(ang) * fw;
      const L = r.w * (1.6 + 2.2 * GEN.hash2(ri, n, 19)) * (side === g.verge ? 1 : 0.6) * (r.sub ? 0.55 : 1), bend = (GEN.hash2(ri, n, 23) - 0.5) * 0.7;
      const mx = x + dx * L * 0.5 - dy * L * bend * 0.3, my = y + dy * L * 0.5 + dx * L * bend * 0.3;
      const ex = x + dx * L - dy * L * bend * 0.5, ey = y + dy * L + dx * L * bend * 0.5;
      out.push({ name: r.name + ' branch', pts: [[x, y], [mx, my], [ex, ey]], w: r.w * (0.45 + 0.25 * GEN.hash2(ri, n, 29)), h: r.h * (0.6 + 0.3 * GEN.hash2(ri, n, 31)),
        geo: { verge: side, asym: 0.2, folds: 0, spurs: 0.6, worn: g.worn }, root: 1, sub: r.sub ? 2 : 1 });
    }
  });
  return out;
}
function rangeField(RANGES0, rmask) {
  const out = new Float32Array(W * H);
  const B1 = branches(RANGES0), B2 = branches(B1, 100);              // branches, and their own side branches
  const RANGES = RANGES0.concat(B1, B2);
  const sst = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const n1 = (x, k) => GEN.noise(x, k);
  const ends = RANGES.map(r => [r.pts[0], r.pts[r.pts.length - 1]]);
  // an end that meets another range, or faces another part of the same range across a gap (the Ered Luin, cut by the
  // Gulf of Lhûn), stays high instead of dying away into foothills
  const nearOther = (p, self) => RANGES.some((o, j) => j !== self && o.pts.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < (o.name === RANGES[self].name ? 70 : 30)));
  RANGES.forEach((r, ri) => {
    const g = r.geo || GEOLOGY[r.name] || { verge: 1, asym: 0.3, folds: 0.3, spurs: 0.6, worn: 0.2 };
    const P = r.pts, S = [0];
    for (let i = 1; i < P.length; i++) S.push(S[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const Lt = S[S.length - 1], seed = (ri * 7.31 + r.name.length * 1.7) % 50;
    const freeA = !r.root && !nearOther(P[0], ri), freeB = !nearOther(P[P.length - 1], ri);
    const reach = r.w * 2.2 + 10;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of P) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const c0 = Math.max(0, Math.floor((x0 - reach - X0) / RES)), c1 = Math.min(W - 1, Math.ceil((x1 + reach - X0) / RES));
    const r0 = Math.max(0, Math.floor((Y1 - y1 - reach) / RES)), r1 = Math.min(H - 1, Math.ceil((Y1 - y0 + reach) / RES));
    for (let j = r0; j <= r1; j++) for (let i = c0; i <= c1; i++) {
      const x = X0 + (i + 0.5) * RES, y = Y1 - (j + 0.5) * RES;
      // nearest point on the drawn line: distance, which side, how far along
      let bd = 1e9, bs = 0, side = 1;
      for (let k = 1; k < P.length; k++) {
        const ax = P[k - 1][0], ay = P[k - 1][1], bx = P[k][0], by = P[k][1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
        const d = Math.hypot(x - ax - t * dx, y - ay - t * dy);
        if (d < bd) { bd = d; bs = S[k - 1] + t * Math.sqrt(l2); side = dx * (y - ay) - dy * (x - ax) >= 0 ? 1 : -1; }
      }
      if (bd > reach) continue;
      const t = bs / Lt, w = r.w;
      const tp = (freeA ? sst(0, 0.16, t) : 1) * (freeB ? sst(1, 0.84, t) : 1);
      // width swells and pinches along the range; the crest wanders off the line
      const wv = Math.max(0.35, Math.min(2.1, 1 + 0.6 * n1(bs / (w * 2.2) + seed, 1.3) + 0.25 * n1(bs / (w * 0.8) + seed * 2, 4.1)));
      const hw0 = w * 0.62 * wv * (0.4 + 0.6 * tp);
      const dd = side * bd - 0.45 * hw0 * n1(bs / (w * 2.5) + seed * 3, 7.7);   // the crest steps aside, en échelon
      const fore = (dd >= 0 ? 1 : -1) === g.verge;
      const lobe = Math.max(0.35, 1 + 0.55 * GEN.fbm(x / 13 + seed, y / 13 - seed, 4));   // embayments and lobes in the outline
      const hw = hw0 * (fore ? 1 + g.asym : 1 - 0.55 * g.asym) * lobe;
      let u = Math.abs(dd) / hw;
      // spurs: ridges running out from the crest between valleys
      const sp = g.spurs * Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * bs / (w * 1.1) + 2.5 * n1(bs / (w * 2) + seed, 5.5)), 2);
      u /= 1 + 0.45 * sp * sst(0.4, 1, u);
      // a broad uplifted block (the peaks come later, from the terrain noise), falling away at the flanks
      const p0 = sst(1, 0.55, u);
      let p = Math.pow(p0, 1.1 - 0.4 * g.worn);
      // folded parallel ridges on the foreland
      if (fore && g.folds > 0) p *= 1 + g.folds * 0.5 * Math.cos(2 * Math.PI * Math.abs(dd) / (w * 0.3)) * sst(0.15, 0.55, u);
      // massifs and passes along the crest
      let hgt = r.h * (0.6 + 0.4 * Math.max(0, Math.min(1, 0.5 + 0.7 * n1(bs / (w * 1.4) + seed * 5, 2.2))));
      hgt *= 1 - 0.38 * sst(0.45, 0.8, n1(bs / (w * 2.6) + seed * 7, 9.3));
      hgt *= (1 - 0.35 * g.worn) * (0.45 + 0.55 * tp);
      let v = hgt / 5200 * p;
      // an inner, lower parallel ridge (the Morgai within the Ephel Dúath)
      if (g.inner && !fore) { const di = Math.abs(Math.abs(dd) - hw0 * 1.9); v = Math.max(v, r.h / 5200 * 0.42 * sst(hw0 * 0.35, 0, di) * sst(0.08, 0.25, t) * sst(0.95, 0.75, t)); }
      const q = j * W + i;
      if (r.root && rmask) v *= 1 - Math.min(1, rmask[q] / 160);
      if (v > out[q]) out[q] = v;
    }
  });
  const o = new Uint8Array(W * H);
  for (let i = 0; i < o.length; i++) o[i] = Math.min(255, out[i] * 255 + 0.5);
  return o;
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

  // the coast: the books' coast with the unwritten shores reshaped (src/shores.js), its new islands and inland seas
  const SH = self.SHORES, COAST = SH ? SH.coast : GEO.COAST;
  const ISL = GEO.ISLANDS.concat(SH ? SH.islands.map(pts => ({ pts })) : []), SEAS = SH ? SH.seas.map(pts => ({ pts })) : [];
  begin(); polys([{ pts: COAST }].concat(ISL), () => 1);
  const landRaw = grab();
  if (SEAS.length) { begin(); polys(SEAS, () => 1); const sm = grab(); for (let i = 0; i < landRaw.length; i++) if (sm[i] > 127) landRaw[i] = 0; }
  ch[0] = boxBlur(landRaw, W, H, 1, 2);
  ch[1] = boxBlur(landRaw, W, H, 18, 3);
  // rivers cut through the branch ridges (a branch must never dam a river the books run through its valley)
  begin(); lines(GEO.RIVERS, f => (f.rank <= 2 ? 22 : 14) / RES, () => 1); const rmask = boxBlur(grab(), W, H, 2, 2);
  ch[2] = boxBlur(rangeField(GEO.RANGES, rmask), W, H, 1, 2);
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
  // In the unwritten lands (east of Rhûn, the far south, the north) the forests and ice are only rough guesses
  // drawn as polygons: give them the ragged, broken edges real forests and ice fields have.
  {
    const fb = boxBlur(ch[4], W, H, 6, 2), ib = boxBlur(ch[14], W, H, 5, 2);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const x = X0 + (i + 0.5) * RES, y = Y1 - (j + 0.5) * RES, k = j * W + i;
      const unwritten = GEN.sstep(1300, 1700, x) + GEN.sstep(-1250, -1650, y) + GEN.sstep(420, 560, y) + GEN.sstep(220, 300, y) * GEN.sstep(500, 650, x);
      if (unwritten <= 0) continue;
      const u = Math.min(1, unwritten), n = GEN.fbm(x * 0.018 + 3, y * 0.018 - 9, 5), n2 = GEN.fbm(x * 0.05 - 4, y * 0.05 + 2, 3);
      if (fb[k] > 0) { const v = 255 * GEN.sstep(0.42, 0.62, 0.6 * fb[k] / 255 + 0.55 * n + 0.25 * n2) * (fb[k] / 255 > 0.08 ? 1 : 0); ch[4][k] = ch[4][k] * (1 - u) + v * u; }
      if (ib[k] > 0) { const v = 255 * GEN.sstep(0.48, 0.66, 0.55 * ib[k] / 255 + 0.6 * n + 0.3 * n2) * (ib[k] / 255 > 0.1 ? 1 : 0); ch[14][k] = ch[14][k] * (1 - u) + v * u; }   // pack ice and snowfields with leads between
    }
  }

  // ---------- global raster ----------
  const gc = document.createElement('canvas');
  gc.width = GW; gc.height = GH;
  const g = gc.getContext('2d', { willReadFrequently: true });
  const gp = ll => [(ll[0] + 180) / 360 * GW, (90 - ll[1]) / 180 * GH];
  const gbegin = () => { g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, GW, GH); g.globalCompositeOperation = 'lighten'; g.lineCap = 'round'; };
  const ggrab = () => { const d = g.getImageData(0, 0, GW, GH).data; const o = new Float32Array(GW * GH); for (let i = 0; i < o.length; i++) o[i] = d[i * 4] / 255; return o; };
  const mePoly = pts => { g.beginPath(); pts.forEach((p, i) => { const q = gp(GEN.toLL(p[0], p[1])); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.closePath(); };
  const llPoly = pts => { g.beginPath(); pts.forEach((p, i) => { const q = gp(p); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.closePath(); };
  // the Dark Land and the Land of the Sun, where the early cosmology maps put them, shaped from Earth landmasses
  // turned and warped (src/shores.js); a rough outline if that file is missing
  const DARK = [[18, 6], [30, 4], [45, 2], [60, -4], [75, -12], [85, -25], [82, -38], [70, -48], [50, -52], [35, -45], [25, -32], [20, -18], [16, -6]];
  const SUN = [[88, 55], [100, 62], [120, 64], [140, 58], [150, 45], [148, 30], [140, 15], [128, 5], [112, 0], [100, 8], [92, 20], [88, 35]];
  gbegin(); g.fillStyle = '#fff';
  mePoly(COAST); g.fill(); ISL.forEach(i => { mePoly(i.pts); g.fill(); });
  if (SH) Object.values(SH.far).forEach(parts => parts.forEach(pts => { llPoly(pts); g.fill(); }));
  else { llPoly(DARK); g.fill(); llPoly(SUN); g.fill(); }
  g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; SEAS.forEach(sea => { mePoly(sea.pts); g.fill(); });
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
      let l = inME || SH ? gl0[k] : GEN.sat((glb[k] / 255 - 0.5 + 0.38 * GEN.fbm(lon * 0.09 + 2, lat * 0.09 - 7, 5)) * 5);
      const inW = GEN.sstep(-178, -168, lon) * GEN.sstep(-58, -68, lon);
      const inE = GEN.sstep(150, 158, lon) * GEN.sstep(179, 175, lon);
      const wx = lon + 22 * GEN.fbm(lon * 0.02, lat * 0.025 + 4, 4), wy = lat + 16 * GEN.fbm(lon * 0.02 + 8, lat * 0.025, 4);
      const cx = wx * 0.032, cy = wy * 0.04;
      const n = GEN.fbm(cx + 3.1, cy - 1.7, 7) + 0.45 * GEN.fbm(cx * 2.7 + 9, cy * 2.7, 5) - 0.05;
      if (inW > 0 && Math.abs(lat) < 72) l = Math.max(l, GEN.sat((n + 0.08 + 0.12 * inW) * 5) * inW);
      if (inE > 0 && Math.abs(lat) < 60) l = Math.max(l, GEN.sat((n - 0.1) * 5) * inE);
      const darkS = GEN.sstep(-40, -55, lat) * GEN.sstep(-10, 10, lon) * GEN.sstep(95, 85, lon);
      if (darkS > 0) l = Math.max(l, GEN.sat((n + 0.2) * 4) * darkS * 0.0);
      // polar land only in the south (an ice continent), its outline noise in polar coordinates (no streaks at the pole)
      if (lat < -66) { const pr = 90 + lat, np = GEN.fbm(pr * Math.cos(lon * Math.PI / 180) * 0.08 + 7, pr * Math.sin(lon * Math.PI / 180) * 0.08, 5); l = Math.max(l, GEN.sat((np + 0.35 + (-66 - lat) * 0.06) * 5)); }
      gl[k] = l;
      const r = 1 - Math.abs(GEN.noise(lon * 0.09 + 20, lat * 0.07));
      gm[k] = GEN.sstep(0.72, 0.95, r) * GEN.sat(0.45 + GEN.fbm(lon * 0.03, lat * 0.03, 3)) * 0.7;
      // polar ice with a ragged edge (pack ice, leads and bays), not a ring drawn along a parallel
      // (noise taken in polar coordinates, so it does not streak toward the pole)
      const pr = 90 - Math.abs(lat), pxp = pr * Math.cos(lon * Math.PI / 180), pyp = pr * Math.sin(lon * Math.PI / 180);
      const ie = 10 * GEN.fbm(pxp * 0.05 + (lat > 0 ? 3 : 41), pyp * 0.05 - 2, 5);
      gi[k] = GEN.sstep(18, 9, pr - ie) + (lat < -64 ? GEN.sstep(-62, -68, lat - ie * 0.6) : 0);
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
    tex: TEX,
    // river mouths: where each river reaching the sea ends, for sediment plumes in the imagery
    mouths: GEO.RIVERS.filter(r => r.w1 >= 40).map(r => { const p = r.pts[r.pts.length - 1]; return { x: p[0], y: p[1], w: r.w1 }; }),
    vectors: {
      rivers: GEO.RIVERS.map(r => ({ name: r.name, pts: r.pts, w0: r.w0, w1: r.w1 })),
      roads: GEO.ROADS.map(r => ({ name: r.name, pts: r.pts, cls: r.cls })),
      lakes: GEO.LAKES.map(l => ({ pts: l.pts })),
      walls: GEO.WALLS.map(w => ({ name: w.name, pts: w.pts, circle: w.circle })),
      settlements: GEO.PLACES.filter(p => p[7] && p[7].culture && p[7].r).map(p => ({ name: p[0], x: p[2], y: p[3], r: p[7].r, culture: p[7].culture, gate: p[7].gate, feature: p[7].feature, havens: p[7].havens })),
    },
  };
}
/* Land-cover texture patches (src/textures.js): one WebP atlas, decoded once here and handed to every worker as raw
   RGB. Each class has a fine patch (detail at the source's resolution) and a coarse one (its pattern at middle zoom). */
let TEX = null;
async function loadTextures() {
  const T = self.TEXTURES;
  if (!T || TEX) return TEX;
  try {
    const bin = atob(T.webp), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const bmp = await createImageBitmap(new Blob([u8], { type: 'image/webp' }));
    const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
    const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(bmp, 0, 0);
    const px = ctx.getImageData(0, 0, bmp.width, bmp.height).data, N = T.atlas.cell, per = T.atlas.per_row;
    const cell = k => { const out = new Uint8Array(N * N * 3), cx = (k % per) * N, cy = Math.floor(k / per) * N;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const s = ((cy + j) * bmp.width + cx + i) * 4, d = (j * N + i) * 3; out[d] = px[s]; out[d + 1] = px[s + 1]; out[d + 2] = px[s + 2]; }
      return out; };
    TEX = { N, water: T.water, cls: T.classes.map((c, k) => ({ name: c.name, tf: c.fine, tc: c.coarse, mean: c.mean, fine: cell(2 * k), coarse: cell(2 * k + 1) })) };
  } catch (e) { console.warn('textures unavailable', e); TEX = null; }
  return TEX;
}
return { build, loadTextures };
})();
