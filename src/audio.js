/* ============================================================================
   ARDA SOUND — an original, generative score and ambience made with Web Audio.
   The music follows the region in view; the ambience follows the weather.
   ========================================================================== */
(function () {
'use strict';
const A = { on: false, music: 0.7, amb: 0.6, mood: null, ctx: null };
window.ARDA_AUDIO = A;

const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
const MODES = { ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10] };
/* Each mood: title, root (MIDI), mode, bpm, chord degrees, instruments. */
const MOODS = {
  shire: { title: 'The Green Hills', root: 62, mode: 'ionian', bpm: 92, prog: [0, 3, 0, 4, 5, 3, 0, 4], lead: 'flute', arp: 'pluck', pad: 0.5, drone: 0, drum: 0, swing: 0.08, density: 0.75 },
  elven: { title: 'Halls of the Firstborn', root: 64, mode: 'lydian', bpm: 58, prog: [0, 1, 5, 3, 0, 4, 1, 0], lead: 'choir', arp: 'harp', pad: 0.9, drone: 0.2, drum: 0, swing: 0, density: 0.5 },
  rohan: { title: 'Horns of the Mark', root: 62, mode: 'dorian', bpm: 80, prog: [0, 6, 3, 0, 0, 6, 4, 0], lead: 'fiddle', arp: 'pluck', pad: 0.6, drone: 0.6, drum: 0.7, swing: 0, density: 0.65 },
  gondor: { title: 'The Tower of Guard', root: 60, mode: 'aeolian', bpm: 66, prog: [0, 5, 2, 6, 0, 3, 4, 4], lead: 'horn', arp: 'harp', pad: 0.8, drone: 0.3, drum: 0.5, swing: 0, density: 0.45 },
  mordor: { title: 'The Shadow', root: 48, mode: 'phrygian', bpm: 48, prog: [0, 1, 0, 6, 0, 1, 5, 1], lead: 'choirLow', arp: null, pad: 0.7, drone: 1, drum: 0.9, swing: 0, density: 0.3 },
  dwarf: { title: 'Under the Mountain', root: 50, mode: 'aeolian', bpm: 62, prog: [0, 5, 6, 0, 0, 3, 4, 0], lead: 'choirLow', arp: 'anvil', pad: 0.6, drone: 0.8, drum: 0.6, swing: 0, density: 0.4 },
  wild: { title: 'The Wild Lands', root: 57, mode: 'dorian', bpm: 60, prog: [0, 3, 6, 0, 3, 4, 0, 6], lead: 'flute', arp: 'harp', pad: 0.7, drone: 0.4, drum: 0, swing: 0, density: 0.35 },
  sea: { title: 'The Great Sea', root: 55, mode: 'mixolydian', bpm: 52, prog: [0, 6, 3, 0, 4, 3, 6, 0], lead: 'choir', arp: 'harp', pad: 1, drone: 0.3, drum: 0, swing: 0, density: 0.3 },
  world: { title: 'Arda Round', root: 57, mode: 'lydian', bpm: 54, prog: [0, 4, 5, 3, 0, 1, 4, 0], lead: 'choir', arp: 'harp', pad: 1, drone: 0.2, drum: 0, swing: 0, density: 0.3 },
};
A.MOODS = MOODS;

let ctx, master, musicBus, ambBus, verb, verbSend, comp;
function init() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  A.ctx = ctx;
  comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
  master = ctx.createGain(); master.gain.value = 0.9;
  master.connect(comp); comp.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = A.music * 0.55; musicBus.connect(master);
  ambBus = ctx.createGain(); ambBus.gain.value = A.amb * 0.8; ambBus.connect(master);
  // generated hall reverb
  verb = ctx.createConvolver();
  const len = ctx.sampleRate * 4.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  verb.buffer = ir;
  verbSend = ctx.createGain(); verbSend.gain.value = 0.55;
  verbSend.connect(verb); verb.connect(musicBus);
  initAmbience();
}
function out(node, wet = 0.5) {
  const dry = ctx.createGain(); dry.gain.value = 1 - wet * 0.4; node.connect(dry); dry.connect(musicBus);
  const w = ctx.createGain(); w.gain.value = wet; node.connect(w); w.connect(verbSend);
}
function env(g, t, a, peak, hold, r) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.setValueAtTime(peak, t + a + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + r);
}

