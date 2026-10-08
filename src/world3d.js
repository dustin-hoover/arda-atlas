/* ============================================================================
   WORLD3D — landmarks, town detail, people and the dwarf-halls for the ground view.
   Appended to ground.js by build.js, so it shares that module's THREE, MI, G and groundAt.
   ========================================================================== */

/* ---------------- geometry helpers ---------------- */
const lin = c => (typeof c === 'number' ? new THREE.Color(c) : new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace));
const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
const cy = (rt, rb, h, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg).translate(0, h / 2, 0);
const cn = (r, h, seg = 8) => new THREE.ConeGeometry(r, h, seg).translate(0, h / 2, 0);
const sph = (r, ws = 8, hs = 6) => new THREE.SphereGeometry(r, ws, hs);
// a geometry placed in a house's frame: local offset (lx, ly, lz), then turned by ang about the house centre
const at = (g, cx, y, cz, ang, lx = 0, ly = 0, lz = 0) => g.translate(lx, ly, lz).rotateY(ang).translate(cx, y, cz);

/* Merge geometries into one, painting each part a flat colour. Parts: [geometry, colour, extra?].
   extra = { part, pivot } fills the aPart/aPivot attributes used by the walking shader. */
function merge(parts, withParts) {
  let n = 0;
  const gs = parts.map(([g]) => { const q = g.index ? g.toNonIndexed() : g; if (!q.attributes.normal) q.computeVertexNormals(); n += q.attributes.position.count; return q; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const prt = withParts ? new Float32Array(n) : null, piv = withParts ? new Float32Array(n) : null;
  let o = 0;
  gs.forEach((g, k) => {
    const c = lin(parts[k][1]), ex = parts[k][2] || {}, cnt = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    for (let i = 0; i < cnt; i++) { col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b; if (prt) { prt[o + i] = ex.part || 0; piv[o + i] = ex.pivot || 0; } }
    o += cnt;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (prt) { out.setAttribute('aPart', new THREE.BufferAttribute(prt, 1)); out.setAttribute('aPivot', new THREE.BufferAttribute(piv, 1)); }
  return out;
}
function glowTexture(inner, outer) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(0.25, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function glow(inner, outer, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(inner, outer), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  s.scale.setScalar(size); return s;
}
const vcMat = (o = {}) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.85 }, o));

/* ---------------- landmarks ---------------- */
// Orthanc: four many-sided piers fused into one, opening near the summit into four horns (~500 ft).
function orthanc() {
  const k = 0x1b1b21, P = [[bx(58, 3, 58), 0x1a1a1e], [bx(48, 3, 48).translate(0, 3, 0), 0x1a1a1e], [bx(20, 128, 20).translate(0, 6, 0), k]];
  for (const [x, z] of [[-8, -8], [8, -8], [8, 8], [-8, 8]]) {
    P.push([cy(8.5, 10.5, 128, 7).translate(x, 6, z), k]);
    const horn = new THREE.ConeGeometry(6.5, 36, 7).translate(0, 18, 0).rotateZ(-Math.sign(x) * 0.2).rotateX(Math.sign(z) * 0.2);
    P.push([horn.translate(x * 1.2, 133, z * 1.2), k]);
  }
  P.push([bx(22, 1.2, 22).translate(0, 134, 0), 0x26262c]);
  P.push([bx(7, 11, 1.2).translate(0, 6, 19.2), 0x030304], [bx(14, 6, 10).translate(0, 0, 26), 0x1a1a1e], [bx(10, 3, 6).translate(0, 6, 22), 0x1a1a1e]);
  const g = new THREE.Group();
  const m = new THREE.Mesh(merge(P), vcMat({ roughness: 0.32, metalness: 0.15 }));
  m.castShadow = m.receiveShadow = true; g.add(m);
  return g;
}
// Barad-dûr: battered tiers of black stone, a ring of buttress towers, the iron crown and the Eye.
function baraddur() {
  const d = 0x161315, d2 = 0x1f1b1c, iron = 0x2c2522, P = [];
  const tier = (rb, rt, h, y) => new THREE.CylinderGeometry(rt, rb, h, 4).rotateY(Math.PI / 4).translate(0, y + h / 2, 0);
  P.push([tier(240, 215, 50, 0), d], [tier(190, 165, 60, 50), d2], [tier(145, 120, 70, 110), d], [tier(82, 54, 240, 180), d2], [tier(54, 30, 110, 420), d]);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + 0.2, r = i % 2 ? 112 : 96, h = 150 + (i % 3) * 60;
    P.push([cy(13, 19, h, 6).translate(Math.cos(a) * r, 180, Math.sin(a) * r), d2], [cn(17, 36, 6).translate(Math.cos(a) * r, 180 + h, Math.sin(a) * r), iron]);
  }
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2, r = 200;
    P.push([cy(18, 24, 120, 6).translate(Math.cos(a) * r, 0, Math.sin(a) * r), d], [cn(22, 42, 6).translate(Math.cos(a) * r, 120, Math.sin(a) * r), iron]);
  }
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; P.push([cn(3.5, 22, 5).translate(Math.cos(a) * 44, 420, Math.sin(a) * 44), iron]); }
  for (const s of [-1, 1]) P.push([new THREE.ConeGeometry(9, 74, 5).translate(0, 37, 0).rotateZ(-s * 0.2).translate(s * 17, 524, 0), iron]);
  P.push([bx(30, 40, 6).translate(0, 0, 242), 0x050405]);                       // the great gate
  const g = new THREE.Group();
  const m = new THREE.Mesh(merge(P), vcMat({ roughness: 0.75, metalness: 0.2 }));
  m.castShadow = m.receiveShadow = true; g.add(m);
  const eye = new THREE.Mesh(sph(6, 16, 10).scale(0.6, 1, 0.6), new THREE.MeshBasicMaterial({ color: 0xffb040 }));
  eye.position.set(0, 562, 0); g.add(eye);
  const halo = glow('rgba(255,170,60,1)', 'rgba(255,40,0,0)', 120); halo.position.copy(eye.position); g.add(halo);
  const light = new THREE.PointLight(0xff6a20, 4e5, 4000, 2); light.position.copy(eye.position); g.add(light);
  g.userData.update = (dt, t) => { const f = 0.85 + 0.15 * Math.sin(t * 7.3) * Math.sin(t * 2.1); halo.scale.setScalar(110 * f + 20); light.intensity = 4e5 * f; };
  return g;
}
// Minas Morgul: the pale tower whose top turns slowly, glowing with a corpse-light.
function morgul() {
  const c = 0xa6c2b4, c2 = 0x8ba79a, P = [[cy(12, 14, 70, 10), c], [bx(30, 3, 30).translate(0, 70, 0), c2], [cy(9, 10, 32, 10).translate(0, 72, 0), c], [cy(7, 8, 18, 10).translate(0, 104, 0), c2]];
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; P.push([cn(1.4, 9, 5).translate(Math.cos(a) * 7.5, 122, Math.sin(a) * 7.5), c2]); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; P.push([bx(3, 4, 3).translate(Math.cos(a) * 15, 70, Math.sin(a) * 15), c2]); }
  P.push([bx(9, 14, 1.5).translate(0, 0, 14), 0x0a100e]);
  const g = new THREE.Group();
  const m = new THREE.Mesh(merge(P), vcMat({ roughness: 0.6, emissive: 0x3c6a58, emissiveIntensity: 0.35 }));
  m.castShadow = true; g.add(m);
  const top = glow('rgba(190,255,220,0.9)', 'rgba(60,140,110,0)', 40); top.position.y = 112; g.add(top);
  g.userData.update = (dt, t) => { top.material.opacity = 0.6 + 0.4 * Math.sin(t * 0.7); };
  return g;
}
// The White Tower of Ecthelion and the Citadel on the seventh circle.
function ecthelion() {
  const w = 0xf2f0ea, w2 = 0xdedad2, P = [[bx(64, 14, 44), w2], [bx(44, 3, 30).translate(0, 14, 0), w], [cy(6.5, 8, 84, 12).translate(0, 14, 0), w], [cy(8.5, 8.5, 3, 12).translate(0, 96, 0), w2], [cn(4, 26, 12).translate(0, 99, 0), 0xf8f8f6]];
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; P.push([bx(1.4, 2.4, 1.4).translate(Math.cos(a) * 8, 99, Math.sin(a) * 8), w]); }
  P.push([cy(0.3, 0.3, 14, 4).translate(0, 125, 0), 0xc8c8c8]);
  const tree = merge([[cy(0.5, 0.8, 5, 6), 0xe8e6e0], [sph(3, 8, 6).scale(1, 0.6, 1).translate(0, 6, 0), 0xe6e8ea]]);      // the White Tree
  const g = new THREE.Group();
  const m = new THREE.Mesh(merge(P), vcMat({ roughness: 0.55 }));
  m.castShadow = m.receiveShadow = true; g.add(m);
  const t = new THREE.Mesh(tree, vcMat({ roughness: 0.9 })); t.position.set(0, 17, 16); g.add(t);
  return g;
}
// The great Gate of Erebor in the mountain's southern face, kept by two carven kings.
function ereborGate() {
  const st = 0x6f6a62, st2 = 0x5c5850, rock = 0x625d55, P = [[bx(40, 52, 10).translate(0, -4, -9), st2], [bx(24, 38, 4).translate(0, 0, -4.6), 0x050404],
    [bx(5, 42, 5).translate(-14.5, 0, -3), st], [bx(5, 42, 5).translate(14.5, 0, -3), st], [bx(36, 7, 6).translate(0, 40, -3), st], [cn(20, 10, 4).rotateY(Math.PI / 4).scale(1, 1, 0.3).translate(0, 47, -3), st],
    [bx(34, 1.5, 46).translate(0, -1.2, 18), st2]];
  // the mountain's flank: a rough mass of fallen and living rock behind the carven face
  for (let i = 0; i < 16; i++) {
    const a = (i / 15 - 0.5) * 2.4, r = 34 + 22 * Math.abs(Math.sin(i * 2.3)), h = 40 + 30 * Math.abs(Math.cos(i * 1.7));
    P.push([new THREE.IcosahedronGeometry(1, 0).scale(r * 0.75, h, r * 0.6).rotateY(i).translate(Math.sin(a) * 58, h * 0.25, -38 - Math.cos(a) * 26), i % 2 ? rock : st2]);
  }
  for (const s of [-1, 1]) {
    const x = s * 32;
    P.push([bx(13, 9, 13).translate(x, 0, 0), st2], [bx(10, 26, 8).translate(x, 9, 0), st], [bx(13, 9, 9).translate(x, 33, 0), st],
      [bx(6.5, 7, 6).translate(x, 42, 0), st], [cn(5, 6, 4).rotateY(Math.PI / 4).translate(x, 49, 0), st2], [bx(5, 10, 2).translate(x, 31, 4.5), st2],
      [bx(2.4, 30, 2.4).translate(x + s * 6.5, 6, 2), st2], [bx(9, 6, 2).translate(x + s * 6.5, 33, 2), st2]);     // beard, axe-haft and blade
  }
  const g = new THREE.Group();
  const m = new THREE.Mesh(merge(P), vcMat({ roughness: 0.9 }));
  m.castShadow = m.receiveShadow = true; g.add(m);
  const lamp = glow('rgba(255,190,110,0.9)', 'rgba(255,120,40,0)', 16); lamp.position.set(0, 10, -2); g.add(lamp);
  return g;
}
// Ravenhill: the dwarves' square guard-room on the southern spur, with its stair and the ravens' ledge.
function ravenhill() {
  const st = 0x77716a, st2 = 0x5e5952, P = [[bx(14, 9, 14), st2], [bx(11, 7, 11).translate(0, 9, 0), st], [bx(12, 1, 12).translate(0, 16, 0), st2]];
  for (const [x, z] of [[-5.4, -5.4], [5.4, -5.4], [-5.4, 5.4], [5.4, 5.4]]) P.push([bx(1.4, 1.6, 1.4).translate(x, 17, z), st]);
  for (let i = 0; i < 9; i++) P.push([bx(2.2, 0.5 + i * 1, 1.2).translate(8.2, 0, -4 + i * 1.1), st2]);
  P.push([bx(2, 3, 0.4).translate(0, 9.5, 5.6), 0x141210], [bx(1, 1.4, 0.3).translate(-3, 12, 5.6), 0x141210], [bx(1, 1.4, 0.3).translate(3, 12, 5.6), 0x141210]);
  const g = new THREE.Group(), m = new THREE.Mesh(merge(P), vcMat({ roughness: 0.95 })); m.castShadow = m.receiveShadow = true; g.add(m);
  // ravens wheeling over the hill
  const birds = new THREE.InstancedMesh(new THREE.ConeGeometry(0.25, 1.1, 3).rotateX(Math.PI / 2).scale(1, 0.3, 1).translate(0, 0, 0), new THREE.MeshBasicMaterial({ color: 0x0a0a0c }), 7), m4 = new THREE.Matrix4();
  g.add(birds);
  g.userData.update = (dt, t) => { for (let i = 0; i < 7; i++) { const a = t * (0.35 + i * 0.03) + i; m4.makeRotationY(-a).setPosition(Math.cos(a) * (14 + i * 3), 26 + i * 2 + Math.sin(t + i) * 2, Math.sin(a) * (14 + i * 3)); birds.setMatrixAt(i, m4); } birds.instanceMatrix.needsUpdate = true; };
  return g;
}
// The hidden door: a flat bay in the western spur, the smooth grey wall where the door's outline shows
// only to those who know, and the grey stone where the thrush knocked.
function sideDoor() {
  const rock = 0x625d55, st2 = 0x5c5850, P = [[bx(26, 0.8, 18).translate(0, -0.6, 6), 0x6a6458], [bx(30, 34, 6).translate(0, -4, -6), st2], [bx(3.2, 5.2, 0.15).translate(0, 0, -2.9), 0x58534c], [bx(0.4, 0.5, 0.2).translate(1, 2.6, -2.8), 0x101010],
    [new THREE.IcosahedronGeometry(1.3, 0).scale(1.2, 0.8, 1).translate(-4, 0.6, 4), 0x7a7570]];
  for (let i = 0; i < 12; i++) {
    const a = (i / 11 - 0.5) * 2.8, r = 16 + 10 * Math.abs(Math.sin(i * 1.9)), h = 26 + 22 * Math.abs(Math.cos(i * 2.3));
    P.push([new THREE.IcosahedronGeometry(1, 0).scale(r * 0.6, h, r * 0.5).rotateY(i).translate(Math.sin(a) * 22, h * 0.3, -14 - Math.cos(a) * 10), i % 2 ? rock : st2]);
  }
  for (let i = 0; i < 6; i++) P.push([bx(2.4, 0.4, 1.2).translate(-11 + i * 0.4, -1 - i * 0.55, 15 + i * 1.3), 0x6a6458]);   // the stair cut in the cliff
  const g = new THREE.Group(), m = new THREE.Mesh(merge(P), vcMat({ roughness: 0.92 })); m.castShadow = m.receiveShadow = true; g.add(m);
  return g;
}

