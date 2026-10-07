/* Pixel-art heads for the travellers, and group badges for parties that travel together.
   A head is composed on a 14×16 grid from parts (hair, beard, hat, ears) in a character's colours, given a
   one-pixel dark outline, and drawn at 3–4× with no smoothing. Parties within a mile or two of each other
   merge into one badge; a set of companions that matches a named group (the Fellowship, the Three
   Hunters…) gets that group's own design. */
const AVATARS = (() => {
const W = 14, H = 16, OUT = '#16110d';
// [skin, hair, hairDark, beard, beardDark, hat, hatDark] — any may be null
const C = {
  frodo:   { name: 'Frodo',     skin: '#f2c7a5', hair: ['#4a3020', '#2e1d12'], style: 'curly', ears: 'hobbit', blush: 1 },
  sam:     { name: 'Sam',       skin: '#e9b48c', hair: ['#9a6a3a', '#6e4a26'], style: 'curly', ears: 'hobbit', blush: 1 },
  merry:   { name: 'Merry',     skin: '#f0c19d', hair: ['#b07a34', '#7f5420'], style: 'curly', ears: 'hobbit', blush: 1 },
  pippin:  { name: 'Pippin',    skin: '#f3c6a2', hair: ['#a8562c', '#783a1c'], style: 'curly', ears: 'hobbit', blush: 1 },
  bilbo:   { name: 'Bilbo',     skin: '#efc29f', hair: ['#6b4526', '#4a2f19'], style: 'curly', ears: 'hobbit', blush: 1 },
  bilboOld:{ name: 'Bilbo',     skin: '#ecc8ad', hair: ['#e8e4dc', '#b8b2a6'], style: 'curly', ears: 'hobbit', blush: 1, wrinkles: 1 },
  aragorn: { name: 'Aragorn',   skin: '#e8b892', hair: ['#2e2420', '#1a1412'], style: 'shaggy', beard: 'stubble', beardC: ['#7a5a46', '#5a4032'] },
  legolas: { name: 'Legolas',   skin: '#f6dcc4', hair: ['#f0d77a', '#c9a94a'], style: 'long', ears: 'elf' },
  gimli:   { name: 'Gimli',     skin: '#f0c4a0', hair: ['#a8401c', '#6e2810'], style: 'none', beard: 'dwarf', beardC: ['#a8401c', '#6e2810'], hat: 'helm', brows: 1 },
  boromir: { name: 'Boromir',   skin: '#f0c29c', hair: ['#6b4a2a', '#4a321c'], style: 'short', beard: 'short', beardC: ['#6b4a2a', '#4a321c'] },
  gandalf: { name: 'Gandalf',   skin: '#e6b998', hair: ['#c9c9cc', '#9a9aa0'], style: 'sides', beard: 'wizard', beardC: ['#c9c9cc', '#9a9aa0'], hat: 'wizard', hatC: ['#8e8e94', '#5f5f66'], brows: 1 },
  gandalfW:{ name: 'Gandalf',   skin: '#ecc3a3', hair: ['#fbfbf6', '#d6d6d0'], style: 'long', beard: 'wizard', beardC: ['#fbfbf6', '#d6d6d0'], brows: 1 },
  theoden: { name: 'Théoden',   skin: '#e2b08c', hair: ['#e4d9b0', '#b8a978'], style: 'long', beard: 'short', beardC: ['#e4d9b0', '#b8a978'], hat: 'crown' },
  arwen:   { name: 'Arwen',     skin: '#f6e0cf', hair: ['#231c22', '#110d10'], style: 'long', ears: 'elf', hat: 'circlet', hatC: ['#e8ecf4', '#b9c2d4'] },
  elrond:  { name: 'Elrond',    skin: '#efd2b9', hair: ['#2a2224', '#151012'], style: 'long', ears: 'elf', hat: 'circlet', hatC: ['#e8ecf4', '#b9c2d4'] },
  galadriel:{ name: 'Galadriel', skin: '#f8e4d2', hair: ['#f6de88', '#d6b65a'], style: 'long', ears: 'elf', hat: 'circlet', hatC: ['#fff6d8', '#d8c48a'] },
  thorin:  { name: 'Thorin',    skin: '#efc19c', hair: ['#262021', '#141011'], style: 'none', beard: 'dwarf', beardC: ['#262021', '#141011'], hat: 'dwarfhood', hatC: ['#2f4f86', '#1e3560'], brows: 1 },
  nazgul:  { name: 'Nazgûl',    hood: 1 },
};

// which characters travel in each journey; [id, from, to] limits a companion to part of the journey
const JOURNEY = {
  war: {
    'Frodo & Sam': ['frodo', 'sam'], 'Aragorn': ['aragorn'], 'Merry & Pippin': ['merry', 'pippin'], 'Pippin': ['pippin'],
    'Merry with Théoden': ['merry', 'theoden'], 'Gandalf the Grey': ['gandalf'], 'The Black Riders': ['nazgul'], 'Boromir': ['boromir'],
    'Legolas': ['legolas'], 'Gimli': ['gimli'], 'Gandalf: to Orthanc': ['gandalf'], 'Gandalf the White': ['gandalfW'],
  },
  return: {
    'Frodo & Sam homeward': ['frodo', 'sam'], 'Merry & Pippin homeward': ['merry', 'pippin'], 'Aragorn & Arwen': ['aragorn', ['arwen', '3019 6 31']],
    'Arwen comes to the City': ['arwen', 'elrond'], 'Gandalf to Bombadil': ['gandalfW'], 'Bilbo, Elrond & Galadriel': ['bilboOld', 'elrond', 'galadriel'],
    'Frodo\'s last journey': ['frodo'], 'Sam to the Havens and home': ['sam'], 'Merry & Pippin to the Havens': ['merry', 'pippin'],
  },
  hobbit: { 'Bilbo & Thorin\'s Company': ['bilbo', 'thorin', ['gandalf', null, '2941 7 14']], 'Gandalf: the White Council at Dol Guldur': ['gandalf'] },
};
const P = s => typeof s === 'string' ? WX.parse(s) : s;
function charsOf(story, name, t) {
  const L = (JOURNEY[story] || {})[name] || [];
  return L.filter(c => typeof c === 'string' || ((c[1] == null || t >= P(c[1])) && (c[2] == null || t < P(c[2])))).map(c => typeof c === 'string' ? c : c[0]);
}

// Named companies, most specific first. `when` limits the name to the days it was true.
const has = (S, ...ids) => ids.every(i => S.has(i));
const HOBBITS = ['frodo', 'sam', 'merry', 'pippin'];
const GROUPS = [
  { name: 'The Fellowship of the Ring', frame: '#1c2a20', edge: '#d9ac52', emblem: 'ring', when: ['3018 12 25', '3019 2 26.6'], test: S => has(S, 'frodo', 'sam', 'aragorn', 'legolas', 'gimli') && S.size >= 7, order: ['gandalf', 'aragorn', 'boromir', 'legolas', 'gimli', 'frodo', 'sam', 'merry', 'pippin'] },
  { name: 'The Three Hunters', frame: '#1f3a24', edge: '#9bc27a', emblem: 'horse', test: S => S.size === 3 && has(S, 'aragorn', 'legolas', 'gimli') },
  { name: 'Gandalf and the Three Hunters', frame: '#e8e6de', edge: '#ffffff', emblem: 'star', test: S => S.size === 4 && has(S, 'aragorn', 'legolas', 'gimli', 'gandalfW') },
  { name: 'The Four Hobbits', frame: '#2c3d1c', edge: '#e2c25a', emblem: 'leaf', test: S => S.size === 4 && has(S, ...HOBBITS) },
  { name: 'The Hobbits and Strider', frame: '#2c3d1c', edge: '#c9a14a', emblem: 'leaf', test: S => S.size === 5 && has(S, ...HOBBITS, 'aragorn') },
  { name: 'Thorin and Company', frame: '#1e2c48', edge: '#e0b84e', emblem: 'key', test: S => has(S, 'bilbo', 'thorin') },
  { name: 'The Nine', frame: '#0c0b10', edge: '#7a1d24', emblem: 'eye', test: S => S.size === 1 && S.has('nazgul'), show: ['nazgul', 'nazgul', 'nazgul'] },
  { name: 'The Ring-bearers', frame: '#1b2433', edge: '#f2d06b', emblem: 'ring', test: S => S.size === 2 && has(S, 'frodo', 'bilboOld') },
];

/* ---- one head on the 14×16 grid ---- */
function grid(id) {
  const c = C[id], g = Array.from({ length: H }, () => Array(W).fill(null));
  const set = (x, y, v) => { if (x >= 0 && x < W && y >= 0 && y < H && v) g[y][x] = v; };
  const rect = (x0, y0, x1, y1, v) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, v); };
  const tex = (x, y, a, b) => ((x * 7 + y * 3) % 5 === 0 ? b : a);           // a little curl texture
  if (c.hood) {
    const k = '#1b1a20', k2 = '#2b2a33';
    rect(5, 2, 8, 2, k); rect(4, 3, 9, 3, k); rect(3, 4, 10, 4, k); rect(2, 5, 11, 15, k); rect(1, 11, 12, 15, k);
    for (let y = 3; y < 16; y++) set(y % 3 ? 3 : 4, y, k2);
    rect(4, 7, 9, 12, '#050507'); set(5, 9, '#ff5a3c'); set(8, 9, '#ff5a3c'); set(5, 10, '#7a1d24'); set(8, 10, '#7a1d24');
    return g;
  }
  const [h, hd] = c.hair || [null, null];
  // hair behind the face
  if (c.style === 'long') { for (let y = 7; y < 16; y++) { set(2, y, tex(2, y, h, hd)); set(11, y, tex(11, y, h, hd)); } for (let y = 10; y < 16; y++) { set(1, y, h); set(12, y, hd); } }
  if (c.style === 'shaggy') for (let y = 7; y < 13; y++) { set(2, y, tex(2, y, h, hd)); set(11, y, tex(11, y, h, hd)); }
  if (c.style === 'short' || c.style === 'sides') for (let y = 7; y < 12; y++) { set(2, y, h); set(11, y, hd); }
  // face
  for (let y = 6; y <= 13; y++) for (let x = 3; x <= 10; x++) {
    if ((y === 6 || y === 13) && (x === 3 || x === 10)) continue;
    set(x, y, x === 10 || y === 13 ? shade(c.skin, 0.88) : c.skin);
  }
  // hair on top
  if (['curly', 'long', 'shaggy', 'short'].includes(c.style)) {
    rect(4, 3, 9, 3, h); rect(3, 4, 10, 4, h); rect(2, 5, 11, 6, h);
    for (let y = 3; y <= 6; y++) for (let x = 2; x <= 11; x++) if (g[y][x] === h) set(x, y, tex(x, y, h, hd));
    if (c.style === 'curly') { set(4, 2, h); set(6, 2, h); set(8, 2, hd); set(2, 7, h); set(11, 7, hd); set(2, 8, hd); set(11, 8, h); set(4, 7, h); set(6, 7, hd); set(8, 7, h); set(9, 7, h); }
    if (c.style === 'shaggy') { set(3, 7, h); set(4, 7, hd); set(9, 7, h); set(10, 7, hd); set(6, 7, h); }
    if (c.style === 'short') { set(3, 7, h); set(10, 7, hd); }
    if (c.style === 'long') { set(3, 7, h); set(10, 7, hd); }
  }
  // ears
  if (c.ears === 'hobbit') { set(2, 9, c.skin); set(11, 9, shade(c.skin, 0.88)); set(2, 8, c.skin); set(11, 8, shade(c.skin, 0.88)); }
  if (c.ears === 'elf') { set(2, 9, c.skin); set(1, 8, c.skin); set(0, 7, c.skin); set(11, 9, shade(c.skin, 0.88)); set(12, 8, shade(c.skin, 0.88)); set(13, 7, shade(c.skin, 0.88)); }
  if (!c.ears && c.style !== 'long' && c.hat !== 'dwarfhood') { set(2, 9, c.skin); set(11, 9, shade(c.skin, 0.88)); }
  // eyes, brows, mouth, cheeks
  set(5, 9, '#1a1410'); set(8, 9, '#1a1410');
  if (c.brows) { const b = (c.beardC || c.hair)[1]; set(4, 8, b); set(5, 8, b); set(8, 8, b); set(9, 8, b); }
  set(6, 11, shade(c.skin, 0.7)); set(7, 11, shade(c.skin, 0.7));
  if (c.blush) { set(4, 10, '#e8968a'); set(9, 10, '#e8968a'); }
  if (c.wrinkles) { set(4, 8, shade(c.skin, 0.8)); set(9, 8, shade(c.skin, 0.8)); }
  // beards
  const [b, bd] = c.beardC || [null, null];
  if (c.beard === 'stubble') { for (let x = 4; x <= 9; x++) if (x % 2) set(x, 12, b); for (let x = 4; x <= 9; x++) set(x, 13, x % 2 ? bd : b); }
  if (c.beard === 'short') { set(5, 11, b); set(8, 11, b); set(3, 12, b); set(10, 12, bd); rect(4, 13, 9, 13, b); rect(5, 14, 8, 14, bd); set(6, 12, b); set(7, 12, b); }
  if (c.beard === 'wizard') { set(4, 11, b); set(5, 11, b); set(8, 11, b); set(9, 11, b); rect(3, 12, 10, 14, b); rect(4, 15, 9, 15, bd); for (let y = 12; y <= 15; y++) set(y % 2 ? 6 : 8, y, bd); }
  if (c.beard === 'dwarf') { set(2, 10, b); set(11, 10, bd); set(3, 11, b); set(4, 11, b); set(5, 11, b); set(8, 11, b); set(9, 11, b); set(10, 11, bd); set(2, 11, b); set(11, 11, bd); rect(2, 12, 11, 14, b); set(6, 11, shade(c.skin, 0.7)); set(7, 11, shade(c.skin, 0.7)); rect(3, 15, 10, 15, bd); for (const x of [4, 9]) { set(x, 13, '#d9ac52'); set(x, 14, bd); } for (let y = 11; y <= 14; y++) set(y % 2 ? 6 : 7, y, bd); }
  // hats
  if (c.hat === 'wizard') {
    const [a, d] = c.hatC; rect(0, 6, 13, 6, d); rect(1, 5, 12, 5, a); rect(3, 4, 10, 4, a); rect(4, 3, 9, 3, a); rect(5, 2, 8, 2, a); rect(6, 1, 8, 1, a); set(9, 0, a); set(10, 0, d); set(8, 0, a);
    for (let y = 1; y <= 5; y++) set(4 + y + (y > 3 ? 1 : 0), y, d);
  }
  if (c.hat === 'helm') { const m = '#9aa0a8', md = '#6b7078'; rect(5, 2, 8, 2, m); rect(4, 3, 9, 3, m); rect(3, 4, 10, 5, m); set(9, 3, md); set(10, 4, md); set(10, 5, md); rect(2, 6, 11, 6, '#c9a03c'); set(6, 7, md); set(7, 7, md); set(2, 7, b); set(11, 7, bd); set(2, 8, b); set(11, 8, bd); set(2, 9, b); set(11, 9, bd); }
  if (c.hat === 'crown') { const y1 = '#e6c04e', y2 = '#b08a2a'; rect(3, 4, 10, 4, y1); set(3, 3, y1); set(6, 2, y1); set(7, 2, y2); set(6, 3, y1); set(7, 3, y2); set(10, 3, y2); set(6, 4, '#3f8a5a'); set(7, 4, '#3f8a5a'); }
  if (c.hat === 'circlet') { const [a, d] = c.hatC; rect(3, 6, 10, 6, a); set(10, 6, d); set(6, 6, '#bfe3ff'); set(7, 6, '#ffffff'); }
  if (c.hat === 'dwarfhood') {
    const [a, d] = c.hatC; rect(5, 2, 8, 2, a); rect(4, 3, 9, 3, a); rect(3, 4, 10, 4, a); rect(2, 5, 11, 6, a); for (let y = 7; y <= 13; y++) { set(2, y, a); set(11, y, d); }
    set(9, 1, '#c8ccd4'); set(10, 0, '#c8ccd4'); for (let x = 2; x <= 11; x++) set(x, 6, x % 2 ? d : a);
  }
  return g;
}
function shade(hex, f) { const n = parseInt(hex.slice(1), 16); const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f); return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1); }

