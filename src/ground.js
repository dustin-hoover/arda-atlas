/* ============================================================================
   GROUND — a walkable, ground-level view of Arda built with three.js
   ========================================================================== */
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
let THREE = null;
const MI = 1609.344;
const $ = s => document.querySelector(s);
const G = { active: false };

async function ensure() {
  if (!THREE) THREE = await import(THREE_URL);
  if (G.renderer) return;
  const root = $('#ground');
  const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.domElement.id = 'gcv';
  root.insertBefore(r.domElement, root.firstChild);
  G.renderer = r;
  G.scene = new THREE.Scene();
  G.camera = new THREE.PerspectiveCamera(68, 1, 0.4, 260000);
  G.sun = new THREE.DirectionalLight(0xffffff, 2.6);
  G.sun.castShadow = true;
  G.sun.shadow.mapSize.set(2048, 2048);
  const sc = G.sun.shadow.camera; sc.left = -160; sc.right = 160; sc.top = 160; sc.bottom = -160; sc.near = 10; sc.far = 3000;
  G.sun.shadow.bias = -0.0006; G.sun.shadow.normalBias = 0.6;
  G.scene.add(G.sun, G.sun.target);
  G.hemi = new THREE.HemisphereLight(0xbfd6f0, 0x5a5040, 0.9);
  G.scene.add(G.hemi);
  G.scene.fog = new THREE.Fog(0xc8d6e0, 3000, 90000);
  // sky dome
  G.skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sunDir: { value: new THREE.Vector3(0, 1, 0) }, zen: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, cloud: { value: 0.3 }, cloudCol: { value: new THREE.Color(1, 1, 1) }, time: { value: 0 }, night: { value: 0 }, sunCol: { value: new THREE.Color(1, 0.9, 0.7) } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 sunDir, zen, hor, cloudCol, sunCol; uniform float cloud, time, night; varying vec3 vDir;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<6;i++){ s+=a*n(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir);
        float y = d.y;
        vec3 col = mix(hor, zen, pow(clamp(y,0.0,1.0), 0.45));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += sunCol * (pow(s, 900.0) * 30.0 + pow(s, 12.0) * 0.35) * (1.0 - night);
        if (night > 0.0 && y > 0.0) { vec2 sp = d.xz / (y + 0.2) * 220.0; float st = step(0.997, h(floor(sp))); col += vec3(st) * night * 0.9 * (1.0 - cloud); }
        if (y > 0.0) {
          vec2 uv = d.xz / (y + 0.12) * 0.9 + vec2(time * 0.004, time * 0.002);
          float c = fbm(uv * 2.2);
          float cov = smoothstep(1.02 - cloud * 0.95, 1.25 - cloud * 0.6, c + 0.35);
          vec3 cc = cloudCol * (0.8 + 0.35 * smoothstep(0.3, 0.9, c)) + sunCol * pow(s, 6.0) * 0.4 * (1.0 - night);
          col = mix(col, cc, cov * smoothstep(0.0, 0.18, y));
        } else col = mix(hor, hor * 0.7, clamp(-y * 4.0, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  G.sky = new THREE.Mesh(new THREE.SphereGeometry(240000, 32, 16), G.skyMat);
  G.sky.frustumCulled = false;
  G.scene.add(G.sky);
  // precipitation
  const N = 5000, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 120; pos[i * 3 + 1] = Math.random() * 60; pos[i * 3 + 2] = (Math.random() - 0.5) * 120; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  G.rain = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xdde6ee, size: 0.08, transparent: true, opacity: 0.6, depthWrite: false }));
  G.rain.frustumCulled = false; G.rain.visible = false;
  G.scene.add(G.rain);
  G.grassTime = { value: 0 };
  makeGrass();
  bindInput();
  addEventListener('resize', resize);
}

function resize() {
  if (!G.renderer) return;
  const w = innerWidth, h = innerHeight;
  G.renderer.setSize(w, h, false); G.camera.aspect = w / h; G.camera.updateProjectionMatrix();
}

/* ---------------- input ---------------- */
const keys = {};
function bindInput() {
  const cv = G.renderer.domElement;
  let drag = null;
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => {
    if (!drag) return;
    G.yaw += (e.clientX - drag.x) * 0.0032; G.pitch -= (e.clientY - drag.y) * 0.0032;
    G.pitch = Math.max(-1.4, Math.min(1.45, G.pitch));
    drag = { x: e.clientX, y: e.clientY };
  });
  cv.addEventListener('pointerup', () => drag = null);
  cv.addEventListener('wheel', e => { G.camera.fov = Math.max(20, Math.min(90, G.camera.fov + e.deltaY * 0.03)); G.camera.updateProjectionMatrix(); e.preventDefault(); }, { passive: false });
  addEventListener('keydown', e => {
    if (!G.active) return;
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'Escape') close();
    if (e.key.toLowerCase() === 't') { G.t += 1 / 24; updateAtmos(true); }
    if (['w', 'a', 's', 'd', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) e.preventDefault();
  });
  addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  document.querySelectorAll('#gpad button').forEach(b => {
    b.addEventListener('pointerdown', e => { keys[b.dataset.k] = true; e.preventDefault(); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => { keys[b.dataset.k] = false; }));
  });
  $('#gexit').onclick = close;
}