/* The Grey Havens: white quays along the shore of the Gulf of Lune, three piers, Círdan's tower at the
   harbour mouth, and the grey ship that bore the Ring-bearers into the West, moored until the evening of
   29 Halimath 3021, when it sails west down the gulf and is gone. Built against whatever shore the terrain
   has near the settlement: the sea is found by sampling the near patch for ground at sea level. */
function greyHavens(cx, cz, hAt) {
  // find the sea: sample rings around the town; water is ground at sea level
  let wx = 0, wz = 0, n = 0;
  for (let r = 150; r <= 2400; r += 150) for (let k = 0; k < 48; k++) {
    const a = k / 48 * Math.PI * 2, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (Math.max(Math.abs(x), Math.abs(z)) > 2450) continue;            // beyond the near patch hAt knows nothing
    if (hAt(x, z) <= 0.6) { wx += Math.cos(a) / r; wz += Math.sin(a) / r; n++; }
  }
  if (!n) return null;
  const L = Math.hypot(wx, wz) || 1, dx = wx / L, dz = wz / L;          // towards the water
  let sx = cx, sz = cz;
  for (let t = 0; t < 4000; t += 10) { const x = cx + dx * t, z = cz + dz * t; if (Math.max(Math.abs(x), Math.abs(z)) > 2450) break; if (hAt(x, z) <= 0.6) { sx = x; sz = z; break; } }
  const ang = Math.atan2(dx, dz);                                      // local +z points out to sea
  const grp = new THREE.Group(); grp.name = 'havens'; grp.position.set(sx, 0, sz); grp.rotation.y = ang;
  const P = [], wh = 0xe6e3dc, wh2 = 0xcfcac0, grey = 0x9a978f, gold = 0xc9a03c;
  // the quay wall along the shore, a stone apron behind it, and steps down to the water
  P.push([bx(320, 4.2, 14).translate(0, -1.6, -6), wh2], [bx(320, 0.6, 10).translate(0, 2.6, -4), wh]);
  for (let i = -150; i <= 150; i += 12) P.push([bx(0.8, 1, 0.8).translate(i, 3.2, 0.4), grey]);       // bollards
  for (const ox of [-110, 0, 110]) {
    // piers out into the haven
    P.push([bx(10, 4.2, 70).translate(ox, -1.6, 35), wh2], [bx(10.6, 0.5, 70).translate(ox, 2.6, 35), wh]);
    for (let z = 8; z < 70; z += 10) for (const s of [-1, 1]) P.push([cy(0.3, 0.35, 1, 6).translate(ox + s * 4.4, 3.1, z), grey]);
    for (const s of [-1, 1]) P.push([cy(0.18, 0.2, 5, 6).translate(ox + s * 4.6, 3.1, 66), grey], [sph(0.5, 8, 6).translate(ox + s * 4.6, 8.4, 66), 0xfff6dc]);
    for (let k = 0; k < 6; k++) P.push([bx(4, 0.5, 1.6).translate(ox + 6.5, 2.2 - k * 0.6, 10 + k * 1.6), wh2]);   // steps to the water
  }
  // Círdan's tower at the end of the long mole
  P.push([bx(12, 4.2, 120).translate(-200, -1.6, 50), wh2], [cy(6, 7, 26, 12).translate(-200, 2, 108), wh], [cy(7.4, 7.4, 1.2, 12).translate(-200, 28, 108), wh2],
    [cy(4.2, 5, 9, 12).translate(-200, 29, 108), wh], [cn(5.4, 9, 12).translate(-200, 38, 108), 0x8aa0b0]);
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; P.push([bx(1.2, 1.8, 1.2).translate(-200 + Math.cos(a) * 7, 29.2, 108 + Math.sin(a) * 7), wh]); }
  // sheds and halls of the shipwrights behind the quay
  for (const [ox, w] of [[-60, 30], [55, 24], [150, 34]]) P.push([bx(w, 10, 16).translate(ox, 2, -24), wh], [new THREE.ConeGeometry(Math.hypot(w, 16) * 0.6, 6, 4).rotateY(Math.PI / 4).scale(w / Math.hypot(w, 16) * 1.414, 1, 16 / Math.hypot(w, 16) * 1.414).translate(ox, 15, -24), 0x7e94a6]);
  const stone = new THREE.Mesh(merge(P), vcMat({ roughness: 0.7 })); stone.castShadow = stone.receiveShadow = true; grp.add(stone);
  const beacon = glow('rgba(255,244,214,1)', 'rgba(255,220,150,0)', 9); beacon.position.set(-200, 34, 108); grp.add(beacon);
  // the ship: a long grey-white hull with a swan prow, one mast and a white sail
  const ship = elvenShip(); ship.position.set(-55, 0, 52); ship.rotation.y = Math.PI / 2; grp.add(ship);
  const sail0 = { x: ship.position.x, z: ship.position.z };
  grp.userData.update = (dt, t) => {
    const T = G.t || 0, leave = window.WX ? window.WX.parse('3021 9 29.75') : 1e9, gone = leave + 0.25;
    ship.visible = T < gone;
    let x = sail0.x, z = sail0.z;
    if (T > leave) { const f = (T - leave) / (gone - leave); z = sail0.z + f * f * 2600; x = sail0.x - f * 400; ship.rotation.y = Math.PI / 2 * (1 - Math.min(1, f * 4)); }
    ship.position.set(x, 0.2 * Math.sin(t * 0.7), z);
    ship.rotation.z = 0.025 * Math.sin(t * 0.5); ship.rotation.x = 0.015 * Math.sin(t * 0.63);
    beacon.material.opacity = 0.75 + 0.25 * Math.sin(t * 1.3);
  };
  return grp;
}
function elvenShip() {
  const hullC = 0xdedbd2, trim = 0xc9a03c, P = [];
  // hull: a box whose width and depth taper toward bow and stern
  const hull = new THREE.BoxGeometry(9, 4, 46, 1, 1, 16), p = hull.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i) / 23, y = p.getY(i), k = 1 - Math.pow(Math.abs(z), 2.2) * 0.85;
    p.setX(i, p.getX(i) * k * (y < 0 ? 0.75 : 1)); p.setY(i, y + Math.pow(Math.abs(z), 3) * 3);
  }
  hull.computeVertexNormals();
  P.push([hull.translate(0, 1, 0), hullC], [bx(8.6, 0.3, 40).translate(0, 3, 0), 0xa8a299]);
  // swan prow: a curving neck and head, and a raised stern
  const neck = new THREE.CatmullRomCurve3([[0, 3.6, 21.5], [0, 5.5, 24.6], [0, 8.6, 25.2], [0, 10.8, 23.4], [0, 11, 21.6]].map(v => new THREE.Vector3(...v)));
  P.push([new THREE.TubeGeometry(neck, 24, 0.75, 8), hullC], [sph(1.05, 10, 8).scale(1, 0.9, 1.3).translate(0, 11, 21.4), hullC]);
  P.push([cn(0.42, 2.2, 8).rotateX(-Math.PI / 2).translate(0, 10.8, 19.6), trim], [bx(6, 3.2, 6).translate(0, 3, -20), hullC], [bx(6.4, 0.4, 6.4).translate(0, 6.2, -20), trim]);
  for (const s of [-1, 1]) P.push([bx(0.25, 0.4, 40).translate(s * 4.5, 3.3, 0), trim]);
  P.push([cy(0.35, 0.45, 28, 8).translate(0, 3, 2), 0x8a7a62], [bx(16, 0.4, 0.4).translate(0, 26, 2), 0x8a7a62]);
  const g = new THREE.Group(), m = new THREE.Mesh(merge(P), vcMat({ roughness: 0.55 })); m.castShadow = true; g.add(m);
  const sail = new THREE.PlaneGeometry(15, 19, 6, 6), sp = sail.attributes.position;
  for (let i = 0; i < sp.count; i++) sp.setZ(i, 1.6 * (1 - Math.pow(sp.getX(i) / 7.5, 2)) * (0.6 + 0.4 * (sp.getY(i) / 19 + 0.5)));
  sail.computeVertexNormals();
  const sm = new THREE.Mesh(sail, new THREE.MeshStandardMaterial({ color: 0xf6f4ee, roughness: 0.8, side: THREE.DoubleSide })); sm.position.set(0, 16, 2.4); sm.castShadow = true; g.add(sm);
  const lamp = glow('rgba(255,250,230,1)', 'rgba(255,230,180,0)', 3); lamp.position.set(0, 7, -22); g.add(lamp);
  return g;
}

// One mallorn of Caras Galadhon: silver bole, talans at three heights, a golden crown and lamps.
function mallorn(r, h, flets, lamps, x, y, z) {
  const P = [[cy(r * 0.7, r, h, 9), 0xc4c4bc]];
  for (let i = 1; i <= flets; i++) {
    const fy = h * (0.3 + 0.55 * i / (flets + 1)), fr = r * 3.2 + 2 - i * 0.6;
    P.push([cy(fr, fr, 0.5, 14).translate(0, fy, 0), 0xddd6c4]);
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + i; lamps.push([x + Math.cos(a) * (fr - 0.4), y + fy + 1.4, z + Math.sin(a) * (fr - 0.4), i]); }
    if (i === flets) P.push([cy(fr * 0.55, fr * 0.6, 3.2, 10).translate(0, fy + 0.5, 0), 0xe8e2d2], [cn(fr * 0.7, 2.2, 10).translate(0, fy + 3.7, 0), 0xb8b0a0]);
  }
  for (const [a, b, c, s] of [[0, 1, 0, 1], [0.7, 0.85, 0.4, 0.7], [-0.6, 0.8, -0.5, 0.75], [0.2, 1.15, -0.6, 0.6]]) P.push([sph(h * 0.24 * s, 9, 7).scale(1, 0.85, 1).translate(a * h * 0.18, h * b, c * h * 0.18), 0xc9a640]);
  return merge(P).translate(x, y, z);
}

/* Landmark specials (Orthanc, Barad-dûr, …) and town details for one near patch.
   B = { list, special } from GEN.buildingsNear; coordinates relative to the patch centre (X0, Y0). */
