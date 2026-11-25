import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import * as D from './data.js';
import { buildTrajectory, R_MOON } from './traj.js';
import { createTerrain, heightAt, drop } from './terrain.js';
import { createLM } from './lm.js';
import { createSky, createEnvMap, createBoulders, createDust, createPathLine, createTargetMarker, dirFromAltAz } from './scene.js';
import { loadDEM, makeFrame, makeSampler } from './dem.js';

const $ = (id) => document.getElementById(id);
const FT = 0.3048;
const fail = (msg) => { const e = $('err'); e.textContent = msg; e.hidden = false; };

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
} catch (e) { fail('A böngésző nem tud WebGL-t futtatni, ezért a 3D jelenet nem jelenik meg.'); throw e; }
let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(pixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 2.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2e7);

// azimutok a keret +x tengelyéhez (FRAME_AZ) igazítva
const SUN = dirFromAltAz(D.SUN.alt, D.SUN.az - (D.FRAME_AZ - 90));
const EARTH = dirFromAltAz(D.EARTH.alt, D.EARTH.az - (D.FRAME_AZ - 90));
const T = buildTrajectory();

const terrain = createTerrain(D.NAMED_CRATERS);
terrain.uniforms.uSun.value.copy(SUN);
scene.add(terrain.mesh);
scene.environment = createEnvMap(renderer, SUN);
const sunLight = new THREE.DirectionalLight(0xfff4e6, 10);
sunLight.position.copy(SUN); scene.add(sunLight, sunLight.target);
scene.add(new THREE.HemisphereLight(0x000000, 0x6e685f, 0.55));
const lm = createLM(); scene.add(lm);
const sky = createSky(SUN, EARTH); scene.add(sky);
const worldGroup = new THREE.Group(); scene.add(worldGroup); // világkoordinátás objektumok, −origó eltolással
let boulders = createBoulders(D.NAMED_CRATERS);
worldGroup.add(boulders);
const helpers = new THREE.Group(); worldGroup.add(helpers);
const pathLine = createPathLine(T.path); helpers.add(pathLine);
const marker = createTargetMarker(); helpers.add(marker);
const dust = createDust(); scene.add(dust);
// jelölő a holdkomp körül, ha a távolság miatt túl kicsi
const tag = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.strokeStyle = '#e8c47a'; x.lineWidth = 6; x.beginPath(); x.arc(64, 64, 40, 0, Math.PI * 2); x.stroke();
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, depthWrite: false, sizeAttenuation: false, transparent: true }));
  s.scale.set(0.045, 0.045, 1); s.renderOrder = 10; scene.add(s); return s;
})();

// ---------------- állapot ----------------
const S = {
  get: D.T_START, playing: false, speed: 1, view: 'chase',
  yawOff: 0.75, pitchOff: 0.22, dist: 32, sideZoom: 1, look: { yaw: 0, pitch: 0 },
};
const clampGet = (g) => Math.min(Math.max(g, D.T_START), D.T_END);

// ---------------- kamera ----------------
const tmp = new THREE.Vector3(), up = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3();
const lmWorld = new THREE.Vector3();
const origin = { x: 0, y: 0, z: 0 };
const camWorld = new THREE.Vector3(), lookWorld = new THREE.Vector3();
const qYaw = new THREE.Quaternion(), qPitch = new THREE.Quaternion();
const AX_Y = new THREE.Vector3(0, 1, 0), AX_Z = new THREE.Vector3(0, 0, 1);
const SURF_CAM = new THREE.Vector3(-42, 0, 68);
SURF_CAM.y = heightAt(SURF_CAM.x, SURF_CAM.z, 0.5) + 1.7;

// ---------------- valós domborzat (LRO) betöltése a háttérben ----------------
const FRAME = makeFrame(D.SITE.lat, D.SITE.lon, D.FRAME_AZ);
const demStat = (t) => { const e = $('demstat'); if (e) e.textContent = t; };
(async () => {
  try {
    const meta = await (await fetch(D.DEM_META)).json();
    const sets = await loadDEM(meta, renderer.capabilities.maxTextureSize, (b) => demStat('Valós domborzat betöltése… ' + (b / 1e6).toFixed(1).replace('.', ',') + ' / 9,1 MB'));
    terrain.enableDEM(sets, FRAME, makeSampler(sets, FRAME, R_MOON));
    // a valódi West-kráter (a NAC DTM-ből kikeresve) körüli sziklamező
    const [e, s] = meta.west, n = -s;
    const west = { name: 'West', x: e * FRAME.sinA + n * FRAME.cosA, z: e * FRAME.cosA - n * FRAME.sinA, r: 95 };
    worldGroup.remove(boulders); boulders.geometry.dispose();
    boulders = createBoulders([west]); worldGroup.add(boulders);
    SURF_CAM.y = heightAt(SURF_CAM.x, SURF_CAM.z, 0.5) + 1.7;
    demStat('Valós domborzat: LRO SLDEM2015 + LROC NAC DTM (2 m)');
  } catch (err) {
    console.warn('DEM', err);
    demStat('A valós domborzat nem tölthető be – generált felszín');
  }
})();

