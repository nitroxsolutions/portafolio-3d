// Portafolio 3D · v2: mundo con modelos reales CC0 (Kenney), río con puente, fuente y lugares por sección
// Manejo arcade con modelo de bicicleta, llantas que ruedan por distancia, direccion en las delanteras,
// inclinacion de carroceria, polvo, colisiones que deslizan (sin atorarse), camara que sigue y
// estaciones del portafolio que se abren al acercarse.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const params = new URLSearchParams(location.search);
const DEMO = params.has('demo');

// ------------------------------------------------------------------ escena
const host = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: DEMO });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;   // reflejos suaves para pintura, cromo y vidrio
scene.environmentIntensity = 0.75;
scene.fog = new THREE.Fog(0xf39a4a, 34, 92);
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 6, -10);

scene.add(new THREE.HemisphereLight(0xfff1dc, 0xd9772a, 1.15));
const sun = new THREE.DirectionalLight(0xfff0d6, 2.2);
sun.position.set(-12, 22, -8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
scene.add(sun, sun.target);

// ------------------------------------------------------------------ carga (modelos reales CC0 de Kenney + jeep)
const ui = { loader: document.getElementById('loader'), txt: document.getElementById('loadtxt'), kmh: document.getElementById('kmh'),
  card: document.getElementById('card'), cardTag: document.getElementById('cardTag'), cardTitle: document.getElementById('cardTitle'), cardBody: document.getElementById('cardBody') };
const manager = new THREE.LoadingManager();
manager.onProgress = (_, a, b) => { ui.txt.textContent = `Cargando el mundo… ${Math.round(a / b * 100)}%`; };
manager.onLoad = () => setTimeout(() => ui.loader.classList.add('done'), 300);
const loader = new GLTFLoader(manager);
const cache = {};
function model(path) {
  if (!cache[path]) cache[path] = new Promise(res => loader.load(path, g => {
    g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    res(g.scene);
  }, undefined, () => res(null)));
  return cache[path];
}
const M = n => `assets/models/${n}.glb`;
const obstacles = [];          // {x, z, r} colisionadores circulares
// coloca una copia de un modelo; parent puede ser un grupo (coordenadas locales)
const fadeables = [];          // árboles, rocas y faroles que se transparentan si tapan al jeep
function place(path, x, z, scale = 1, rotY = 0, r = 0, y = 0, parent = scene, fade = false) {
  if (r && parent === scene) obstacles.push({ x, z, r });
  return model(path).then(src => {
    if (!src) return null;
    const o = src.clone(); o.position.set(x, y, z); o.rotation.y = rotY; o.scale.setScalar(scale); parent.add(o);
    if (fade) {
      const mats = [];
      o.traverse(c => { if (c.isMesh) { c.material = [].concat(c.material).map(m => { const k = m.clone(); k.transparent = true; mats.push(k); return k; }); if (c.material.length === 1) c.material = c.material[0]; } });
      fadeables.push({ o, x, z, rad: 0.6 + scale * 0.45, mats, op: 1 });
    }
    return o;
  });
}
function updateFade(dt) {
  const cx = camera.position.x, cz = camera.position.z, vx = car.x - cx, vz = car.z - cz, L2 = vx * vx + vz * vz || 1;
  for (const f of fadeables) {
    let u = ((f.x - cx) * vx + (f.z - cz) * vz) / L2; u = Math.max(0, Math.min(1, u));
    const d = Math.hypot(cx + vx * u - f.x, cz + vz * u - f.z);
    const target = (u > 0.02 && u < 0.97 && d < f.rad) || Math.hypot(f.x - cx, f.z - cz) < f.rad + 0.8 ? 0.18 : 1;
    if (Math.abs(target - f.op) > 0.01) { f.op += (target - f.op) * Math.min(1, dt * 8); for (const m of f.mats) { m.opacity = f.op; m.depthWrite = f.op > 0.95; } }
  }
}
const rand = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

// ------------------------------------------------------------------ isla de pasto con camino de tierra
function canvasTex(size, draw, rep) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 8; return t;
}
const grassTex = canvasTex(512, (g, n) => {
  g.fillStyle = '#7cc25a'; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 2600; i++) { const v = rand(); g.fillStyle = v < .45 ? 'rgba(96,170,70,.55)' : v < .8 ? 'rgba(150,212,96,.5)' : 'rgba(70,140,60,.4)';
    const x = rand() * n, y = rand() * n; g.beginPath(); g.ellipse(x, y, 2 + rand() * 7, 1 + rand() * 3, rand() * 3, 0, 7); g.fill(); }
}, 26);
const ground = new THREE.Mesh(new THREE.CircleGeometry(70, 128), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
// orilla de la isla: tierra que cae hacia el fondo naranja
const cliff = new THREE.Mesh(new THREE.CylinderGeometry(70, 63, 7, 128, 1, true), new THREE.MeshStandardMaterial({ color: 0xb8743f, roughness: 1, side: THREE.DoubleSide }));
cliff.position.y = -3.5; scene.add(cliff);
const dirtTex = canvasTex(256, (g, n) => {
  g.fillStyle = '#e2b77c'; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 900; i++) { g.fillStyle = rand() < .5 ? 'rgba(196,148,92,.55)' : 'rgba(244,214,160,.6)'; g.beginPath(); g.arc(rand() * n, rand() * n, .8 + rand() * 2.4, 0, 7); g.fill(); }
}, 18);
const road = new THREE.Mesh(new THREE.RingGeometry(12.5, 15.5, 160), new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 1 }));
road.rotation.x = -Math.PI / 2; road.position.y = 0.01; road.receiveShadow = true; scene.add(road);