// draw a head (with outline) into ctx at (x, y), each grid pixel s×s
const GCACHE = {};
function drawHead(ctx, id, x, y, s) {
  const g = GCACHE[id] || (GCACHE[id] = grid(id));
  ctx.fillStyle = OUT;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (g[j][i]) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const a = i + dx, b = j + dy; if (a < 0 || a >= W || b < 0 || b >= H || !g[b][a]) ctx.fillRect(x + (a + 1) * s, y + (b + 1) * s, s, s);
  }
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (g[j][i]) { ctx.fillStyle = g[j][i]; ctx.fillRect(x + (i + 1) * s, y + (j + 1) * s, s, s); }
}
const HW = (W + 2), HH = (H + 2);    // head size in grid pixels, outline included

function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function emblem(g, kind, cx, cy, r, edge) {
  g.save(); g.lineWidth = Math.max(2, r * 0.22);
  if (kind === 'ring') {           // the One Ring: a gold band behind the company
    g.strokeStyle = '#7a5a1a'; g.beginPath(); g.ellipse(cx, cy, r * 1.02, r * 0.5, 0, 0, 7); g.stroke();
    g.strokeStyle = '#f3cf5e'; g.lineWidth *= 0.6; g.beginPath(); g.ellipse(cx, cy - 1, r, r * 0.48, 0, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(255,240,190,0.9)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(cx, cy - 2, r * 0.95, r * 0.45, 0, 3.6, 5.4); g.stroke();
  } else if (kind === 'eye') {
    g.fillStyle = '#ff6a2c'; g.beginPath(); g.ellipse(cx, cy, r, r * 0.42, 0, 0, 7); g.fill(); g.fillStyle = '#120a0a'; g.fillRect(cx - 1.5, cy - r * 0.4, 3, r * 0.8);
  } else if (kind === 'star') {
    g.fillStyle = edge; g.beginPath(); for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, q = k % 2 ? r * 0.42 : r; g.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } g.fill();
  } else if (kind === 'leaf') {
    g.fillStyle = '#7fb84a'; g.beginPath(); g.ellipse(cx, cy, r * 0.55, r, 0.6, 0, 7); g.fill(); g.strokeStyle = '#3d6a22'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - r * 0.45, cy + r * 0.6); g.lineTo(cx + r * 0.45, cy - r * 0.6); g.stroke();
  } else if (kind === 'key') {
    g.strokeStyle = edge; g.beginPath(); g.arc(cx - r * 0.5, cy, r * 0.35, 0, 7); g.moveTo(cx - r * 0.15, cy); g.lineTo(cx + r, cy); g.moveTo(cx + r * 0.7, cy); g.lineTo(cx + r * 0.7, cy + r * 0.35); g.moveTo(cx + r * 0.95, cy); g.lineTo(cx + r * 0.95, cy + r * 0.3); g.stroke();
  } else if (kind === 'horse') {
    g.fillStyle = edge; g.beginPath(); g.moveTo(cx - r, cy + r * 0.5); g.lineTo(cx - r * 0.2, cy - r * 0.2); g.lineTo(cx + r * 0.2, cy - r * 0.8); g.lineTo(cx + r, cy - r * 0.3); g.lineTo(cx + r * 0.4, cy); g.lineTo(cx + r * 0.6, cy + r * 0.5); g.closePath(); g.fill();
  }
  g.restore();
}

