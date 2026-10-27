// Page-side half of the render gate (tools/qa/qa_render.py): measures what the renderer actually draws, with GEN in
// the loaded page. Returns a report object; nothing here changes the page.
(() => {
  const E = (X, Y, pix) => { const h = GEN.evaluate(X, Y, pix); return { h, s: GEN.R.s }; };
  const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0; return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]); };
  const lineDist = (p, pts) => { let d = Infinity; for (let i = 1; i < pts.length; i++) d = Math.min(d, segDist(p, pts[i - 1], pts[i])); return d; };
  const resample = (pts, step) => { const out = [pts[0].slice()]; let carry = 0;
    for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); let t = step - carry;
      while (t <= L) { out.push([a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L]); t += step; } carry = L - (t - step); }
    return out; };
  const winding = (p, ring) => { let w = 0; for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length];
    if (a[1] <= p[1]) { if (b[1] > p[1] && (b[0] - a[0]) * (p[1] - a[1]) - (p[0] - a[0]) * (b[1] - a[1]) > 0) w++; }
    else if (b[1] <= p[1] && (b[0] - a[0]) * (p[1] - a[1]) - (p[0] - a[0]) * (b[1] - a[1]) < 0) w--; } return w; };
  const SH = self.SHORES, ISL = GEO.ISLANDS.map(i => i.pts).concat(SH.islands), SEAS = SH.seas;
  const bbox = r => { let a = [1e9, 1e9, -1e9, -1e9]; for (const p of r) { a[0] = Math.min(a[0], p[0]); a[1] = Math.min(a[1], p[1]); a[2] = Math.max(a[2], p[0]); a[3] = Math.max(a[3], p[1]); } return a; };
  const IB = ISL.map(bbox), SB = SEAS.map(bbox), inb = (p, b) => p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3];
  const vecLand = p => (winding(p, SH.coast) !== 0 || ISL.some((r, i) => inb(p, IB[i]) && winding(p, r) !== 0)) && !SEAS.some((r, i) => inb(p, SB[i]) && winding(p, r) !== 0);
  const inLake = (X, Y) => { GEN.evaluate(X, Y, 0.25); return GEN.F[15] > 0.3; };
  const authored = {}; GEO.RIVERS.forEach(r => authored[r.name] = authored[r.name] ? authored[r.name].concat([r.pts]) : [r.pts]);
  const rep = { rivers: [], places: [], coast: [] };
  // drawn river points on a half-mile grid: a bank sample in another river's valley is not this river's bank
  const DR = GEN.drawnRivers(), RG = new Map();
  DR.forEach((r, ri) => resample(r.pts, 0.2).forEach(p => { const k = Math.round(p[0] * 2) + ',' + Math.round(p[1] * 2); if (!RG.has(k)) RG.set(k, new Set()); RG.get(k).add(ri); }));
  // (within 2 mi of another river: that is the other river's valley side, not this river's bank)
  const inOtherRiver = (p, ri) => { for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) { const s = RG.get((Math.round(p[0] * 2) + dx) + ',' + (Math.round(p[1] * 2) + dy)); if (s) for (const o of s) if (o !== ri && DR[o].name !== DR[ri].name) return true; } return false; };

  // rivers as drawn: over sea, astray from their authored line, climbing, or running above their banks
  DR.forEach((r, ri) => {
    const P = resample(r.pts, 0.25), A = authored[r.name] || [];
    let run = 0, sea = 0, seaAt = null, stray = 0, strayAt = null;
    const hs = P.map(p => { const e = E(p[0], p[1], 0.25); return e; });
    const tail = P.length - 3;                                                      // the last 0.75 mi meets the sea
    P.forEach((p, k) => {
      if (hs[k].s < 0 && k < tail) { run += 0.25; if (run > sea) { sea = run; seaAt = p; } } else run = 0;
      if (k % 4 === 0) { const d = Math.min(...A.map(a => lineDist(p, a))); if (d > stray) { stray = d; strayAt = p; } }
    });
    // rise: from each point, nothing within the next mile downstream may stand more than 5 m higher
    let rise = 0, riseAt = null, nr = 0;
    const lake = P.map((p, k) => k % 1 === 0 && inLake(p[0], p[1]));                 // a lake's bed is not its river
    for (let k = 0; k < P.length; k++) { if (hs[k].s < 0 || lake[k]) continue;
      for (let j = k + 1; j <= Math.min(P.length - 1, k + 4); j++) { if (hs[j].s < 0 || lake[j]) break; const d = hs[j].h - hs[k].h; if (d > rise) { rise = d; riseAt = P[k]; } if (d > 5) { nr++; break; } } }
    // valley floor: every mile, the river may stand no more than 5 m above the lower bank at 1, 1.5 and 2 mi
    let vf = 0, vfAt = null, nv = 0, nt = 0;
    for (let k = 2; k < P.length - 2; k += 4) { if (hs[k].s < 0 || inLake(P[k][0], P[k][1])) continue;
      const a = P[k - 2], b = P[k + 2], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L; nt++;
      let worst = -Infinity;
      for (const d of [1, 1.5, 2]) { const l = E(P[k][0] + nx * d, P[k][1] + ny * d, 0.25), q = E(P[k][0] - nx * d, P[k][1] - ny * d, 0.25);
        const pl = [P[k][0] + nx * d, P[k][1] + ny * d], pq = [P[k][0] - nx * d, P[k][1] - ny * d];
        const low = Math.min(l.s > 0 && !inOtherRiver(pl, ri) ? l.h : Infinity, q.s > 0 && !inOtherRiver(pq, ri) ? q.h : Infinity); if (low < Infinity) worst = Math.max(worst, hs[k].h - low); }
      if (worst > 5) { nv++; if (worst > vf) { vf = worst; vfAt = P[k]; } } }
    rep.rivers.push({ name: r.name, len: +(P.length * 0.25).toFixed(1), sea: +sea.toFixed(2), seaAt, stray: +stray.toFixed(2), strayAt,
      rise: +rise.toFixed(0), riseAt, risePts: nr, vfMax: +vf.toFixed(0), vfAt, vfBad: nv, vfOf: nt });
  });
  // every place stands on rendered land (havens and ports included: their pins hold the shore)
  for (const p of GEO.PLACES) { const e = E(p[2], p[3], 0.1); if (e.s <= 0 || e.h <= 0) rep.places.push({ name: p[0], at: [p[2], p[3]], s: +e.s.toFixed(3), h: +e.h.toFixed(0) }); }
  // the rendered coast against the vector coast, region by region, on a one-mile grid
  const REG = { Umbar: [300, -1230, 500, -1080], Belfalas: [380, -800, 620, -680], Lindon: [-340, -90, -110, 210], Eriador: [-160, -470, 110, -180], Forochel: [-200, 380, 260, 620] };
  for (const [name, b] of Object.entries(REG)) { let n = 0, bad = 0, s2l = 0, l2s = 0;
    for (let y = b[1]; y <= b[3]; y += 1) for (let x = b[0]; x <= b[2]; x += 1) { const v = vecLand([x, y]), r = E(x, y, 0.5).s > 0; n++; if (v !== r) { bad++; v ? l2s++ : s2l++; } }
    rep.coast.push({ name, pct: +(100 * bad / n).toFixed(2), seaDrawnAsLand: s2l, landDrawnAsSea: l2s }); }
  // passes and walls: each named pass is a notch, at most 75% of the crest around it (12-24 mi off); the walls of
  // Mordor stand at least 1,200 m along their whole spine, save at their passes
  const PASSES = [['High Pass', 485.2, 2.1, 7], ['Redhorn Gate', 418, -164, 6], ['Cirith Gorgor', 761.9, -477.6, 8], ['Isenmouthe', 808.8, -490.5, 6], ['Cirith Ungol', 783.5, -584.8, 5], ['Morgul pass', 781, -597, 5]];
  rep.passes = PASSES.map(([name, x, y]) => {
    let lo = E(x, y, 0.25).h;
    let crest = 0; for (let a = 0; a < 48; a++) for (const r of [12, 16, 20, 24]) crest = Math.max(crest, E(x + r * Math.cos(a / 48 * 6.283), y + r * Math.sin(a / 48 * 6.283), 0.25).h);
    return { name, pass: Math.round(lo), crest: Math.round(crest), ok: lo <= 0.75 * crest };
  });
  rep.walls = GEO.RANGES.filter(r => /^Ephel Dúath$|^Ered Lithui$/.test(r.name)).map(r => {
    let low = Infinity, at = null, n = 0;
    // the fence about Gorgoroth, Udûn and Nurn: the last 120 miles of each range fade into the unmapped east and south
    const sp = resample(r.pts, 5), keep = sp.slice(0, Math.max(1, sp.length - 24));
    for (const p of keep) { if (PASSES.some(q => Math.hypot(p[0] - q[1], p[1] - q[2]) < q[3] + 3)) continue; n++;
      let m = 0; for (let dx = -6; dx <= 6; dx += 1.5) for (let dy = -6; dy <= 6; dy += 1.5) m = Math.max(m, E(p[0] + dx, p[1] + dy, 0.25).h);   // the crest wanders off the line
      if (m < low) { low = m; at = p; } }
    return { name: r.name, lowest: Math.round(low), at, samples: n, ok: low >= 1200 };
  });
  return rep;
})()