// ------------------------------------------------------------------ río con puente de madera
const RIVER_A = 4.42;                        // donde el río cruza el camino (entre Estudio y Contacto)
const riverPts = [];
for (let i = 0; i <= 58; i++) {             // nace en un estanque junto a la fuente y sale hacia la orilla
  const r = 5.6 + i * 1.0, w = Math.sin(i * 0.33) * 1.6 * Math.min(1, i / 6) * (r > 11 && r < 17 ? 0.15 : 1);
  const a = RIVER_A + w / r;
  riverPts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
}
const waterTex = canvasTex(256, (g, n) => {
  g.fillStyle = '#3aa7d8'; g.fillRect(0, 0, n, n);
  g.strokeStyle = 'rgba(220,245,255,.55)'; g.lineWidth = 2;
  for (let i = 0; i < 40; i++) { const x = rand() * n, y = rand() * n, l = 10 + rand() * 26; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 4, x + l, y); g.stroke(); }
}, 1);
waterTex.repeat.set(1, 14);
function strip(pts, width, y) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[Math.min(i + 1, pts.length - 1)], o = pts[Math.max(i - 1, 0)];
    const d = new THREE.Vector3().subVectors(q, o).normalize(), nn = new THREE.Vector3(-d.z, 0, d.x);
    const ww = width * (0.88 + 0.12 * Math.sin(i * 0.7));
    pos.push(p.x + nn.x * ww / 2, y, p.z + nn.z * ww / 2, p.x - nn.x * ww / 2, y, p.z - nn.z * ww / 2);
    uv.push(0, i / pts.length, 1, i / pts.length);
    if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
const bank = new THREE.Mesh(strip(riverPts, 4.6, 0.015), new THREE.MeshStandardMaterial({ color: 0xc89a62, roughness: 1, side: THREE.DoubleSide }));
bank.receiveShadow = true; scene.add(bank);
const waterMat = new THREE.MeshStandardMaterial({ map: waterTex, color: 0x9fd6f0, roughness: 0.38, envMapIntensity: 0.5, metalness: 0.0, transparent: true, opacity: 0.93, side: THREE.DoubleSide });
const water = new THREE.Mesh(strip(riverPts, 3.3, 0.035), waterMat); scene.add(water);
const pond = new THREE.Mesh(new THREE.CircleGeometry(2.3, 48), waterMat); pond.rotation.x = -Math.PI / 2; pond.position.set(riverPts[0].x, 0.036, riverPts[0].z); scene.add(pond);
// el río no se cruza en jeep, salvo por el puente
for (const p of riverPts) { const r = Math.hypot(p.x, p.z); if (r > 11.4 && r < 16.6) continue; obstacles.push({ x: p.x, z: p.z, r: 1.35 }); }
obstacles.push({ x: riverPts[0].x, z: riverPts[0].z, r: 2.1 });
function nearRiver(x, z, m) { for (const p of riverPts) if (Math.hypot(p.x - x, p.z - z) < m) return true; return false; }
// puente: tablones planos sobre el agua (el jeep pasa encima) con barandal de madera
{
  const cx = Math.cos(RIVER_A) * 14, cz = Math.sin(RIVER_A) * 14;
  const deck = new THREE.Group(); deck.position.set(cx, 0.05, cz); deck.lookAt(0, 0.05, 0); scene.add(deck);   // z local apunta al centro
  const plankMat = new THREE.MeshStandardMaterial({ color: 0x9a6236, roughness: 0.85 });
  for (let i = -6; i <= 6; i++) { const pl = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 3.4), plankMat); pl.position.set(i * 0.47, 0.04, 0); pl.rotation.y = (rand() - .5) * .04; pl.castShadow = pl.receiveShadow = true; pl.rotation.order = 'YXZ'; deck.add(pl); }
  // los tablones van a lo largo del río (z local) y el barandal a los lados del camino
  for (const sz of [-1.75, 1.75]) for (const sx of [-2.1, 0, 2.1]) place(M('fence_simple'), sx, sz, 2.1, 0, 0, 0.08, deck);
}
// lirios y piedras en el río
for (let i = 3; i < riverPts.length; i += 4) { const p = riverPts[i], r = Math.hypot(p.x, p.z); if (r > 11 && r < 17) continue;
  place(M('lily_large'), p.x + (rand() - .5) * 1.2, p.z + (rand() - .5) * 1.2, 2.6, rand() * 6, 0, 0.04);
  place(M('stone_largeB'), p.x + (rand() > .5 ? 2.4 : -2.4), p.z + (rand() - .5), 0.9 + rand() * .6, rand() * 6); }

