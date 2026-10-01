/* ============================================================================
   ARDA ATLAS — application
   ========================================================================== */
(async function () {
'use strict';
const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const lstep = (t, p) => { $('#lstep').textContent = t; if (p != null) $('#lbar').style.width = p + '%'; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const R5 = v => Math.round(v * 1e5) / 1e5;

if (typeof maplibregl === 'undefined') {
  lstep('The map engine could not be loaded. Check your connection and reload the page.', 0);
  $('#lstep').classList.add('err');
  return;
}

/* ---------------- fonts ---------------- */
lstep('Cutting the letters…', 6);
try {
  await Promise.race([
    Promise.all(['400 16px "IM Fell English"', 'italic 400 16px "IM Fell English"', '400 16px "IM Fell English SC"', '400 16px "Alegreya Sans"', '500 16px "Alegreya Sans"', '700 16px "Alegreya Sans"', '400 12px "IBM Plex Mono"'].map(f => document.fonts.load(f))),
    sleep(2500)]);
} catch (e) { /* fall back to system faces */ }

/* ---------------- rasters ---------------- */
lstep('Raising the Misty Mountains…', 14);
await sleep(30);
const DATA = RASTERS.build(GEO);
GEN.init(DATA);
lstep('Filling the Great Sea…', 38);
await sleep(20);

/* ---------------- worker pool ---------------- */
const SRC = $('#src-gen').textContent + '\n' + $('#src-wx').textContent + '\n' + $('#src-worker').textContent;
const WURL = URL.createObjectURL(new Blob([SRC], { type: 'text/javascript' }));
const NW = Math.max(2, Math.min(6, (navigator.hardwareConcurrency || 4) - 1));
function makeWorker() {
  const w = new Worker(WURL);
  w.busy = 0; w.cbs = new Map();
  w.onmessage = e => { const d = e.data; const cb = w.cbs.get(d.id); if (!cb) return; w.cbs.delete(d.id); w.busy--; d.error ? cb.rej(new Error(d.error)) : cb.res(d); pump(); };
  w.onerror = e => console.error('worker error', e.message);
  return w;
}
let SEQ = 1;
function callWorker(w, msg, transfer) {
  return new Promise((res, rej) => { const id = SEQ++; msg.id = id; w.busy++; w.cbs.set(id, { res, rej }); w.postMessage(msg, transfer || []); });
}
const POOL = [];
for (let i = 0; i < NW; i++) POOL.push(makeWorker());
const WXW = makeWorker();
const QUEUE = [];
function pump() {
  while (QUEUE.length) {
    let best = null;
    for (const w of POOL) if (w.busy < 2 && (!best || w.busy < best.busy)) best = w;
    if (!best) return;
    const job = QUEUE.pop();                 // newest first
    if (job.signal && job.signal.aborted) { job.rej(new DOMException('aborted', 'AbortError')); continue; }
    callWorker(best, job.msg).then(job.res, job.rej);
  }
}
function run(msg, signal) {
  return new Promise((res, rej) => {
    const job = { msg, res, rej, signal };
    if (signal) signal.addEventListener('abort', () => { const i = QUEUE.indexOf(job); if (i >= 0) { QUEUE.splice(i, 1); rej(new DOMException('aborted', 'AbortError')); } });
    QUEUE.push(job); pump();
  });
}
lstep('Waking the smiths of Eregion (' + NW + ' workers)…', 46);
await Promise.all(POOL.concat([WXW]).map(w => callWorker(w, { type: 'init', data: DATA })));
window.ARDA_RUN = run;

/* ---------------- geometry helpers ---------------- */
const ll = (X, Y) => { const p = GEN.toLL(X, Y); return [R5(p[0]), R5(p[1])]; };
function densify(pts, step) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]; out.push(a);
    const b = pts[i + 1]; if (!b) break;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.floor(L / step);
    for (let k = 1; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  return out;
}
const circ = c => { const o = []; for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2; o.push([c[0] + Math.cos(a) * c[2], c[1] + Math.sin(a) * c[2]]); } return o; };
const ring = f => { const pts = f.circle ? circ(f.circle) : f.pts.concat([f.pts[0]]); return densify(pts, 12).map(p => ll(p[0], p[1])); };
const lineLL = pts => densify(pts, 8).map(p => ll(p[0], p[1]));
function centroid(pts) { let x = 0, y = 0; pts.forEach(p => { x += p[0]; y += p[1]; }); return [x / pts.length, y / pts.length]; }
function inPoly(x, y, f) {
  if (f.circle) return Math.hypot(x - f.circle[0], y - f.circle[1]) < f.circle[2];
  const p = f.pts; let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c;
  return c;
}
const FC = feats => ({ type: 'FeatureCollection', features: feats });
const pt = (X, Y, props) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: ll(X, Y) }, properties: props });

/* ---------------- gazetteer ---------------- */
const PL = GEO.PLACES.map((p, i) => {
  const o = p[7] || {};
  let type = p[1];
  if (GEO.BEACONS.includes(p[0])) type = 'beacon';
  return { id: i, name: p[0], type, X: p[2], Y: p[3], people: p[4], realm: p[5], desc: p[6], rank: o.rank || 3, pop: o.pop, culture: o.culture, r: o.r };
});
const PLN = Object.fromEntries(PL.map(p => [p.name, p]));
const PEAKN = Object.fromEntries(GEO.PEAKS.map(p => [p.name, p]));
const TYPE_LABEL = { city: 'City', fortress: 'Fortress', town: 'Town', village: 'Village', ruin: 'Ruin', elven: 'Elven realm', dwarven: 'Dwarf-hold', port: 'Haven', tower: 'Tower', bridge: 'Bridge', ford: 'Ford', landmark: 'Landmark', cave: 'Cave', wonder: 'Wonder', beacon: 'Beacon hill', peak: 'Peak', range: 'Mountain range', river: 'River', lake: 'Lake', forest: 'Forest', marsh: 'Marsh', region: 'Region', realm: 'Realm', sea: 'Sea' };
const PEOPLE_LABEL = { hobbit: 'Hobbits', men: 'Men', elves: 'Elves', dwarves: 'Dwarves', dunedain: 'Dúnedain', rohirrim: 'Rohirrim', gondor: 'Men of Gondor', orcs: 'Orcs', haradrim: 'Haradrim', ents: 'Ents', other: '—' };

/* ---------------- icons ---------------- */
function icon(draw, size = 22) {
  const r = 2, c = document.createElement('canvas'); c.width = c.height = size * r;
  const g = c.getContext('2d'); g.scale(r, r); g.lineJoin = 'round'; g.lineCap = 'round';
  draw(g, size);
  return { width: size * r, height: size * r, data: g.getImageData(0, 0, size * r, size * r).data };
}
const ICONS = {
  city: (g, s) => { g.fillStyle = '#f4ecd8'; g.strokeStyle = '#1c150c'; g.lineWidth = 2; g.beginPath(); g.arc(s / 2, s / 2, 6.5, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#1c150c'; g.beginPath(); g.arc(s / 2, s / 2, 2.8, 0, 7); g.fill(); },
  town: (g, s) => { g.fillStyle = '#f4ecd8'; g.strokeStyle = '#1c150c'; g.lineWidth = 2; g.beginPath(); g.arc(s / 2, s / 2, 5, 0, 7); g.fill(); g.stroke(); },
  village: (g, s) => { g.fillStyle = '#e8dcc0'; g.strokeStyle = '#1c150c'; g.lineWidth = 1.6; g.beginPath(); g.arc(s / 2, s / 2, 3.4, 0, 7); g.fill(); g.stroke(); },
  fortress: (g, s) => { const m = s / 2; g.fillStyle = '#e9dfc6'; g.strokeStyle = '#1c150c'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(m - 7, m + 6); g.lineTo(m - 7, m - 4); g.lineTo(m - 4, m - 4); g.lineTo(m - 4, m - 7); g.lineTo(m - 1, m - 7); g.lineTo(m - 1, m - 4); g.lineTo(m + 1, m - 4); g.lineTo(m + 1, m - 7); g.lineTo(m + 4, m - 7); g.lineTo(m + 4, m - 4); g.lineTo(m + 7, m - 4); g.lineTo(m + 7, m + 6); g.closePath(); g.fill(); g.stroke(); },
  ruin: (g, s) => { g.strokeStyle = '#f0e6cc'; g.lineWidth = 3.4; g.setLineDash([2.6, 2.4]); g.beginPath(); g.arc(s / 2, s / 2, 5.5, 0, 7); g.stroke(); g.strokeStyle = '#1c150c'; g.lineWidth = 1.2; g.setLineDash([]); g.beginPath(); g.arc(s / 2, s / 2, 7.2, 0, 7); g.stroke(); },
  elven: (g, s) => { const m = s / 2; g.fillStyle = '#d7ecf2'; g.strokeStyle = '#10222a'; g.lineWidth = 1.5; g.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 3 : 8; g.lineTo(m + Math.cos(a) * r, m + Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke(); },
  dwarven: (g, s) => { const m = s / 2; g.fillStyle = '#e8c89a'; g.strokeStyle = '#1c150c'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(m, m - 8); g.lineTo(m + 8, m + 6); g.lineTo(m - 8, m + 6); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#1c150c'; g.fillRect(m - 2, m, 4, 6); },
  port: (g, s) => { const m = s / 2; g.strokeStyle = '#1c150c'; g.lineWidth = 4; const d = () => { g.beginPath(); g.moveTo(m, m - 7); g.lineTo(m, m + 6); g.moveTo(m - 5, m - 3); g.lineTo(m + 5, m - 3); g.moveTo(m - 7, m + 1); g.quadraticCurveTo(m - 6, m + 7, m, m + 7); g.quadraticCurveTo(m + 6, m + 7, m + 7, m + 1); g.stroke(); }; d(); g.strokeStyle = '#d9eef4'; g.lineWidth = 2; d(); },
  tower: (g, s) => { const m = s / 2; g.fillStyle = '#efe6cf'; g.strokeStyle = '#1c150c'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(m - 3, m + 7); g.lineTo(m - 2, m - 5); g.lineTo(m, m - 8); g.lineTo(m + 2, m - 5); g.lineTo(m + 3, m + 7); g.closePath(); g.fill(); g.stroke(); },
  beacon: (g, s) => { const m = s / 2; g.fillStyle = '#ffb347'; g.strokeStyle = '#2a1405'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(m, m - 8); g.quadraticCurveTo(m + 6, m - 1, m + 3.5, m + 5); g.lineTo(m - 3.5, m + 5); g.quadraticCurveTo(m - 6, m - 1, m, m - 8); g.fill(); g.stroke(); },
  bridge: (g, s) => { const m = s / 2; g.strokeStyle = '#1c150c'; g.lineWidth = 4.4; g.beginPath(); g.moveTo(m - 7, m + 3); g.quadraticCurveTo(m, m - 5, m + 7, m + 3); g.stroke(); g.strokeStyle = '#efe6cf'; g.lineWidth = 2.2; g.stroke(); },
  ford: (g, s) => { const m = s / 2; g.strokeStyle = '#1c150c'; g.lineWidth = 4; g.beginPath(); g.moveTo(m - 6, m - 3); g.lineTo(m + 6, m - 3); g.moveTo(m - 6, m + 3); g.lineTo(m + 6, m + 3); g.stroke(); g.strokeStyle = '#bfe2ee'; g.lineWidth = 2; g.stroke(); },
  landmark: (g, s) => { const m = s / 2; g.fillStyle = '#f4ecd8'; g.strokeStyle = '#1c150c'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(m, m - 6); g.lineTo(m + 6, m); g.lineTo(m, m + 6); g.lineTo(m - 6, m); g.closePath(); g.fill(); g.stroke(); },
  cave: (g, s) => { const m = s / 2; g.fillStyle = '#2a211a'; g.strokeStyle = '#efe6cf'; g.lineWidth = 2; g.beginPath(); g.moveTo(m - 7, m + 6); g.lineTo(m - 7, m); g.arc(m, m, 7, Math.PI, 0); g.lineTo(m + 7, m + 6); g.closePath(); g.fill(); g.stroke(); },
  wonder: (g, s) => { const m = s / 2; g.fillStyle = '#f7d27a'; g.strokeStyle = '#2a1a05'; g.lineWidth = 1.4; g.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 3.4 : 8; g.lineTo(m + Math.cos(a) * r, m + Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke(); },
  peak: (g, s) => { const m = s / 2; g.fillStyle = '#efe4c8'; g.strokeStyle = '#1c150c'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(m, m - 6); g.lineTo(m + 6, m + 5); g.lineTo(m - 6, m + 5); g.closePath(); g.fill(); g.stroke(); },
  volcano: (g, s) => { const m = s / 2; g.fillStyle = '#e0643a'; g.strokeStyle = '#1c0a05'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(m - 2.5, m - 5); g.lineTo(m + 2.5, m - 5); g.lineTo(m + 7, m + 5); g.lineTo(m - 7, m + 5); g.closePath(); g.fill(); g.stroke(); },
  stone: (g, s) => { const m = s / 2; const gr = g.createRadialGradient(m, m, 1, m, m, 9); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, '#b9a6ff'); gr.addColorStop(1, 'rgba(120,100,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(m, m, 9, 0, 7); g.fill(); g.fillStyle = '#20183a'; g.beginPath(); g.arc(m, m, 3.2, 0, 7); g.fill(); },
};

/* ---------------- GeoJSON data ---------------- */
const RANK_MINZ = [0, 3.4, 5.4, 6.8, 8.3, 9.8];
const placeFeats = PL.map(p => pt(p.X, p.Y, { id: p.id, name: p.name, type: p.type, rank: p.rank, big: p.rank === 1 && ['city', 'elven', 'dwarven', 'fortress'].includes(p.type) ? 1 : 0 }));
const peakFeats = GEO.PEAKS.filter(p => p.kind !== 'seamount' && !['The Hill', 'Edoras hill', 'Hill of Guard', 'Bree-hill', 'Carrock', 'Dol Guldur', 'Cerin Amroth'].includes(p.name))
  .map(p => pt(p.x, p.y, { name: p.name, icon: p.kind === 'volcano' ? 'i-volcano' : 'i-peak', minz: p.r > 6 ? 6 : 8 }));
const rangeFeats = GEO.RANGES.filter(r => r.label).map(r => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: lineLL(r.pts) }, properties: { name: r.name.toUpperCase().split('').join(' ') } }));
const riverFeats = GEO.RIVERS.map(r => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: lineLL(r.pts) }, properties: { name: /Rivers of|Southern|Great River of|River of the East|Red River/.test(r.name) ? '' : r.name, rank: r.rank } }));
const lakeFeats = GEO.LAKES.map(l => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring(l)] }, properties: { name: l.name } }));
const forestLabelFeats = GEO.FORESTS.filter(f => !/woods of|forests of|taiga|eastern woods|woods of lindon|Forest of the Beornings/i.test(f.name)).map(f => { const c = centroid(f.pts); return pt(c[0], c[1], { name: f.name, big: f.pts.length > 12 ? 1 : 0 }); });
const marshLabelFeats = GEO.MARSHES.filter(m => !/Southern/.test(m.name)).map(m => { const c = centroid(m.pts); return pt(c[0], c[1], { name: m.name }); });
const regionFeats = GEO.REGION_LABELS.filter(r => r[1] > -5000).map(r => pt(r[1], r[2], { name: r[0].split('').join(r[3] === 'realm' ? ' ' : ' '), cls: r[3], size: r[6], minz: r[4], maxz: r[5] }));
const seaFeats = GEO.SEA_LABELS.map(s => pt(s[1], s[2], { name: s[0], size: s[3], minz: s[4], maxz: s[5] }));
const roadFeats = GEO.ROADS.map(r => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: lineLL(r.pts) }, properties: { name: r.name, cls: r.cls } }));
const wallFeats = GEO.WALLS.map(w => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: (w.circle ? circ(w.circle) : w.pts).map(p => ll(p[0], p[1])) }, properties: { name: w.name } }));
const palPts = GEO.PALANTIRI.stones.map(n => PLN[n] || PLN[n === 'Minas Tirith' ? 'Minas Tirith' : n]).filter(Boolean);
const palFeats = palPts.map(p => pt(p.X, p.Y, { name: 'Palantír of ' + p.name }))
  .concat(GEO.PALANTIRI.links.map(([a, b]) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: lineLL([[PLN[a].X, PLN[a].Y], [PLN[b].X, PLN[b].Y]]) }, properties: { name: a + ' – ' + b } })));
