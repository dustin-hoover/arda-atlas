// Geography gate: rivers, river mouths and coastal places checked against the land the renderer draws
// (src/shores.js coast + islands - inland seas, filled with the nonzero rule as the canvas does).
// Fails if a river runs over sea for more than 0.75 mi, a mouth or anchored coastal place is more than 1 mi
// from the shore, the coast polygon crosses itself, or the island count changes. Samples every 0.5 mi.
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

// 1. the coast polygon must not cross itself
{
  let n = 0; const C = COAST, L = C.length;
  const cross = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
  const cg = new Map(); for (let i = 0; i < L; i++) { const a = C[i], b = C[(i + 1) % L]; const k = Math.floor((a[0] + b[0]) / 2 / CELL) + ',' + Math.floor((a[1] + b[1]) / 2 / CELL); if (!cg.has(k)) cg.set(k, []); cg.get(k).push(i); }
  for (let i = 0; i < L; i++) { const a = C[i], b = C[(i + 1) % L], cx = Math.floor((a[0] + b[0]) / 2 / CELL), cy = Math.floor((a[1] + b[1]) / 2 / CELL);
    for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++) for (const j of cg.get(x + ',' + y) || []) {
      if (j <= i + 1 || (i === 0 && j === L - 1)) continue;
      if (cross(a, b, C[j], C[(j + 1) % L])) { n++; if (VERBOSE) say(`  coast crosses itself near ${a.map(v => v.toFixed(1))}`); } } }
  n ? fail(`coast polygon crosses itself ${n} times`) : say('ok   coast polygon is simple');
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
// 5. one label per name on a delta: distributaries share a name but only one carries the label
{ const n = GEO.RIVERS.filter(r => r.name === 'Ethir Anduin' && !r.nolabel).length; n > 1 ? fail(`"Ethir Anduin" labelled ${n} times`) : say('ok   one "Ethir Anduin" label'); }

say(fails.length ? `\n${fails.length} geography check(s) failed` : '\ngeography ok');
process.exit(fails.length ? 1 : 0);