// ------------------------------------------------------------------ fuente al centro, con chorro de agua
place('assets/models/town/fountain-round-detail.glb', 0, 0, 2.6, 0, 2.9);
place('assets/models/town/fountain-center.glb', 0, 0, 2.6, 0, 0, 0.5);
const jetMat = new THREE.MeshStandardMaterial({ color: 0xc8eeff, transparent: true, opacity: 0.6, roughness: 0.1 });
const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.14, 1.5, 12, 1, true), jetMat); jet.position.set(0, 1.3, 0); scene.add(jet);
const drops = [];
for (let i = 0; i < 20; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), jetMat); scene.add(d); drops.push({ m: d, a: i / 20 * Math.PI * 2, t: i / 20 }); }
function updateFountain(t) {
  jet.scale.y = 1 + Math.sin(t * 6) * 0.05;
  for (const d of drops) { const u = (t * 0.7 + d.t) % 1, r = 0.2 + u * 1.5; d.m.position.set(Math.cos(d.a) * r, 2.05 + u * 1.1 - u * u * 2.6, Math.sin(d.a) * r); }
  waterTex.offset.y = -t * 0.12;
}

// ------------------------------------------------------------------ estaciones del portafolio (cada una con su lugar)
const STATIONS = [
  { id: 'proyectos', tag: 'Portafolio', title: 'Proyectos', color: '#e0640f', angle: 0.0, body: `
    <p>Videos y animaciones hechos de principio a fin: guion, diseño, animación, sonido y render.</p>
    <ul>
      <li><b>Raíces de esperanza, tierra que educa</b>Video del mural de 48 m del Maestro Alan David Barragán para la Secretaría de Educación de Durango.</li>
      <li><b>Carrera MTB Pancho Villa</b>Campaña en video para la carrera de montaña.</li>
      <li><b>Laptop NTX en Blender</b>Explosión 3D de una laptop pieza por pieza.</li>
      <li><b>El gatito de la buena suerte</b>Cortometraje en un mundo de papel de cuaderno.</li>
    </ul>`, props: [['town/stall-red', 0, 0, 2.6, 0, 1.6], ['town/cart', 2.7, 0.7, 1.8, 0.6, 1.0], ['town/banner-red', -2.0, 0.6, 2.4, 0, 0]] },
  { id: 'empresas', tag: 'Empresas', title: 'NTX Solutions', color: '#2f9d5a', angle: 1.26, body: `
    <p>Soluciones rápidas de tecnología: reparación de computadoras, software y academia de inteligencia artificial aplicada.</p>
    <ul><li><b>Reparación y soporte</b>Diagnóstico, mantenimiento y armado de equipos.</li>
        <li><b>Academia de IA</b>Cursos prácticos de IA generativa, datos y automatización.</li></ul>`, props: [['town/stall-green', 0, 0, 2.6, 0, 1.6], ['survival/workbench', 2.4, 0.6, 3.2, 0.4, 0.8], ['survival/chest', -2.3, 0.7, 3.0, -0.3, 0.7], ['town/banner-green', 2.0, -0.6, 2.4, 0, 0]] },
  { id: 'logros', tag: 'Trayectoria', title: 'Logros', color: '#c8366b', angle: 2.51, body: `
    <p>Maestro instructor de tecnología e inteligencia artificial aplicada. Ingeniero mecatrónico y de sistemas.</p>
    <ul><li><b>Video institucional SEED Durango</b>Presentado en la develación del mural (noviembre de 2026).</li>
        <li><b>Más logros</b>Próximamente.</li></ul>`, props: [['statue_obelisk', 0, -0.3, 3.8, 0, 0.8], ['town/pillar-stone', -2.1, 0.4, 2.6, 0, 0.4], ['town/pillar-stone', 2.1, 0.4, 2.6, 0, 0.4], ['town/banner-red', -2.1, 0.62, 2.2, 0, 0], ['town/banner-red', 2.1, 0.62, 2.2, 0, 0]] },
  { id: 'estudio', tag: 'Estudio', title: 'Motion & 3D', color: '#3a6fd6', angle: 3.77, body: `
    <p>Motion graphics, stop motion, animación 3D en Blender, edición de video y páginas web interactivas.</p>`, props: [['tent_detailedOpen', 0, -0.4, 3.4, Math.PI, 1.6], ['campfire_stones', 2.5, 1.1, 2.6, 0, 0], ['log', 2.5, 2.2, 2.6, 1.4, 0], ['survival/barrel', -2.3, 0.9, 3.0, 0, 0.5]] },
  { id: 'contacto', tag: 'Hablemos', title: 'Contacto', color: '#7a4ad8', angle: 5.03, body: `
    <p>¿Tienes un proyecto? Escríbeme.</p>
    <a class="btn" href="https://wa.me/message/CFMVFFA73APDP1" target="_blank" rel="noopener">WhatsApp</a>
    <a class="btn" href="https://www.facebook.com/tech.nitrox" target="_blank" rel="noopener">Facebook</a>
    <a class="btn" href="https://linkedin.com/in/ramosgerardo" target="_blank" rel="noopener">LinkedIn</a>`, props: [['survival/signpost', 0, 0, 4.4, 0, 0.5], ['pot_large', -1.7, 0.5, 2.4, 0, 0.6], ['pot_large', 1.7, 0.5, 2.4, 0, 0.6], ['flower_purpleA', -1.7, 0.5, 3.4, 0, 0, 0.45], ['flower_redA', 1.7, 0.5, 3.4, 0, 0, 0.45]] },
];
const STATION_R = 18.6, TRIGGER = 6.2;    // cada lugar queda a un lado del camino
function nearStation(x, z, m) { for (const st of STATIONS) { const sx = Math.cos(st.angle) * STATION_R, sz = Math.sin(st.angle) * STATION_R; if (Math.hypot(sx - x, sz - z) < m) return true; } return false; }
// letrero flotante: texto con buena tipografía, sin rectángulo
function labelSprite(text, color) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = 150; do { g.font = `700 ${fs}px "Baloo 2", "Nunito", sans-serif`; fs -= 6; } while (g.measureText(text).width > 920 && fs > 40);
  g.lineJoin = 'round'; g.lineWidth = 20; g.strokeStyle = 'rgba(70,30,8,.5)'; g.strokeText(text, 512, 124);
  g.fillStyle = '#fffaf2'; g.fillText(text, 512, 124);
  g.fillStyle = color; g.beginPath(); g.arc(512, 230, 13, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); sp.scale.set(5.6, 1.4, 1); return sp;
}
const decalTex = canvasTex(256, (g, n) => { const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  gr.addColorStop(0, 'rgba(255,255,255,.6)'); gr.addColorStop(.6, 'rgba(255,255,255,.2)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, n, n); }, 1);
function buildStations() {
  for (const st of STATIONS) {
    const x = Math.cos(st.angle) * STATION_R, z = Math.sin(st.angle) * STATION_R;
    st.pos = new THREE.Vector3(x, 0, z);
    const g = new THREE.Group(); g.position.copy(st.pos); g.lookAt(0, 0, 0); scene.add(g); g.updateMatrixWorld(); st.group = g;
    const pad = new THREE.Mesh(new THREE.CircleGeometry(3.7, 48), new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 1 })); pad.rotation.x = -Math.PI / 2; pad.position.y = 0.012; pad.receiveShadow = true; g.add(pad);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(4.8, 48), new THREE.MeshBasicMaterial({ map: decalTex, color: st.color, transparent: true, depthWrite: false, opacity: 0.5 }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.02; g.add(glow); st.glow = glow;
    for (const [n, px, pz, sc, ry, r, py] of st.props) {
      place(M(n), px, pz, sc, ry, 0, py || 0, g);
      if (r) { const v = new THREE.Vector3(px, 0, pz).applyMatrix4(g.matrixWorld); obstacles.push({ x: v.x, z: v.z, r }); }
    }
    const lab = labelSprite(st.title, st.color); lab.position.set(0, 4.3, 0); g.add(lab); st.label = lab;
    for (let k = 0; k < 3; k++) place(M('path_stone'), 0, 2.7 + k * 0.95, 1.6, 0, 0, 0.02, g);   // senda de piedras hacia el camino
  }
}
// las letras usan la tipografía de la página: se dibujan cuando ya cargó
(document.fonts && document.fonts.load ? Promise.all([document.fonts.load('700 80px "Baloo 2"'), document.fonts.ready]).catch(() => {}) : Promise.resolve()).then(() => {
  for (const st of STATIONS) if (st.label) { const nl = labelSprite(st.title, st.color); st.label.material.map = nl.material.map; st.label.material.needsUpdate = true; }
});
buildStations();

// ------------------------------------------------------------------ bosque, jardines y faroles (modelos reales)
const TREES = ['tree_oak', 'tree_default', 'tree_detailed', 'tree_fat', 'tree_pineRoundA', 'tree_pineTallA_detailed', 'tree_plateau', 'tree_oak_fall', 'tree_default_fall'];
let placed = 0;
for (let i = 0; i < 500 && placed < 72; i++) {
  const a = rand() * Math.PI * 2, d = 21 + rand() * 42, x = Math.cos(a) * d, z = Math.sin(a) * d;
  if (nearRiver(x, z, 3.8) || nearStation(x, z, 6.5)) continue;
  const n = TREES[Math.floor(rand() * TREES.length)], sc = 3.2 + rand() * 1.8;
  place(M(n), x, z, sc, rand() * 6, 0.5 * sc / 3.2, 0, scene, true); placed++;
}
for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + 0.3, d = 7.4 + (i % 2) * 2.0, x = Math.cos(a) * d, z = Math.sin(a) * d;   // arbolitos del jardín central
  if (nearRiver(x, z, 3.0) || Math.hypot(x, z + 8) < 3) continue; place(M(i % 2 ? 'tree_oak' : 'tree_detailed'), x, z, 2.4, rand() * 6, 0.45, 0, scene, true); }
const SMALL = ['plant_bushDetailed', 'plant_bushLarge', 'flower_redA', 'flower_yellowA', 'flower_purpleA', 'grass_large', 'mushroom_redGroup', 'stump_roundDetailed', 'flower_yellowA', 'flower_redA'];
for (let i = 0; i < 300; i++) {
  const a = rand() * Math.PI * 2, d = 4.4 + rand() * 56, x = Math.cos(a) * d, z = Math.sin(a) * d;
  if ((d > 11.8 && d < 16.2) || nearRiver(x, z, 2.5) || nearStation(x, z, 4.4) || d < 3.6 || Math.hypot(x, z + 8) < 2.4) continue;
  const n = SMALL[Math.floor(rand() * SMALL.length)];
  place(M(n), x, z, n.startsWith('flower') ? 3.4 : n === 'grass_large' ? 3 : 2.6, rand() * 6, 0, 0, scene, n.startsWith('plant'));
}
for (let i = 0; i < 26; i++) { const a = rand() * Math.PI * 2, d = 22 + rand() * 38, x = Math.cos(a) * d, z = Math.sin(a) * d;
  if (nearRiver(x, z, 3.4) || nearStation(x, z, 6)) continue; const big = rand() > .5;
  place(M(big ? 'rock_tallB' : (rand() > .5 ? 'rock_largeC' : 'rock_largeA')), x, z, big ? 2.4 : 2.2, rand() * 6, big ? 1.0 : 1.1, 0, scene, true); }
for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + 0.26; if (Math.abs(a - RIVER_A) < 0.25 || STATIONS.some(st => Math.abs(Math.atan2(Math.sin(a - st.angle), Math.cos(a - st.angle))) < 0.34)) continue;     // faroles del lado de adentro del camino
  const r = 11.8, x = Math.cos(a) * r, z = Math.sin(a) * r;
  place('assets/models/town/lantern.glb', x, z, 1.5, -a, 0.3, 0, scene, true); }

