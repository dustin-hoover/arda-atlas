/* ============================================================================
   WX — deterministic weather for Arda. Weather is a pure function of place
   and time, so the timeline can be scrubbed and forecasts read instantly.
   Time t = days since 2 Yule, T.A. 3018 (S.R. 1418), local solar time at the
   Hobbiton meridian.
   ========================================================================== */
const WX = (() => {
'use strict';
const MONTHS = ['Afteryule', 'Solmath', 'Rethe', 'Astron', 'Thrimidge', 'Forelithe', 'Afterlithe', 'Wedmath', 'Halimath', 'Winterfilth', 'Blotmath', 'Foreyule'];
const GREG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const D2R = Math.PI / 180;
const sat = v => v < 0 ? 0 : v > 1 ? 1 : v;
const sstep = (a, b, v) => { const t = sat((v - a) / (b - a)); return t * t * (3 - 2 * t); };
function hash(k, i) { let h = (k * 374761393 + i * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }

function doy(m, d) { return 1 + (m - 1) * 30 + (d - 1) + (m >= 7 ? 3 : 0); }
function parse(str) {
  const [y, m, d] = str.split(' ').map(Number);
  const di = Math.floor(d), fr = d - di;
  return (y - 3018) * 365 + doy(m, di) + (fr || 0.5);
}
function parts(t) {
  const yi = Math.floor(t / 365);
  const r = t - yi * 365;
  const di = Math.floor(r);
  const hour = (r - di) * 24;
  const ta = 3018 + yi;
  let name, month = 0, day = 0;
  if (di === 0) name = '2 Yule';
  else if (di <= 180) { month = Math.floor((di - 1) / 30) + 1; day = (di - 1) % 30 + 1; name = day + ' ' + MONTHS[month - 1]; }
  else if (di === 181) name = '1 Lithe';
  else if (di === 182) name = 'Mid-year\'s Day';
  else if (di === 183) name = '2 Lithe';
  else if (di <= 363) { month = Math.floor((di - 184) / 30) + 7; day = (di - 184) % 30 + 1; name = day + ' ' + MONTHS[month - 1]; }
  else name = '1 Yule';
  return { ta, sr: ta - 1600, di, hour, name, month, day, greg: month ? GREG[month - 1] + ' ' + day : name };
}
function fmtTime(h) { const hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); }

/* season helpers */
function gdoy(t) { const di = ((t % 365) + 365) % 365; return (di - 9 + 365) % 365; }
function declination(t) { return -23.44 * Math.cos(2 * Math.PI * (gdoy(t) + 10) / 365); }
function sunVector(t, lon, lat) {
  const dec = declination(t) * D2R;
  const hour = (((t % 1) + 1) % 1) * 24 + lon / 15;
  const ha = (hour - 12) * 15 * D2R;
  const la = lat * D2R;
  const el = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha));
  const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(la) - Math.sin(la) * Math.cos(ha));
  return { el: el / D2R, az: az / D2R };     // az: 0 = north, clockwise
}
function winterness(t) { return 0.5 + 0.5 * Math.cos(2 * Math.PI * (gdoy(t) - 15) / 365); }

/* ------------------------------ systems ------------------------------ */
const PER = 2.3;
function systems(t) {
  const out = [];
  const w = winterness(t);
  const k0 = Math.floor((t - 11) / PER), k1 = Math.floor(t / PER) + 1;
  for (let k = k0; k <= k1; k++) {
    // cyclone
    const t0 = k * PER + (hash(k, 1) - 0.5) * 1.2;
    const life = 6.5 + hash(k, 2) * 4;
    const dt = t - t0;
    if (dt > -0.2 && dt < life) {
      const lat0 = -300 + hash(k, 4) * 1100 - 300 * w;
      const vx = 470 + hash(k, 5) * 280, vy = 50 + (hash(k, 6) - 0.4) * 240;
      const x = -1450 - hash(k, 3) * 300 + vx * dt, y = lat0 + vy * dt + 50 * Math.sin(dt * 0.9 + k);
      let env = sstep(-0.2, 1.4, dt) * sstep(life, life - 2.2, dt);
      if (x > 430) env *= 1 - 0.35 * sat((x - 430) / 400);
      if (x > 1200) env *= 1 - 0.4 * sat((x - 1200) / 600);
      const depth = (14 + hash(k, 7) * 24) * (0.75 + 0.5 * w);
      out.push({ type: 'L', x, y, sig: 360 + hash(k, 8) * 260, A: -depth * env, env, rot: hash(k, 9) * 0.6 - 0.3 });
    }
    // anticyclone between storms
    const t1 = (k + 0.5) * PER + (hash(k, 11) - 0.5);
    const d1 = t - t1;
    if (d1 > -0.5 && d1 < 8) {
      const x = -1100 + 380 * d1, y = -500 + hash(k, 12) * 700 - 200 * w;
      const env = sstep(-0.5, 1.5, d1) * sstep(8, 5.5, d1);
      out.push({ type: 'H', x, y, sig: 650 + hash(k, 13) * 250, A: (7 + hash(k, 14) * 8) * env, env, rot: 0 });
    }
  }
  // semi-permanent centres
  out.push({ type: 'H', x: -1000, y: -1100 + 250 * (1 - w), sig: 900, A: 9, env: 1, fixed: 1 });
  out.push({ type: 'H', x: 1500, y: 0, sig: 750, A: 13 * w, env: w, fixed: 1 });
  out.push({ type: 'L', x: 1200, y: -1700, sig: 800, A: -7 * (1 - w), env: 1 - w, fixed: 1, rot: 0 });
  return out;
}

