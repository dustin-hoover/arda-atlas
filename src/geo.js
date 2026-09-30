/* ============================================================================
   ARDA GEODATA — Middle-earth, late Third Age
   Authoring grid: X = miles east of Hobbiton, Y = miles north of Hobbiton.
   Anchors from Tolkien's own statements: Hobbiton & Rivendell ≈ latitude of
   Oxford (52°N); Minas Tirith ≈ 600 mi south (latitude of Florence);
   Pelargir / Mouths of Anduin ≈ latitude of ancient Troy.
   The grid is projected onto the globe with a sinusoidal mapping so that
   ground distances in miles are preserved.
   ========================================================================== */
const GEO = (() => {

const COAST = [
  // Ice Bay of Forochel head, then the inner shore of the Cape
  [60,440],[20,470],[-30,520],[-90,575],[-150,630],
  // outer shore of the Cape and the north coast of Lindon
  [-178,612],[-165,572],[-192,532],[-250,500],[-300,470],[-352,430],[-382,380],
  // Forlindon
  [-392,300],[-372,222],[-342,150],[-302,92],[-272,52],
  // Gulf of Lune, north shore to Mithlond, south shore out again
  [-240,32],[-212,18],[-186,8],[-170,0],[-168,-6],[-182,-18],[-206,-30],[-240,-46],[-276,-62],
  // Harlindon
  [-300,-100],[-306,-160],[-292,-220],[-262,-268],[-214,-296],[-160,-292],[-112,-286],
  // Mouths of the Baranduin, Eryn Vorn, Minhiriath
  [-86,-290],[-62,-300],[-22,-320],[18,-344],[58,-368],[98,-390],
  // Mouths of the Gwathló (Lond Daer), Enedwaith, Isen
  [122,-404],[150,-424],[176,-446],[202,-466],[226,-486],
  // Angren, Drúwaith Iaur, Cape Andrast
  [220,-516],[200,-546],[170,-578],[140,-612],[118,-646],[104,-670],[124,-688],
  // Anfalas, Belfalas
  [170,-698],[230,-702],[290,-708],[340,-716],[392,-728],[436,-742],[470,-760],
  // Dol Amroth promontory
  [496,-788],[516,-810],[534,-818],[548,-804],
  // Bay of Belfalas north shore (Lebennin) to Ethir Anduin
  [574,-792],[604,-786],[632,-791],[662,-806],[692,-822],[722,-836],[746,-850],[766,-862],[788,-860],
  // Harondor coast
  [804,-882],[794,-912],[772,-942],[742,-972],[702,-1002],[664,-1030],[634,-1058],
  // Cape and Haven of Umbar
  [604,-1078],[564,-1090],[540,-1108],[572,-1120],[606,-1128],[630,-1142],[622,-1170],[592,-1200],
  // Harad west coast
  [562,-1262],[532,-1342],[502,-1430],[474,-1522],[452,-1620],[420,-1720],[380,-1820],
  [332,-1920],[292,-2020],[262,-2120],[252,-2250],[272,-2400],
  // southern cape and south coast
  [332,-2500],[450,-2562],[600,-2600],[800,-2582],[1000,-2522],[1200,-2452],[1400,-2382],[1600,-2322],
  // east coast
  [1800,-2250],[2000,-2150],[2200,-2000],[2400,-1800],[2550,-1550],[2650,-1300],[2700,-1000],
  [2750,-700],[2780,-400],[2800,-100],[2780,200],[2720,450],[2650,650],
  // north coast back west
  [2500,780],[2300,840],[2100,860],[1900,850],[1700,822],[1500,800],[1300,780],[1100,760],
  [900,742],[700,722],[500,692],[400,652],[330,602],[300,562],[262,560],
  // Ice Bay east shore
  [222,522],[172,482],[122,452]
];

const ISLANDS = [
  { name:'Tolfalas', pts:[[692,-866],[710,-862],[716,-878],[700,-886],[688,-878]] },
  { name:'Himling', pts:[[-452,176],[-434,184],[-426,168],[-444,160]] },
  { name:'Tol Fuin', pts:[[-490,20],[-468,26],[-452,-10],[-460,-40],[-478,-44],[-486,-10]] },
  { name:'Tol Brandir', pts:[[709,-418],[712,-417],[712,-421],[709,-422]] },
  { name:'Cair Andros', pts:[[731,-526],[737,-527],[737,-536],[732,-536]] },
];

/* Mountain ranges: ridge polylines. h = typical crest height (m), w = belt width (mi). */
const RANGES = [
  { name:'Hithaeglir', alt:'The Misty Mountains', h:3600, w:44, label:true, pts:[[470,420],[466,380],[456,330],[450,280],[446,230],[441,180],[436,130],[433,80],[431,40],[429,0],[426,-50],[426,-100],[430,-145],[436,-168],[426,-195],[421,-232],[418,-270],[414,-306]] },
  { name:'Ered Mithrin', alt:'The Grey Mountains', h:2900, w:40, label:true, pts:[[478,418],[540,426],[600,432],[660,434],[720,428],[780,422],[840,426],[882,442]] },
  { name:'Ered Luin', alt:'The Blue Mountains (north)', h:2600, w:40, label:true, pts:[[-282,480],[-272,400],[-262,330],[-252,260],[-240,190],[-226,120],[-212,60],[-200,28]] },
  { name:'Ered Luin', alt:'The Blue Mountains (south)', h:2300, w:34, label:false, pts:[[-216,-42],[-226,-92],[-236,-150],[-246,-210],[-252,-252]] },
  { name:'Ered Nimrais', alt:'The White Mountains', h:3300, w:50, label:true, pts:[[114,-658],[160,-604],[210,-562],[262,-522],[312,-488],[352,-462],[392,-440],[432,-446],[472,-472],[512,-492],[552,-508],[592,-528],[632,-548],[664,-566]] },
  { name:'Ered Nimrais (Mindolluin spur)', alt:'', h:2300, w:14, label:false, pts:[[660,-563],[684,-580],[700,-590]] },
  { name:'Ephel Dúath', alt:'The Mountains of Shadow', h:2400, w:24, label:true, pts:[[806,-448],[801,-490],[796,-530],[796,-570],[801,-610],[806,-650],[816,-690],[842,-714],[882,-724],[932,-730],[992,-734],[1052,-730],[1102,-718],[1142,-700]] },
  { name:'Ered Lithui', alt:'The Ash Mountains', h:2400, w:24, label:true, pts:[[814,-446],[860,-450],[910,-455],[962,-462],[1022,-470],[1082,-478],[1142,-490]] },
  { name:'Mountains of Angmar', alt:'', h:2100, w:40, label:true, pts:[[326,300],[366,318],[402,332],[452,362]] },
  { name:'Iron Hills', alt:'', h:1700, w:32, label:true, pts:[[928,344],[972,352],[1016,356],[1062,360]] },
  { name:'Mountains of Mirkwood', alt:'', h:1100, w:24, label:true, pts:[[618,196],[650,210],[690,236]] },
  { name:'Orocarni', alt:'The Red Mountains', h:4200, w:60, label:true, pts:[[2040,420],[2080,260],[2100,60],[2120,-140],[2110,-320],[2080,-520],[2040,-700]] },
  { name:'Ered Gorgoroth of the East', alt:'', h:2600, w:44, label:false, pts:[[1500,420],[1560,360],[1640,330]] },
  { name:'Mountains of Harad', alt:'', h:2500, w:50, label:false, pts:[[900,-1480],[980,-1560],[1060,-1640],[1120,-1720]] },
  { name:'Mountains of Far Harad', alt:'', h:3200, w:60, label:false, pts:[[1300,-1980],[1420,-2020],[1540,-2070],[1650,-2100]] },
  { name:'Yellow Mountains', alt:'', h:2200, w:40, label:false, pts:[[1760,-1300],[1840,-1200],[1900,-1080]] },
  { name:'Northern Heights', alt:'', h:1500, w:50, label:false, pts:[[1100,680],[1300,690],[1500,700]] },
];

/* Hills and downs: polylines or polygons. h = relief (m). */
const HILLS = [
  { name:'Emyn Beraid', alt:'The Tower Hills', h:320, w:18, pts:[[-122,-2],[-110,-12],[-100,-20]] },
  { name:'Far Downs', h:180, w:14, pts:[[-70,20],[-66,-10],[-62,-30]] },
  { name:'White Downs', h:160, w:12, pts:[[-44,4],[-32,-6]] },
  { name:'Green Hills', h:140, w:12, pts:[[-12,-28],[10,-26],[26,-20]] },
  { name:'Hills of Evendim', h:320, w:24, pts:[[-14,122],[12,160],[44,164]] },
  { name:'North Downs', h:420, w:38, pts:[[58,112],[100,122],[150,118],[190,100]] },
  { name:'Weather Hills', h:460, w:18, pts:[[194,64],[200,34],[204,6]] },
  { name:'Barrow-downs', h:230, w:22, pts:[[70,-18],[84,-12],[100,-6]] },
  { name:'South Downs', h:220, w:22, pts:[[112,-30],[150,-50],[180,-70]] },
  { name:'Ettenmoors', h:760, w:70, pts:[[300,70],[340,110],[380,150],[410,180]] },
  { name:'Trollshaws', h:420, w:30, pts:[[300,6],[322,18],[344,28]] },
  { name:'Dunland', h:640, w:56, pts:[[328,-222],[354,-262],[380,-310]] },
  { name:'Emyn Muil', h:340, w:42, pts:[[690,-376],[725,-392],[760,-410],[772,-430]] },
  { name:'Emyn Arnen', h:220, w:14, pts:[[744,-608],[752,-622]] },
  { name:'Pinnath Gelin', h:560, w:36, pts:[[232,-612],[280,-630],[330,-640]] },
  { name:'The Wold', h:240, w:40, pts:[[560,-300],[620,-320],[670,-360]] },
  { name:'Hills of Rhûn', h:520, w:60, pts:[[1300,40],[1400,-40],[1500,-120]] },
  { name:'Coldfells', h:520, w:40, pts:[[360,130],[400,150]] },
  { name:'Downs of Forodwaith', h:420, w:90, pts:[[300,640],[600,660],[900,690]] },
  { name:'Hills of Harad', h:520, w:80, pts:[[700,-1150],[860,-1250],[1000,-1320]] },
  { name:'Mountains of the Morgai', h:620, w:10, pts:[[812,-520],[818,-560],[822,-600]] },
];

/* Solitary peaks (analytic cones). r = radius (mi), h = height above surroundings (m). */
const PEAKS = [
  { name:'Erebor', alt:'The Lonely Mountain', x:765, y:332, h:2600, r:14, kind:'mountain' },
  { name:'Orodruin', alt:'Mount Doom', x:860, y:-565, h:1400, r:9, kind:'volcano' },
  { name:'Caradhras', alt:'Barazinbar, the Redhorn', x:430, y:-148, h:1600, r:8, kind:'mountain' },
  { name:'Celebdil', alt:'Zirakzigil, the Silvertine', x:446, y:-160, h:1400, r:7, kind:'mountain' },
  { name:'Fanuidhol', alt:'Bundushathûr, Cloudyhead', x:440, y:-136, h:1300, r:7, kind:'mountain' },
  { name:'Methedras', alt:'Last Peak', x:414, y:-306, h:1200, r:7, kind:'mountain' },
  { name:'Mount Gundabad', alt:'', x:470, y:420, h:1400, r:9, kind:'mountain' },
  { name:'Mindolluin', alt:'', x:713.5, y:-598.5, h:1500, r:7.5, kind:'mountain' },
  { name:'Hill of Guard', alt:'Knee of Mindolluin', x:719.9, y:-600, h:230, r:0.7, kind:'hill' },
  { name:'Thrihyrne', alt:'', x:404, y:-428, h:900, r:5, kind:'mountain' },
  { name:'Starkhorn', alt:'', x:486, y:-472, h:1200, r:6, kind:'mountain' },
  { name:'Irensaga', alt:'', x:492, y:-462, h:700, r:4, kind:'mountain' },
  { name:'Dwimorberg', alt:'The Haunted Mountain', x:480, y:-470, h:1000, r:5, kind:'mountain' },
  { name:'Amon Sûl', alt:'Weathertop', x:205, y:-4, h:320, r:2.2, kind:'hill' },
  { name:'Amon Hen', alt:'The Hill of Sight', x:704, y:-423, h:260, r:2.5, kind:'hill' },
  { name:'Amon Lhaw', alt:'The Hill of Hearing', x:721, y:-420, h:260, r:2.5, kind:'hill' },
  { name:'Amon Dîn', alt:'', x:694, y:-578, h:260, r:2, kind:'hill' },
  { name:'Halifirien', alt:'', x:572, y:-506, h:900, r:4, kind:'mountain' },
  { name:'Dol Baran', alt:'', x:420, y:-356, h:180, r:2.5, kind:'hill' },
  { name:'Bree-hill', alt:'', x:105, y:3, h:110, r:1.6, kind:'hill' },
  { name:'The Hill', alt:'Hobbiton Hill', x:-0.6, y:0.5, h:45, r:0.45, kind:'hill' },
  { name:'Carrock', alt:'', x:516, y:141, h:60, r:0.4, kind:'hill' },
  { name:'Dol Guldur', alt:'Amon Lanc', x:612, y:-62, h:260, r:3, kind:'hill' },
  { name:'Meneltarma', alt:'Pillar of Heaven (drowned)', x:-1500, y:-600, h:3300, r:22, kind:'seamount' },
  { name:'Edoras hill', alt:'', x:480, y:-440, h:50, r:0.6, kind:'hill' },
  { name:'Cerin Amroth', alt:'', x:498, y:-196, h:40, r:0.3, kind:'hill' },
];

/* Rivers: w0/w1 = width in metres at source / mouth. */
const RIVERS = [
  { name:'Anduin', alt:'The Great River', w0:60, w1:420, rank:1, pts:[[560,340],[546,290],[536,240],[528,190],[522,150],[520,110],[525,60],[532,10],[538,-40],[545,-90],[552,-140],[556,-190],[560,-230],[575,-260],[600,-285],[625,-300],[650,-320],[672,-340],[690,-360],[700,-380],[706,-392],[709,-400],[711,-412],[713,-428],[716,-450],[722,-470],[728,-490],[732,-515],[734,-532],[736,-555],[738,-575],[739,-592],[735,-605],[742,-620],[752,-640],[760,-670],[766,-700],[770,-730],[772,-755],[768,-785],[762,-815],[760,-838],[758,-856]] },
  { name:'Greylin', w0:10, w1:40, rank:3, pts:[[492,420],[512,396],[532,372],[560,340]] },
  { name:'Langwell', w0:10, w1:40, rank:3, pts:[[604,422],[590,396],[574,368],[560,340]] },
  { name:'Gladden', alt:'Sîr Ninglor', w0:8, w1:50, rank:3, pts:[[452,-60],[472,-72],[492,-82],[516,-90],[545,-92]] },
  { name:'Celebrant', alt:'The Silverlode', w0:8, w1:60, rank:2, pts:[[455,-172],[470,-180],[482,-186],[505,-200],[530,-215],[560,-230]] },
  { name:'Nimrodel', w0:5, w1:18, rank:4, pts:[[472,-158],[480,-172],[488,-188]] },
  { name:'Limlight', w0:8, w1:50, rank:3, pts:[[478,-268],[504,-278],[530,-286],[556,-292],[580,-296],[625,-300]] },
  { name:'Entwash', alt:'Onodló', w0:12, w1:120, rank:2, pts:[[462,-312],[480,-332],[500,-350],[522,-366],[542,-380],[562,-392],[580,-400],[602,-412],[622,-422],[642,-432],[662,-442],[680,-454],[696,-466],[712,-480],[728,-490]] },
  { name:'Snowbourn', w0:6, w1:30, rank:4, pts:[[486,-460],[482,-448],[480,-438],[486,-426],[500,-414],[522,-402],[544,-398],[572,-399]] },
  { name:'Mering Stream', w0:4, w1:14, rank:4, pts:[[574,-502],[578,-484],[586,-462],[596,-442],[608,-424]] },
  { name:'Isen', alt:'Angren', w0:10, w1:90, rank:2, pts:[[404,-314],[401,-326],[398,-340],[390,-352],[380,-362],[366,-372],[350,-382],[330,-396],[308,-410],[288,-426],[266,-446],[246,-466],[226,-486]] },
  { name:'Adorn', w0:6, w1:30, rank:3, pts:[[334,-468],[318,-452],[302,-440],[288,-428]] },
  { name:'Erui', w0:6, w1:30, rank:4, pts:[[696,-618],[712,-640],[730,-662],[748,-680],[764,-694]] },
  { name:'Sirith', w0:6, w1:50, rank:3, pts:[[648,-606],[664,-640],[684,-676],[706,-706],[730,-730],[752,-746],[772,-755]] },
  { name:'Celos', w0:4, w1:20, rank:4, pts:[[620,-596],[640,-626],[662,-652],[684,-676]] },
  { name:'Gilrain', w0:6, w1:50, rank:3, pts:[[580,-568],[590,-604],[600,-640],[612,-690],[622,-730],[632,-770],[634,-788]] },
  { name:'Serni', w0:4, w1:30, rank:4, pts:[[604,-600],[612,-640],[620,-690],[628,-740],[632,-772]] },
  { name:'Morthond', alt:'Blackroot', w0:6, w1:60, rank:3, pts:[[494,-506],[498,-540],[502,-580],[504,-630],[508,-680],[512,-730],[520,-778],[526,-800]] },
  { name:'Kiril', w0:5, w1:24, rank:4, pts:[[540,-560],[536,-610],[528,-660],[518,-712]] },
  { name:'Ringló', w0:5, w1:30, rank:4, pts:[[444,-540],[458,-580],[472,-622],[488,-670],[502,-706],[512,-732]] },
  { name:'Lefnui', w0:5, w1:40, rank:3, pts:[[330,-562],[326,-600],[318,-640],[306,-680],[298,-706]] },
  { name:'Poros', w0:6, w1:40, rank:3, pts:[[818,-704],[802,-716],[790,-728],[780,-750],[770,-775]] },
  { name:'Harnen', w0:8, w1:60, rank:3, pts:[[920,-752],[892,-780],[864,-812],[836,-846],[814,-874],[800,-890]] },
  { name:'Baranduin', alt:'The Brandywine', w0:14, w1:120, rank:2, pts:[[18,108],[28,90],[38,72],[46,50],[52,28],[55,6],[54,-12],[52,-34],[47,-60],[41,-88],[26,-120],[4,-160],[-22,-200],[-46,-240],[-68,-270],[-86,-290]] },
  { name:'The Water', w0:3, w1:12, rank:5, pts:[[-26,18],[-12,8],[0,2],[8,-1],[18,-3],[30,-5],[42,-8],[53,-11]] },
  { name:'Withywindle', w0:3, w1:14, rank:5, pts:[[84,-28],[74,-26],[64,-24],[56,-22]] },
  { name:'Shirebourn', w0:3, w1:12, rank:5, pts:[[-30,-28],[-18,-44],[-4,-62],[14,-80],[30,-100]] },
  { name:'Lhûn', alt:'The Lune', w0:10, w1:110, rank:2, pts:[[-96,240],[-112,190],[-132,130],[-150,70],[-160,30],[-166,4]] },
  { name:'Little Lune', w0:6, w1:30, rank:4, pts:[[-96,90],[-120,70],[-146,58]] },
  { name:'Mitheithel', alt:'The Hoarwell', w0:10, w1:80, rank:2, pts:[[312,210],[304,160],[298,110],[292,50],[288,0],[286,-40],[283,-70],[270,-120],[256,-160],[240,-198]] },
  { name:'Bruinen', alt:'The Loudwater', w0:8, w1:50, rank:3, pts:[[392,58],[376,34],[362,16],[346,8],[330,-10],[312,-34],[298,-54],[283,-70]] },
  { name:'Glanduin', w0:8, w1:40, rank:3, pts:[[414,-186],[390,-194],[366,-200],[336,-204],[300,-204],[270,-200],[240,-198]] },
  { name:'Sirannon', alt:'The Gate-stream', w0:3, w1:12, rank:5, pts:[[402,-162],[392,-168],[380,-176],[368,-188]] },
  { name:'Gwathló', alt:'The Greyflood', w0:90, w1:260, rank:2, pts:[[240,-198],[234,-208],[222,-240],[204,-280],[184,-316],[164,-352],[142,-386],[122,-404]] },
  { name:'Celduin', alt:'The River Running', w0:20, w1:160, rank:2, pts:[[766,322],[758,300],[755,286],[756,256],[766,228],[790,184],[820,136],[852,90],[884,40],[920,-20],[962,-90],[1004,-150],[1040,-196],[1062,-226]] },
  { name:'Forest River', w0:6, w1:40, rank:3, pts:[[690,254],[704,254],[722,262],[745,272]] },
  { name:'Enchanted River', w0:5, w1:20, rank:4, pts:[[662,196],[676,212],[690,228],[700,250]] },
  { name:'Carnen', alt:'Redwater', w0:8, w1:60, rank:3, pts:[[980,340],[966,280],[948,200],[930,120],[912,56],[898,16]] },
  { name:'Rivers of Nurn (west)', w0:5, w1:30, rank:5, pts:[[930,-718],[950,-690],[972,-664]] },
  { name:'Rivers of Nurn (east)', w0:5, w1:30, rank:5, pts:[[1080,-716],[1060,-690],[1044,-662]] },
  { name:'Red River of Rhûn', w0:20, w1:140, rank:3, pts:[[1600,120],[1480,20],[1380,-70],[1300,-140],[1250,-200]] },
  { name:'Great River of Harad', w0:30, w1:320, rank:2, pts:[[1500,-1250],[1380,-1330],[1250,-1400],[1100,-1470],[950,-1520],[800,-1560],[640,-1580],[480,-1560]] },
  { name:'Southern River', w0:30, w1:260, rank:3, pts:[[1300,-1850],[1100,-1880],[900,-1930],[700,-1990],[420,-2060],[300,-2080]] },
  { name:'River of the East', w0:40, w1:300, rank:3, pts:[[2200,200],[2350,80],[2500,-40],[2640,-120],[2790,-160]] },
];

const LAKES = [
  { name:'Nenuial', alt:'Lake Evendim', pts:[[-10,140],[4,152],[24,150],[34,136],[28,118],[14,110],[-4,118],[-12,130]] },
  { name:'Long Lake', alt:'', pts:[[748,258],[758,260],[762,272],[760,288],[752,296],[746,284],[746,268]] },
  { name:'Nen Hithoel', alt:'', pts:[[706,-394],[713,-396],[716,-406],[716,-420],[713,-428],[709,-428],[706,-418],[705,-404]] },
  { name:'Sea of Rhûn', alt:'', pts:[[1052,-228],[1084,-186],[1140,-160],[1210,-162],[1258,-196],[1276,-252],[1258,-306],[1214,-336],[1150,-340],[1104,-318],[1074,-286],[1058,-258]] },
  { name:'Sea of Núrnen', alt:'', pts:[[958,-640],[996,-618],[1044,-620],[1070,-640],[1060,-668],[1016,-680],[970,-674],[954,-656]] },
  { name:'Mirrormere', alt:'Kheled-zâram', pts:[[452,-170],[456,-169],[458,-173],[454,-175]] },
  { name:'Lake of Harad', alt:'', pts:[[1180,-1400],[1260,-1380],[1300,-1420],[1240,-1460],[1180,-1450]] },
];

/* Regional fields: forests, marshes, arid wastes, farmland, grassland, ash, uplift, ice. */
const FORESTS = [
  { name:'Mirkwood', alt:'Taur-e-Ndaedelos · Eryn Lasgalen', dens:1, dark:0.9, pts:[[576,330],[630,342],[690,338],[734,302],[746,250],[760,180],[770,100],[768,20],[756,-50],[736,-110],[700,-150],[650,-166],[610,-150],[586,-110],[576,-50],[570,20],[568,100],[568,180],[570,260]] },
  { name:'Lothlórien', alt:'The Golden Wood', dens:1, gold:1, pts:[[470,-164],[506,-170],[540,-190],[560,-224],[550,-246],[520,-250],[490,-236],[470,-210],[462,-186]] },
  { name:'Fangorn', alt:'The Entwood', dens:1, dark:0.7, pts:[[420,-280],[460,-270],[500,-288],[512,-320],[496,-352],[462,-362],[432,-346],[418,-310]] },
  { name:'Old Forest', alt:'', dens:1, dark:0.6, pts:[[58,-4],[80,-7],[92,-24],[86,-40],[66,-42],[57,-26]] },
  { name:'Chetwood', alt:'', dens:0.9, pts:[[108,10],[130,16],[142,4],[126,-6],[110,-2]] },
  { name:'Drúadan Forest', alt:'', dens:0.9, dark:0.3, pts:[[654,-556],[700,-566],[706,-588],[680,-592],[652,-576]] },
  { name:'Firien Wood', alt:'', dens:0.9, pts:[[558,-494],[586,-498],[592,-516],[564,-518]] },
  { name:'Ithilien', alt:'The garden of Gondor', dens:0.45, pts:[[760,-470],[792,-470],[794,-700],[772,-720],[748,-640],[744,-560],[750,-500]] },
  { name:'Eryn Vorn', alt:'', dens:1, dark:0.4, pts:[[-122,-254],[-90,-250],[-74,-274],[-100,-290],[-126,-280]] },
  { name:'Trollshaws', alt:'', dens:0.75, pts:[[298,0],[340,14],[352,32],[320,36],[294,20]] },
  { name:'Woody End', alt:'', dens:0.85, pts:[[24,-9],[40,-11],[43,-22],[28,-23]] },
  { name:'Bindbole Wood', alt:'', dens:0.85, pts:[[8,22],[24,24],[26,12],[10,12]] },
  { name:'Hollin', alt:'Eregion', dens:0.3, pts:[[330,-120],[400,-130],[404,-170],[340,-180]] },
  { name:'Forest of the Beornings', alt:'', dens:0.4, pts:[[530,170],[560,176],[562,120],[534,120]] },
  { name:'Eastern woods of Rhûn', alt:'', dens:0.6, pts:[[1600,500],[1900,520],[1950,300],[1700,260],[1560,340]] },
  { name:'Forests of Far Harad', alt:'', dens:0.9, pts:[[500,-2100],[900,-2150],[1300,-2250],[1400,-2380],[1000,-2480],[600,-2500],[380,-2380]] },
  { name:'Forests of the East', alt:'', dens:0.8, pts:[[2200,500],[2600,600],[2700,300],[2500,100],[2250,250]] },
  { name:'Taiga of Forodwaith', alt:'', dens:0.5, pts:[[300,560],[1000,640],[1400,650],[1400,520],[900,470],[400,470]] },
  { name:'Woods of Lindon', alt:'', dens:0.55, pts:[[-380,360],[-290,380],[-270,200],[-320,160],[-370,230]] },
];

const MARSHES = [
  { name:'Dead Marshes', pts:[[758,-404],[796,-408],[806,-430],[782,-442],[758,-428]] },
  { name:'Midgewater Marshes', pts:[[140,-1],[166,3],[172,-10],[150,-16]] },
  { name:'Gladden Fields', pts:[[528,-80],[552,-84],[558,-106],[534,-106]] },
  { name:'Nindalf', alt:'Wetwang', pts:[[704,-464],[730,-468],[736,-500],[712,-502]] },
  { name:'Nîn-in-Eilph', alt:'Swanfleet', pts:[[250,-184],[282,-188],[292,-206],[260,-212]] },
  { name:'Long Marshes', pts:[[738,244],[754,248],[752,264],[738,260]] },
  { name:'Ethir Anduin', alt:'Mouths of Anduin', pts:[[740,-836],[794,-838],[794,-866],[742,-862]] },
  { name:'Overbourn Marshes', pts:[[48,-34],[58,-36],[60,-48],[48,-48]] },
  { name:'Marshes of the Southern River', pts:[[320,-2050],[420,-2040],[430,-2090],[320,-2100]] },
];

const ARID = [
  { name:'Brown Lands', v:0.7, pts:[[590,-240],[660,-228],[742,-298],[752,-360],[700,-372],[640,-332],[596,-292]] },
  { name:'Dagorlad', v:0.8, pts:[[782,-402],[840,-398],[846,-446],[800,-450],[780,-432]] },
  { name:'Near Harad', v:0.75, pts:[[640,-900],[1000,-880],[1420,-900],[1440,-1300],[1000,-1360],[620,-1280]] },
  { name:'Far Harad desert', v:1, pts:[[500,-1120],[1620,-1100],[1800,-1700],[1260,-1820],[520,-1760]] },
  { name:'Khand', v:0.65, pts:[[1100,-700],[1360,-700],[1420,-940],[1150,-950]] },
  { name:'Steppe of Rhûn', v:0.45, pts:[[880,-480],[1800,-520],[1820,300],[1000,300],[880,0]] },
  { name:'Lithlad', v:0.8, pts:[[900,-480],[1130,-492],[1130,-560],[920,-560]] },
  { name:'Harondor', v:0.5, pts:[[780,-730],[930,-760],[860,-1000],[700,-1000],[790,-880]] },
  { name:'Forodwaith', v:0.3, pts:[[0,480],[900,560],[2000,700],[2600,700],[2600,900],[-200,900]] },
  { name:'Enedwaith', v:0.2, pts:[[150,-240],[330,-240],[330,-460],[180,-460]] },
  { name:'Withered Heath', v:0.8, pts:[[848,436],[950,444],[960,480],[860,476]] },
];

const FARMS = [
  { name:'The Shire', v:1, pts:[[-65,15],[-55,45],[-20,55],[20,52],[45,40],[55,6],[54,-20],[50,-50],[41,-88],[10,-96],[-20,-86],[-45,-62],[-60,-30]] },
  { name:'Buckland', v:0.9, pts:[[55,-4],[64,-2],[66,-26],[62,-42],[55,-36]] },
  { name:'Bree-land', v:0.8, pts:[[94,12],[118,16],[122,-6],[98,-10]] },
  { name:'Pelennor', v:1, circle:[728,-600,10] },
  { name:'Lossarnach', v:0.8, pts:[[670,-600],[720,-614],[736,-660],[690,-672],[660,-640]] },
  { name:'Lebennin', v:0.75, pts:[[600,-640],[700,-676],[762,-760],[700,-800],[620,-772]] },
  { name:'Anórien', v:0.55, pts:[[620,-540],[700,-560],[722,-520],[640,-500]] },
  { name:'Belfalas', v:0.65, pts:[[470,-740],[540,-760],[540,-812],[500,-790]] },
  { name:'Lamedon', v:0.5, pts:[[500,-560],[560,-580],[560,-640],[500,-640]] },
  { name:'Westfold', v:0.5, pts:[[400,-392],[450,-396],[450,-420],[410,-420]] },
  { name:'Eastfold', v:0.5, pts:[[500,-420],[600,-440],[600,-480],[500,-470]] },
  { name:'Dale', v:0.7, pts:[[748,300],[780,300],[780,326],[750,326]] },
  { name:'Beorn\'s lands', v:0.6, pts:[[532,140],[552,142],[552,156],[532,156]] },
  { name:'Nurn', v:0.55, pts:[[880,-600],[1100,-600],[1110,-700],[880,-700]] },
  { name:'Dorwinion', v:0.85, pts:[[1030,-176],[1094,-150],[1118,-186],[1062,-218]] },
  { name:'Umbar', v:0.55, pts:[[600,-1130],[660,-1120],[680,-1200],[610,-1210]] },
  { name:'Harad river lands', v:0.6, pts:[[480,-1540],[900,-1500],[1250,-1380],[1260,-1440],[900,-1580],[500,-1600]] },
  { name:'Dunland', v:0.3, pts:[[320,-230],[390,-250],[390,-320],[330,-320]] },
  { name:'Rhûn farms', v:0.35, pts:[[1110,-90],[1250,-60],[1420,-130],[1380,-300],[1260,-420],[1120,-380],[1080,-240]] },
];

const GRASS = [
  { name:'Rohan', v:1, pts:[[400,-355],[430,-350],[470,-345],[500,-300],[560,-295],[620,-300],[650,-330],[700,-400],[720,-470],[700,-500],[640,-520],[560,-500],[480,-455],[420,-420],[385,-400]] },
  { name:'Minhiriath', v:0.35, pts:[[-60,-290],[120,-400],[230,-210],[40,-110]] },
  { name:'Enedwaith', v:0.4, pts:[[150,-240],[330,-240],[330,-470],[180,-470]] },
  { name:'Steppe', v:0.8, pts:[[880,-480],[1800,-520],[1820,300],[1000,300],[880,0]] },
  { name:'Wilderland', v:0.22, pts:[[470,300],[560,300],[560,-280],[480,-280]] },
  { name:'Lone-lands', v:0.2, pts:[[130,40],[300,40],[300,-150],[130,-150]] },
];

const ASH = [
  { name:'Gorgoroth', v:1, pts:[[814,-462],[900,-468],[952,-490],[952,-560],[900,-610],[830,-612],[810,-560],[808,-500]] },
  { name:'Udûn', v:0.9, pts:[[810,-450],[840,-452],[842,-474],[812,-474]] },
  { name:'Dagorlad ash', v:0.35, pts:[[782,-402],[840,-398],[846,-446],[800,-450]] },
  { name:'Lithlad', v:0.5, pts:[[900,-480],[1130,-492],[1130,-560],[920,-560]] },
];

const UPLIFT = [
  { name:'Plateau of Gorgoroth', v:0.55, pts:[[806,-452],[1120,-480],[1120,-600],[900,-640],[806,-640]] },
  { name:'Nurn basin', v:0.25, pts:[[880,-600],[1120,-600],[1120,-716],[880,-716]] },
  { name:'Emyn Muil', v:0.22, pts:[[690,-372],[770,-392],[776,-434],[700,-436]] },
  { name:'Dunland', v:0.25, pts:[[310,-210],[400,-240],[400,-330],[320,-330]] },
  { name:'Harad plateau', v:0.35, pts:[[700,-1100],[1500,-1100],[1600,-1800],[700,-1800]] },
  { name:'Rhûn uplands', v:0.18, pts:[[1300,100],[1900,100],[1900,-600],[1300,-600]] },
  { name:'Forodwaith', v:0.12, pts:[[300,500],[2000,640],[2000,800],[300,700]] },
  { name:'Wold of Rohan', v:0.12, pts:[[520,-290],[660,-300],[700,-400],[560,-360]] },
  { name:'Ettenmoors', v:0.18, pts:[[280,40],[440,40],[440,240],[300,240]] },
  { name:'Khand', v:0.2, pts:[[1100,-700],[1360,-700],[1420,-940],[1150,-950]] },
  { name:'Anfalas downs', v:0.08, pts:[[180,-600],[420,-600],[420,-700],[180,-700]] },
];

const ICE = [
  { name:'Ice Bay of Forochel', v:0.85, pts:[[-150,640],[60,440],[260,560],[300,700],[-100,760]] },
  { name:'Northern Waste', v:0.6, pts:[[-400,760],[2800,800],[2800,1100],[-400,1100]] },
];

/* Númenor, the drowned star-isle, lies beneath the western sea. */
const NUMENOR = { cx:-1500, cy:-600, r:260 };

/* ------------------------------------------------------------------------ */
/* Places. type: city fortress town village ruin elven dwarven port tower
   bridge ford landmark cave peak battle wonder  ·  pop = speculative        */
const PLACES = [
  // The Shire
  ['Hobbiton','town',-1,0,'hobbit','The Shire','Village of the Hill and Bag End, seat of the Baggins family; the mill on the Water marks its lower lane.',{pop:600,rank:1,culture:'hobbit',r:0.9}],
  ['Bag End','landmark',-0.7,0.6,'hobbit','The Shire','The finest smial on the Hill, home of Bilbo and later Frodo Baggins.',{rank:3}],
  ['Bywater','village',4,-2,'hobbit','The Shire','Hobbiton\'s neighbour by the Pool, where the Green Dragon inn stands on the East Road side.',{pop:400,rank:2,culture:'hobbit',r:0.7}],
  ['Michel Delving','town',-36,-6,'hobbit','The Shire','Chief township of the Shire on the White Downs, with the Mathom-house and the Mayor\'s seat.',{pop:900,rank:1,culture:'hobbit',r:1.1}],
  ['Tuckborough','town',-12,-22,'hobbit','The Shire','Heart of the Tookland in the Green Hills; the Great Smials of the Took clan are delved here.',{pop:500,rank:2,culture:'hobbit',r:0.8}],
  ['Frogmorton','village',30,2,'hobbit','The Shire','A village on the East Road with the Floating Log inn and a lock-up built in later, darker days.',{pop:250,rank:3,culture:'hobbit',r:0.5}],
  ['Stock','village',48,-8,'hobbit','The Shire','Village at the south end of the Marish, with the Golden Perch serving the best beer in the Eastfarthing.',{pop:250,rank:3,culture:'hobbit',r:0.5}],
  ['Whitfurrows','village',18,1,'hobbit','The Shire','Farming village on the East Road between Bywater and Frogmorton.',{pop:180,rank:4,culture:'hobbit',r:0.4}],
  ['Waymeet','village',-12,-3,'hobbit','The Shire','Crossroads village where the southern road leaves the East Road.',{pop:200,rank:4,culture:'hobbit',r:0.4}],
  ['Needlehole','village',-6,17,'hobbit','The Shire','Northern Westfarthing village near Rushock Bog.',{pop:120,rank:4,culture:'hobbit',r:0.4}],
  ['Longbottom','village',-16,-52,'hobbit','The Shire','Southfarthing village famed for pipe-weed, first grown here by Tobold Hornblower.',{pop:300,rank:3,culture:'hobbit',r:0.6}],
  ['Brandy Hall','landmark',59,-15,'hobbit','Buckland','Great burrow of the Brandybucks, delved into Buck Hill with a hundred windows facing the river.',{rank:3,culture:'hobbit'}],
  ['Bucklebury','village',60,-16,'hobbit','Buckland','Chief village of Buckland beneath Brandy Hall.',{pop:300,rank:3,culture:'hobbit',r:0.6}],
  ['Crickhollow','landmark',63,-10,'hobbit','Buckland','Frodo\'s house beyond the river, bought as a blind for his departure.',{rank:4}],
  ['Bucklebury Ferry','ford',54,-14,'hobbit','Buckland','A flat raft ferry across the Brandywine between the Marish and Buckland.',{rank:4}],
  ['Brandywine Bridge','bridge',55,5,'hobbit','The Shire','The Bridge of Stonebows, where the East Road crosses the Baranduin.',{rank:3}],
  ['Sarn Ford','ford',41,-88,'hobbit','The Shire','The stony ford at the Shire\'s southern border, watched by Rangers.',{rank:4}],
  ['Three-Farthing Stone','landmark',14,-4,'hobbit','The Shire','Stone marking the meeting of the East, West, and South Farthings.',{rank:5}],
  ['Woodhall','village',32,-12,'hobbit','The Shire','Village under the Woody End, near where the hobbits met Gildor\'s Elves.',{pop:100,rank:5,culture:'hobbit',r:0.3}],
  ['Bamfurlong','landmark',48,-12,'hobbit','The Shire','Farmer Maggot\'s farm in the Marish, famous for its mushrooms and its dogs.',{rank:5}],
  // Bree-land & Eriador
  ['Bree','town',104,1,'men','Bree-land','Old town of Men and Hobbits where the Greenway meets the East Road; home of The Prancing Pony.',{pop:1200,rank:1,culture:'bree',r:0.8}],
  ['Staddle','village',108,-3,'hobbit','Bree-land','Hobbit village on the south-east slopes of Bree-hill.',{pop:150,rank:4,culture:'hobbit',r:0.4}],
  ['Combe','village',110,0,'men','Bree-land','Village in a deep valley east of Bree.',{pop:200,rank:4,culture:'bree',r:0.4}],
  ['Archet','village',112,6,'men','Bree-land','Village on the edge of the Chetwood.',{pop:180,rank:4,culture:'bree',r:0.4}],
  ['Tom Bombadil\'s house','landmark',78,-30,'other','Old Forest','A house on the eastern edge of the Old Forest where the Withywindle falls from the downs.',{rank:4}],
  ['Amon Sûl','ruin',205,-4,'dunedain','Eriador','Weathertop: ruined watch-tower of Arnor, once home of a palantír.',{rank:2}],
  ['Last Bridge','bridge',288,0,'dunedain','Eriador','Three-arched bridge of the East Road over the Hoarwell.',{rank:3}],
  ['Ford of Bruinen','ford',345,8,'elves','Eriador','Ford below Rivendell where Elrond\'s flood swept away the Black Riders.',{rank:3}],
  ['Rivendell','elven',362,14,'elves','Imladris','The Last Homely House east of the Sea, hidden in a steep valley of the Bruinen.',{pop:1500,rank:1,culture:'elf',r:0.6}],
  ['Fornost','ruin',96,102,'dunedain','Arnor','Fornost Erain, Norbury of the Kings, capital of Arthedain; the ruin is called Deadmen\'s Dike.',{rank:2}],
  ['Annúminas','ruin',8,114,'dunedain','Arnor','Ancient first capital of Arnor on the shore of Lake Evendim.',{rank:2}],
  ['Mithlond','port',-170,-2,'elves','Lindon','The Grey Havens at the head of the Gulf of Lune, from which the Elves take ship into the West.',{pop:2000,rank:1,culture:'elf',r:0.8}],
  ['Harlond (Lindon)','port',-208,-30,'elves','Lindon','Southern haven on the Gulf of Lune.',{rank:4,culture:'elf'}],
  ['Forlond','port',-212,20,'elves','Lindon','Northern haven on the Gulf of Lune.',{rank:4,culture:'elf'}],
  ['Elostirion','tower',-112,-10,'elves','Emyn Beraid','Tallest of the White Towers, holding a palantír that looks only West.',{rank:3}],
  ['Tharbad','ruin',236,-204,'dunedain','Enedwaith','Ruined river-town and bridge where the Greenway crossed the Greyflood.',{rank:3}],
  ['Lond Daer','ruin',124,-400,'dunedain','Enedwaith','Ruined Númenórean haven at the mouths of the Greyflood.',{rank:4}],
  ['Ost-in-Edhil','ruin',346,-150,'elves','Eregion','Ruined city of the Elven-smiths of Eregion, where the Rings of Power were forged.',{rank:3}],
  ['West-gate of Moria','dwarven',402,-162,'dwarves','Khazad-dûm','The Doors of Durin, opened by the word friend, beside the dark pool of the Sirannon.',{rank:2}],
  ['Khazad-dûm','dwarven',426,-164,'dwarves','Khazad-dûm','Moria, the Dwarrowdelf: greatest of the dwarf-realms, abandoned since the Balrog woke.',{rank:1}],
  ['Dimrill Gate','dwarven',452,-168,'dwarves','Khazad-dûm','The Great Gates of Moria opening onto Azanulbizar, the Dimrill Dale.',{rank:3}],
  ['Carn Dûm','ruin',392,322,'orcs','Angmar','Fortress of the Witch-king in Angmar.',{rank:3}],
  ['Mount Gundabad','fortress',470,420,'orcs','Misty Mountains','Ancient dwarf-site become the chief orc-hold of the north.',{rank:3}],
  ['Goblin-town','cave',442,34,'orcs','Misty Mountains','Orc-caverns beneath the High Pass where Bilbo was lost and found the Ring.',{rank:4}],
  ['High Pass','landmark',432,22,'other','Misty Mountains','Cirith Forn en Andrath, the high pass over the Misty Mountains east of Rivendell.',{rank:4}],
  // Wilderland
  ['Carrock','landmark',516,141,'men','Vales of Anduin','Rock-island in the Anduin with steps carved by Beorn.',{rank:4}],
  ['Old Ford','ford',520,112,'men','Vales of Anduin','Where the Old Forest Road crosses the Anduin, kept by the Beornings.',{rank:4}],
  ['Beorn\'s house','landmark',540,150,'men','Vales of Anduin','Timber hall of the skin-changer Beorn amid fields of clover and bees.',{rank:3,culture:'beorning',r:0.25}],
  ['Rhosgobel','landmark',580,100,'other','Mirkwood','Home of Radagast the Brown on the western eaves of Mirkwood.',{rank:4}],
  ['Thranduil\'s Halls','elven',700,252,'elves','Woodland Realm','The great cave-palace of the Elvenking beside the Forest River.',{pop:3000,rank:2,culture:'elf',r:0.3}],
  ['Dol Guldur','fortress',612,-62,'orcs','Mirkwood','The Hill of Sorcery in southern Mirkwood, Sauron\'s hold before his return to Mordor.',{rank:2}],
  ['Esgaroth','town',754,276,'men','Long Lake','Lake-town, built on piles upon the Long Lake.',{pop:3000,rank:2,culture:'lake',r:0.5}],
  ['Dale','city',764,318,'men','Dale','City of the Bardings in the valley before the Lonely Mountain, rebuilt by King Bard.',{pop:6000,rank:1,culture:'dale',r:0.8}],
  ['Erebor','dwarven',765,332,'dwarves','Erebor','The Kingdom under the Mountain, restored by Dáin Ironfoot.',{pop:5000,rank:1}],
  ['Ravenhill','landmark',766,340,'dwarves','Erebor','Dwarf guard-post on a southern spur of the Lonely Mountain.',{rank:5}],
  ['Iron Hills','dwarven',1000,350,'dwarves','Iron Hills','Dáin\'s dwarf-realm, rich in iron.',{pop:4000,rank:2}],
  ['Caras Galadhon','elven',505,-205,'elves','Lothlórien','City of the Trees, where Celeborn and Galadriel dwell in a hill-crowned grove of mallorn.',{pop:5000,rank:1,culture:'lorien',r:0.9}],
  ['Cerin Amroth','landmark',498,-196,'elves','Lothlórien','A green mound at the heart of old Lórien where elanor and niphredil bloom.',{rank:5}],
  ['Egladil','landmark',548,-232,'elves','Lothlórien','The Tongue, the green angle between Silverlode and Anduin.',{rank:5}],
  // Rohan
  ['Edoras','city',480,-440,'rohirrim','Rohan','The courts of the Mark on a green hill, crowned by the golden hall Meduseld.',{pop:5000,rank:1,culture:'rohan',r:0.55}],
  ['Meduseld','landmark',480.2,-439.8,'rohirrim','Rohan','Golden Hall of the Kings of Rohan.',{rank:4}],
  ['Dunharrow','fortress',486,-456,'rohirrim','Rohan','Refuge of Harrowdale reached by the Púkel-road, beneath the Dwimorberg.',{rank:3}],
  ['Helm\'s Deep','fortress',410,-420,'rohirrim','Rohan','The Hornburg and the Deeping Wall guarding a gorge in the White Mountains.',{rank:1,culture:'rohan',r:0.2}],
  ['Aglarond','cave',408,-423,'dwarves','Rohan','The Glittering Caves behind Helm\'s Deep.',{rank:4}],
  ['Aldburg','town',556,-470,'rohirrim','Rohan','Éomer\'s seat in the Eastfold.',{pop:1500,rank:3,culture:'rohan',r:0.4}],
  ['Fords of Isen','ford',380,-362,'rohirrim','Rohan','Ford on the Isen where Théodred fell.',{rank:3}],
  ['Isengard','fortress',400,-325,'orcs','Isengard','Angrenost: a stone ring about the black tower of Orthanc, now Saruman\'s arsenal.',{rank:1,culture:'isengard',r:0.6}],
  ['Orthanc','tower',400,-325.01,'other','Isengard','The unbreakable black tower of Isengard, 500 feet tall.',{rank:4}],
  ['Wellinghall','landmark',470,-300,'ents','Fangorn','Treebeard\'s dwelling beneath the last mountain.',{rank:5}],
  ['Derndingle','landmark',456,-306,'ents','Fangorn','Hollow dell where the Entmoot gathered.',{rank:5}],
  ['Edhellond','ruin',520,-796,'elves','Belfalas','Ruined elf-haven near the mouth of the Morthond.',{rank:4}],
  // Gondor
  ['Minas Tirith','city',720,-600,'gondor','Gondor','The Tower of Guard, seven-tiered white city on the knee of Mindolluin, capital of Gondor.',{pop:50000,rank:1,culture:'minastirith',r:0.42}],
  ['Osgiliath','ruin',739,-592,'gondor','Gondor','Ruined ancient capital spanning the Anduin.',{rank:2,culture:'osgiliath',r:1.2}],
  ['Harlond','port',732,-603,'gondor','Gondor','River-quays of Minas Tirith on the Anduin.',{rank:4}],
  ['Pelargir','city',772,-755,'gondor','Lebennin','Great port of Gondor on the Anduin, where Aragorn took the black fleet.',{pop:20000,rank:1,culture:'gondor',r:0.9}],
  ['Dol Amroth','city',532,-812,'gondor','Belfalas','Castle-city of Prince Imrahil on its sea-promontory.',{pop:15000,rank:1,culture:'gondor',r:0.8}],
  ['Linhir','town',634,-786,'gondor','Lebennin','Town at the mouth of Gilrain where the Corsairs were battled.',{pop:3000,rank:3,culture:'gondor',r:0.4}],
  ['Erech','landmark',496,-506,'gondor','Morthond','Hill with the black Stone of Erech, where Isildur\'s oathbreakers were summoned.',{rank:3}],
  ['Calembel','town',490,-570,'gondor','Lamedon','Town on the Ciril in Lamedon.',{pop:1500,rank:4,culture:'gondor',r:0.3}],
  ['Ethring','town',540,-600,'gondor','Lamedon','Town on the Ringló crossing.',{pop:1200,rank:4,culture:'gondor',r:0.3}],
  ['Cair Andros','fortress',734,-531,'gondor','Anórien','Island fortress guarding the northern crossing of the Anduin.',{rank:3}],
  ['Henneth Annûn','cave',765,-540,'gondor','Ithilien','Window of the Sunset: a Ranger refuge behind a waterfall.',{rank:3}],
  ['Emyn Arnen','landmark',748,-615,'gondor','Ithilien','Hills of Ithilien, later seat of Faramir.',{rank:4}],
  ['Crossroads','landmark',776,-590,'gondor','Ithilien','Ring of trees where the Morgul Road crosses the Harad Road, with a beheaded king\'s statue.',{rank:4}],
  ['Argonath','wonder',706,-392,'gondor','Gondor','The Pillars of the Kings: Isildur and Anárion carved in stone at the north gate of Gondor.',{rank:2}],
  ['Rauros','wonder',714,-431,'gondor','Gondor','The great falls of the Anduin below Nen Hithoel.',{rank:2}],
  ['Amon Hen','landmark',704,-423,'gondor','Gondor','Hill of Sight, with the Seat of Seeing on its summit.',{rank:3}],
  ['Parth Galen','landmark',706,-421,'gondor','Gondor','Green lawn beneath Amon Hen where the Fellowship broke.',{rank:5}],
  ['Tolfalas','landmark',703,-874,'gondor','Gondor','Island in the Bay of Belfalas.',{rank:5}],
  ['Amon Dîn','tower',694,-578,'gondor','Anórien','First of the warning beacons of Gondor.',{rank:5}],
  ['Eilenach','tower',674,-570,'gondor','Anórien','Beacon hill above the Drúadan Forest.',{rank:5}],
  ['Nardol','tower',654,-558,'gondor','Anórien','Beacon hill.',{rank:5}],
  ['Erelas','tower',634,-546,'gondor','Anórien','Beacon hill.',{rank:5}],
  ['Min-Rimmon','tower',614,-534,'gondor','Anórien','Beacon hill.',{rank:5}],
  ['Calenhad','tower',594,-520,'gondor','Anórien','Beacon hill.',{rank:5}],
  ['Halifirien','tower',572,-506,'gondor','Anórien','Westernmost beacon, on the border with Rohan in the Firien Wood.',{rank:5}],
  // Mordor
  ['Barad-dûr','fortress',895,-530,'orcs','Mordor','The Dark Tower of Sauron on a spur of the Ash Mountains.',{rank:1,culture:'mordor',r:0.8}],
  ['Orodruin','landmark',860,-565,'orcs','Mordor','Mount Doom, the volcano where the One Ring was forged and unmade.',{rank:1}],
  ['Sammath Naur','cave',860,-563.5,'orcs','Mordor','The Chambers of Fire on the side of Orodruin.',{rank:5}],
  ['Minas Morgul','fortress',788,-590,'orcs','Mordor','The Tower of Sorcery, once Minas Ithil, home of the Nazgûl.',{rank:1,culture:'morgul',r:0.4}],
  ['Cirith Ungol','fortress',800,-579,'orcs','Mordor','Tower and pass above Shelob\'s Lair on the Ephel Dúath.',{rank:2}],
  ['Shelob\'s Lair','cave',798,-577,'other','Mordor','Torech Ungol, the tunnels of the great spider.',{rank:4}],
  ['Morannon','fortress',812,-448,'orcs','Mordor','The Black Gate between the Towers of the Teeth, closing Cirith Gorgor.',{rank:1}],
  ['Durthang','fortress',816,-468,'orcs','Mordor','Ancient castle in the northern Ephel Dúath, an orc-hold.',{rank:4}],
  ['Isenmouthe','fortress',840,-472,'orcs','Mordor','Carach Angren, walled gap between Udûn and Gorgoroth.',{rank:3}],
  ['Sea of Núrnen','landmark',1012,-648,'men','Mordor','Bitter inland sea of southern Mordor.',{rank:5}],
  // East & South
  ['Umbar','city',628,-1142,'haradrim','Umbar','Haven of the Corsairs, a great natural harbour behind the Cape of Umbar.',{pop:30000,rank:1,culture:'harad',r:0.9}],
  ['Dorwinion vineyards','landmark',1070,-186,'men','Rhûn','Vine-lands on the shores of the Sea of Rhûn whose wine reached even Thranduil\'s halls.',{rank:4}],
  ['Khand','landmark',1250,-820,'men','Khand','Land of the Variags south-east of Mordor.',{rank:4}],
  ['Tents of the Easterlings','town',1300,-180,'men','Rhûn','Seasonal camp-towns of the Easterling tribes.',{pop:8000,rank:3,culture:'east',r:0.6}],
  ['City of the Haradrim','city',1000,-1400,'haradrim','Harad','A great walled city of Near Harad on the southern river (invented for this atlas).',{pop:40000,rank:2,culture:'harad',r:1.2}],
  ['Lossoth camps','village',150,470,'men','Forochel','Snow-houses of the Lossoth on the shores of the Ice Bay.',{pop:200,rank:4}],
];

/* Region & sea labels: [text, x, y, class, minzoom, maxzoom, size] */
const REGION_LABELS = [
  ['ERIADOR',150,60,'region',3.2,7,1.2],['RHOVANION',660,120,'region',3.2,7,1.2],['FORODWAITH',700,600,'region',3,6.5,1.1],
  ['RHÛN',1400,0,'region',3,6.5,1.3],['HARAD',1000,-1600,'region',2.6,6,1.4],['NEAR HARAD',950,-1050,'region',4,7,0.9],['FAR HARAD',900,-2000,'region',3.5,7,1],
  ['KHAND',1260,-790,'region',4,7.5,0.8],['MORDOR',960,-560,'realm',3.4,7.5,1.1],['GONDOR',600,-700,'realm',3.4,7.5,1.1],['ROHAN',560,-380,'realm',3.4,7.5,1.1],
  ['LINDON',-310,120,'realm',4,7.5,0.9],['ENEDWAITH',250,-320,'region',4.5,8,0.8],['MINHIRIATH',80,-260,'region',4.5,8,0.8],['DUNLAND',360,-270,'region',5,8.5,0.7],
  ['EREGION',350,-150,'region',5.5,9,0.7],['RHUDAUR',300,90,'region',5,8.5,0.7],['ARTHEDAIN',60,70,'region',5,8.5,0.7],['CARDOLAN',120,-120,'region',5,8.5,0.7],
  ['ANGMAR',380,300,'region',5,8.5,0.7],['WILDERLAND',520,260,'region',4.5,8,0.75],['THE SHIRE',-8,-18,'realm',5.5,9.5,0.9],['BREE-LAND',108,-12,'region',7.5,10.5,0.6],
  ['ITHILIEN',776,-560,'region',5.8,9,0.7],['ANÓRIEN',650,-535,'region',6,9,0.7],['LEBENNIN',680,-730,'region',6,9,0.7],['BELFALAS',500,-760,'region',6,9,0.7],
  ['LOSSARNACH',700,-640,'region',6.5,9.5,0.6],['LAMEDON',520,-600,'region',6.5,9.5,0.6],['ANFALAS',300,-680,'region',6,9,0.7],['HARONDOR',830,-850,'region',5.5,9,0.7],
  ['GORGOROTH',870,-520,'region',6,9.5,0.65],['NURN',1000,-600,'region',6,9.5,0.65],['LITHLAD',1000,-520,'region',6.5,9.5,0.55],['UDÛN',826,-458,'region',7.5,10.5,0.5],
  ['DAGORLAD',812,-420,'region',6.5,9.5,0.55],['THE BROWN LANDS',680,-300,'region',5.5,9,0.6],['THE WOLD',610,-330,'region',6.5,9.5,0.55],
  ['WESTFOLD',425,-405,'region',7,10,0.5],['EASTFOLD',560,-455,'region',7,10,0.5],['WEST EMNET',470,-380,'region',7,10,0.5],['EAST EMNET',620,-400,'region',7,10,0.5],
  ['DRÚWAITH IAUR',170,-590,'region',6,9,0.55],['LONE-LANDS',180,-40,'region',6,9,0.55],['WITHERED HEATH',900,460,'region',6,9,0.55],['DORWINION',1070,-180,'region',6,9,0.55],
  ['EMYN MUIL',735,-405,'region',6.5,9.5,0.55],['THE NEW LANDS',-9000,0,'region',0,3.5,1],
];
const SEA_LABELS = [
  ['Belegaer · The Great Sea',-800,-400,1.6,0,6.5],['Bay of Belfalas',640,-900,1,4,8.5],['Ice Bay of Forochel',90,500,0.9,4,8.5],
  ['Gulf of Lune',-230,-15,0.8,5.5,9],['Sea of Rhûn',1160,-250,0.95,4.5,9],['Sea of Núrnen',1010,-648,0.7,6,9.5],['Bay of Umbar',570,-1150,0.7,6,9],
  ['Nenuial',12,132,0.6,7,11],['Long Lake',753,276,0.55,8,12],['Nen Hithoel',711,-410,0.5,8.5,12],['The Eastern Sea',3100,-400,1.3,0,6],
  ['Straits of the South',1200,-2700,0.9,3,7],['The drowned isle of Númenor',-1500,-600,0.8,4,9],
];

/* Political realms by era. */
const REALMS = {
  'TA3018': [
    { name:'Gondor', color:'#c9d4e8', pts:[[575,-500],[590,-470],[605,-432],[650,-446],[700,-466],[728,-490],[760,-448],[805,-448],[800,-700],[776,-736],[790,-860],[746,-852],[700,-826],[632,-792],[534,-818],[470,-760],[380,-726],[300,-706],[298,-640],[330,-560],[392,-520],[470,-490],[530,-502]] },
    { name:'Rohan', color:'#e8d27a', pts:[[386,-400],[380,-362],[400,-352],[470,-345],[500,-300],[560,-295],[625,-300],[650,-330],[700,-398],[725,-470],[700,-466],[650,-446],[605,-432],[590,-470],[575,-500],[530,-502],[470,-490],[430,-456],[400,-426]] },
    { name:'Mordor', color:'#8a2c24', pts:[[806,-448],[1142,-490],[1150,-700],[1102,-720],[800,-702],[796,-560]] },
    { name:'Isengard', color:'#b9b9c4', pts:[[386,-310],[416,-306],[422,-336],[398,-346],[382,-330]] },
    { name:'The Shire', color:'#9cc47a', pts:[[-65,15],[-55,45],[-20,55],[20,52],[45,40],[55,6],[54,-20],[50,-50],[41,-88],[10,-96],[-20,-86],[-45,-62],[-60,-30]] },
    { name:'Buckland', color:'#b6d27f', pts:[[55,-4],[64,-2],[66,-26],[62,-42],[55,-36]] },
    { name:'Bree-land', color:'#d6c08a', pts:[[92,14],[120,18],[124,-8],[96,-12]] },
    { name:'Lindon', color:'#9fd0d8', pts:[[-392,380],[-262,430],[-240,190],[-205,30],[-168,-4],[-216,-42],[-252,-252],[-262,-268],[-306,-160],[-272,52],[-342,150],[-392,300]] },
    { name:'Imladris', color:'#a8d8c8', circle:[362,14,14] },
    { name:'Lothlórien', color:'#e9cf6a', pts:[[470,-164],[506,-170],[540,-190],[560,-224],[550,-246],[520,-250],[490,-236],[470,-210],[462,-186]] },
    { name:'Woodland Realm', color:'#8fbf8a', pts:[[620,340],[690,338],[734,302],[746,220],[640,210],[600,262]] },
    { name:'Erebor & Dale', color:'#d9a86a', pts:[[728,300],[800,300],[806,350],[740,356]] },
    { name:'Iron Hills', color:'#b08a6a', pts:[[920,330],[1070,340],[1070,378],[924,370]] },
    { name:'Dol Guldur', color:'#5b3a3a', pts:[[576,-20],[640,-10],[660,-120],[612,-150],[584,-110]] },
    { name:'Dunland', color:'#a7937a', pts:[[312,-212],[400,-240],[398,-330],[330,-330],[300,-280]] },
    { name:'Umbar', color:'#9b5b4b', pts:[[520,-1060],[700,-1000],[760,-1200],[560,-1250]] },
    { name:'Harad', color:'#c98e5a', pts:[[800,-900],[1420,-900],[1440,-1300],[1000,-1360],[620,-1280],[700,-1000]] },
    { name:'Khand', color:'#a86a5a', pts:[[1100,-700],[1360,-700],[1420,-940],[1150,-950]] },
    { name:'Rhûn', color:'#b86e56', pts:[[900,-460],[1800,-520],[1820,300],[1000,300],[900,20]] },
    { name:'Vales of Anduin', color:'#b9c98a', pts:[[488,210],[562,210],[562,40],[500,40]] },
  ],
  'TA1300': [
    { name:'Arthedain', color:'#9ab4d8', pts:[[-110,-10],[-60,60],[0,180],[120,200],[200,110],[200,-10],[120,-40],[55,5],[55,-60],[40,-90],[-65,-40]] },
    { name:'Cardolan', color:'#c4a8d8', pts:[[55,5],[120,-40],[200,-10],[288,0],[240,-198],[122,-404],[-86,-290],[40,-90],[55,-60]] },
    { name:'Rhudaur', color:'#d8b0a0', pts:[[200,110],[330,260],[440,240],[430,40],[400,-100],[288,0],[200,-10]] },
    { name:'Angmar', color:'#6a5a6a', pts:[[300,260],[480,300],[480,440],[300,480]] },
    { name:'Gondor', color:'#c9d4e8', pts:[[380,-362],[560,-295],[625,-300],[700,-398],[806,-448],[800,-700],[1000,-900],[800,-1250],[520,-1060],[790,-860],[534,-818],[470,-760],[300,-706],[226,-486]] },
    { name:'Lindon', color:'#9fd0d8', pts:[[-392,380],[-262,430],[-240,190],[-205,30],[-168,-4],[-216,-42],[-252,-252],[-262,-268],[-306,-160],[-272,52],[-342,150],[-392,300]] },
    { name:'Khazad-dûm', color:'#b08a6a', pts:[[400,-130],[460,-130],[460,-190],[400,-190]] },
    { name:'Lórien', color:'#e9cf6a', pts:[[470,-164],[506,-170],[540,-190],[560,-224],[550,-246],[520,-250],[490,-236],[470,-210],[462,-186]] },
    { name:'Greenwood', color:'#8fbf8a', pts:[[576,330],[734,302],[770,100],[736,-110],[650,-166],[586,-110]] },
    { name:'Rhovanion', color:'#d8c89a', pts:[[770,100],[1000,300],[1100,-100],[900,-300],[736,-110]] },
    { name:'Mordor (deserted)', color:'#5a3a34', pts:[[806,-448],[1142,-490],[1150,-700],[1102,-720],[800,-702],[796,-560]] },
    { name:'Harad', color:'#c98e5a', pts:[[1000,-900],[1420,-900],[1440,-1300],[1000,-1360],[800,-1250]] },
  ],
  'FA1': [
    { name:'Reunited Kingdom · Arnor', color:'#aac0e0', pts:[[-110,-10],[-60,60],[0,180],[120,200],[330,260],[440,240],[430,40],[400,-100],[240,-198],[122,-404],[-86,-290],[-65,-40]] },
    { name:'Reunited Kingdom · Gondor', color:'#c9d4e8', pts:[[575,-500],[605,-432],[728,-490],[760,-448],[805,-448],[800,-700],[1000,-900],[800,-1000],[790,-860],[534,-818],[470,-760],[300,-706],[298,-640],[392,-520],[530,-502]] },
    { name:'The Shire (free land)', color:'#9cc47a', pts:[[-110,15],[-55,45],[-20,55],[20,52],[45,40],[55,6],[54,-20],[50,-50],[41,-88],[10,-96],[-20,-86],[-45,-62],[-110,-30]] },
    { name:'Rohan', color:'#e8d27a', pts:[[386,-400],[380,-362],[400,-352],[470,-345],[500,-300],[560,-295],[625,-300],[650,-330],[700,-398],[725,-470],[650,-446],[605,-432],[575,-500],[470,-490],[400,-426]] },
    { name:'Ithilien (Princedom)', color:'#b8d8b0', pts:[[760,-448],[805,-448],[800,-700],[776,-736],[744,-640],[744,-500]] },
    { name:'Nurn (freed)', color:'#b8a888', pts:[[880,-600],[1120,-600],[1120,-716],[880,-716]] },
    { name:'Lindon', color:'#9fd0d8', pts:[[-392,380],[-262,430],[-240,190],[-205,30],[-168,-4],[-216,-42],[-252,-252],[-262,-268],[-306,-160],[-272,52],[-342,150],[-392,300]] },
    { name:'East Lórien', color:'#e9cf6a', pts:[[576,-50],[700,-60],[736,-110],[650,-166],[586,-110]] },
    { name:'Woodland Realm', color:'#8fbf8a', pts:[[576,330],[734,302],[746,200],[576,190]] },
    { name:'Beornings & Woodmen', color:'#b9c98a', pts:[[576,190],[746,200],[760,100],[756,-50],[576,-50]] },
    { name:'Erebor & Dale', color:'#d9a86a', pts:[[728,300],[800,300],[806,350],[740,356]] },
  ],
};

/* Administrative subdivisions. */
const ADMIN = [
  { name:'Westfarthing', parent:'The Shire', pts:[[-65,15],[-55,45],[15,20],[15,-5],[-20,-35],[-60,-35],[-60,-30]] },
  { name:'Northfarthing', parent:'The Shire', pts:[[-55,45],[-20,55],[20,52],[45,40],[50,40],[15,20]] },
  { name:'Eastfarthing', parent:'The Shire', pts:[[15,20],[50,40],[55,6],[54,-20],[50,-50],[35,-35],[15,-5]] },
  { name:'Southfarthing', parent:'The Shire', pts:[[15,-5],[35,-35],[50,-50],[41,-88],[10,-96],[-20,-86],[-45,-62],[-60,-35],[-20,-35]] },
  { name:'Buckland', parent:'The Shire', pts:[[55,-4],[64,-2],[66,-26],[62,-42],[55,-36]] },
  { name:'Anórien', parent:'Gondor', pts:[[575,-500],[605,-432],[700,-466],[728,-490],[734,-560],[700,-592],[640,-560]] },
  { name:'North Ithilien', parent:'Gondor', pts:[[728,-490],[760,-448],[805,-448],[798,-590],[739,-592],[734,-560]] },
  { name:'South Ithilien', parent:'Gondor', pts:[[739,-592],[798,-590],[800,-700],[776,-736],[770,-730],[760,-670]] },
  { name:'Lossarnach', parent:'Gondor', pts:[[700,-600],[739,-600],[760,-670],[700,-672],[664,-630]] },
  { name:'Lebennin', parent:'Gondor', pts:[[600,-620],[664,-630],[700,-672],[770,-730],[776,-736],[790,-860],[746,-852],[632,-792],[600,-700]] },
  { name:'Lamedon', parent:'Gondor', pts:[[500,-540],[600,-560],[600,-700],[520,-700],[500,-640]] },
  { name:'Morthond Vale', parent:'Gondor', pts:[[470,-500],[500,-540],[500,-640],[470,-640],[450,-560]] },
  { name:'Ringló Vale', parent:'Gondor', pts:[[420,-540],[470,-500],[470,-640],[440,-660]] },
  { name:'Belfalas', parent:'Gondor', pts:[[440,-660],[520,-700],[600,-700],[632,-792],[534,-818],[470,-760]] },
  { name:'Anfalas', parent:'Gondor', pts:[[300,-706],[298,-640],[330,-600],[420,-540],[440,-660],[470,-760],[380,-726]] },
  { name:'Westfold', parent:'Rohan', pts:[[386,-400],[380,-362],[420,-372],[450,-400],[430,-456],[400,-426]] },
  { name:'West Emnet', parent:'Rohan', pts:[[400,-352],[470,-345],[520,-360],[500,-420],[450,-400],[420,-372]] },
  { name:'East Emnet', parent:'Rohan', pts:[[520,-360],[600,-320],[650,-330],[700,-398],[610,-424],[560,-398]] },
  { name:'The Wold', parent:'Rohan', pts:[[500,-300],[560,-295],[625,-300],[650,-330],[600,-320],[520,-360],[470,-345]] },
  { name:'Eastfold', parent:'Rohan', pts:[[500,-420],[560,-398],[610,-424],[605,-432],[590,-470],[575,-500],[530,-502],[500,-470]] },
  { name:'The Folde & Harrowdale', parent:'Rohan', pts:[[450,-400],[500,-420],[500,-470],[470,-490],[430,-456]] },
  { name:'Gorgoroth', parent:'Mordor', pts:[[814,-462],[900,-468],[952,-490],[952,-560],[900,-610],[830,-612],[810,-560],[808,-500]] },
  { name:'Nurn', parent:'Mordor', pts:[[880,-610],[1120,-600],[1120,-716],[880,-716]] },
  { name:'Lithlad', parent:'Mordor', pts:[[952,-470],[1140,-490],[1130,-600],[952,-560]] },
];

/* Peoples: dominant population regions. */
const PEOPLES = [
  { name:'Hobbits', lang:'Westron', color:'#86b35a', pop:'~40,000 (est.)', pts:FARMS[0].pts },
  { name:'Hobbits & Men of Bree', lang:'Westron', color:'#b3a85a', pop:'~2,500 (est.)', pts:[[92,14],[120,18],[124,-8],[96,-12]] },
  { name:'Elves of Lindon', lang:'Sindarin · Quenya', color:'#6fb6c9', pop:'thousands', pts:REALMS.TA3018[7].pts },
  { name:'Elves of Imladris', lang:'Sindarin', color:'#6fb6c9', pop:'hundreds', circle:[362,14,14] },
  { name:'Galadhrim', lang:'Sindarin (Silvan)', color:'#d8b84a', pop:'thousands', pts:REALMS.TA3018[9].pts },
  { name:'Silvan Elves', lang:'Silvan · Sindarin', color:'#5a9a6a', pop:'thousands', pts:REALMS.TA3018[10].pts },
  { name:'Dwarves of Erebor', lang:'Khuzdul · Westron', color:'#b07a4a', pop:'~5,000 (est.)', pts:[[748,318],[782,318],[782,346],[748,346]] },
  { name:'Dwarves of the Iron Hills', lang:'Khuzdul', color:'#b07a4a', pop:'~4,000 (est.)', pts:REALMS.TA3018[12].pts },
  { name:'Dwarves of Ered Luin', lang:'Khuzdul', color:'#b07a4a', pop:'hundreds', pts:[[-262,300],[-230,300],[-212,80],[-240,80]] },
  { name:'Dúnedain Rangers', lang:'Sindarin · Westron', color:'#7a8a9a', pop:'a few hundred', pts:[[130,200],[300,200],[300,-150],[130,-150]] },
  { name:'Men of Gondor', lang:'Westron · Sindarin', color:'#9aa8c8', pop:'~2,000,000 (est.)', pts:REALMS.TA3018[0].pts },
  { name:'Rohirrim', lang:'Rohirric · Westron', color:'#d8b84a', pop:'~250,000 (est.)', pts:REALMS.TA3018[1].pts },
  { name:'Dunlendings', lang:'Dunlendish', color:'#9a7a5a', pop:'tens of thousands', pts:REALMS.TA3018[14].pts },
  { name:'Beornings', lang:'Northman tongue · Westron', color:'#a8a85a', pop:'thousands', pts:REALMS.TA3018[19].pts },
  { name:'Woodmen', lang:'Northman tongue', color:'#8a9a5a', pop:'thousands', pts:[[570,100],[600,100],[600,-20],[574,-20]] },
  { name:'Bardings & Lake-men', lang:'Dalish · Westron', color:'#c8985a', pop:'~15,000 (est.)', pts:[[736,250],[800,250],[800,320],[736,320]] },
  { name:'Easterlings', lang:'Eastern tongues', color:'#b8584a', pop:'many', pts:REALMS.TA3018[18].pts },
  { name:'Variags', lang:'Variag', color:'#a84a4a', pop:'many', pts:REALMS.TA3018[17].pts },
  { name:'Haradrim', lang:'Haradaic', color:'#c87a3a', pop:'many', pts:REALMS.TA3018[16].pts },
  { name:'Corsairs of Umbar', lang:'Adûnaic-derived', color:'#8a4a4a', pop:'tens of thousands', pts:REALMS.TA3018[15].pts },
  { name:'Drúedain', lang:'Drúedain speech', color:'#6a7a4a', pop:'few', pts:FORESTS[5].pts },
  { name:'Lossoth', lang:'Lossoth speech', color:'#a8c8d8', pop:'few', pts:[[0,440],[260,520],[260,480],[40,420]] },
  { name:'Orcs & Uruks of Mordor', lang:'Black Speech · orkish', color:'#5a2a2a', pop:'vast armies', pts:REALMS.TA3018[2].pts },
  { name:'Uruk-hai of Isengard', lang:'orkish · Westron', color:'#4a4a5a', pop:'~10,000 (est.)', pts:REALMS.TA3018[3].pts },
  { name:'Orcs of the Misty Mountains', lang:'orkish', color:'#5a4a3a', pop:'many', pts:[[420,420],[480,420],[460,-120],[420,-120]] },
  { name:'Ents', lang:'Entish', color:'#3a6a3a', pop:'about fifty', pts:FORESTS[2].pts },
  { name:'Trolls', lang:'—', color:'#6a6a5a', pop:'few', pts:[[300,70],[410,180],[380,20],[296,6]] },
];

/* Roads. cls: 1 great road, 2 road, 3 track.  */
const ROADS = [
  { name:'Great East Road', cls:1, pts:[[-170,0],[-140,-4],[-112,-10],[-80,-8],[-60,-6],[-36,-6],[-12,-3],[4,-2],[18,1],[30,2],[44,4],[55,5],[70,6],[88,4],[104,1],[120,2],[140,4],[160,2],[180,0],[198,-4],[220,-2],[250,0],[288,0],[310,4],[330,8],[345,8],[362,14],[390,22],[432,22],[470,60],[500,95],[520,112]] },
  { name:'Old Forest Road', alt:'Men-i-Naugrim', cls:2, pts:[[520,112],[545,130],[570,140],[620,138],[680,140],[740,142],[770,140],[830,120],[900,90]] },
  { name:'Elf-path', cls:3, pts:[[574,196],[610,204],[650,214],[680,236],[700,252]] },
  { name:'Greenway', alt:'North-South Road', cls:1, pts:[[96,102],[100,70],[102,30],[104,1],[112,-30],[130,-80],[160,-140],[200,-180],[236,-204],[270,-240],[310,-290],[346,-330],[380,-362]] },
  { name:'Great West Road', cls:1, pts:[[380,-362],[400,-390],[430,-410],[460,-430],[480,-440],[520,-452],[556,-470],[590,-500],[620,-530],[650,-552],[680,-572],[700,-590],[720,-600]] },
  { name:'Causeway to Osgiliath', cls:1, pts:[[720,-600],[728,-597],[739,-592]] },
  { name:'Morgul Road', cls:2, pts:[[739,-592],[760,-590],[776,-590],[788,-590],[798,-584],[820,-560],[845,-548]] },
  { name:'Harad Road', cls:1, pts:[[812,-448],[790,-470],[780,-520],[776,-590],[775,-650],[780,-720],[800,-800],[830,-900],[820,-1000],[800,-1100],[900,-1250],[1000,-1400]] },
  { name:'Road of Barad-dûr', cls:2, pts:[[840,-472],[860,-500],[880,-520],[895,-530]] },
  { name:'Sauron\'s Road', cls:3, pts:[[895,-530],[880,-548],[866,-560],[861,-564]] },
  { name:'Road to Isengard', cls:2, pts:[[380,-362],[392,-345],[400,-325]] },
  { name:'Road to Helm\'s Deep', cls:3, pts:[[400,-390],[406,-410],[410,-420]] },
  { name:'Road of Edoras to Dunharrow', cls:3, pts:[[480,-440],[484,-450],[486,-456]] },
  { name:'Coast Road of Gondor', cls:2, pts:[[720,-600],[700,-640],[680,-700],[634,-786],[590,-790],[532,-812]] },
  { name:'Road to Pelargir', cls:2, pts:[[720,-600],[740,-640],[760,-700],[772,-755]] },
  { name:'North Road of Eriador', cls:2, pts:[[96,102],[60,108],[8,114]] },
  { name:'Tharbad–Lond Daer road', cls:3, pts:[[236,-204],[200,-280],[160,-350],[124,-400]] },
  { name:'Shire south road', cls:3, pts:[[-12,-3],[-12,-22],[-16,-52],[20,-70],[41,-88]] },
  { name:'Stock road', cls:3, pts:[[18,1],[30,-6],[40,-8],[48,-8],[54,-14]] },
  { name:'Buckland road', cls:3, pts:[[60,-16],[62,-10],[62,4],[56,5]] },
  { name:'Dale–Esgaroth road', cls:3, pts:[[754,276],[758,290],[764,318]] },
  { name:'Road of Umbar', cls:2, pts:[[628,-1142],[700,-1150],[800,-1100]] },
  { name:'Road to Rhûn', cls:2, pts:[[900,90],[1000,20],[1100,-80],[1300,-180]] },
];

const WALLS = [
  { name:'Rammas Echor', circle:[728,-600,10.5], ring:true },
  { name:'Deeping Wall', pts:[[409.4,-419.2],[410.6,-419.6]] },
  { name:'Ring of Isengard', circle:[400,-325,0.5], ring:true },
  { name:'Walls of the Morannon', pts:[[806,-446],[812,-448],[818,-446]] },
  { name:'Wall of the Isenmouthe', pts:[[834,-470],[846,-474]] },
  { name:'Deadmen\'s Dike', circle:[96,102,1.2], ring:true },
];

const PALANTIRI = {
  stones:['Elostirion','Annúminas','Amon Sûl','Orthanc','Osgiliath','Minas Tirith','Minas Morgul'],
  links:[['Annúminas','Amon Sûl'],['Amon Sûl','Orthanc'],['Orthanc','Osgiliath'],['Osgiliath','Minas Tirith'],['Osgiliath','Minas Morgul'],['Annúminas','Elostirion']],
};
const BEACONS = ['Amon Dîn','Eilenach','Nardol','Erelas','Min-Rimmon','Calenhad','Halifirien'];

/* Journeys. Waypoint: [x, y, 'Year Month Day'] in Shire Reckoning month numbering. */
const JOURNEYS = {
  'war': [
    { name:'Frodo & Sam', color:'#f2d06b', pts:[
      [-0.7,0.6,'3018 9 23'],[20,-6,'3018 9 24'],[35,-10,'3018 9 24.8'],[48,-12,'3018 9 25.4'],[54,-14,'3018 9 25.7'],[63,-10,'3018 9 25.9'],[70,-18,'3018 9 26.3'],[78,-30,'3018 9 26.8'],[80,-24,'3018 9 28.2'],[88,-12,'3018 9 28.5'],[100,-2,'3018 9 29.4'],[104,1,'3018 9 29.7'],
      [120,4,'3018 9 30.5'],[140,4,'3018 10 1.5'],[155,0,'3018 10 3'],[180,2,'3018 10 5'],[205,-4,'3018 10 6.5'],[230,-12,'3018 10 9'],[260,-6,'3018 10 12'],[288,0,'3018 10 13'],[318,12,'3018 10 16'],[330,6,'3018 10 18.5'],[345,8,'3018 10 20.4'],[362,14,'3018 10 20.9'],
      [362,14,'3018 12 25'],[372,-30,'3018 12 30'],[365,-100,'3019 1 5'],[356,-140,'3019 1 8'],[392,-150,'3019 1 10'],[425,-148,'3019 1 11.5'],[396,-150,'3019 1 12.5'],[402,-162,'3019 1 13.8'],[426,-164,'3019 1 14.5'],[447,-166,'3019 1 15.3'],[452,-168,'3019 1 15.5'],[476,-176,'3019 1 16'],[488,-188,'3019 1 16.5'],[505,-205,'3019 1 17'],
      [505,-205,'3019 2 16'],[552,-232,'3019 2 16.5'],[580,-265,'3019 2 18'],[625,-300,'3019 2 19'],[660,-330,'3019 2 21'],[690,-360,'3019 2 23'],[706,-392,'3019 2 25'],[706,-421,'3019 2 25.8'],[715,-420,'3019 2 26.8'],[735,-408,'3019 2 28'],[745,-410,'3019 2 29'],[762,-420,'3019 3 1'],[790,-430,'3019 3 3'],[812,-448,'3019 3 5'],
      [790,-480,'3019 3 6'],[770,-520,'3019 3 7'],[765,-540,'3019 3 7.8'],[770,-570,'3019 3 9'],[776,-590,'3019 3 10'],[790,-586,'3019 3 11'],[798,-577,'3019 3 12.5'],[800,-579,'3019 3 13'],[806,-574,'3019 3 14.6'],[814,-540,'3019 3 16'],[820,-500,'3019 3 17.5'],[836,-476,'3019 3 18'],[842,-500,'3019 3 20'],[848,-530,'3019 3 22'],[855,-556,'3019 3 24'],[860,-563.5,'3019 3 25'],
    ]},
    { name:'Aragorn, Legolas & Gimli', color:'#9ec7ef', pts:[
      [104,1,'3018 9 29.7'],[120,4,'3018 9 30.5'],[140,4,'3018 10 1.5'],[155,0,'3018 10 3'],[180,2,'3018 10 5'],[205,-4,'3018 10 6.5'],[230,-12,'3018 10 9'],[260,-6,'3018 10 12'],[288,0,'3018 10 13'],[318,12,'3018 10 16'],[330,6,'3018 10 18.5'],[345,8,'3018 10 20.4'],[362,14,'3018 10 20.9'],
      [362,14,'3018 12 25'],[372,-30,'3018 12 30'],[365,-100,'3019 1 5'],[356,-140,'3019 1 8'],[392,-150,'3019 1 10'],[425,-148,'3019 1 11.5'],[396,-150,'3019 1 12.5'],[402,-162,'3019 1 13.8'],[426,-164,'3019 1 14.5'],[447,-166,'3019 1 15.3'],[452,-168,'3019 1 15.5'],[476,-176,'3019 1 16'],[488,-188,'3019 1 16.5'],[505,-205,'3019 1 17'],
      [505,-205,'3019 2 16'],[552,-232,'3019 2 16.5'],[580,-265,'3019 2 18'],[625,-300,'3019 2 19'],[660,-330,'3019 2 21'],[690,-360,'3019 2 23'],[706,-392,'3019 2 25'],[706,-421,'3019 2 26'],[680,-400,'3019 2 27'],[620,-360,'3019 2 28'],[560,-330,'3019 2 30'],[505,-322,'3019 3 1'],[480,-440,'3019 3 2'],[410,-420,'3019 3 3.5'],[400,-325,'3019 3 5'],[420,-356,'3019 3 5.6'],[410,-420,'3019 3 6'],[486,-456,'3019 3 7'],[496,-506,'3019 3 8'],[490,-570,'3019 3 9'],[560,-680,'3019 3 11'],[634,-786,'3019 3 12'],[772,-755,'3019 3 13'],[732,-603,'3019 3 15'],[739,-592,'3019 3 19'],[776,-590,'3019 3 20'],[790,-500,'3019 3 23'],[812,-452,'3019 3 25'],
    ]},
    { name:'Merry & Pippin', color:'#b5e08a', pts:[
      [-0.7,0.6,'3018 9 23'],[20,-6,'3018 9 24'],[35,-10,'3018 9 24.8'],[48,-12,'3018 9 25.4'],[54,-14,'3018 9 25.7'],[63,-10,'3018 9 25.9'],[70,-18,'3018 9 26.3'],[78,-30,'3018 9 26.8'],[80,-24,'3018 9 28.2'],[88,-12,'3018 9 28.5'],[104,1,'3018 9 29.7'],
      [120,4,'3018 9 30.5'],[155,0,'3018 10 3'],[205,-4,'3018 10 6.5'],[288,0,'3018 10 13'],[345,8,'3018 10 20.4'],[362,14,'3018 10 20.9'],
      [362,14,'3018 12 25'],[356,-140,'3019 1 8'],[402,-162,'3019 1 13.8'],[452,-168,'3019 1 15.5'],[505,-205,'3019 1 17'],[505,-205,'3019 2 16'],[625,-300,'3019 2 19'],[706,-392,'3019 2 25'],[706,-421,'3019 2 26'],[650,-380,'3019 2 27'],[560,-330,'3019 2 28'],[506,-320,'3019 2 29'],[470,-300,'3019 2 29.7'],[456,-306,'3019 3 1'],[400,-325,'3019 3 3'],[420,-356,'3019 3 5'],
    ]},
    { name:'Pippin & Gandalf', color:'#e6e6e6', pts:[[420,-356,'3019 3 5.2'],[480,-440,'3019 3 6'],[572,-506,'3019 3 7'],[680,-572,'3019 3 8'],[720,-600,'3019 3 9']] },
    { name:'Merry with Théoden', color:'#d9c07a', pts:[[400,-325,'3019 3 5.5'],[410,-420,'3019 3 6'],[486,-456,'3019 3 7.5'],[480,-440,'3019 3 10'],[560,-480,'3019 3 11'],[640,-548,'3019 3 13'],[690,-576,'3019 3 14'],[728,-598,'3019 3 15']] },
    { name:'Gandalf the Grey', color:'#c8c8d8', pts:[[400,-325,'3018 9 18'],[480,-440,'3018 9 20'],[300,-200,'3018 9 23'],[-1,0,'3018 9 29'],[63,-10,'3018 9 30'],[104,1,'3018 10 1'],[205,-4,'3018 10 3'],[362,14,'3018 10 18'],[362,14,'3018 12 25'],[356,-140,'3019 1 8'],[425,-148,'3019 1 11.5'],[402,-162,'3019 1 13.8'],[447,-166,'3019 1 15.3']] },
  ],
  'hobbit': [
    { name:'Bilbo & Thorin\'s Company', color:'#f2d06b', pts:[
      [-0.7,0.6,'2941 4 28'],[4,-2,'2941 4 28.4'],[55,5,'2941 4 30'],[104,1,'2941 5 4'],[205,-4,'2941 5 12'],[288,0,'2941 5 20'],[318,16,'2941 5 26'],[362,14,'2941 6 30'],[400,20,'2941 7 2'],[432,22,'2941 7 5'],[442,34,'2941 7 6'],[470,60,'2941 7 7'],[516,141,'2941 7 8'],[540,150,'2941 7 9'],[574,196,'2941 7 14'],[610,204,'2941 7 20'],[650,214,'2941 7 30'],[690,236,'2941 8 6'],[700,252,'2941 8 12'],[722,262,'2941 9 22'],[754,276,'2941 9 23'],[758,300,'2941 10 2'],[765,332,'2941 10 10'],[764,318,'2941 11 23'],[540,150,'2941 12 30'],[362,14,'2942 5 1'],[205,-4,'2942 5 25'],[104,1,'2942 6 5'],[-0.7,0.6,'2942 6 22']
    ]},
  ],
};

const STORIES = {
  war: { title:'The War of the Ring', start:'3018 9 1', end:'3019 3 30', now:'3018 9 30' },
  hobbit: { title:'There and Back Again', start:'2941 4 25', end:'2942 6 30', now:'2941 7 7' },
};

const LORE_WEATHER = [
  { name:'Blizzard on Caradhras', x:430, y:-150, r:40, from:'3019 1 11', to:'3019 1 12.8', kind:'snow' },
  { name:'Storm out of Isengard', x:410, y:-400, r:80, from:'3019 3 3', to:'3019 3 4.3', kind:'storm' },
  { name:'The Dawnless Day', x:860, y:-560, r:300, from:'3019 3 10', to:'3019 3 15.3', kind:'darkness' },
  { name:'Fumes of Orodruin', x:860, y:-565, r:40, from:'3018 1 1', to:'3019 3 25', kind:'smoke' },
];

return { COAST, ISLANDS, RANGES, HILLS, PEAKS, RIVERS, LAKES, FORESTS, MARSHES, ARID, FARMS, GRASS, ASH, UPLIFT, ICE, NUMENOR,
  PLACES, REGION_LABELS, SEA_LABELS, REALMS, ADMIN, PEOPLES, ROADS, WALLS, PALANTIRI, BEACONS, JOURNEYS, STORIES, LORE_WEATHER };
})();
if (typeof self !== 'undefined') self.GEO = GEO;