const beaconLine = { type: 'Feature', geometry: { type: 'LineString', coordinates: lineLL([[PLN['Minas Tirith'].X, PLN['Minas Tirith'].Y]].concat(GEO.BEACONS.map(n => [PLN[n].X, PLN[n].Y])).concat([[PLN.Edoras.X, PLN.Edoras.Y]])) }, properties: {} };
function realmFeats(era) { return GEO.REALMS[era].map(r => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring(r)] }, properties: { name: r.name, color: r.color } })); }
function realmLabels(era) { return GEO.REALMS[era].map(r => { const c = r.circle ? r.circle : centroid(r.pts); return pt(c[0], c[1], { name: r.name }); }); }
const adminFeats = GEO.ADMIN.map(a => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring(a)] }, properties: { name: a.name, parent: a.parent } }));
const adminLabels = GEO.ADMIN.map(a => { const c = centroid(a.pts); return pt(c[0], c[1], { name: a.name }); });
const peopleFeats = GEO.PEOPLES.map((p, i) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring(p)] }, properties: { name: p.name, lang: p.lang, color: p.color, pat: 'hatch-' + i } }));
const peopleLabels = GEO.PEOPLES.map(p => { const c = p.circle ? p.circle : centroid(p.pts); return pt(c[0], c[1], { name: p.name, lang: p.lang }); });
function gridFeats() {
  const f = [];
  for (let x = -500; x <= 2900; x += 100) f.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: lineLL([[x, -2700], [x, 900]]) }, properties: { k: x % 500 === 0 ? 1 : 0 } });
  for (let y = -2700; y <= 900; y += 100) f.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: lineLL([[-500, y], [2900, y]]) }, properties: { k: y % 500 === 0 ? 1 : 0 } });
  const lab = [];
  for (let x = -500; x <= 2900; x += 100) for (let y = -2700; y <= 900; y += 100) lab.push(pt(x + 3, y + 3, { name: (x ? Math.abs(x) + (x > 0 ? 'E' : 'W') : '0') + ' ' + (y ? Math.abs(y) + (y > 0 ? 'N' : 'S') : '0'), k: (x % 500 === 0 && y % 500 === 0) ? 1 : 0 }));
  return { lines: FC(f), labels: FC(lab) };
}
const GRID = gridFeats();

/* ---------------- 3D buildings ---------------- */
function buildingFeats() {
  const feats = [];
  const MIm = GEN.MI;
  const quad = (cx, cy, w, d, ang, props) => {
    const c = Math.cos(ang), s = Math.sin(ang), hw = w / 2 / MIm, hd = d / 2 / MIm;
    const P = (lx, ly) => ll(cx + lx * c - ly * s, cy + lx * s + ly * c);
    const r = [P(-hw, -hd), P(hw, -hd), P(hw, hd), P(-hw, hd)]; r.push(r[0]);
    feats.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [r] }, properties: props });
  };
  const seen = new Set();
  for (const p of PL) {
    if (!p.culture || !p.r || p.culture === 'hobbit' || p.culture === 'lorien') continue;
    const B = GEN.buildingsNear(p.X, p.Y, p.r * 1.4);
    for (const b of B.list) {
      const key = b.x.toFixed(5) + b.y.toFixed(5); if (seen.has(key)) continue; seen.add(key);
      const col = `rgb(${Math.round(b.c[0] * 0.92)},${Math.round(b.c[1] * 0.92)},${Math.round(b.c[2] * 0.92)})`;
      quad(b.x, b.y, b.w, b.d, b.a, { h: Math.round(b.h * (b.ruin ? 0.4 : 1)), c: col });
    }
    for (const sp of B.special) {
      const key = 'sp' + sp.x + sp.y + sp.r; if (seen.has(key)) continue; seen.add(key);
      const col = `rgb(${sp.c[0]},${sp.c[1]},${sp.c[2]})`;
      if (sp.type === 'arc') {
        const steps = Math.max(24, Math.round(sp.r * MIm / 10));
        for (let i = 0; i < steps; i++) {
          const a0 = sp.a0 + (sp.a1 - sp.a0) * i / steps, a1 = sp.a0 + (sp.a1 - sp.a0) * (i + 1) / steps, am = (a0 + a1) / 2;
          const len = sp.r * MIm * (a1 - a0) + 1;
          quad(sp.x + Math.cos(am) * sp.r, sp.y + Math.sin(am) * sp.r, sp.w, len, am, { h: sp.h, c: col });
        }
      } else if (sp.type === 'tower') quad(sp.x, sp.y, sp.r * 2, sp.r * 2, 0.3, { h: sp.h, c: col });
    }
  }
  return feats;
}