function pressure(X, Y, sys, lat) {
  let P = 1013 + 6 * Math.exp(-Math.pow((lat - 33) / 9, 2)) - 5 * Math.exp(-Math.pow((lat - 63) / 9, 2));
  for (const s of sys) {
    const dx = X - s.x, dy = Y - s.y;
    P += s.A * Math.exp(-(dx * dx + dy * dy) / (2 * s.sig * s.sig));
  }
  return P;
}

function distSeg(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const t = sat(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy));
  const qx = ax + vx * t - px, qy = ay + vy * t - py;
  return [Math.sqrt(qx * qx + qy * qy), t];
}

/* static climate at a point: {h, land, arid, cont, mtn, gx, gy, lat} supplied by caller */
const out = { P: 0, u: 0, v: 0, T: 0, C: 0, R: 0, snow: 0, dark: 0, event: '' };
function sample(X, Y, t, st, sys, lore) {
  const lat = st.lat;
  const e = 25;
  const Pc = pressure(X, Y, sys, lat);
  const dPx = (pressure(X + e, Y, sys, lat) - pressure(X - e, Y, sys, lat)) / (2 * e) * 62.14;
  const dPy = (pressure(X, Y + e, sys, lat) - pressure(X, Y - e, sys, lat)) / (2 * e) * 62.14;
  const fcor = Math.sin(0.7854) / Math.max(0.25, Math.sin(Math.abs(lat) * D2R));
  let ug = -8.1 * dPy * fcor, vg = 8.1 * dPx * fcor;
  const ang = (st.land ? 28 : 16) * D2R, red = st.land ? 0.55 : 0.75;
  let u = (ug * Math.cos(ang) - vg * Math.sin(ang)) * red, v = (ug * Math.sin(ang) + vg * Math.cos(ang)) * red;
  const block = 1 - 0.55 * sat(st.mtn * 1.6);
  u *= block; v *= block;
  const spd = Math.sqrt(u * u + v * v);
  if (spd > 34) { u *= 34 / spd; v *= 34 / spd; }

  // clouds
  const w = winterness(t);
  let C = 0.28 + 0.12 * w + 0.18 * (1 - st.cont) - 0.5 * st.arid;
  for (const s of sys) {
    if (s.fixed) {
      const dx = X - s.x, dy = Y - s.y;
      const r2 = (dx * dx + dy * dy) / (s.sig * s.sig);
      C += (s.type === 'H' ? -0.25 : 0.1) * Math.exp(-r2) * s.env;
      continue;
    }
    const dx = X - s.x, dy = Y - s.y;
    const r2 = (dx * dx + dy * dy) / (s.sig * s.sig);
    if (r2 > 9) continue;
    if (s.type === 'H') { C -= 0.45 * Math.exp(-r2 / 1.4) * s.env; continue; }
    const S = s.sig, en = s.env;
    // comma head
    C += 0.75 * Math.exp(-((dx + 0.25 * S) * (dx + 0.25 * S) + (dy - 0.1 * S) * (dy - 0.1 * S)) / (0.45 * S * S)) * en;
    // warm front to the east-south-east
    const wa = -0.35 + s.rot;
    const [dw, tw] = distSeg(X, Y, s.x, s.y, s.x + Math.cos(wa) * 1.3 * S, s.y + Math.sin(wa) * 1.3 * S);
    C += 0.7 * Math.exp(-Math.pow(dw / (0.26 * S), 2)) * (1 - 0.5 * tw) * en;
    // curved cold front trailing south-west
    const ca = -1.95 + s.rot;
    const mx = s.x + Math.cos(ca) * 0.9 * S + 0.25 * S, my = s.y + Math.sin(ca) * 0.9 * S;
    const [dc1] = distSeg(X, Y, s.x + 0.2 * S, s.y - 0.1 * S, mx, my);
    const [dc2, tc2] = distSeg(X, Y, mx, my, mx + Math.cos(ca - 0.35) * 0.9 * S, my + Math.sin(ca - 0.35) * 0.9 * S);
    const dc = Math.min(dc1, dc2);
    C += 0.85 * Math.exp(-Math.pow(dc / (0.14 * S), 2)) * en * (1 - 0.4 * tc2);
    // warm sector haze, dry slot behind the cold front
    if (dx > -0.2 * S && dy < 0) C += 0.18 * Math.exp(-r2 / 1.6) * en;
    if (dx < -0.3 * S && dy < -0.2 * S) C -= 0.25 * Math.exp(-r2 / 1.2) * en;
  }
  // orographic lift and lee drying
  const lift = (u * st.gx + v * st.gy) * 55;
  C += sat(lift) * 0.45 - sat(-lift) * 0.3;
  // afternoon convection in summer over warm land
  const hour = (((t % 1) + 1) % 1) * 24 + st.lon / 15;
  const aft = Math.exp(-Math.pow((((hour % 24) + 24) % 24 - 15) / 3.5, 2));
  C += st.land * 0.3 * (1 - w) * aft * (1 - st.arid) * sat(0.5 + GEN.noise(X * 0.02 + t * 3, Y * 0.02));
  // travelling texture
  C += 0.22 * GEN.fbm(X / 260 - t * 1.4, Y / 260 + t * 0.2, 3);
  C = sat(C);

  // temperature
  let T = GEN.tempAt(lat, st.h);
  const g = gdoy(t);
  const A = (6 + 11 * st.cont) * sat((Math.abs(lat) - 8) / 42);
  T += A * Math.cos(2 * Math.PI * (g - 200) / 365);
  const D = (3 + 6 * st.cont * (1 - st.arid * 0) + 5 * st.arid) * (1 - 0.65 * C);
  T += D * Math.cos(2 * Math.PI * (hour - 15) / 24);
  T += Math.max(-7, Math.min(7, v * 0.33));

  // precipitation (mm/h)
  let R = sat((C - 0.58) / 0.42);
  R = R * R * 7 * (1 - 0.8 * st.arid) + sat(lift) * 2.5 * sat(C - 0.4);
  if (R < 0.05) R = 0;

  // lore events
  out.dark = 0; out.event = '';
  if (lore) for (const L of lore) {
    if (t < L.t0 || t > L.t1) continue;
    const d = Math.hypot(X - L.x, Y - L.y);
    if (L.kind === 'darkness') {
      const prog = sat((t - L.t0) / 1.5);
      const lift2 = sstep(L.t1 - 0.5, L.t1, t);
      const reach = L.r * (0.4 + 1.2 * prog) * (1 - lift2 * 0.9);
      const eastBias = (X - L.x) > -reach ? 1 : 0.6;
      const k = sstep(reach, reach * 0.5, d) * eastBias;
      out.dark = Math.max(out.dark, k);
      if (k > 0.3) out.event = L.name;
      C = Math.max(C, k);
      T -= 3 * k;
    } else if (L.kind === 'smoke') {
      const k = sstep(L.r, 0, d);
      out.dark = Math.max(out.dark, k * 0.5);
    } else if (d < L.r) {
      const k = sstep(L.r, L.r * 0.3, d);
      C = Math.max(C, k); R = Math.max(R, 6 * k);
      if (L.kind === 'snow') T = Math.min(T, -6);
      if (L.kind === 'storm') { u *= 1.5; v *= 1.5; }
      if (k > 0.3) out.event = L.name;
    }
  }
  out.P = Pc; out.u = u; out.v = v; out.T = T; out.C = C; out.R = R;
  out.snow = T < 0.8 ? 1 : T < 2.5 ? (2.5 - T) / 1.7 : 0;
  return out;
}

function describe(o) {
  const spd = Math.hypot(o.u, o.v);
  let sky;
  if (o.dark > 0.4) sky = 'Darkness out of Mordor';
  else if (o.R > 4) sky = o.snow > 0.5 ? 'Heavy snow' : 'Heavy rain';
  else if (o.R > 0.8) sky = o.snow > 0.5 ? 'Snow' : (o.C > 0.9 && o.T > 14 ? 'Thundery rain' : 'Rain');
  else if (o.R > 0) sky = o.snow > 0.5 ? 'Light snow' : 'Drizzle';
  else if (o.C > 0.8) sky = 'Overcast';
  else if (o.C > 0.55) sky = 'Mostly cloudy';
  else if (o.C > 0.3) sky = 'Partly cloudy';
  else sky = 'Clear';
  const dir = ((Math.atan2(-o.u, -o.v) * 180 / Math.PI) + 360) % 360;
  const pts = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return { sky, windFrom: pts[Math.round(dir / 22.5) % 16], windDir: dir, kmh: spd * 3.6, mph: spd * 2.237 };
}

return { MONTHS, parse, parts, fmtTime, declination, sunVector, winterness, systems, sample, describe, gdoy };
})();
if (typeof self !== 'undefined') self.WX = WX;