/* An icon for one party: a single head on a disc of the journey's colour, or a badge for a company.
   Returns { canvas, name }. Canvas pixels are at 2× (addImage with pixelRatio 2). */
const ICACHE = {};
function icon(ids, color, t) {
  const S = new Set(ids);
  const grp = ids.length > 1 || S.has('nazgul') ? GROUPS.find(G => G.test(S) && (!G.when || (t >= P(G.when[0]) && t <= P(G.when[1])))) : null;
  const key = (grp ? grp.name : '') + '|' + [...S].sort().join(',') + '|' + color;
  if (ICACHE[key]) return ICACHE[key];
  const cv = document.createElement('canvas'), g = cv.getContext('2d');
  let name;
  if (ids.length === 1 && !grp) {
    const s = 4, w = HW * s, pad = 8; cv.width = w + pad * 2; cv.height = HH * s + pad + 6;
    g.fillStyle = color; g.strokeStyle = OUT; g.lineWidth = 3;
    g.beginPath(); g.arc(cv.width / 2, cv.height - 30, 28, 0, 7); g.fill(); g.stroke();
    drawHead(g, ids[0], pad, 0, s);
    name = C[ids[0]].name;
  } else {
    const show = grp && grp.show ? grp.show : grp && grp.order ? grp.order.filter(i => S.has(i)).concat([...S].filter(i => !grp.order.includes(i))) : [...S];
    const s = 4, hw = HW * s, step = Math.round(hw * (show.length > 5 ? 0.62 : 0.7));
    const two = show.length > 5, back = two ? show.slice(0, Math.floor(show.length / 2)) : [], front = two ? show.slice(back.length) : show;
    const rowW = n => hw + (n - 1) * step, width = Math.max(rowW(front.length), rowW(back.length) + step / 2);
    const lift = two ? Math.round(HH * s * 0.42) : 0, padX = two ? 26 : 14, padTop = two ? 18 : grp ? 10 : 6;
    cv.width = width + padX * 2; cv.height = HH * s + lift + padTop + (two ? 20 : 14);
    const frame = grp ? grp.frame : '#141a22', edge = grp ? grp.edge : color;
    if (grp && grp.emblem === 'ring' && two) {
      // the Fellowship: the One Ring as a golden halo around the company
      const cx = cv.width / 2, cy = cv.height * 0.56, rx = cv.width / 2 - 5, ry = cv.height * 0.42;
      g.fillStyle = 'rgba(20,26,22,0.88)'; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); g.fill();
      g.lineWidth = 9; g.strokeStyle = OUT; g.stroke(); g.lineWidth = 6; g.strokeStyle = '#c9952e'; g.stroke();
      g.lineWidth = 2.5; g.strokeStyle = '#ffe9a0'; g.beginPath(); g.ellipse(cx, cy - 1.5, rx - 1, ry - 1, 0, 3.5, 5.6); g.stroke();
      g.strokeStyle = 'rgba(255,150,60,0.55)'; g.lineWidth = 1.2; g.setLineDash([5, 4]); g.beginPath(); g.ellipse(cx, cy + 1, rx, ry, 0, 0.4, 2.7); g.stroke(); g.setLineDash([]);
    } else {
      g.fillStyle = frame; g.strokeStyle = OUT; g.lineWidth = 3; roundRect(g, 2, cv.height * 0.38, cv.width - 4, cv.height * 0.62 - 2, 16); g.fill(); g.stroke();
      g.strokeStyle = edge; g.lineWidth = 3; roundRect(g, 6, cv.height * 0.38 + 4, cv.width - 12, cv.height * 0.62 - 10, 12); g.stroke();
      if (grp && grp.emblem && grp.emblem !== 'ring') emblem(g, grp.emblem, cv.width - 18, cv.height * 0.38 + 2, 9, edge);
      if (grp && grp.emblem === 'ring') emblem(g, 'ring', cv.width - 20, cv.height * 0.38 + 2, 11, edge);
    }
    const x0 = (cv.width - rowW(back.length)) / 2, x1 = (cv.width - rowW(front.length)) / 2;
    back.forEach((id, k) => drawHead(g, id, x0 + k * step, padTop - 4, s));
    front.forEach((id, k) => drawHead(g, id, x1 + k * step, padTop - 4 + lift, s));
    name = grp ? grp.name : listNames(show);
  }
  return ICACHE[key] = { canvas: cv, name, key };
}
function listNames(ids) {
  const n = [...new Set(ids.map(i => C[i].name))];
  return n.length <= 2 ? n.join(' & ') : n.length <= 4 ? n.slice(0, -1).join(', ') + ' & ' + n[n.length - 1] : n.slice(0, 3).join(', ') + ` & ${n.length - 3} more`;
}
function dataURL(ids, color, t) { return icon(ids, color, t).canvas.toDataURL(); }
return { C, JOURNEY, GROUPS, charsOf, icon, dataURL, drawHead };
})();
if (typeof self !== 'undefined') self.AVATARS = AVATARS;
