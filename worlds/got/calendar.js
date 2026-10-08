// The Known World's calendar for the engine.
// Canon counts years After the Conquest (AC) and before it (BC); the novels speak of moons and years and rarely
// give a day. Our modelling convention (not canon): a year of 12 moons of 30 days and 5 closing days (moon 13),
// 365 days in all. Dates read 'Y M D' like Arda's: '298 3 14' is the 14th day of the 3rd moon of 298 AC, and a
// whole day means noon ('298 3 14' and '298 3 14.0' are both noon; use 13.99 for the night before). Negative
// years are BC ('-2 1 1' is 2 BC); there is no year 0. t counts days from the start of 1 AC.
(function (root) {
  const YEAR = 365, MOON = 30, ORD = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  const yearIndex = y => (y > 0 ? y - 1 : y);                 // 1 AC -> 0, 2 BC -> -2 (no year 0)
  const yearOf = i => (i >= 0 ? i + 1 : i);
  function parse(str) {
    const [y, m, d = 1] = String(str).trim().split(/\s+/).map(Number);
    if (!y || !m || m < 1 || m > 13 || d < 1 || d >= (m === 13 ? 6 : 31)) throw new Error('bad date ' + str);
    const di = Math.floor(d), fr = d - di;
    return yearIndex(y) * YEAR + (m - 1) * MOON + (di - 1) + (fr || 0.5);
  }
  function parts(t) {
    const i = Math.floor(t / YEAR), doy = t - i * YEAR, dayN = Math.floor(doy), hour = (doy - dayN) * 24;
    const year = yearOf(i), moon = Math.min(13, Math.floor(dayN / MOON) + 1), day = dayN - (moon - 1) * MOON + 1;
    const era = year > 0 ? year + ' AC' : -year + ' BC';
    const name = moon === 13 ? ORD(day) + ' of the closing days, ' + era : ORD(day) + ' day of the ' + ORD(moon) + ' moon, ' + era;
    return { year, moon, day, hour, era, name, doy: dayN };
  }
  const api = { YEAR, MOON, parse, parts };
  if (typeof module !== 'undefined') module.exports = api; else root.GOT_CALENDAR = api;
})(typeof self !== 'undefined' ? self : this);
