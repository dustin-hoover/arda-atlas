// Checks the atlas against the source ledger (src/sources.js): every place has an entry, grades agree
// with the refit anchors, and each statement from the texts is measured on the map.
// Run: node tools/sources/audit.js [--md out.md]
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
global.self = global;
for (const f of ['gen.js', 'geo.js', 'routes.js', 'sources.js']) eval(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8') + `;global.GEO = typeof GEO !== 'undefined' ? GEO : global.GEO; global.ROUTES = typeof ROUTES !== 'undefined' ? ROUTES : global.ROUTES; global.SOURCES = typeof SOURCES !== 'undefined' ? SOURCES : global.SOURCES;`);

const doy = (m, d) => 1 + (m - 1) * 30 + (d - 1) + (m >= 7 ? 3 : 0);
const parse = s => { const [y, m, d] = s.split(' ').map(Number), di = Math.floor(d), fr = d - di; return (y - 3018) * 365 + doy(m, di) + (fr || 0.5); };
const P = {}; for (const p of GEO.PLACES) P[p[0]] = { X: p[2], Y: p[3] };
const realm = n => { const r = GEO.REALMS.TA3018.find(r => r.name === n); return [r.pts, ...(r.parts || [])].flat(); };
const route = (story, name) => ROUTES[story] && ROUTES[story][name];
const posAt = (pts, t) => {
  if (t <= pts[0][2]) return pts[0];
  for (let i = 1; i < pts.length; i++) if (pts[i][2] >= t) { const a = pts[i - 1], b = pts[i], f = (t - a[2]) / ((b[2] - a[2]) || 1); return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; }
  return pts[pts.length - 1];
};
const need = n => { if (!P[n]) throw new Error('no place ' + n); return P[n]; };

function measure(t) {
  const [k] = t;
  if (k === 'dist') { const a = need(t[1]), b = need(t[2]); return { got: Math.hypot(a.X - b.X, a.Y - b.Y), want: t[3], tol: t[4] }; }
  if (k === 'south') return { got: need(t[1]).Y - need(t[2]).Y, want: t[3], tol: t[4] };
  if (k === 'east') return { got: need(t[2]).X - need(t[1]).X, want: t[3], tol: t[4] };
  if (k === 'spanX' || k === 'spanY') { const q = realm(t[1]), v = q.map(p => p[k === 'spanX' ? 0 : 1]); return { got: Math.max(...v) - Math.min(...v), want: t[2], tol: t[3] }; }
  if (k === 'spanXto') { const q = realm(t[1]); return { got: need(t[2]).X - Math.min(...q.map(p => p[0])), want: t[3], tol: t[4] }; }
  if (k === 'route') {
    const pts = route(t[1], t[2]), a = parse(t[3]), b = parse(t[4]); let L = 0, prev = posAt(pts, a);
    for (const p of pts) if (p[2] > a && p[2] < b) { L += Math.hypot(p[0] - prev[0], p[1] - prev[1]); prev = p; }
    const e = posAt(pts, b); L += Math.hypot(e[0] - prev[0], e[1] - prev[1]);
    return { got: L, want: t[5], tol: t[6] };
  }
  if (k === 'at') { const q = posAt(route(t[1], t[2]), parse(t[3])), p = need(t[4]); return { got: Math.hypot(q[0] - p.X, q[1] - p.Y), want: 0, tol: t[5], abs: true }; }
  if (k === 'crow') { const q = posAt(route(t[1], t[2]), parse(t[3])), p = need(t[4]); return { got: Math.hypot(q[0] - p.X, q[1] - p.Y), want: t[5], tol: t[6] }; }
  throw new Error('unknown test ' + k);
}

const out = [], say = s => { out.push(s); console.log(s); };
// 1. coverage and grades
const anchors = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/refit/anchors.json'))).pairs.map(p => p[0]));
const fanchors = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/refit/fanchors.json'))).map(p => p[0]));
const L = SOURCES.PLACES, grades = {}, problems = [];
for (const p of GEO.PLACES) {
  const e = L[p[0]];
  if (!e) { problems.push(`no ledger entry: ${p[0]}`); continue; }
  grades[e[0]] = (grades[e[0]] || 0) + 1;
  const want = anchors.has(p[0]) ? 'map' : fanchors.has(p[0]) ? 'atlas' : null;
  if (want && e[0] !== want) problems.push(`${p[0]}: graded ${e[0]} but measured as ${want}`);
  if (!want && (e[0] === 'map' || e[0] === 'atlas')) problems.push(`${p[0]}: graded ${e[0]} but not in the anchor files`);
  for (const r of e[1].split(';').map(s => s.trim().split(' ')[0])) if (!SOURCES.BIB[r]) problems.push(`${p[0]}: unknown source ${r}`);
}
for (const n of Object.keys(L)) if (!P[n]) problems.push(`ledger entry for a place not on the map: ${n}`);
const unchecked = Object.values(L).filter(e => !e[3]).length;
say(`# Source audit\n`);
say(`Places: ${GEO.PLACES.length}. Grades: ${Object.entries(grades).map(([g, n]) => g + ' ' + n).join(', ')}. References checked against the text: ${Object.keys(L).length - unchecked} of ${Object.keys(L).length}.\n`);
if (problems.length) { say('## Ledger problems\n'); problems.forEach(p => say('- ' + p)); say(''); }

// 2. statements
say('## Statements measured on the map\n');
say('| | Statement | Source | Map | Expected |');
say('|---|---|---|---|---|');
let fails = 0;
for (const s of SOURCES.STATEMENTS) {
  let r; try { r = measure(s.test); } catch (e) { say(`| ERR | ${s.claim} | ${s.src} | ${e.message} | |`); fails++; continue; }
  const lim = r.abs ? r.tol : (r.tol < 1 ? Math.max(5, Math.abs(r.want) * r.tol) : r.tol);
  const off = r.got - r.want, ok = Math.abs(off) <= lim;
  const mark = ok ? 'ok' : s.soft ? 'note' : 'OFF';
  if (!ok && !s.soft) fails++;
  const pct = r.want ? ` (${off > 0 ? '+' : ''}${Math.round(off / r.want * 100)}%)` : '';
  say(`| ${mark} | ${s.claim} | ${s.src}${s.conf === 'high' ? '' : ' · ' + s.conf} | ${r.got.toFixed(0)} mi${r.abs ? ' away' : pct} | ${r.abs ? '≤ ' + r.tol : r.want + ' ± ' + Math.round(lim)} mi |`);
}
say(`\n${fails ? fails + ' statement(s) off.' : 'All firm statements hold.'} "note" marks places where Tolkien's own notes disagree with his published map; the map is kept.`);
const md = process.argv.indexOf('--md'); if (md > 0) fs.writeFileSync(process.argv[md + 1], out.join('\n') + '\n');
process.exitCode = problems.length ? 1 : 0;