const S = 1.2;                                  // escala del jeep (mide ~2 m de largo)
const WHEEL_R = 0.2 * S, WHEELBASE = (0.627 + 0.566) * S;
const jeepRoot = new THREE.Group(); scene.add(jeepRoot);
const tilt = new THREE.Group(); jeepRoot.add(tilt);
const wheels = { lf: null, rf: null, lr: null, rr: null };
loader.load('assets/jeep_rubicon.glb', (gltf) => {
  const m = gltf.scene; m.scale.setScalar(S); m.position.y = 0.472 * S;
  m.traverse(o => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true;
      // pintura negra muy metalica se veia como un hueco: se vuelve laca con reflejos
      for (const mt of [].concat(o.material)) if (mt && mt.color) {
        const l = mt.color.r + mt.color.g + mt.color.b;
        if (l < 0.15) { mt.color.setRGB(0.045, 0.05, 0.06); mt.metalness = Math.min(mt.metalness ?? 0, 0.35); mt.roughness = 0.32; mt.envMapIntensity = 1.6; }
      } }
    if (o.name === 'LeftFrontWheel') wheels.lf = o; if (o.name === 'RightFrontWheel') wheels.rf = o;
    if (o.name === 'LeftRearWheel') wheels.lr = o; if (o.name === 'RightRearWheel') wheels.rr = o;
  });
  for (const w of Object.values(wheels)) if (w) w.rotation.order = 'ZYX';   // primero rueda (X), luego direccion (Z)
  tilt.add(m);
});