function W3town(B, X0, Y0, hAt) {
  const grp = new THREE.Group(), up = [], solids = [];
  const P = [], lamps = [];
  const toXZ = (X, Y) => [(X - X0) * MI, -(Y - Y0) * MI];
  for (const s of B.special) {
    const [x, z] = toXZ(s.x, s.y);
    // great towers are solid: travellers and walkers who would stand inside one are set down at its foot
    if (s.type === 'tower' && ['orthanc', 'baraddur', 'morgul', 'ecthelion'].includes(s.kind)) solids.push({ x, z, r: (s.r || 20) * 1.15 + 4, h: s.h || 100, kind: s.kind });
    if (Math.hypot(x - G.px, z - G.pz) > 60000) continue;
    const y = hAt(x, z);
    let m = null;
    if (s.kind === 'orthanc') m = orthanc();
    else if (s.kind === 'baraddur') m = baraddur();
    else if (s.kind === 'morgul') m = morgul();
    else if (s.kind === 'ecthelion') m = ecthelion();
    else if (s.type === 'gate') { m = ereborGate(); m.rotation.y = Math.atan2(Math.cos(s.face), -Math.sin(s.face)); }
    else if (s.kind === 'ravenhill') m = ravenhill();
    else if (s.kind === 'sidedoor') { m = sideDoor(); m.rotation.y = Math.atan2(Math.cos(s.face), -Math.sin(s.face)); }
    else if (s.type === 'havens') { const h = greyHavens(x, z, hAt); if (h) { grp.add(h); up.push(h.userData.update); } continue; }
    else if (s.type === 'mallorn') { grp.add(new THREE.Mesh(mallorn(4.2, 78, 4, lamps, x, y - 1, z), vcMat({ roughness: 0.8 }))); continue; }
    else if (s.type === 'prow') {
      // the great pier of rock that splits every circle of the City, pointing east
      const top = y + 38, n = 16;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, px = x + t * s.len, gy = hAt(px, z), ty = Math.max(gy + 6, top + (gy + 14 - top) * t * t);
        P.push([bx(s.len / n + 0.5, ty - gy + 6, 26 - 18 * t).translate(px, gy - 6, z), 0xe4e2dc]);
      }
      continue;
    }
    if (m) { m.position.set(x, y - 1, z); grp.add(m); if (m.userData.update) up.push(m.userData.update); }
  }
  for (const b of B.list) {
    const [x, z] = toXZ(b.x, b.y), y0 = hAt(x, z) - 0.4;
    if (b.culture === 'lorien') { const h = 42 + b.h; P.push([mallorn(1.4 + b.w * 0.15, h, 2 + (b.h > 22 ? 1 : 0), lamps, x, y0, z), 0xffffff]); continue; }
    if (b.culture === 'elf') { elvenHouse(P, b, x, y0, z); continue; }
    if (b.culture === 'hobbit' && b.round) { smialDetails(P, b, x, y0, z); continue; }
    if (b.ruin) continue;
    houseDetails(P, b, x, y0, z);
  }
  if (P.length) {
    // mallorns are pre-coloured merges; everything else is a flat-coloured part
    const pre = P.filter(p => p[0].attributes.color), flat = P.filter(p => !p[0].attributes.color);
    const geos = [];
    if (flat.length) geos.push(merge(flat));
    for (const [g] of pre) geos.push(g);
    for (const g of geos) { const m = new THREE.Mesh(g, vcMat({ roughness: 0.82 })); m.castShadow = m.receiveShadow = true; grp.add(m); }
  }
  if (lamps.length) {
    const lm = new THREE.InstancedMesh(sph(0.32, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), lamps.length), m4 = new THREE.Matrix4(), c = new THREE.Color();
    const tints = [0xd8f0ff, 0xfff0b0, 0xc8ffd8, 0xffffff];
    lamps.forEach(([x, y, z, i], k) => { m4.makeTranslation(x, y, z); lm.setMatrixAt(k, m4); lm.setColorAt(k, c.set(tints[(k + i) % 4])); });
    grp.add(lm);
  }
  grp.userData.update = (dt, t) => up.forEach(f => f(dt, t)); grp.userData.solids = solids;
  return grp;
}
function elvenHouse(P, b, x, y, z) {
  const w = b.w, d = b.d, h = b.h * 0.8, a = b.a, wall = 0xe9e4d8, roof = [0x6d7f94, 0x7e9c90, 0x8a8fa0][Math.floor(Math.abs(b.x * 7e4)) % 3];
  const tower = Math.abs(Math.sin(b.x * 9e4 + b.y * 7e4)) < 0.22;
  if (tower) {
    const th = h * 2.6;
    P.push([at(cy(2.4, 2.9, th, 10), x, y, z, a), wall], [at(cy(3.3, 3.3, 0.6, 10), x, y, z, a, 0, th, 0), 0xd8d2c4], [at(cn(3.3, 8, 10), x, y, z, a, 0, th + 0.6, 0), roof]);
    for (let k = 0; k < 3; k++) P.push([at(bx(0.7, 1.8, 0.2), x, y, z, a, 0, 3 + k * th * 0.3, 2.9), 0x2a3038]);
    return;
  }
  P.push([at(bx(w, h, d), x, y, z, a), wall], [at(bx(w + 2.4, 0.35, d + 2.4), x, y, z, a, 0, h, 0), 0xd4cdbd]);
  P.push([at(new THREE.ConeGeometry(Math.hypot(w, d) * 0.62, h * 0.55, 4).rotateY(Math.PI / 4).scale(w / Math.hypot(w, d) * 1.414, 1, d / Math.hypot(w, d) * 1.414).translate(0, h * 0.275 + 0.35, 0), x, y, z, a, 0, h, 0), roof]);
  // porch of slender columns and tall arched windows
  for (let k = -1.5; k <= 1.5; k++) P.push([at(cy(0.22, 0.26, h, 6), x, y, z, a, k * w * 0.26, 0, d / 2 + 2), 0xf2eee6]);
  P.push([at(bx(w * 0.92, 0.4, 2.4), x, y, z, a, 0, h - 0.4, d / 2 + 1.2), 0xdcd5c6]);
  for (let k = -1; k <= 1; k++) P.push([at(bx(1, h * 0.55, 0.15), x, y, z, a, k * w * 0.28, h * 0.2, d / 2 + 0.05), 0x2b3540]);
}
function smialDetails(P, b, x, y, z) {
  const r = b.w * 0.8, seed = Math.abs(Math.floor(b.x * 1e5));
  for (const s of [-1, 1]) P.push([new THREE.CylinderGeometry(0.5, 0.5, 0.15, 10).rotateX(Math.PI / 2).translate(x + s * r * 0.55, y + 1.15, z + r * 0.8), 0x2b2a26],
    [new THREE.TorusGeometry(0.52, 0.08, 4, 12).translate(x + s * r * 0.55, y + 1.15, z + r * 0.81), 0x6a4a2a]);
  P.push([cy(0.22, 0.28, 1.6, 6).translate(x - r * 0.25, y + r * 0.45, z - r * 0.2), 0x7a6a5a]);
  // garden path, fence and flower beds in front of the round door
  P.push([bx(1.2, 0.06, 5).translate(x, y + 0.42, z + r + 2.5), 0x9a8462]);
  const fl = [0xc83a2e, 0xe8c040, 0x9a5ac8, 0xf2f0e8, 0xe87a3a];
  for (let k = 0; k < 6; k++) {
    const s = k % 2 ? 1 : -1, zz = z + r + 1 + Math.floor(k / 2) * 1.6;
    P.push([bx(0.12, 0.9, 0.12).translate(x + s * 2.4, y + 0.4, zz), 0x8a6e4a], [bx(1.3, 0.12, 1.2).translate(x + s * 1.5, y + 0.38, zz), 0x4a3a28]);
    for (let f = 0; f < 7; f++) {
      const fx = x + s * 1.5 + (((seed + f * 37 + k * 11) % 100) / 100 - 0.5) * 1.1, fz = zz + (((seed * 3 + f * 53 + k) % 100) / 100 - 0.5) * 1;
      P.push([cy(0.015, 0.02, 0.3, 3).translate(fx, y + 0.45, fz), 0x3e6a2a], [sph(0.09, 5, 3).translate(fx, y + 0.78, fz), fl[(seed + k + f) % fl.length]]);
    }
  }
  P.push([bx(0.08, 0.1, 4.8).translate(x - 2.4, y + 1.05, z + r + 2.6), 0x8a6e4a], [bx(0.08, 0.1, 4.8).translate(x + 2.4, y + 1.05, z + r + 2.6), 0x8a6e4a]);
}
const DOOR = { hobbit: 0x2c5a24, bree: 0x4a3420, rohan: 0x5a3a1e, dale: 0x3a2e28, lake: 0x3a2a1e, gondor: 0x2a2620, minastirith: 0x2e2a24, harad: 0x6a4020, dwarf: 0x2a2420, dunland: 0x3a2a1a, woodmen: 0x3a2a1a, beorning: 0x3a2a1a, east: 0x4a2a1a };
function houseDetails(P, b, x, y, z) {
  const d = b.d, w = b.w, a = b.a, h = b.h, dc = DOOR[b.culture];
  if (dc === undefined) return;
  const door = b.culture === 'hobbit' ? new THREE.CylinderGeometry(0.85, 0.85, 0.12, 12).rotateX(Math.PI / 2).translate(0, 0.95, 0) : bx(1.2, 2.1, 0.12);
  P.push([at(door, x, y, z, a, 0, 0.1, d / 2 + 0.06), dc]);
  const win = 0x26282a, nw = Math.max(1, Math.floor(w / 4.5)), floors = h > 9 ? 2 : 1;
  for (let f = 0; f < floors; f++) for (let k = 0; k < nw; k++) {
    const lx = (k - (nw - 1) / 2) * (w / nw);
    if (f === 0 && Math.abs(lx) < 1.3) continue;
    P.push([at(bx(0.9, 1.1, 0.1), x, y, z, a, lx, 1.4 + f * 3.3, d / 2 + 0.05), win]);
  }
  if (['bree', 'hobbit', 'dale', 'lake', 'woodmen', 'dunland', 'rohan'].includes(b.culture) && Math.sin(b.x * 3e4) > -0.3)
    P.push([at(bx(0.8, 2.2, 0.8), x, y, z, a, w * 0.3, h + Math.min(w, d) * 0.25, 0), 0x6e6258]);
  if (b.culture === 'dwarf') P.push([at(bx(w + 0.8, 0.7, d + 0.8), x, y, z, a, 0, h, 0), 0x86827a], [at(bx(2.2, 0.6, 0.5), x, y, z, a, 0, 2.3, d / 2 + 0.2), 0x86827a]);
  if (b.culture === 'rohan' && w > 30) for (const s of [-1, 1]) P.push([at(new THREE.BoxGeometry(0.5, 4, 0.5).rotateZ(s * 0.5), x, y, z, a, s * (w / 2 + 0.6), h + 2.5, d / 2), 0xc8a040]);   // crossed gable horns
}