function groundY(x, z) { return heightAt(x, z, 1.0) + drop(Math.hypot(x, z)); }

function placeCamera(st) {
  const phi = st.phi;
  up.set(Math.sin(phi), Math.cos(phi), 0);
  fwd.set(-Math.cos(phi), Math.sin(phi), 0);
  right.crossVectors(fwd, up).normalize();
  let fov = 50;
  if (S.view === 'chase') {
    const d = S.dist * Math.max(1, 0.95 / camera.aspect);
    tmp.copy(fwd).multiplyScalar(-Math.cos(S.pitchOff) * d).applyAxisAngle(up, S.yawOff).addScaledVector(up, Math.sin(S.pitchOff) * d);
    camWorld.copy(lmWorld).add(tmp);
    lookWorld.copy(lmWorld).addScaledVector(up, 3);
  } else if (S.view === 'side') {
    const d = Math.min(Math.max(st.alt * 0.9 + 60, 70), 12000) * S.sideZoom;
    camWorld.copy(lmWorld).addScaledVector(right, d).addScaledVector(up, d * 0.1).addScaledVector(fwd, d * 0.3);
    lookWorld.copy(lmWorld).addScaledVector(up, -Math.min(st.alt, d * 0.25) * 0.5);
  } else if (S.view === 'window') {
    const wc = lm.userData.windowCam;
    lm.updateMatrixWorld();
    camWorld.copy(wc.pos).applyMatrix4(lm.matrixWorld).add(tmp.set(origin.x, origin.y, origin.z));
    const dir = wc.look.clone().sub(wc.pos);
    dir.applyAxisAngle(AX_Y, S.look.yaw).applyAxisAngle(new THREE.Vector3(1, 0, 0), S.look.pitch);
    dir.transformDirection(lm.matrixWorld);
    lookWorld.copy(camWorld).addScaledVector(dir, 10);
    camera.up.set(0, 1, 0).transformDirection(lm.matrixWorld);
    fov = 58;
  } else { // felszínről – követő teleobjektív
    camWorld.copy(SURF_CAM);
    lookWorld.copy(lmWorld).addScaledVector(up, 3);
    const dd = camWorld.distanceTo(lookWorld);
    fov = THREE.MathUtils.clamp(2 * Math.atan(18 / dd) * 180 / Math.PI, 0.25, 55);
  }
  if (S.view !== 'window') {
    camera.up.copy(S.view === 'surface' ? AX_Y : up);
    if (S.view !== 'surface') {
      const gy = groundY(camWorld.x, camWorld.z) + 1.6;
      if (camWorld.y < gy) camWorld.y = gy;
    }
  }
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  camera.position.set(camWorld.x - origin.x, camWorld.y - origin.y, camWorld.z - origin.z);
  camera.lookAt(lookWorld.x - origin.x, lookWorld.y - origin.y, lookWorld.z - origin.z);
}

