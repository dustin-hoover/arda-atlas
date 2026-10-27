// Geography gate: rivers, river mouths and coastal places checked against the land the renderer draws
// (src/shores.js coast + islands - inland seas, filled with the nonzero rule as the canvas does).
// Fails if a river runs over sea for more than 0.75 mi, a mouth or anchored coastal place is more than 1 mi
// from the shore, any ring crosses itself or another, the island count changes, a river port is off its river, or
// a river ends nowhere. Samples every 0.5 mi. What the renderer draws is checked by tools/qa/qa_render.py.
// Run: node tools/qa/qa_geo.js [--verbose]
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
global.self = global;
for (const f of ['gen.js', 'geo.js', 'shores.js']) eval(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8') + `;global.GEO = typeof GEO !== 'undefined' ? GEO : global.GEO; global.SHORES = typeof SHORES !== 'undefined' ? SHORES : global.SHORES;`);
const VERBOSE = process.argv.includes('--verbose');
const ISLANDS = 110 + GEO.ISLANDS.length;             // update deliberately when an island is added or removed (110: Oct 20 rebuild, river gulfs filled)
const STEP = 0.5, OVER_SEA = 0.75, NEAR = 1;
const ANCH = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'continents', 'anchors.json'), 'utf8'));

const COAST = SHORES.coast, ISL = GEO.ISLANDS.map(i => i.pts).concat(SHORES.islands), SEAS = SHORES.seas;
const rings = [COAST, ...ISL, ...SEAS];
// segment grid for fast distance and winding queries
const CELL = 20, grid = new Map(), segs = [];
for (const r of rings) for (let i = 0; i < r.length; i++) {
  const a = r[i], b = r[(i + 1) % r.length], s = segs.length; segs.push([a, b]);
  const x0 = Math.floor(Math.min(a[0], b[0]) / CELL), x1 = Math.floor(Math.max(a[0], b[0]) / CELL), y0 = Math.floor(Math.min(a[1], b[1]) / CELL), y1 = Math.floor(Math.max(a[1], b[1]) / CELL);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const k = x + ',' + y; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(s); }
}
const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0; return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]); };
function shoreDist(p) {
  const cx = Math.floor(p[0] / CELL), cy = Math.floor(p[1] / CELL);
  let best = Infinity;
  for (let r = 0; r < 200; r++) {
    for (let x = cx - r; x <= cx + r; x++) for (let y = cy - r; y <= cy + r; y++) {
      if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r) continue;
      for (const s of grid.get(x + ',' + y) || []) best = Math.min(best, segDist(p, segs[s][0], segs[s][1]));
    }
    if (best <= r * CELL) return best;
  }
  return Infinity;
}
const winding = (p, ring) => { let w = 0; for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length];
  if (a[1] <= p[1]) { if (b[1] > p[1] && (b[0] - a[0]) * (p[1] - a[1]) - (p[0] - a[0]) * (b[1] - a[1]) > 0) w++; }
  else if (b[1] <= p[1] && (b[0] - a[0]) * (p[1] - a[1]) - (p[0] - a[0]) * (b[1] - a[1]) < 0) w--; } return w; };
const isLand = p => (winding(p, COAST) !== 0 || ISL.some(r => winding(p, r) !== 0)) && !SEAS.some(r => winding(p, r) !== 0);

const fails = [], say = s => console.log(s), fail = s => { fails.push(s); say('FAIL ' + s); };

// 1. no ring (coast, islands, inland seas) may cross itself or another ring. Every pair of segments whose bounding
//    boxes share a 5-mile cell is tested, so no crossing can be missed (each segment is entered in every cell its box
//    touches, not only the cell of its midpoint).
{
  const C5 = 5, cg = new Map(), all = [];
  rings.forEach((r, ri) => { for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length], s = all.length; all.push([a, b, ri, i, r.length]);
    const x0 = Math.floor(Math.min(a[0], b[0]) / C5), x1 = Math.floor(Math.max(a[0], b[0]) / C5), y0 = Math.floor(Math.min(a[1], b[1]) / C5), y1 = Math.floor(Math.max(a[1], b[1]) / C5);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const k = x * 100003 + y; if (!cg.has(k)) cg.set(k, []); cg.get(k).push(s); } } });
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  const cross = (a, b, c, d) => o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
  const seen = new Set(); let self = 0, other = 0;
  for (const list of cg.values()) for (let u = 0; u < list.length; u++) for (let v = u + 1; v < list.length; v++) {
    const S = all[list[u]], T = all[list[v]];
    if (S[2] === T[2]) { const d = Math.abs(S[3] - T[3]); if (d <= 1 || d === S[4] - 1) continue; }
    const key = list[u] * 1e6 + list[v]; if (seen.has(key)) continue;
    if (cross(S[0], S[1], T[0], T[1])) { seen.add(key); S[2] === T[2] ? self++ : other++;
      if (VERBOSE || seen.size <= 5) say(`  ${S[2] === T[2] ? 'ring ' + S[2] + ' crosses itself' : 'rings ' + S[2] + ' and ' + T[2] + ' cross'} near ${S[0].map(v => v.toFixed(1))}`); }
  }
  self ? fail(`${self} self-crossing(s) in the coast, island and sea rings`) : say(`ok   all ${rings.length} rings are simple (${all.length} segments, every pair tested)`);
  other ? fail(`${other} crossing(s) between rings`) : say('ok   no two rings cross');
}
// 2. island count
ISL.length === ISLANDS ? say(`ok   ${ISL.length} islands`) : fail(`island count ${ISL.length}, expected ${ISLANDS}`);