/* ---------------- instruments ---------------- */
const INST = {
  pad(freqs, t, dur, vol) {
    const g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(1100, t + dur * 0.5); f.frequency.linearRampToValueAtTime(600, t + dur); f.Q.value = 0.4;
    f.connect(g); env(g, t, dur * 0.35, vol, dur * 0.35, dur * 0.6); out(g, 0.7);
    for (const fr of freqs) for (const d of [-7, 6]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = d; o.connect(f); o.start(t); o.stop(t + dur * 1.35); }
  },
  pluck(fr, t, vol) {
    const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(700, t + 0.6);
    f.connect(g); env(g, t, 0.004, vol, 0, 0.9); out(g, 0.35);
    for (const [ty, m] of [['triangle', 1], ['sine', 2]]) { const o = ctx.createOscillator(); o.type = ty; o.frequency.value = fr * m; const og = ctx.createGain(); og.gain.value = m === 1 ? 1 : 0.25; o.connect(og); og.connect(f); o.start(t); o.stop(t + 1.1); }
  },
  harp(fr, t, vol) {
    const g = ctx.createGain(); env(g, t, 0.003, vol, 0, 2.4); out(g, 0.65);
    for (const [m, a] of [[1, 1], [2, 0.35], [3, 0.12], [4.01, 0.06]]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = fr * m; const og = ctx.createGain(); og.gain.setValueAtTime(a, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 2.4 / m); o.connect(og); og.connect(g); o.start(t); o.stop(t + 2.5); }
  },
  anvil(fr, t, vol) {
    const g = ctx.createGain(); env(g, t, 0.002, vol * 0.5, 0, 1.4); out(g, 0.5);
    for (const m of [1, 2.76, 5.4, 8.93]) { const o = ctx.createOscillator(); o.frequency.value = fr * 2 * m; o.connect(g); o.start(t); o.stop(t + 1.5); }
  },
  flute(fr, t, dur, vol) {
    const g = ctx.createGain(); env(g, t, 0.09, vol, Math.max(0.05, dur - 0.2), 0.35); out(g, 0.55);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = fr;
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = fr; const g2 = ctx.createGain(); g2.gain.value = 0.18;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(fr * 0.006, t + 0.35); lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    o.connect(g); o2.connect(g2); g2.connect(g);
    const n = noiseSrc(), nb = ctx.createBiquadFilter(), ng = ctx.createGain(); nb.type = 'bandpass'; nb.frequency.value = fr * 2; nb.Q.value = 3; ng.gain.value = 0.05; n.connect(nb); nb.connect(ng); ng.connect(g);
    for (const x of [o, o2, lfo, n]) { x.start(t); x.stop(t + dur + 0.5); }
  },
  fiddle(fr, t, dur, vol) {
    const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400; f.Q.value = 1.5;
    const f2 = ctx.createBiquadFilter(); f2.type = 'peaking'; f2.frequency.value = 1100; f2.gain.value = 6;
    f.connect(f2); f2.connect(g); env(g, t, 0.12, vol * 0.55, Math.max(0.05, dur - 0.2), 0.3); out(g, 0.5);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.8; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(fr * 0.01, t + 0.3); lfo.connect(lg); lg.connect(o.frequency);
    o.connect(f); o.start(t); lfo.start(t); o.stop(t + dur + 0.4); lfo.stop(t + dur + 0.4);
  },
  horn(fr, t, dur, vol) {
    const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(1500, t + 0.2); f.frequency.linearRampToValueAtTime(900, t + dur);
    f.connect(g); env(g, t, 0.18, vol * 0.6, Math.max(0.05, dur - 0.25), 0.5); out(g, 0.6);
    for (const d of [-4, 4]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = d; o.connect(f); o.start(t); o.stop(t + dur + 0.6); }
  },
  choir(fr, t, dur, vol, low) {
    const g = ctx.createGain(); env(g, t, 0.6, vol * 0.5, Math.max(0.1, dur - 0.6), 1.1); out(g, 0.8);
    const forms = low ? [[500, 0.9], [850, 0.5], [2400, 0.12]] : [[800, 0.9], [1150, 0.55], [2800, 0.15]];
    for (const d of [-9, 0, 8]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = d;
      for (const [ff, a] of forms) { const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = ff; b.Q.value = 6; const bg = ctx.createGain(); bg.gain.value = a; o.connect(b); b.connect(bg); bg.connect(g); }
      o.start(t); o.stop(t + dur + 1.3);
    }
  },
  drum(t, vol, pitch = 1) {
    const g = ctx.createGain(); env(g, t, 0.003, vol, 0, 0.7); out(g, 0.4);
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(95 * pitch, t); o.frequency.exponentialRampToValueAtTime(42 * pitch, t + 0.35); o.connect(g); o.start(t); o.stop(t + 0.8);
    const n = noiseSrc(), nf = ctx.createBiquadFilter(), ng = ctx.createGain(); nf.type = 'lowpass'; nf.frequency.value = 900; ng.gain.setValueAtTime(vol * 0.3, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); n.connect(nf); nf.connect(ng); ng.connect(g); n.start(t); n.stop(t + 0.2);
  },
};
let NOISE = null;
function noiseSrc() {
  if (!NOISE) { const len = ctx.sampleRate * 2; NOISE = ctx.createBuffer(1, len, ctx.sampleRate); const d = NOISE.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; }
  const s = ctx.createBufferSource(); s.buffer = NOISE; s.loop = true; return s;
}