// letrero de piso mojado: obstaculo que se puede tumbar
const sign = { obj: null, pos: new THREE.Vector3(0, 0, 7), vel: new THREE.Vector3(), yaw: 0.4, fall: 0, fallV: 0, axis: new THREE.Vector3(1, 0, 0), state: 'up', t: 0 };
loader.load('assets/letter.glb', (gltf) => {
  const o = gltf.scene; o.scale.setScalar(0.034); o.traverse(c => { if (c.isMesh) { c.castShadow = true; } });
  const wrap = new THREE.Group(); wrap.add(o); scene.add(wrap); sign.obj = wrap;
});

// ------------------------------------------------------------------ entrada
const keys = { up: 0, down: 0, left: 0, right: 0, brake: 0 };
const MAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'brake' };
addEventListener('keydown', e => { if (MAP[e.code]) { keys[MAP[e.code]] = 1; e.preventDefault(); } });
addEventListener('keyup', e => { if (MAP[e.code]) keys[MAP[e.code]] = 0; });
addEventListener('blur', () => { for (const k in keys) keys[k] = 0; });
document.querySelectorAll('#touch button').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { keys[k] = 1; b.setPointerCapture(e.pointerId); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => { keys[k] = 0; });
});

// ------------------------------------------------------------------ vehiculo (modelo de bicicleta arcade)
const car = { x: 0, z: -8, heading: 0, speed: 0, steer: 0, spin: 0, pitch: 0, roll: 0, prevSpeed: 0 };
const P = { maxF: 9.0, maxR: 3.5, accel: 7.5, brake: 16, drag: 0.55, roll: 1.8, maxSteer: 0.6, steerRate: 3.2 };
const WORLD_R = 58;

function demoInput(t) {      // ruta automatica para pruebas (?demo)
  const k = { up: 0, down: 0, left: 0, right: 0, brake: 0 };
  if (t < 3.5) k.up = 1; else if (t < 7) { k.up = 1; k.left = 1; } else if (t < 10) k.up = 1; else if (t < 12) { k.up = 1; k.right = 1; } else k.brake = 1;
  return k;
}

