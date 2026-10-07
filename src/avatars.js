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
function shade(hex, f) { const n = parseInt(hex.slice(1), 16); const q = v => Math.min(255, Math.round(v * f)), r = q((n >> 16) & 255), g = q((n >> 8) & 255), b = q(n & 255); return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1); }

/* ---- bodies: a front-facing walk in four frames (0, 2 standing; 1 left foot up; 3 right foot up) ---- */
const B = {
  frodo:    { tunic: '#4f6b3a', legs: '#7a5a3a', cloak: '#6f7f6a', feet: 'hobbit' },
  sam:      { tunic: '#8a6a3a', legs: '#5a4a30', cloak: '#5d6a52', feet: 'hobbit', gear: 'pack' },
  merry:    { tunic: '#b8862f', legs: '#4a5a6a', cloak: '#5d6a52', feet: 'hobbit' },
  pippin:   { tunic: '#3f5f8a', legs: '#6a5038', cloak: '#5d6a52', feet: 'hobbit' },
  bilbo:    { tunic: '#c84f2a', legs: '#6b5a40', cloak: '#3a6a3a', feet: 'hobbit' },
  bilboOld: { tunic: '#d9c49a', legs: '#6b5a40', cloak: '#8a7a5a', feet: 'hobbit' },
  aragorn:  { tunic: '#3f4a3a', legs: '#3a3028', cloak: '#2f4a2f', boots: '#2a1f18', gear: 'sword' },
  legolas:  { tunic: '#5f8a4a', legs: '#6a5a3a', cloak: '#4a6a3a', boots: '#5a4030', gear: 'bow' },
  gimli:    { tunic: '#8f969e', legs: '#5a4030', boots: '#3a2a1a', belt: '#c9a03c', gear: 'axe', mail: 1 },
  boromir:  { tunic: '#7a2a2a', legs: '#3a3a40', cloak: '#3e1818', boots: '#2a2020', gear: 'shield' },
  gandalf:  { robe: '#8e8e94', gear: 'staff', staff: '#6b4a2a' },
  gandalfW: { robe: '#f4f4ee', gear: 'staff', staff: '#e8e2d0' },
  theoden:  { tunic: '#3f6a3a', legs: '#5a4a30', cloak: '#2a4a2a', boots: '#3a2a1a', belt: '#c9a03c', gear: 'sword' },
  arwen:    { robe: '#5a4a7a' },
  elrond:   { robe: '#4a3a5a', belt: '#c8ccd4' },
  galadriel:{ robe: '#f8f6ee', belt: '#e6c04e' },
  thorin:   { tunic: '#2f4f86', legs: '#3a3028', cloak: '#1e3560', boots: '#2a1f18', belt: '#c9a03c', gear: 'sword' },
  nazgul:   { robe: '#1b1a20', rags: 1, gear: 'sword' },
};
const FW = W + 4, FH = H + 14, BY = H - 1;   // figure grid: head at (2, 0), body from row BY
function figGrid(id, f) {
  const g = Array.from({ length: FH }, () => Array(FW).fill(null)), b = B[id] || {}, c = C[id];
  const set = (x, y, v) => { if (x >= 0 && x < FW && y >= 0 && y < FH && v) g[y][x] = v; };
  const rect = (x0, y0, x1, y1, v) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, v); };
  const R = r => BY + r, skin = c.skin || '#2a2a33';
  const upL = f === 1 ? 1 : 0, upR = f === 3 ? 1 : 0;          // which foot is lifted
  const armL = f === 1 ? 1 : f === 3 ? -1 : 0, armR = -armL;    // arms swing opposite the legs
  // behind the body: cloak, pack, bow
  if (b.cloak) { rect(5, R(1), 12, R(10), b.cloak); for (let r = 3; r <= 9; r++) { set(3, R(r), shade(b.cloak, 0.8)); set(14, R(r), shade(b.cloak, 0.7)); } rect(4, R(2), 4, R(10), b.cloak); rect(13, R(2), 13, R(10), shade(b.cloak, 0.85)); }
  if (b.gear === 'pack') { rect(13, R(0), 15, R(5), '#7a5a32'); set(15, R(0), '#9aa0a8'); set(16, R(1), '#9aa0a8'); }
  if (b.gear === 'bow') { for (let r = -2; r <= 9; r++) set(r < 1 || r > 6 ? 3 : 2, R(r), '#8a6234'); for (let r = -1; r <= 8; r++) set(4, R(r), '#e8e2d0'); }
  if (b.robe) {
    const o = b.robe, d = shade(o, 0.78);
    rect(6, R(0), 11, R(6), o); rect(5, R(1), 12, R(2), o);
    rect(5, R(7), 12, R(9), o); const sw = f === 1 ? -1 : f === 3 ? 1 : 0;
    rect(4 + sw, R(10), 13 + sw, R(11), o); for (let x = 4 + sw; x <= 13 + sw; x++) set(x, R(11), b.rags && x % 2 ? null : d);
    for (let r = 1; r <= 10; r++) set(11 + (r > 6 ? 1 : 0), R(r), d);
    if (b.belt) rect(6, R(4), 11, R(4), b.belt);
    // feet peeping out under the hem
    const foot = b.rags ? '#050507' : '#5a4a3a';
    if (f !== 3) rect(6, R(12), 7, R(12), foot); if (f !== 1) rect(10, R(12), 11, R(12), foot);
    // sleeves and hands
    rect(4, R(2 + armL), 5, R(5 + armL), o); set(4, R(6 + armL), b.rags ? null : skin);
    rect(12, R(2 + armR), 13, R(5 + armR), d); set(13, R(6 + armR), b.rags ? null : skin);
  } else {
    // legs (behind the tunic's hem), then the tunic, belt and arms
    const legs = b.legs || '#5a4a3a', boot = b.boots;
    rect(6, R(7), 11, R(7), legs);
    rect(6, R(8), 7, R(11 - upL), legs); rect(10, R(8), 11, R(11 - upR), shade(legs, 0.85));
    if (b.feet === 'hobbit') {
      const hair = c.hair[0];
      rect(4, R(12 - upL), 7, R(12 - upL), skin); set(5, R(11 - upL), hair); set(6, R(11 - upL), hair);
      rect(10, R(12 - upR), 13, R(12 - upR), shade(skin, 0.9)); set(11, R(11 - upR), hair); set(12, R(11 - upR), hair);
    } else {
      rect(5, R(12 - upL), 7, R(12 - upL), boot || '#3a2a1a'); rect(10, R(12 - upR), 12, R(12 - upR), boot || '#3a2a1a');
      if (boot) { set(6, R(11 - upL), boot); set(7, R(11 - upL), boot); set(10, R(11 - upR), boot); set(11, R(11 - upR), boot); }
    }
    const t = b.tunic, td = shade(t, 0.8);
    rect(6, R(0), 11, R(7), t); rect(5, R(1), 12, R(2), t); for (let r = 1; r <= 7; r++) set(11, R(r), td);
    if (b.mail) for (let r = 1; r <= 7; r++) for (let x = 6; x <= 11; x++) if ((x + r) % 2) set(x, R(r), shade(t, 0.82));
    rect(6, R(5), 11, R(5), b.belt || shade(t, 0.55));
    rect(4, R(2 + armL), 5, R(5 + armL), t); set(4, R(6 + armL), skin); set(5, R(6 + armL), skin);
    rect(12, R(2 + armR), 13, R(5 + armR), td); set(12, R(6 + armR), shade(skin, 0.9)); set(13, R(6 + armR), shade(skin, 0.9));
  }
  // carried things, in front
  if (b.gear === 'staff') { const y0 = R(6 + armR); for (let y = 4; y <= R(12); y++) set(14, y, b.staff); set(14, 3, shade(b.staff, 1.2)); set(15, 4, b.staff); set(13, 4, b.staff); set(13, y0, skin); }
  if (b.gear === 'axe') { const y0 = R(6 + armR); for (let y = y0 - 7; y <= y0 + 1; y++) set(14, y, '#6b4a2a'); rect(15, y0 - 7, 16, y0 - 4, '#c8ccd4'); set(16, y0 - 7, '#9aa0a8'); set(16, y0 - 4, '#9aa0a8'); set(15, y0 - 3, '#9aa0a8'); }
  if (b.gear === 'sword') { set(5, R(4), '#c9a03c'); set(4, R(4), '#c9a03c'); for (let r = 5; r <= 9; r++) set(4 + (r > 7 ? -1 : 0), R(r), b.rags ? '#6b7078' : '#d6dae2'); }
  if (b.gear === 'shield') { rect(2, R(2 + armL), 5, R(6 + armL), '#6b2a2a'); set(2, R(2 + armL), null); set(5, R(2 + armL), null); set(2, R(6 + armL), null); set(5, R(6 + armL), null); set(3, R(4 + armL), '#d9d4c8'); set(4, R(4 + armL), '#d9d4c8'); }
  // the head on top (beards fall over the chest)
  const hg = GCACHE[id] || (GCACHE[id] = grid(id));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (hg[y][x]) set(x + 2, y, hg[y][x]);
  return g;
}
// draw a grid with a one-pixel dark outline at (x, y), each grid pixel s×s
function drawGrid(ctx, g, x, y, s) {
  const h = g.length, w = g[0].length;
  ctx.fillStyle = OUT;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (g[j][i]) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const a = i + dx, b = j + dy; if (a < 0 || a >= w || b < 0 || b >= h || !g[b][a]) ctx.fillRect(x + (a + 1) * s, y + (b + 1) * s, s, s);
  }
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (g[j][i]) { ctx.fillStyle = g[j][i]; ctx.fillRect(x + (i + 1) * s, y + (j + 1) * s, s, s); }
}
const GCACHE = {}, FCACHE = {};
function drawHead(ctx, id, x, y, s) { drawGrid(ctx, GCACHE[id] || (GCACHE[id] = grid(id)), x, y, s); }
function drawFigure(ctx, id, x, y, s, f) { const k = id + f; drawGrid(ctx, FCACHE[k] || (FCACHE[k] = figGrid(id, f)), x, y, s); }
const HW = (W + 2), HH = (H + 2), FIGW = FW + 2, FIGH = FH + 2;    // sizes in grid pixels, outline included

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