/* ---------------- people ---------------- */
// Proportions in metres; c = tunic choices, legs, skin, hair, cloak (null = none).
const KIN = {
  hobbit: { h: 1.08, wd: 1.0, head: 1.35, leg: 0.42, skin: 0xe4b48a, hair: [0x5a3a1e, 0x7a4a22, 0x3a2414, 0xa0702a], c: [0x6b8e3a, 0xb5862e, 0x8a2f24, 0x4f6b8a, 0xd4b060], legs: 0x6a5a40, feet: 0xc8a078 },
  bree: { h: 1.76, skin: 0xd8a884, hair: [0x4a3020, 0x2a1e14, 0x8a6a3a], c: [0x6a5a3a, 0x4a5a3a, 0x7a4a2a, 0x5a4a5a], legs: 0x3e3a30 },
  rohirrim: { h: 1.85, skin: 0xe2b896, hair: [0xd8b860, 0xc8a050, 0xe0c878], c: [0x3e6a34, 0x5a6a2e, 0x7a6a3a, 0x8a7a50], legs: 0x5a4a30, cloak: 0x2e5a2a, beardP: 0.4 },
  gondor: { h: 1.85, skin: 0xd4a47e, hair: [0x1e1814, 0x2a2018, 0x3a2a1e], c: [0x22262c, 0x3a3e46, 0xd8d8d0, 0x2a3446], legs: 0x2a2a2a, cloak: 0x1e1e22 },
  dale: { h: 1.78, skin: 0xd8a884, hair: [0x6a3a1e, 0x4a2a18, 0xa0602a], c: [0x8a2a24, 0x2a4a7a, 0x6a5a2a, 0x3a6a5a], legs: 0x3a3430 },
  elf: { h: 1.92, wd: 0.88, skin: 0xf0d8c4, hair: [0xd8d4c8, 0x1e1a18, 0xe0c890, 0xbcb4a8], c: [0x8a9a8a, 0x6e7e8a, 0xd8d4c4, 0x5a6e5a], legs: 0x6a7a6a, robe: 1, longHair: 1, cloak: 0x7a8a82 },
  dwarf: { h: 1.38, wd: 1.35, leg: 0.36, head: 1.15, skin: 0xd09a7a, hair: [0x6a3a1e, 0x3a2a1e, 0x9a9a92, 0xa04a24], c: [0x5a3a6a, 0x2a4a6a, 0x7a2a24, 0x4a5a3a, 0x6a5a2a], legs: 0x3a3028, beard: 1, hood: 1 },
  orc: { h: 1.6, wd: 1.1, hunch: 0.38, skin: 0x6a6e4a, hair: [0x1a1a14], c: [0x2a2622, 0x3a3228, 0x1e1e1e], legs: 0x2a241e, helm: 0x3a3a3a },
  uruk: { h: 1.86, wd: 1.15, hunch: 0.12, skin: 0x4a4436, hair: [0x14120e], c: [0x1a1a1c, 0x24221e], legs: 0x1e1c18, helm: 0x2c2c2e },
  harad: { h: 1.8, skin: 0x8a5a3a, hair: [0x14100c], c: [0xb03a24, 0xd8a038, 0x8a2a2a, 0xe8d8b0], legs: 0x6a2a1e, robe: 1, turban: 1 },
  easterling: { h: 1.78, skin: 0xc49a6a, hair: [0x14100c], c: [0x7a2a1e, 0x4a3a2a, 0x8a6a2a], legs: 0x3a2a1e, helm: 0x8a6a3a, beardP: 0.6 },
  beorning: { h: 2.0, wd: 1.2, skin: 0xd8a884, hair: [0x2a1e14, 0x4a2e1a], c: [0x5a4a30, 0x6a5232, 0x4a3a28], legs: 0x4a3a2a, beardP: 0.9 },
  dunland: { h: 1.72, skin: 0xc89a78, hair: [0x2a1e14, 0x1a1410], c: [0x5a4a3a, 0x4a3a2a, 0x6a5a40], legs: 0x3a3028, beardP: 0.6 },
  woodman: { h: 1.8, skin: 0xd8a884, hair: [0x4a3020, 0x6a4a2a], c: [0x4a5a32, 0x5a4a30, 0x3a4a2a], legs: 0x3a3028, beardP: 0.5 },
};
const FOLK = {
  hobbit: [['hobbit', 1]], bree: [['bree', 0.6], ['hobbit', 0.4]], rohan: [['rohirrim', 1]], gondor: [['gondor', 1]], minastirith: [['gondor', 1]], osgiliath: [['gondor', 1]],
  elf: [['elf', 1]], lorien: [['elf', 1]], lake: [['dale', 0.85], ['dwarf', 0.15]], dale: [['dale', 0.7], ['dwarf', 0.3]], dwarf: [['dwarf', 1]],
  isengard: [['uruk', 0.7], ['orc', 0.3]], mordor: [['orc', 0.7], ['uruk', 0.3]], morgul: [['orc', 1]], harad: [['harad', 1]], east: [['easterling', 1]],
  beorning: [['beorning', 1]], dunland: [['dunland', 1]], woodmen: [['woodman', 1]],
};
// Built once per kin at 1.8 m and scaled. aPart: 1 tunic (per-person tint), 2 legs, 5 arms; aPivot = hip/shoulder height.
function figure(k) {
  const S = KIN[k], wd = S.wd || 1, legH = 0.82 * (S.leg ? S.leg / 0.46 : 1), torso = 0.62, hip = legH, sh = hip + torso, head = 0.12 * (S.head || 1);
  const hairC = S.hair[0], P = [];
  const L = (g, c, part, pivot) => P.push([g, c, { part, pivot }]);
  for (const s of [-1, 1]) {
    L(bx(0.15 * wd, legH, 0.17).translate(s * 0.1 * wd, 0, 0), S.legs, 2, hip);
    L(bx(0.16 * wd, 0.08, 0.26).translate(s * 0.1 * wd, 0, 0.04), S.feet || 0x2a2018, 2, hip);
    L(bx(0.11, torso * 0.92, 0.12).translate(s * (0.25 * wd + 0.03), hip + torso * 0.08, 0), 0xffffff, 5, sh);
    L(sph(0.06, 5, 4).translate(s * (0.25 * wd + 0.03), hip + torso * 0.04, 0), S.skin, 5, sh);
  }
  const body = bx(0.44 * wd, torso, 0.25);
  if (S.robe) L(cy(0.2 * wd, 0.3 * wd, hip * 0.9, 8).translate(0, hip * 0.08, 0), 0xffffff, 1, 0);
  L(body.translate(0, hip, 0), 0xffffff, 1, 0);
  L(bx(0.46 * wd, 0.06, 0.27).translate(0, hip + 0.02, 0), 0x3a2a1e, 0, 0);
  L(sph(head, 9, 7).translate(0, sh + head + 0.04, 0.02), S.skin, 0, 0);
  if (S.turban) L(sph(head * 1.15, 8, 6).scale(1, 0.7, 1).translate(0, sh + head * 1.6, 0.01), 0xe8e0c8, 0, 0);
  else if (S.helm) L(sph(head * 1.12, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, sh + head + 0.06, 0.01), S.helm, 0, 0);
  else if (S.hood) L(cn(head * 1.15, head * 2.2, 7).translate(0, sh + head * 0.7, -0.02), 0x5a3a2a, 0, 0);
  else L(sph(head * 1.08, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55).translate(0, sh + head + 0.05, -0.01), hairC, 0, 0);
  if (S.longHair) L(bx(0.2, 0.42, 0.06).translate(0, sh - 0.3, -0.12), hairC, 0, 0);
  if (S.beard) L(bx(0.22 * wd, 0.36, 0.1).translate(0, sh - 0.26, 0.13), hairC, 0, 0);
  if (S.cloak) L(bx(0.48 * wd, torso + hip * 0.55, 0.04).translate(0, hip * 0.45, -0.15), S.cloak, 0, 0);
  const g = merge(P, true);
  if (S.hunch) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > hip) p.setZ(i, p.getZ(i) + (y - hip) * S.hunch); } }
  g.scale(S.h / 1.8 * wd, S.h / 1.8, S.h / 1.8);
  const pv = g.attributes.aPivot; for (let i = 0; i < pv.count; i++) pv.setX(i, pv.getX(i) * S.h / 1.8);
  return g;
}
function folkMaterial(time) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aPart; attribute float aPivot; attribute vec3 aTint; attribute vec3 aWalk; uniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float sw = sin(uTime * aWalk.y + aWalk.x) * aWalk.z;
        if (aPart > 1.5) { float side = position.x > 0.0 ? 1.0 : -1.0; float a = (aPart > 4.5 ? -0.8 : 1.0) * sw * side; float d = transformed.y - aPivot; transformed.y = aPivot + d * cos(a); transformed.z += d * sin(a); }
        transformed.y += abs(sw) * 0.025;`)
      .replace('#include <color_vertex>', '#include <color_vertex>\nif ((aPart > 0.5 && aPart < 1.5) || aPart > 4.5) vColor = aTint;');
  };
  return m;
}
/* Townsfolk for one near patch: everyone walks between doors, pausing now and then. */
function W3people(B, X0, Y0, hAt, opts = {}) {
  const grp = new THREE.Group(), time = { value: 0 };
  const doors = [];
  for (const b of B.list) {
    if (!FOLK[b.culture]) continue;
    const x = (b.x - X0) * MI, z = -(b.y - Y0) * MI, off = b.round ? b.w * 0.8 + 2 : b.d / 2 + 1.8;
    doors.push({ x: x + Math.sin(b.a) * off, z: z + Math.cos(b.a) * off, culture: b.culture, d: Math.hypot(x - G.px, z - G.pz) });
  }
  doors.sort((a, b) => a.d - b.d);
  const near = doors.filter(d => d.d < 1800).slice(0, opts.max || (innerWidth < 760 ? 140 : 320));
  const byKin = {}, agents = [];
  let seed = 1;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const d of near) {
    const mix = FOLK[d.culture]; let r = rnd(), kin = mix[0][0];
    for (const [k, p] of mix) { if ((r -= p) <= 0) { kin = k; break; } }
    const n = d.culture === 'minastirith' || d.culture === 'harad' ? 2 : 1;
    for (let i = 0; i < n; i++) (byKin[kin] = byKin[kin] || []).push({ x: d.x + (rnd() - 0.5) * 4, z: d.z + (rnd() - 0.5) * 4, home: d });
  }
  for (const k in byKin) {
    const list = byKin[k], S = KIN[k];
    const geo = figure(k);
    const tint = new Float32Array(list.length * 3), walk = new Float32Array(list.length * 3);
    list.forEach((a, i) => { const c = lin(S.c[Math.floor(rnd() * S.c.length)]); tint.set([c.r, c.g, c.b], i * 3); walk.set([rnd() * 6.28, 7 + rnd() * 2, 0], i * 3); });
    geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 3));
    geo.setAttribute('aWalk', new THREE.InstancedBufferAttribute(walk, 3));
    const mesh = new THREE.InstancedMesh(geo, folkMaterial(time), list.length);
    mesh.castShadow = true; mesh.frustumCulled = false;
    grp.add(mesh);
    list.forEach((a, i) => agents.push(Object.assign(a, { mesh, i, walk: geo.attributes.aWalk, tx: a.x, tz: a.z, wait: rnd() * 6, yaw: rnd() * 6.28, sp: (k === 'hobbit' || k === 'dwarf' ? 1.0 : 1.35) * (0.8 + rnd() * 0.4), sc: 0.93 + rnd() * 0.14 })));
  }
  const pool = near.length ? near : [{ x: 0, z: 0 }];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), upv = new THREE.Vector3(0, 1, 0);
  const floor = opts.floorAt || hAt;
  grp.userData.update = (dt) => {
    time.value += dt;
    const dirty = new Set();
    for (const a of agents) {
      let moving = false;
      if (a.wait > 0) a.wait -= dt;
      else {
        const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
        if (d < 0.6) {
          a.wait = 1 + rnd() * 7;
          const t = pool[Math.floor(rnd() * pool.length)];
          const far = Math.hypot(t.x - a.x, t.z - a.z) > 220;
          a.tx = (far ? a.home.x : t.x) + (rnd() - 0.5) * 6; a.tz = (far ? a.home.z : t.z) + (rnd() - 0.5) * 6;
        } else {
          const nx = a.x + dx / d * a.sp * dt, nz = a.z + dz / d * a.sp * dt;
          if (floor(nx, nz) === null) { a.tx = a.x; a.tz = a.z; } else { a.x = nx; a.z = nz; moving = true; }
          a.yaw = Math.atan2(dx, dz);
        }
      }
      const amp = moving ? 0.55 : 0;
      if (a.walk.getZ(a.i) !== amp) { a.walk.setZ(a.i, amp); dirty.add(a.walk); }
      p3.set(a.x, (floor(a.x, a.z) ?? 0) - 0.02, a.z); q.setFromAxisAngle(upv, a.yaw); s3.setScalar(a.sc);
      m4.compose(p3, q, s3); a.mesh.setMatrixAt(a.i, m4);
    }
    for (const w of dirty) w.needsUpdate = true;
    grp.children.forEach(m => { m.instanceMatrix.needsUpdate = true; });
  };
  grp.userData.update(0);
  grp.userData.agents = agents;
  return grp;
}

/* ---------------- the halls under the mountain ---------------- */
function stoneTexture(a, b, line, tiles = 8) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const g = cv.getContext('2d'), s = 512 / tiles;
  for (let j = 0; j < tiles; j++) for (let i = 0; i < tiles; i++) {
    g.fillStyle = (i + j) % 2 ? a : b; g.fillRect(i * s, j * s, s, s);
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`; g.fillRect(i * s + Math.random() * s, j * s + Math.random() * s, 2 + Math.random() * 8, 1); }
  }
  if (line) { g.strokeStyle = line; g.lineWidth = 3; for (let i = 0; i <= tiles; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, 512); g.moveTo(0, i * s); g.lineTo(512, i * s); g.stroke(); } }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function runeTexture(text) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const g = cv.getContext('2d'); g.fillStyle = '#d8d4cc'; g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#3a3630'; g.font = '30px serif'; g.textAlign = 'center';
  const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛟᛞ';
  let r = ''; for (const ch of text) r += ch === ' ' ? '  ' : runes[(ch.charCodeAt(0) * 7) % runes.length];
  g.fillText(r, 256, 52); g.font = 'italic 22px serif'; g.fillText(text, 256, 96);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/* kind: 'erebor' (Thrór's halls: gold, forges, treasury, the Arkenstone) or 'moria' (the Dwarrowdelf:
   tree-carved pillars in the dark, the Bridge of Khazad-dûm, Balin's tomb). Units are metres; the walker
   starts inside the gate looking north (−z). Returns { group, floorAt, spawn, info, update }. */