function step(dt, t) {
  const k = DEMO ? demoInput(t) : keys;
  const throttle = k.up - k.down;
  // direccion: suave, y con menos angulo a mayor velocidad
  const steerTarget = (k.left - k.right) * P.maxSteer / (1 + Math.abs(car.speed) * 0.09);
  car.steer += (steerTarget - car.steer) * Math.min(1, P.steerRate * dt);
  // aceleracion / frenado
  let a = 0;
  if (k.brake) a = -Math.sign(car.speed) * P.brake;
  else if (throttle > 0) a = car.speed < -0.05 ? P.brake : P.accel * (1 - Math.max(0, car.speed) / P.maxF * 0.6);
  else if (throttle < 0) a = car.speed > 0.05 ? -P.brake : -P.accel * 0.7;
  else a = -Math.sign(car.speed) * P.roll;
  a -= car.speed * Math.abs(car.speed) * P.drag * 0.05;
  const before = car.speed; car.speed += a * dt;
  if ((throttle === 0 || k.brake) && Math.sign(before) !== Math.sign(car.speed)) car.speed = 0;
  car.speed = THREE.MathUtils.clamp(car.speed, -P.maxR, P.maxF);
  // el jeep solo gira si avanza (ya no gira sobre su eje parado)
  car.heading += (car.speed / WHEELBASE) * Math.tan(car.steer) * dt;
  let nx = car.x + Math.sin(car.heading) * car.speed * dt, nz = car.z + Math.cos(car.heading) * car.speed * dt;
  // colisiones: empujar fuera y deslizar (nunca se atora)
  const R = 1.05;
  for (const o of obstacles) {
    const dx = nx - o.x, dz = nz - o.z, d = Math.hypot(dx, dz), min = o.r + R;
    if (d < min && d > 1e-4) {
      nx = o.x + dx / d * min; nz = o.z + dz / d * min;
      const fx = Math.sin(car.heading), fz = Math.cos(car.heading), into = -(fx * dx + fz * dz) / d * Math.sign(car.speed);
      if (into > 0.3) car.speed *= 1 - 0.6 * into * Math.min(1, dt * 12);       // choque de frente: frena, no se queda pegado
    }
  }
  const dc = Math.hypot(nx, nz); if (dc > WORLD_R) { nx *= WORLD_R / dc; nz *= WORLD_R / dc; car.speed *= 0.96; }
  const moved = Math.hypot(nx - car.x, nz - car.z) * Math.sign(car.speed);
  car.x = nx; car.z = nz;
  // llantas: giran exactamente por la distancia recorrida; delanteras con direccion
  car.spin += moved / WHEEL_R;
  for (const [key, w] of Object.entries(wheels)) if (w) { w.rotation.x = car.spin; w.rotation.z = (key === 'lf' || key === 'rf') ? -car.steer : 0; }
  // carroceria: cabecea al acelerar/frenar y se inclina en curvas
  const accel = (car.speed - car.prevSpeed) / Math.max(dt, 1e-3); car.prevSpeed = car.speed;
  const lat = car.speed * (car.speed / WHEELBASE) * Math.tan(car.steer);
  car.pitch += (THREE.MathUtils.clamp(-accel * 0.006, -0.05, 0.05) - car.pitch) * Math.min(1, dt * 6);
  car.roll += (THREE.MathUtils.clamp(-lat * 0.01, -0.07, 0.07) - car.roll) * Math.min(1, dt * 6);
  jeepRoot.position.set(car.x, Math.abs(car.speed) > 0.5 ? Math.sin(t * 22) * 0.006 * Math.min(1, Math.abs(car.speed) / 4) : 0, car.z);
  jeepRoot.rotation.y = car.heading;
  tilt.rotation.set(car.pitch, 0, car.roll);
  return { accel, lat };
}

// ------------------------------------------------------------------ polvo
const DUST_N = 160;
const dustGeo = new THREE.BufferGeometry();
const dPos = new Float32Array(DUST_N * 3), dLife = new Float32Array(DUST_N), dVel = new Float32Array(DUST_N * 3);
dustGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
const dustTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,236,210,.9)'); gr.addColorStop(1, 'rgba(255,236,210,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.55, map: dustTex, transparent: true, depthWrite: false, opacity: 0.55 }));
scene.add(dust); let dustI = 0;
function emitDust(n) {
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1, j = dustI++ % DUST_N;
    const lx = side * 0.5 * S, lz = -0.62 * S, c = Math.cos(car.heading), s = Math.sin(car.heading);
    dPos[j * 3] = car.x + lx * c + lz * s; dPos[j * 3 + 1] = 0.08; dPos[j * 3 + 2] = car.z - lx * s + lz * c;
    dVel[j * 3] = (Math.random() - .5) * .6 - s * car.speed * .15; dVel[j * 3 + 1] = .4 + Math.random() * .5; dVel[j * 3 + 2] = (Math.random() - .5) * .6 - c * car.speed * .15;
    dLife[j] = 1;
  }
}
function updateDust(dt) {
  for (let j = 0; j < DUST_N; j++) {
    if (dLife[j] <= 0) { dPos[j * 3 + 1] = -10; continue; }
    dLife[j] -= dt * 1.3; dPos[j * 3] += dVel[j * 3] * dt; dPos[j * 3 + 1] += dVel[j * 3 + 1] * dt; dPos[j * 3 + 2] += dVel[j * 3 + 2] * dt;
  }
  dustGeo.attributes.position.needsUpdate = true;
}