/* ---------------- map ---------------- */
lstep('Setting the stars in the sky…', 58);
maplibregl.addProtocol('arda', async (params, abort) => {
  const [kind, z, x, y, mode] = params.url.slice(7).split('/');
  const r = await run({ type: kind === 'dem' ? 'dem' : 'img', z: +z, x: +x, y: +y, mode: +mode || 0 }, abort.signal);
  return { data: r.bmp };
});
const TXT_REG = ['IM Fell English SC'], TXT_IT = ['IM Fell English Italic', 'IM Fell English'], TXT_FELL = ['IM Fell English'];
const TXT_UI = ['Alegreya Sans'], TXT_UIB = ['Alegreya Sans Bold', 'Alegreya Sans'], TXT_UIM = ['Alegreya Sans Medium', 'Alegreya Sans'];
const HALO = 'rgba(12,10,6,0.78)';
const src = (id, data) => [id, { type: 'geojson', data }];
const style = {
  version: 8,
  projection: { type: 'globe' },
  sources: Object.fromEntries([
    ['imagery', { type: 'raster', tiles: ['arda://img/{z}/{x}/{y}/0'], tileSize: 256, maxzoom: 16 }],
    ['dem', { type: 'raster-dem', tiles: ['arda://dem/{z}/{x}/{y}'], tileSize: 256, maxzoom: 11, encoding: 'terrarium' }],
    src('places', FC(placeFeats)), src('peaks', FC(peakFeats)), src('ranges', FC(rangeFeats)), src('rivers', FC(riverFeats)), src('lakes', FC(lakeFeats)),
    src('forests', FC(forestLabelFeats)), src('marshes', FC(marshLabelFeats)), src('regions', FC(regionFeats)), src('seas', FC(seaFeats)),
    src('roads', FC(roadFeats)), src('walls', FC(wallFeats)), src('palantiri', FC(palFeats)), src('beacons', FC([beaconLine])),
    src('realms', FC(realmFeats('TA3018'))), src('realm-labels', FC(realmLabels('TA3018'))), src('admin', FC(adminFeats)), src('admin-labels', FC(adminLabels)),
    src('peoples', FC(peopleFeats)), src('people-labels', FC(peopleLabels)), src('grid', GRID.lines), src('grid-labels', GRID.labels),
    src('buildings', FC(buildingFeats())), src('journeys', FC([])), src('journey-pos', FC([])), src('measure', FC([])), src('isobars', FC([])), src('hl', FC([])), src('lights', FC([])),
  ]),
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#0b1a2a' } },
    { id: 'imagery', type: 'raster', source: 'imagery', paint: { 'raster-fade-duration': 180 } },
    { id: 'realms-fill', type: 'fill', source: 'realms', layout: { visibility: 'none' }, paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.2 } },
    { id: 'realms-line', type: 'line', source: 'realms', layout: { visibility: 'none' }, paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1, 8, 2.4], 'line-dasharray': [3, 1.5] } },
    { id: 'peoples-fill', type: 'fill', source: 'peoples', layout: { visibility: 'none' }, paint: { 'fill-pattern': ['get', 'pat'], 'fill-opacity': 0.85 } },
    { id: 'peoples-line', type: 'line', source: 'peoples', layout: { visibility: 'none' }, paint: { 'line-color': ['get', 'color'], 'line-width': 1.2, 'line-opacity': 0.8 } },
    { id: 'admin-line', type: 'line', source: 'admin', layout: { visibility: 'none' }, paint: { 'line-color': '#f2e2b8', 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.6, 10, 1.6], 'line-dasharray': [1, 2], 'line-opacity': 0.8 } },
    { id: 'grid-lines', type: 'line', source: 'grid', layout: { visibility: 'none' }, paint: { 'line-color': '#f0e0b0', 'line-opacity': ['case', ['==', ['get', 'k'], 1], 0.5, 0.22], 'line-width': ['case', ['==', ['get', 'k'], 1], 1.2, 0.6] } },
    { id: 'lights', type: 'circle', source: 'lights', layout: { visibility: 'none' }, paint: { 'circle-color': '#ffcf7a', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, ['*', ['get', 's'], 1.5], 9, ['*', ['get', 's'], 9]], 'circle-blur': 1, 'circle-opacity': ['get', 'glow'] } },
    { id: 'rivers-line', type: 'line', source: 'rivers', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#7fb8cf', 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 3, ['match', ['get', 'rank'], 1, 1.1, 2, 0.7, 0.35], 8, ['match', ['get', 'rank'], 1, 3, 2, 2, 3, 1.3, 0.8], 12, ['match', ['get', 'rank'], 1, 6, 2, 3.5, 3, 2.2, 1.2]], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, ['match', ['get', 'rank'], 1, 0.85, 2, 0.7, 0.35], 7, 0.75, 11.5, 0.45, 13, 0] } },
    { id: 'roads-case', type: 'line', source: 'roads', minzoom: 5, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': 'rgba(30,22,10,0.55)', 'line-width': ['interpolate', ['linear'], ['zoom'], 5, ['match', ['get', 'cls'], 1, 2.6, 2, 1.8, 1.2], 12, ['match', ['get', 'cls'], 1, 6, 2, 4.4, 3]], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 12, 0.6, 14.5, 0] } },
    { id: 'roads-line', type: 'line', source: 'roads', minzoom: 5, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['match', ['get', 'cls'], 1, '#f0d596', 2, '#e3c98e', '#d8c49a'], 'line-width': ['interpolate', ['linear'], ['zoom'], 5, ['match', ['get', 'cls'], 1, 1.2, 2, 0.8, 0.5], 12, ['match', ['get', 'cls'], 1, 3.2, 2, 2.4, 1.4]], 'line-dasharray': ['match', ['get', 'cls'], 3, ['literal', [2, 1.5]], ['literal', [1, 0]]], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.7, 12, 0.85, 14.5, 0] } },
    { id: 'walls', type: 'line', source: 'walls', minzoom: 8, paint: { 'line-color': '#e9e1cf', 'line-width': 1.4, 'line-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 13, 0] } },
    { id: 'buildings-3d', type: 'fill-extrusion', source: 'buildings', minzoom: 12.5, paint: { 'fill-extrusion-color': ['get', 'c'], 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 12.5, 0, 13.3, 0.95] } },
    { id: 'beacons-line', type: 'line', source: 'beacons', layout: { visibility: 'none' }, paint: { 'line-color': '#ffb347', 'line-width': 1.6, 'line-dasharray': [1, 2], 'line-opacity': 0.9 } },
    { id: 'palantiri-line', type: 'line', source: 'palantiri', filter: ['==', ['geometry-type'], 'LineString'], layout: { visibility: 'none' }, paint: { 'line-color': '#b9a6ff', 'line-width': 1.6, 'line-dasharray': [2, 2], 'line-opacity': 0.9 } },
    { id: 'isobars', type: 'line', source: 'isobars', layout: { visibility: 'none' }, paint: { 'line-color': '#e6f2f7', 'line-width': ['case', ['==', ['%', ['get', 'p'], 8], 0], 1.3, 0.7], 'line-opacity': 0.75 } },
    { id: 'journeys-all', type: 'line', source: 'journeys', filter: ['==', ['get', 'part'], 'all'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 1.6, 'line-opacity': 0.45, 'line-dasharray': [1.5, 2] } },
    { id: 'journeys-done', type: 'line', source: 'journeys', filter: ['==', ['get', 'part'], 'done'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2, 10, 4], 'line-opacity': 0.95 } },
    { id: 'measure-line', type: 'line', source: 'measure', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': '#ffd27a', 'line-width': 2.4, 'line-dasharray': [2, 1] } },
    { id: 'measure-pts', type: 'circle', source: 'measure', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 4.5, 'circle-color': '#1a1408', 'circle-stroke-color': '#ffd27a', 'circle-stroke-width': 2 } },
    { id: 'grid-labels', type: 'symbol', source: 'grid-labels', minzoom: 5.5, layout: { visibility: 'none', 'text-field': ['get', 'name'], 'text-font': TXT_UI, 'text-size': 10.5, 'text-anchor': 'bottom-left', 'text-allow-overlap': false }, paint: { 'text-color': '#f3e6c0', 'text-halo-color': HALO, 'text-halo-width': 1, 'text-opacity': 0.8 } },
    { id: 'seas', type: 'symbol', source: 'seas', layout: { 'text-field': ['get', 'name'], 'text-font': TXT_IT, 'text-size': ['interpolate', ['linear'], ['zoom'], 1, ['*', ['get', 'size'], 12], 8, ['*', ['get', 'size'], 22]], 'text-letter-spacing': 0.18, 'text-max-width': 9 }, filter: ['all', ['<=', ['get', 'minz'], 20]], paint: { 'text-color': '#b9dbe8', 'text-halo-color': 'rgba(6,20,34,0.7)', 'text-halo-width': 1.2, 'text-opacity': ['interpolate', ['linear'], ['zoom'], 1, 0.85, 9, 0.7] } },
    { id: 'lakes-label', type: 'symbol', source: 'lakes', minzoom: 6.5, layout: { 'text-field': ['get', 'name'], 'text-font': TXT_IT, 'text-size': 13.5, 'text-letter-spacing': 0.08 }, paint: { 'text-color': '#bfe2ee', 'text-halo-color': 'rgba(6,20,34,0.75)', 'text-halo-width': 1.2 } },
    { id: 'rivers-label', type: 'symbol', source: 'rivers', minzoom: 5.2, filter: ['!=', ['get', 'name'], ''], layout: { 'symbol-placement': 'line', 'symbol-spacing': 380, 'text-field': ['get', 'name'], 'text-font': TXT_IT, 'text-size': ['interpolate', ['linear'], ['zoom'], 5, ['match', ['get', 'rank'], 1, 14, 2, 12.5, 11.5], 11, ['match', ['get', 'rank'], 1, 18, 2, 16, 14]], 'text-letter-spacing': 0.12, 'text-max-angle': 28, 'text-offset': [0, -0.6] }, paint: { 'text-color': '#bfe2ee', 'text-halo-color': 'rgba(6,20,34,0.8)', 'text-halo-width': 1.3 } },
    { id: 'ranges-label', type: 'symbol', source: 'ranges', minzoom: 3.8, layout: { 'symbol-placement': 'line', 'symbol-spacing': 520, 'text-field': ['get', 'name'], 'text-font': TXT_REG, 'text-size': ['interpolate', ['linear'], ['zoom'], 4, 12, 8, 17], 'text-letter-spacing': 0.22, 'text-max-angle': 32, 'text-keep-upright': true }, paint: { 'text-color': '#f1e3c4', 'text-halo-color': 'rgba(24,16,8,0.8)', 'text-halo-width': 1.4 } },
    { id: 'forests-label', type: 'symbol', source: 'forests', minzoom: 5, layout: { 'text-field': ['get', 'name'], 'text-font': TXT_IT, 'text-size': ['interpolate', ['linear'], ['zoom'], 5, ['case', ['==', ['get', 'big'], 1], 15, 12], 10, ['case', ['==', ['get', 'big'], 1], 22, 16]], 'text-letter-spacing': 0.14 }, paint: { 'text-color': '#d4ebb4', 'text-halo-color': 'rgba(10,20,6,0.8)', 'text-halo-width': 1.3 } },
    { id: 'marsh-label', type: 'symbol', source: 'marshes', minzoom: 6.5, layout: { 'text-field': ['get', 'name'], 'text-font': TXT_IT, 'text-size': 12.5, 'text-letter-spacing': 0.1 }, paint: { 'text-color': '#d8e2c0', 'text-halo-color': HALO, 'text-halo-width': 1.2 } },
    { id: 'peaks', type: 'symbol', source: 'peaks', minzoom: 6, layout: { 'icon-image': ['get', 'icon'], 'icon-size': 0.55, 'text-field': ['get', 'name'], 'text-font': TXT_FELL, 'text-size': 13, 'text-offset': [0, 0.9], 'text-anchor': 'top', 'text-optional': true }, paint: { 'text-color': '#f4ead2', 'text-halo-color': HALO, 'text-halo-width': 1.3 } },
    { id: 'admin-label', type: 'symbol', source: 'admin-labels', minzoom: 6.5, layout: { visibility: 'none', 'text-field': ['get', 'name'], 'text-font': TXT_REG, 'text-size': 12.5, 'text-letter-spacing': 0.16 }, paint: { 'text-color': '#f6e7bd', 'text-halo-color': HALO, 'text-halo-width': 1.2 } },
    { id: 'peoples-label', type: 'symbol', source: 'people-labels', minzoom: 3.8, layout: { visibility: 'none', 'text-field': ['format', ['get', 'name'], {}, '\n', {}, ['get', 'lang'], { 'font-scale': 0.78, 'text-font': ['literal', TXT_IT] }], 'text-font': TXT_UIB, 'text-size': 13, 'text-max-width': 12 }, paint: { 'text-color': '#fff6de', 'text-halo-color': HALO, 'text-halo-width': 1.4 } },
    { id: 'realms-label', type: 'symbol', source: 'realm-labels', minzoom: 3, layout: { visibility: 'none', 'text-field': ['get', 'name'], 'text-font': TXT_REG, 'text-size': ['interpolate', ['linear'], ['zoom'], 3, 13, 7, 20], 'text-letter-spacing': 0.2, 'text-max-width': 9 }, paint: { 'text-color': '#fff1cc', 'text-halo-color': HALO, 'text-halo-width': 1.6 } },
    { id: 'regions', type: 'symbol', source: 'regions', layout: { 'text-field': ['get', 'name'], 'text-font': TXT_REG, 'text-size': ['interpolate', ['linear'], ['zoom'], 3, ['*', ['get', 'size'], 12], 8, ['*', ['get', 'size'], 20]], 'text-letter-spacing': 0.35, 'text-max-width': 30, 'symbol-sort-key': ['-', 2, ['get', 'size']] }, filter: ['all'], paint: { 'text-color': ['match', ['get', 'cls'], 'realm', '#fff0c8', '#eadfc4'], 'text-halo-color': 'rgba(18,12,4,0.65)', 'text-halo-width': 1.2, 'text-opacity': 0.9 } },
    { id: 'palantiri-pts', type: 'symbol', source: 'palantiri', filter: ['==', ['geometry-type'], 'Point'], layout: { visibility: 'none', 'icon-image': 'i-stone', 'icon-allow-overlap': true, 'text-field': ['get', 'name'], 'text-font': TXT_IT, 'text-size': 12, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-optional': true }, paint: { 'text-color': '#d9d0ff', 'text-halo-color': HALO, 'text-halo-width': 1.2 } },
    { id: 'hl', type: 'symbol', source: 'hl', layout: { visibility: 'none', 'text-field': ['get', 't'], 'text-font': TXT_UIB, 'text-size': 26, 'text-allow-overlap': true }, paint: { 'text-color': ['match', ['get', 't'], 'L', '#ff8a6a', '#8ecbff'], 'text-halo-color': 'rgba(0,0,0,0.6)', 'text-halo-width': 1.5 } },
    { id: 'isobar-labels', type: 'symbol', source: 'isobars', layout: { visibility: 'none', 'symbol-placement': 'line', 'symbol-spacing': 300, 'text-field': ['to-string', ['get', 'p']], 'text-font': TXT_UI, 'text-size': 11 }, paint: { 'text-color': '#e6f2f7', 'text-halo-color': 'rgba(0,0,0,0.6)', 'text-halo-width': 1.2 } },
  ].concat([1, 2, 3, 4, 5].map(r => ({
    id: 'places-' + r, type: 'symbol', source: 'places', minzoom: RANK_MINZ[r], filter: ['all', ['==', ['get', 'rank'], r], ['!', ['in', ['get', 'type'], ['literal', ['bridge', 'ford', 'beacon']]]]],
    layout: { 'icon-image': ['concat', 'i-', ['get', 'type']], 'icon-size': r === 1 ? 0.8 : r === 2 ? 0.72 : 0.62, 'icon-allow-overlap': r <= 2, 'text-field': ['get', 'name'], 'text-font': r === 1 ? TXT_UIB : r === 2 ? TXT_UIM : TXT_UI, 'text-size': r === 1 ? 16 : r === 2 ? 14.5 : 13, 'text-anchor': 'left', 'text-offset': [0.85, 0], 'text-optional': true, 'symbol-sort-key': r },
    paint: { 'text-color': '#fffaf0', 'text-halo-color': 'rgba(0,0,0,0.78)', 'text-halo-width': 1.4, 'text-halo-blur': 0.3 },
  }))).concat([
    { id: 'places-infra', type: 'symbol', source: 'places', minzoom: 7.5, filter: ['in', ['get', 'type'], ['literal', ['bridge', 'ford']]], layout: { 'icon-image': ['concat', 'i-', ['get', 'type']], 'icon-size': 0.62, 'text-field': ['get', 'name'], 'text-font': TXT_IT, 'text-size': 12.5, 'text-anchor': 'left', 'text-offset': [0.8, 0], 'text-optional': true }, paint: { 'text-color': '#f4ead2', 'text-halo-color': HALO, 'text-halo-width': 1.2 } },
    { id: 'places-beacons', type: 'symbol', source: 'places', filter: ['==', ['get', 'type'], 'beacon'], layout: { visibility: 'none', 'icon-image': 'i-beacon', 'icon-size': 0.7, 'icon-allow-overlap': true, 'text-field': ['get', 'name'], 'text-font': TXT_IT, 'text-size': 12, 'text-offset': [0, 1], 'text-anchor': 'top', 'text-optional': true }, paint: { 'text-color': '#ffd9a0', 'text-halo-color': HALO, 'text-halo-width': 1.2 } },
    { id: 'journeys-pos', type: 'circle', source: 'journey-pos', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 4, 10, 7], 'circle-color': ['get', 'color'], 'circle-stroke-color': '#10141a', 'circle-stroke-width': 2 } },
    { id: 'journeys-pos-label', type: 'symbol', source: 'journey-pos', layout: { 'text-field': ['get', 'name'], 'text-font': TXT_UIB, 'text-size': 12.5, 'text-offset': [0, -1.1], 'text-anchor': 'bottom', 'text-allow-overlap': false, 'text-optional': true }, paint: { 'text-color': ['get', 'color'], 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.5 } },
  ]),
  sky: { 'sky-color': '#7fa7d0', 'horizon-color': '#d6e4ee', 'fog-color': '#c9d6e0', 'horizon-fog-blend': 0.6, 'sky-horizon-blend': 0.6, 'fog-ground-blend': 0.85, 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 8, 0] },
};
// region labels respect their zoom windows
style.layers.find(l => l.id === 'regions').filter = ['all', ['<=', ['get', 'minz'], ['zoom']], ['>=', ['get', 'maxz'], ['zoom']]];
style.layers.find(l => l.id === 'seas').filter = ['all', ['<=', ['get', 'minz'], ['zoom']], ['>=', ['get', 'maxz'], ['zoom']]];
style.layers.find(l => l.id === 'peaks').filter = ['<=', ['get', 'minz'], ['zoom']];

const START = { center: [14, 34], zoom: 1.35, pitch: 0, bearing: 0 };
const map = new maplibregl.Map({
  container: 'map', style, ...START, maxPitch: 85, attributionControl: false, fadeDuration: 180,
  canvasContextAttributes: { antialias: true }, maxTileCacheZoomLevels: 5,
});
window.ARDA_MAP = map;
map.on('styleimagemissing', e => {
  const id = e.id;
  if (id.startsWith('hatch-')) {
    const p = GEO.PEOPLES[+id.slice(6)]; if (!p) return;
    const s = 16, c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d');
    g.strokeStyle = p.color; g.globalAlpha = 0.65; g.lineWidth = 1.6;
    const ang = (+id.slice(6) % 3);
    g.beginPath();
    if (ang === 0) { g.moveTo(0, s); g.lineTo(s, 0); g.moveTo(-s / 2, s / 2); g.lineTo(s / 2, -s / 2); g.moveTo(s / 2, s * 1.5); g.lineTo(s * 1.5, s / 2); }
    else if (ang === 1) { g.moveTo(0, 0); g.lineTo(s, s); g.moveTo(-s / 2, s / 2); g.lineTo(s / 2, s * 1.5); g.moveTo(s / 2, -s / 2); g.lineTo(s * 1.5, s / 2); }
    else { g.moveTo(0, s / 2); g.lineTo(s, s / 2); }
    g.stroke();
    g.globalAlpha = 0.14; g.fillStyle = p.color; g.fillRect(0, 0, s, s);
    map.addImage(id, g.getImageData(0, 0, s, s));
  }
});

let mapLoaded = false;
await new Promise(res => map.on('load', res));
mapLoaded = true;
for (const k in ICONS) if (!map.hasImage('i-' + k)) map.addImage('i-' + k, icon(ICONS[k]), { pixelRatio: 2 });
map.setTerrain({ source: 'dem', exaggeration: 1.35 });
lstep('Kindling the beacons…', 72);

/* ---------------- weather sources ---------------- */
const WXB = { lon0: -32, lon1: 58, lat0: 16, lat1: 70 };
const merc = lat => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
WXB.W = 720; WXB.H = Math.round(WXB.W * (merc(WXB.lat1) - merc(WXB.lat0)) / ((WXB.lon1 - WXB.lon0) * Math.PI / 180));
WXB.GW = 110; WXB.GH = Math.round(WXB.GW * WXB.H / WXB.W);
const wxCorners = [[WXB.lon0, WXB.lat1], [WXB.lon1, WXB.lat1], [WXB.lon1, WXB.lat0], [WXB.lon0, WXB.lat0]];
const gCorners = [[-180, 80], [180, 80], [180, -80], [-180, -80]];
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const CV = { clouds: mkCanvas(WXB.W, WXB.H), radar: mkCanvas(WXB.W, WXB.H), temp: mkCanvas(WXB.W, WXB.H), gclouds: mkCanvas(1024, 512), night: mkCanvas(720, 360) };
// soften the regional cloud canvas edges into the global field
function addCanvasLayer(id, canvas, coords, before, opacity) {
  map.addSource(id, { type: 'canvas', canvas, coordinates: coords, animate: false });
  map.addLayer({ id, type: 'raster', source: id, layout: { visibility: 'none' }, paint: { 'raster-opacity': opacity, 'raster-fade-duration': 0, 'raster-resampling': 'linear' } }, before);
}
addCanvasLayer('wx-temp', CV.temp, wxCorners, 'rivers-line', 0.7);
addCanvasLayer('wx-night', CV.night, gCorners, 'rivers-line', 1);
addCanvasLayer('wx-radar', CV.radar, wxCorners, 'rivers-line', 0.85);
addCanvasLayer('wx-gclouds', CV.gclouds, gCorners, 'seas', 0.95);
addCanvasLayer('wx-clouds', CV.clouds, wxCorners, 'seas', 1);
const refreshCanvas = id => { const s = map.getSource(id); if (!s) return; s.play(); setTimeout(() => s.pause(), 60); };