/* ---- mounts: side-view sprites facing right (the map mirrors them when a party heads west on screen) ---- */
const HORSE = { gandalf: ['#eef2f6', '#c4ccd8'], gandalfW: ['#eef2f6', '#c4ccd8'], theoden: ['#f4f4ee', '#cfcfc6'], aragorn: ['#5c5c66', '#3a3a42'],
  legolas: ['#d8d4cc', '#aaa49a'], gimli: ['#d8d4cc', '#aaa49a'], merry: ['#8a8a90', '#5e5e66'], pippin: ['#eef2f6', '#c4ccd8'], nazgul: ['#141218', '#050407'],
  elrond: ['#e0dcd4', '#b4aea4'], galadriel: ['#f4f2ea', '#d0ccc0'], arwen: ['#3a3438', '#1e1a1c'], boromir: ['#6a4a32', '#46301f'] };
const PONY = [['#7a5232', '#50351f'], ['#a0704a', '#6e4a2e'], ['#5a3e2a', '#3a2818'], ['#c8b090', '#9a8466']];
function blank(w, h) { return Array.from({ length: h }, () => Array(w).fill(null)); }
function paste(g, src, ox, oy, maxRow = 1e9) { for (let y = 0; y < src.length && y <= maxRow; y++) for (let x = 0; x < src[0].length; x++) if (src[y][x]) { const X = x + ox, Y = y + oy; if (Y >= 0 && Y < g.length && X >= 0 && X < g[0].length) g[Y][X] = src[y][x]; } }
function setp(g, x, y, v) { x = Math.round(x); y = Math.round(y); if (y >= 0 && y < g.length && x >= 0 && x < g[0].length && v) g[y][x] = v; }
function rectp(g, x0, y0, x1, y1, v) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setp(g, x, y, v); }
// the rider's head and torso (no legs), from the walking figure
const upper = (id, f) => figGrid(id, f === 1 || f === 3 ? 0 : 0).map((row, y) => y <= BY + 6 ? row : row.map(() => null));