function W3hall(kind) {
  const E = kind === 'erebor';
  const grp = new THREE.Group(), up = [];
  const stone = E ? 0x5e574e : 0x3c4144, stone2 = E ? 0x4c463e : 0x2e3235, gold = 0xc9a03c;
  const floorTex = E ? stoneTexture('#3e4a44', '#5a5a52', '#a8873a', 6) : stoneTexture('#2a2e30', '#33383a', null, 6);
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: E ? 0.3 : 0.55, metalness: 0.05 });
  const stoneMat = vcMat({ roughness: 0.92 });
  const goldMat = new THREE.MeshStandardMaterial({ color: gold, roughness: 0.28, metalness: 1, emissive: 0x3a2400, emissiveIntensity: 0.4 });
  const P = [], fires = [], regions = [];
  // walkable regions: [x0, x1, z0, z1, y or fn(x,z), solid?]; holes: [x0, x1, z0, z1]
  // Regions may overlap at different heights (a gallery above the hall floor). floorAt(x, z, yRef) picks
  // the highest floor within a step of yRef; a solid region (stairs, piers) is a wall to anyone below it.
  const holes = [];
  const floorAt = (x, z, yRef) => {
    for (const h of holes) if (x > h[0] && x < h[1] && z > h[2] && z < h[3]) return null;
    let low = null, best = null;
    for (const r of regions) if (x > r[0] && x < r[1] && z > r[2] && z < r[3]) {
      const y = typeof r[4] === 'function' ? r[4](x, z) : r[4];
      if (y === null) continue;
      if (yRef !== undefined && r[5] && y > yRef + 1.25) return null;
      if (low === null || y < low) low = y;
      if (yRef !== undefined && y <= yRef + 1.25 && (best === null || y > best)) best = y;
    }
    return yRef === undefined ? low : (best ?? low);
  };
  const rooms = [];     // [name, x0, x1, z0, z1, yMin, yMax] for the place line
  const ceilings = [];  // [x0, x1, z0, z1, y]: how high Space may lift the walker
  const slab = (x0, x1, z0, z1, y, mat = floorMat) => {
    const w = x1 - x0, d = z1 - z0, g = new THREE.BoxGeometry(w, 2, d).translate((x0 + x1) / 2, y - 1, (z0 + z1) / 2);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 24, uv.getY(i) * d / 24);
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; grp.add(m);
  };
  const wall = (x0, x1, z0, z1, y0, y1, c = stone) => P.push([bx(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, y0, (z0 + z1) / 2), c]);
  const brazier = (x, z, y = 0) => {
    P.push([cy(0.25, 0.4, 2.6, 6).translate(x, y, z), 0x2a2420], [cy(1.1, 0.5, 0.7, 10).translate(x, y + 2.6, z), E ? gold : 0x3a3a3a]);
    const f = glow('rgba(255,200,110,1)', 'rgba(255,90,20,0)', 4.5); f.position.set(x, y + 3.9, z); grp.add(f); fires.push(f);
  };
  const H = E ? 72 : 90, W = E ? 36 : 44, Z1 = 60, Z0 = E ? -420 : -560;
  // doorways in the side walls: [z0, z1] on the east (+x) and west (−x)
  const gapE = E ? [[-100, -60]] : [], gapW = E ? [[-60, -30]] : [[-95, -75]];
  const inGap = (gaps, z) => gaps.some(g => z > g[0] - 1 && z < g[1] + 1);
  // nave
  regions.push([-W, W, Z0, Z1, 0]);
  ceilings.push([-W - 0.5, W + 0.5, Z0 - 60, Z1 + 6, H - 4]);
  for (const [x0, x1, gaps] of [[-W - 6, -W, gapW], [W, W + 6, gapE]]) {
    let z = Z0 - 6;
    for (const g of gaps.slice().sort((a, b) => a[0] - b[0])) { wall(x0, x1, z, g[0], -2, H); wall(x0, x1, g[0], g[1], 26, H); z = g[1]; }
    wall(x0, x1, z, Z1 + 6, -2, H);
  }
  P.push([bx(2 * W + 12, 4, Z1 - Z0 + 12).translate(0, H, (Z0 + Z1) / 2), stone2]);
  for (let z = Z1 - 10; z > Z0; z -= 15) for (const s of [-1, 1]) if (!inGap(s > 0 ? gapE : gapW, z)) wall(s * W - (s > 0 ? 1.5 : 0), s * W + (s > 0 ? 0 : 1.5), z - 1, z + 1, 0, H, stone2);
  // the gate behind the walker: daylight through the doorway
  wall(-W, -12, Z1, Z1 + 6, -2, H); wall(-12, 12, Z1, Z1 + 6, 30, H);
  if (E) { wall(12, 27, Z1, Z1 + 6, -2, H); wall(27, 33, Z1, Z1 + 6, 5, H); wall(33, W, Z1, Z1 + 6, -2, H); } else wall(12, W, Z1, Z1 + 6, -2, H);
  const day = new THREE.Mesh(new THREE.PlaneGeometry(24, 32), new THREE.MeshBasicMaterial({ color: E ? 0xfff2d8 : 0xdde8f0, fog: false })); day.position.set(0, 15, Z1 + 5.5); day.rotation.y = Math.PI; grp.add(day);
  const dayL = new THREE.SpotLight(E ? 0xfff0d0 : 0xd8e4ff, 5e3, 160, 0.55, 0.7, 1.8); dayL.position.set(0, 18, Z1 + 4); dayL.target.position.set(0, 0, Z1 - 60); grp.add(dayL, dayL.target);
  // pillars and ribs
  const chasm = E ? [1e9, 1e9] : [-300, -240];
  for (let z = Z1 - 20; z > Z0 + 10; z -= (E ? 30 : 26)) {
    if (z > chasm[0] - 8 && z < chasm[1] + 8) continue;
    for (const s of [-1, 1]) {
      const x = s * (E ? 22 : 26);
      if (E) {
        P.push([bx(9, 4, 9).translate(x, 0, z), stone2], [bx(6, H - 10, 6).translate(x, 4, z), stone], [bx(9, 6, 9).translate(x, H - 6, z), stone2]);
        for (const yy of [18, 40]) P.push([bx(6.5, 1.3, 6.5).translate(x, yy, z), gold]);
      } else {
        P.push([cy(3.2, 3.8, 8, 10).translate(x, 0, z), stone2], [cy(3.4, 3, H - 34, 10).translate(x, 8, z), stone], [cy(9, 3.4, 26, 10).translate(x, H - 26, z), stone]);
        for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; P.push([new THREE.BoxGeometry(1.2, 22, 1.2).rotateZ(0.6).translate(5, 0, 0).rotateY(a).translate(x, H - 14, z), stone2]); }   // carven boughs
      }
    }
    P.push([new THREE.TorusGeometry(E ? 22 : 26, 1.6, 6, 18, Math.PI).translate(0, H - (E ? 22 : 26), z), stone2]);
    if (E) { brazier(-14, z); brazier(14, z); } else if (Math.abs(z) % 78 < 26) brazier(0, z);
  }
  // Moria: the chasm and the Bridge of Khazad-dûm
  if (E) { slab(-W, 26.9, Z0, Z1, 0); slab(33.1, W, Z0, Z1, 0); }     // the River Running's channel lies between
  else {
  const bw = 1.6;
  holes.push([-W - 1, -bw / 2, chasm[0], chasm[1]], [bw / 2, W + 1, chasm[0], chasm[1]]);
  regions.unshift([-bw / 2, bw / 2, chasm[0], chasm[1], 0]);
  P.push([bx(bw, 2.5, chasm[1] - chasm[0]).translate(0, -2.5, (chasm[0] + chasm[1]) / 2), stone2]);
  const deep = new THREE.Mesh(new THREE.PlaneGeometry(2 * W, chasm[1] - chasm[0]).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: E ? 0x5a1e08 : 0x8a2408 })); deep.position.set(0, -260, (chasm[0] + chasm[1]) / 2); grp.add(deep);
  wall(-W, W, chasm[0] - 1, chasm[0], -260, 0, stone2); wall(-W, W, chasm[1], chasm[1] + 1, -260, 0, stone2);
  const pitL = E ? new THREE.PointLight(0xff6a20, 6e4, 150, 2) : new THREE.PointLight(0xff3a10, 2.5e5, 320, 2); pitL.position.set(0, E ? -150 : -25, (chasm[0] + chasm[1]) / 2); grp.add(pitL);
  if (!E) for (let i = 0; i < 9; i++) { const f = glow('rgba(255,140,50,0.9)', 'rgba(255,40,0,0)', 40 + Math.random() * 40); f.position.set((Math.random() - 0.5) * 2 * W, -40 - Math.random() * 60, chasm[0] + Math.random() * (chasm[1] - chasm[0])); grp.add(f); fires.push(f); }
  slab(-W, W, chasm[1], Z1, 0); slab(-W, W, Z0, chasm[0], 0); slab(-bw / 2, bw / 2, chasm[0], chasm[1], 0, stoneMat);
  rooms.push(['The Bridge of Khazad-dûm', -W, W, chasm[0] - 10, chasm[1] + 10, -1e9, 1e9]);
  }
  let info;
  const spawns = { gate: { x: 0, z: Z1 - 14, yaw: 0 } };
  if (E) {
    // great stair, dais, throne and the Arkenstone
    const sz0 = Z0, steps = 30, depth = 1.7, rise = 0.8;
    regions.unshift([-20, 20, sz0 - steps * depth, sz0, (x, z) => Math.min(steps, Math.floor((sz0 - z) / depth) + 1) * rise, true]);
    for (let i = 0; i < steps; i++) P.push([bx(40, (i + 1) * rise, depth).translate(0, 0, sz0 - (i + 0.5) * depth), i % 2 ? stone : stone2]);
    const dz0 = sz0 - steps * depth, dy = steps * rise;
    regions.unshift([-30, 30, dz0 - 40, dz0, dy]); slab(-30, 30, dz0 - 40, dz0, dy);
    wall(-36, 36, dz0 - 46, dz0 - 40, -2, H + 10); wall(30, 36, dz0 - 40, dz0, dy - 2, H);
    // west wall of the dais opens into the Gallery of the Kings
    wall(-36, -30, dz0 - 40, dz0 - 35, dy - 2, H); wall(-36, -30, dz0 - 5, dz0, dy - 2, H); wall(-36, -30, dz0 - 35, dz0 - 5, dy + 16, H);
    wall(-W, -20, dz0, sz0, -2, dy, stone2); wall(20, W, dz0, sz0, -2, dy, stone2);
    P.push([bx(6, 2.5, 4).translate(0, dy, dz0 - 30), gold], [bx(6, 9, 1.2).translate(0, dy + 2.5, dz0 - 32), gold], [bx(8, 0.8, 6).translate(0, dy, dz0 - 30), stone2]);
    const stoneG = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe8f0ff, emissiveIntensity: 2.5, roughness: 0.1 }));
    stoneG.position.set(0, dy + 14, dz0 - 31.5); grp.add(stoneG);
    const halo = glow('rgba(235,245,255,1)', 'rgba(150,180,255,0)', 18); halo.position.copy(stoneG.position); grp.add(halo);
    const ark = new THREE.PointLight(0xdfe8ff, 6e3, 140, 2); ark.position.copy(stoneG.position); grp.add(ark);
    up.push((dt, t) => { stoneG.rotation.y += dt * 0.4; halo.scale.setScalar(16 + 2 * Math.sin(t * 2.3)); });
    for (const s of [-1, 1]) brazier(s * 22, dz0 - 20, dy);
    // treasury through the east wall, down a ramp
    const tz0 = -170, tz1 = -40, ty = -8;
    regions.push([W - 0.5, 60.5, -100, -60, x => -Math.max(0, Math.min(1, (x - W) / 24)) * 8], [60, 170, tz0, tz1, ty]);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(24.6, 1, 40).translate(0, -0.5, 0), floorMat); ramp.rotation.z = -Math.atan2(8, 24); ramp.position.set(W + 12, -4, -80); grp.add(ramp);
    slab(W + 24, 60, -100, -60, ty); slab(60, 170, tz0, tz1, ty);
    wall(60, 170, tz0 - 6, tz0, ty - 2, 30); wall(60, 170, tz1, tz1 + 6, ty - 2, 30); wall(170, 176, tz0, -112, ty - 2, 30); wall(170, 176, -108, tz1, ty - 2, 30); wall(170, 176, -112, -108, ty + 4.4, 30); wall(60, 66, tz0, -100, ty - 2, 30); wall(60, 66, -60, tz1, ty - 2, 30);
    P.push([bx(116, 3, 136).translate(118, 30, (tz0 + tz1) / 2), stone2]);
    const hoard = [], coins = [];
    for (let i = 0; i < 26; i++) {
      const r = 3 + Math.random() * 9, x = 75 + Math.random() * 85, z = tz0 + 12 + Math.random() * (tz1 - tz0 - 24);
      hoard.push(new THREE.SphereGeometry(r, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.35, 1).translate(x, ty, z));
      for (let k = 0; k < 60; k++) { const a = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * r; coins.push([x + Math.cos(a) * rr, ty + 0.35 * Math.sqrt(Math.max(0, r * r - rr * rr)), z + Math.sin(a) * rr]); }
    }
    hoard.forEach(g => { const m = new THREE.Mesh(g, goldMat); m.receiveShadow = true; grp.add(m); });
    const cm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 8), goldMat, coins.length), m4 = new THREE.Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion();
    coins.forEach(([x, y, z], i) => { e.set(Math.random() * 1.2, Math.random() * 6, Math.random() * 1.2); q.setFromEuler(e); m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)); cm.setMatrixAt(i, m4); });
    grp.add(cm);
    for (let i = 0; i < 10; i++) P.push([bx(3, 1.8, 2).translate(70 + i * 9.5, ty, tz0 + 4), 0x5a3a1e], [bx(3.1, 0.3, 2.1).translate(70 + i * 9.5, ty + 1.8, tz0 + 4), gold]);
    const tl = new THREE.PointLight(0xffc870, 9e3, 160, 2); tl.position.set(118, ty + 22, -105); grp.add(tl);
    // forges through the west wall, with a channel of molten gold
    regions.push([-150, -W - 6, -110, 10, (x, z) => (Math.abs(x + 100) < 1.6 ? null : 0)], [-W - 6.5, -W + 0.5, -60, -30, 0]);
    slab(-150, -W - 6, -110, 10, 0); slab(-W - 6, -W, -60, -30, 0);
    wall(-156, -150, -110, 10, -2, 34); wall(-150, -W - 6, 10, 16, -2, 34); P.push([bx(108, 3, 126).translate(-97, 34, -50), stone2]);
    const molten = new THREE.Mesh(new THREE.PlaneGeometry(3, 110).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffb030, emissive: 0xff8a10, emissiveIntensity: 2 })); molten.position.set(-100, 0.05, -50); grp.add(molten);
    for (let i = 0; i < 6; i++) {
      const z = -100 + i * 18;
      P.push([bx(8, 11, 7).translate(-145, 0, z), 0x3a3430], [cn(4, 10, 4).rotateY(Math.PI / 4).translate(-145, 11, z), 0x2e2a26], [bx(2, 1.4, 1).translate(-128, 0, z), 0x2a2a2c], [bx(3, 0.6, 1.2).translate(-128, 1.4, z), 0x3a3a3c]);
      const mouth = glow('rgba(255,170,60,1)', 'rgba(255,60,0,0)', 9); mouth.position.set(-141, 3, z); grp.add(mouth); fires.push(mouth);
    }
    const fl = new THREE.PointLight(0xff7a2a, 1.2e4, 200, 2); fl.position.set(-120, 14, -50); grp.add(fl);
    up.push((dt, t) => { molten.material.emissiveIntensity = 1.6 + 0.4 * Math.sin(t * 3.1); });
    ereborMore({ ceilings, P, grp, up, fires, regions, holes, rooms, spawns, slab, wall, brazier, floorMat, stoneMat, goldMat, stone, stone2, gold, W, H, Z0, Z1, dz0, dy, tz0, tz1, ty });
    info = 'Halls of Thrór · Erebor';
  } else {
    // the far end: light of the East-gate; Balin's tomb off the west side under a shaft of daylight
    wall(-W, W, Z0 - 6, Z0, -2, H);
    const east = new THREE.Mesh(new THREE.PlaneGeometry(16, 26), new THREE.MeshBasicMaterial({ color: 0xc8d8e8, fog: false })); east.position.set(0, 13, Z0 + 0.2); grp.add(east);
    const el = new THREE.SpotLight(0xc8d8ff, 1.5e4, 200, 0.5, 0.7, 1.6); el.position.set(0, 16, Z0 + 2); el.target.position.set(0, 0, Z0 + 80); grp.add(el, el.target);
    regions.push([-110, -W - 6, -110, -60, 0], [-W - 6.5, -W + 0.5, -95, -75, 0]); slab(-110, -W - 6, -110, -60, 0); slab(-W - 6, -W, -95, -75, 0);
    wall(-116, -110, -110, -60, -2, 30); wall(-110, -W - 6, -116, -110, -2, 30); wall(-110, -W - 6, -60, -54, -2, 30); P.push([bx(70, 3, 56).translate(-80, 30, -85), stone2]);
    const tomb = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.4, 1.8).translate(0, 0.7, 0), [0, 0, new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.7 }), 0, 0, 0].map(m => m || new THREE.MeshStandardMaterial({ color: 0xcdc8bf, roughness: 0.7 })));
    tomb.material[2] = new THREE.MeshStandardMaterial({ map: runeTexture('BALIN SON OF FUNDIN LORD OF MORIA'), roughness: 0.7 });
    tomb.position.set(-75, 0, -85); grp.add(tomb);
    const shaft = new THREE.SpotLight(0xffffff, 1.2e4, 60, 0.2, 0.5, 1.5); shaft.position.set(-75, 29, -85); shaft.target.position.set(-75, 0, -85); grp.add(shaft, shaft.target);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 29, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending })); beam.position.set(-75, 14.5, -85); grp.add(beam);
    ceilings.push([-110, -W - 6, -110, -60, 28]);
    rooms.push(["Balin's Tomb · the Chamber of Mazarbul", -110, -W - 6, -110, -60, -1e9, 1e9]);
    info = 'The Dwarrowdelf · Khazad-dûm';
  }
  const m = new THREE.Mesh(merge(P), stoneMat); m.receiveShadow = true; grp.add(m);
  const lights = [];
  for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffa858, E ? 9000 : 5000, 90, 2); grp.add(l); lights.push(l); }
  let tick = 9, room = '';
  const update = (dt, t) => {
    const c = G.camera.position, r = rooms.find(r => c.x > r[1] && c.x < r[2] && c.z > r[3] && c.z < r[4] && G.hallY >= r[5] && G.hallY <= r[6]);
    const name = r ? r[0] : info;
    if (name !== room) { room = name; $('#gsub').textContent = name; }
    fires.forEach((f, i) => { const s0 = f.userData.s || (f.userData.s = f.scale.x); f.scale.setScalar(s0 * (0.85 + 0.15 * Math.sin(t * 11 + i * 1.7) * Math.sin(t * 5.3 + i))); });
    if ((tick += dt) > 0.5) {
      // keep the few real lights on the braziers nearest the walker
      tick = 0;
      const c = G.camera.position, near = fires.slice().sort((a, b) => a.position.distanceToSquared(c) - b.position.distanceToSquared(c));
      lights.forEach((l, i) => { if (near[i]) l.position.copy(near[i].position).add(new THREE.Vector3(0, 1, 0)); });
    }
    up.forEach(f => f(dt, t));
  };
  return { group: grp, floorAt, spawn: spawns.gate, spawns, info, update, ceiling: H - 6, dwarves: E, ceilingAt: (x, z) => { for (const c of ceilings) if (x > c[0] && x < c[1] && z > c[2] && z < c[3]) return c[4]; return G.hallY + 3.2; } };
}