lstep('Charting the winds…', 80);
await callWorker(WXW, { type: 'wxinit', ...WXB });

/* ---------------- state ---------------- */
const S = {
  story: 'war', t: WX.parse(GEO.STORIES.war.now) + 0.5 / 24 * 24 * 0 + 0.083, playing: false, speed: 0.25,
  wxMaster: true, era: 'TA3018', base: 0, layers: {}, wx: { clouds: true, radar: false, temp: false, pressure: false, wind: false, night: false },
  measure: null, pick: null,
};
S.t = Math.floor(S.t) + 14 / 24;
const LORE = GEO.LORE_WEATHER.map(l => ({ ...l, t0: WX.parse(l.from), t1: WX.parse(l.to) }));

/* ---------------- weather rendering ---------------- */
let wxBusy = false, wxDirty = true, lastWX = null, gcBusy = false, gcT = -1;
function wxRequest() {
  wxDirty = true;
  if (wxBusy) return;
  const L = Object.fromEntries(Object.keys(S.wx).map(k => [k, wxOn(k)]));
  const any = L.clouds || L.radar || L.temp || L.pressure || L.wind;
  if (!any) return;
  wxBusy = true; wxDirty = false;
  const t = S.t;
  callWorker(WXW, { type: 'wx', t, layers: { clouds: L.clouds, radar: L.radar, temp: L.temp, pressure: L.pressure }, lore: LORE }).then(r => {
    wxBusy = false; lastWX = r;
    for (const k of ['clouds', 'radar', 'temp']) if (r.layers[k]) { CV[k].getContext('2d').putImageData(new ImageData(r.layers[k], WXB.W, WXB.H), 0, 0); refreshCanvas('wx-' + k); }
    if (wxOn('pressure') && r.P) drawIsobars(r);
    if (wxDirty) wxRequest();
  }).catch(e => { wxBusy = false; console.warn(e); });
  if (L.clouds && !gcBusy && Math.abs(t - gcT) > 0.08) {
    gcBusy = true; gcT = t;
    callWorker(WXW, { type: 'gclouds', t, W: 1024, H: 512 }).then(r => {
      gcBusy = false;
      const g = CV.gclouds.getContext('2d');
      g.putImageData(new ImageData(r.rgba, 1024, 512), 0, 0);
      // cut a soft window where the detailed regional field takes over
      g.globalCompositeOperation = 'destination-out';
      const x0 = (WXB.lon0 + 180) / 360 * 1024, x1 = (WXB.lon1 + 180) / 360 * 1024;
      const my = lat => (1 - merc(lat) / merc(85.05)) / 2 * 512;
      const grd = (a, b) => { const gr = g.createLinearGradient(a[0], a[1], b[0], b[1]); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)'); return gr; };
      const y0 = my(WXB.lat1), y1 = my(WXB.lat0), pad = 26;
      g.fillStyle = '#000'; g.fillRect(x0 + pad, y0 + pad, x1 - x0 - 2 * pad, y1 - y0 - 2 * pad);
      g.fillStyle = grd([x0, 0], [x0 + pad, 0]); g.fillRect(x0, y0, pad, y1 - y0);
      g.fillStyle = grd([x1, 0], [x1 - pad, 0]); g.fillRect(x1 - pad, y0, pad, y1 - y0);
      g.fillStyle = grd([0, y0], [0, y0 + pad]); g.fillRect(x0, y0, x1 - x0, pad);
      g.fillStyle = grd([0, y1], [0, y1 - pad]); g.fillRect(x0, y1 - pad, x1 - x0, pad);
      g.globalCompositeOperation = 'source-over';
      refreshCanvas('wx-gclouds');
    }).catch(() => { gcBusy = false; });
  }
}
// the regional canvas edges fade too
function wxCloudEdgeMask() { /* handled in the worker output by alpha falloff below */ }

function drawIsobars(r) {
  const { GW, GH } = WXB, P = r.P;
  const my0 = merc(WXB.lat1), my1 = merc(WXB.lat0);
  const cellLL = (i, j) => [WXB.lon0 + (WXB.lon1 - WXB.lon0) * (i + 0.5) / GW, (2 * Math.atan(Math.exp(my0 + (my1 - my0) * (j + 0.5) / GH)) - Math.PI / 2) * 180 / Math.PI];
  const feats = [];
  let lo = Infinity, hi = -Infinity; for (const v of P) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  for (let lev = Math.ceil(lo / 4) * 4; lev <= hi; lev += 4) {
    const segs = [];
    for (let j = 0; j < GH - 1; j++) for (let i = 0; i < GW - 1; i++) {
      const a = P[j * GW + i], b = P[j * GW + i + 1], c = P[(j + 1) * GW + i + 1], d = P[(j + 1) * GW + i];
      const code = (a > lev ? 8 : 0) | (b > lev ? 4 : 0) | (c > lev ? 2 : 0) | (d > lev ? 1 : 0);
      if (code === 0 || code === 15) continue;
      const e = (p, q, x0, y0, x1, y1) => { const t = (lev - p) / (q - p); return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]; };
      const T = e(a, b, i, j, i + 1, j), Rr = e(b, c, i + 1, j, i + 1, j + 1), B = e(d, c, i, j + 1, i + 1, j + 1), L = e(a, d, i, j, i, j + 1);
      const tbl = { 1: [[L, B]], 2: [[B, Rr]], 3: [[L, Rr]], 4: [[T, Rr]], 5: [[L, T], [B, Rr]], 6: [[T, B]], 7: [[L, T]], 8: [[L, T]], 9: [[T, B]], 10: [[T, Rr], [L, B]], 11: [[T, Rr]], 12: [[L, Rr]], 13: [[B, Rr]], 14: [[L, B]] };
      for (const s of tbl[code]) segs.push(s);
    }
    for (const s of segs) feats.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: s.map(p => cellLL(p[0], p[1])) }, properties: { p: lev } });
  }
  map.getSource('isobars').setData(FC(feats));
  map.getSource('hl').setData(FC(r.sys.filter(s => s.x > -2200 && s.x < 3000).map(s => pt(s.x, s.y, { t: s.type }))));
}

/* day & night */
function drawNight() {
  const c = CV.night, g = c.getContext('2d'), W = c.width, H = c.height;
  const img = g.createImageData(W, H), d = img.data;
  const mT = merc(80), mB = merc(-80);
  for (let j = 0; j < H; j++) {
    const lat = (2 * Math.atan(Math.exp(mT + (mB - mT) * (j + 0.5) / H)) - Math.PI / 2) * 180 / Math.PI;
    for (let i = 0; i < W; i++) {
      const lon = (i + 0.5) / W * 360 - 180;
      const el = WX.sunVector(S.t, lon, lat).el;
      const a = GEN.sat((2 - el) / 12);
      const o = (j * W + i) * 4;
      d[o] = 6; d[o + 1] = 10; d[o + 2] = 28; d[o + 3] = a * 175;
      if (el < 3 && el > -8) { const k = 1 - Math.abs(el + 2.5) / 5.5; if (k > 0) { d[o] = 60 * k + 6; d[o + 1] = 30 * k + 10; d[o + 2] = 28; } }
    }
  }
  g.putImageData(img, 0, 0);
  refreshCanvas('wx-night');
  const feats = PL.filter(p => p.pop).map(p => {
    const [lon, lat] = GEN.toLL(p.X, p.Y);
    const el = WX.sunVector(S.t, lon, lat).el;
    return pt(p.X, p.Y, { glow: GEN.sat((-el - 1) / 6) * (p.culture === 'mordor' ? 0.4 : 0.9), s: Math.min(3, 0.6 + Math.log10(p.pop) * 0.6) });
  });
  map.getSource('lights').setData(FC(feats));
}

/* ---------------- wind particles ---------------- */
const windCv = $('#wind'), wctx = windCv.getContext('2d');
let particles = [];
function resizeWind() { const dpr = Math.min(2, devicePixelRatio || 1); windCv.width = innerWidth * dpr; windCv.height = innerHeight * dpr; wctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
resizeWind(); addEventListener('resize', resizeWind);
function seedParticle(p) {
  const b = map.getBounds();
  const w = Math.max(WXB.lon0, b.getWest()), e = Math.min(WXB.lon1, b.getEast()), s = Math.max(WXB.lat0, b.getSouth()), n = Math.min(WXB.lat1, b.getNorth());
  p.lon = w + Math.random() * Math.max(0.1, e - w); p.lat = s + Math.random() * Math.max(0.1, n - s); p.age = Math.random() * 80; p.px = null;
  return p;
}
function windAt(lon, lat) {
  if (!lastWX) return null;
  const u = (lon - WXB.lon0) / (WXB.lon1 - WXB.lon0), v = (merc(WXB.lat1) - merc(lat)) / (merc(WXB.lat1) - merc(WXB.lat0));
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  const { GW, GH } = WXB;
  const x = Math.min(GW - 1.001, Math.max(0, u * GW - 0.5)), y = Math.min(GH - 1.001, Math.max(0, v * GH - 0.5));
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, k = j * GW + i;
  const b = (A) => (A[k] * (1 - fx) + A[k + 1] * fx) * (1 - fy) + (A[k + GW] * (1 - fx) + A[k + GW + 1] * fx) * fy;
  return [b(lastWX.U), b(lastWX.V)];
}
function windFrame() {
  requestAnimationFrame(windFrame);
  if (!wxOn('wind') || !lastWX || $('#ground').classList.contains('open')) { if (particles.length) { wctx.clearRect(0, 0, innerWidth, innerHeight); particles = []; } return; }
  if (!particles.length) particles = Array.from({ length: innerWidth < 700 ? 900 : 2200 }, () => seedParticle({}));
  wctx.globalCompositeOperation = 'destination-in'; wctx.fillStyle = 'rgba(0,0,0,0.9)'; wctx.fillRect(0, 0, innerWidth, innerHeight);
  wctx.globalCompositeOperation = 'source-over';
  wctx.lineWidth = 1.2; wctx.strokeStyle = 'rgba(236,246,250,0.75)';
  wctx.beginPath();
  const z = map.getZoom(), k = 0.0028 * Math.pow(2, Math.max(0, 5 - z) * 0.55);
  for (const p of particles) {
    const w = windAt(p.lon, p.lat);
    if (!w || p.age++ > 90) { seedParticle(p); continue; }
    p.lon += w[0] * k / Math.cos(p.lat * Math.PI / 180); p.lat += w[1] * k;
    const q = map.project([p.lon, p.lat]);
    if (p.px && Math.abs(q.x - p.px.x) < 40 && Math.abs(q.y - p.px.y) < 40) { wctx.moveTo(p.px.x, p.px.y); wctx.lineTo(q.x, q.y); }
    p.px = q;
  }
  wctx.stroke();
}
requestAnimationFrame(windFrame);
map.on('movestart', () => { for (const p of particles) p.px = null; wctx.clearRect(0, 0, innerWidth, innerHeight); });

/* ---------------- static climate & point weather ---------------- */
function staticAt(X, Y) {
  const h = GEN.evaluate(X, Y, 3);
  const land = GEN.R.s > 0 ? 1 : 0, F = GEN.F, lat = GEN.R.lat;
  const st = { X, Y, lat, lon: GEN.toLL(X, Y)[0], h: Math.max(0, h), land, arid: F[8], cont: GEN.sat((F[1] - 0.45) * 2), mtn: F[2] };
  const e = 8;
  const hx1 = Math.max(0, GEN.evaluate(X + e, Y, 3)), hx0 = Math.max(0, GEN.evaluate(X - e, Y, 3)), hy1 = Math.max(0, GEN.evaluate(X, Y + e, 3)), hy0 = Math.max(0, GEN.evaluate(X, Y - e, 3));
  st.gx = (hx1 - hx0) / (2 * e * GEN.MI); st.gy = (hy1 - hy0) / (2 * e * GEN.MI);
  return st;
}
function weatherAt(X, Y, t, st) {
  st = st || staticAt(X, Y);
  const o = WX.sample(X, Y, t, st, WX.systems(t), LORE);
  return { ...o, ...WX.describe(o) };
}

/* ---------------- time & journeys ---------------- */
const EVENTS = {
  war: [['3018 9 18', 'Gandalf escapes from Orthanc on the Eagle Gwaihir', 334, -379.1], ['3018 9 22', 'Frodo\'s fiftieth birthday at Bag End', 0.3, 0.5], ['3018 9 23', 'Frodo, Sam and Pippin leave Bag End by night', 0.3, 0.5], ['3018 9 24', 'Gildor\'s Elves shelter the hobbits in the Woody End', 44.9, -11.2], ['3018 9 25', 'Across the Brandywine to Crickhollow', 84, -7.4], ['3018 9 26', 'Through the Old Forest to the house of Tom Bombadil', 104.2, -24.2], ['3018 9 28', 'Captured by a Barrow-wight', 112.8, -6.6], ['3018 9 29', 'The Prancing Pony at Bree; Strider', 127.9, 7.4], ['3018 10 6', 'Frodo is stabbed by the Witch-king on Weathertop', 208, 11], ['3018 10 20', 'Flight to the Ford of Bruinen', 400.3, 3.7], ['3018 10 25', 'The Council of Elrond', 420.5, 17.5], ['3018 12 25', 'The Fellowship sets out from Rivendell', 420.5, 17.5], ['3019 1 11', 'Snowstorm on Caradhras turns the Company back', 414.8, -157.6], ['3019 1 13', 'Wolves in Hollin; the Company enters Moria', 380, -159.2], ['3019 1 15', 'The Bridge of Khazad-dûm; Gandalf falls', 420.3, -184.9], ['3019 1 17', 'The Company comes to Caras Galadhon', 454.7, -254.7], ['3019 2 16', 'Farewell to Lórien', 489.1, -297.6], ['3019 2 26', 'Breaking of the Fellowship; death of Boromir', 611.7, -462.2], ['3019 3 1', 'Aragorn meets Gandalf the White in Fangorn', 431.7, -377.3], ['3019 3 3', 'Battle of the Hornburg', 377.3, -451.8], ['3019 3 3', 'The Ents destroy Isengard', 334, -379.1], ['3019 3 7', 'Faramir takes Frodo to Henneth Annûn', 744.5, -565.6], ['3019 3 8', 'The Beacons of Gondor are lit', 694, -582.9], ['3019 3 10', 'The Dawnless Day; the Rohirrim muster', 840.1, -554], ['3019 3 13', 'Frodo captured at Cirith Ungol; Aragorn takes Pelargir', 781.2, -583.9], ['3019 3 15', 'Battle of the Pelennor Fields', 731.5, -602.2], ['3019 3 25', 'The Ring is destroyed; Sauron is overthrown', 840.3, -553.1]],
  hobbit: [['2941 4 28', 'The Company sets out from Bag End (dates approximate)', 0.3, 0.5], ['2941 5 20', 'Captured by trolls in the Trollshaws', 362, 17.3], ['2941 6 30', 'Rivendell on Midsummer\'s Eve', 420.5, 17.5], ['2941 7 6', 'Goblin-town; Bilbo finds the Ring', 493.1, 7.2], ['2941 7 9', 'Beorn\'s hall', 565.6, 48.2], ['2941 8 12', 'Taken by the Wood-elves', 713.8, 81.2], ['2941 9 22', 'Barrels out of bond', 735.5, 87.4], ['2941 10 10', 'The Lonely Mountain; Smaug slain at Lake-town', 768.4, 138], ['2941 11 23', 'Battle of Five Armies', 769, 128.5], ['2942 6 22', 'Bilbo returns to Bag End', 0.3, 0.5]],
};
const JOURNEYS = {};
for (const k in GEO.JOURNEYS) JOURNEYS[k] = GEO.JOURNEYS[k].map(j => ({ ...j, wp: j.pts.map(p => ({ X: p[0], Y: p[1], t: WX.parse(p[2]) })) }));
function partyAt(j, t) {
  const w = j.wp;
  if (t < w[0].t) return null;
  if (t >= w[w.length - 1].t) return { X: w[w.length - 1].X, Y: w[w.length - 1].Y, idx: w.length - 1, frac: 1, done: true };
  for (let i = 0; i < w.length - 1; i++) if (t >= w[i].t && t < w[i + 1].t) {
    const f = (t - w[i].t) / (w[i + 1].t - w[i].t);
    return { X: w[i].X + (w[i + 1].X - w[i].X) * f, Y: w[i].Y + (w[i + 1].Y - w[i].Y) * f, idx: i, frac: f };
  }
  return null;
}
function nearestPlace(X, Y) {
  let best = null, bd = 1e9;
  for (const p of PL) { const d = Math.hypot(p.X - X, p.Y - Y); if (d < bd) { bd = d; best = p; } }
  return { p: best, d: bd };
}
function updateJourneys() {
  const js = JOURNEYS[S.story] || [];
  const feats = [], pos = [];
  for (const j of js) {
    feats.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: lineLL(j.wp.map(w => [w.X, w.Y])) }, properties: { part: 'all', color: j.color } });
    const p = partyAt(j, S.t);
    if (!p) continue;
    const done = j.wp.slice(0, p.idx + 1).map(w => [w.X, w.Y]).concat([[p.X, p.Y]]);
    if (done.length > 1) feats.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: lineLL(done) }, properties: { part: 'done', color: j.color } });
    pos.push(pt(p.X, p.Y, { name: j.name, color: j.color }));
  }
  if (mapLoaded) { map.getSource('journeys').setData(FC(feats)); map.getSource('journey-pos').setData(FC(pos)); }
}
function setTime(t, fromSlider) {
  const st = GEO.STORIES[S.story];
  const a = WX.parse(st.start), b = WX.parse(st.end);
  S.t = Math.max(a, Math.min(b, t));
  const P = WX.parts(S.t);
  $('#tdate').innerHTML = `${esc(P.name)} <em>S.R. ${P.sr} · T.A. ${P.ta} · ${WX.fmtTime(P.hour)}</em>`;
  if (!fromSlider) $('#slider').value = ((S.t - a) / (b - a) * 1000).toFixed(1);
  // ticker: latest event and where the Ring-bearer is
  const evs = EVENTS[S.story].map(e => ({ t: WX.parse(e[0]), text: e[1] })).filter(e => e.t <= S.t + 0.5);
  const ev = evs[evs.length - 1];
  const js = JOURNEYS[S.story] || [];
  const lead = js[0] && partyAt(js[0], S.t);
  let where = '';
  if (lead) { const np = nearestPlace(lead.X, lead.Y); where = `<b>${esc(js[0].name)}</b> ${np.d < 4 ? 'at' : 'near'} ${esc(np.p.name)}`; }
  $('#ticker').innerHTML = [where, ev ? esc(ev.text) : ''].filter(Boolean).join(' · ');
  updateJourneys();
  const beaconsLit = S.story === 'war' && S.t >= WX.parse('3019 3 8') && S.t < WX.parse('3019 3 16');
  if (mapLoaded) map.setPaintProperty('beacons-line', 'line-opacity', beaconsLit ? 1 : 0.35);
  wxRequest();
  if (wxOn('night')) drawNight();
  updateSky();
  if (cardState && cardState.kind === 'place') refreshCardWeather();
}
function buildTicks() {
  const st = GEO.STORIES[S.story], a = WX.parse(st.start), b = WX.parse(st.end);
  $('#ticks').innerHTML = EVENTS[S.story].map(e => `<i style="left:${((WX.parse(e[0]) - a) / (b - a) * 100).toFixed(2)}%" title="${esc(e[1])}"></i>`).join('');
}
$('#slider').addEventListener('input', e => {
  const st = GEO.STORIES[S.story], a = WX.parse(st.start), b = WX.parse(st.end);
  setTime(a + (b - a) * (+e.target.value / 1000), true);
});
$('#story').addEventListener('change', e => { S.story = e.target.value; buildTicks(); setTime(WX.parse(GEO.STORIES[S.story].now)); if (panelName === 'journeys') openPanel('journeys'); });
$('#speed').addEventListener('change', e => { S.speed = +e.target.value; });
let lastFrame = 0;
function tick(ts) {
  requestAnimationFrame(tick);
  if (!S.playing) { lastFrame = ts; return; }
  const dt = Math.min(0.1, (ts - lastFrame) / 1000); lastFrame = ts;
  const st = GEO.STORIES[S.story];
  if (S.t >= WX.parse(st.end)) { togglePlay(false); return; }
  setTime(S.t + dt * S.speed);
  if (S.follow) { const j = (JOURNEYS[S.story] || []).find(j => j.name === S.follow); const p = j && partyAt(j, S.t); if (p) map.easeTo({ center: ll(p.X, p.Y), duration: 0 }); }
}
requestAnimationFrame(tick);
function togglePlay(on) {
  S.playing = on === undefined ? !S.playing : on;
  $('#playico').innerHTML = S.playing ? '<path d="M4 2.5h3v11H4zM9 2.5h3v11H9z"/>' : '<path d="M4 2.5v11l9-5.5z"/>';
  $('#play').setAttribute('aria-label', S.playing ? 'Pause timeline' : 'Play timeline');
}
$('#play').onclick = () => togglePlay();