// horse (or pony) and riders: 26 wide; the horse's back is at row BY + 6
function horseGrid(ids, f, k) {
  const W2 = 28, top = BY + 6, g = blank(W2, top + 12), hy = top - 1;           // hy: horse body top row
  const pony = ids.every(i => C[i].ears === 'hobbit') || ids.includes('thorin') || ids.includes('bilbo');
  const [c0, c1] = HORSE[ids[ids.length - 1]] || PONY[k % PONY.length], s = pony ? 0 : 1;
  const eye = ids.includes('nazgul') ? '#ff3b2f' : '#16110d';
  // tail
  for (let y = 0; y <= 6; y++) setp(g, 4 - (y > 3 ? 1 : 0) + (f % 2 && y > 4 ? 1 : 0), hy + 1 + y, c1); setp(g, 5, hy + 1, c1);
  // body
  rectp(g, 6, hy + 1, 19 + s, hy + 6, c0); rectp(g, 7, hy, 18 + s, hy, c0); rectp(g, 7, hy + 7, 18 + s, hy + 7, c1);
  // neck and head
  for (let y = 0; y < 6 + s; y++) rectp(g, 17 + s + Math.floor(y / 2), hy - y, 19 + s + Math.floor(y / 2), hy - y, c0);
  const hx = 20 + s + Math.floor((5 + s) / 2), hy2 = hy - 5 - s;
  rectp(g, hx - 1, hy2, hx + 2, hy2 + 2, c0); rectp(g, hx + 1, hy2 + 3, hx + 3, hy2 + 4, c0); setp(g, hx + 3, hy2 + 4, c1);
  setp(g, hx - 1, hy2 - 1, c0); setp(g, hx, hy2 - 1, c1); setp(g, hx + 1, hy2 + 1, eye);
  for (let y = 0; y < 6 + s; y++) setp(g, 17 + s + Math.floor(y / 2) - 1, hy - y, c1);     // mane
  // legs: a trot, diagonal pairs swinging
  const legs = [[7, 1], [9, 3], [16 + s, 3], [18 + s, 1]];
  for (const [lx, ph] of legs) {
    const lift = f === ph ? 1 : 0, sw = f === ph ? 1 : f === (ph + 2) % 4 ? -1 : 0;
    rectp(g, lx + sw, hy + 8, lx + sw, hy + 10 - lift, lx < 12 ? c1 : c0); setp(g, lx + sw, hy + 11 - lift, '#2a2420');
  }
  // tack
  rectp(g, 10, hy, 14, hy + 2, ids.includes('nazgul') ? '#2a0e10' : '#7a2a24'); setp(g, hx + 1, hy2 + 2, '#3a2a1a');
  // riders: the last is in front (Gimli sits before Legolas on Arod)
  ids.forEach((id, i) => {
    const ox = 3 + (ids.length - 1 - i) * -4 + (ids.length > 1 ? 4 : 0), bob = f % 2 ? 0 : 1;
    paste(g, upper(id, 0), ox, bob - 1);
    const b = B[id] || {}; const leg = b.legs || b.robe || '#5a4a3a';
    rectp(g, ox + 9, hy + 2 + bob - 1, ox + 10, hy + 5 + bob - 1, leg); setp(g, ox + 9, hy + 6 + bob - 1, b.boots || (C[id].ears === 'hobbit' ? C[id].skin : '#3a2a1a'));
  });
  return g;
}

