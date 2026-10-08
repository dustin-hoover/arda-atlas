// node worlds/got/calendar.test.js
const assert = require('assert');
const C = require('./calendar.js');

assert.strictEqual(C.parse('1 1 1'), 0.5, 'noon of the first day of 1 AC');
assert.strictEqual(C.parse('1 1 1.0'), 0.5, 'a whole day is noon');
assert.strictEqual(C.parse('1 1 1.25'), 0.25, 'a fraction is that time of day');
assert.strictEqual(C.parse('2 1 1') - C.parse('1 1 1'), 365, 'a year is 365 days');
assert.strictEqual(C.parse('1 2 1') - C.parse('1 1 1'), 30, 'a moon is 30 days');
assert.strictEqual(C.parse('1 1 1') - C.parse('-1 1 1'), 365, 'no year 0 between 1 BC and 1 AC');
assert.ok(C.parse('298 3 13.99') < C.parse('298 3 14'), 'the night before');
assert.throws(() => C.parse('298 13 6'), /bad date/, 'only five closing days');
assert.throws(() => C.parse('0 1 1'), /bad date/, 'there is no year 0');

for (const s of ['298 1 1', '298 6 30', '298 13 5', '299 7 15.75', '-2 4 10', '1 1 1', '-1 13 5']) {
  const p = C.parts(C.parse(s)), [y, m, d] = s.split(' ').map(Number);
  assert.strictEqual(p.year, y, s + ' year'); assert.strictEqual(p.moon, m, s + ' moon'); assert.strictEqual(p.day, Math.floor(d), s + ' day');
}
assert.strictEqual(C.parts(C.parse('298 3 14')).name, '14th day of the 3rd moon, 298 AC');
assert.strictEqual(C.parts(C.parse('298 13 2')).name, '2nd of the closing days, 298 AC');
assert.strictEqual(C.parts(C.parse('-2 1 1')).era, '2 BC');
assert.strictEqual(Math.round(C.parts(C.parse('298 3 14.75')).hour), 18);
console.log('calendar ok');