/* sky follows the sun at the view centre */
function updateSky() {
  if (!mapLoaded) return;
  const c = map.getCenter();
  const el = WX.sunVector(S.t, c.lng, c.lat).el;
  const day = GEN.sat((el + 4) / 14), dusk = Math.max(0, 1 - Math.abs(el - 1) / 7);
  const mixc = (a, b, t) => '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
  const sky = mixc([14, 22, 44], [110, 160, 210], day), hor = mixc(mixc([30, 36, 60], [214, 228, 238], day).match(/\w\w/g).map(h => parseInt(h, 16)), [236, 170, 120], dusk * 0.8);
  const fog = mixc([26, 32, 50], [200, 212, 222], day);
  map.setSky({ 'sky-color': sky, 'horizon-color': hor, 'fog-color': fog, 'horizon-fog-blend': 0.6, 'sky-horizon-blend': 0.6, 'fog-ground-blend': 0.85, 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 8, 0] });
}
map.on('moveend', updateSky);

/* ---------------- layer switching ---------------- */
const LAYER_GROUPS = {
  rivers: ['rivers-line', 'rivers-label', 'lakes-label'],
  mountains: ['ranges-label', 'peaks'],
  forests: ['forests-label', 'marsh-label'],
  seas: ['seas'],
  places: ['places-1', 'places-2', 'places-3', 'places-4', 'places-5'],
  peoples: ['peoples-fill', 'peoples-line', 'peoples-label'],
  realms: ['realms-fill', 'realms-line', 'realms-label'],
  admin: ['admin-line', 'admin-label'],
  roads: ['roads-case', 'roads-line', 'walls'],
  infra: ['places-infra'],
  beacons: ['beacons-line', 'places-beacons'],
  palantiri: ['palantiri-line', 'palantiri-pts'],
  grid: ['grid-lines', 'grid-labels'],
  regions: ['regions'],
  journeys: ['journeys-all', 'journeys-done', 'journeys-pos', 'journeys-pos-label'],
};
const LAYER_ON = { rivers: 1, mountains: 1, forests: 1, seas: 1, places: 1, peoples: 0, realms: 0, admin: 0, roads: 1, infra: 1, beacons: 0, palantiri: 0, grid: 0, regions: 1, journeys: 1 };
function setGroup(k, on) {
  LAYER_ON[k] = on ? 1 : 0;
  for (const id of LAYER_GROUPS[k]) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
}
for (const k in LAYER_ON) setGroup(k, LAYER_ON[k]);
const WX_IDS = { clouds: ['wx-clouds', 'wx-gclouds'], radar: ['wx-radar'], temp: ['wx-temp'], pressure: ['isobars', 'isobar-labels', 'hl'], night: ['wx-night', 'lights'], wind: [] };
const wxOn = k => S.wxMaster && S.wx[k];
function applyWx(k) {
  for (const id of WX_IDS[k]) map.setLayoutProperty(id, 'visibility', wxOn(k) ? 'visible' : 'none');
  if (k === 'night' && wxOn(k)) drawNight();
}
function setWx(k, on) {
  S.wx[k] = on;
  if (on && !S.wxMaster) { setWxMaster(true); return; }
  applyWx(k);
  gcT = -1; wxRequest();
}
function setWxMaster(on) {
  S.wxMaster = on;
  if (on && !Object.values(S.wx).some(Boolean)) S.wx.clouds = true;
  for (const k in WX_IDS) applyWx(k);
  $('#bwx').classList.toggle('on', on);
  $('#bwx').setAttribute('aria-pressed', on ? 'true' : 'false');
  const m = $('#g-weather'); if (m) m.checked = on;
  const wm = $('#w-master'); if (wm) wm.checked = on;
  gcT = -1; wxRequest();
  if (!on) toast('Weather hidden. Your layer choices are kept for when you turn it back on.');
}
function setEra(era) {
  S.era = era;
  map.getSource('realms').setData(FC(realmFeats(era)));
  map.getSource('realm-labels').setData(FC(realmLabels(era)));
}
const BASES = ['Satellite', 'Red Book', 'Relief'];
function setBase(i) {
  S.base = i;
  map.getSource('imagery').setTiles(['arda://img/{z}/{x}/{y}/' + i]);
  map.setPaintProperty('rivers-line', 'line-color', i === 1 ? '#5f8795' : '#7fb8cf');
  for (const id of ['wx-clouds', 'wx-gclouds']) map.setPaintProperty(id, 'raster-opacity', i === 1 ? 0 : id === 'wx-clouds' ? 1 : 0.95);
}