// a Great Eagle (or, for the Nine, a fell beast) with riders on its back, wings swept back over them
function eagleGrid(ids, f) {
  const fell = ids.includes('nazgul'), W2 = 50, by = BY + 10, g = blank(W2, by + 14);
  const [b0, b1, hd, bk] = fell ? ['#2c2832', '#18151c', '#3a3540', '#8a8478'] : ['#7a5430', '#4e3418', '#d0a252', '#f0c040'];
  // a wing from the shoulder (rx, by) back to its tip; dy is the tip's height: up, level, down, level
  const wing = (rx, tipX, dy, c, edge) => {
    for (let x = tipX; x <= rx; x++) {
      const u = (rx - x) / (rx - tipX), y = by + 1 + dy * u, th = 2 + Math.round(3 * Math.sin(Math.PI * Math.min(1, u * 1.2)));
      rectp(g, x, Math.round(y) - 1, x, Math.round(y) + th, c);
      if ((x - tipX) % 3 === 0 && u > 0.25) setp(g, x, Math.round(y) + th + 1, edge);          // primaries
    }
  };
  const up = [-14, -4, 9, -4][f];
  wing(30, 6, up - 3, b1, fell ? '#100e12' : '#3a2412');                                         // far wing
  // body, tail, neck and head
  rectp(g, 12, by, 34, by + 6, b0); rectp(g, 14, by + 7, 32, by + 7, b1); rectp(g, 4, by + 3, 12, by + 5, b1); rectp(g, 1, by + 4, 5, by + 7, b1);
  if (fell) { for (let i = 0; i < 8; i++) rectp(g, 33 + i, by + 1 - i, 35 + i, by + 2 - i, b0); rectp(g, 41, by - 10, 46, by - 6, hd); setp(g, 44, by - 9, '#ff3b2f'); rectp(g, 47, by - 8, 48, by - 7, bk); }
  else { rectp(g, 32, by - 4, 39, by + 2, hd); rectp(g, 40, by - 3, 42, by - 1, bk); setp(g, 42, by, bk); setp(g, 37, by - 3, '#16110d'); rectp(g, 30, by - 2, 33, by + 3, hd); }
  rectp(g, 18, by + 8, 19, by + 9, bk); rectp(g, 26, by + 8, 27, by + 9, bk);                      // talons
  ids.slice(0, 2).forEach((id, i) => paste(g, upper(id, 0), 9 + i * 8, by - (BY + 6) + 1));
  wing(28, 3, up, fell ? '#3e3946' : '#946a3c', fell ? '#18151c' : '#4e3418');                    // near wing, over the riders' laps
  return g;
}

