// The Known World (A Song of Ice and Fire): starter package. See docs/otherworldly/got/PLAN.md and LAWS.md.
// Facts only, in our own words; every place is ledgered before it gets coordinates. X, Y are miles east and north
// of Winterfell and stay null until Phase 1 measures them (grade 'todo'). Dates use worlds/got/calendar.js.
(function (root) {
  const WORLD = {
    id: 'got',
    title: 'The Known World',
    subtitle: 'An unofficial atlas of A Song of Ice and Fire',
    attribution: 'Places, people and events from George R. R. Martin\'s A Song of Ice and Fire. An unofficial fan project, not endorsed by the author or publishers.',
    canon: ['AGOT', 'ACOK', 'ASOS', 'AFFC', 'ADWD', 'TWOIAF', 'FB'],
    frame: { origin: 'Winterfell', originLat: 55 },
  };

  // abbreviation -> book; ledger references read like 'AGOT Bran I' or 'TWOIAF The Wall and Beyond'
  const BIB = {
    AGOT: 'A Game of Thrones (1996)', ACOK: 'A Clash of Kings (1998)', ASOS: 'A Storm of Swords (2000)',
    AFFC: 'A Feast for Crows (2005)', ADWD: 'A Dance with Dragons (2011)', TWOIAF: 'The World of Ice & Fire (2014)',
    FB: 'Fire & Blood (2018)', AUTHOR: 'the author, outside the novels (interviews, letters)',
  };

  // stories open at their first event; years to verify in TWOIAF before the days are set
  const STORIES = {
    agot: { title: 'A Game of Thrones', start: '298 1 1', end: '299 6 1', verify: true },
    acok: { title: 'A Clash of Kings', start: '299 1 1', end: '299 13 5', verify: true },
    asos: { title: 'A Storm of Swords', start: '299 6 1', end: '300 6 1', verify: true },
    feastdance: { title: 'A Feast for Crows & A Dance with Dragons', start: '300 1 1', end: '300 13 5', verify: true },
    histories: { title: 'Conquest, Dance and Rebellion', start: '-2 1 1', end: '283 13 5', verify: true },
  };

  // [name, kind, X, Y, realm, note (ours), { rank, grade }]: positions to be measured in Phase 1
  const P = (name, kind, realm, note, rank) => [name, kind, null, null, realm, note, { rank, grade: 'todo' }];
  const PLACES = [
    P('Winterfell', 'castle', 'The North', 'Seat of House Stark, with hot springs under its walls and an ancient godswood.', 1),
    P('Castle Black', 'castle', 'The Wall', 'Headquarters of the Night\'s Watch at the foot of the Wall.', 1),
    P('Eastwatch-by-the-Sea', 'castle', 'The Wall', 'The Watch\'s castle at the eastern end of the Wall, on the sea.', 3),
    P('The Shadow Tower', 'castle', 'The Wall', 'The Watch\'s westernmost manned castle, by the mountains.', 3),
    P('Westwatch-by-the-Bridge', 'castle', 'The Wall', 'An abandoned castle near the Wall\'s western end.', 5),
    P('The Fist of the First Men', 'landmark', 'Beyond the Wall', 'An ancient ring-fort on a hill beyond the Wall.', 3),
    P('Moat Cailin', 'ruin', 'The North', 'Ruined fortress guarding the causeway through the Neck.', 3),
    P('The Twins', 'castle', 'The Riverlands', 'Twin castles of House Frey on either bank of the Green Fork, joined by a bridge.', 2),
    P('Riverrun', 'castle', 'The Riverlands', 'Seat of House Tully where two rivers meet.', 2),
    P('Harrenhal', 'castle', 'The Riverlands', 'The greatest castle ever built, its towers melted by dragonfire.', 2),
    P('The Eyrie', 'castle', 'The Vale', 'Seat of House Arryn, high on a mountain, reached by a perilous path.', 2),
    P('Casterly Rock', 'castle', 'The Westerlands', 'Seat of House Lannister, carved into a great rock by the sea.', 2),
    P('Lannisport', 'city', 'The Westerlands', 'The Lannisters\' port city below Casterly Rock.', 3),
    P('King\'s Landing', 'city', 'The Crownlands', 'The capital, on hills above the mouth of the Blackwater.', 1),
    P('Dragonstone', 'castle', 'The Crownlands', 'Targaryen island fortress beneath a smoking mountain.', 2),
    P('Storm\'s End', 'castle', 'The Stormlands', 'Seat of House Baratheon, a great round keep by the sea.', 2),
    P('Highgarden', 'castle', 'The Reach', 'Seat of House Tyrell amid fertile country.', 2),
    P('Oldtown', 'city', 'The Reach', 'Ancient city of the Citadel and the Hightower.', 2),
    P('Sunspear', 'castle', 'Dorne', 'Seat of House Martell on the Dornish coast.', 2),
    P('Pyke', 'castle', 'The Iron Islands', 'Seat of House Greyjoy, its towers on stacks of rock in the sea.', 2),
    P('White Harbor', 'city', 'The North', 'The North\'s great port at the mouth of the White Knife.', 3),
    P('Braavos', 'city', 'The Free Cities', 'City of canals and islands, guarded by a giant bronze titan.', 2),
    P('Pentos', 'city', 'The Free Cities', 'Free City across the narrow sea where the story finds the exiled Targaryens.', 2),
    P('Vaes Dothrak', 'city', 'The Dothraki Sea', 'The Dothraki\'s only city, at the foot of a sacred mountain.', 2),
    P('Qarth', 'city', 'The East', 'A rich trading city on the straits to the Jade Sea.', 2),
    P('Astapor', 'city', 'Slaver\'s Bay', 'A slave city on Slaver\'s Bay.', 2),
    P('Yunkai', 'city', 'Slaver\'s Bay', 'A slave city of yellow brick.', 3),
    P('Meereen', 'city', 'Slaver\'s Bay', 'The greatest of the slave cities, crowned by a great pyramid.', 2),
    P('Valyria', 'ruin', 'Valyria', 'The ruins of the Freehold, destroyed in the Doom.', 2),
  ];

  // first scale tests (see sources.js conventions in Arda); 'verify' marks a fact whose chapter is still to be found
  const STATEMENTS = [
    { id: 'wall-long', src: 'AGOT', conf: 'high', verify: true, claim: 'The Wall runs about 300 miles from sea to mountains.', test: ['dist', 'Eastwatch-by-the-Sea', 'Westwatch-by-the-Bridge', 300, 0.12] },
    { id: 'westeros-long', src: 'AUTHOR', conf: 'medium', claim: 'Westeros is about 3,000 miles from the Wall to the south of Dorne.', test: ['south', 'Castle Black', 'Sunspear', 2800, 0.2] },
  ];

  // first sprites: cues from the text, to be verified before drawing (LAWS I.3: never an actor's likeness)
  const CAST = {
    eddard: { name: 'Eddard Stark', house: 'stark', cues: 'dark hair, grey eyes' },
    catelyn: { name: 'Catelyn Stark', house: 'tully', cues: 'auburn hair, blue eyes' },
    jon: { name: 'Jon Snow', house: 'stark', cues: 'dark hair, grey eyes; Night\'s Watch black from AGOT' },
    arya: { name: 'Arya Stark', house: 'stark', cues: 'long face, brown hair, grey eyes' },
    sansa: { name: 'Sansa Stark', house: 'stark', cues: 'auburn hair, blue eyes' },
    bran: { name: 'Bran Stark', house: 'stark', cues: 'auburn hair' },
    tyrion: { name: 'Tyrion Lannister', house: 'lannister', cues: 'a dwarf; pale blond hair; one green eye, one black' },
    cersei: { name: 'Cersei Lannister', house: 'lannister', cues: 'golden hair, green eyes' },
    jaime: { name: 'Jaime Lannister', house: 'lannister', cues: 'golden hair, green eyes' },
    daenerys: { name: 'Daenerys Targaryen', house: 'targaryen', cues: 'silver-gold hair, violet eyes' },
  };
  const SPECIALS = {
    ghost: { name: 'Ghost', kind: 'direwolf', cues: 'white, red eyes' },
    shaggydog: { name: 'Shaggydog', kind: 'direwolf', cues: 'black' },
    drogon: { name: 'Drogon', kind: 'dragon', cues: 'black and red' },
    rhaegal: { name: 'Rhaegal', kind: 'dragon', cues: 'green and bronze' },
    viserion: { name: 'Viserion', kind: 'dragon', cues: 'cream and gold' },
  };

  const api = { WORLD, BIB, STORIES, PLACES, STATEMENTS, CAST, SPECIALS };
  if (typeof module !== 'undefined') module.exports = api; else root.GOT_WORLD = api;
})(typeof self !== 'undefined' ? self : this);