/* ---------------- composer ---------------- */
let seedN = 1;
const rnd = () => { seedN = (seedN * 16807) % 2147483647; return (seedN - 1) / 2147483646; };
function deg(m, d, oct = 0) { const sc = MODES[m.mode]; const o = Math.floor(d / 7); const i = ((d % 7) + 7) % 7; return m.root + sc[i] + 12 * (o + oct); }
let bar = 0, nextBarT = 0, motif = null, droneNodes = [], cur = null, fadeTo = null;
function newMotif(m) {
  const rhythms = [[2, 1, 1, 4], [1, 1, 2, 2, 2], [3, 1, 2, 2], [2, 2, 1, 1, 2], [4, 2, 2], [1, 1, 1, 1, 4]];
  const r = rhythms[Math.floor(rnd() * rhythms.length)];
  let d = [0, 2, 4][Math.floor(rnd() * 3)];
  const notes = r.map(len => { const n = { d, len }; d += [-2, -1, 1, 1, 2, -3, 3][Math.floor(rnd() * 7)]; d = Math.max(-2, Math.min(9, d)); return n; });
  return notes;
}
function setDrone(m) {
  for (const n of droneNodes) { try { n.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 1.2); n.o.forEach(o => o.stop(ctx.currentTime + 5)); } catch (e) { } }
  droneNodes = [];
  if (!m.drone) return;
  const g = ctx.createGain(); g.gain.value = 0.0001; g.gain.setTargetAtTime(0.09 * m.drone, ctx.currentTime, 2.5); out(g, 0.6);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.connect(g);
  const os = [deg(m, 0, -1), deg(m, 4, -1), deg(m, 0, -2)].map((n, i) => { const o = ctx.createOscillator(); o.type = i === 2 ? 'sine' : 'triangle'; o.frequency.value = NOTE(n); o.detune.value = i * 3; o.connect(f); o.start(); return o; });
  droneNodes.push({ g, o: os });
}
function scheduleBar(t) {
  const m = cur; if (!m) return;
  const beat = 60 / m.bpm, barLen = beat * 4;
  const ch = m.prog[bar % m.prog.length];
  const chord = [deg(m, ch), deg(m, ch + 2), deg(m, ch + 4)];
  // pad on every other bar, held for two
  if (bar % 2 === 0 && m.pad) INST.pad(chord.map(n => NOTE(n - 12)), t, barLen * 2, 0.05 * m.pad);
  // bass
  if (m.bpm > 60 && bar % 2 === 0) INST.pluck(NOTE(chord[0] - 24), t, 0.12);
  // arpeggio
  if (m.arp) {
    const pat = [0, 1, 2, 1, 0, 2, 1, 2];
    for (let i = 0; i < 8; i++) {
      if (rnd() > m.density + 0.25) continue;
      const sw = i % 2 ? m.swing * beat : 0;
      const n = chord[pat[i]] + (i >= 4 && rnd() < 0.3 ? 12 : 0);
      INST[m.arp](NOTE(n), t + i * beat / 2 + sw, m.arp === 'pluck' ? 0.1 : 0.07);
    }
  }
  // melody: a motif, repeated and varied across a 4-bar phrase
  if (bar % 8 === 0 || !motif) motif = newMotif(m);
  const phrasePos = bar % 4;
  if (phrasePos !== 3 && rnd() < 0.55 + m.density * 0.4) {
    let tt = t; const shift = phrasePos === 2 ? (rnd() < 0.5 ? 2 : -1) : 0;
    const unit = barLen / 8;
    for (const n of motif) {
      const midi = deg(m, n.d + ch * (phrasePos === 1 ? 0 : 0) + shift, m.lead === 'choirLow' ? -1 : 0);
      const dur = n.len * unit;
      if (m.lead === 'choir' || m.lead === 'choirLow') INST.choir(NOTE(midi), tt, dur * 1.1, 0.07, m.lead === 'choirLow');
      else INST[m.lead](NOTE(midi + 12), tt, dur * 0.95, m.lead === 'flute' ? 0.08 : 0.07);
      tt += dur;
      if (tt > t + barLen - 0.01) break;
    }
  }
  // percussion
  if (m.drum) {
    if (m === MOODS.mordor || m === MOODS.dwarf) { INST.drum(t, 0.22 * m.drum, 0.8); if (bar % 2) INST.drum(t + beat * 2.5, 0.12 * m.drum, 0.8); }
    else if (m === MOODS.rohan) { for (const b of [0, 1.5, 2, 3]) INST.drum(t + b * beat, (b === 0 ? 0.18 : 0.09) * m.drum, 1.1); }
    else if (bar % 2 === 0) { INST.drum(t, 0.16 * m.drum, 0.9); INST.drum(t + beat * 3.5, 0.07 * m.drum, 0.9); }
  }
  bar++;
  return barLen;
}
let timer = 0;
function tickMusic() {
  if (!A.on || !ctx) return;
  if (fadeTo && fadeTo !== cur) {
    cur = fadeTo; bar = 0; motif = null; seedN = 1 + Math.floor(Math.random() * 1e6); setDrone(cur);
    if (A.onMood) A.onMood(cur);
  }
  while (nextBarT < ctx.currentTime + 0.4) {
    if (nextBarT < ctx.currentTime) nextBarT = ctx.currentTime + 0.05;
    nextBarT += scheduleBar(nextBarT) || 1;
  }
}

