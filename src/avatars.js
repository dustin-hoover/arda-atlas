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
  thorin:  { name: 'Thorin',    skin: '#efc19c', hair: ['#262021', '#141011'], style: 'none', beard: 'dwarf', beardC: ['#262021', '#141011'], hat: 'dwarfhood', hatC: ['#5a8ad8', '#3a68b0'], brows: 1, tassel: 1 },
  dwalin: { name: 'Dwalin', skin: '#e8b48e', hair: ['#3a5aa8', '#26407e'], style: 'none', beard: 'dwarf', beardC: ['#3a5aa8', '#26407e'], hat: 'dwarfhood', hatC: ['#2e5a2e', '#1e3e1e'], brows: 1 },
  balin: { name: 'Balin', skin: '#f0c4a0', hair: ['#f0f0ea', '#c8c8c0'], style: 'none', beard: 'dwarf', beardC: ['#f0f0ea', '#c8c8c0'], hat: 'dwarfhood', hatC: ['#b8261e', '#841a14'], brows: 1 },
  fili: { name: 'Fíli', skin: '#f2c8a4', hair: ['#e8c04e', '#b8902a'], style: 'none', beard: 'dwarf', beardC: ['#e8c04e', '#b8902a'], hat: 'dwarfhood', hatC: ['#3a62b0', '#284a88'], brows: 1 },
  kili: { name: 'Kíli', skin: '#f2c8a4', hair: ['#d8b040', '#a8822a'], style: 'none', beard: 'dwarf', beardC: ['#d8b040', '#a8822a'], hat: 'dwarfhood', hatC: ['#3a62b0', '#284a88'], brows: 1 },
  dori: { name: 'Dori', skin: '#e8b892', hair: ['#8a6a4a', '#5e4630'], style: 'none', beard: 'dwarf', beardC: ['#8a6a4a', '#5e4630'], hat: 'dwarfhood', hatC: ['#6a3a8a', '#4a2864'], brows: 1 },
  nori: { name: 'Nori', skin: '#e8b892', hair: ['#4a3424', '#2e2016'], style: 'none', beard: 'dwarf', beardC: ['#4a3424', '#2e2016'], hat: 'dwarfhood', hatC: ['#7a4a9a', '#563470'], brows: 1 },
  ori: { name: 'Ori', skin: '#f0c4a0', hair: ['#a87a4a', '#7a5432'], style: 'none', beard: 'dwarf', beardC: ['#a87a4a', '#7a5432'], hat: 'dwarfhood', hatC: ['#8a8a90', '#5e5e66'], brows: 1 },
  oin: { name: 'Óin', skin: '#e8b48e', hair: ['#a8a8ac', '#78787e'], style: 'none', beard: 'dwarf', beardC: ['#a8a8ac', '#78787e'], hat: 'dwarfhood', hatC: ['#7a5232', '#523620'], brows: 1 },
  gloin: { name: 'Glóin', skin: '#e8b48e', hair: ['#a8482a', '#7a3018'], style: 'none', beard: 'dwarf', beardC: ['#a8482a', '#7a3018'], hat: 'dwarfhood', hatC: ['#e8e6de', '#b8b4a8'], brows: 1 },
  bifur: { name: 'Bifur', skin: '#e8b48e', hair: ['#2a2020', '#140f0f'], style: 'none', beard: 'dwarf', beardC: ['#2a2020', '#140f0f'], hat: 'dwarfhood', hatC: ['#e0c040', '#a88e22'], brows: 1 },
  bofur: { name: 'Bofur', skin: '#ecbc96', hair: ['#6a4a2a', '#4a321c'], style: 'none', beard: 'dwarf', beardC: ['#6a4a2a', '#4a321c'], hat: 'dwarfhood', hatC: ['#e8c84a', '#b0962a'], brows: 1 },
  bombur: { name: 'Bombur', skin: '#f0c0a0', hair: ['#b8602a', '#844216'], style: 'none', beard: 'dwarf', beardC: ['#b8602a', '#844216'], hat: 'dwarfhood', hatC: ['#a8d098', '#78a068'], brows: 1 },
  trolls:  { name: 'Bert, Tom and William', special: 'trolls' },
  stonetrolls: { name: 'The Stone-trolls', special: 'stonetrolls' },
  goblin:  { name: 'Goblins', skin: '#7a8a5a', hair: ['#2a2a20', '#1a1a14'], style: 'sparse', ears: 'gollum', eye: '#f0c040', fangs: 1 },
  greatgoblin: { name: 'The Great Goblin', skin: '#6a7a4a', hair: ['#2a2a20', '#1a1a14'], style: 'none', ears: 'gollum', eye: '#f05030', fangs: 1, brows: 1, beardC: ['#2a2a20', '#1a1a14'], hat: 'crown' },
  bolg:    { name: 'Bolg', skin: '#5a5a40', hair: ['#141010', '#0a0808'], style: 'none', hat: 'orchelm', eye: '#f05030', fangs: 1, brows: 1, beardC: ['#141010', '#0a0808'] },
  warg:    { name: 'Wargs', special: 'warg' },
  mirkspider: { name: 'The Spiders of Mirkwood', special: 'spider' },
  beorn:   { name: 'Beorn', skin: '#e0a880', hair: ['#1a1414', '#0a0808'], style: 'shaggy', beard: 'short', beardC: ['#1a1414', '#0a0808'], brows: 1 },
  thranduil:{ name: 'Thranduil', skin: '#f6dcc4', hair: ['#f0d070', '#c8a848'], style: 'long', ears: 'elf', hat: 'leafcrown' },
  bard:    { name: 'Bard', skin: '#e8b892', hair: ['#1e1a1c', '#0e0c0e'], style: 'shaggy', beard: 'stubble', beardC: ['#3a3034', '#2a2226'] },
  dain:    { name: 'Dáin', skin: '#e8b48e', hair: ['#b04020', '#7a2a14'], style: 'none', beard: 'dwarf', beardC: ['#b04020', '#7a2a14'], hat: 'helm', brows: 1 },
  arkenstone: { name: 'The Arkenstone', special: 'gem' },
  nazgul:  { name: 'Nazgûl',    hood: 1 },
  faramir: { name: 'Faramir',   skin: '#efc4a0', hair: ['#2e2420', '#1a1412'], style: 'short' },
  eowyn:   { name: 'Éowyn',     skin: '#f6dcc4', hair: ['#f0d070', '#c8a848'], style: 'long' },
  saruman: { name: 'Saruman',   skin: '#e8c0a0', hair: ['#e8e8ec', '#9a9aa8'], style: 'long', beard: 'wizard', beardC: ['#ececf0', '#8a8a98'], brows: 1 },
  grima:   { name: 'Gríma',     skin: '#e6d8cc', hair: ['#1e1a1c', '#0e0c0e'], style: 'long', eye: '#3a4a3a' },
  ugluk:   { name: 'Uglúk',     skin: '#5a4a3c', hair: ['#141010', '#0a0808'], style: 'none', hat: 'orchelm', eye: '#f0c040', fangs: 1, brows: 1, beardC: ['#141010', '#0a0808'] },
  uruk:    { name: 'Uruk-hai',  skin: '#4e4234', hair: ['#141010', '#0a0808'], style: 'none', hat: 'orchelm', eye: '#e8a838', fangs: 1 },
  gollum:  { name: 'Gollum',    skin: '#b4bc9c', hair: ['#4a4a3a', '#2a2a20'], style: 'sparse', ears: 'gollum', bigEyes: 1 },
  treebeard:{ name: 'Treebeard', special: 'ent' },
  sauron:  { name: 'Sauron',    special: 'eye' },
  smaug:   { name: 'Smaug',     special: 'dragon' },
  tom:     { name: 'Tom Bombadil', skin: '#f0b088', hair: ['#6a4a2a', '#4a321c'], style: 'short', beard: 'wizard', beardC: ['#7a5530', '#55391e'], hat: 'tomhat', blush: 1 },
  goldberry:{ name: 'Goldberry', skin: '#f8e4d2', hair: ['#f6d860', '#d8b440'], style: 'long', hat: 'circlet', hatC: ['#f4f8ff', '#c8e0ff'] },
  shelob:  { name: 'Shelob',    special: 'spider' },
};