/* ---------------- panels ---------------- */
let panelName = null;
const panel = $('#panel');
function openPanel(name) {
  if (name === 'ground') { toggleGroundPick(); return; }
  if (name === 'measure') { toggleMeasure(); return; }
  if (panelName === name) { closePanel(); return; }
  panelName = name;
  document.querySelectorAll('#rail button').forEach(b => b.classList.toggle('on', b.dataset.p === name || (b.dataset.p === 'measure' && S.measure) || (b.dataset.p === 'ground' && S.pick === 'ground')));
  panel.innerHTML = PANELS[name]();
  panel.classList.add('open');
  panel.querySelector('.x').onclick = closePanel;
  (PANEL_INIT[name] || (() => {}))();
}
function closePanel() {
  panelName = null; panel.classList.remove('open');
  document.querySelectorAll('#rail button').forEach(b => b.classList.toggle('on', (b.dataset.p === 'measure' && !!S.measure) || (b.dataset.p === 'ground' && S.pick === 'ground')));
}
document.querySelectorAll('#rail button').forEach(b => b.onclick = () => openPanel(b.dataset.p));
const tog = (id, label, on, small) => `<div class="row"><label for="${id}">${label}${small ? ` <small>${small}</small>` : ''}</label><input class="tog" type="checkbox" id="${id}" ${on ? 'checked' : ''}></div>`;
const PANELS = {
  layers: () => `<div class="ph"><h2>Layers</h2><button class="x" aria-label="Close">×</button></div>
    <div class="eyebrow">Basemap</div><div class="seg" id="baseSeg">${BASES.map((b, i) => `<button data-i="${i}" class="${S.base === i ? 'on' : ''}">${b}</button>`).join('')}</div>
    <div class="eyebrow">Physical</div>${tog('g-rivers', 'Rivers & lakes', LAYER_ON.rivers)}${tog('g-mountains', 'Mountains & peaks', LAYER_ON.mountains)}${tog('g-forests', 'Forests, marshes & wastes', LAYER_ON.forests)}${tog('g-seas', 'Seas & bays', LAYER_ON.seas)}
    <div class="eyebrow">Human geography</div>${tog('g-places', 'Settlements & sites', LAYER_ON.places)}${tog('g-peoples', 'Peoples & tongues', LAYER_ON.peoples)}${tog('g-regions', 'Lands & regions', LAYER_ON.regions)}
    <div class="eyebrow">Political</div>${tog('g-realms', 'Realms', LAYER_ON.realms)}<div class="seg" id="eraSeg">${[['TA1300', 'T.A. 1300'], ['TA3018', 'T.A. 3018'], ['FA1', 'F.A. 1']].map(e => `<button data-e="${e[0]}" class="${S.era === e[0] ? 'on' : ''}">${e[1]}</button>`).join('')}</div>
    ${tog('g-admin', 'Farthings, fiefs & folds', LAYER_ON.admin)}
    <div class="eyebrow">Atmosphere</div>${tog('g-weather', 'Weather', S.wxMaster, 'clouds, rain, fronts, wind')}
    <div class="eyebrow">Infrastructure</div>${tog('g-roads', 'Roads & walls', LAYER_ON.roads)}${tog('g-infra', 'Bridges & fords', LAYER_ON.infra)}${tog('g-beacons', 'Beacons of Gondor', LAYER_ON.beacons)}${tog('g-palantiri', 'Palantír network', LAYER_ON.palantiri)}
    <div class="eyebrow">Reference</div>${tog('g-grid', 'Map grid', LAYER_ON.grid, '100-mile squares from Hobbiton')}${tog('g-journeys', 'Journeys', LAYER_ON.journeys)}
    <div class="eyebrow">View</div><div class="row"><label for="exag">Relief exaggeration</label><input id="exag" type="range" min="1" max="3" step="0.1" value="${S.exag || 1.35}" style="width:120px"></div>`,
  journeys: () => {
    const js = JOURNEYS[S.story] || [];
    return `<div class="ph"><h2>${esc(GEO.STORIES[S.story].title)}</h2><button class="x" aria-label="Close">×</button></div>
    <p class="note">Press play on the timeline to watch each party move day by day. Positions between recorded dates are interpolated along their routes.</p>
    <div class="eyebrow">Parties</div>
    ${js.map(j => { const p = partyAt(j, S.t); const np = p && nearestPlace(p.X, p.Y); return `<div class="row"><span class="sw" style="background:${j.color}"></span><label>${esc(j.name)} <small>${p ? (np.d < 4 ? 'at ' : 'near ') + esc(np.p.name) : 'not yet set out'}</small></label><button class="btn" data-follow="${esc(j.name)}">${S.follow === j.name ? 'Following' : 'Follow'}</button></div>`; }).join('')}
    <div class="eyebrow">Chronicle</div>
    ${EVENTS[S.story].map(e => { const P = WX.parts(WX.parse(e[0])); return `<div class="row" style="align-items:flex-start"><button class="btn" data-t="${e[0]}" style="min-width:108px;justify-content:center;font-size:12.5px">${esc(P.name)}</button><span class="note" style="flex:1">${esc(e[1])}</span></div>`; }).join('')}`;
  },
  weather: () => `<div class="ph"><h2>Weather</h2><button class="x" aria-label="Close">×</button></div>
    <p class="note">A deterministic atmosphere: Atlantic-style lows sweep in from Belegaer on the westerlies, highs settle over Rhûn in winter, and mountains wring rain from the air. It follows the timeline, so scrub to any date.</p>
    <div class="row" style="padding:10px 0;border-bottom:1px solid var(--rule)"><label for="w-master"><b>Show weather</b></label><input class="tog" type="checkbox" id="w-master" ${S.wxMaster ? 'checked' : ''}></div>
    <div class="eyebrow">Layers</div>
    ${tog('w-clouds', 'Clouds', S.wx.clouds, 'visible satellite')}${tog('w-radar', 'Precipitation radar', S.wx.radar)}
    <div id="radLeg" ${S.wx.radar ? '' : 'hidden'}><div class="legend"><i style="flex:1;background:#5ac86e"></i><i style="flex:1;background:#28aa3c"></i><i style="flex:1;background:#e6dc3c"></i><i style="flex:1;background:#f08c28"></i><i style="flex:1;background:#dc2832"></i><i style="flex:1;background:#aa6ee6"></i></div><div class="scale"><span>drizzle</span><span>heavy</span><span>snow</span></div></div>
    ${tog('w-temp', 'Temperature', S.wx.temp)}
    <div id="tLeg" ${S.wx.temp ? '' : 'hidden'}><div class="legend" style="background:linear-gradient(90deg,#9a5ac8,#6e96e6,#5a96e6,#96c8f0,#6ec8aa,#96dc6e,#e6dc64,#f0aa46,#e66440,#961e3c)"></div><div class="scale"><span>−30°</span><span>0°</span><span>15°</span><span>40°C</span></div></div>
    ${tog('w-pressure', 'Isobars & fronts', S.wx.pressure, '4 hPa')}${tog('w-wind', 'Wind flow', S.wx.wind)}${tog('w-night', 'Day & night', S.wx.night, 'with lamplight')}
    <div class="eyebrow">Recorded weather of the War</div>
    ${LORE.filter(l => l.kind !== 'smoke').map(l => `<div class="row"><button class="btn" data-lore="${l.from}" data-x="${l.x}" data-y="${l.y}" style="width:100%;justify-content:space-between"><span>${esc(l.name)}</span><small style="color:var(--faint)">${esc(WX.parts(l.t0).name)}</small></button></div>`).join('')}
    <p class="note">Click anywhere on the map for a five-day forecast at that spot.</p>`,
  tours: () => `<div class="ph"><h2>Guided flights</h2><button class="x" aria-label="Close">×</button></div>
    <p class="note">Cinematic flights over the terrain. Drag the map at any time to take the controls back.</p>
    ${TOURS.map((t, i) => `<div class="row" style="align-items:flex-start"><div style="flex:1;min-width:0"><div style="font:18px/1.2 var(--font-display)">${esc(t.name)}</div><div class="note">${esc(t.blurb)}</div></div><button class="btn primary" data-tour="${i}">Fly</button></div>`).join('')}`,
  sound: () => {
    const A = window.ARDA_AUDIO, M = A.MOODS;
    return `<div class="ph"><h2>Music &amp; sound</h2><button class="x" aria-label="Close">×</button></div>
    <p class="note">An original score composed live in your browser. It changes with the land you're looking at: pipes and harp in the Shire, horns and drums in Rohan, choirs in the elven realms, low drones in Mordor. The ambience follows the weather: wind, rain and birdsong.</p>
    <div class="btns" style="margin:12px 0 4px"><button class="btn primary" id="sndPlay">${A.on ? 'Pause' : 'Play music'}</button></div>
    <div class="eyebrow">Now playing</div>
    <div id="sndNow" style="font:20px/1.2 var(--font-display)">${A.on && A.mood ? esc(M[A.mood].title) : '—'}</div>
    <div class="note" id="sndWhere">${A.on ? 'Following the map' : 'Press play to begin'}</div>
    <div class="eyebrow">Theme</div>
    <select id="sndMood" style="width:100%;background:rgba(255,255,255,.05);border:1px solid var(--rule);border-radius:8px;padding:8px">
      <option value="">Follow the map</option>${Object.entries(M).map(([k, m]) => `<option value="${k}" ${S.moodLock === k ? 'selected' : ''}>${esc(m.title)}</option>`).join('')}</select>
    <div class="eyebrow">Levels</div>
    <div class="row"><label for="volM">Music</label><input id="volM" type="range" min="0" max="1" step="0.05" value="${A.music}" style="width:150px"></div>
    <div class="row"><label for="volA">Wind, rain &amp; birds</label><input id="volA" type="range" min="0" max="1" step="0.05" value="${A.amb}" style="width:150px"></div>
    <div class="eyebrow">Your own music</div>
    <p class="note">Spotify can't play inside this page, because the atlas isn't allowed to embed other sites' players or load their audio. Open it alongside instead and turn the score down above.</p>
    <div class="btns"><a class="btn" href="https://open.spotify.com/search/lord%20of%20the%20rings%20soundtrack" target="_blank" rel="noopener">Open Spotify ↗</a></div>`;
  },
  about: () => `<div class="ph"><h2>About this atlas</h2><button class="x" aria-label="Close">×</button></div>
    <p class="note">Arda Atlas renders Middle-earth as if it were a real planet seen from orbit. Coastlines, ranges, rivers, forests and places are hand-placed from Tolkien's maps and his own statements of scale (Hobbiton at the latitude of Oxford, Minas Tirith some 600 miles south). Everything else is generated on your device, deterministically: elevation, satellite colour, farm fields, tree crowns, rooftops and weather.</p>
    <div class="eyebrow">How it works</div>
    <p class="note">Authored vectors are rasterised into 16 field layers (land, mountains, forest, aridity, farmland…). Web Workers turn those fields into terrain and imagery tiles on demand with fractal noise, so detail continues to about 2 metres per pixel. MapLibre GL draws the globe and 3D terrain; three.js draws the ground view.</p>
    <div class="eyebrow">Accuracy</div>
    <p class="note">Positions follow the published maps closely but not exactly. Population figures are estimates and are labelled as such; Tolkien gave very few. Distant lands such as the Dark Land and the Land of the Sun come from the early cosmology maps, and the New Lands after the Downfall are invented.</p>
    <p class="note">A fan work. Middle-earth and its names belong to the Tolkien Estate.</p>`,
};
const PANEL_INIT = {
  layers: () => {
    panel.querySelectorAll('#baseSeg button').forEach(b => b.onclick = () => { setBase(+b.dataset.i); panel.querySelectorAll('#baseSeg button').forEach(x => x.classList.toggle('on', x === b)); });
    panel.querySelectorAll('#eraSeg button').forEach(b => b.onclick = () => { setEra(b.dataset.e); if (!LAYER_ON.realms) { setGroup('realms', 1); $('#g-realms').checked = true; } panel.querySelectorAll('#eraSeg button').forEach(x => x.classList.toggle('on', x === b)); });
    for (const k in LAYER_GROUPS) { const el = $('#g-' + k); if (el) el.onchange = () => setGroup(k, el.checked); }
    $('#g-weather').onchange = e => setWxMaster(e.target.checked);
    $('#exag').oninput = e => { S.exag = +e.target.value; if (S.terrain !== false) map.setTerrain({ source: 'dem', exaggeration: S.exag }); };
  },
  journeys: () => {
    panel.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { setTime(WX.parse(b.dataset.t)); const e = EVENTS[S.story].find(x => x[0] === b.dataset.t); if (e) flyToXY(e[2], e[3], 9, 50); });
    panel.querySelectorAll('[data-follow]').forEach(b => b.onclick = () => { S.follow = S.follow === b.dataset.follow ? null : b.dataset.follow; openPanel('journeys'); openPanel('journeys'); if (S.follow) { const j = JOURNEYS[S.story].find(j => j.name === S.follow); const p = partyAt(j, S.t) || { X: j.wp[0].X, Y: j.wp[0].Y }; map.flyTo({ center: ll(p.X, p.Y), zoom: 8, pitch: 45 }); togglePlay(true); } });
  },
  weather: () => {
    $('#w-master').onchange = e => setWxMaster(e.target.checked);
    for (const k of ['clouds', 'radar', 'temp', 'pressure', 'wind', 'night']) { const el = $('#w-' + k); el.onchange = () => { setWx(k, el.checked); if (k === 'radar') $('#radLeg').hidden = !el.checked; if (k === 'temp') $('#tLeg').hidden = !el.checked; }; }
    panel.querySelectorAll('[data-lore]').forEach(b => b.onclick = () => { setTime(WX.parse(b.dataset.lore) + 0.3); if (!wxOn('clouds')) { setWx('clouds', true); $('#w-clouds').checked = true; } flyToXY(+b.dataset.x, +b.dataset.y, 6, 30); });
  },
  sound: () => {
    const A = window.ARDA_AUDIO;
    $('#sndPlay').onclick = async () => { if (A.on) A.stop(); else { await A.start(); soundFocus(); } openPanel('sound'); openPanel('sound'); };
    $('#sndMood').onchange = e => { S.moodLock = e.target.value || null; soundFocus(); };
    $('#volM').oninput = e => A.setMusic(+e.target.value);
    $('#volA').oninput = e => A.setAmb(+e.target.value);
  },
  tours: () => { panel.querySelectorAll('[data-tour]').forEach(b => b.onclick = () => { closePanel(); playTour(TOURS[+b.dataset.tour]); }); },
};

/* ---------------- sound focus ---------------- */
function moodAt(X, Y, zoom) {
  if (zoom < 3.2) return 'world';
  GEN.evaluate(X, Y, 1);
  if (GEN.R.s <= 0) return zoom < 6 && Math.hypot(X - 329, Y + 342) < 900 ? 'wild' : 'sea';
  const mtn = GEN.F[2];
  const inR = n => { const r = GEO.REALMS.TA3018.find(r => r.name === n); return r && inPoly(X, Y, r); };
  if (inR('Mordor') || inR('Dol Guldur') || inR('Isengard') || Math.hypot(X - 266, Y - 268) < 70) return 'mordor';
  if (['Lindon', 'Imladris', 'Lothlórien', 'Woodland Realm'].some(inR)) return 'elven';
  if (Math.hypot(X - 402, Y + 172) < 30 || inR('Erebor & Dale') || inR('Iron Hills') || mtn > 0.35) return 'dwarf';
  if (inR('The Shire') || inR('Buckland') || inR('Bree-land')) return 'shire';
  if (inR('Rohan')) return 'rohan';
  if (inR('Gondor')) return 'gondor';
  return 'wild';
}
function soundFocus() {
  const A = window.ARDA_AUDIO; if (!A || !A.on) return;
  let X, Y, t = S.t, near;
  const G = window.GROUND && window.GROUND.G;
  if (G && G.active) { X = G.X0 + G.px / GEN.MI; Y = G.Y0 - G.pz / GEN.MI; t = G.t; near = 1; }
  else { const c = map.getCenter(); [X, Y] = GEN.toXY(c.lng, c.lat); near = GEN.sat((map.getZoom() - 5) / 6) * 0.8; }
  const key = S.moodLock || moodAt(X, Y, G && G.active ? 12 : map.getZoom());
  A.setMood(key);
  const w = weatherAt(X, Y, t);
  GEN.evaluate(X, Y, 0.05);
  const [lon, lat] = GEN.toLL(X, Y);
  A.setWeather({ ...w, day: WX.sunVector(t, lon, lat).el > 0, land: GEN.R.s > 0, forest: GEN.F[4] > 0.4 });
  A.setNear(near);
  const el = $('#sndNow'); if (el) { el.textContent = A.MOODS[key].title; $('#sndWhere').textContent = S.moodLock ? 'Theme chosen by you' : 'Following the map'; }
}
setInterval(soundFocus, 2000);

/* ---------------- camera helpers ---------------- */
function flyToXY(X, Y, zoom, pitch, bearing, duration) {
  map.flyTo({ center: ll(X, Y), zoom, pitch: pitch ?? 55, bearing: bearing ?? map.getBearing(), duration: duration ?? 4200, essential: true, curve: 1.5 });
}
const ZOOM_FOR = { city: 13.2, town: 13.6, village: 14.5, fortress: 13.4, ruin: 13.5, elven: 13, dwarven: 12, port: 12.8, tower: 13.5, bridge: 14.2, ford: 14.2, landmark: 13.5, cave: 13.5, wonder: 13, beacon: 12.5, peak: 11, range: 7, river: 7, lake: 9.5, forest: 8, marsh: 9.5, region: 6.5, realm: 5.8, sea: 5 };