// ------------------------------------------------------------------ letrero que se tumba
function updateSign(dt) {
  if (!sign.obj) return;
  const dx = sign.pos.x - car.x, dz = sign.pos.z - car.z, d = Math.hypot(dx, dz);
  if (d < 1.25 && Math.abs(car.speed) > 0.4) {
    const push = Math.abs(car.speed) * 0.9;
    sign.vel.set(dx / d * push, 0, dz / d * push);
    if (sign.state === 'up') { sign.state = 'falling'; sign.axis.set(dz / d, 0, -dx / d); sign.fallV = 2.5 + push; }
    car.speed *= 0.85;
  }
  if (sign.state === 'falling') { sign.fallV += 9 * dt; sign.fall = Math.min(Math.PI / 2 - 0.12, sign.fall + sign.fallV * dt); if (sign.fall >= Math.PI / 2 - 0.12) { sign.state = 'down'; sign.t = 0; } }
  if (sign.state === 'down') { sign.t += dt; if (sign.t > 6 && Math.hypot(car.x - 0, car.z - 7) > 4) { sign.state = 'up'; sign.fall = 0; sign.pos.set(0, 0, 7); } }
  sign.pos.addScaledVector(sign.vel, dt); sign.vel.multiplyScalar(Math.max(0, 1 - dt * 3));
  sign.obj.position.copy(sign.pos);
  sign.obj.quaternion.setFromAxisAngle(sign.axis, sign.fall).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sign.yaw));
}

// ------------------------------------------------------------------ estaciones: acercarse abre la tarjeta y la camara encuadra
let active = null;
function updateStations(t) {
  let near = null, best = 1e9;
  for (const st of STATIONS) {
    const d = Math.hypot(car.x - st.pos.x, car.z - st.pos.z);
    st.glow.material.opacity = 0.35 + 0.2 * Math.sin(t * 2.4 + st.angle * 2);
    st.label.position.y = 4.3 + Math.sin(t * 1.6 + st.angle) * 0.12;
    if (d < TRIGGER && d < best) { best = d; near = st; }
  }
  if (near !== active) {
    active = near;
    if (active) openCard(active); else if (!pinned) ui.card.classList.remove('show');
  }
  if (pinned && Math.hypot(car.x - pinned.pos.x, car.z - pinned.pos.z) > 30) { pinned = null; if (!active) ui.card.classList.remove('show'); }
}