// ---------------- jelenet frissítése ----------------
const qLM = new THREE.Quaternion();
let dustLevel = 0, lastGet = S.get;
function updateScene(st, dtReal) {
  const r = R_MOON + st.alt;
  lmWorld.set(r * Math.sin(st.phi), r * Math.cos(st.phi) - R_MOON, 0);
  if (st.alt < 60) { const gy = groundY(lmWorld.x, lmWorld.z); if (lmWorld.y < gy) lmWorld.y = gy; }
  origin.x = lmWorld.x; origin.z = lmWorld.z; origin.y = drop(Math.hypot(origin.x, origin.z));
  lm.position.set(0, lmWorld.y - origin.y, 0);
  const p = THREE.MathUtils.degToRad(st.pitch), ph = st.phi;
  qPitch.setFromAxisAngle(AX_Z, -(ph + p));
  qYaw.setFromAxisAngle(AX_Y, THREE.MathUtils.degToRad(st.yaw));
  qLM.copy(qPitch).multiply(qYaw);
  lm.quaternion.copy(qLM);
  lm.userData.setThrottle(st.throttle);
  lm.userData.setProbes(st.get >= D.CONTACT ? Math.min((st.get - D.CONTACT) / 1.5, 1) : 0);
  worldGroup.position.set(-origin.x, -origin.y, -origin.z);

  // por: a kontaktfény előtti ~30 m-től, a motor leállításával azonnal megszűnik (vákuum)
  const target = st.engineOn ? THREE.MathUtils.smoothstep(32, 6, st.alt) * Math.min(st.throttle / 0.25, 1.2) : 0;
  dustLevel += (target - dustLevel) * Math.min(1, dtReal * (target > dustLevel ? 2 : 6));
  if (Math.abs(st.get - lastGet) > 2) dustLevel = target;
  lastGet = st.get;
  const gyLocal = groundY(lmWorld.x, lmWorld.z) - origin.y;
  dust.material.uniforms.uAmt.value = dustLevel;
  dust.material.uniforms.uCenter.value.set(0, gyLocal, 0);
  dust.material.uniforms.uTime.value = st.get;
  dust.material.uniforms.uSunI.value = 3.2;
  pathLine.material.uniforms.uNow.value = st.get;
  marker.visible = st.alt > 120;

  placeCamera(st);
  sky.position.copy(camera.position);
  tag.position.copy(lm.position).y += 3;
  { const px = (12 / Math.max(camera.position.distanceTo(tag.position), 1)) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) * renderer.domElement.clientHeight; tag.visible = S.view !== 'window' && px < 14; }
  lm.updateMatrixWorld();
  const U = terrain.uniforms;
  U.uLMInv.value.copy(lm.matrixWorld).invert();
  U.uLMOn.value = st.alt < 4000 ? 1 : 0;
  U.uDust.value.set(0, 0, dustLevel, 0);
  U.uTime.value = st.get;
  terrain.update(origin, camera.position, camera, renderer.domElement.height);
}