/* ---------------- search ---------------- */
const INDEX = [];
PL.forEach(p => INDEX.push({ name: p.name, alt: p.realm, kind: p.type, X: p.X, Y: p.Y, place: p }));
GEO.PEAKS.filter(p => p.kind !== 'seamount').forEach(p => { if (!PLN[p.name]) INDEX.push({ name: p.name, alt: p.alt, kind: 'peak', X: p.x, Y: p.y, peak: p }); });
GEO.RANGES.filter(r => r.label).forEach(r => { const m = r.pts[Math.floor(r.pts.length / 2)]; INDEX.push({ name: r.name, alt: r.alt, kind: 'range', X: m[0], Y: m[1] }); });
GEO.RIVERS.filter(r => r.rank <= 4 && !/Rivers of|Southern|Great River|River of the East|Red River/.test(r.name)).forEach(r => { const m = r.pts[Math.floor(r.pts.length / 2)]; INDEX.push({ name: r.name, alt: r.alt, kind: 'river', X: m[0], Y: m[1] }); });
GEO.LAKES.forEach(l => { const c = centroid(l.pts); INDEX.push({ name: l.name, alt: l.alt, kind: 'lake', X: c[0], Y: c[1] }); });
GEO.FORESTS.filter(f => !/woods of|forests of|taiga|eastern woods/i.test(f.name)).forEach(f => { const c = centroid(f.pts); INDEX.push({ name: f.name, alt: f.alt, kind: 'forest', X: c[0], Y: c[1] }); });
GEO.MARSHES.forEach(m => { const c = centroid(m.pts); INDEX.push({ name: m.name, alt: m.alt, kind: 'marsh', X: c[0], Y: c[1] }); });
GEO.REGION_LABELS.filter(r => r[1] > -5000).forEach(r => INDEX.push({ name: r[0].replace(/\b(\w)(\w*)/g, (m, a, b) => a + b.toLowerCase()), kind: r[3] === 'realm' ? 'realm' : 'region', X: r[1], Y: r[2] }));
GEO.SEA_LABELS.forEach(s => INDEX.push({ name: s[0], kind: 'sea', X: s[1], Y: s[2] }));
const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
let sel = -1, hits = [];
$('#q').addEventListener('input', e => {
  const q = norm(e.target.value.trim());
  const box = $('#results');
  if (!q) { box.classList.remove('open'); return; }
  hits = INDEX.map(it => { const n = norm(it.name), a = norm(it.alt); const s = n.startsWith(q) ? 0 : n.includes(q) ? 1 : a.includes(q) ? 2 : 9; return { it, s }; }).filter(h => h.s < 9).sort((a, b) => a.s - b.s || (a.it.place ? a.it.place.rank : 3) - (b.it.place ? b.it.place.rank : 3)).slice(0, 9).map(h => h.it);
  sel = hits.length ? 0 : -1;
  box.innerHTML = hits.length ? hits.map((h, i) => `<button data-i="${i}" class="${i === sel ? 'sel' : ''}" role="option"><span class="n">${esc(h.name)}</span><span class="a">${esc(h.alt || '')}</span><span class="k">${TYPE_LABEL[h.kind] || h.kind}</span></button>`).join('') : '<div class="note" style="padding:10px">No place by that name in the Red Book.</div>';
  box.classList.add('open');
  box.querySelectorAll('button').forEach(b => b.onclick = () => choose(hits[+b.dataset.i]));
});
$('#q').addEventListener('keydown', e => {
  if (!hits.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { sel = (sel + (e.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length; $('#results').querySelectorAll('button').forEach((b, i) => b.classList.toggle('sel', i === sel)); e.preventDefault(); }
  if (e.key === 'Enter' && sel >= 0) choose(hits[sel]);
  if (e.key === 'Escape') { $('#results').classList.remove('open'); e.target.blur(); }
});
function choose(h) {
  $('#results').classList.remove('open'); $('#q').value = h.name; $('#q').blur();
  const z = ZOOM_FOR[h.kind] || 10;
  flyToXY(h.X, h.Y, z, z > 11 ? 62 : z > 8 ? 50 : 30, undefined, 5000);
  if (h.place) showPlace(h.place);
  else showPoint(h.X, h.Y, { name: h.name, alt: h.alt, kind: h.kind, peak: h.peak });
}
document.addEventListener('click', e => { if (!e.target.closest('#search')) $('#results').classList.remove('open'); });

/* ---------------- identify & dossier ---------------- */
const card = $('#card');
let cardState = null;
function biomeAt(X, Y) {
  const h = GEN.evaluate(X, Y, 0.3), F = GEN.F;
  if (GEN.R.s <= 0) return { name: h < -1000 ? 'Open sea' : 'Coastal waters', h };
  if (F[15] > 0.5) return { name: 'Lake', h };
  const inF = GEO.FORESTS.find(f => inPoly(X, Y, f)), inM = GEO.MARSHES.find(m => inPoly(X, Y, m));
  if (inM) return { name: 'Marsh · ' + inM.name, h };
  if (inF && F[4] > 0.4) return { name: 'Forest · ' + inF.name, h };
  if (F[10] > 0.4) return { name: 'Ash plain and slag', h };
  if (h > 2600) return { name: 'High mountains, snow and rock', h };
  if (F[2] > 0.25) return { name: 'Mountain slopes', h };
  if (F[8] > 0.6) return { name: GEN.tempAt(GEN.R.lat, h) > 15 ? 'Desert' : 'Dry waste', h };
  if (F[9] > 0.4) return { name: 'Farmland', h };
  if (F[13] > 0.5) return { name: 'Grassland', h };
  if (F[3] > 0.2) return { name: 'Downs and heath', h };
  return { name: 'Wild grass and scrub', h };
}
function realmAt(X, Y) { const r = GEO.REALMS[S.era].find(r => inPoly(X, Y, r)); return r ? r.name : '—'; }
function adminAt(X, Y) { const a = GEO.ADMIN.find(a => inPoly(X, Y, a)); return a ? a.name : null; }
function peopleAt(X, Y) { const p = GEO.PEOPLES.filter(p => inPoly(X, Y, p)); return p.length ? p.map(x => x.name).join(', ') : null; }
const fmtLL = (lon, lat) => `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(3)}°${lon >= 0 ? 'E' : 'W'}`;
const fmtXY = (X, Y) => `${Math.abs(X).toFixed(0)} mi ${X >= 0 ? 'E' : 'W'}, ${Math.abs(Y).toFixed(0)} mi ${Y >= 0 ? 'N' : 'S'}`;
function wxBlock(X, Y) {
  const st = staticAt(X, Y);
  const w = weatherAt(X, Y, S.t, st);
  return `<div class="wxnow"><div class="big">${Math.round(w.T)}°</div><div class="sky">${esc(w.sky)}${w.event ? ' · ' + esc(w.event) : ''}</div><div class="det">Wind ${w.windFrom} ${Math.round(w.kmh)} km/h · ${Math.round(w.P)} hPa${w.R > 0 ? ' · ' + w.R.toFixed(1) + ' mm/h' : ''}</div></div>
    <canvas class="fc" id="fc" width="640" height="220" aria-label="Five-day forecast"></canvas>`;
}
function drawForecast(X, Y) {
  const c = $('#fc'); if (!c) return;
  const g = c.getContext('2d'), W = c.width, H = c.height;
  const st = staticAt(X, Y);
  const N = 40, pts = [];
  for (let i = 0; i < N; i++) { const t = S.t + i * 0.125; pts.push({ t, ...weatherAt(X, Y, t, st) }); }
  g.clearRect(0, 0, W, H);
  const Ts = pts.map(p => p.T), lo = Math.floor(Math.min(...Ts) - 2), hi = Math.ceil(Math.max(...Ts) + 2);
  const x = i => 28 + i / (N - 1) * (W - 40), y = T => 24 + (1 - (T - lo) / (hi - lo)) * (H - 70);
  g.font = '20px "IBM Plex Mono", monospace'; g.fillStyle = 'rgba(236,230,214,0.5)';
  for (let d = 0; d <= 5; d++) { const i = d * 8; if (i >= N) break; g.fillStyle = 'rgba(222,204,160,0.12)'; g.fillRect(x(i), 10, 1.5, H - 40); g.fillStyle = 'rgba(236,230,214,0.55)'; g.fillText(d === 0 ? 'now' : WX.parts(pts[i].t).name.replace(/^(\d+) (\w{3}).*/, '$1 $2'), x(i) + 6, H - 8); }
  pts.forEach((p, i) => { if (p.R > 0) { const bh = Math.min(50, p.R * 9); g.fillStyle = p.snow > 0.5 ? 'rgba(180,170,255,0.8)' : 'rgba(142,197,214,0.75)'; g.fillRect(x(i) - 5, H - 34 - bh, 10, bh); } });
  g.strokeStyle = '#d9ac52'; g.lineWidth = 4; g.lineJoin = 'round'; g.beginPath();
  pts.forEach((p, i) => i ? g.lineTo(x(i), y(p.T)) : g.moveTo(x(i), y(p.T))); g.stroke();
  g.fillStyle = '#d9ac52'; g.beginPath(); g.arc(x(0), y(pts[0].T), 7, 0, 7); g.fill();
  g.fillStyle = 'rgba(236,230,214,0.7)'; g.fillText(hi + '°', 0, 30); g.fillText(lo + '°', 0, H - 44);
}
function refreshCardWeather() {
  if (!cardState) return;
  const el = card.querySelector('.wxwrap'); if (!el) return;
  el.innerHTML = wxBlock(cardState.X, cardState.Y); drawForecast(cardState.X, cardState.Y);
}
function openCard(html, state) {
  cardState = state;
  card.innerHTML = `<button class="x" style="float:right" aria-label="Close">×</button>` + html;
  card.classList.add('open');
  card.querySelector('.x').onclick = () => { card.classList.remove('open'); cardState = null; };
  card.querySelectorAll('[data-act]').forEach(b => b.onclick = () => ACTIONS[b.dataset.act](state));
  drawForecast(state.X, state.Y);
}
const ACTIONS = {
  fly: s => flyToXY(s.X, s.Y, s.zoom || 13, 65, map.getBearing() + 30, 4500),
  ground: s => openGround(s.X, s.Y, s.name),
  halls: s => openHalls(HALLS[s.name], s.name),
  measure: s => { if (!S.measure) toggleMeasure(); S.measure.push([s.X, s.Y]); drawMeasure(); },
};
const PKM = ['Hobbiton'];
// places with a walkable interior under the mountain
const HALLS = { 'Erebor': 'erebor', 'Front Gate of Erebor': 'erebor', 'Side Door of Erebor': 'erebor', 'Khazad-dûm': 'moria', 'West-gate of Moria': 'moria', 'Dimrill Gate': 'moria' };
const HALL_TITLE = { erebor: 'The Halls of Erebor', moria: 'Khazad-dûm' };
const hallBtn = name => HALLS[name] ? `<button class="btn" data-act="halls"><svg viewBox="0 0 24 24"><path d="M3 21V11a9 9 0 0 1 18 0v10"/><path d="M9 21v-6a3 3 0 0 1 6 0v6"/></svg>Enter the halls</button>` : '';
function openHalls(kind, name) {
  if (!window.GROUND) { toast('The ground view is still loading. Try again in a moment.'); return; }
  togglePlay(false);
  const p = PLN[name] || { X: 0, Y: 0 };
  window.GROUND.open({ interior: kind, spawn: name === 'Side Door of Erebor' ? 'door' : 'gate', X: p.X, Y: p.Y, t: S.t, title: HALL_TITLE[kind], sub: '', run, weatherAt, staticAt, places: PL, peaks: GEO.PEAKS, onExit: () => {} });
}
function distLine(X, Y) {
  const d = Math.hypot(X, Y);
  return `${d.toFixed(0)} mi (${(d / 3).toFixed(0)} leagues) from Hobbiton`;
}
function showPlace(p) {
  const [lon, lat] = GEN.toLL(p.X, p.Y);
  const b = biomeAt(p.X, p.Y);
  const adm = adminAt(p.X, p.Y);
  openCard(`<div class="kind">${TYPE_LABEL[p.type] || p.type}</div><h1>${esc(p.name)}</h1>${PEAKN[p.name] && PEAKN[p.name].alt ? `<div class="alt">${esc(PEAKN[p.name].alt)}</div>` : ''}
    <p>${esc(p.desc)}</p>
    <dl><dt>Realm</dt><dd>${esc(p.realm)}${adm ? ' · ' + esc(adm) : ''}</dd><dt>People</dt><dd>${esc(PEOPLE_LABEL[p.people] || p.people)}</dd>${p.pop ? `<dt>Population</dt><dd>~${p.pop.toLocaleString()} <small style="color:var(--faint)">estimate</small></dd>` : ''}
    <dt>Ground</dt><dd>${esc(b.name)}</dd><dt>Elevation</dt><dd>${Math.round(Math.max(0, b.h))} m · ${Math.round(Math.max(0, b.h) * 3.281).toLocaleString()} ft</dd>
    <dt>Position</dt><dd class="mono">${fmtLL(lon, lat)}<br>${fmtXY(p.X, p.Y)}</dd><dt>Distance</dt><dd>${distLine(p.X, p.Y)}</dd></dl>
    <div class="eyebrow">Weather · ${esc(WX.parts(S.t).name)} ${WX.fmtTime(WX.parts(S.t).hour)}</div><div class="wxwrap">${wxBlock(p.X, p.Y)}</div>
    <div class="btns" style="margin-top:12px"><button class="btn primary" data-act="ground"><svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.2"/><path d="M12 8v7M8.5 11h7M12 15l-3 6M12 15l3 6"/></svg>Ground view</button>${hallBtn(p.name)}<button class="btn" data-act="fly">Fly over</button><button class="btn" data-act="measure">Measure from here</button></div>`,
    { kind: 'place', X: p.X, Y: p.Y, name: p.name, zoom: ZOOM_FOR[p.type] });
}
function showPoint(X, Y, o = {}) {
  const [lon, lat] = GEN.toLL(X, Y);
  const b = biomeAt(X, Y);
  const adm = adminAt(X, Y), ppl = peopleAt(X, Y), np = nearestPlace(X, Y);
  const title = o.name || b.name.split(' · ').pop();
  openCard(`<div class="kind">${o.kind ? TYPE_LABEL[o.kind] || o.kind : 'Location'}</div><h1>${esc(title)}</h1>${o.alt ? `<div class="alt">${esc(o.alt)}</div>` : ''}
    <dl><dt>Ground</dt><dd>${esc(b.name)}</dd><dt>Elevation</dt><dd>${b.h > 0 ? Math.round(b.h) + ' m · ' + Math.round(b.h * 3.281).toLocaleString() + ' ft' : Math.round(-b.h) + ' m below sea level'}</dd>
    <dt>Realm</dt><dd>${esc(realmAt(X, Y))}${adm ? ' · ' + esc(adm) : ''}</dd>${ppl ? `<dt>Peoples</dt><dd>${esc(ppl)}</dd>` : ''}
    <dt>Nearest</dt><dd>${esc(np.p.name)}, ${np.d.toFixed(np.d < 10 ? 1 : 0)} mi</dd>
    <dt>Position</dt><dd class="mono">${fmtLL(lon, lat)}<br>${fmtXY(X, Y)}</dd><dt>Distance</dt><dd>${distLine(X, Y)}</dd></dl>
    <div class="eyebrow">Weather · ${esc(WX.parts(S.t).name)} ${WX.fmtTime(WX.parts(S.t).hour)}</div><div class="wxwrap">${wxBlock(X, Y)}</div>
    <div class="btns" style="margin-top:12px">${b.h > 0 ? `<button class="btn primary" data-act="ground"><svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.2"/><path d="M12 8v7M8.5 11h7M12 15l-3 6M12 15l3 6"/></svg>Ground view</button>` : ''}${hallBtn(o.name)}<button class="btn" data-act="measure">Measure from here</button></div>`,
    { kind: 'point', X, Y, name: title, zoom: ZOOM_FOR[o.kind] || 12 });
}

map.on('click', e => {
  const [X, Y] = GEN.toXY(e.lngLat.lng, e.lngLat.lat);
  if (S.pick === 'ground') { toggleGroundPick(false); openGround(X, Y); return; }
  if (S.measure) { S.measure.push([X, Y]); drawMeasure(); return; }
  const f = map.queryRenderedFeatures([[e.point.x - 6, e.point.y - 6], [e.point.x + 6, e.point.y + 6]], { layers: ['places-1', 'places-2', 'places-3', 'places-4', 'places-5', 'places-infra', 'places-beacons', 'peaks'].filter(id => map.getLayer(id)) });
  if (f.length) {
    const p = f[0].properties;
    if (p.id !== undefined) { showPlace(PL[p.id]); return; }
    const pk = PEAKN[p.name]; if (pk) { showPoint(pk.x, pk.y, { name: pk.name, alt: pk.alt, kind: 'peak' }); return; }
  }
  showPoint(X, Y);
});
map.on('mousemove', e => {
  const f = map.queryRenderedFeatures(e.point, { layers: ['places-1', 'places-2', 'places-3', 'places-4', 'places-5', 'peaks'].filter(id => map.getLayer(id)) });
  map.getCanvas().style.cursor = S.pick || S.measure ? 'crosshair' : f.length ? 'pointer' : '';
  statusAt(e.lngLat);
});

/* ---------------- status ---------------- */
let stT = 0;
function statusAt(lngLat) {
  const now = performance.now(); if (now - stT < 60) return; stT = now;
  const [X, Y] = GEN.toXY(lngLat.lng, lngLat.lat);
  const h = GEN.evaluate(X, Y, 0.3);
  $('#s1').innerHTML = `<b>${fmtLL(lngLat.lng, lngLat.lat)}</b> · ${GEN.R.s > 0 ? Math.round(h) + ' m' : 'sea'}`;
  $('#s2').textContent = fmtXY(X, Y) + ' of Hobbiton';
}
function updateScale() {
  const c = map.getCanvas(), y = c.clientHeight - 60, x = c.clientWidth / 2;
  const a = map.unproject([x - 50, y]), b = map.unproject([x + 50, y]);
  const pa = GEN.toXY(a.lng, a.lat), pb = GEN.toXY(b.lng, b.lat);
  const mi100 = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
  if (!isFinite(mi100) || mi100 <= 0) { $('#scale').innerHTML = ''; return; }
  const nice = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].find(v => v / mi100 * 100 >= 45) || 1000;
  const w = nice / mi100 * 100;
  $('#scale').innerHTML = `<div class="sbar" style="width:${w.toFixed(0)}px"></div><span>${nice < 1 ? Math.round(nice * 1760) + ' yd' : nice + ' mi'} · ${nice >= 3 ? (nice / 3).toFixed(nice >= 30 ? 0 : 1) + ' leagues' : Math.round(nice * 1609) + ' m'}</span>`;
}
map.on('moveend', updateScale); updateScale();

/* ---------------- measure ---------------- */
function toggleMeasure(on) {
  const want = on === undefined ? !S.measure : on;
  S.measure = want ? [] : null;
  document.body.classList.toggle('pick', !!S.measure);
  document.querySelector('[data-p="measure"]').classList.toggle('on', !!S.measure);
  if (!want) { map.getSource('measure').setData(FC([])); $('#toast').classList.remove('open'); }
  else toast('Click points on the map to measure. Press Esc or the ruler again to finish.', 0);
}
function drawMeasure() {
  const m = S.measure; if (!m) return;
  const feats = m.map(p => pt(p[0], p[1], {}));
  if (m.length > 1) feats.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: lineLL(m) }, properties: {} });
  map.getSource('measure').setData(FC(feats));
  let d = 0; for (let i = 1; i < m.length; i++) d += Math.hypot(m[i][0] - m[i - 1][0], m[i][1] - m[i - 1][1]);
  if (m.length > 1) toast(`<b>${d.toFixed(1)} miles</b> · ${(d / 3).toFixed(1)} leagues · ${(d * 1.609).toFixed(0)} km — about ${Math.max(1, Math.round(d / 20))} days on foot at a hobbit's pace, ${Math.max(1, Math.round(d / 45))} riding`, 0);
}
let toastTimer = 0;
function toast(html, ms = 3500) {
  const t = $('#toast'); t.innerHTML = html; t.classList.add('open');
  clearTimeout(toastTimer); if (ms) toastTimer = setTimeout(() => t.classList.remove('open'), ms);
}
addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (S.measure) toggleMeasure(false); if (S.pick) toggleGroundPick(false); stopTour(); }
  if (e.target.matches('input, select, textarea') || $('#ground').classList.contains('open')) return;
  if (e.key === ' ') { togglePlay(); e.preventDefault(); }
});