/* ---------------- data ---------------- */
function heightFn(grid, n, half) {
  return (x, z) => {
    const u = (x + half) / (2 * half) * (n - 1), v = (z + half) / (2 * half) * (n - 1);
    if (u < 0 || v < 0 || u > n - 1 || v > n - 1) return null;
    const i = Math.min(n - 2, Math.floor(u)), j = Math.min(n - 2, Math.floor(v)), fx = u - i, fy = v - j;
    const k = j * n + i;
    return (grid[k] * (1 - fx) + grid[k + 1] * fx) * (1 - fy) + (grid[k + n] * (1 - fx) + grid[k + n + 1] * fx) * fy;
  };
}
function groundAt(x, z) {
  let h = G.nearH ? G.nearH(x - G.nearOff.x, z - G.nearOff.z) : null;
  if (h === null && G.farH) h = G.farH(x, z);
  return Math.max(h ?? 0, G.seaLevel);
}

function terrainMesh(heights, n, half, tex, opts) {
  const geo = new THREE.PlaneGeometry(2 * half, 2 * half, n - 1, n - 1);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let y = Math.max(heights[i], opts.floor ?? -1e9);
    if (opts.curv) { const x = p.getX(i), z = p.getZ(i); y -= (x * x + z * z) / (2 * 6371000); }
    if (opts.hole) { const x = Math.abs(p.getX(i)), z = Math.abs(p.getZ(i)); if (x < opts.hole && z < opts.hole) y -= 60; }
    p.setY(i, y);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.96, metalness: 0 });
  if (opts.detail) {
    mat.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vWP;
        float gh(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
        float gn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(gh(i),gh(i+vec2(1,0)),f.x), mix(gh(i+vec2(0,1)),gh(i+vec2(1,1)),f.x), f.y); }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
        float dist = length(vWP.xz - cameraPosition.xz);
        float fade = 1.0 - smoothstep(40.0, 900.0, dist);
        float d1 = gn(vWP.xz * 0.9) * 0.55 + gn(vWP.xz * 3.7) * 0.3 + gn(vWP.xz * 13.0) * 0.15;
        float grass = gn(vec2(vWP.x * 9.0, vWP.z * 2.5)) * gn(vec2(vWP.x * 2.3, vWP.z * 11.0));
        diffuseColor.rgb *= mix(1.0, 0.72 + 0.56 * d1 + 0.12 * grass, fade);`);
    };
  }
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = !!opts.shadow;
  return m;
}

function skirt(mesh, n, depth) {
  // hang a curtain from the patch edge so seams are hidden
  const p = mesh.geometry.attributes.position, pos = [], idx = [];
  const edge = [];
  for (let i = 0; i < n; i++) edge.push(i);
  for (let j = 1; j < n; j++) edge.push(j * n + n - 1);
  for (let i = n - 2; i >= 0; i--) edge.push((n - 1) * n + i);
  for (let j = n - 2; j >= 0; j--) edge.push(j * n);
  edge.forEach((k, e) => { pos.push(p.getX(k), p.getY(k), p.getZ(k), p.getX(k), p.getY(k) - depth, p.getZ(k)); if (e) { const a = (e - 1) * 2, b = e * 2; idx.push(a, a + 1, b, b, a + 1, b + 1); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x5b5a44, roughness: 1, side: THREE.DoubleSide }));
}

async function textureFor(run, X, Y, half, size, strips) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const rows = size / strips;
  await Promise.all(Array.from({ length: strips }, (_, s) => run({ type: 'pt', X, Y, half, tex: size, r0: s * rows, r1: (s + 1) * rows }).then(r => { ctx.drawImage(r.bmp, 0, s * rows); r.bmp.close && r.bmp.close(); })));
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = G.renderer.capabilities.getMaxAnisotropy(); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return { tex: t, canvas: cv };
}

/* ---------------- vegetation & buildings ---------------- */
function buildTrees(arr, hAt) {
  const group = new THREE.Group();
  const kinds = [[], [], [], []];
  for (let i = 0; i < arr.length; i += 4) kinds[arr[i + 2]].push([arr[i], arr[i + 1], arr[i + 3]]);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
  crownMat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLP;\nfloat lh(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }')
      .replace('#include <map_fragment>', '#include <map_fragment>\nfloat lf = lh(floor(vLP * 2.2)); diffuseColor.rgb *= 0.72 + 0.5 * lf * (0.6 + 0.4 * smoothstep(-1.0, 3.0, vLP.y - 5.0));');
  };
  const blob = (rx, ry, cx, cy, cz, seed) => {
    const b = new THREE.IcosahedronGeometry(1, 2), p = b.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = 1 + 0.18 * Math.sin(x * 5.1 + seed) * Math.sin(y * 4.3 + seed * 2) * Math.sin(z * 4.7 - seed); p.setXYZ(i, x * rx * n + cx, y * ry * n + cy, z * rx * n + cz); }
    return b;
  };
  const cluster = (R, H, Y) => {
    const parts = [blob(R, H, 0, Y, 0, 1), blob(R * 0.7, H * 0.7, R * 0.55, Y - H * 0.25, R * 0.2, 2), blob(R * 0.65, H * 0.65, -R * 0.5, Y - H * 0.15, -R * 0.3, 3), blob(R * 0.6, H * 0.6, R * 0.1, Y + H * 0.45, -R * 0.35, 4)];
    const pos = [], nor = [], idx = []; let off = 0;
    for (const q of parts) { q.computeVertexNormals(); const qi = q.index ? q.index.array : null; pos.push(...q.attributes.position.array); nor.push(...q.attributes.normal.array); if (qi) for (const v of qi) idx.push(v + off); else for (let v = 0; v < q.attributes.position.count; v++) idx.push(v + off); off += q.attributes.position.count; }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setIndex(idx);
    return out;
  };
  const specs = [
    { crown: () => cluster(3.2, 2.8, 7.4), trunk: new THREE.CylinderGeometry(0.22, 0.34, 6, 6).translate(0, 3, 0), col: [[0.2, 0.3, 0.12], [0.26, 0.34, 0.14], [0.34, 0.36, 0.14], [0.3, 0.28, 0.12]] },
    { crown: () => { const a = new THREE.ConeGeometry(2.6, 6, 9).translate(0, 5.5, 0), b = new THREE.ConeGeometry(2.0, 5.5, 9).translate(0, 8.6, 0), c = new THREE.ConeGeometry(1.3, 4.5, 9).translate(0, 11.6, 0); const pos = [], idx = []; let o = 0; for (const q of [a, b, c]) { const qq = q.toNonIndexed(); pos.push(...qq.attributes.position.array); o += qq.attributes.position.count; } const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.computeVertexNormals(); return out; }, trunk: new THREE.CylinderGeometry(0.2, 0.3, 4, 5).translate(0, 2, 0), col: [[0.1, 0.18, 0.1], [0.13, 0.2, 0.12], [0.09, 0.15, 0.09]] },
    { crown: () => cluster(10, 8, 36), trunk: new THREE.CylinderGeometry(1.1, 1.7, 34, 8).translate(0, 17, 0), col: [[0.72, 0.58, 0.16], [0.8, 0.66, 0.2], [0.66, 0.55, 0.18]], trunkCol: 0xb8b8b0 },
    { crown: () => cluster(4.4, 3.8, 9.6), trunk: new THREE.CylinderGeometry(0.4, 0.6, 8, 6).translate(0, 4, 0), col: [[0.07, 0.12, 0.07], [0.09, 0.13, 0.08], [0.1, 0.11, 0.08]] },
  ];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  kinds.forEach((list, k) => {
    if (!list.length) return;
    const sp = specs[k];
    const crowns = new THREE.InstancedMesh(sp.crown(), crownMat, list.length);
    const trunks = new THREE.InstancedMesh(sp.trunk, sp.trunkCol ? new THREE.MeshStandardMaterial({ color: sp.trunkCol, roughness: 0.8 }) : trunkMat, list.length);
    list.forEach(([x, nz, sc], i) => {
      const z = -nz;
      if (Math.hypot(x - (G.spawnX || 0), z - (G.spawnZ || 0)) < 5) sc = 0.0001;
      const y = hAt(x, z) - 0.3;
      q.setFromAxisAngle(up, (x * 13.7 + z * 7.1) % 6.28);
      s3.set(sc, sc * (0.85 + ((i * 7919) % 100) / 300), sc);
      p3.set(x, y, z);
      m4.compose(p3, q, s3);
      crowns.setMatrixAt(i, m4); trunks.setMatrixAt(i, m4);
      const cc = sp.col[i % sp.col.length];
      const v = 0.85 + ((i * 2654435761) % 1000) / 3300;
      c.setRGB(cc[0] * v, cc[1] * v, cc[2] * v, THREE.SRGBColorSpace);
      crowns.setColorAt(i, c);
    });
    crowns.castShadow = true; trunks.castShadow = true; crowns.receiveShadow = true;
    group.add(crowns, trunks);
  });
  return group;
}

const WALLC = { hobbit: [0.55, 0.62, 0.3], bree: [0.62, 0.55, 0.45], rohan: [0.5, 0.36, 0.22], gondor: [0.86, 0.84, 0.8], minastirith: [0.92, 0.91, 0.88], osgiliath: [0.66, 0.64, 0.6], elf: [0.86, 0.85, 0.8], lorien: [0.9, 0.9, 0.86], lake: [0.42, 0.32, 0.24], dale: [0.62, 0.56, 0.5], harad: [0.84, 0.76, 0.6], isengard: [0.2, 0.2, 0.22], mordor: [0.14, 0.13, 0.14], morgul: [0.58, 0.66, 0.62], east: [0.7, 0.6, 0.45], beorning: [0.45, 0.33, 0.2] };
function buildBuildings(B, X0, Y0, hAt) {
  const pos = [], col = [], idx = [];
  let vi = 0;
  const addQuad = (a, b, c2, d, cr) => { for (const v of [a, b, c2, d]) { pos.push(v[0], v[1], v[2]); col.push(cr[0], cr[1], cr[2]); } idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3); vi += 4; };
  const addTri = (a, b, c2, cr) => { for (const v of [a, b, c2]) { pos.push(v[0], v[1], v[2]); col.push(cr[0], cr[1], cr[2]); } idx.push(vi, vi + 1, vi + 2); vi += 3; };
  const box = (cx, cz, w, d, ang, y0, h, wall, roof, gable, ruin) => {
    const ca = Math.cos(-ang), sa = Math.sin(-ang);
    const P = (lx, lz, y) => [cx + lx * ca - lz * sa, y, cz + lx * sa + lz * ca];
    const hw = w / 2, hd = d / 2, y1 = y0 + h;
    const shade = f => wall.map(v => v * f);
    addQuad(P(-hw, hd, y0), P(hw, hd, y0), P(hw, hd, y1), P(-hw, hd, y1), shade(0.95));
    addQuad(P(hw, -hd, y0), P(-hw, -hd, y0), P(-hw, -hd, y1), P(hw, -hd, y1), shade(0.8));
    addQuad(P(hw, hd, y0), P(hw, -hd, y0), P(hw, -hd, y1), P(hw, hd, y1), shade(0.88));
    addQuad(P(-hw, -hd, y0), P(-hw, hd, y0), P(-hw, hd, y1), P(-hw, -hd, y1), shade(0.84));
    if (ruin) return;
    if (gable) {
      const rh = Math.min(w, d) * 0.45, ov = 0.4;
      if (w >= d) {
        addQuad(P(-hw - ov, hd + ov, y1), P(hw + ov, hd + ov, y1), P(hw + ov, 0, y1 + rh), P(-hw - ov, 0, y1 + rh), roof);
        addQuad(P(hw + ov, -hd - ov, y1), P(-hw - ov, -hd - ov, y1), P(-hw - ov, 0, y1 + rh), P(hw + ov, 0, y1 + rh), roof.map(v => v * 0.8));
        addTri(P(hw, hd, y1), P(hw, -hd, y1), P(hw, 0, y1 + rh), shade(0.9)); addTri(P(-hw, -hd, y1), P(-hw, hd, y1), P(-hw, 0, y1 + rh), shade(0.9));
      } else {
        addQuad(P(hw + ov, hd + ov, y1), P(hw + ov, -hd - ov, y1), P(0, -hd - ov, y1 + rh), P(0, hd + ov, y1 + rh), roof);
        addQuad(P(-hw - ov, -hd - ov, y1), P(-hw - ov, hd + ov, y1), P(0, hd + ov, y1 + rh), P(0, -hd - ov, y1 + rh), roof.map(v => v * 0.8));
        addTri(P(-hw, hd, y1), P(hw, hd, y1), P(0, hd, y1 + rh), shade(0.9)); addTri(P(hw, -hd, y1), P(-hw, -hd, y1), P(0, -hd, y1 + rh), shade(0.9));
      }
    } else addQuad(P(-hw, hd, y1), P(hw, hd, y1), P(hw, -hd, y1), P(-hw, -hd, y1), roof);
  };
  const mound = (cx, cz, r, y0, door) => {
    const seg = 10, rings = 4, base = vi;
    for (let j = 0; j <= rings; j++) { const phi = j / rings * Math.PI / 2; for (let i = 0; i <= seg; i++) { const th = i / seg * Math.PI * 2; pos.push(cx + Math.cos(th) * Math.cos(phi) * r, y0 + Math.sin(phi) * r * 0.55, cz + Math.sin(th) * Math.cos(phi) * r); const g = 0.85 + 0.15 * Math.sin(phi); col.push(0.3 * g, 0.42 * g, 0.16 * g); } }
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) { const a = base + j * (seg + 1) + i, b = a + seg + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    vi += (rings + 1) * (seg + 1);
    // round door facing south-ish
    const dc = door, dr = 0.9, dz = cz + r * 0.93, dy = y0 + 0.95, base2 = vi;
    pos.push(cx, dy, dz + 0.05); col.push(dc[0], dc[1], dc[2]);
    for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI * 2; pos.push(cx + Math.cos(a) * dr, dy + Math.sin(a) * dr, dz + 0.05); col.push(dc[0], dc[1], dc[2]); }
    for (let i = 1; i <= 12; i++) idx.push(base2, base2 + i, base2 + i + 1);
    vi += 14;
  };
  for (const b of B.list) {
    const x = (b.x - X0) * MI, z = -(b.y - Y0) * MI;
    const y0 = hAt(x, z) - 0.5;
    const roof = b.c.map(v => Math.pow(v / 255, 2.2));
    const wall = (WALLC[b.culture] || [0.6, 0.55, 0.5]).map(v => Math.pow(v, 1.5));
    if (b.culture === 'hobbit' && b.round) { const doors = [[0.1, 0.25, 0.1], [0.6, 0.45, 0.1], [0.15, 0.25, 0.45], [0.5, 0.12, 0.08]]; mound(x, z, b.w * 0.8, y0, doors[Math.floor(Math.abs(b.x * 1e5)) % 4]); continue; }
    if (b.round) { box(x, z, b.w * 0.8, b.w * 0.8, b.a, y0, b.h * 0.6, roof, roof, true); continue; }
    const gable = !['harad', 'minastirith', 'gondor', 'osgiliath', 'mordor', 'isengard'].includes(b.culture) || (b.culture === 'gondor' && b.w < 13);
    box(x, z, b.w, b.d, b.a, y0, b.h * (b.ruin ? 0.4 : 1), wall, roof, gable, b.ruin);
  }
  for (const s of B.special) {
    const cx = (s.x - X0) * MI, cz = -(s.y - Y0) * MI;
    const colr = s.c.map(v => Math.pow(v / 255, 2.2));
    if (s.type === 'arc') {
      const r = s.r * MI, steps = Math.max(24, Math.round(r / 8));
      for (let i = 0; i < steps; i++) {
        const a0 = s.a0 + (s.a1 - s.a0) * i / steps, a1 = s.a0 + (s.a1 - s.a0) * (i + 1) / steps, am = (a0 + a1) / 2;
        const x = cx + Math.cos(am) * r, z = cz - Math.sin(am) * r;
        if (Math.hypot(x - G.px, z - G.pz) > 4000) continue;
        const len = r * (a1 - a0) + 0.5;
        box(x, z, s.w, len, -am + Math.PI, hAt(x, z) - 2, s.h, colr, colr.map(v => v * 0.9), false);
      }
    } else if (s.type === 'tower') {
      if (Math.hypot(cx - G.px, cz - G.pz) > 20000) continue;
      const y0 = hAt(cx, cz) - 1;
      if (s.square) box(cx, cz, s.r * 2, s.r * 2, 0.3, y0, s.h, colr, colr.map(v => v * 0.7), false);
      else { box(cx, cz, s.r * 1.6, s.r * 1.6, 0, y0, s.h, colr, colr, false); box(cx, cz, s.r * 1.2, s.r * 1.2, 0.78, y0 + s.h, s.r * 1.4, colr, colr, true); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/* ---------------- grass ---------------- */
function makeGrass() {
  const blades = [], cols = [];
  for (let b = 0; b < 7; b++) {
    const a = Math.random() * Math.PI, r = Math.random() * 0.22, x = Math.cos(a * 2) * r, z = Math.sin(a * 2) * r, h = 0.12 + Math.random() * 0.26, w = 0.03;
    const dx = Math.cos(a) * w, dz = Math.sin(a) * w, lean = (Math.random() - 0.5) * 0.25;
    blades.push(x - dx, 0, z - dz, x + dx, 0, z + dz, x + lean, h, z + lean * 0.5);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(blades, 3)); geo.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vTip;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvTip = position.y * 3.0; transformed.x += sin(uTime * 1.7 + instanceMatrix[3].x * 0.3 + instanceMatrix[3].z * 0.2) * 0.05 * position.y * 3.0;');
    sh.uniforms.uTime = G.grassTime;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vTip;').replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= mix(0.55, 1.15, clamp(vTip, 0.0, 1.0));');
  };
  G.grassMat = mat;
  const N = innerWidth < 760 ? 9000 : 22000;
  const m = new THREE.InstancedMesh(geo, mat, N);
  m.frustumCulled = false; m.receiveShadow = true;
  G.grass = m; G.grassN = N; G.scene.add(m);
}
function placeGrass() {
  if (!G.grass || !G.nearCanvas) return;
  const ctx = G.nearCtx || (G.nearCtx = G.nearCanvas.getContext('2d', { willReadFrequently: true }));
  const R = 38, half = G.nearHalf, W = G.nearCanvas.width;
  const img = ctx.getImageData(0, 0, W, W).data;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  let k = 0;
  for (let i = 0; i < G.grassN; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * R;
    const x = G.px + Math.cos(a) * r, z = G.pz + Math.sin(a) * r;
    const u = Math.floor((x - G.nearOff.x + half) / (2 * half) * W), v = Math.floor((z - G.nearOff.z + half) / (2 * half) * W);
    if (u < 0 || v < 0 || u >= W || v >= W) continue;
    const o = (v * W + u) * 4, rr = img[o], gg = img[o + 1], bb = img[o + 2];
    if (gg < rr * 0.85 || bb > gg * 1.1 || gg < 40) continue;      // skip water, rock, bare earth, dark forest floor
    p.set(x, groundAt(x, z) - 0.02, z);
    q.setFromAxisAngle(up, Math.random() * 6.28);
    const sc = 0.7 + Math.random() * 0.8; s.set(sc, sc * (0.8 + Math.random() * 0.6), sc);
    m4.compose(p, q, s); G.grass.setMatrixAt(k, m4);
    c.setRGB(rr / 255 * 1.05, gg / 255 * 1.1, bb / 255 * 0.9, THREE.SRGBColorSpace); G.grass.setColorAt(k, c);
    k++;
  }
  G.grass.count = k; G.grass.instanceMatrix.needsUpdate = true; if (G.grass.instanceColor) G.grass.instanceColor.needsUpdate = true;
  G.grassAt = { x: G.px, z: G.pz };
}

/* ---------------- atmosphere ---------------- */
function updateAtmos(recompute) {
  const o = G.o;
  const X = G.X0 + G.px / MI, Y = G.Y0 - G.pz / MI;
  if (recompute || !G.wx) G.wx = o.weatherAt(X, Y, G.t, o.staticAt(X, Y));
  const [lon, lat] = window.GEN.toLL(X, Y);
  const sv = window.WX.sunVector(G.t, lon, lat);
  const el = sv.el * Math.PI / 180, az = sv.az * Math.PI / 180;
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  const day = Math.max(0, Math.min(1, (sv.el + 3) / 12));
  const dusk = Math.max(0, 1 - Math.abs(sv.el - 2) / 9);
  const cl = G.wx.C, dark = G.wx.dark || 0;
  const mixC = (a, b, t) => a.clone().lerp(b, t);
  const zen = mixC(new THREE.Color(0x05070f), new THREE.Color(0x2f62a8), day).lerp(new THREE.Color(0x8a939c), cl * 0.75 * day);
  let hor = mixC(new THREE.Color(0x0d1220), new THREE.Color(0xc4d7e6), day).lerp(new THREE.Color(0xf0a36a), dusk * 0.7 * (1 - cl)).lerp(new THREE.Color(0xaab2b8), cl * 0.6 * day);
  if (dark > 0.05) { zen.lerp(new THREE.Color(0x1c130e), dark * 0.9); hor.lerp(new THREE.Color(0x3a2a20), dark * 0.85); }
  const u = G.skyMat.uniforms;
  u.sunDir.value.copy(dir.y > -0.05 ? dir : dir.clone().negate()); u.zen.value.copy(zen); u.hor.value.copy(hor);
  u.cloud.value = Math.min(1, cl * 1.05 + dark * 0.6);
  u.night.value = 1 - day;
  u.cloudCol.value.copy(mixC(new THREE.Color(0x1a1e28), new THREE.Color(0xf4f6f8), day).lerp(new THREE.Color(0x9ca3aa), G.wx.R > 0.3 ? 0.7 : cl * 0.4).lerp(new THREE.Color(0x2c2018), dark));
  u.sunCol.value.copy(mixC(new THREE.Color(0xffffff), new THREE.Color(0xffa860), dusk));
  const sunI = day * (1 - cl * 0.75) * (1 - dark * 0.9);
  G.sun.intensity = 0.25 + 3.0 * sunI;
  G.sun.color.copy(mixC(new THREE.Color(0x8fa6d8), mixC(new THREE.Color(0xfff4e6), new THREE.Color(0xffb070), dusk), day));
  G.sunDir = dir.y > 0 ? dir : new THREE.Vector3(0.3, 0.6, 0.2);
  G.hemi.intensity = 0.25 + 0.95 * day * (1 - dark * 0.7);
  if (G.grassMat) G.grassMat.color.setScalar(0.25 + 0.75 * day * (1 - cl * 0.3) * (1 - dark * 0.7));
  G.hemi.color.copy(mixC(new THREE.Color(0x303a58), zen.clone().lerp(new THREE.Color(0xffffff), 0.4), day));
  G.scene.fog.color.copy(hor);
  const vis = (G.wx.R > 0.3 ? 12000 : 90000) * (1 - cl * 0.35) * (1 - dark * 0.7);
  G.scene.fog.near = Math.min(3000, vis * 0.08); G.scene.fog.far = vis;
  G.renderer.toneMappingExposure = 0.55 + 0.6 * day;
  G.rain.visible = G.wx.R > 0.15;
  G.rain.material.size = G.wx.snow > 0.5 ? 0.16 : 0.07;
  G.rain.material.opacity = Math.min(0.85, 0.3 + G.wx.R * 0.12);
  const P = window.WX.parts(G.t);
  $('#gsub').textContent = `${Math.round(groundAt(G.px, G.pz))} m · ${P.name} ${window.WX.fmtTime(P.hour)} · ${Math.round(G.wx.T)}° ${G.wx.sky.toLowerCase()} · wind ${G.wx.windFrom} ${Math.round(G.wx.kmh)} km/h`;
}

/* ---------------- labels & compass ---------------- */
function buildLabels() {
  const o = G.o, list = [];
  for (const p of o.places) {
    const dx = (p.X - G.X0) * MI, dz = -(p.Y - G.Y0) * MI, d = Math.hypot(dx, dz);
    if (d < 60 || d > 70000 || (p.rank > 3 && d > 12000) || (p.rank > 4 && d > 4000)) continue;
    list.push({ name: p.name, x: dx, z: dz, d, rank: p.rank });
  }
  for (const p of o.peaks) {
    if (p.kind === 'seamount') continue;
    const dx = (p.x - G.X0) * MI, dz = -(p.y - G.Y0) * MI, d = Math.hypot(dx, dz);
    if (d < 200 || d > 110000) continue;
    list.push({ name: p.name, x: dx, z: dz, d, rank: 2, peak: p.h });
  }
  list.sort((a, b) => a.rank - b.rank || a.d - b.d);
  G.labels = list.slice(0, 18);
  $('#glabels').innerHTML = G.labels.map(() => '<div hidden></div>').join('');
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  let s = '';
  for (let k = -1; k <= 2; k++) for (let i = 0; i < 72; i++) { const deg = i * 5; s += `<span style="display:inline-block;width:20px;text-align:center">${deg % 45 === 0 ? dirs[deg / 45] : deg % 15 === 0 ? '·' : ''}</span>`; }
  $('#gstrip').innerHTML = s;
}
const v3 = () => new THREE.Vector3();
function updateLabels() {
  const els = $('#glabels').children, w = innerWidth, h = innerHeight, p = v3();
  G.labels.forEach((L, i) => {
    const y = (G.farH ? (G.farH(L.x, L.z) ?? 0) : 0) + (L.peak ? 40 : 25) - (L.d * L.d) / (2 * 6371000);
    p.set(L.x, y, L.z).project(G.camera);
    const el = els[i];
    if (p.z > 1 || p.x < -1.1 || p.x > 1.1 || p.y < -1.1 || p.y > 1.1) { el.hidden = true; return; }
    el.hidden = false;
    el.style.left = ((p.x + 1) / 2 * w) + 'px'; el.style.top = ((1 - p.y) / 2 * h) + 'px';
    el.innerHTML = `${L.name}<small>${L.d > 1000 ? (L.d / 1000).toFixed(L.d > 10000 ? 0 : 1) + ' km' : Math.round(L.d) + ' m'}</small>`;
    el.style.opacity = Math.max(0.45, 1 - L.d / 90000);
  });
  const deg = ((G.yaw * 180 / Math.PI) % 360 + 360) % 360;
  const cw = $('#gcomp').clientWidth;
  $('#gstrip').style.left = (cw / 2 - (72 * 20 + deg * 4) - 10) + 'px';
}
function drawMini() {
  const c = $('#gmini'), g = c.getContext('2d'), W = c.width;
  if (!G.nearCanvas) return;
  const half = G.nearHalf, span = 1400;
  const cx = (G.px - G.nearOff.x + half) / (2 * half) * G.nearCanvas.width, cy = (G.pz - G.nearOff.z + half) / (2 * half) * G.nearCanvas.height;
  const s = span / (2 * half) * G.nearCanvas.width;
  g.save(); g.clearRect(0, 0, W, W);
  g.beginPath(); g.arc(W / 2, W / 2, W / 2, 0, 7); g.clip();
  g.drawImage(G.nearCanvas, cx - s / 2, cy - s / 2, s, s, 0, 0, W, W);
  g.translate(W / 2, W / 2); g.rotate(G.yaw);
  g.fillStyle = '#d9ac52'; g.strokeStyle = '#1a1408'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, -16); g.lineTo(10, 12); g.lineTo(0, 6); g.lineTo(-10, 12); g.closePath(); g.stroke(); g.fill();
  g.restore();
}

/* ---------------- patch loading ---------------- */
async function loadNear(Xc, Yc, offX, offZ) {
  const o = G.o, run = o.run, half = 2600, n = 321, mobile = innerWidth < 760;
  const [hr, tx, tr] = await Promise.all([
    run({ type: 'ph', X: Xc, Y: Yc, half, n }),
    textureFor(run, Xc, Yc, half, mobile ? 1536 : 2048, 8),
    run({ type: 'trees', X: Xc, Y: Yc, half, cell: 26, spacing: mobile ? 9 : 6.5, treeHalf: mobile ? 600 : 850, seed: 7, bHalf: half }),
  ]);
  if (G.nearGroup) { G.scene.remove(G.nearGroup); G.nearGroup.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material) { if (m.material.map) m.material.map.dispose(); m.material.dispose(); } }); }
  const grp = new THREE.Group();
  grp.position.set(offX, 0, offZ);
  const mesh = terrainMesh(hr.h, n, half, tx.tex, { detail: true, shadow: true, floor: G.seaLevel - 3 });
  grp.add(mesh, skirt(mesh, n, 120));
  G.nearH = heightFn(hr.h, n, half);
  G.nearOff = { x: offX, z: offZ };
  G.nearHalf = half; G.nearCanvas = tx.canvas;
  const hAt = (x, z) => Math.max(G.nearH(x, z) ?? 0, G.seaLevel);
  grp.add(buildTrees(tr.trees, hAt));
  G.px0 = G.px; G.pz0 = G.pz;
  const pxSave = G.px, pzSave = G.pz; G.px -= offX; G.pz -= offZ;
  grp.add(buildBuildings(tr.buildings, Xc, Yc, hAt));
  G.px = pxSave; G.pz = pzSave;
  G.scene.add(grp);
  G.nearGroup = grp;
  G.nearCtx = null;
  placeGrass();
}
async function loadFar(X, Y) {
  const run = G.o.run, half = 60000, n = 241;
  const [hr, tx] = await Promise.all([run({ type: 'ph', X, Y, half, n }), textureFor(run, X, Y, half, 1024, 4)]);
  G.farHeights = hr.h;
  G.farH = heightFn(hr.h, n, half);
  G.seaLevel = 0;
  G.hasSea = hr.water.some(v => v === 1);
  const mesh = terrainMesh(hr.h, n, half, tx.tex, { curv: true, hole: 2500, floor: -3 });
  G.scene.add(mesh); G.far = mesh;
  if (G.hasSea) {
    const sea = new THREE.Mesh(new THREE.CircleGeometry(200000, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1d4a66, roughness: 0.12, metalness: 0.1 }));
    sea.position.y = -0.5; G.scene.add(sea); G.sea = sea;
  }
}

/* ---------------- lifecycle ---------------- */
async function open(o) {
  const root = $('#ground');
  root.classList.add('open');
  $('#gload').hidden = false; $('#gload').textContent = 'Walking out…';
  $('#gplace').textContent = o.title; $('#gsub').textContent = o.sub;
  try { await ensure(); } catch (e) { $('#gload').textContent = 'The 3D engine could not be loaded.'; return; }
  resize();
  G.o = o; G.t = o.t; G.X0 = o.X; G.Y0 = o.Y; G.px = 0; G.pz = 0; G.yaw = (o.heading || 0) * Math.PI / 180; G.pitch = 0.02; G.fly = 0;
  G.seaLevel = 0; G.nearH = null; G.farH = null; G.wx = null; G.grassAt = null; G.nearCanvas = null; if (G.grass) G.grass.count = 0; G.spawnX = 0; G.spawnZ = 0; G.camera.position.set(0, 0, 0);
  for (const k of ['far', 'sea', 'nearGroup']) if (G[k]) { G.scene.remove(G[k]); G[k] = null; }
  G.active = true;
  loop();
  $('#gload').textContent = 'Surveying the horizon…';
  await loadFar(o.X, o.Y);
  updateAtmos(true); buildLabels();
  $('#gload').textContent = 'Growing the grass…';
  await loadNear(o.X, o.Y, 0, 0);
  $('#gload').hidden = true;
}
function close() {
  G.active = false;
  $('#ground').classList.remove('open');
  if (G.o && G.o.onExit) G.o.onExit();
}
let lastT = 0, streaming = false;
function loop(ts = 0) {
  if (!G.active) return;
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (ts - lastT) / 1000 || 0.016); lastT = ts;
  const run = keys.shift ? 26 : 5.2;
  let f = 0, s = 0;
  if (keys.w || keys.arrowup) f += 1; if (keys.s || keys.arrowdown) f -= 1;
  if (keys.d || keys.arrowright) s += 1; if (keys.a || keys.arrowleft) s -= 1;
  if (keys.arrowleft && !keys.a) { G.yaw -= dt * 1.2; s += 1; }
  if (keys.arrowright && !keys.d) { G.yaw += dt * 1.2; s -= 1; }
  const fx = Math.sin(G.yaw), fz = -Math.cos(G.yaw);
  G.px += (fx * f + Math.cos(G.yaw) * s) * run * dt * (1 + G.fly / 40);
  G.pz += (fz * f + Math.sin(G.yaw) * s) * run * dt * (1 + G.fly / 40);
  if (keys[' ']) G.fly = Math.min(3000, G.fly + dt * (20 + G.fly));
  if (keys.c) G.fly = Math.max(0, G.fly - dt * (20 + G.fly));
  const lim = 55000; G.px = Math.max(-lim, Math.min(lim, G.px)); G.pz = Math.max(-lim, Math.min(lim, G.pz));
  const gy = groundAt(G.px, G.pz);
  const eye = gy + 1.7 + G.fly;
  G.camera.position.set(G.px, G.camera.position.y ? G.camera.position.y + (eye - G.camera.position.y) * Math.min(1, dt * 12) : eye, G.pz);
  const cp = Math.cos(G.pitch);
  G.camera.lookAt(G.px + Math.sin(G.yaw) * cp, G.camera.position.y + Math.sin(G.pitch), G.pz - Math.cos(G.yaw) * cp);
  G.sky.position.copy(G.camera.position);
  if (G.sunDir) {
    G.sun.position.set(G.px + G.sunDir.x * 1200, G.camera.position.y + G.sunDir.y * 1200, G.pz + G.sunDir.z * 1200);
    G.sun.target.position.set(G.px, G.camera.position.y, G.pz); G.sun.target.updateMatrixWorld();
  }
  G.skyMat.uniforms.time.value += dt;
  G.grassTime.value += dt;
  if (G.grassAt && Math.hypot(G.px - G.grassAt.x, G.pz - G.grassAt.z) > 12) placeGrass();
  if (G.rain.visible) {
    const a = G.rain.geometry.attributes.position, sp = G.wx.snow > 0.5 ? 2.2 : 14;
    for (let i = 0; i < a.count; i++) { let y = a.getY(i) - sp * dt; if (y < 0) y += 60; a.setY(i, y); }
    a.needsUpdate = true; G.rain.position.set(G.px, G.camera.position.y - 20, G.pz);
  }
  // stream a new near patch when the walker strays
  if (G.nearOff && !streaming && Math.hypot(G.px - G.nearOff.x, G.pz - G.nearOff.z) > 1500) {
    streaming = true;
    const ox = G.px, oz = G.pz;
    loadNear(G.X0 + ox / MI, G.Y0 - oz / MI, ox, oz).then(() => { streaming = false; }).catch(() => { streaming = false; });
  }
  if (G.labels) updateLabels();
  drawMini();
  if (G.wx && Math.floor(ts / 1000) !== G.lastSec) { G.lastSec = Math.floor(ts / 1000); updateAtmos(G.lastSec % 10 === 0); }
  G.renderer.render(G.scene, G.camera);
}

window.GROUND = { open, close, G };