// ---------------- HUD ----------------
const pad = (n, w = 2) => String(Math.floor(n)).padStart(w, '0');
const fmtGET = (g) => `${pad(g / 3600)}:${pad((g % 3600) / 60)}:${pad(g % 60)}`;
const fmtUTC = (g) => { const d = new Date(D.UTC_ZERO + g * 1000); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`; };
const fmtMS = (s) => { const a = Math.abs(s); return `${s < 0 ? '−' : '+'}${pad(a / 60)}:${pad(a % 60)}`; };
const nf0 = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('hu-HU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const setText = (el, s) => { if (el._t !== s) { el._t = s; el.innerHTML = s; } };
const el = {};
for (const id of ['get', 'utc', 'ttl', 'phase', 'alt', 'hdot', 'vh', 'rng', 'thr', 'pitch', 'mass', 'prop', 'prog', 'code', 'bingo', 'lines', 'tinfo', 'thrBar', 'propBar', 'lampProg', 'lampLow', 'scrub']) el[id] = $(id);

function phaseOf(st) {
  if (st.get >= D.CONTACT) return 'A felszínen · Tranquility Base';
  const p = D.PROGRAMS.filter((x) => x[0] <= st.get).pop()[1];
  if (st.t < 0) return 'Szabad repülés · gyújtás előtt';
  if (p === 'P63') return 'Fékezési szakasz · P63';
  if (p === 'P64') return 'Megközelítés · P64';
  return 'Leszállás · P66, félig kézi vezérlés';
}

let lineIdx = -2;
function updateTranscript(get) {
  let idx = -1;
  for (let i = 0; i < D.TRANSCRIPT.length; i++) if (D.TRANSCRIPT[i].t <= get) idx = i; else break;
  const nowIds = D.TRANSCRIPT.map((l, i) => (i <= idx && get - l.t < 7 ? 1 : 0)).join('');
  const key = idx + ':' + nowIds;
  if (key === lineIdx) return;
  lineIdx = key;
  const from = Math.max(0, idx - 6);
  const html = [];
  for (let i = from; i <= idx; i++) {
    const l = D.TRANSCRIPT[i];
    const cls = ['line', l.intercom ? 'ic' : '', (get - l.t < 7 || i === idx) ? 'now' : ''].join(' ');
    html.push(`<div class="${cls}"><span class="who ${l.who}">${l.who}<em>${fmtGET(l.t).slice(3)}</em></span><span class="en">${l.en}</span><span class="hu">${l.hu}</span></div>`);
  }
  if (idx < 0) html.push('<div class="line now"><span class="who CC">CC</span><span class="en">Charlie Duke, a CAPCOM Houstonban, éppen most adta meg a „GO for powered descent” engedélyt.</span></div>');
  el.lines.innerHTML = html.join('');
}

function updateHUD(st) {
  setText(el.get, fmtGET(st.get));
  setText(el.utc, fmtUTC(st.get));
  setText(el.ttl, fmtMS(st.get - D.CONTACT));
  setText(el.phase, phaseOf(st));
  const a = st.alt;
  setText(el.alt, (a < 100 ? nf1.format(a) : nf0.format(a)) + ' m<i>' + nf0.format(a / FT) + ' ft</i>');
  setText(el.hdot, nf1.format(st.hdot) + ' m/s<i>' + nf0.format(st.hdot / FT) + ' ft/s</i>');
  setText(el.vh, (st.vh < 100 ? nf1.format(st.vh) : nf0.format(st.vh)) + ' m/s<i>' + nf0.format(st.vh / FT) + ' ft/s</i>');
  setText(el.rng, st.range > 2000 ? nf1.format(st.range / 1000) + ' km' : nf0.format(st.range) + ' m');
  const ftp = st.t >= 26 && st.get < D.EVENTS.find((e) => e[1] === 'Visszavétel')[0];
  setText(el.thr, st.throttle > 0 ? nf0.format(st.throttle * 100) + ' %' + (ftp ? '<i>FTP</i>' : '') : 'ki');
  el.thrBar.style.width = (st.throttle * 100) + '%';
  setText(el.pitch, nf0.format(st.pitch) + '°<i>függőlegestől</i>');
  setText(el.mass, nf0.format(st.mass) + ' kg');
  setText(el.prop, nf1.format(st.propPct) + ' %<i>' + nf0.format(st.prop) + ' kg</i>');
  el.propBar.style.width = st.propPct + '%';
  const prog = D.PROGRAMS.filter((x) => x[0] <= st.get).pop()[1];
  setText(el.prog, prog.slice(1));
  const al = D.ALARMS.filter((x) => x[0] <= st.get && st.get - x[0] < 14).pop();
  el.lampProg.classList.toggle('on', !!al);
  setText(el.code, al ? al[1] : '');
  el.lampLow.classList.toggle('on', st.get >= D.LOW_LEVEL);
  if (st.get >= D.LOW_LEVEL) {
    el.bingo.hidden = false;
    setText(el.bingo, st.get < D.CONTACT ? 'BINGO-IG ' + fmtMS(D.BINGO - st.get).slice(1) : 'Talajérintéskor ~' + Math.round(D.BINGO - D.CONTACT) + ' s maradt a bingóig');
  } else el.bingo.hidden = true;
  updateTranscript(st.get);
  const ev = D.EVENTS.filter((e) => e[0] <= st.get + 0.05).pop();
  setText(el.tinfo, ev ? ev[2] : 'A gyújtásig ' + Math.ceil(D.PDI_GET - st.get) + ' s');
  if (document.activeElement !== el.scrub) el.scrub.value = st.get - D.T_START;
  drawChart(st);
}

// magasságprofil
const chart = $('chart'), cx = chart.getContext('2d');
function drawChart(st) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = chart.clientWidth, h = chart.clientHeight;
  if (!w) return;
  if (chart.width !== Math.round(w * dpr)) { chart.width = Math.round(w * dpr); chart.height = Math.round(h * dpr); }
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx.clearRect(0, 0, w, h);
  const L = 30, Rp = 4, Tp = 6, B = 16;
  const X = (g) => L + ((g - D.T_START) / (D.T_END - D.T_START)) * (w - L - Rp);
  const Y = (m) => Tp + (1 - Math.log10(Math.max(m, 1)) / Math.log10(20000)) * (h - Tp - B);
  cx.font = '10px "IBM Plex Mono", monospace'; cx.fillStyle = '#5f5e59'; cx.strokeStyle = 'rgba(255,255,255,0.07)'; cx.lineWidth = 1;
  for (const [m, lab] of [[10, '10 m'], [100, '100'], [1000, '1 km'], [10000, '10 km']]) {
    const y = Y(m); cx.beginPath(); cx.moveTo(L, y); cx.lineTo(w - Rp, y); cx.stroke(); cx.fillText(lab, 0, y + 3);
  }
  for (const [g, lab] of [[D.PDI_GET, 'PDI'], [D.EVENTS.find((e) => e[1] === 'P64')[0], 'P64'], [D.EVENTS.find((e) => e[1] === 'P66')[0], 'P66']]) {
    const x = X(g); cx.beginPath(); cx.moveTo(x, Tp); cx.lineTo(x, h - B); cx.stroke(); cx.fillText(lab, x - 9, h - 4);
  }
  cx.beginPath();
  for (let k = 0; k < T.L; k += 2) {
    const g = T.T0 + k + T.tPDI; if (g < D.T_START || g > D.T_END) continue;
    const x = X(g), y = Y(T.H[k]);
    k < 3 ? cx.moveTo(x, y) : cx.lineTo(x, y);
  }
  cx.strokeStyle = 'rgba(233,230,223,0.55)'; cx.lineWidth = 1.4; cx.stroke();
  const x = X(st.get), y = Y(st.alt);
  cx.fillStyle = '#e8c47a'; cx.beginPath(); cx.arc(x, y, 3.5, 0, Math.PI * 2); cx.fill();
}

// idővonal jelölők
const marks = $('marks');
for (const [g, lab, desc, major] of D.EVENTS) {
  const b = document.createElement('button');
  b.className = 'mk' + (major ? '' : ' minor') + (/^120/.test(lab) ? ' alarm' : '');
  b.style.left = ((g - D.T_START) / (D.T_END - D.T_START)) * 100 + '%';
  b.textContent = lab; b.title = `${fmtGET(g)} – ${desc}`;
  b.addEventListener('click', () => { S.get = clampGet(g - 3); });
  marks.appendChild(b);
}
el.scrub.max = D.T_END - D.T_START;
el.scrub.addEventListener('input', () => { S.get = D.T_START + (+el.scrub.value); });

// ---------------- vezérlők ----------------
const playIcon = $('playIcon');
function setPlaying(p) {
  S.playing = p;
  playIcon.innerHTML = p ? '<path d="M3 1.5h3.5v13H3zM9.5 1.5H13v13H9.5z"/>' : '<path d="M3 1.5v13l11-6.5z"/>';
  $('play').setAttribute('aria-label', p ? 'Szünet' : 'Lejátszás');
  syncAudio(0); // a kattintáson belül indul a hang (böngészők automatikus lejátszási szabálya)
}
$('play').addEventListener('click', () => { if (S.get >= D.T_END) S.get = D.T_START; setPlaying(!S.playing); });
$('back').addEventListener('click', () => { S.get = clampGet(S.get - 10); });
$('fwd').addEventListener('click', () => { S.get = clampGet(S.get + 10); });
$('speed').addEventListener('change', (e) => { S.speed = +e.target.value; });
const viewBtns = [...document.querySelectorAll('[data-view]')];
function setView(v) {
  S.view = v; S.look.yaw = 0; S.look.pitch = 0;
  viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
}
viewBtns.forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
$('helpers').addEventListener('click', (e) => { helpers.visible = !helpers.visible; e.currentTarget.setAttribute('aria-pressed', String(helpers.visible)); });
const info = $('info');
$('infoBtn').addEventListener('click', () => { info.hidden = false; });
$('infoClose').addEventListener('click', () => { info.hidden = true; });
info.addEventListener('click', (e) => { if (e.target === info) info.hidden = true; });
const start = $('start');
$('goStart').addEventListener('click', () => { start.hidden = true; S.get = D.T_START; setPlaying(true); });
$('goFinal').addEventListener('click', () => { start.hidden = true; S.get = D.g('41:40'); setPlaying(true); });
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); start.hidden = true; setPlaying(!S.playing); }
  else if (e.code === 'ArrowLeft') S.get = clampGet(S.get - (e.shiftKey ? 60 : 10));
  else if (e.code === 'ArrowRight') S.get = clampGet(S.get + (e.shiftKey ? 60 : 10));
  else if (e.key >= '1' && e.key <= '4') setView(['chase', 'window', 'side', 'surface'][+e.key - 1]);
  else if (e.code === 'Escape') info.hidden = true;
});
// egér / érintés: forgatás és nagyítás
const cv = renderer.domElement;
let drag = null;
cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointerup', () => { drag = null; });
cv.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = (e.clientX - drag.x) / 200, dy = (e.clientY - drag.y) / 200;
  drag = { x: e.clientX, y: e.clientY };
  if (S.view === 'window') { S.look.yaw -= dx; S.look.pitch = THREE.MathUtils.clamp(S.look.pitch + dy, -0.9, 0.9); }
  else if (S.view === 'chase') { S.yawOff -= dx * 1.5; S.pitchOff = THREE.MathUtils.clamp(S.pitchOff + dy, -0.6, 1.45); }
});
cv.addEventListener('wheel', (e) => {
  e.preventDefault();
  const k = Math.exp(e.deltaY * 0.0012);
  if (S.view === 'chase') S.dist = THREE.MathUtils.clamp(S.dist * k, 9, 3000);
  else if (S.view === 'side') S.sideZoom = THREE.MathUtils.clamp(S.sideZoom * k, 0.15, 6);
}, { passive: false });

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------------- eredeti hang, a küldetésidőhöz szinkronizálva (a hang a "mester" óra) ----------------
const snd = { el: null, ok: false, on: true };
const soundSel = $('sound');
function setTrack(id) {
  const tr = D.AUDIO.tracks.find((x) => x.id === id);
  soundSel.classList.toggle('off', !tr);
  snd.on = !!tr;
  if (!tr) { snd.el?.pause(); return; }
  if (snd.el && snd.el.dataset.id === id) return;
  snd.el?.pause();
  const a = new Audio(); a.preload = 'auto'; a.preservesPitch = true; a.dataset.id = id;
  snd.ok = false; snd.el = a; snd.stall = 0; snd.lastAt = -1;
  a.addEventListener('canplay', () => { if (snd.el === a) snd.ok = true; });
  a.addEventListener('error', () => { if (snd.el === a) { snd.ok = false; soundSel.title = 'A hangfájl nem tölthető be'; } });
  // egészben betöltve (blob), így a tekerés szerveroldali Range-támogatás nélkül is működik
  fetch(tr.src).then((r) => { if (!r.ok) throw new Error(r.status); return r.blob(); })
    .then((b) => { a.src = URL.createObjectURL(b); })
    .catch(() => { a.src = tr.src; });
}
if (D.AUDIO) {
  soundSel.innerHTML = D.AUDIO.tracks.map((t) => `<option value="${t.id}">${t.label}</option>`).join('') + '<option value="off">Hang ki</option>';
  soundSel.hidden = false;
  soundSel.addEventListener('change', () => setTrack(soundSel.value));
  setTrack(D.AUDIO.tracks[0].id);
}
function syncAudio(dt) {
  const a = snd.el; if (!a) return;
  const pos = S.get - D.AUDIO.get0;
  const want = S.playing && snd.on && snd.ok && S.speed <= 2 && pos >= 0 && pos < (a.duration || Infinity) - 0.1;
  if (!want) { if (!a.paused || snd.pending) a.pause(); return; }
  if (a.playbackRate !== S.speed) a.playbackRate = S.speed;
  if (a.paused) {
    if (snd.pending) return;
    snd.pending = true; a.currentTime = pos;
    a.play().catch(() => {}).finally(() => { snd.pending = false; });
    return;
  }
  const at = a.currentTime;
  if (at === snd.lastAt) snd.stall += dt; else { snd.stall = 0; snd.lastAt = at; }
  const diff = (D.AUDIO.get0 + at) - S.get;
  if (Math.abs(diff) > 1.0) { if (!a.seeking) a.currentTime = pos; }   // ugrás / tekerés után
  else if (snd.stall < 0.3 && !a.seeking) S.get += diff * Math.min(1, dt * 2); // finom igazítás a hang órájához
}

// ---------------- fő ciklus ----------------
let last = performance.now(), hudT = 0, slow = 0, frames = 0;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.25); last = now;
  if (S.playing) {
    S.get = clampGet(S.get + dt * S.speed);
    if (S.get >= D.T_END) setPlaying(false);
  }
  syncAudio(dt);
  const st = T.sample(S.get);
  updateScene(st, dt);
  renderer.render(scene, camera);
  hudT += dt;
  if (hudT > 0.08) { hudT = 0; updateHUD(st); }
  // egyszerű teljesítmény-alkalmazkodás
  if (!document.hidden && dt < 0.2) { frames++; if (dt > 0.045) slow++; }
  if (frames > 90) { if (slow > 45 && pixelRatio > 0.7) { pixelRatio = Math.max(0.7, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); resize(); } frames = 0; slow = 0; }
  requestAnimationFrame(frame);
}
updateHUD(T.sample(S.get));
requestAnimationFrame(frame);
window.__apollo = { S, T, setView, setPlaying, renderer, scene, camera, terrain, snd, frame };
