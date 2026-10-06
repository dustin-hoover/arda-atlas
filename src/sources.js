/* The source ledger: where every place on the atlas comes from, and statements in the texts that the map
   can be measured against. tools/sources/audit.js checks the map against it and reports.

   Copyright: positions, dates and distances are facts and are recorded as such. Statements are short
   paraphrases with a reference, never quotations, and no artwork is reproduced.

   Grades, strongest first:
     map      measured on Christopher Tolkien's general map of Middle-earth (tools/refit/anchors.json)
     atlas    measured on Karen Wynn Fonstad's Third Age map (tools/refit/fanchors.json); not on CT's
     warp     named on Tolkien's maps, carried into place by the refit warp but not measured on its own
     text     not on Tolkien's maps; placed from the text's description
     invented the atlas's own stand-in for something the texts name without placing
   `chk` is 0 until each reference has been checked against the text (the first pass was made from
   memory); the audit lists what is still unchecked. */
const SOURCES = (() => {
const BIB = {
  H:        { t: 'The Hobbit', a: 'J.R.R. Tolkien', y: 1937, kind: 'primary', cite: 'chapter' },
  LR:       { t: 'The Lord of the Rings', a: 'J.R.R. Tolkien', y: 1954, kind: 'primary', cite: 'book.chapter; Pro = Prologue; AppA–F' },
  Thror:    { t: 'Thrór\'s Map (in The Hobbit)', a: 'J.R.R. Tolkien', y: 1937, kind: 'primary map' },
  Wild:     { t: 'Map of Wilderland (in The Hobbit)', a: 'J.R.R. Tolkien', y: 1937, kind: 'primary map' },
  CTmap:    { t: 'The general map of Middle-earth (LR, redrawn for Unfinished Tales)', a: 'Christopher Tolkien after J.R.R. Tolkien', y: 1954, kind: 'primary map', note: 'The frame of this atlas: 53 anchors measured on it.' },
  CTshire:  { t: 'A Part of the Shire (LR)', a: 'Christopher Tolkien after J.R.R. Tolkien', y: 1954, kind: 'primary map' },
  CTgondor: { t: 'Rohan, Gondor and Mordor (LR; large-scale redrawing 1980)', a: 'Christopher Tolkien after J.R.R. Tolkien', y: 1955, kind: 'primary map' },
  UT:       { t: 'Unfinished Tales', a: 'J.R.R. Tolkien, ed. Christopher Tolkien', y: 1980, kind: 'primary', cite: 'part.chapter' },
  Letters:  { t: 'The Letters of J.R.R. Tolkien', a: 'ed. Humphrey Carpenter', y: 1981, kind: 'primary', cite: 'letter number' },
  HoMe6:    { t: 'The Return of the Shadow (History of Middle-earth 6)', a: 'ed. Christopher Tolkien', y: 1988, kind: 'primary drafts', note: 'Early maps and the Shire-to-Rivendell chronology.' },
  HoMe7:    { t: 'The Treason of Isengard (HoMe 7)', a: 'ed. Christopher Tolkien', y: 1989, kind: 'primary drafts', note: 'The First Map, redrawn, with Tolkien\'s distance notes.' },
  HoMe8:    { t: 'The War of the Ring (HoMe 8)', a: 'ed. Christopher Tolkien', y: 1990, kind: 'primary drafts', note: 'The 1943 map of Rohan, Gondor and Mordor; dated itineraries.' },
  HoMe9:    { t: 'Sauron Defeated (HoMe 9)', a: 'ed. Christopher Tolkien', y: 1992, kind: 'primary drafts' },
  HoMe12:   { t: 'The Peoples of Middle-earth (HoMe 12)', a: 'ed. Christopher Tolkien', y: 1996, kind: 'primary drafts', note: 'Drafts of the Tale of Years and the Appendices.' },
  NoME:     { t: 'The Nature of Middle-earth', a: 'J.R.R. Tolkien, ed. Carl F. Hostetter', y: 2021, kind: 'primary' },
  Baynes:   { t: 'Tolkien\'s annotated copy of the Baynes map (found 2015)', a: 'J.R.R. Tolkien, Pauline Baynes', y: 1969, kind: 'primary annotations', note: 'Known from published reports and the Bodleian exhibition; latitudes and notes in Tolkien\'s hand.' },
  Fonstad:  { t: 'The Atlas of Middle-earth (revised edition)', a: 'Karen Wynn Fonstad', y: 1991, kind: 'secondary', note: 'Detail layer: hills, 66 anchors, town plans.' },
  Strachey: { t: 'Journeys of Frodo', a: 'Barbara Strachey', y: 1981, kind: 'secondary', note: 'Day-by-day maps of the journeys.' },
  RC:       { t: 'The Lord of the Rings: A Reader\'s Companion', a: 'Wayne G. Hammond & Christina Scull', y: 2005, kind: 'secondary' },
  TG:       { t: 'Tolkien Gateway', a: 'community wiki', y: 2026, kind: 'tertiary', note: 'For cross-checking only.' },
  EoA:      { t: 'The Encyclopedia of Arda', a: 'Mark Fisher', y: 2026, kind: 'tertiary', note: 'For cross-checking only.' },
};

// name: [grade, refs ('SRC locator; SRC locator'), note?, chk?]
const PLACES = {
  'Hobbiton': ['map', 'LR I.1; CTshire; Letters 294', 'The origin of the atlas. Tolkien put it at about the latitude of Oxford.'],
  'Bag End': ['warp', 'H 1; LR I.1; CTshire'],
  'Bywater': ['warp', 'LR I.1; LR VI.8; CTshire'],
  'Michel Delving': ['map', 'LR Pro; CTshire'],
  'Tuckborough': ['warp', 'LR Pro; CTshire'],
  'Frogmorton': ['warp', 'LR VI.8; CTshire'],
  'Stock': ['warp', 'LR I.3; LR I.4; CTshire'],
  'Whitfurrows': ['warp', 'CTshire'],
  'Waymeet': ['warp', 'LR VI.8; CTshire'],
  'Needlehole': ['warp', 'CTshire'],
  'Longbottom': ['warp', 'LR Pro; CTshire', 'Home of pipe-weed in the Southfarthing.'],
  'Brandy Hall': ['warp', 'LR I.1; LR I.5; CTshire'],
  'Bucklebury': ['warp', 'LR I.5; CTshire'],
  'Crickhollow': ['text', 'LR I.5', 'Described as a lonely house beyond Bucklebury; not on the maps.'],
  'Bucklebury Ferry': ['warp', 'LR I.4; LR I.5; CTshire'],
  'Brandywine Bridge': ['warp', 'LR Pro; LR VI.8; CTshire'],
  'Sarn Ford': ['map', 'LR II.2; UT III.4; CTmap'],
  'Three-Farthing Stone': ['warp', 'CTshire'],
  'Woodhall': ['warp', 'LR I.3; CTshire'],
  'Bamfurlong': ['text', 'LR I.4', 'Farmer Maggot\'s farm in the Marish; not on the maps.'],
  'Bree': ['map', 'LR I.9; CTmap'],
  'Staddle': ['text', 'LR I.9; Fonstad', 'The Bree-land villages are described in the text; placed after Fonstad.'],
  'Combe': ['text', 'LR I.9; Fonstad'],
  'Archet': ['text', 'LR I.9; Fonstad'],
  'Tom Bombadil\'s house': ['text', 'LR I.7'],
  'Amon Sûl': ['map', 'LR I.11; CTmap'],
  'Last Bridge': ['map', 'LR I.12; CTmap'],
  'Ford of Bruinen': ['map', 'LR I.12; CTmap'],
  'Rivendell': ['map', 'H 3; LR II.1; CTmap; Letters 294', 'Tolkien put Rivendell at about the latitude of Hobbiton.'],
  'Fornost': ['map', 'LR AppA; CTmap'],
  'Annúminas': ['map', 'LR AppA; CTmap', 'On the shore of Lake Evendim; nudged 0.5 mi out of the water.'],
  'Mithlond': ['map', 'LR VI.9; LR AppA; CTmap', 'Measured at the head of the Gulf of Lune, then moved 7 mi north onto the shore so the quays stand on the water.'],
  'Harlond (Lindon)': ['map', 'CTmap', 'The anchor fell 6 mi out in the Gulf of Lune; moved to the nearest shore.'],
  'Forlond': ['map', 'CTmap'],
  'Elostirion': ['warp', 'LR Pro; LR AppA; CTmap', 'The White Towers on Emyn Beraid, the Tower Hills.'],
  'Tharbad': ['map', 'LR II.3; UT II.4; CTmap'],
  'Lond Daer': ['text', 'UT II.4', 'The old Númenórean haven at the mouth of the Gwathló, from the appendices to the history of Galadriel and Celeborn. Moved 2.5 mi onto the shore.'],
  'Ost-in-Edhil': ['text', 'UT II.4; Fonstad', 'Eregion is on the map; its city is not. Placed after Fonstad.'],
  'West-gate of Moria': ['map', 'LR II.4; CTmap'],
  'Khazad-dûm': ['warp', 'LR II.4; LR II.5'],
  'Dimrill Gate': ['warp', 'LR II.5; LR II.6; CTmap'],
  'Carn Dûm': ['map', 'LR AppA; CTmap'],
  'Mount Gundabad': ['map', 'H 17; LR AppA; CTmap'],
  'Goblin-town': ['text', 'H 4', 'Under the High Pass; the position follows the story.'],
  'High Pass': ['warp', 'H 4; Wild'],
  'Carrock': ['map', 'H 7; Wild; CTmap'],
  'Old Ford': ['map', 'H 7; Wild; CTmap'],
  'Beorn\'s house': ['warp', 'H 7; Wild'],
  'Rhosgobel': ['atlas', 'LR II.2; Fonstad'],
  'Thranduil\'s Halls': ['warp', 'H 8; H 9; Wild'],
  'Dol Guldur': ['map', 'LR II.2; LR AppB; Wild; CTmap'],
  'Esgaroth': ['map', 'H 10; H 14; Wild; CTmap'],
  'Dale': ['warp', 'H 1; H 11; Thror; Wild'],
  'Erebor': ['map', 'H 1; H 11; Thror; Wild; CTmap'],
  'Ravenhill': ['warp', 'H 11; H 17; Thror'],
  'Side Door of Erebor': ['warp', 'H 1; H 11; Thror'],
  'Iron Hills': ['warp', 'H 15; H 17; LR AppA; CTmap'],
  'Front Gate of Erebor': ['warp', 'H 11; H 13; Thror'],
  'Woodmen-town': ['warp', 'CTmap; Fonstad', 'Named on the 1980 redrawing of the general map (to verify).'],
  'Dunland hamlets': ['invented', 'LR AppF; UT III.5', 'Dunland and its people are in the text; these hamlets are the atlas\'s own.'],
  'Upbourn': ['text', 'LR V.3'],
  'Grimslade': ['invented', 'LR V.6', 'Grimbold of Grimslade is named; the place is never located.'],
  'Tarnost': ['warp', 'CTgondor', 'On the 1980 large-scale map (to verify).'],
  'Lossarnach': ['text', 'LR V.1; CTgondor'],
  'Caras Galadhon': ['atlas', 'LR II.7; Fonstad'],
  'Cerin Amroth': ['text', 'LR II.6'],
  'Egladil': ['text', 'LR II.6'],
  'Edoras': ['map', 'LR III.6; CTmap; CTgondor'],
  'Meduseld': ['warp', 'LR III.6'],
  'Dunharrow': ['atlas', 'LR V.3; CTgondor; Fonstad'],
  'Helm\'s Deep': ['map', 'LR III.7; CTmap; CTgondor'],
  'Aglarond': ['text', 'LR III.8'],
  'Aldburg': ['warp', 'CTgondor', 'Eorl\'s house in the Folde, later Éomer\'s (to verify).'],
  'Fords of Isen': ['warp', 'LR III.8; UT III.5; CTgondor'],
  'Isengard': ['map', 'LR II.2; LR III.8; CTmap'],
  'Orthanc': ['warp', 'LR II.2; LR III.8; LR III.10'],
  'Wellinghall': ['text', 'LR III.4'],
  'Derndingle': ['text', 'LR III.4'],
  'Edhellond': ['text', 'UT II.4', 'The Elf-haven near Dol Amroth.'],
  'Minas Tirith': ['map', 'LR V.1; CTmap; CTgondor; Letters 294', 'Tolkien: 600 mi south of Hobbiton, about the latitude of Florence.'],
  'Osgiliath': ['map', 'LR V.4; CTmap; CTgondor'],
  'Harlond': ['warp', 'LR V.6; CTgondor'],
  'Pelargir': ['map', 'LR V.9; CTmap; Letters 294'],
  'Dol Amroth': ['map', 'LR V.1; LR V.9; CTmap', 'The anchor fell 13 mi off the traced coast, west of the headland; moved 16 mi to the nearest shore. To verify against CT\'s map: the headland may have been lost in tracing.'],
  'Linhir': ['atlas', 'LR V.9; CTgondor; Fonstad', 'At the head of its inlet; moved 7 mi up to dry land, where the terrain\'s inlet ends.'],
  'Erech': ['atlas', 'LR V.2; CTgondor; Fonstad'],
  'Calembel': ['warp', 'LR V.9; CTgondor'],
  'Ethring': ['atlas', 'LR V.9; CTgondor; Fonstad'],
  'Cair Andros': ['map', 'LR V.4; LR V.10; CTmap'],
  'Henneth Annûn': ['text', 'LR IV.5'],
  'Emyn Arnen': ['warp', 'LR VI.5; CTgondor'],
  'Crossroads': ['warp', 'LR IV.7; CTgondor'],
  'Argonath': ['warp', 'LR II.9'],
  'Rauros': ['map', 'LR II.9; LR II.10; CTmap'],
  'Amon Hen': ['warp', 'LR II.10'],
  'Parth Galen': ['warp', 'LR II.10'],
  'Tolfalas': ['atlas', 'CTmap; Fonstad'],
  'Amon Dîn': ['warp', 'LR V.1; LR V.5; CTgondor'],
  'Eilenach': ['warp', 'LR V.1; LR V.5; CTgondor'],
  'Nardol': ['warp', 'LR V.1; CTgondor'],
  'Erelas': ['warp', 'LR V.1; CTgondor'],
  'Min-Rimmon': ['warp', 'LR V.1; CTgondor'],
  'Calenhad': ['warp', 'LR V.1; CTgondor'],
  'Halifirien': ['warp', 'LR V.1; LR V.3; UT III.2; CTgondor'],
  'Barad-dûr': ['map', 'LR VI.3; CTmap'],
  'Orodruin': ['map', 'LR VI.3; CTmap'],
  'Sammath Naur': ['text', 'LR VI.3'],
  'Minas Morgul': ['warp', 'LR IV.8; CTgondor'],
  'Cirith Ungol': ['warp', 'LR IV.9; LR VI.1; CTgondor'],
  'Shelob\'s Lair': ['text', 'LR IV.9'],
  'Morannon': ['map', 'LR IV.3; LR V.10; CTmap'],
  'Durthang': ['atlas', 'LR VI.2; Fonstad'],
  'Isenmouthe': ['warp', 'LR VI.2; CTgondor'],
  'Sea of Núrnen': ['map', 'LR VI.5; CTmap'],
  'Umbar': ['map', 'LR AppA; CTmap', 'The anchor fell in the middle of the firth (perhaps on the label); moved 16 mi to the north shore. To verify against CT\'s map.'],
  'Dorwinion vineyards': ['invented', 'H 9; Baynes', 'The wine is in The Hobbit; Dorwinion\'s place by the Sea of Rhûn follows the Baynes map.'],
  'Khand': ['invented', 'LR AppA; CTmap', 'A marker for the land, not a town.'],
  'Tents of the Easterlings': ['invented', 'LR AppA'],
  'City of the Haradrim': ['invented', 'LR IV.4', 'Harad has no named city in the texts.'],
  'Lossoth camps': ['invented', 'LR AppA', 'The Snowmen of Forochel; the camps are the atlas\'s own.'],
};

/* Statements the map can be measured against. conf: how sure the reference is before checking it
   (high = the figure is well known; medium = the figure is remembered but the wording needs checking).
   soft: Tolkien's own sources disagree with his map here; report, don't fail.
   test:
     ['dist', a, b, miles, tol]       straight line between places
     ['south', a, b, miles, tol]      b lies `miles` south of a
     ['east', a, b, miles, tol]       b lies `miles` east of a
     ['spanX' | 'spanY', realm, miles, tol]
     ['spanXto', realm, place, miles, tol]   from the realm's west edge to a place
     ['route', story, journey, fromDate, toDate, miles, tol]   routed path length between dates
     ['at', story, journey, date, place, miles]   the party is within `miles` of the place on that date
     ['crow', story, journey, date, place, miles, tol]   straight line from a place to the party on a date */
const STATEMENTS = [
  { id: 'shire-ew', src: 'LR Pro', conf: 'high', claim: 'The Shire is forty leagues from the Far Downs to the Brandywine Bridge.', test: ['spanXto', 'The Shire', 'Brandywine Bridge', 120, 0.1] },
  { id: 'shire-ns', src: 'LR Pro', conf: 'high', claim: 'The Shire is fifty leagues from the northern moors to the southern marshes.', test: ['spanY', 'The Shire', 150, 0.1] },
  { id: 'mt-south', src: 'Letters 294', conf: 'high', claim: 'Minas Tirith is about 600 miles south of Hobbiton, near the latitude of Florence.', test: ['south', 'Hobbiton', 'Minas Tirith', 600, 0.05] },
  { id: 'riv-lat', src: 'Letters 294', conf: 'high', claim: 'Hobbiton and Rivendell are at about the same latitude, that of Oxford.', test: ['south', 'Hobbiton', 'Rivendell', 0, 40] },
  { id: 'pel-lat', src: 'Letters 294', conf: 'medium', soft: true, claim: 'Pelargir and the Mouths of Anduin are at about the latitude of ancient Troy (about 815 mi south of Oxford).', test: ['south', 'Hobbiton', 'Pelargir', 815, 0.12] },
  { id: 'mt-east', src: 'Baynes', conf: 'medium', soft: true, claim: 'Tolkien\'s note on the Baynes map: Minas Tirith is about 900 miles east of Hobbiton.', test: ['east', 'Hobbiton', 'Minas Tirith', 900, 0.1] },
  { id: 'mt-ravenna', src: 'Baynes', conf: 'medium', soft: true, claim: 'The same note puts Minas Tirith at about the latitude of Ravenna (about 510 mi south of Oxford).', test: ['south', 'Hobbiton', 'Minas Tirith', 510, 0.1] },
  { id: 'hollin', src: 'LR II.3', conf: 'medium', claim: 'Reaching Hollin, the Company had come about forty-five leagues from Rivendell as the crow flies.', test: ['crow', 'war', 'Frodo & Sam', '3019 1 8', 'Rivendell', 135, 0.12] },
  { id: 'hunt', src: 'LR III.2', conf: 'high', claim: 'Éomer: Aragorn, Legolas and Gimli ran forty-five leagues in under four days.', test: ['route', 'war', 'Aragorn', '3019 2 27', '3019 2 30', 135, 0.15] },
  // the Tale of Years (LR AppB): where the parties are on the great days
  { id: 'd-bagend', src: 'LR AppB', conf: 'high', claim: '23 Sept 3018: Frodo leaves Bag End.', test: ['at', 'war', 'Frodo & Sam', '3018 9 23', 'Bag End', 2] },
  { id: 'd-bree', src: 'LR AppB', conf: 'high', claim: '29 Sept 3018: Frodo reaches Bree at night.', test: ['at', 'war', 'Frodo & Sam', '3018 9 29.9', 'Bree', 4] },
  { id: 'd-wtop', src: 'LR AppB', conf: 'high', claim: '6 Oct 3018: the camp under Weathertop is attacked at night.', test: ['at', 'war', 'Frodo & Sam', '3018 10 6.9', 'Amon Sûl', 6] },
  { id: 'd-ford', src: 'LR AppB', conf: 'high', claim: '20 Oct 3018: Frodo escapes across the Ford of Bruinen.', test: ['at', 'war', 'Frodo & Sam', '3018 10 20.4', 'Ford of Bruinen', 4] },
  { id: 'd-leave', src: 'LR AppB', conf: 'high', claim: '25 Dec 3018: the Company leaves Rivendell at dusk.', test: ['at', 'war', 'Frodo & Sam', '3018 12 25', 'Rivendell', 3] },
  { id: 'd-bridge', src: 'LR AppB', conf: 'high', claim: '15 Jan 3019: the Bridge of Khazad-dûm, close inside the East-gate; Gandalf falls.', test: ['at', 'war', 'Frodo & Sam', '3019 1 15.3', 'Dimrill Gate', 6] },
  { id: 'd-lorien', src: 'LR AppB', conf: 'high', claim: '17 Jan 3019: the Company comes to Caras Galadhon in the evening.', test: ['at', 'war', 'Frodo & Sam', '3019 1 17.8', 'Caras Galadhon', 4] },
  { id: 'd-break', src: 'LR AppB', conf: 'high', claim: '26 Feb 3019: the breaking of the Fellowship at Parth Galen.', test: ['at', 'war', 'Aragorn', '3019 2 26', 'Parth Galen', 3] },
  { id: 'd-helm', src: 'LR AppB', conf: 'high', claim: '3–4 Mar 3019: the Battle of the Hornburg; the riders leave for Isengard in the afternoon of the 4th.', test: ['at', 'war', 'Aragorn', '3019 3 4.4', 'Helm\'s Deep', 4] },
  { id: 'd-isen', src: 'LR AppB', conf: 'high', claim: '5 Mar 3019: Théoden and Gandalf come to Isengard at noon; the parley with Saruman.', test: ['at', 'war', 'Aragorn', '3019 3 5.5', 'Isengard', 4] },
  { id: 'd-pel', src: 'LR AppB', conf: 'high', claim: '15 Mar 3019: Aragorn comes up Anduin to the Harlond in the Battle of the Pelennor Fields.', test: ['at', 'war', 'Aragorn', '3019 3 15', 'Harlond', 4] },
  { id: 'd-doom', src: 'LR AppB', conf: 'high', claim: '25 Mar 3019: the Ring is destroyed in the Sammath Naur.', test: ['at', 'war', 'Frodo & Sam', '3019 3 25', 'Orodruin', 4] },
  { id: 'd-havens', src: 'LR AppB', conf: 'high', claim: '29 Sept 3021: Frodo and Bilbo depart over Sea with the Three Keepers.', test: ['at', 'return', 'Frodo\'s last journey', '3021 9 29.7', 'Mithlond', 3] },
];

/* What the next passes will read, in order. Each turns `chk` to 1 for the entries it confirms and adds
   statements with tests. */
const TODO = [
  'LR AppB and HoMe 12: every dated waypoint of every journey, day by day.',
  'HoMe 6–9: Tolkien\'s own maps and itineraries for the Shire to Rivendell, Rohan, Gondor and Mordor (distances in his notes).',
  'Baynes annotations: the full list of latitudes, distances and corrections Tolkien wrote on the map.',
  'UT III.1–5 and UT II.4: the Gladden Fields, Cirion and Eorl (the borders of Rohan), the Fords of Isen, Eregion and Lond Daer.',
  'Fonstad: travel distances and town plans for every place graded atlas or text.',
  'Strachey: the day-by-day positions of Frodo\'s journey, against the routed journeys.',
  'Reader\'s Companion: notes on places and dates where Tolkien\'s texts disagree.',
];

return { BIB, PLACES, STATEMENTS, TODO };
})();
if (typeof self !== 'undefined') self.SOURCES = SOURCES;