// which characters travel in each journey; [id, from, to] limits a companion to part of the journey
const JOURNEY = {
  war: {
    'Frodo & Sam': ['frodo', 'sam'], 'Bilbo in Rivendell': ['bilboOld'], 'Aragorn': ['aragorn'], 'Merry & Pippin': ['merry', 'pippin'], 'Pippin': ['pippin'],
    'Merry with Théoden': ['merry', 'theoden', ['eowyn', '3019 3 10', '3019 3 15.6']], 'Gandalf the Grey': ['gandalf'], 'The Black Riders': ['nazgul'], 'Boromir': ['boromir'],
    'Legolas': ['legolas'], 'Gimli': ['gimli'], 'Gandalf: to Orthanc': ['gandalf'], 'Gandalf the White': ['gandalfW'],
    'Elrond': ['elrond'], 'The Stone-trolls': ['stonetrolls'], 'Shelob': ['shelob'], 'Tom Bombadil': ['tom'], 'Goldberry': ['goldberry'], 'Galadriel': ['galadriel'], 'Sauron': ['sauron'], 'Saruman': ['saruman'], 'Gríma Wormtongue': ['grima'],
    'Uglúk and the Uruk-hai': ['ugluk', 'uruk'], 'Treebeard': ['treebeard'], 'Gollum': ['gollum'], 'Faramir': ['faramir'],
  },
  return: {
    'Frodo & Sam homeward': ['frodo', 'sam'], 'Merry & Pippin homeward': ['merry', 'pippin'], 'Aragorn & Arwen': ['aragorn', ['arwen', '3019 6 31']],
    'Arwen comes to the City': ['arwen', 'elrond'], 'Gandalf to Bombadil': ['gandalfW'], 'Bilbo, Elrond & Galadriel': ['bilboOld', 'elrond', 'galadriel'], 'Bilbo in Rivendell': ['bilboOld'],
    'Frodo\'s last journey': ['frodo'], 'Sam to the Havens and home': ['sam'], 'Merry & Pippin to the Havens': ['merry', 'pippin'],
    'Treebeard at Isengard': ['treebeard'], 'Tom Bombadil and Goldberry': ['tom', 'goldberry'], 'Faramir & Éowyn': ['faramir', 'eowyn'], 'Saruman and Wormtongue': ['saruman', 'grima'],
  },
  hobbit: { 'Bilbo at Bag End': ['bilbo'], 'Bilbo & Thorin\'s Company': ['bilbo', ['thorin', null, '2941 11 24'], ['fili', null, '2941 11 24'], ['kili', null, '2941 11 24'], ...['dwalin', 'balin', 'dori', 'nori', 'ori', 'oin', 'gloin', 'bifur', 'bofur', 'bombur'].map(d => [d, null, '2941 11 26']), ['gandalf', null, '2941 7 14'], ['gandalf', '2941 11 24', null]],
    'Elrond': ['elrond'], 'The Three Trolls': [['trolls', null, '2941 5 26.25'], ['stonetrolls', '2941 5 26.25', null]], 'The Great Goblin': ['greatgoblin', 'goblin'], 'Wargs and Goblins': ['warg', 'goblin'],
    'Beorn': ['beorn'], 'The Spiders of Mirkwood': ['mirkspider'], 'Thranduil': ['thranduil'], 'Bard': ['bard'], 'Dáin Ironfoot': ['dain'], 'Bolg and the Goblins of the North': ['bolg', 'goblin', 'warg'],
    'The Dwarves of Erebor': ['dwalin', 'balin', 'dori', 'nori', 'ori', 'oin', 'gloin', 'bifur', 'bofur', 'bombur'], 'The Arkenstone': ['arkenstone'], 'Gandalf: the White Council at Dol Guldur': ['gandalf'], 'Gollum': ['gollum'], 'Smaug': ['smaug'] },
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
  { name: 'In the House of Tom Bombadil', lead: ['tom', 'goldberry'], frame: '#1e3a5a', edge: '#f0c830', emblem: 'leaf', test: S => has(S, 'tom') && S.has('frodo') && S.has('goldberry'), order: ['tom', 'goldberry', 'frodo', 'sam', 'merry', 'pippin'] },
  { name: 'Tom Bombadil and the Hobbits', frame: '#1e3a5a', edge: '#f0c830', emblem: 'leaf', test: S => has(S, 'tom') && S.has('frodo'), order: ['tom', 'frodo', 'sam', 'merry', 'pippin'] },
  { name: 'Tom Bombadil and Goldberry', frame: '#1e3a5a', edge: '#f0c830', emblem: 'leaf', test: S => S.size === 2 && has(S, 'tom', 'goldberry') },
  { name: 'Gandalf comes to Bombadil', frame: '#1e3a5a', edge: '#ffffff', emblem: 'star', test: S => has(S, 'tom', 'gandalfW') },
  { name: 'In Shelob\'s Lair', frame: '#0c0b10', edge: '#c8c8d0', emblem: 'web', test: S => has(S, 'shelob') && (S.has('frodo') || S.has('sam')), order: ['shelob', 'sam', 'frodo'] },
  { name: 'There and Back Again', frame: '#2c3d1c', edge: '#e0b84e', emblem: 'key', test: S => S.size === 2 && has(S, 'bilbo', 'gandalf') },
  { name: 'Riddles in the Dark', lead: ['bilbo', 'gollum'], frame: '#101418', edge: '#b4bc9c', emblem: 'ring', test: S => has(S, 'bilbo', 'gollum') },
  { name: 'Roast Mutton', lead: ['trolls', 'bilbo'], frame: '#2a1e14', edge: '#ff8a30', emblem: 'star', test: S => S.has('trolls') && S.has('bilbo'), order: ['trolls', 'bilbo', 'thorin', 'gandalf'] },
  { name: 'Over Hill and Under Hill', lead: ['greatgoblin', 'thorin'], frame: '#141810', edge: '#7a8a5a', emblem: 'eye', test: S => S.has('greatgoblin') && S.has('thorin'), order: ['greatgoblin', 'goblin', 'thorin', 'dwalin', 'balin', 'fili', 'kili', 'gandalf'] },
  { name: 'Out of the Frying-Pan', lead: ['warg', 'goblin', 'bilbo'], frame: '#2a1e14', edge: '#ff8a30', emblem: 'star', test: S => S.has('warg') && S.has('thorin'), order: ['warg', 'goblin', 'bilbo', 'thorin', 'gandalf', 'balin', 'dwalin'] },
  { name: 'Queer Lodgings', lead: ['beorn', 'bilbo', 'gandalf'], frame: '#3a2a18', edge: '#c9a03c', emblem: 'leaf', test: S => S.has('beorn') && S.has('thorin'), order: ['beorn', 'bilbo', 'thorin', 'gandalf'] },
  { name: 'Yule at Beorn\'s', lead: ['beorn', 'bilbo'], frame: '#3a2a18', edge: '#c9a03c', emblem: 'star', test: S => S.has('beorn') && S.has('bilbo') && !S.has('thorin') },
  { name: 'Flies and Spiders', lead: ['mirkspider', 'bilbo'], frame: '#0c0b10', edge: '#c8c8d0', emblem: 'web', test: S => S.has('mirkspider') && S.has('bilbo'), order: ['mirkspider', 'bilbo', 'thorin'] },
  { name: 'The Great Goblin', frame: '#141810', edge: '#7a8a5a', emblem: 'eye', test: S => S.size === 2 && has(S, 'greatgoblin', 'goblin'), show: ['goblin', 'greatgoblin', 'goblin'] },
  { name: 'Wargs and Goblins', frame: '#141810', edge: '#7a7a82', emblem: 'eye', test: S => S.size === 2 && has(S, 'warg', 'goblin'), show: ['warg', 'goblin', 'warg'] },
  { name: 'Bolg and the Goblins of the North', frame: '#141810', edge: '#a83020', emblem: 'eye', test: S => S.has('bolg'), show: ['goblin', 'warg', 'bolg', 'goblin', 'warg'] },
  { name: 'The Dwarves of Erebor', frame: '#1e2c48', edge: '#c8ccd4', emblem: 'key', test: S => has(S, 'balin', 'dwalin', 'bombur') && !S.has('thorin') },
  { name: 'Thorin and Company', lead: ['thorin', 'bilbo', 'gandalf'], frame: '#1e2c48', edge: '#e0b84e', emblem: 'key', test: S => has(S, 'bilbo', 'thorin'), order: ['dwalin', 'balin', 'fili', 'kili', 'dori', 'nori', 'ori', 'oin', 'gloin', 'thorin', 'bilbo', 'gandalf', 'bifur', 'bofur', 'bombur'] },
  { name: 'The Nine', frame: '#0c0b10', edge: '#7a1d24', emblem: 'eye', test: S => S.size === 1 && S.has('nazgul'), show: ['nazgul', 'nazgul', 'nazgul'] },
  { name: 'The Ring-bearers', frame: '#1b2433', edge: '#f2d06b', emblem: 'ring', test: S => S.size === 2 && has(S, 'frodo', 'bilboOld') },
  { name: 'Captives of the Uruk-hai', frame: '#1e1a18', edge: '#e8e4dc', emblem: 'hand', test: S => has(S, 'merry', 'pippin', 'ugluk'), order: ['uruk', 'merry', 'ugluk', 'pippin'] },
  { name: 'The Uruk-hai of Isengard', frame: '#1e1a18', edge: '#e8e4dc', emblem: 'hand', test: S => S.size === 2 && has(S, 'ugluk', 'uruk'), show: ['uruk', 'ugluk', 'uruk'] },
  { name: 'Treebeard and the Hobbits', frame: '#24361c', edge: '#8a9a6a', emblem: 'leaf', test: S => has(S, 'merry', 'pippin', 'treebeard') },
  { name: 'Frodo, Sam and Sméagol', frame: '#1b2433', edge: '#b4bc9c', emblem: 'ring', test: S => S.size === 3 && has(S, 'frodo', 'sam', 'gollum') },
  { name: 'Faramir and the Ring-bearer', frame: '#24361c', edge: '#7fa86a', emblem: 'star', test: S => has(S, 'frodo', 'sam', 'faramir') },
  { name: 'Théoden, Dernhelm and Merry', frame: '#1f3a24', edge: '#e6c04e', emblem: 'horse', test: S => S.size === 3 && has(S, 'theoden', 'eowyn', 'merry') },
  { name: 'Sharkey and Wormtongue', frame: '#2a2a2e', edge: '#d8d8e2', emblem: 'hand', test: S => S.size === 2 && has(S, 'saruman', 'grima') },
  { name: 'In the House of Elrond', lead: ['elrond', 'frodo'], frame: '#1b2433', edge: '#b9c2d4', emblem: 'star', test: S => S.has('elrond') && S.size >= 3 },
  { name: 'In Lothlórien', lead: ['galadriel'], frame: '#2a3a1c', edge: '#f6de88', emblem: 'star', test: S => S.has('galadriel') && S.size >= 3 && !S.has('elrond') },
  { name: 'Saruman and his prisoner', frame: '#2a2a2e', edge: '#d8d8e2', emblem: 'hand', test: S => S.size === 2 && has(S, 'saruman', 'gandalf') },
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
  if (c.style === 'sparse') { set(5, 5, h); set(7, 4, hd); set(8, 5, h); set(10, 6, hd); set(4, 6, hd); }
  if (c.ears === 'gollum') { set(2, 8, c.skin); set(1, 7, c.skin); set(2, 9, c.skin); set(11, 8, shade(c.skin, 0.88)); set(12, 7, shade(c.skin, 0.88)); set(11, 9, shade(c.skin, 0.88)); }
  // eyes, brows, mouth, cheeks
  if (c.bigEyes) { for (const x of [4, 8]) { set(x, 8, '#e8f0c8'); set(x + 1, 8, '#e8f0c8'); set(x, 9, '#e8f0c8'); set(x + 1, 9, '#16110d'); } }
  else { set(5, 9, c.eye || '#1a1410'); set(8, 9, c.eye || '#1a1410'); }
  if (c.brows) { const b = (c.beardC || c.hair)[1]; set(4, 8, b); set(5, 8, b); set(8, 8, b); set(9, 8, b); }
  set(6, 11, shade(c.skin, 0.7)); set(7, 11, shade(c.skin, 0.7));
  if (c.blush) { set(4, 10, '#e8968a'); set(9, 10, '#e8968a'); }
  if (c.fangs) { set(5, 11, '#f0ece0'); set(8, 11, '#f0ece0'); set(6, 11, '#2a1810'); set(7, 11, '#2a1810'); set(5, 12, '#f0ece0'); }
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
  if (c.hat === 'leafcrown') { for (let x = 3; x <= 10; x++) set(x, 5, x % 2 ? '#c85a1a' : '#e8a030'); for (const x of [3, 6, 9]) set(x, 4, '#a83a1a'); set(5, 4, '#7a1a3a'); set(8, 4, '#7a1a3a'); }
  if (c.hat === 'tomhat') {       // a tall battered hat with a long blue feather
    const a = '#6a5a4a', d = '#4a3e32'; rect(4, 1, 9, 4, a); set(9, 1, d); set(9, 2, d); set(4, 1, null); rect(2, 5, 11, 5, d); rect(4, 4, 9, 4, '#c9a03c');
    set(10, 3, '#3a7ae0'); set(11, 2, '#3a7ae0'); set(12, 1, '#5a9af0'); set(13, 0, '#5a9af0'); set(11, 3, '#2a5ab0');
  }
  if (c.hat === 'orchelm') {      // black iron of Isengard, the white S-rune on the brow
    const m = '#2a2a30', md = '#16161a'; rect(4, 3, 9, 3, m); rect(3, 4, 10, 6, m); set(10, 4, md); set(10, 5, md); set(10, 6, md); set(2, 6, m); set(11, 6, md);
    set(6, 4, '#f0f0ea'); set(7, 5, '#f0f0ea'); set(6, 6, '#f0f0ea'); for (let y = 7; y <= 9; y++) { set(2, y, m); set(11, y, md); }
  }
  if (c.hat === 'dwarfhood') {
    const [a, d] = c.hatC; rect(5, 2, 8, 2, a); rect(4, 3, 9, 3, a); rect(3, 4, 10, 4, a); rect(2, 5, 11, 6, a); for (let y = 7; y <= 13; y++) { set(2, y, a); set(11, y, d); }
    if (c.tassel) { set(9, 1, '#c8ccd4'); set(10, 0, '#c8ccd4'); } else set(9, 1, a); for (let x = 2; x <= 11; x++) set(x, 6, x % 2 ? d : a);
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
  thorin:   { tunic: '#2f4f86', legs: '#3a3028', cloak: '#5a8ad8', boots: '#2a1f18', belt: '#c9a03c', gear: 'sword' },
  nazgul:   { robe: '#1b1a20', rags: 1, gear: 'sword' },
  faramir:  { tunic: '#4a5a3a', legs: '#3a3428', cloak: '#3f5a34', boots: '#2a1f18', gear: 'sword' },
  eowyn:    { tunic: '#3f6a3a', legs: '#5a4a30', cloak: '#2a4a2a', boots: '#3a2a1a', belt: '#c9a03c', gear: 'sword', mail: 1 },
  saruman:  { robe: '#d8d8e2', iris: 1, gear: 'staff', staff: '#2a2a30' },
  grima:    { robe: '#2a2a2e' },
  ugluk:    { tunic: '#2a2626', legs: '#2a2020', boots: '#141010', gear: 'handshield', mail: 1 },
  uruk:     { tunic: '#2e2a28', legs: '#2a2020', boots: '#141010', gear: 'handshield', mail: 1 },
  gollum:   { gollum: 1 },
  dwalin: { tunic: '#6a5a46', legs: '#4a3e32', boots: '#2a1f18', cloak: '#2e5a2e', belt: '#c8ccd4', gear: 'axe', belt: '#c9a03c' },
  balin: { tunic: '#6a5a46', legs: '#4a3e32', boots: '#2a1f18', cloak: '#b8261e', belt: '#c8ccd4' },
  fili: { tunic: '#6a5a46', legs: '#4a3e32', boots: '#2a1f18', cloak: '#3a62b0', belt: '#c8ccd4', gear: 'bow' },
  kili: { tunic: '#6a5a46', legs: '#4a3e32', boots: '#2a1f18', cloak: '#3a62b0', belt: '#c8ccd4', gear: 'bow' },
  dori: { tunic: '#6a5a46', legs: '#4a3e32', boots: '#2a1f18', cloak: '#6a3a8a', belt: '#c8ccd4' },
  nori: { tunic: '#6a5a46', legs: '#4a3e32', boots: '#2a1f18', cloak: '#7a4a9a', belt: '#c8ccd4' },
  ori: { tunic: '#6a5a46', legs: '#4a3e32', boots: '#2a1f18', cloak: '#8a8a90', belt: '#c8ccd4' },
  oin: { tunic: '#6a5a46', legs: '#4a3e32', boots: '#2a1f18', cloak: '#7a5232', belt: '#c8ccd4' },
  gloin: { tunic: '#6a5a46', legs: '#4a3e32', boots: '#2a1f18', cloak: '#d8d4ca', belt: '#c8ccd4' },
  bifur: { tunic: '#6a5a46', legs: '#4a3e32', boots: '#2a1f18', cloak: '#e0c040', belt: '#c8ccd4' },
  bofur: { tunic: '#6a5a46', legs: '#4a3e32', boots: '#2a1f18', cloak: '#e8c84a', belt: '#c8ccd4' },
  bombur: { tunic: '#6a5a46', legs: '#4a3e32', boots: '#2a1f18', cloak: '#a8d098', belt: '#c8ccd4', fat: 1 },
  goblin:   { tunic: '#3a3a2e', legs: '#2a2a20', boots: '#1a1a14', gear: 'sword', rags: 0 },
  greatgoblin: { tunic: '#4a3a2a', legs: '#2a2a20', boots: '#1a1a14', fat: 1, belt: '#7a6a3a' },
  bolg:     { tunic: '#2a2826', legs: '#2a2020', boots: '#141010', gear: 'axe', mail: 1 },
  beorn:    { tunic: '#7a5a3a', legs: '#5a4a30', boots: '#3a2a1a', gear: 'axe', fat: 1 },
  thranduil:{ robe: '#5a7a3a', belt: '#c9a03c' },
  bard:     { tunic: '#2a3a5a', legs: '#2a2a30', cloak: '#1e2a40', boots: '#1a1a1e', gear: 'bow' },
  dain:     { tunic: '#8f969e', legs: '#4a3e32', boots: '#2a1f18', belt: '#c9a03c', gear: 'axe', mail: 1 },
  tom:      { tunic: '#2f5fae', legs: '#6a5a40', boots: '#f0c830', belt: '#c9a03c' },
  goldberry:{ robe: '#4a9a5a', belt: '#e6c04e', iris: 0 },
};
const FW = W + 4, FH = H + 14, BY = H - 1;   // figure grid: head at (2, 0), body from row BY
// Treebeard: an Ent half again as tall as a Man, with a leafy crown, bark grain, mossy beard, branch arms and root feet
function entGrid(f) {
  const Wd = 22, Ht = 46, g = Array.from({ length: Ht }, () => Array(Wd).fill(null));
  const set = (x, y, v) => { if (x >= 0 && x < Wd && y >= 0 && y < Ht) g[y][x] = v; };
  const rect = (x0, y0, x1, y1, v) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, v); };
  const bark = '#6a4a2e', barkD = '#4a321e', barkL = '#8a6a44', moss = '#8a9a6a', mossD = '#5e6e44', leaf = '#5a8a3a', leafD = '#3e6a2a';
  const upL = f === 1 ? 1 : 0, upR = f === 3 ? 1 : 0, sw = f === 1 ? 1 : f === 3 ? -1 : 0;
  // branch arms behind the trunk, with three-pronged twig hands
  for (let y = 18; y <= 30; y++) { set(4 - (y > 24 ? 1 : 0), y + sw, barkD); set(5 - (y > 24 ? 1 : 0), y + sw, bark); set(17 + (y > 24 ? 1 : 0), y - sw, bark); set(16 + (y > 24 ? 1 : 0), y - sw, barkD); }
  for (const [x, d] of [[3, -1], [18, 1]]) { const o = d < 0 ? sw : -sw; set(x + d, 31 + o, barkD); set(x, 32 + o, barkD); set(x - d, 31 + o, barkD); set(x + 2 * d, 30 + o, leaf); }
  // trunk and root legs
  rect(6, 16, 15, 36, bark); for (let y = 16; y <= 36; y++) { set(15, y, barkD); if (y % 4 === 0) set(8 + (y % 3), y, barkD); if (y % 5 === 0) set(12, y, barkL); }
  rect(7, 37, 9, 42 - upL, bark); rect(12, 37, 14, 42 - upR, barkD);
  rect(5, 43 - upL, 10, 43 - upL, barkD); set(4, 44 - upL, barkD); set(7, 44 - upL, barkD); set(10, 44 - upL, barkD);
  rect(11, 43 - upR, 16, 43 - upR, barkD); set(11, 44 - upR, barkD); set(14, 44 - upR, barkD); set(17, 44 - upR, barkD);
  // head: leafy crown, bark face with a deep brow, green-brown eyes with a glint, a long nose
  for (let x = 4; x <= 17; x++) { const h = 1 + ((x * 7) % 5); for (let y = 5 - h; y <= 5; y++) set(x, y, (x + y) % 3 ? leaf : leafD); }
  rect(5, 4, 16, 16, bark); for (let y = 4; y <= 16; y++) { set(16, y, barkD); if (y % 3 === 0) set(6, y, barkD); }
  rect(6, 8, 15, 8, barkD); for (const x of [7, 13]) { set(x, 9, '#a8c860'); set(x + 1, 9, '#3a5a1a'); set(x, 10, '#3a5a1a'); set(x + 1, 10, '#a8c860'); }
  rect(10, 9, 11, 13, barkL); set(11, 13, barkD); rect(9, 14, 12, 14, barkD);
  // mossy beard of twigs, falling to the waist
  for (let y = 14; y <= 27; y++) { const w = Math.max(1, 5 - Math.floor((y - 14) / 3)); for (let x = 11 - w; x <= 10 + w; x++) set(x, y, (x + y) % 4 ? moss : mossD); }
  return g;
}
// the Lidless Eye: wide, wreathed in flame, floating between the two great horns that crown Barad-dûr
function eyeGrid(f) {
  const Wd = 32, Ht = 30, g = Array.from({ length: Ht }, () => Array(Wd).fill(null));
  const set = (x, y, v) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < Wd && y >= 0 && y < Ht && v) g[y][x] = v; };
  const rect = (x0, y0, x1, y1, v) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, v); };
  const k = '#16141a', k2 = '#2a2830';
  // the crown of the tower: broad battlements with red-lit windows
  rect(1, 21, 30, 29, k); for (let x = 1; x <= 30; x += 3) rect(x, 19, x + 1, 20, k); for (let y = 22; y <= 29; y += 3) rect(2, y, 29, y, k2);
  for (const [x, y] of [[6, 24], [12, 26], [19, 24], [25, 27], [15, 23]]) set(x, y, f % 2 && x % 2 ? '#ff6a18' : '#c02010');
  // two horns rising from the corners, leaning out and then curving in, tapering to points
  const horn = [[4, 20, 3], [3, 17, 3], [3, 14, 3], [3, 11, 2], [4, 8, 2], [5, 6, 2], [7, 4, 2], [9, 3, 1], [11, 2, 1]];
  for (let i = 0; i < horn.length - 1; i++) {
    const [x0, y0, w0] = horn[i], [x1, y1] = horn[i + 1];
    for (let t = 0; t <= 1; t += 0.2) { const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; for (let d = 0; d < w0; d++) { set(x + d, y, k); set(31 - x - d, y, k); } }
  }
  // flame around the eye, licking outward
  const lick = [[0, 2, 1, 3], [2, 0, 3, 1], [1, 3, 0, 2], [3, 1, 2, 0]][f];
  for (let y = 5; y <= 15; y++) { const w = Math.round(10 * Math.sqrt(Math.max(0, 1 - Math.pow((y - 10) / 6, 2)))) + lick[y % 4] % 2; for (let x = 16 - w; x <= 15 + w; x++) set(x, y, (x + y + f) % 3 ? '#c8300c' : '#f05a14'); }
  for (let i = 0; i < 5; i++) { const x = 9 + i * 3.5, y = 4 - (lick[i % 4] % 2); set(x, y, '#ff8a20'); set(x, y + 1, '#e04a14'); }
  // the eye: a wide lens, gold at the heart, with its black slit
  const lens = [[8, 11, 20], [9, 9, 22], [10, 8, 23], [11, 9, 22], [12, 11, 20]];
  for (const [y, x0, x1] of lens) rect(x0, y, x1, y, '#ff9a24');
  for (const [y, x0, x1] of lens.slice(1, 4)) rect(x0 + 3, y, x1 - 3, y, '#ffd050');
  rect(15, 8, 16, 12, '#0a0606'); set(15, 7, '#0a0606'); set(16, 13, '#0a0606');
  return g;
}
// Smaug asleep on the hoard: coiled, breathing, smoke from a nostril, and now and then a thin slit of eye
function hoardGrid(f) {
  const Wd = 50, Ht = 30, g = Array.from({ length: Ht }, () => Array(Wd).fill(null));
  const set = (x, y, v) => { if (x >= 0 && x < Wd && y >= 0 && y < Ht) g[y][x] = v; };
  const rect = (x0, y0, x1, y1, v) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, v); };
  const sc = '#a8321e', sd = '#6e1c10', gold = '#e0a83a', gl = '#ffe080', gd = '#a87420';
  for (let y = 19; y <= 29; y++) { const w = Math.round(24 * Math.sqrt(1 - Math.pow((y - 29) / 11, 2))); rect(24 - w, y, 24 + w, y, (y * 3 + w) % 5 ? gold : gd); }
  for (let i = 0; i < 9; i++) set(6 + i * 5 + (f + i) % 2, 21 + (i * 3) % 6, gl);                  // glinting coins
  const br = f % 2;                                                                                  // breathing
  rect(9, 10 - br, 35, 19, sc); rect(11, 9 - br, 33, 9 - br, sc); for (let x = 10; x <= 34; x += 3) set(x, 10 - br, sd);
  rect(12, 17, 32, 19, '#e0a040'); for (let x = 12; x <= 32; x += 2) set(x, 18, '#ffd070');        // gold-scaled belly
  for (let i = 0; i < 12; i++) rect(14 + i, 9 - br - Math.round(5 * Math.sin(i / 11 * Math.PI)), 14 + i, 9 - br, i % 3 ? '#7a2418' : '#3a0e08');   // folded wing
  for (let i = 0; i <= 26; i++) set(36 - i, 20 + Math.round(Math.sin(i / 4) * 1.2), i % 4 ? sc : sd);  // tail curled round the front
  set(9, 21, sd); set(8, 20, sd);
  rect(35, 13, 44, 18, sc); rect(45, 15, 47, 18, sc); set(37, 12, '#e8dcc0'); set(36, 11, '#e8dcc0'); set(40, 12, '#e8dcc0');
  rect(38, 18, 46, 19, sd);                                                                          // head laid on the paws
  if (f === 3) { set(41, 15, '#ffd040'); set(42, 15, '#ffd040'); } else rect(41, 15, 42, 15, '#3a0e08');
  set(47, 16, '#16110d'); const puff = ['#9a9a9a', '#b8b8b8']; set(48 + f % 2, 14 - f, puff[f % 2]); set(49, 13 - f, puff[0]);
  return g;
}
// Smaug in flight: wings beating, belly of gold, and over Lake-town a gout of fire
function dragonGrid(f, fire) {
  const W2 = fire ? 92 : 66, by = 22, g = blank(W2, 40), sc = '#b8361e', sd = '#6e1c10', mem = '#8a2a18', bone = '#3a0e08';
  const up = [-20, -6, 12, -6][f];
  const wing = (rx, tipX, dy, c) => { for (let x = tipX; x <= rx; x++) { const u = (rx - x) / (rx - tipX), y = Math.round(by + dy * u), th = 1 + Math.round(7 * Math.sin(Math.PI * Math.min(1, u * 1.1))); setp(g, x, y - 1, bone); rectp(g, x, y, x, y + th - (x % 6 === 0 ? 2 : 0), c); if (x % 7 === 0) for (let k = 0; k < th; k++) setp(g, x - k / 3, y + k, bone); } };
  wing(40, 10, up - 4, '#5e1a10');
  for (let i = 0; i < 20; i++) rectp(g, 1 + i, by + 4 + Math.round(Math.sin(i / 3 + f) * 2), 1 + i, by + 5 + Math.round(Math.sin(i / 3 + f) * 2) + (i > 12 ? 1 : 0), i % 3 ? sc : sd);
  rectp(g, 0, by + 3 + Math.round(Math.sin(f) * 2), 2, by + 6 + Math.round(Math.sin(f) * 2), sd);     // the tail's spade
  rectp(g, 20, by, 44, by + 7, sc); rectp(g, 22, by + 6, 42, by + 8, '#e0a040'); for (let x = 22; x <= 42; x += 2) setp(g, x, by + 7, '#ffd070');
  setp(g, 36, by + 6, sd); setp(g, 37, by + 6, sd);                                                   // the bare patch in the left breast
  for (let i = 0; i < 10; i++) rectp(g, 43 + i, by + 1 - Math.round(i * 0.9), 45 + i, by + 3 - Math.round(i * 0.9), i % 3 ? sc : sd);
  const hx = 53, hy = by - 11;
  rectp(g, hx, hy, hx + 7, hy + 4, sc); rectp(g, hx + 8, hy + 2, hx + 11, hy + 4, sc); setp(g, hx + 5, hy + 1, '#ffd040'); setp(g, hx + 11, hy + 2, '#16110d');
  setp(g, hx + 1, hy - 1, '#e8dcc0'); setp(g, hx, hy - 2, '#e8dcc0'); setp(g, hx + 3, hy - 1, '#e8dcc0'); rectp(g, hx + 7, hy + 5, hx + 10, hy + 5, sd);
  for (const x of [26, 38]) { rectp(g, x, by + 9, x + 1, by + 11, sd); setp(g, x + 2, by + 12, '#e8dcc0'); setp(g, x - 1, by + 12, '#e8dcc0'); }
  if (fire) {
    const L = 26 + (f % 2) * 4;
    for (let i = 0; i < L; i++) { const w = 1 + Math.round(i * 0.28), y0 = hy + 4 + Math.round(i * 0.35); for (let k = -w; k <= w; k++) setp(g, hx + 12 + i, y0 + k, Math.abs(k) < w * 0.35 ? '#fff0a0' : Math.abs(k) < w * 0.7 ? '#ffb030' : ((i + k + f) % 3 ? '#ff6a18' : '#c02010')); }
  }
  wing(38, 6, up, mem);
  return g;
}
// Shelob: a bloated black body, clustered pale eyes, fangs, and eight jointed legs creeping
function spiderGrid(f) {
  const Wd = 58, Ht = 28, g = Array.from({ length: Ht }, () => Array(Wd).fill(null));
  const set = (x, y, v) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < Wd && y >= 0 && y < Ht) g[y][x] = v; };
  const k = '#16141a', k2 = '#2e2a34', leg = '#4a4456';
  // legs: four reaching forward, four back, each arching high over the body; they creep in turn
  for (let i = 0; i < 4; i++) for (const d of [1, -1]) {
    const bx = 25 + i * 1.5, by = 16, lift = (i + f + (d > 0 ? 0 : 1)) % 2;
    const kx = bx + d * (5 + i * 3), ky = 2 + i * 1.5 - lift, fx = bx + d * (10 + i * 5), fy = 26 - lift * 2;
    for (let t = 0; t <= 1; t += 0.06) for (const o of [0, 1]) { set(bx + (kx - bx) * t + o, by + (ky - by) * t, leg); set(kx + (fx - kx) * t + o, ky + (fy - ky) * t, leg); }
    set(kx, ky - 1, '#7a7288'); set(kx + 1, ky - 1, '#7a7288');
  }
  // abdomen and head
  for (let y = 5; y <= 21; y++) { const w = Math.round(11 * Math.sqrt(Math.max(0, 1 - Math.pow((y - 13) / 8.5, 2)))); for (let x = 13 - w; x <= 13 + w; x++) set(x, y, (x + y) % 5 ? k : k2); }
  set(11, 9, '#5a5260'); set(12, 9, '#5a5260'); set(10, 10, '#5a5260');                                // a sickly sheen
  for (let y = 10; y <= 18; y++) for (let x = 24; x <= 33; x++) if (Math.hypot((x - 28.5) / 5, (y - 14) / 4.5) < 1) set(x, y, k);
  for (const [x, y] of [[31, 11], [33, 12], [32, 13], [30, 12], [34, 14], [32, 15]]) set(x, y, f === 2 && (x + y) % 2 ? '#e8ffc0' : '#b8f090');   // her many eyes
  set(34, 17, '#e8e0c8'); set(35, 18, '#e8e0c8'); set(32, 18, '#e8e0c8'); set(33, 19, '#e8e0c8');      // fangs
  return g;
}
// Bert, Tom and William round their fire with mutton on the spit — or, after the dawn, three stones
function trollsGrid(f, stone) {
  const Wd = 64, Ht = 34, g = Array.from({ length: Ht }, () => Array(Wd).fill(null));
  const set = (x, y, v) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < Wd && y >= 0 && y < Ht && v) g[y][x] = v; };
  const rect = (x0, y0, x1, y1, v) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, v); };
  const troll = (x0, sk, sd, bob, face) => {
    const b = stone ? 0 : bob;
    rect(x0 + 3, 9 - b, x0 + 14, 26, sk); rect(x0 + 2, 12 - b, x0 + 15, 22, sk); for (let y = 10; y <= 26; y++) set(x0 + 14, y - b, sd);
    rect(x0 + 5, 2 - b, x0 + 12, 9 - b, sk); set(x0 + 12, 4 - b, sd); rect(x0 + 8 + face, 5 - b, x0 + 9 + face, 8 - b, sd);          // head and great nose
    set(x0 + 6 + face, 4 - b, stone ? sd : '#2a1a10'); set(x0 + 10 + face, 4 - b, stone ? sd : '#2a1a10'); set(x0 + 4, 4 - b, sk); set(x0 + 13, 4 - b, sd);
    rect(x0 + 1, 12 - b, x0 + 2, 23 - b, sd); rect(x0 + 15, 12 - b, x0 + 16, 23 - b, sd);                                           // long arms
    rect(x0 + 4, 27, x0 + 7, 32, sd); rect(x0 + 10, 27, x0 + 13, 32, sd); rect(x0 + 3, 33, x0 + 8, 33, sd); rect(x0 + 9, 33, x0 + 14, 33, sd);
    if (stone) for (let k = 0; k < 9; k++) set(x0 + 3 + (k * 5) % 11, 6 + (k * 7) % 22, '#6a7a4a');                                // moss and a bird's perch
    else { rect(x0 + 3, 16, x0 + 14, 17, '#5a3a22'); }
  };
  if (stone) { troll(1, '#8a8a88', '#6a6a68', 0, 0); troll(22, '#909090', '#6e6e6c', 0, 1); troll(44, '#868682', '#666664', 0, -1); set(9, 1, '#4a3a2a'); set(10, 0, '#4a3a2a'); return g; }
  troll(22, '#7a7a5a', '#58583e', (f + 2) % 2, 0); troll(1, '#8a6a50', '#5e4634', f % 2, 1); troll(44, '#6a5a48', '#4a3e30', (f + 1) % 2, -1);
  // the fire, the spit and the mutton between them
  rect(24, 30, 39, 32, '#4a3220'); for (let i = 0; i < 6; i++) { const x = 26 + i * 2, h = 4 + ((i * 3 + f) % 4); for (let y = 0; y < h; y++) set(x + (y % 2) * (f % 2 ? 1 : -1) * 0, 29 - y, y < 2 ? '#ffb030' : y < 4 ? '#ff6a18' : '#c02010'); }
  rect(22, 18, 41, 18, '#5a3a22'); rect(28, 16, 35, 21, '#a8584a'); rect(29, 17, 34, 20, '#c87a5a'); set(23, 19, '#5a3a22'); set(40, 19, '#5a3a22');
  return g;
}
// a Warg: a great grey wolf with yellow eyes
function wargGrid(f) {
  const Wd = 30, Ht = 18, g = Array.from({ length: Ht }, () => Array(Wd).fill(null)), a = f % 2;
  const set = (x, y, v) => { if (x >= 0 && x < Wd && y >= 0 && y < Ht) g[y][x] = v; };
  const rect = (x0, y0, x1, y1, v) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, v); };
  const w0 = '#5a5a62', w1 = '#3a3a42', w2 = '#7a7a82';
  rect(5, 5, 21, 11, w0); rect(6, 4, 19, 4, w1); for (let x = 6; x <= 19; x += 2) set(x, 3, w1);
  rect(20, 2, 27, 8, w0); rect(26, 6, 29, 8, w2); set(23, 1, w1); set(25, 1, w1); set(24, 4, '#f0d040'); rect(27, 9, 29, 9, '#f0ece0');
  rect(0, 4, 5, 6, w1); set(0, 3, w1);
  for (const [x, ph] of [[6, 0], [9, 1], [17, 1], [20, 0]]) rect(x + (ph === a ? 1 : 0), 12, x + 1 + (ph === a ? 1 : 0), 16 - (ph === a ? 1 : 0), w1);
  return g;
}
// the Arkenstone: the Heart of the Mountain, a great white gem shot with many colours
function gemGrid(f) {
  const Wd = 14, Ht = 14, g = Array.from({ length: Ht }, () => Array(Wd).fill(null));
  const P = ['#ffffff', '#e8f4ff', '#d0e8ff', '#f8e0ff', '#e0fff0', '#fff4d0'];
  for (let y = 1; y <= 12; y++) { const w = 6 - Math.abs(y - 6.5) * 0.9; for (let x = Math.round(7 - w); x <= Math.round(6 + w); x++) g[y][x] = P[(x * 3 + y * 5 + f) % P.length]; }
  g[3][5] = '#ffffff'; g[4][6] = '#ffffff'; g[2 + f % 3][8] = '#ffffff';
  return g;
}
function figGrid(id, f) {
  if (C[id].special === 'trolls') return trollsGrid(f, false);
  if (C[id].special === 'stonetrolls') return trollsGrid(0, true);
  if (C[id].special === 'warg') return wargGrid(f);
  if (C[id].special === 'gem') return gemGrid(f);
  if (C[id].special === 'dragon') return hoardGrid(f);
  if (C[id].special === 'spider') return spiderGrid(f);
  if (C[id].special === 'ent') return entGrid(f);
  if (C[id].special === 'eye') return eyeGrid(f);
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
  if (b.gollum) {
    // thin, crouched, all skin and bone with a loincloth; long arms and big flat feet
    const sk = skin, sd = shade(skin, 0.82);
    rect(7, R(1), 10, R(6), sk); set(10, R(2), sd); set(10, R(4), sd); rect(7, R(5), 10, R(7), '#5a4a32');
    rect(5, R(1 + armL), 6, R(1 + armL), sk); rect(4, R(2 + armL), 4, R(8 + armL), sk); set(3, R(9 + armL), sk); set(4, R(9 + armL), sk);
    rect(11, R(1 + armR), 12, R(1 + armR), sd); rect(13, R(2 + armR), 13, R(8 + armR), sd); set(13, R(9 + armR), sd); set(14, R(9 + armR), sd);
    rect(7, R(8), 7, R(11 - upL), sk); rect(10, R(8), 10, R(11 - upR), sd); set(6, R(9), sk); set(11, R(9), sd);
    rect(5, R(12 - upL), 8, R(12 - upL), sk); rect(9, R(12 - upR), 12, R(12 - upR), sd);
  } else if (b.robe) {
    const o = b.robe, d = shade(o, 0.78);
    rect(6, R(0), 11, R(6), o); rect(5, R(1), 12, R(2), o);
    rect(5, R(7), 12, R(9), o); const sw = f === 1 ? -1 : f === 3 ? 1 : 0;
    rect(4 + sw, R(10), 13 + sw, R(11), o); for (let x = 4 + sw; x <= 13 + sw; x++) set(x, R(11), b.rags && x % 2 ? null : d);
    for (let r = 1; r <= 10; r++) set(11 + (r > 6 ? 1 : 0), R(r), d);
    if (b.belt) rect(6, R(4), 11, R(4), b.belt);
    if (b.iris) { const IR = ['#f0b4d0', '#a8e0f0', '#f0e49a', '#b8f0c0', '#d0b8f8']; for (let r = 1; r <= 11; r++) for (let x = 4; x <= 13; x++) if (g[R(r)][x] && (x * 5 + r * 3 + f) % 7 === 0) set(x, R(r), IR[(x + r) % IR.length]); }
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
    const t = b.tunic, td = shade(t, 0.8), fx = b.fat ? 1 : 0;
    rect(6 - fx, R(0), 11 + fx, R(7), t); rect(5 - fx, R(1), 12 + fx, R(2), t); for (let r = 1; r <= 7; r++) set(11 + fx, R(r), td);
    if (b.fat) rect(4, R(3), 13, R(5), t);
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
  if (b.gear === 'handshield') { rect(1, R(1 + armL), 5, R(7 + armL), '#16161a'); set(1, R(1 + armL), null); set(5, R(1 + armL), null); set(1, R(7 + armL), null); set(5, R(7 + armL), null);
    rect(3, R(3 + armL), 3, R(5 + armL), '#f0f0ea'); set(2, R(3 + armL), '#f0f0ea'); set(4, R(3 + armL), '#f0f0ea'); set(2, R(4 + armL), '#f0f0ea'); set(4, R(4 + armL), '#f0f0ea'); set(3, R(2 + armL), '#f0f0ea');   // the White Hand
    for (let y = R(4 + armR) - 6; y <= R(6 + armR); y++) set(14, y, '#8a8e96'); set(14, R(4 + armR) - 7, '#c8ccd4'); }
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
  } else if (kind === 'web') {
    g.strokeStyle = edge; g.lineWidth = 1.2; for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7); g.stroke(); }
    for (const q of [0.45, 0.85]) { g.beginPath(); g.ellipse(cx, cy, r * q, r * q * 0.7, 0, 0, 7); g.stroke(); }
  } else if (kind === 'hand') {
    g.fillStyle = edge; g.fillRect(cx - r * 0.45, cy - r * 0.2, r * 0.9, r * 0.8); for (let k = 0; k < 4; k++) g.fillRect(cx - r * 0.45 + k * r * 0.24, cy - r * (0.75 - Math.abs(k - 1.5) * 0.12), r * 0.17, r * 0.6); g.fillRect(cx + r * 0.42, cy, r * 0.3, r * 0.17);
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
// a fell beast: a naked, leathery winged creature with a long neck and tail, bearing a Ringwraith
function fellGrid(ids, f) {
  const W2 = 58, by = BY + 12, g = blank(W2, by + 16), hide = '#3a3540', hideD = '#24202a', bone = '#14121a', mem = '#4a4452';
  const up = [-16, -5, 10, -5][f];
  // far wing: bony fingers with membrane, ragged trailing edge
  const wing = (rx, tipX, dy, c, cd) => {
    for (let x = tipX; x <= rx; x++) {
      const u = (rx - x) / (rx - tipX), y = Math.round(by + 1 + dy * u), th = 1 + Math.round(5 * Math.sin(Math.PI * Math.min(1, u * 1.15)));
      setp(g, x, y - 1, bone); rectp(g, x, y, x, y + th - ((x % 5 === 0) ? 1 : 0), c);
      if (x % 6 === 0 && u > 0.2) for (let k = 0; k < th + 2; k++) setp(g, x - k / 2, y + k, cd);
    }
  };
  wing(34, 8, up - 3, hideD, bone);
  // tail, body, long neck and a cruel beaked head
  for (let i = 0; i < 14; i++) setp(g, 2 + i, by + 7 - Math.round(Math.sin(i / 3 + f) * 1.5), hideD), setp(g, 2 + i, by + 8 - Math.round(Math.sin(i / 3 + f) * 1.5), hide);
  rectp(g, 14, by + 1, 36, by + 7, hide); rectp(g, 16, by + 8, 34, by + 8, hideD);
  for (let i = 0; i < 12; i++) rectp(g, 35 + i, by + 2 - i, 37 + i, by + 3 - i, i % 3 ? hide : hideD);
  rectp(g, 46, by - 13, 52, by - 9, hide); rectp(g, 53, by - 11, 56, by - 10, '#6a6458'); setp(g, 50, by - 12, '#ff3b2f'); setp(g, 47, by - 14, bone); setp(g, 45, by - 15, bone);
  for (const x of [20, 30]) { rectp(g, x, by + 9, x, by + 11, hideD); setp(g, x + 1, by + 12, bone); setp(g, x - 1, by + 12, bone); }
  paste(g, upper(ids[0], 0), 15, by - (BY + 6) + 2);
  wing(32, 4, up, mem, bone);
  return g;
}
function eagleGrid(ids, f) {
  if (ids.includes('nazgul')) return fellGrid(ids, f);
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
  ids.slice(0, 3).forEach((id, i) => paste(g, upper(id, 0), 6 + i * 7, by - (BY + 6) + 1 + (i === 2 ? 1 : 0)));
  wing(28, 3, up, fell ? '#3e3946' : '#946a3c', fell ? '#18151c' : '#4e3418');                    // near wing, over the riders' laps
  return g;
}

// boats: an Elven boat of Lórien, a black ship of Umbar, the white ship of the Havens, or barrels
function boatGrid(ids, f, kind) {
  const n = ids.length, bob = f === 1 ? -1 : f === 3 ? 1 : 0;
  if (kind === 'barrel') {
    const rows = n > 7 ? 2 : 1, perRow = Math.ceil(n / rows), W2 = 14 * perRow + 10, g = blank(W2, BY + 14 + (rows - 1) * 6);
    // the back row first, so the front row's barrels cover it
    ids.map((id, i) => [id, i]).sort((p, q) => (q[1] < perRow) - (p[1] < perRow)).forEach(([id, i]) => {
      const row = i < perRow ? 1 : 0, col = i % perRow, ox = 2 + col * 14 + (rows > 1 && !row ? 7 : 0), oy = rows > 1 ? row * 6 : 0, b = ((i + f) % 2 ? 1 : 0) + oy;
      paste(g, figGrid(id, 0).map((row, y) => y <= BY + 1 ? row : row.map(() => null)), ox - 3, b - 1);
      rectp(g, ox + 1, BY + 2 + b, ox + 10, BY + 10 + b, '#8a5a30'); rectp(g, ox, BY + 4 + b, ox + 11, BY + 8 + b, '#8a5a30'); rectp(g, ox + 2, BY + 2 + b, ox + 9, BY + 2 + b, '#6a4222'); for (const x of [ox + 3, ox + 7]) rectp(g, x, BY + 3 + b, x, BY + 10 + b, '#7a4e28');
      for (const y of [BY + 4, BY + 8]) rectp(g, ox, y + b, ox + 11, y + b, '#4a4a50');
    });
    const wy = BY + 11 + (rows - 1) * 6; rectp(g, 0, wy, W2 - 1, wy, '#9ac4e0'); for (let x = f % 2; x < W2; x += 3) setp(g, x, wy + 1, '#cfe6f4');
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
// folk who never sit a horse: in a riding party they go on foot beside it
const ON_FOOT = new Set(['tom', 'goldberry', 'treebeard', 'gollum', 'ugluk', 'uruk', 'shelob', 'smaug', 'sauron', 'trolls', 'stonetrolls', 'goblin', 'greatgoblin', 'bolg', 'warg', 'mirkspider', 'arkenstone']);
function icon(ids, color, t, f = 0, mode = 'walk', flip = false) {
  if (ids.length > 1 && ids.includes('arkenstone')) {
    const base = icon(ids.filter(i => i !== 'arkenstone'), color, t, f, mode, flip), k = base.key + '|ark' + f;
    if (ICACHE[k]) return ICACHE[k];
    const cv = document.createElement('canvas'), g = cv.getContext('2d'), gs = 3, gw = 16 * gs; cv.width = Math.max(base.canvas.width, gw + 8); cv.height = base.canvas.height + gw * 0.6;
    g.drawImage(base.canvas, (cv.width - base.canvas.width) / 2, cv.height - base.canvas.height);
    const rg = g.createRadialGradient(cv.width / 2, gw / 2, 2, cv.width / 2, gw / 2, gw * 0.75); rg.addColorStop(0, 'rgba(255,255,255,0.95)'); rg.addColorStop(1, 'rgba(210,225,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, cv.width, gw * 1.2);
    drawGrid(g, gemGrid(f), cv.width / 2 - gw / 2, 0, gs);
    return ICACHE[k] = { canvas: cv, name: base.name, key: base.key + '|ark' };
  }
  if (mode === 'ride' && ids.every(i => ON_FOOT.has(i))) mode = 'walk';
  const S = new Set(ids), grp = groupOf(ids, t);
  const key = (grp ? grp.name : '') + '|' + [...S].sort().join(',') + '|' + color + '|' + mode + (flip ? '|w' : '');
  if (ICACHE[key + f]) return ICACHE[key + f];
  if (mode !== 'walk' && mode !== 'under') return ICACHE[key + f] = mounted(ids, S, grp, color, f, mode, flip, key);
  const cv = document.createElement('canvas'), g = cv.getContext('2d'), s = 3, fw = FIGW * s;
  const show = grp && grp.show ? grp.show : grp && grp.order ? grp.order.filter(i => S.has(i)).concat([...S].filter(i => !grp.order.includes(i))) : [...S];
  const hOf = id => (figGrid(id, 0).length + 2) * s, fh = Math.max(...show.map(hOf)), wOf = id => (figGrid(id, 0)[0].length + 2) * s;
  if (show.length === 1 && ['dragon', 'spider', 'trolls', 'stonetrolls', 'warg', 'gem'].includes(C[show[0]].special)) {
    const id = show[0]; cv.width = wOf(id) + 8; cv.height = hOf(id) + 6;
    if (C[id].special === 'spider') {        // her web, fine silver strands behind her
      const cx = cv.width / 2, cy = cv.height * 0.45, rx = cv.width * 0.5, ry = cv.height * 0.5;
      g.strokeStyle = 'rgba(220,222,232,0.75)'; g.lineWidth = 1;
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); g.stroke(); }
      for (const q of [0.3, 0.55, 0.8, 1]) { g.beginPath(); for (let k = 0; k <= 10; k++) { const a = k / 10 * Math.PI * 2; g.lineTo(cx + Math.cos(a) * rx * q, cy + Math.sin(a) * ry * q); } g.stroke(); }
    }
    if (C[id].special === 'gem') { const rg = g.createRadialGradient(cv.width / 2, cv.height / 2, 2, cv.width / 2, cv.height / 2, cv.width * 0.7); rg.addColorStop(0, 'rgba(255,255,255,0.9)'); rg.addColorStop(1, 'rgba(200,220,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, cv.width, cv.height); }
    drawFigure(g, id, 4, 2, s, f);
    return ICACHE[key + f] = { canvas: cv, name: C[id].name, key };
  }
  if (show.length === 1 && C[show[0]].special === 'eye') {
    const gh = hOf('sauron'); cv.width = wOf('sauron') + 30; cv.height = gh + 20;
    const rg = g.createRadialGradient(cv.width / 2, 30, 4, cv.width / 2, 30, cv.width * 0.6); rg.addColorStop(0, 'rgba(255,120,30,0.75)'); rg.addColorStop(1, 'rgba(255,60,10,0)');
    g.fillStyle = rg; g.fillRect(0, 0, cv.width, cv.height); drawFigure(g, 'sauron', 15, 8, s, f);
    return ICACHE[key + f] = { canvas: cv, name: 'The Eye of Sauron', key };
  }
  let two = show.length > 5, back = two ? show.slice(0, Math.floor(show.length / 2)) : [], front = two ? show.slice(back.length) : show;
  if (two && grp && grp.lead) {
    // the scene's leading figures stand front and centre, the rest of the company behind and around them
    const lead = grp.lead.filter(i => S.has(i)), rest = show.filter(i => !lead.includes(i)), nf = Math.max(lead.length, Math.ceil(show.length / 2));
    const side = rest.slice(0, nf - lead.length), half = Math.floor(side.length / 2);
    front = side.slice(0, half).concat(lead, side.slice(half)); back = rest.slice(nf - lead.length);
  }
  // figures overlap their neighbours by a share of their own width (the great ones take more room)
  const xsOf = row => { const xs = [0]; for (let k = 1; k < row.length; k++) xs.push(xs[k - 1] + Math.round(wOf(row[k - 1]) * (C[row[k - 1]].special ? 0.8 : 0.56))); return xs; };
  const step = Math.round(fw * 0.56), rowW = row => row.length ? xsOf(row)[row.length - 1] + wOf(row[row.length - 1]) : 0;
  const lift = two ? Math.round(fh * 0.2) : 0, width = Math.max(rowW(front), rowW(back) + step / 2);
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
  const x0 = (cv.width - rowW(back)) / 2, x1 = (cv.width - rowW(front)) / 2, foot = by + ry * (two ? 0.35 : 0.15), xb = xsOf(back), xf = xsOf(front);
  back.forEach((id, k) => drawFigure(g, id, x0 + xb[k], foot - hOf(id) - lift, s, (f + k * 2 + 1) % 4));
  front.forEach((id, k) => drawFigure(g, id, x1 + xf[k], foot - hOf(id), s, (f + k * 2) % 4));
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
    const walkers = show.filter(i => ON_FOOT.has(i));
    const rest = show.filter(i => i !== 'legolas' && i !== 'gimli' && !ON_FOOT.has(i)); if (S.has('legolas') && S.has('gimli')) units.push(['legolas', 'gimli']); else { if (S.has('legolas')) rest.push('legolas'); if (S.has('gimli')) rest.push('gimli'); }
    units = units.concat(rest.map(i => [i])).map((u, k) => horseGrid(u, (f + k) % 4, k)).concat(walkers.map((i, k) => Object.assign(figGrid(i, (f + k + 1) % 4).slice(), { walker: true })));
  } else if (S.has('smaug')) units = [dragonGrid(f, mode === 'fire')];
  else if (mode === 'fly') { const per = show.length > 6 ? 3 : 2; for (let i = 0; i < show.length; i += per) units.push(eagleGrid(show.slice(i, i + per), (f + i / per) % 4)); }
  else if (mode === 'boat') {
    // the three grey boats of Lórien: Aragorn with Frodo and Sam, Boromir with Merry and Pippin, Legolas and Gimli
    const crews = [['aragorn', 'frodo', 'sam'], ['boromir', 'merry', 'pippin'], ['legolas', 'gimli']].map(c => c.filter(i => S.has(i))).filter(c => c.length);
    const left = show.filter(i => !crews.flat().includes(i)), per = left.length > 8 ? 5 : 3; for (let i = 0; i < left.length; i += per) crews.push(left.slice(i, i + per));
    units = crews.map((c, k) => boatGrid(c, (f + k) % 4, 'boat'));
  } else units = [boatGrid(show, f, mode === 'barrel' ? 'barrel' : mode === 'sea' ? 'sea' : 'blackship')];
  const s = 3, ws = units.map(u => (u[0].length + 2) * s), hs = units.map(u => (u.length + 2) * s), many = units.length > 5;
  const step = units.length > 1 ? Math.round(Math.max(...ws) * (many ? (mode === 'fly' ? 0.42 : 0.32) : mode === 'fly' ? 0.5 : 0.62)) : 0, lift = units.length > 1 ? (many ? 12 : 10) : 0;
  const liftOf = j => units[j].walker ? 0 : many ? ((units.length - 1 - j) % 2) * lift : (units.length - 1 - j) * lift;
  const cv = document.createElement('canvas'), g = cv.getContext('2d');
  cv.width = Math.max(...ws) + step * (units.length - 1) + 16; cv.height = Math.max(...hs) + (many ? lift : lift * (units.length - 1)) + (mode === 'fly' || mode === 'fire' ? 26 : 12);
  const cx = cv.width / 2, by = cv.height - 8;
  // ground under a rider: a small token; under a flyer: its shadow far below
  if (mode === 'ride') { g.fillStyle = grp ? grp.frame : color; g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, by, cv.width / 2 - 4, 7, 0, 0, 7); g.fill(); g.stroke(); }
  if (mode === 'fly' || mode === 'fire') { g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(cx, by, cv.width * 0.3, 5, 0, 0, 7); g.fill(); g.fillStyle = color; g.beginPath(); g.arc(cx, by, 4, 0, 7); g.fill(); }
  g.save(); if (flip) { g.translate(cv.width, 0); g.scale(-1, 1); }
  units.forEach((_, k) => { const j = units.length - 1 - k; drawGrid(g, units[j], 8 + j * step, by - (mode === 'fly' || mode === 'fire' ? 20 : 4) - hs[j] - liftOf(j) + (mode === 'fly' || mode === 'fire' ? 0 : 6), s); });
  g.restore();
  const name = grp ? grp.name : show.length === 1 ? C[show[0]].name : listNames(show);
  return { canvas: cv, name, key };
}
/* ---- battles: two small armies under their banners, and the clash between them ---- */
const KIND = {
  rohan:     { skin: '#e8b892', helm: '#c9a03c', body: '#3f6a3a', legs: '#5a4a30', shield: '#2a5a2a', mark: '#f0f0ea', arm: 'spear' },
  gondor:    { skin: '#e8b892', helm: '#d6dae2', body: '#1e1e24', mark: '#f0f0ea', legs: '#2a2a30', shield: '#1e1e24', arm: 'spear' },
  dunedain:  { skin: '#e0b088', helm: '#3a4a3a', body: '#3a4a3a', legs: '#2a2a24', arm: 'sword' },
  uruk:      { skin: '#4e4234', helm: '#2a2a30', body: '#2e2a28', legs: '#2a2020', shield: '#16161a', mark: '#f0f0ea', arm: 'sword', eye: '#e8a838' },
  orc:       { skin: '#6a6e4a', helm: '#4a3a2a', body: '#4a3a2e', legs: '#3a2e24', shield: '#3a1a14', mark: '#e03a1a', arm: 'scimitar', eye: '#e8c040' },
  dunland:   { skin: '#e0b48c', helm: '#6a4a2a', body: '#7a5a3a', legs: '#5a4a30', arm: 'axe' },
  harad:     { skin: '#8a5a3a', helm: '#c9a03c', body: '#a02828', legs: '#6a1a1a', shield: '#c9a03c', mark: '#16110d', arm: 'spear' },
  easterling:{ skin: '#d8a878', helm: '#5a1a1a', body: '#7a2020', legs: '#2a1a1a', arm: 'axe' },
  corsair:   { skin: '#c8946a', helm: '#a02828', body: '#1e2a44', legs: '#2a2a30', arm: 'scimitar' },
  dead:      { skin: '#d8f0e4', helm: '#a8c8b8', body: '#b8d8c8', legs: '#98b8a8', arm: 'spear', ghost: 1 },
  dwarf:     { skin: '#e8b892', helm: '#9aa0a8', body: '#5a6a7a', legs: '#3a3a40', beard: '#8a5a30', arm: 'axe', short: 1 },
  dale:      { skin: '#e8b892', helm: '#9aa0a8', body: '#2f4f86', legs: '#3a3a40', shield: '#2f4f86', mark: '#e6c04e', arm: 'spear' },
  elf:       { skin: '#f6dcc4', helm: '#f0d070', body: '#4a7a3a', legs: '#6a5a3a', arm: 'bow' },
  goblin:    { skin: '#7a8a5a', helm: '#3a3a2e', body: '#3a3a2e', legs: '#2a2a20', arm: 'scimitar', short: 1, eye: '#e8c040' },
  hobbit:    { skin: '#f0c4a0', helm: '#6a4a2a', body: '#4f6b3a', legs: '#6a5a3a', arm: 'fork', short: 1 },
  ruffian:   { skin: '#d8a880', helm: '#4a3a2a', body: '#6a6a5a', legs: '#4a4a40', arm: 'club' },
};
// one foot soldier facing right, 8×12 (short folk 8×10)
function soldier(k, f, lunge) {
  const K = KIND[k], g = blank(9, 12), top = K.short ? 2 : 0, a = (f % 2) ? 1 : 0;
  const al = K.ghost ? 'cc' : '';
  const c = v => v && K.ghost ? v + al : v;
  rectp(g, 2, top, 5, top + 1, c(K.helm)); rectp(g, 2, top + 2, 5, top + 3, c(K.skin)); setp(g, 5, top + 2, c(K.eye || '#16110d'));
  if (K.beard) rectp(g, 3, top + 3, 6, top + 5, K.beard);
  rectp(g, 2, top + 4, 5, 8, c(K.body)); if (K.mark && !K.shield) setp(g, 4, 6, K.mark);
  rectp(g, 2, 9, 3, 11 - (a ? 0 : 1), c(K.legs)); rectp(g, 4, 9, 5, 11 - a, c(shade(K.legs, 0.8)));
  if (K.shield) { rectp(g, 0, top + 4, 2, 8, c(K.shield)); setp(g, 1, 6, K.mark); }
  const r = lunge && a ? 1 : 0, hx = 6 + r;
  setp(g, hx, 6 - a, c(K.skin));
  if (K.arm === 'spear' || K.arm === 'fork') { for (let y = 0; y <= 10; y++) setp(g, hx + 1, y - a, '#8a6a44'); setp(g, hx + 1, -a, '#d6dae2'); if (K.arm === 'fork') { setp(g, hx, 0, '#8a8a90'); setp(g, hx + 2, 0, '#8a8a90'); } }
  if (K.arm === 'sword' || K.arm === 'scimitar') { for (let i = 0; i < 4; i++) setp(g, hx + 1 + (K.arm === 'scimitar' && i > 2 ? 1 : 0), 5 - a - i, '#d6dae2'); setp(g, hx, 6 - a, '#c9a03c'); }
  if (K.arm === 'axe') { for (let y = 2; y <= 7; y++) setp(g, hx + 1, y - a, '#6b4a2a'); rectp(g, hx + 2, 2 - a, hx + 2, 4 - a, '#c8ccd4'); }
  if (K.arm === 'club') { for (let y = 3; y <= 7; y++) setp(g, hx + 1, y - a, '#6b4a2a'); rectp(g, hx + 1, 2 - a, hx + 2, 3 - a, '#5a3a22'); }
  if (K.arm === 'bow') { for (let y = 2; y <= 9; y++) setp(g, hx + (y < 4 || y > 7 ? 0 : 1), y, '#8a6234'); }
  return g;
}
// the great beasts and the tree-folk
function beast(k, f) {
  const a = f % 2;
  if (k === 'mumak') {
    const g = blank(24, 19), gr = '#8a8a8e', gd = '#626266';
    rectp(g, 6, 0, 14, 5, '#a02828'); rectp(g, 6, 0, 14, 0, '#c9a03c'); for (const x of [7, 10, 13]) setp(g, x, 2, '#16110d');
    rectp(g, 2, 6, 18, 14, gr); rectp(g, 4, 5, 15, 5, gr); rectp(g, 16, 4, 21, 11, gr); rectp(g, 15, 5, 17, 10, gd);
    for (let y = 11; y <= 16; y++) setp(g, 21 + (y > 14 ? 1 : 0) - (a && y > 13 ? 1 : 0), y, gr); rectp(g, 20, 10, 23, 10, '#f0ece0'); setp(g, 23, 9, '#f0ece0'); setp(g, 19, 6, '#16110d');
    for (const [x, ph] of [[3, 0], [6, 1], [13, 1], [16, 0]]) rectp(g, x, 15, x + 1, 18 - (ph === a ? 1 : 0), gd);
    setp(g, 1, 7, gd); setp(g, 0, 8, gd);
    return g;
  }
  if (k === 'troll') {
    const g = blank(12, 17), sk = '#6a7a6a', sd = '#4a5a4a';
    rectp(g, 4, 0, 7, 3, sk); setp(g, 7, 1, '#e8c040'); rectp(g, 2, 4, 9, 11, sk); rectp(g, 8, 4, 9, 11, sd); rectp(g, 3, 9, 8, 10, '#4a3a2a');
    rectp(g, 3, 12, 4, 16 - a, sd); rectp(g, 7, 12, 8, 16 - (1 - a), sd); rectp(g, 10, 3 + a, 11, 9 + a, '#5a4a3a'); rectp(g, 9, 1 + a, 11, 3 + a, '#3a3a40');
    return g;
  }
  if (k === 'ent' || k === 'huorn') {
    const g = blank(11, 19), ent = k === 'ent', b0 = ent ? '#6a4a2e' : '#24301c', b1 = ent ? '#4a321e' : '#141c10', lf = ent ? '#5a8a3a' : '#2a4020';
    for (let y = 0; y <= 5; y++) rectp(g, 3 - (y > 1 ? 2 : 0) + ((y + a) % 2), y, 8 + (y > 1 ? 2 : 0) - ((y + a) % 2), y, (y + a) % 3 ? lf : shade(lf, 0.75));
    rectp(g, 3, 5, 7, 16, b0); for (let y = 6; y <= 16; y += 3) setp(g, 5, y, b1);
    if (ent) { setp(g, 4, 7, '#a8c860'); setp(g, 6, 7, '#a8c860'); rectp(g, 4, 9, 6, 12, '#8a9a6a'); }
    for (let y = 8; y <= 12; y++) { setp(g, 2 - (y > 10 ? 1 : 0), y + a - 1, b1); setp(g, 8 + (y > 10 ? 1 : 0), y - a, b1); }
    rectp(g, 2, 17, 4, 18 - a, b1); rectp(g, 6, 17, 8, 18 - (1 - a), b1);
    return g;
  }
  if (k === 'bat') {
    const g = blank(10, 6), b0 = '#1a1418'; rectp(g, 4, 2, 5, 4, b0); setp(g, 4, 1, b0); setp(g, 5, 1, b0); setp(g, 4, 3, '#ff3b2f');
    for (let x = 0; x <= 3; x++) { setp(g, x, a ? 1 + Math.abs(x - 2) : 4 - Math.abs(x - 2), b0); setp(g, 9 - x, a ? 1 + Math.abs(x - 2) : 4 - Math.abs(x - 2), b0); }
    return g;
  }
  if (k === 'bolg') {           // Bolg of the North: a great black-mailed orc chieftain
    const g = blank(13, 18), sk = '#4a4a34', ar = '#2a2a30';
    rectp(g, 4, 0, 8, 2, ar); setp(g, 6, 0, '#a83020'); rectp(g, 4, 3, 8, 5, sk); setp(g, 7, 4, '#f05030'); setp(g, 5, 5, '#f0ece0'); setp(g, 8, 5, '#f0ece0');
    rectp(g, 2, 6, 10, 12, ar); for (let y = 6; y <= 12; y++) for (let x = 2; x <= 10; x++) if ((x + y) % 2) setp(g, x, y, '#3a3a42');
    rectp(g, 3, 13, 4, 17 - a, '#1a1a1e'); rectp(g, 8, 13, 9, 17 - (1 - a), '#1a1a1e'); rectp(g, 11, 2 + a, 11, 10 + a, '#6b4a2a'); rectp(g, 11, 1 + a, 12, 3 + a, '#9aa0a8');
    return g;
  }
  if (k === 'thorin') {         // Thorin's charge from the Gate: the King under the Mountain in mail, with Orcrist
    return Object.assign(soldier('dwarf', f, true), {}).map((row, y) => row.map((v, x) => y <= 3 && v === KIND.dwarf.helm ? '#5a8ad8' : v === KIND.dwarf.beard ? '#262021' : v));
  }
  if (k === 'eagle' || k === 'nazgul') {
    const g = blank(18, 10), ea = k === 'eagle', b0 = ea ? '#7a5430' : '#2c2832', b1 = ea ? '#4e3418' : '#18151c', hd = ea ? '#d0a252' : '#3a3540';
    rectp(g, 4, 4, 12, 6, b0); rectp(g, 12, 3, 15, 5, hd); setp(g, 16, 4, ea ? '#f0c040' : '#6a6458'); setp(g, 14, 3, ea ? '#16110d' : '#ff3b2f'); rectp(g, 1, 5, 4, 6, b1);
    if (!ea) { rectp(g, 7, 2, 9, 4, '#1b1a20'); setp(g, 8, 1, '#1b1a20'); }
    const wy = a ? 0 : 8; for (let x = 4; x <= 11; x++) { const y = Math.round(4 + (wy - 4) * (11 - x) / 7 * (a ? 1 : 0.9)); rectp(g, x, Math.min(y, 4), x, Math.max(y, 4), b1); }
    return g;
  }
  if (k === 'warg') {
    const g = blank(14, 9), w0 = '#4a4a52', w1 = '#2a2a30';
    rectp(g, 2, 2, 10, 5, w0); rectp(g, 10, 1, 13, 4, w0); setp(g, 11, 0, w1); setp(g, 12, 2, '#e8c040'); setp(g, 13, 4, '#f0ece0'); rectp(g, 0, 1, 2, 2, w1);
    for (const [x, ph] of [[3, 0], [5, 1], [8, 1], [10, 0]]) rectp(g, x + (ph === a ? 1 : 0), 6, x + (ph === a ? 1 : 0), 8, w1);
    return g;
  }
  if (k === 'beorn') {
    const g = blank(16, 12), b0 = '#5a3a20', b1 = '#3a2410';
    rectp(g, 1, 3, 11, 8, b0); rectp(g, 3, 1, 9, 2, b0); rectp(g, 11, 1, 15, 6, b0); setp(g, 12, 0, b1); setp(g, 14, 0, b1); setp(g, 14, 2, '#16110d'); setp(g, 15, 4, b1);
    for (const [x, ph] of [[2, 0], [4, 1], [9, 1], [11, 0]]) rectp(g, x, 9, x + 1, 11 - (ph === a ? 1 : 0), b1);
    return g;
  }
  if (k === 'rider') {
    const g = blank(16, 15), h0 = '#8a5a30', h1 = '#5a3a1a';
    rectp(g, 2, 7, 11, 10, h0); rectp(g, 11, 4, 13, 8, h0); rectp(g, 13, 3, 15, 5, h0); setp(g, 0, 8, h1); setp(g, 1, 7, h1); setp(g, 1, 9, h1);
    for (const [x, ph] of [[3, 0], [5, 1], [9, 1], [11, 0]]) rectp(g, x + (ph === a ? 1 : 0), 11, x + (ph === a ? 1 : 0), 14 - (ph === a ? 1 : 0), h1);
    rectp(g, 5, 0, 7, 1, '#c9a03c'); rectp(g, 5, 2, 7, 3, '#e8b892'); setp(g, 7, 2, '#16110d'); rectp(g, 5, 4, 7, 7, '#3f6a3a'); setp(g, 6, 8, '#5a4a30');
    for (let y = 0; y <= 7; y++) setp(g, 9 + (a ? 1 : 0), y - 1 + Math.round(y / 3), '#8a6a44'); setp(g, 9 + (a ? 1 : 0), -1, '#d6dae2');
    return g;
  }
  return soldier(k, f, true);
}
const BANNER = {
  rohan: ['#2a5a2a', '#f0f0ea', 'horse'], gondor: ['#141418', '#f0f0ea', 'tree'], mordor: ['#141418', '#e03a1a', 'eye'], isengard: ['#141418', '#f0f0ea', 'hand'],
  dead: ['#4a5a54', '#c8e8d8', 'star'], umbar: ['#1e2a44', '#a02828', 'star'], erebor: ['#2f4f86', '#e6c04e', 'star'], ents: ['#3e6a2a', '#a8c860', 'leaf'],
  goblins: ['#2a1a14', '#e03a1a', 'eye'], shire: ['#4f6b3a', '#e6c04e', 'leaf'], ruffians: ['#5a5a50', '#2a2a24', 'star'],
};
function banner(g, kind, x, y, s, f, flip) {
  const [bg, fg] = BANNER[kind] || ['#333', '#ccc'];
  g.fillStyle = OUT; g.fillRect(x - 1, y - 1, s + 2, 30 * s / 2 + 2); g.fillStyle = '#8a6a44'; g.fillRect(x, y, s, 30 * s / 2);
  const fx = flip ? x - 12 * s : x + s, wave = f % 2 ? s : 0;
  g.fillStyle = OUT; g.fillRect(fx - 1, y - 1, 12 * s + 2, 9 * s + 2 + wave);
  g.fillStyle = bg; g.fillRect(fx, y, 12 * s, 9 * s + wave); g.fillStyle = fg;
  const cx = fx + 6 * s, cy = y + 4.5 * s;
  if ((BANNER[kind] || [])[2] === 'eye') { g.fillRect(cx - 3 * s, cy - s, 6 * s, 2 * s); g.fillStyle = '#16110d'; g.fillRect(cx - 0.5 * s, cy - s, s, 2 * s); }
  else if ((BANNER[kind] || [])[2] === 'tree') { g.fillRect(cx - 0.5 * s, cy - 2 * s, s, 5 * s); g.fillRect(cx - 2.5 * s, cy - 2 * s, 5 * s, s); g.fillRect(cx - 1.5 * s, cy - 3 * s, 3 * s, s); }
  else if ((BANNER[kind] || [])[2] === 'hand') { g.fillRect(cx - 2 * s, cy - s, 4 * s, 3 * s); for (let k = 0; k < 4; k++) g.fillRect(cx - 2 * s + k * s, cy - 3 * s, s * 0.8, 2 * s); }
  else if ((BANNER[kind] || [])[2] === 'horse') { g.fillRect(cx - 3 * s, cy, 4 * s, 2 * s); g.fillRect(cx, cy - 2 * s, 2 * s, 3 * s); g.fillRect(cx + 2 * s, cy - 2 * s, s, s); g.fillRect(cx - 3 * s, cy + 2 * s, s, s); g.fillRect(cx, cy + 2 * s, s, s); }
  else { g.fillRect(cx - s, cy - 2 * s, 2 * s, 4 * s); g.fillRect(cx - 2 * s, cy - s, 4 * s, 2 * s); }
}
const BCACHE2 = {};
function battle(b, f) {
  const key = b.name + f; if (BCACHE2[key]) return BCACHE2[key];
  const s = 2, half = 150, W2 = half * 2 + 20, H2 = 120, cv = document.createElement('canvas'), g = cv.getContext('2d');
  cv.width = W2; cv.height = H2; const mid = W2 / 2, ground = H2 - 14;
  // dust of the field
  g.fillStyle = 'rgba(70,52,30,0.35)'; g.beginPath(); g.ellipse(mid, ground - 6, half + 4, 16, 0, 0, 7); g.fill();
  if (b.muster) {
    // tents on the Firienfeld behind, then the Riders in ranks facing east, the banner and a horn-blower
    for (let i = 0; i < 6; i++) { const tx = 40 + i * 44 + (i % 2) * 10, ty = ground - 44 - (i % 2) * 8;
      g.fillStyle = OUT; g.beginPath(); g.moveTo(tx - 15, ty + 17); g.lineTo(tx, ty - 3); g.lineTo(tx + 15, ty + 17); g.closePath(); g.fill();
      g.fillStyle = i % 2 ? '#e8e2d0' : '#d8d0b8'; g.beginPath(); g.moveTo(tx - 12, ty + 15); g.lineTo(tx, ty); g.lineTo(tx + 12, ty + 15); g.closePath(); g.fill();
      g.fillStyle = '#2a5a2a'; g.fillRect(tx - 1, ty - 9, 2, 8); g.fillRect(tx + 1, ty - 9, 6, 3 + (f + i) % 2); }
    const side = b.sides[0], list = []; for (const [k, n] of side.units) for (let i = 0; i < n; i++) list.push(k);
    list.forEach((k, i) => { const col = i % 7, row = Math.floor(i / 7), gr = k === 'rider' ? beast('rider', f + i) : soldier(k, f + i, false);
      const w = (gr[0].length + 2) * s, h = (gr.length + 2) * s; drawGrid(g, gr, 30 + col * 36 + row * 14 - w / 2, ground - 8 + row * 8 - h, s); });
    banner(g, side.banner, W2 - 30, 22, s, f, false);
    return BCACHE2[key] = cv;
  }
  b.sides.forEach((side, si) => {
    const dir = si === 0 ? 1 : -1, list = [];
    for (const [k, n] of side.units) for (let i = 0; i < n; i++) list.push(k);
    const big = list.filter(k => ['mumak', 'troll', 'ent', 'huorn', 'beorn', 'bolg'].includes(k)), fly = list.filter(k => k === 'eagle' || k === 'nazgul' || k === 'bat'), foot = list.filter(k => !big.includes(k) && !fly.includes(k));
    const place = [];
    // foot and riders in ranks, front rank nearest the clash
    foot.forEach((k, i) => { const col = Math.floor(i / 3), row = i % 3; place.push([k, mid - dir * (18 + col * 15 + (row % 2) * 7), ground - 30 + row * 9, i < 3]); });
    const footBack = foot.length ? 18 + Math.floor((foot.length - 1) / 3) * 15 + 7 : 0;
    big.forEach((k, i) => place.push([k, mid - dir * ((foot.length ? footBack + 10 : 24) + i * (foot.length ? 22 : 17)), ground - 12 + (foot.length ? 0 : (i % 2) * 6), !foot.length && i === 0]));
    place.sort((p, q) => p[2] - q[2]);
    const reach = Math.max(30, ...place.map(p => Math.abs(p[1] - mid)));
    banner(g, side.banner, Math.max(8, Math.min(W2 - 8, mid - dir * (reach + 16))), 22, s, f + si, dir < 0);
    for (const [k, x, y, front] of place) {
      const gr = ['mumak', 'troll', 'ent', 'huorn', 'beorn', 'rider', 'warg', 'bolg', 'thorin'].includes(k) ? beast(k, f + (x | 0) % 2) : soldier(k, f + (x | 0) % 2, front);
      const w = (gr[0].length + 2) * s, h = (gr.length + 2) * s, bob = front && f % 2 ? dir * 2 : 0;
      g.save(); if (dir < 0) { g.translate(x + w / 2 + bob, 0); g.scale(-1, 1); g.translate(-w / 2, 0); } else g.translate(x - w / 2 + bob, 0);
      drawGrid(g, gr, 0, y - h + (gr.length > 14 ? 10 : 0), s); g.restore();
    }
    fly.forEach((k, i) => { const gr = beast(k, f + i); const w = (gr[0].length + 2) * s; g.save(); const x = mid - dir * (26 + i * 30), y = 6 + (i % 2) * 12 + (f % 2) * 2;
      if (dir < 0) { g.translate(x + w / 2, 0); g.scale(-1, 1); g.translate(-w / 2, 0); } else g.translate(x - w / 2, 0); drawGrid(g, gr, 0, y, s); g.restore(); });
  });
  // the clash: sparks along the line, changing each frame
  for (let i = 0; i < 3; i++) {
    const y = ground - 40 + i * 12 + ((f + i) % 2) * 3, x = mid + ((f * 7 + i * 5) % 9) - 4, r = (f + i) % 2 ? 7 : 4;
    g.fillStyle = '#fff6c8'; g.beginPath(); for (let k = 0; k < 8; k++) { const ang = k * Math.PI / 4 + f, q = k % 2 ? r * 0.35 : r; g.lineTo(x + Math.cos(ang) * q, y + Math.sin(ang) * q); } g.fill();
    g.fillStyle = '#ffb030'; g.beginPath(); g.arc(x, y, r * 0.3, 0, 7); g.fill();
  }
  return BCACHE2[key] = cv;
}
function listNames(ids) {
  const n = [...new Set(ids.map(i => C[i].name))];
  return n.length <= 2 ? n.join(' & ') : n.length <= 4 ? n.slice(0, -1).join(', ') + ' & ' + n[n.length - 1] : n.slice(0, 3).join(', ') + ` & ${n.length - 3} more`;
}
function dataURL(ids, color, t) { return icon(ids, color, t).canvas.toDataURL(); }
// one soldier, rider or beast of a battle as its own canvas (for the ground view's armies)
const UCACHE = {};
function unitCanvas(kind, f, flip) {
  const key = kind + f + (flip ? 'w' : ''); if (UCACHE[key]) return UCACHE[key];
  const gr = ['mumak', 'troll', 'ent', 'huorn', 'beorn', 'rider', 'warg', 'bolg', 'thorin', 'eagle', 'nazgul', 'bat'].includes(kind) ? beast(kind, f) : soldier(kind, f, f % 2 === 1);
  const s = 3, cv = document.createElement('canvas'); cv.width = (gr[0].length + 2) * s; cv.height = (gr.length + 2) * s;
  const g = cv.getContext('2d'); if (flip) { g.translate(cv.width, 0); g.scale(-1, 1); } drawGrid(g, gr, 0, 0, s);
  return UCACHE[key] = cv;
}
/* ---- landmarks drawn on the map: Orodruin smoking (its fire follows the story) and Minas Tirith ---- */
// Mount Doom, f = frame 0..3, heat 0 (dormant) .. 1 (the War) .. 2 (erupting as the Ring is unmade)
function doomGrid(f, heat) {
  const Wd = 46, Ht = 44, g = blank(Wd, Ht), cx = 23;
  const ash = ['#4d3f36', '#3b302a', '#2a221e'], hot = f % 2 ? '#ffb040' : '#ff7a1c';
  // the smoke: puffs rising from the crater and drifting away west, more and darker as the fire wakes
  const puffs = heat < 0.5 ? 3 : heat < 1.5 ? 6 : 9;
  for (let k = 0; k < puffs; k++) {
    const age = ((k + f / 4) / puffs), y = 15 - age * (heat > 1.5 ? 15 : 12), x = cx - age * (heat > 1.5 ? 6 : 14) + Math.sin(k * 2.1) * 2, r = 2 + age * (heat > 1.5 ? 5 : 3.5);
    const col = heat > 1.5 && age < 0.35 ? '#7a2a12' : age < 0.5 ? '#4a423c' : '#625a52';
    for (let yy = -r; yy <= r; yy++) for (let xx = -r * 1.3; xx <= r * 1.3; xx++) if ((xx / 1.3) ** 2 + yy * yy <= r * r) setp(g, x + xx, y + yy, col);
  }
  // the ash-cone on its great base: steep above, broad scarred shoulders below
  for (let y = 15; y < Ht; y++) {
    const hw = y < 29 ? 2.5 + (y - 15) * 0.55 : 10.2 + (y - 29) * 0.85 + (y > 31 ? 1.5 : 0);
    for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) setp(g, x, y, x < cx - hw * 0.35 ? ash[0] : x > cx + hw * 0.4 ? ash[2] : ash[1]);
  }
  rectp(g, cx - 2, 14, cx + 2, 15, heat > 0.3 ? '#ffd060' : '#5a4a40');
  if (heat > 0.3) {
    setp(g, cx - 1, 13, hot); setp(g, cx + 1, 13, hot); if (heat > 1.5) { rectp(g, cx - 1, 9, cx + 1, 12, f % 2 ? '#ffe080' : '#ff9a30'); setp(g, cx - 3, 11 - f % 2, '#ffb040'); setp(g, cx + 3, 10 + f % 2, '#ff7a1c'); }
    // rivers of fire down the flanks
    const streams = heat > 1.5 ? [[-1, 0.9], [1, 0.7], [0.3, 1.4], [-0.6, 1.6]] : [[1, 0.7], [-0.4, 1.3]];
    for (const [dir, slope] of streams) { let x = cx + dir; for (let y = 16; y < Ht - 2; y++) { x += dir * slope * 0.5 + Math.sin(y * 0.9 + dir) * 0.4; setp(g, x, y, (y + f) % 5 === 0 ? '#ffd060' : y > 34 ? '#c03a10' : hot); } }
    // the Sammath Naur: a red mouth in the cone's eastern side
    rectp(g, cx + 5, 22, cx + 6, 23, f % 2 ? '#ff9a30' : '#e05010');
  }
  return g;
}
// Minas Tirith: seven white circles stepped up the knee of Mindolluin, the prow of rock and the White Tower
function cityGrid(f) {
  const Wd = 46, Ht = 40, g = blank(Wd, Ht), cx = 24;
  // Mindolluin behind, snow on its head
  for (let y = 2; y < Ht - 4; y++) { const t = y - 2; for (let x = Math.round(11 - t * 0.28 - (t > 14 ? (t - 14) * 0.2 : 0)); x <= Math.round(11 + t * 0.9); x++) setp(g, x, y, y < 6 + (x % 3 === 0 ? 1 : 0) ? '#eef2f6' : x < 11 - t * 0.05 ? '#6c7480' : '#56606c'); }
  for (let k = 0; k < 7; k++) {
    const y1 = Ht - 1 - k * 3.6, y0 = y1 - 3, hw = 20 - k * 2.5;
    for (let y = Math.round(y0); y <= Math.round(y1); y++) for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) setp(g, x, y, y === Math.round(y0) ? '#ffffff' : (x + k) % 4 === 0 && y === Math.round(y0) + 2 ? '#8a8478' : '#e8e4da');
    rectp(g, Math.round(cx + hw), Math.round(y0), Math.round(cx + hw), Math.round(y1), '#b8b2a6');
  }
  // the prow of rock that cleaves the circles, and the Great Gate below it
  for (let y = 15; y < Ht - 1; y++) { setp(g, cx, y, '#cfcac0'); setp(g, cx + 1, y, '#b0aa9e'); }
  rectp(g, cx - 1, Ht - 3, cx + 2, Ht - 1, '#2e2a24');
  // the Citadel and the White Tower of Ecthelion, its pinnacle shining
  rectp(g, cx - 4, 12, cx + 4, 14, '#f4f2ec');
  rectp(g, cx - 1, 2, cx + 1, 12, '#fbfaf6'); setp(g, cx + 1, 6, '#c8c4ba'); setp(g, cx + 1, 9, '#c8c4ba'); setp(g, cx, 1, '#ffffff'); setp(g, cx, 0, f % 2 ? '#ffffff' : '#e8f0ff');
  // the banner of the Stewards (a plain white standard) above the tower
  rectp(g, cx + 2, 0, cx + 4 + (f % 2), 1, '#f6f6f2');
  return g;
}
const LCACHE = {};
function landmark(kind, f, heat = 1) {
  const key = kind + f + ':' + heat; if (LCACHE[key]) return LCACHE[key];
  const gr = kind === 'doom' ? doomGrid(f, heat) : cityGrid(f), s = 3, cv = document.createElement('canvas');
  cv.width = (gr[0].length + 2) * s; cv.height = (gr.length + 2) * s; drawGrid(cv.getContext('2d'), gr, 0, 0, s);
  return LCACHE[key] = cv;
}
return { C, B, JOURNEY, GROUPS, charsOf, icon, dataURL, drawHead, drawFigure, battle, unitCanvas, landmark };
})();
if (typeof self !== 'undefined') self.AVATARS = AVATARS;