/* ---------------- ground view hook ---------------- */
function toggleGroundPick(on) {
  const want = on === undefined ? S.pick !== 'ground' : on;
  S.pick = want ? 'ground' : null;
  document.body.classList.toggle('pick', want);
  document.querySelector('[data-p="ground"]').classList.toggle('on', want);
  if (want) toast('Click any spot on land to stand there.', 0); else $('#toast').classList.remove('open');
}
async function openGround(X, Y, name) {
  if (!window.GROUND) { toast('The ground view is still loading. Try again in a moment.'); return; }
  const np = nearestPlace(X, Y);
  togglePlay(false);
  let heading = map.getBearing();
  if (name && PLN[name]) {
    // stand a little way off and look toward the place
    const p = PLN[name];
    const off = Math.max(0.12, (p.r || 0.2) * 0.55 + 0.08), a = (hashAng(p.name));
    X = p.X + Math.cos(a) * off; Y = p.Y + Math.sin(a) * off;
    heading = (Math.atan2(p.X - X, p.Y - Y) * 180 / Math.PI + 360) % 360;
  }
  window.GROUND.open({ X, Y, heading, t: S.t, title: name || (np.d < 3 ? 'Near ' + np.p.name : biomeAt(X, Y).name), sub: fmtXY(X, Y) + ' of Hobbiton', run, weatherAt, staticAt, places: PL, peaks: GEO.PEAKS, onExit: () => {} });
}
function hashAng(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return (h % 628) / 100; }

/* ---------------- controls ---------------- */
$('#zin').onclick = () => map.zoomIn();
$('#zout').onclick = () => map.zoomOut();
$('#compass').onclick = () => map.easeTo({ bearing: 0, pitch: 0 });
map.on('rotate', () => { $('#compass svg').style.transform = `rotate(${-map.getBearing()}deg)`; });
$('#b3d').onclick = () => { S.terrain = S.terrain === false; map.setTerrain(S.terrain === false ? null : { source: 'dem', exaggeration: S.exag || 1.35 }); $('#b3d').classList.toggle('on', S.terrain !== false); };
$('#bglobe').onclick = () => { const g = !$('#bglobe').classList.contains('on'); map.setProjection({ type: g ? 'globe' : 'mercator' }); $('#bglobe').classList.toggle('on', g); };
$('#bwx').onclick = () => setWxMaster(!S.wxMaster);
$('#bhome').onclick = () => map.flyTo({ center: ll(483, -361), zoom: 4.1, pitch: 28, bearing: 0, duration: 4500 });

// Phone layout: the right-hand controls dock behind one handle. They start docked, slide out on a tap,
// and dock again when the map is dragged or pinched, or after a few idle seconds.
const ctrlEl = $('#ctrl'), phone = matchMedia('(max-width: 760px)');
let ctrlTimer = 0;
function dockCtrl(docked) {
  clearTimeout(ctrlTimer);
  ctrlEl.classList.toggle('docked', docked);
  $('#ctog').setAttribute('aria-expanded', docked ? 'false' : 'true');
  if (!docked && phone.matches) ctrlTimer = setTimeout(() => dockCtrl(true), 6000);
}
dockCtrl(phone.matches);
phone.addEventListener('change', e => dockCtrl(e.matches));
$('#ctog').onclick = () => dockCtrl(!ctrlEl.classList.contains('docked'));
$('#cgrps').addEventListener('click', () => { if (phone.matches) dockCtrl(false); });
map.on('movestart', e => { if (phone.matches && e.originalEvent && !ctrlEl.classList.contains('docked')) dockCtrl(true); });

/* ---------------- tours ---------------- */
const TOURS = [
  { name: 'The Road Goes Ever On', blurb: 'The Ring\'s journey from Bag End to the Cracks of Doom.', stops: [['Hobbiton', 14.6, 62, 40, 'The Hill and Bag End, where the road begins.'], ['Bree', 13.4, 60, 90, 'The crossroads town and The Prancing Pony.'], ['Amon Sûl', 12.5, 66, 20, 'Weathertop, the ruined watch-tower of Arnor.'], ['Rivendell', 12.6, 70, 120, 'Elrond\'s house in its hidden valley.'], ['Caradhras', 11, 72, 200, 'The cruel Redhorn, where the snow turned the Company back.'], ['Caras Galadhon', 12.6, 64, 30, 'The golden wood of Lórien in the season of fading.'], ['Argonath', 13.4, 72, 180, 'The Pillars of the Kings at the gates of Gondor.'], ['Orodruin', 11.3, 70, 250, 'Mount Doom, above the ash of Gorgoroth.']] },
  { name: 'Kingdoms of Men', blurb: 'Edoras, the Hornburg, Isengard and the White City.', stops: [['Edoras', 13.4, 66, 160, 'Meduseld on its green hill below the White Mountains.'], ['Helm\'s Deep', 13.3, 70, 220, 'The Hornburg and the Deeping Wall.'], ['Isengard', 13.3, 60, 30, 'The Ring of Isengard around the black tower.'], ['Minas Tirith', 13.6, 68, 260, 'The Tower of Guard, seven walls on the knee of Mindolluin.'], ['Osgiliath', 12.8, 60, 300, 'The ruined Citadel of the Stars astride the Anduin.'], ['Pelargir', 12.8, 60, 20, 'Gondor\'s great river-port.'], ['Dol Amroth', 12.8, 64, 300, 'Imrahil\'s castle over the Bay of Belfalas.']] },
  { name: 'The Wild North', blurb: 'Havens, lost kingdoms and dragon country.', stops: [['Mithlond', 12, 60, 250, 'The Grey Havens at the head of the Gulf of Lune.'], ['Annúminas', 12.4, 56, 20, 'Ruined capital of Arnor on Lake Evendim.'], ['Carn Dûm', 11.4, 64, 90, 'The Witch-king\'s fortress in Angmar.'], ['Mount Gundabad', 11, 66, 180, 'Orc-hold at the northern end of the Misty Mountains.'], ['Erebor', 11.4, 68, 200, 'The Lonely Mountain and the city of Dale.'], ['Esgaroth', 13.8, 64, 330, 'Lake-town on its piles.'], ['Thranduil\'s Halls', 12.6, 62, 0, 'The Elvenking\'s halls under Mirkwood.']] },
  { name: 'The Planet', blurb: 'Pull back to orbit and circle Arda.', orbit: true, stops: [] },
];
let tourTok = 0;
function stopTour() { tourTok++; $('#caption').classList.remove('open'); }
async function playTour(t) {
  const tok = ++tourTok;
  const cap = $('#caption');
  const stopIf = () => tok !== tourTok;
  map.once('mousedown', stopTour); map.once('touchstart', stopTour); map.once('wheel', stopTour);
  if (t.orbit) {
    cap.innerHTML = `<h3>Arda from orbit</h3><p>After the Downfall of Númenor the world was made round. Middle-earth sits in the northern hemisphere, with the New Lands far to the west.</p>`; cap.classList.add('open');
    map.flyTo({ center: [10, 30], zoom: 1.2, pitch: 0, bearing: 0, duration: 4000 });
    await sleep(4200);
    let lng = 10;
    while (!stopIf()) { lng += 0.6; map.jumpTo({ center: [((lng + 180) % 360) - 180, 28] }); await sleep(33); }
    return;
  }
  for (const [name, zoom, pitch, bearing, text] of t.stops) {
    if (stopIf()) return;
    const p = PLN[name] || (PEAKN[name] && { X: PEAKN[name].x, Y: PEAKN[name].y, name });
    cap.innerHTML = `<h3>${esc(name)}</h3><p>${esc(text)}</p><div class="btns"><button class="btn" id="capStop">End flight</button></div>`;
    cap.classList.add('open'); $('#capStop').onclick = stopTour;
    map.flyTo({ center: ll(p.X, p.Y), zoom, pitch, bearing, duration: 7000, curve: 1.6, essential: true });
    await new Promise(r => map.once('moveend', r));
    if (stopIf()) return;
    const t0 = performance.now();
    while (performance.now() - t0 < 5500 && !stopIf()) { map.setBearing(map.getBearing() + 0.08); await sleep(16); }
  }
  if (!stopIf()) cap.classList.remove('open');
}

/* ---------------- boot sequence ---------------- */
buildTicks();
setTime(S.t);
statusAt(map.getCenter());
setWx('clouds', true);
lstep('The road goes ever on…', 100);
await sleep(250);
$('#loader').classList.add('gone');
setTimeout(() => $('#loader').remove(), 1200);
await sleep(1600);
if (map.getZoom() < 2) map.flyTo({ center: ll(451, -315), zoom: 4.0, pitch: 25, bearing: 0, duration: 6500, curve: 1.3, essential: true });

window.ARDA = { map, S, setTime, GEO, showPlace, openGround, openHalls, PL, PLN, flyToXY, setWx, setGroup, setBase, openPanel, playTour, TOURS };
document.title = document.title;
})().catch(e => {
  console.error(e);
  const s = document.getElementById('lstep');
  if (s) { s.textContent = 'Something went wrong while building the world: ' + e.message; s.classList.add('err'); }
});