/* The rest of Thrór's halls: the west gallery, the Gallery of the Kings, the River Running, the deep
   mine-shaft beyond the forges, and the secret passage up to the hidden door on the western side. */
function ereborMore(o) {
  const { ceilings, P, grp, up, fires, regions, holes, rooms, spawns, slab, wall, brazier, floorMat, stoneMat, goldMat, stone, stone2, gold, W, H, Z0, Z1, dz0, dy, tz0, tz1, ty } = o;
  rooms.push(['The Great Hall of Thrór', -W, W, Z0, Z1, -1, 2], ['The Throne of the King under the Mountain', -36, 36, dz0 - 40, Z0, -1e9, 1e9],
    ['The Treasury', 60, 176, tz0, tz1, -1e9, 1e9], ['The Forges', -150, -W, -110, 10, -1e9, 1e9]);
  ceilings.push([60, 170, tz0, tz1, 28], [-150, -W - 6, -110, 10, 32]);

  // ---- the River Running, in a channel down the east side and out under the gate
  const cx0 = 27.5, cx1 = 32.5, bz0 = -86, bz1 = -74;
  holes.push([cx0, cx1, Z0 - 1, bz0], [cx0, cx1, bz1, Z1 + 8]);
  const wtex = (() => {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const g = cv.getContext('2d');
    g.fillStyle = '#1d4a52'; g.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 220; i++) { g.fillStyle = `rgba(190,230,235,${Math.random() * 0.22})`; g.fillRect(Math.random() * 64, Math.random() * 256, 2 + Math.random() * 10, 1 + Math.random() * 2); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 30); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const water = new THREE.Mesh(new THREE.PlaneGeometry(cx1 - cx0, Z1 - Z0 + 8).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: wtex, roughness: 0.08, metalness: 0.2, emissive: 0x0a2226 }));
  water.position.set((cx0 + cx1) / 2, -1.6, (Z0 + Z1 + 8) / 2); grp.add(water);
  up.push(dt => { wtex.offset.y -= dt * 0.35; });
  wall(cx0 - 0.6, cx0, Z0, Z1 + 6, -3, 0.5, stone2); wall(cx1, cx1 + 0.6, Z0, Z1 + 6, -3, 0.5, stone2);
  wall(cx0, cx1, Z0 - 1, Z0, -3, 0, stone2);
  P.push([bx(cx1 - cx0 + 1.6, 0.6, bz1 - bz0).translate((cx0 + cx1) / 2, -0.6, (bz0 + bz1) / 2), stone]);
  for (const z of [bz0, bz1]) for (const x of [cx0 - 0.3, cx1 + 0.3]) P.push([bx(0.5, 1.2, 0.5).translate(x, 0, z), gold]);
  const spout = glow('rgba(160,220,230,0.5)', 'rgba(60,120,140,0)', 6); spout.position.set((cx0 + cx1) / 2, -0.5, Z0 + 1); grp.add(spout);

  // ---- the west gallery, 24 m up, reached by a stair from beside the gate
  const gy = dy, gx0 = -W, gx1 = -27, sTop = -8, sBot = 40, nSt = 30, sD = (sBot - sTop) / nSt;
  regions.push([gx0, gx1, sTop, sBot, (x, z) => Math.max(0, Math.min(nSt, Math.floor((sBot - z) / sD) + 1)) * gy / nSt, true]);
  for (let i = 0; i < nSt; i++) P.push([bx(gx1 - gx0, (i + 1) * gy / nSt, sD).translate((gx0 + gx1) / 2, 0, sBot - (i + 0.5) * sD), i % 2 ? stone : stone2]);
  regions.push([gx0, gx1, Z0 - 0.5, sTop + 0.5, gy], [-W, -20, dz0, Z0 + 0.5, gy, true]);
  rooms.push(['The West Gallery', gx0, gx1 + 1, Z0, sTop, gy - 1, gy + 1]);
  P.push([bx(gx1 - gx0, 1.4, sTop - Z0).translate((gx0 + gx1) / 2, gy - 1.4, (Z0 + sTop) / 2), stone2]);
  for (let z = sTop - 6; z > Z0; z -= 4) P.push([bx(0.5, 1.1, 0.5).translate(gx1 - 0.3, gy, z), stone]);
  P.push([bx(0.7, 0.3, sTop - Z0).translate(gx1 - 0.3, gy + 1.1, (Z0 + sTop) / 2), gold]);
  for (let z = sTop - 12; z > Z0 + 4; z -= 30) {
    if (z > -64 && z < -26) continue;                       // keep the forge doorway clear
    regions.push([-35.5, -29.5, z - 1.6, z + 1.6, gy, true]);
    P.push([bx(5, gy - 1.4, 3).translate(-32.5, 0, z), stone]);
    P.push([new THREE.TorusGeometry(13, 0.8, 5, 10, Math.PI).rotateY(Math.PI / 2).translate(-27.5, gy - 14.5, z + 15), stone2]);
  }
  for (let z = sTop - 30; z > Z0; z -= 60) brazier(-33, z, gy);

  // ---- the Gallery of the Kings: Durin's line in stone, west of the throne
  const kz0 = dz0 - 35, kz1 = dz0 - 5, kx0 = -250, kx1 = -36, kH = 34;
  regions.push([kx0, kx1 + 6.5, kz0, kz1, gy]); slab(kx0, kx1 + 6, kz0, kz1, gy);
  rooms.push(['The Gallery of the Kings', kx0, kx1 + 6, kz0, kz1, -1e9, 1e9]); ceilings.push([kx0, kx1 + 6, kz0, kz1, gy + kH - 2]);
  wall(kx0 - 6, kx0, kz0 - 6, kz1 + 6, gy - 2, gy + kH); wall(kx0, kx1 + 6, kz0 - 6, kz0, gy - 2, gy + kH); wall(kx0, kx1 + 6, kz1, kz1 + 6, gy - 2, gy + kH);
  P.push([bx(kx1 - kx0 + 12, 3, kz1 - kz0 + 12).translate((kx0 + kx1) / 2, gy + kH, (kz0 + kz1) / 2), stone2]);
  const kings = ['DURIN THE DEATHLESS', 'DURIN VI', 'NAIN I', 'THRAIN I', 'THORIN I', 'DAIN I', 'THROR', 'THRAIN II', 'THORIN OAKENSHIELD', 'DAIN IRONFOOT'];
  const plates = [];
  kings.forEach((name, i) => {
    const side = i % 2 ? 1 : -1, x = kx1 - 22 - Math.floor(i / 2) * 36, z = side > 0 ? kz1 - 3.5 : kz0 + 3.5, f = -side;   // f: facing +z or −z
    regions.push([x - 3, x + 3, z - 3, z + 3, gy + 3, true]);
    const K = [[bx(6, 3, 6), stone2], [bx(5, 6.5, 3.4).translate(0, 3, 0), stone], [bx(4.6, 3.6, 3).translate(0, 9.5, 0), stone], [bx(6.2, 1.6, 3.4).translate(0, 12.6, 0), stone],
      [sph(1.3, 8, 6).translate(0, 15.4, 0.2 * f), stone], [bx(2.4, 4.6, 0.8).translate(0, 10.2, 1.6 * f), stone2], [cy(1.25, 1.35, 0.9, 10).translate(0, 16.4, 0.2 * f), gold],
      [bx(0.5, 10, 0.5).translate(2.6, 3, 1.8 * f), stone2], [bx(2.6, 2.4, 0.4).translate(2.6, 12.6, 1.8 * f), stone2]];
    for (const [g, c] of K) P.push([g.translate(x, gy, z), c]);
    plates.push([name, x, z + 3.05 * f, f]);
    brazier(x + 9, z - 4 * side, gy);
  });
  for (const [name, x, z, f] of plates) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.4), new THREE.MeshStandardMaterial({ map: runeTexture(name), roughness: 0.7 }));
    m.position.set(x, gy + 1.5, z); if (f < 0) m.rotation.y = Math.PI; grp.add(m);
  }
  // the end wall: Durin's crown and seven stars, as on the Doors of Moria
  P.push([bx(1, 22, 22).translate(kx0 + 0.5, gy + 4, (kz0 + kz1) / 2), stone2], [cy(4, 4.4, 2.4, 10).rotateZ(Math.PI / 2).translate(kx0 + 1.2, gy + 21, (kz0 + kz1) / 2), gold]);
  for (let i = 0; i < 7; i++) { const a = Math.PI * (0.15 + 0.7 * i / 6); const st = glow('rgba(230,240,255,1)', 'rgba(150,180,255,0)', 2.6); st.position.set(kx0 + 1.4, gy + 21 + Math.sin(a) * 9, (kz0 + kz1) / 2 + Math.cos(a) * 9); grp.add(st); }

  // ---- the mines: north of the forges, a deep shaft with a cage-lift, ore-carts and veins of gold and mithril
  const mx0 = -165, mx1 = -78, mz0 = -215, mz1 = -116, hx0 = -136, hx1 = -106, hz0 = -190, hz1 = -150, depth = 320;
  wall(-150, -130, -116, -110, -2, 34); wall(-112, -W - 6, -116, -110, -2, 34); wall(-130, -112, -116, -110, 14, 34);
  regions.push([-130, -112, -116.5, -109.5, 0], [mx0, mx1, mz0, mz1, 0]);
  slab(mx0, hx0 - 1, mz0, mz1, 0); slab(hx1 + 1, mx1, mz0, mz1, 0); slab(hx0 - 1, hx1 + 1, mz0, hz0 - 1, 0); slab(hx0 - 1, hx1 + 1, hz1 + 1, mz1, 0);
  holes.push([hx0, hx1, hz0, hz1]);
  rooms.push(['The Deep Mines', mx0, mx1, mz0, mz1, -1e9, 1e9]); ceilings.push([mx0, mx1, mz0, mz1, 38]);
  wall(mx0 - 6, mx0, mz0 - 6, mz1 + 6, -2, 40); wall(mx1, mx1 + 6, mz0 - 6, mz1 + 6, -2, 40); wall(mx0, mx1, mz0 - 6, mz0, -2, 40);
  wall(mx0, -130, mz1, mz1 + 0.01, 0, 0.01); P.push([bx(mx1 - mx0 + 12, 3, mz1 - mz0 + 12).translate((mx0 + mx1) / 2, 40, (mz0 + mz1) / 2), stone2]);
  // shaft walls, with veins and hanging lamps all the way down
  wall(hx0 - 1, hx0, hz0, hz1, -depth, 0, 0x3a3530); wall(hx1, hx1 + 1, hz0, hz1, -depth, 0, 0x3a3530);
  wall(hx0 - 1, hx1 + 1, hz0 - 1, hz0, -depth, 0, 0x3a3530); wall(hx0 - 1, hx1 + 1, hz1, hz1 + 1, -depth, 0, 0x3a3530);
  const veins = [];
  for (let i = 0; i < 260; i++) {
    const side = i % 4, y = -Math.random() * depth, t = Math.random();
    const x = side < 2 ? (side ? hx1 - 0.1 : hx0 + 0.1) : hx0 + t * (hx1 - hx0), z = side < 2 ? hz0 + t * (hz1 - hz0) : (side === 2 ? hz0 + 0.1 : hz1 - 0.1);
    veins.push([x, y, z, Math.random() < 0.2]);
  }
  const vg = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.35, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6, metalness: 0.8, roughness: 0.3 }), veins.length);
  const m4 = new THREE.Matrix4(), c3 = new THREE.Color();
  veins.forEach(([x, y, z, mith], i) => { m4.makeScale(1 + Math.random() * 2, 0.6 + Math.random(), 1 + Math.random() * 2).setPosition(x, y, z); vg.setMatrixAt(i, m4); vg.setColorAt(i, c3.set(mith ? 0xb8d8ff : 0xe0b040)); });
  grp.add(vg);
  for (let y = -12; y > -depth; y -= 24) for (const [x, z] of [[hx0 + 1, hz0 + 1], [hx1 - 1, hz1 - 1]]) { const l = glow('rgba(255,190,110,0.9)', 'rgba(255,100,30,0)', 3); l.position.set(x, y, z); grp.add(l); }
  const deepL = new THREE.PointLight(0x9ab8ff, 2e4, 200, 2); deepL.position.set((hx0 + hx1) / 2, -depth + 20, (hz0 + hz1) / 2); grp.add(deepL);
  // headframe, winding-wheel and the cage
  const cxm = (hx0 + hx1) / 2, czm = (hz0 + hz1) / 2;
  for (const s of [-1, 1]) P.push([bx(1.2, 26, 1.2).translate(cxm + s * 8, 0, czm), 0x4a3a2a], [new THREE.BoxGeometry(1, 30, 1).rotateZ(s * 0.35).translate(cxm + s * 13, 13, czm), 0x4a3a2a]);
  P.push([bx(18, 1.2, 1.4).translate(cxm, 26, czm), 0x4a3a2a]);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(4, 0.4, 6, 20), new THREE.MeshStandardMaterial({ color: 0x5a4a3a, metalness: 0.5, roughness: 0.6 })); wheel.position.set(cxm, 27, czm); grp.add(wheel);
  const cage = new THREE.Group(), cageMat = new THREE.MeshStandardMaterial({ color: 0x6a5232, roughness: 0.8 });
  cage.add(new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 6), cageMat), new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 6).translate(0, 4, 0), cageMat));
  for (const [a, b] of [[-2.8, -2.8], [2.8, -2.8], [-2.8, 2.8], [2.8, 2.8]]) cage.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 0.3).translate(a, 2, b), cageMat));
  const lamp = glow('rgba(255,200,120,1)', 'rgba(255,120,40,0)', 3); lamp.position.y = 3; cage.add(lamp);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1, 4).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.8 }));
  cage.position.set(cxm, -40, czm); grp.add(cage, chain);
  up.push((dt, t) => {
    const y = -depth * 0.5 + (depth * 0.5 - 6) * Math.cos(t * 0.12);
    wheel.rotation.z = -y * 0.25; cage.position.y = y;
    chain.position.set(cxm, y + 4, czm); chain.scale.y = Math.max(0.1, 26 - (y + 4));
  });
  // rails round the rim, with ore-carts
  for (const z of [hz0 - 6, hz1 + 6]) { P.push([bx(mx1 - mx0 - 14, 0.15, 0.15).translate((mx0 + mx1) / 2, 0, z - 0.7), 0x5a5a5a], [bx(mx1 - mx0 - 14, 0.15, 0.15).translate((mx0 + mx1) / 2, 0, z + 0.7), 0x5a5a5a]); }
  for (const [x, z] of [[-150, hz0 - 6], [-95, hz1 + 6], [-120, hz1 + 6]]) {
    regions.push([x - 1.8, x + 1.8, z - 1.4, z + 1.4, 1.6, true]);
    P.push([bx(3.2, 1.4, 2).translate(x, 0.3, z), 0x4a4038], [bx(2.8, 0.5, 1.6).translate(x, 1.5, z), Math.random() < 0.5 ? 0x8a7a50 : 0x5a5a62]);
  }
  for (const [x, z] of [[mx0 + 8, mz0 + 8], [mx1 - 8, mz0 + 8], [mx0 + 8, mz1 - 8]]) brazier(x, z);

  // ---- the secret passage: from the treasury up to the hidden door on the western spur
  const pz0 = -112, pz1 = -108, px0 = 170, px1 = 430, y0 = ty, y1 = 30, slope = (y1 - y0) / (px1 - px0);
  const floorP = x => y0 + Math.max(0, Math.min(px1 - px0, x - px0)) * slope;
  regions.push([px0 - 6.5, px1, pz0, pz1, floorP]);
  rooms.push(['The Secret Passage', px0 + 6, px1 + 10, pz0 - 2, pz1 + 2, -1e9, 1e9]);
  const segs = 26, sl = (px1 - px0) / segs;
  for (let i = 0; i < segs; i++) {
    const xa = px0 + i * sl, ym = floorP(xa + sl / 2);
    P.push([bx(sl + 0.4, 0.6, pz1 - pz0 + 0.6).translate(xa + sl / 2, ym - 0.6, (pz0 + pz1) / 2), 0x4a453e],
      [bx(sl + 0.4, 4.4, 1).translate(xa + sl / 2, ym - 0.6, pz0 - 0.5), stone2], [bx(sl + 0.4, 4.4, 1).translate(xa + sl / 2, ym - 0.6, pz1 + 0.5), stone2],
      [bx(sl + 0.4, 1, pz1 - pz0 + 2).translate(xa + sl / 2, ym + 3.4, (pz0 + pz1) / 2), stone2]);
  }
  // treasury east wall: a low, plain opening
  // the door itself, seen from within: a seam of light round its edge, and the keyhole
  const dx = px1 + 0.5, dyD = floorP(px1);
  P.push([bx(1, 8, 10).translate(dx + 0.5, dyD - 1, (pz0 + pz1) / 2), stone2], [bx(0.4, 3.4, 0.2).translate(dx, dyD, pz0 + 0.2), 0x2a2622], [bx(0.4, 3.4, 0.2).translate(dx, dyD, pz1 - 0.2), 0x2a2622]);
  const seamMat = new THREE.MeshBasicMaterial({ color: 0xffe8c0, fog: false });
  for (const [w, h, y, z] of [[0.05, 3.2, dyD + 1.6, pz0 + 0.45], [0.05, 3.2, dyD + 1.6, pz1 - 0.45], [3.1, 0.05, dyD + 3.2, (pz0 + pz1) / 2]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), seamMat); m.position.set(dx - 0.05, y, z); m.rotation.y = -Math.PI / 2; grp.add(m);
  }
  const key = glow('rgba(255,236,190,1)', 'rgba(255,200,120,0)', 0.3); key.position.set(dx - 0.1, dyD + 1.3, (pz0 + pz1) / 2 + 0.6); grp.add(key);
  for (let x = px0 + 30; x < px1; x += 60) brazier(x, (pz0 + pz1) / 2 + 1.2, floorP(x));
  brazier(px1 - 14, pz1 - 0.6, floorP(px1 - 14));
  spawns.door = { x: px1 - 4, z: (pz0 + pz1) / 2, yaw: -Math.PI / 2 };
  return o;
}