// boats: an Elven boat of Lórien, a black ship of Umbar, the white ship of the Havens, or barrels
function boatGrid(ids, f, kind) {
  const n = ids.length, bob = f === 1 ? -1 : f === 3 ? 1 : 0;
  if (kind === 'barrel') {
    const W2 = 14 * n + 4, g = blank(W2, BY + 14);
    ids.forEach((id, i) => {
      const ox = 2 + i * 14, b = (i + f) % 2 ? 1 : 0;
      paste(g, figGrid(id, 0).map((row, y) => y <= BY + 1 ? row : row.map(() => null)), ox - 2, b - 1);
      rectp(g, ox, BY + 2 + b, ox + 13, BY + 10 + b, '#8a5a30'); rectp(g, ox + 1, BY + 2 + b, ox + 12, BY + 2 + b, '#6a4222');
      for (const y of [BY + 4, BY + 8]) rectp(g, ox, y + b, ox + 13, y + b, '#4a4a50');
      setp(g, ox + 12, BY + 5 + b, '#a8784a');
    });
    rectp(g, 0, BY + 11, W2 - 1, BY + 11, '#9ac4e0'); for (let x = f % 2; x < W2; x += 3) setp(g, x, BY + 12, '#cfe6f4');
    return g;
  }
  const big = kind !== 'boat', W2 = Math.max(30, 9 * n + 18) + (big ? 6 : 0), deck = BY + 6 + (big ? 6 : 0), g = blank(W2, deck + 9);
  const hull = kind === 'blackship' ? ['#1e1c22', '#0e0d10'] : kind === 'sea' ? ['#e6e3dc', '#bdb8ac'] : ['#b8b4a8', '#8e897c'];
  if (big) {           // mast and sail
    const mx = Math.round(W2 / 2), sc = kind === 'blackship' ? '#18161a' : '#f6f4ee';
    rectp(g, mx, 1, mx, deck, '#6b4a2a'); rectp(g, mx - 9, 3, mx + 9, 3, '#6b4a2a');
    for (let y = 4; y <= deck - 6; y++) { const w = 8 + (y < 10 ? 1 : 0) - (f % 2 && y > deck - 9 ? 1 : 0); rectp(g, mx - w, y, mx + w, y, sc); }
    if (kind === 'blackship') { setp(g, mx - 1, 10, '#7a1d24'); setp(g, mx + 1, 10, '#7a1d24'); }
  }
  ids.forEach((id, i) => paste(g, upper(id, 0), 4 + i * 9 + (big ? 3 : 0), deck - (BY + 6) + bob + 2));
  // hull with a swan-necked prow on the elven craft
  for (let y = 0; y < 4; y++) rectp(g, 2 + y, deck + y + bob, W2 - 3 - y * 2, deck + y + bob, y < 2 ? hull[0] : hull[1]);
  rectp(g, 1, deck - 1 + bob, W2 - 2, deck - 1 + bob, kind === 'sea' ? '#c9a03c' : hull[1]);
  if (kind !== 'blackship') { rectp(g, W2 - 3, deck - 5 + bob, W2 - 2, deck + bob, hull[0]); setp(g, W2 - 1, deck - 5 + bob, hull[0]); setp(g, W2, deck - 5 + bob, '#c9a03c'); }
  else rectp(g, W2 - 3, deck - 3 + bob, W2 - 2, deck + bob, hull[0]);
  // oars and water
  if (kind === 'boat') for (let i = 0; i < n; i++) { const x = 8 + i * 9; setp(g, x + (f % 2), deck + 2 + bob, '#8a6234'); setp(g, x + 1 + (f % 2), deck + 3 + bob, '#8a6234'); }
  rectp(g, 0, deck + 5, W2 - 1, deck + 5, '#9ac4e0'); for (let x = f % 2; x < W2; x += 3) setp(g, x, deck + 6, '#cfe6f4');
  return g;
}

