// Checks a world package's shape against docs/otherworldly/WORLD_SPEC.md.  Run: node worlds/validate.js got
const path = require('path');
const id = process.argv[2];
if (!id) { console.error('usage: node worlds/validate.js <world id>'); process.exit(2); }
const dir = path.join(__dirname, id), W = require(path.join(dir, 'world.js')), CAL = require(path.join(dir, 'calendar.js'));
const problems = [], warn = [];

for (const k of ['WORLD', 'BIB', 'STORIES', 'PLACES', 'STATEMENTS']) if (!W[k]) problems.push('missing ' + k);
const names = new Set();
for (const p of W.PLACES || []) {
  const [name, kind, X, Y, realm, note, o] = p;
  if (names.has(name)) problems.push('duplicate place ' + name); names.add(name);
  if (!kind || !realm || !note || !o || !o.rank) problems.push('incomplete place ' + name);
  if ((X == null || Y == null) && o && o.grade !== 'todo') problems.push(name + ': no position but not graded todo');
  if (X == null || Y == null) warn.push(name);
}
for (const [k, s] of Object.entries(W.STORIES || {})) {
  try { if (CAL.parse(s.start) >= CAL.parse(s.end)) problems.push('story ' + k + ' ends before it starts'); }
  catch (e) { problems.push('story ' + k + ': ' + e.message); }
}
for (const s of W.STATEMENTS || []) {
  if (!W.BIB[s.src]) problems.push('statement ' + s.id + ': unknown source ' + s.src);
  for (const n of s.test.slice(1)) if (typeof n === 'string' && !names.has(n)) problems.push('statement ' + s.id + ': no place ' + n);
}
// map image ids are built from these: keep them ASCII (MapLibre skips the rest)
for (const k of Object.keys({ ...W.CAST, ...W.SPECIALS })) if (/[^a-z0-9_]/.test(k)) problems.push('non-ASCII or odd sprite id ' + k);

console.log(`${W.WORLD.title}: ${W.PLACES.length} places (${warn.length} awaiting positions), ${Object.keys(W.STORIES).length} stories, ${W.STATEMENTS.length} statements, ${Object.keys(W.CAST).length + Object.keys(W.SPECIALS || {}).length} sprites`);
problems.forEach(p => console.log('PROBLEM ' + p));
process.exitCode = problems.length ? 1 : 0;