let pinned = null;   // tarjeta abierta con clic (se cierra al alejarse mucho)
function openCard(st, byClick) {
  ui.cardTag.textContent = st.tag; ui.cardTitle.textContent = st.title; ui.cardBody.innerHTML = st.body;
  ui.card.style.setProperty("--accent", st.color); ui.card.classList.add("show");
  if (byClick) pinned = st;
}
// ------------------------------------------------------------------ camara + mouse
const camPos = new THREE.Vector3(0, 6, -10), camLook = new THREE.Vector3();
// zoom con la rueda (o pellizco) y orbita arrastrando; al soltar regresa poco a poco detras del jeep
const view = { zoom: 1, zoomT: 1, yaw: 0, pitch: 0, drag: null, idle: 0 };
const canvasEl = renderer.domElement;
canvasEl.addEventListener('wheel', e => { e.preventDefault(); view.zoomT = THREE.MathUtils.clamp(view.zoomT * Math.exp(e.deltaY * 0.0012), 0.45, 2.4); }, { passive: false });
const touches = new Map();
canvasEl.addEventListener('pointerdown', e => {
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  view.drag = { x: e.clientX, y: e.clientY, moved: 0 }; canvasEl.setPointerCapture(e.pointerId);
});
canvasEl.addEventListener('pointermove', e => {
  const prev = touches.get(e.pointerId);
  if (touches.size === 2 && prev) {           // pellizco en celular
    const [a, b] = [...touches.values()];
    const d0 = Math.hypot(a.x - b.x, a.y - b.y);
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const [c, d] = [...touches.values()];
    const d1 = Math.hypot(c.x - d.x, c.y - d.y);
    if (d0 > 0) view.zoomT = THREE.MathUtils.clamp(view.zoomT * d0 / d1, 0.45, 2.4);
    return;
  }
  if (prev) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (view.drag) {
    const dx = e.clientX - view.drag.x, dy = e.clientY - view.drag.y;
    view.drag.x = e.clientX; view.drag.y = e.clientY; view.drag.moved += Math.abs(dx) + Math.abs(dy);
    view.yaw -= dx * 0.006; view.pitch = THREE.MathUtils.clamp(view.pitch + dy * 0.004, -0.35, 0.9); view.idle = 0;
  } else {                                     // al pasar el mouse sobre un letrero, el cursor cambia
    canvasEl.style.cursor = pickStation(e) ? 'pointer' : 'grab';
  }
});
const endDrag = e => {
  touches.delete(e.pointerId);
  if (view.drag && view.drag.moved < 6) { const st = pickStation(e); if (st) openCard(st, true); }
  view.drag = null;
};
canvasEl.addEventListener('pointerup', endDrag); canvasEl.addEventListener('pointercancel', endDrag);
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pickStation(e) {
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(STATIONS.map(s => s.group), true)[0];
  return hit ? STATIONS.find(s => { let o = hit.object; while (o) { if (o === s.group) return true; o = o.parent; } return false; }) : null;
}
function updateCamera(dt) {
  view.zoom += (view.zoomT - view.zoom) * (1 - Math.exp(-dt * 8));
  view.idle += dt;
  if (!view.drag && view.idle > 1.2 && Math.abs(car.speed) > 0.5) {   // manejando: la orbita vuelve atras del jeep
    const r = 1 - Math.exp(-dt * 1.4); view.yaw -= view.yaw * r; view.pitch -= view.pitch * r;
  }
  const h = car.heading + view.yaw;
  const fx = Math.sin(h), fz = Math.cos(h), sp = Math.abs(car.speed);
  const back = (7.2 + sp * 0.25) * view.zoom * Math.cos(view.pitch * 0.6), up = (3.4 + sp * 0.08) * view.zoom + view.pitch * 6 * view.zoom;
  let want = new THREE.Vector3(car.x - fx * back, Math.max(0.8, up), car.z - fz * back);
  const ahead = 2.2 * Math.max(0, Math.cos(view.yaw));   // al orbitar se mira al jeep, no delante de el
  let look = new THREE.Vector3(car.x + Math.sin(car.heading) * ahead, 0.9, car.z + Math.cos(car.heading) * ahead);
  if (active && Math.abs(view.yaw) < 0.3) {   // encuadre de la estacion: entre el jeep y el letrero
    const mid = new THREE.Vector3((car.x + active.pos.x) / 2, 1.6, (car.z + active.pos.z) / 2);
    const out = new THREE.Vector3(mid.x, 0, mid.z).normalize();
    want.lerp(new THREE.Vector3(mid.x - out.x * 6.5 * view.zoom, 4.2 * view.zoom, mid.z - out.z * 6.5 * view.zoom), 0.55);
    look.lerp(new THREE.Vector3(active.pos.x, 1.8, active.pos.z), 0.6);
  }
  const k = 1 - Math.exp(-dt * (view.drag ? 10 : 3.2));
  camPos.lerp(want, k); camLook.lerp(look, 1 - Math.exp(-dt * 5));
  camera.position.copy(camPos); camera.lookAt(camLook);
  sun.position.set(car.x - 12, 22, car.z - 8); sun.target.position.set(car.x, 0, car.z);
}

// ------------------------------------------------------------------ bucle
const clock = new THREE.Clock(); let t = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 20); t += dt;
  const { accel, lat } = step(dt, t);
  if ((accel > 3 && car.speed > 0.3) || Math.abs(lat) > 4 || (keys.brake && Math.abs(car.speed) > 2)) emitDust(2);
  updateDust(dt); updateSign(dt); updateFountain(t); updateFade(dt); updateStations(t); updateCamera(dt);
  ui.kmh.textContent = Math.round(Math.abs(car.speed) * 3.6 * 2.1);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
camLook.set(0, 1, 0); frame();

addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
// para pruebas automaticas
window.__portfolio = { car, STATIONS, setCar: (x, z, h) => { car.x = x; car.z = z; car.heading = h; car.speed = 0; camPos.set(x - Math.sin(h) * 7, 3.4, z - Math.cos(h) * 7); } };
// ?at=<estacion> coloca el jeep frente a esa estacion (para revisar tarjetas)
if (params.get('at')) {
  const st = STATIONS.find(s => s.id === params.get('at'));
  if (st) { const a = st.angle, x = Math.cos(a) * (STATION_R - 4.2), z = Math.sin(a) * (STATION_R - 4.2); window.__portfolio.setCar(x, z, Math.atan2(st.pos.x - x, st.pos.z - z)); }
}
if (DEMO || params.get('at')) ui.loader.remove();   // en modo de prueba no se muestra la pantalla de carga
window.__portfolio.view = view;
if (params.get('zoom')) view.zoom = view.zoomT = +params.get('zoom');     // prueba: ?zoom=2.2
if (params.get('yaw')) view.yaw = +params.get('yaw');
if (params.get('dbg')) setInterval(() => { document.title = JSON.stringify({ cam: camera.position.toArray().map(v => +v.toFixed(2)), look: camLook.toArray().map(v => +v.toFixed(2)), car: [+car.x.toFixed(2), +car.z.toFixed(2), +car.heading.toFixed(2)], yaw: +view.yaw.toFixed(2) }); }, 200);
// tarjeta: botón cerrar · créditos · la ayuda de controles se desvanece sola
document.getElementById('cardClose').addEventListener('click', () => { ui.card.classList.remove('show'); pinned = null; });
document.getElementById('creditos-btn').addEventListener('click', () => document.getElementById('creditos').classList.toggle('show'));
setTimeout(() => document.getElementById('hint').classList.add('fade'), 12000);