/* An icon for one party: a single walker on a coin of the journey's colour, or a company on its own
   token. f is the walk frame (0–3); companions step out of time with each other. Canvas pixels are at 2×
   (addImage with pixelRatio 2). Returns { canvas, name, key }. */
const ICACHE = {};
function groupOf(ids, t) {
  const S = new Set(ids);
  return ids.length > 1 || S.has('nazgul') ? GROUPS.find(G => G.test(S) && (!G.when || (t >= P(G.when[0]) && t <= P(G.when[1])))) : null;
}
function icon(ids, color, t, f = 0, mode = 'walk', flip = false) {
  const S = new Set(ids), grp = groupOf(ids, t);
  const key = (grp ? grp.name : '') + '|' + [...S].sort().join(',') + '|' + color + '|' + mode + (flip ? '|w' : '');
  if (ICACHE[key + f]) return ICACHE[key + f];
  if (mode !== 'walk' && mode !== 'under') return ICACHE[key + f] = mounted(ids, S, grp, color, f, mode, flip, key);
  const cv = document.createElement('canvas'), g = cv.getContext('2d'), s = 3, fw = FIGW * s, fh = FIGH * s;
  const show = grp && grp.show ? grp.show : grp && grp.order ? grp.order.filter(i => S.has(i)).concat([...S].filter(i => !grp.order.includes(i))) : [...S];
  const two = show.length > 5, back = two ? show.slice(0, Math.floor(show.length / 2)) : [], front = two ? show.slice(back.length) : show;
  const step = Math.round(fw * (show.length === 1 ? 1 : 0.56)), rowW = n => fw + (n - 1) * step;
  const lift = two ? Math.round(fh * 0.2) : 0, width = Math.max(rowW(front.length), rowW(back.length) + step / 2);
  const padX = show.length === 1 ? 10 : 22, baseH = show.length === 1 ? 22 : 30;
  cv.width = width + padX * 2; cv.height = fh + lift + baseH / 2 + 6;
  const cx = cv.width / 2, by = cv.height - baseH / 2 - 3, rx = cv.width / 2 - 3, ry = baseH / 2;
  const frame = grp ? grp.frame : '#141a22', edge = grp ? grp.edge : color;
  const ring = grp && grp.emblem === 'ring';
  // the token they stand on (for the Fellowship, the One Ring: its far side behind them, near side in front)
  if (ring) {
    g.lineWidth = 9; g.strokeStyle = OUT; g.beginPath(); g.ellipse(cx, by, rx - 4, ry, 0, Math.PI, 2 * Math.PI); g.stroke();
    g.lineWidth = 6; g.strokeStyle = '#a77a22'; g.stroke();
  } else {
    g.fillStyle = show.length === 1 ? color : frame; g.strokeStyle = OUT; g.lineWidth = 3;
    g.beginPath(); g.ellipse(cx, by, rx, ry, 0, 0, 7); g.fill(); g.stroke();
    if (show.length > 1) { g.strokeStyle = edge; g.lineWidth = 2.5; g.beginPath(); g.ellipse(cx, by, rx - 5, ry - 4, 0, 0, 7); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.ellipse(cx, by - ry * 0.35, rx * 0.7, ry * 0.3, 0, 0, 7); g.fill();
  }
  const x0 = (cv.width - rowW(back.length)) / 2, x1 = (cv.width - rowW(front.length)) / 2, foot = by + ry * (two ? 0.35 : 0.15);
  back.forEach((id, k) => drawFigure(g, id, x0 + k * step, foot - fh - lift, s, (f + k * 2 + 1) % 4));
  front.forEach((id, k) => drawFigure(g, id, x1 + k * step, foot - fh, s, (f + k * 2) % 4));
  if (ring) {
    g.lineWidth = 9; g.strokeStyle = OUT; g.beginPath(); g.ellipse(cx, by, rx - 4, ry, 0, 0, Math.PI); g.stroke();
    g.lineWidth = 6; g.strokeStyle = '#d9a83a'; g.stroke();
    g.lineWidth = 2; g.strokeStyle = '#ffe9a0'; g.beginPath(); g.ellipse(cx, by + 1, rx - 5, ry - 1, 0, 0.5, 2.6); g.stroke();
  } else if (grp && grp.emblem) emblem(g, grp.emblem, cx, by + ry * 0.35, 8, edge);
  const name = grp ? grp.name : show.length === 1 ? C[show[0]].name : listNames(show);
  return ICACHE[key + f] = { canvas: cv, name, key };
}
// riders, flyers and sailors: one mount per rider (Legolas and Gimli share Arod), up to two per Eagle,
// everyone in one boat; a company's name and colours as on foot
function mounted(ids, S, grp, color, f, mode, flip, key) {
  const show = (grp && grp.order ? grp.order.filter(i => S.has(i)).concat([...S].filter(i => !grp.order.includes(i))) : [...S]);
  let units = [];
  if (mode === 'ride') {
    const rest = show.filter(i => i !== 'legolas' && i !== 'gimli'); if (S.has('legolas') && S.has('gimli')) units.push(['legolas', 'gimli']); else { if (S.has('legolas')) rest.push('legolas'); if (S.has('gimli')) rest.push('gimli'); }
    units = units.concat(rest.map(i => [i])).map((u, k) => horseGrid(u, (f + k) % 4, k));
  } else if (mode === 'fly') { for (let i = 0; i < show.length; i += 2) units.push(eagleGrid(show.slice(i, i + 2), (f + i / 2) % 4)); }
  else if (mode === 'boat') {
    // the three grey boats of Lórien: Aragorn with Frodo and Sam, Boromir with Merry and Pippin, Legolas and Gimli
    const crews = [['aragorn', 'frodo', 'sam'], ['boromir', 'merry', 'pippin'], ['legolas', 'gimli']].map(c => c.filter(i => S.has(i))).filter(c => c.length);
    const left = show.filter(i => !crews.flat().includes(i)); for (let i = 0; i < left.length; i += 3) crews.push(left.slice(i, i + 3));
    units = crews.map((c, k) => boatGrid(c, (f + k) % 4, 'boat'));
  } else units = [boatGrid(show, f, mode === 'barrel' ? 'barrel' : mode === 'sea' ? 'sea' : 'blackship')];
  const s = 3, ws = units.map(u => (u[0].length + 2) * s), hs = units.map(u => (u.length + 2) * s);
  const step = units.length > 1 ? Math.round(Math.max(...ws) * (mode === 'fly' ? 0.5 : 0.62)) : 0, lift = units.length > 1 ? 10 : 0;
  const cv = document.createElement('canvas'), g = cv.getContext('2d');
  cv.width = Math.max(...ws) + step * (units.length - 1) + 16; cv.height = Math.max(...hs) + lift * (units.length - 1) + (mode === 'fly' ? 26 : 12);
  const cx = cv.width / 2, by = cv.height - 8;
  // ground under a rider: a small token; under a flyer: its shadow far below
  if (mode === 'ride') { g.fillStyle = grp ? grp.frame : color; g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, by, cv.width / 2 - 4, 7, 0, 0, 7); g.fill(); g.stroke(); }
  if (mode === 'fly') { g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(cx, by, cv.width * 0.3, 5, 0, 0, 7); g.fill(); g.fillStyle = color; g.beginPath(); g.arc(cx, by, 4, 0, 7); g.fill(); }
  g.save(); if (flip) { g.translate(cv.width, 0); g.scale(-1, 1); }
  units.forEach((u, k) => { const j = units.length - 1 - k; drawGrid(g, u, 8 + j * step, by - (mode === 'fly' ? 20 : 4) - hs[j] - (units.length - 1 - j) * lift + (mode === 'fly' ? 0 : 6), s); });
  g.restore();
  const name = grp ? grp.name : show.length === 1 ? C[show[0]].name : listNames(show);
  return { canvas: cv, name, key };
}
function listNames(ids) {
  const n = [...new Set(ids.map(i => C[i].name))];
  return n.length <= 2 ? n.join(' & ') : n.length <= 4 ? n.slice(0, -1).join(', ') + ' & ' + n[n.length - 1] : n.slice(0, 3).join(', ') + ` & ${n.length - 3} more`;
}
function dataURL(ids, color, t) { return icon(ids, color, t).canvas.toDataURL(); }
return { C, B, JOURNEY, GROUPS, charsOf, icon, dataURL, drawHead, drawFigure };
})();
if (typeof self !== 'undefined') self.AVATARS = AVATARS;