// 3. rivers: no stretch over sea longer than 0.75 mi; mouths on the shore
const mouthNames = new Set(ANCH.mouths.map(m => m[0]));
for (const r of GEO.RIVERS) {
  let run = 0, worst = 0, at = null, total = 0;
  for (let i = 1; i < r.pts.length; i++) {
    const a = r.pts[i - 1], b = r.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / STEP));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) {
      const p = [a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n];
      if (!isLand(p)) { run += L / n; total += L / n; if (run > worst) { worst = run; at = p; } } else run = 0;
    }
  }
  if (worst > OVER_SEA) fail(`${r.name}: ${worst.toFixed(1)} mi over sea (${total.toFixed(1)} in all) near ${at.map(v => v.toFixed(0))}`);
  else if (VERBOSE) say(`ok   ${r.name}`);
  if (mouthNames.has(r.name)) { const e = r.pts[r.pts.length - 1], d = shoreDist(e);
    d > NEAR ? fail(`${r.name}: mouth ${d.toFixed(1)} mi from shore (${isLand(e) ? 'inland' : 'at sea'})`) : VERBOSE && say(`ok   ${r.name} mouth ${d.toFixed(2)} mi`); }
}
// 4. coastal places
const coastal = new Set(ANCH.coastal.map(c => c[0]).concat(['Mithlond', 'Forlond', 'Harlond (Lindon)']));
for (const p of GEO.PLACES) if (coastal.has(p[0])) {
  const d = shoreDist([p[2], p[3]]);
  d > NEAR ? fail(`${p[0]}: ${d.toFixed(1)} mi from shore (${isLand([p[2], p[3]]) ? 'inland' : 'at sea'})`) : say(`ok   ${p[0]} ${d.toFixed(2)} mi from shore`);
}
// 6. river ports stand on their river (within 0.75 mi of its line)
{ const coastalP = new Set(ANCH.coastal.map(c => c[0]).concat(['Mithlond', 'Forlond', 'Harlond (Lindon)']));
  for (const p of GEO.PLACES) if (p[1] === 'port' && !coastalP.has(p[0])) {
    let d = Infinity; for (const r of GEO.RIVERS) for (let i = 1; i < r.pts.length; i++) d = Math.min(d, segDist([p[2], p[3]], r.pts[i - 1], r.pts[i]));
    d > 0.75 ? fail(`${p[0]}: river port ${d.toFixed(2)} mi from its river`) : say(`ok   ${p[0]} on its river (${d.toFixed(2)} mi)`); } }
// 7. every river ends somewhere: at the shore, in a lake, or in another river
{ let bad = 0;
  for (const r of GEO.RIVERS) { const e = r.pts[r.pts.length - 1];
    let d = shoreDist(e);
    for (const l of GEO.LAKES) for (let i = 0; i < l.pts.length; i++) d = Math.min(d, segDist(e, l.pts[i], l.pts[(i + 1) % l.pts.length]));
    for (const o of GEO.RIVERS) if (o !== r) for (let i = 1; i < o.pts.length; i++) d = Math.min(d, segDist(e, o.pts[i - 1], o.pts[i]));
    if (d > 1) { bad++; fail(`${r.name}: ends ${d.toFixed(1)} mi from any shore, lake or river near ${e.map(v => v.toFixed(1))}`); } }
  if (!bad) say(`ok   all ${GEO.RIVERS.length} rivers end at a shore, a lake or a river`); }
// 5. one label per name on a delta: distributaries share a name but only one carries the label
{ const n = GEO.RIVERS.filter(r => r.name === 'Ethir Anduin' && !r.nolabel).length; n > 1 ? fail(`"Ethir Anduin" labelled ${n} times`) : say('ok   one "Ethir Anduin" label'); }

say(fails.length ? `\n${fails.length} geography check(s) failed` : '\ngeography ok');
process.exit(fails.length ? 1 : 0);