/* ---------------- landmarks seen from afar ----------------
   Orodruin's fire and smoke, and Minas Tirith beyond the near patch: both stand over the plains for scores of
   miles. Heights come from the same generator as the terrain, less the earth's curve like the far terrain. */
function smokeTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
  for (let k = 0; k < 9; k++) {
    const x = 64 + Math.cos(k * 2.4) * 22 * (k % 3) / 2, y = 64 + Math.sin(k * 2.4) * 18 * (k % 3) / 2, r = 30 + (k % 4) * 6;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function W3far(o) {
  const grp = new THREE.Group(), ups = [], R = 6371000, GN = window.GEN;
  const rel = (X, Y) => ({ x: (X - G.X0) * MI, z: -(Y - G.Y0) * MI });
  const drop = (x, z) => (x * x + z * z) / (2 * R);
  const hAt = (X, Y) => GN.evaluate(X, Y, 0.01);
  const heatAt = () => (o.heat ? o.heat(G.t) : 1);
  // ---- Orodruin ----
  const DX = 840.1, DY = -554, dp = rel(DX, DY), dd = Math.hypot(dp.x, dp.z);
  if (dd < 230000) {
    let top = 0; for (let k = 0; k < 8; k++) top = Math.max(top, hAt(DX + Math.cos(k) * 0.12, DY + Math.sin(k) * 0.12));
    const y0 = top - drop(dp.x, dp.z);
    // beyond the far terrain the mountain itself is drawn from its true profile
    if (Math.max(Math.abs(dp.x), Math.abs(dp.z)) > 52000) {
      const pts = [];
      for (let i = 0; i <= 26; i++) { const r = i / 26 * 7; pts.push(new THREE.Vector2(r * MI, Math.max(...[0, 1, 2, 3].map(a => hAt(DX + Math.cos(a * 1.57) * r, DY + Math.sin(a * 1.57) * r))) - 25 - drop(dp.x, dp.z))); }
      const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), new THREE.MeshStandardMaterial({ color: 0x2c2420, roughness: 1 }));
      m.position.set(dp.x, 0, dp.z); grp.add(m);
    }
    const fire = glow('rgba(255,210,110,1)', 'rgba(255,60,10,0)', 900); fire.position.set(dp.x, y0 + 160, dp.z); grp.add(fire);
    const naurP = rel(840.3, -552.6), naur = glow('rgba(255,170,80,1)', 'rgba(255,60,10,0)', 160);
    naur.position.set(naurP.x, hAt(840.3, -552.6) - drop(naurP.x, naurP.z) + 15, naurP.z); grp.add(naur);
    // rivers of fire down the cone and over the shoulders
    const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff6a1a, side: THREE.DoubleSide }), streams = [];
    for (let k = 0; k < 7; k++) {
      const a0 = k * 0.9 + 0.4, len = (k < 3 ? 2.4 : 4.6) + (k % 2) * 0.8, P = [], N = 44;
      for (let i = 0; i <= N; i++) {
        const r = 0.14 + i / N * len, a = a0 + Math.sin(i * 0.37 + k) * 0.12, X = DX + Math.cos(a) * r, Y = DY + Math.sin(a) * r, q = rel(X, Y);
        P.push(new THREE.Vector3(q.x, hAt(X, Y) - drop(q.x, q.z) + 6, q.z));
      }
      const pos = [], w = 45 + k * 6;
      for (let i = 0; i < N; i++) {
        const a = P[i], b = P[i + 1], nx = -(b.z - a.z), nz = b.x - a.x, l = Math.hypot(nx, nz) || 1, ox = nx / l * w / 2, oz = nz / l * w / 2;
        pos.push(a.x - ox, a.y, a.z - oz, a.x + ox, a.y, a.z + oz, b.x + ox, b.y, b.z + oz, a.x - ox, a.y, a.z - oz, b.x + ox, b.y, b.z + oz, b.x - ox, b.y, b.z - oz);
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const m = new THREE.Mesh(geo, lavaMat); m.userData.big = k >= 3; grp.add(m); streams.push(m);
    }
    // the plume: puffs rising from the crater, drifting west, taller and darker in the War and vast in the eruption
    const tex = smokeTexture(), puffs = [];
    for (let i = 0; i < 72; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, color: 0x4a4440 })); s.userData.ph = (i * 0.618) % 1; s.userData.j = Math.sin(i * 12.9) ; grp.add(s); puffs.push(s); }
    // seen from afar the plume is drawn larger and kept dark, so the Mountain marks the east wherever you stand in Mordor
    const fogMix = Math.min(0.35, dd / 220000), boost = 1 + dd / 30000, cLow = new THREE.Color(), cHigh = new THREE.Color();
    ups.push((dt, t) => {
      const heat = heatAt(), H = [1400, 5000, 12000][heat] * Math.pow(boost, 0.75), spread = [3000, 9000, 9000][heat], night = 1 - Math.min(1, G.hemi.intensity / 0.9);
      cHigh.set(0x4a443e).lerp(G.scene.fog.color, fogMix).multiplyScalar(0.35 + 0.65 * (1 - night));
      cLow.set(heat ? 0x8a3418 : 0x4a4440).lerp(cHigh, 0.35);
      const shown = [16, 44, 72][heat];
      puffs.forEach((s, i) => { s.visible = i < shown; });
      for (const s of puffs) {
        if (!s.visible) continue;
        // a column first, then bending away on the wind (in the eruption it towers straight up before it spreads)
        const age = (s.userData.ph + t * (heat === 2 ? 0.02 : 0.008)) % 1, j = s.userData.j, bend = Math.pow(age, heat === 2 ? 2.4 : 1.4);
        const cap = heat === 2 ? Math.pow(Math.max(0, age - 0.6) / 0.4, 1.5) * 9000 : 0;      // the eruption's column spreads into a cloud at the top
        s.position.set(dp.x - bend * spread + j * 600 * age + Math.cos(j * 9) * cap, y0 + 80 + age * H - cap * 0.15, dp.z - bend * spread * 0.25 + j * 900 * age + Math.sin(j * 9) * cap);
        s.scale.setScalar((350 + age * (heat === 2 ? 6500 : 2600)) * (0.8 + 0.3 * Math.abs(j)) * boost);
        s.material.opacity = Math.pow(Math.sin(Math.PI * Math.min(1, age * 1.15)), 0.6) * (heat ? 0.85 : 0.45);
        s.material.color.copy(cLow).lerp(cHigh, Math.min(1, age * (heat ? 2.2 : 1)));
      }
      const fl = 0.75 + 0.25 * Math.sin(t * 7) * Math.sin(t * 3.1);
      fire.visible = heat > 0; fire.scale.setScalar((heat === 2 ? 3200 : 900) * fl * (1 + night) * Math.sqrt(boost));
      fire.material.opacity = heat === 2 ? 1 : Math.min(1, 0.35 + night);
      naur.visible = heat > 0; naur.material.opacity = 0.5 + 0.5 * fl;
      lavaMat.color.setRGB(1, 0.35 + 0.15 * fl, 0.08); for (const m of streams) m.visible = heat > 0 && (heat === 2 || !m.userData.big);
    });
  }
  // ---- Minas Tirith, when it lies beyond the near patch ----
  const CX = 725.1, CY = -599.1, cp = rel(CX, CY), cd = Math.hypot(cp.x, cp.z);
  if (cd > 1500 && cd < 140000) {
    const city = new THREE.Group(), white = new THREE.MeshStandardMaterial({ color: 0xeeebe4, roughness: 0.6, side: THREE.DoubleSide }), roofs = new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.8, side: THREE.DoubleSide });
    const lvl = k => hAt(CX + (60 + k * 95 - 20) / MI, CY), d0 = drop(cp.x, cp.z), a0 = Math.PI / 2 - 0.62 * Math.PI, aL = 1.24 * Math.PI;
    for (let k = 0; k < 7; k++) {
      const r = 60 + k * 95, y = lvl(k), below = k < 6 ? lvl(k + 1) : y - 25, h = y - below + 18 + k * 2;
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 48, 1, true, a0, aL), white); wall.position.set(0, below + h / 2 - d0, 0); city.add(wall);
      const ring = new THREE.Mesh(new THREE.RingGeometry(k ? r - 95 : 0.1, r, 48, 1, -0.62 * Math.PI, aL).rotateX(-Math.PI / 2), roofs); ring.position.y = y + 9 - d0; city.add(ring);
    }
    const ytop = lvl(0);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(7, 9, 92, 12).translate(0, 46, 0), white); tower.position.set(-16, ytop + 10 - d0, 0); city.add(tower);
    const cit = new THREE.Mesh(new THREE.BoxGeometry(60, 16, 44).translate(0, 8, 0), white); cit.position.set(-10, ytop - d0, 0); city.add(cit);
    const pr = new THREE.Shape([new THREE.Vector2(0, ytop + 8), new THREE.Vector2(600, lvl(6) + 14), new THREE.Vector2(600, lvl(6) - 10), new THREE.Vector2(0, lvl(6) - 10)]);
    const prow = new THREE.Mesh(new THREE.ExtrudeGeometry(pr, { depth: 18, bevelEnabled: false }).translate(0, -d0, -9), white); city.add(prow);
    city.position.set(cp.x, 0, cp.z); grp.add(city);
    ups.push(() => { city.visible = !G.nearOff || Math.max(Math.abs(cp.x - G.nearOff.x), Math.abs(cp.z - G.nearOff.z)) > 2100; });
  }
  // ---- the Party's fireworks: rockets and starbursts over the Party Field, and the dragon at the end ----
  for (const fw of o.fireworks || []) {
    const fp = rel(fw.x, fw.y), fd = Math.hypot(fp.x, fp.z); if (fd > 30000) continue;
    const t0 = window.WX.parse(fw.from), t1 = window.WX.parse(fw.to), tDragon = window.WX.parse(fw.dragon);
    const base = hAt(fw.x, fw.y) - drop(fp.x, fp.z), N = 1400;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel = new Float32Array(N * 3), life = new Float32Array(N);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 4.5, map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    pts.frustumCulled = false; grp.add(pts);
    const PAL = [[1, 0.35, 0.3], [0.35, 0.8, 1], [1, 0.85, 0.35], [0.5, 1, 0.5], [0.85, 0.5, 1], [1, 1, 1]];
    let next = 0, wait = 0, rockets = [], lastBurst = -1;
    const spawn = (x, y, z, vx, vy, vz, c, l) => { const i = next; next = (next + 1) % N; pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz; col.set(c, i * 3); life[i] = l; };
    const dragon = glow('rgba(255,200,90,1)', 'rgba(255,60,10,0)', 60), dl = new THREE.PointLight(0xff8a30, 0, 600, 1.2); grp.add(dragon, dl);
    ups.push((dt, t) => {
      const on = G.t >= t0 && G.t <= t1; pts.visible = on || life.some(v => v > 0);
      dragon.visible = on && G.t >= tDragon;
      if (!pts.visible) return;
      const d = Math.min(dt, 0.05);
      if (on && (wait -= d) <= 0) { wait = 0.35 + Math.random() * 0.5; rockets.push({ x: fp.x + (Math.random() - 0.5) * 220, y: base + 4, z: fp.z + (Math.random() - 0.5) * 220, vy: 55 + Math.random() * 20, top: base + 110 + Math.random() * 120 }); }
      rockets = rockets.filter(r => {
        r.y += r.vy * d; spawn(r.x, r.y, r.z, 0, -2, 0, [1, 0.8, 0.5], 0.5);
        if (r.y < r.top) return true;
        const c = PAL[Math.floor(Math.random() * PAL.length)], c2 = PAL[Math.floor(Math.random() * PAL.length)], n = 110 + Math.floor(Math.random() * 70), sp = 30 + Math.random() * 22;
        for (let k = 0; k < n; k++) { const u = Math.random() * 2 - 1, a = Math.random() * 6.283, q = Math.sqrt(1 - u * u); spawn(r.x, r.y, r.z, Math.cos(a) * q * sp, u * sp, Math.sin(a) * q * sp, k % 3 ? c : c2, 1.6 + Math.random() * 1.2); }
        return false;
      });
      for (let i = 0; i < N; i++) {
        if (life[i] <= 0) { pos[i * 3 + 1] = -1e5; continue; }
        life[i] -= d; vel[i * 3 + 1] -= 9 * d; vel[i * 3] *= 1 - 0.9 * d; vel[i * 3 + 1] *= 1 - 0.9 * d; vel[i * 3 + 2] *= 1 - 0.9 * d;
        pos[i * 3] += vel[i * 3] * d; pos[i * 3 + 1] += vel[i * 3 + 1] * d; pos[i * 3 + 2] += vel[i * 3 + 2] * d;
        const fade = Math.min(1, life[i] / 0.8); if (fade < 1) { col[i * 3] *= 0.97; col[i * 3 + 1] *= 0.96; col[i * 3 + 2] *= 0.95; }
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
      if (dragon.visible) {
        // the dragon sweeps low over the field from the Hill, turns, and bursts overhead; again and again until the end
        const ph = (t * 0.12) % 1, a = ph * Math.PI * 2, x = fp.x + Math.cos(a) * 260, z = fp.z + Math.sin(a) * 160, y = base + 35 + 25 * Math.sin(a * 2);
        dragon.position.set(x, y, z); dragon.scale.setScalar(55 + 10 * Math.sin(t * 9)); dl.position.copy(dragon.position); dl.intensity = 40;
        for (let k = 0; k < 4; k++) spawn(x, y, z, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, k % 2 ? [1, 0.45, 0.15] : [1, 0.8, 0.3], 1.1);
        const cyc = Math.floor(t * 0.12); if (ph > 0.97 && cyc !== lastBurst) for (let k = (lastBurst = cyc, 0); k < 200; k++) { const u = Math.random() * 2 - 1, b = Math.random() * 6.283, q = Math.sqrt(1 - u * u); spawn(x, y + 60, z, Math.cos(b) * q * 40, u * 40, Math.sin(b) * q * 40, k % 2 ? [1, 0.3, 0.1] : [1, 0.9, 0.5], 2.2); }
      } else dl.intensity = 0;
    });
  }
  grp.userData.update = (dt, t) => ups.forEach(f => f(dt, t));
  return grp;
}