/* ---------------- ambience ---------------- */
let wind, windF, windG, rain, rainG, birdsOn = 0, lastBird = 0;
function initAmbience() {
  wind = noiseSrc(); windF = ctx.createBiquadFilter(); windF.type = 'bandpass'; windF.frequency.value = 500; windF.Q.value = 0.7;
  windG = ctx.createGain(); windG.gain.value = 0.0001; wind.connect(windF); windF.connect(windG); windG.connect(ambBus); wind.start();
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.13; lg.gain.value = 260; lfo.connect(lg); lg.connect(windF.frequency); lfo.start();
  rain = noiseSrc(); const rf = ctx.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 1800; rainG = ctx.createGain(); rainG.gain.value = 0.0001;
  rain.connect(rf); rf.connect(rainG); rainG.connect(ambBus); rain.start();
}
function bird(t) {
  const g = ctx.createGain(); g.connect(ambBus);
  const o = ctx.createOscillator(); o.type = 'sine';
  const base = 2400 + Math.random() * 2200, n = 2 + Math.floor(Math.random() * 5);
  g.gain.setValueAtTime(0.0001, t);
  for (let i = 0; i < n; i++) {
    const s = t + i * 0.11;
    o.frequency.setValueAtTime(base, s); o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.5), s + 0.07);
    g.gain.linearRampToValueAtTime(0.025, s + 0.01); g.gain.linearRampToValueAtTime(0.0001, s + 0.08);
  }
  o.connect(g); o.start(t); o.stop(t + n * 0.11 + 0.1);
}
A.setWeather = w => {
  if (!ctx) return;
  const now = ctx.currentTime, spd = w ? Math.hypot(w.u, w.v) : 3;
  windG.gain.setTargetAtTime(0.012 + Math.min(0.14, spd * spd * 0.0009), now, 1.5);
  windF.frequency.setTargetAtTime(350 + spd * 30, now, 2);
  rainG.gain.setTargetAtTime(w && w.R > 0.05 && w.snow < 0.5 ? Math.min(0.2, 0.03 + w.R * 0.035) : 0.0001, now, 1.5);
  birdsOn = w && w.day && !w.dark && w.T > 4 && w.R < 0.3 && w.land ? (w.forest ? 1 : 0.5) : 0;
};
function tickAmbience() {
  if (!A.on || !ctx) return;
  if (birdsOn && ctx.currentTime - lastBird > 1.2 + Math.random() * 5 / birdsOn) { lastBird = ctx.currentTime; bird(ctx.currentTime + 0.05); }
}

/* ---------------- public ---------------- */
A.setMood = key => { const m = MOODS[key] || MOODS.wild; if (m !== fadeTo) fadeTo = m; A.mood = key; };
A.start = async () => {
  init();
  if (ctx.state !== 'running') await ctx.resume();
  A.on = true;
  master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.5);
  nextBarT = ctx.currentTime + 0.1;
  if (!timer) timer = setInterval(() => { tickMusic(); tickAmbience(); }, 60);
};
A.stop = () => {
  A.on = false;
  if (!ctx) return;
  master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
  setTimeout(() => { if (!A.on && ctx) ctx.suspend(); }, 1500);
};
A.setNear = k => { A.near = k; if (ambBus) ambBus.gain.setTargetAtTime(A.amb * 0.8 * k, ctx.currentTime, 0.8); };
A.setMusic = v => { A.music = v; if (musicBus) musicBus.gain.setTargetAtTime(v * 0.55, ctx.currentTime, 0.2); };
A.setAmb = v => { A.amb = v; if (ambBus) ambBus.gain.setTargetAtTime(v * 0.8 * (A.near ?? 1), ctx.currentTime, 0.2); };
})();
