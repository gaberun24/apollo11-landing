// Holdkomp (LM-5 "Eagle") – egyszerűsített, méretarányos geometriai modell.
// Helyi tengelyek: y = tolóerő-tengely (fel), +z = eleje (ablakok, létra), origó a talpak alján.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

function crinkleNormalMap(size = 256) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const c = cv.getContext('2d');
  c.fillStyle = '#808080'; c.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const v = 90 + Math.random() * 80 | 0;
    c.fillStyle = `rgb(${v},${v},${v})`;
    c.save(); c.translate(Math.random() * size, Math.random() * size); c.rotate(Math.random() * Math.PI);
    c.beginPath(); const w = 6 + Math.random() * 30, h = 3 + Math.random() * 14;
    c.moveTo(-w, -h); c.lineTo(w * 0.8, -h * 0.6); c.lineTo(w, h); c.lineTo(-w * 0.6, h * 0.8); c.closePath(); c.fill();
    c.restore();
  }
  const src = c.getImageData(0, 0, size, size), out = c.createImageData(size, size);
  const H = (x, y) => src.data[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * 2.2, dy = (H(x, y + 1) - H(x, y - 1)) * 2.2;
    const l = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
    out.data[i] = (-dx / l * 0.5 + 0.5) * 255; out.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255; out.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; out.data[i + 3] = 255;
  }
  c.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3);
  return t;
}

export function createLM() {
  const lm = new THREE.Group();
  const crinkle = crinkleNormalMap();
  const M = {
    gold: new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 1, roughness: 0.32, normalMap: crinkle, normalScale: new THREE.Vector2(0.9, 0.9) }),
    amber: new THREE.MeshStandardMaterial({ color: 0xb8742a, metalness: 1, roughness: 0.4, normalMap: crinkle, normalScale: new THREE.Vector2(0.7, 0.7) }),
    silver: new THREE.MeshStandardMaterial({ color: 0xb9bcc2, metalness: 0.85, roughness: 0.42 }),
    gray: new THREE.MeshStandardMaterial({ color: 0x8c8f94, metalness: 0.4, roughness: 0.6 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x26272a, metalness: 0.3, roughness: 0.55 }),
    black: new THREE.MeshStandardMaterial({ color: 0x101112, metalness: 0.2, roughness: 0.7, normalMap: crinkle, normalScale: new THREE.Vector2(0.4, 0.4) }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0b1016, metalness: 1, roughness: 0.08, side: THREE.DoubleSide }),
    strut: new THREE.MeshStandardMaterial({ color: 0xc9a24f, metalness: 0.9, roughness: 0.35 }),
    white: new THREE.MeshStandardMaterial({ color: 0xe8e8e4, metalness: 0.1, roughness: 0.5 }),
  };
  const add = (geo, mat, x = 0, y = 0, z = 0, parent = lm) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const rod = (a, b, r, mat, parent = lm) => {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    parent.add(m); return m;
  };

  // ---------- leszálló fokozat ----------
  const DS_BOT = 1.05, DS_TOP = 2.7;
  const body = add(new THREE.CylinderGeometry(2.3, 2.3, DS_TOP - DS_BOT, 8, 1), M.gold, 0, (DS_BOT + DS_TOP) / 2, 0);
  body.rotation.y = Math.PI / 8;
  add(new THREE.CylinderGeometry(2.05, 2.15, 0.06, 8), M.black, 0, DS_TOP + 0.02, 0).rotation.y = Math.PI / 8;
  add(new THREE.CylinderGeometry(2.2, 1.6, 0.3, 8), M.black, 0, DS_BOT - 0.12, 0).rotation.y = Math.PI / 8;
  // sötétebb rekeszfedők a négy oldalon
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const p = add(new THREE.BoxGeometry(1.5, 1.35, 0.05), M.amber, Math.sin(a) * 2.02, (DS_BOT + DS_TOP) / 2, Math.cos(a) * 2.02);
    p.rotation.y = a;
  }
  // DPS fúvóka
  const bell = add(new THREE.CylinderGeometry(0.34, 0.75, 0.95, 24, 1, true), M.dark, 0, DS_BOT - 0.55, 0);
  bell.material = M.dark.clone(); bell.material.side = THREE.DoubleSide;
  const throat = add(new THREE.CircleGeometry(0.33, 20), new THREE.MeshBasicMaterial({ color: 0x000000 }), 0, DS_BOT - 0.1, 0);
  throat.rotation.x = Math.PI / 2;

  // ---------- futómű (4 láb az oldalak közepén; +z = létrás láb) ----------
  const probes = [];
  const footR = 4.35;
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    const side = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
    const top = dir.clone().multiplyScalar(2.15).setY(2.45);
    const foot = dir.clone().multiplyScalar(footR).setY(0.32);
    rod(top, foot, 0.085, M.strut);
    const mid = top.clone().lerp(foot, 0.58);
    for (const s of [-1, 1]) {
      const base = dir.clone().multiplyScalar(1.95).addScaledVector(side, s * 0.85).setY(DS_BOT + 0.05);
      rod(base, mid, 0.05, M.strut);
    }
    // talp
    const pad = add(new THREE.CylinderGeometry(0.47, 0.36, 0.16, 20), M.gold, foot.x, 0.08, foot.z);
    add(new THREE.CylinderGeometry(0.12, 0.14, 0.2, 10), M.strut, foot.x, 0.24, foot.z);
    if (i !== 0) { // Apollo 11-en a létrás lábról levették a szondát
      const probe = new THREE.Group(); probe.position.set(foot.x, 0.02, foot.z);
      rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1.73, 0), 0.018, M.silver, probe);
      lm.add(probe); probe.userData.dir = dir; probes.push(probe);
    } else {
      // létra
      const l0 = dir.clone().multiplyScalar(2.32).setY(2.4), l1 = dir.clone().multiplyScalar(3.9).setY(0.55);
      for (const s of [-1, 1]) rod(l0.clone().addScaledVector(side, s * 0.3), l1.clone().addScaledVector(side, s * 0.3), 0.025, M.silver);
      for (let r = 1; r < 9; r++) { const p = l0.clone().lerp(l1, r / 9); rod(p.clone().addScaledVector(side, -0.3), p.clone().addScaledVector(side, 0.3), 0.018, M.silver); }
      add(new THREE.BoxGeometry(1.0, 0.05, 0.75), M.dark, dir.x * 2.55, DS_TOP - 0.02, dir.z * 2.55);
    }
    pad.userData.foot = true;
  }

  // ---------- felszálló fokozat ----------
  const AS = new THREE.Group(); AS.position.y = DS_TOP + 0.04; lm.add(AS);
  const prof = new THREE.Shape();
  const P = [[1.3, 0], [1.38, 0.95], [1.02, 1.95], [0.35, 2.42], [-0.85, 2.42], [-1.3, 2.0], [-1.3, 0.35], [-0.95, 0]];
  prof.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) prof.lineTo(P[i][0], P[i][1]); prof.closePath();
  const cab = new THREE.ExtrudeGeometry(prof, { depth: 3.0, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 1 });
  cab.translate(0, 0, -1.5); cab.rotateY(-Math.PI / 2); // a profil x-e → modell z (előre), extrudálás → x (szélesség)
  const cabin = add(cab, M.silver, 0, 0, 0, AS);
  // homlokfal sötét panelje, ablakok, előre néző ajtó
  const faceA = new THREE.Vector3(0, 0.95, 1.38), faceB = new THREE.Vector3(0, 1.95, 1.02);
  const fdir = faceB.clone().sub(faceA), fn = new THREE.Vector3(0, fdir.z, -fdir.y).normalize().negate();
  if (fn.z < 0) fn.negate();
  const onFace = (x, s, off = 0.1) => faceA.clone().addScaledVector(fdir, s).add(new THREE.Vector3(x, 0, 0)).addScaledVector(fn, off);
  const tri = (pts, mat) => {
    const g = new THREE.BufferGeometry().setFromPoints(pts); g.setIndex([0, 1, 2]); g.computeVertexNormals();
    return add(g, mat, 0, 0, 0, AS);
  };
  const panel = new THREE.BufferGeometry().setFromPoints([onFace(-1.5, 0, 0.09), onFace(1.5, 0, 0.09), onFace(1.5, 1, 0.09), onFace(-1.5, 1, 0.09)]);
  panel.setIndex([0, 1, 2, 0, 2, 3]); panel.computeVertexNormals(); { const pm = M.black.clone(); pm.side = THREE.DoubleSide; add(panel, pm, 0, 0, 0, AS); }
  for (const s of [-1, 1]) tri([onFace(s * 0.22, 0.9), onFace(s * 1.15, 0.9), onFace(s * 0.22, 0.12)], M.glass);
  add(new THREE.BoxGeometry(0.82, 0.82, 0.06), M.gray, 0, 0.48, 1.45, AS).rotation.x = -0.08;
  add(new THREE.BoxGeometry(3.1, 0.12, 0.6), M.black, 0, 0.05, 1.0, AS);
  // hátsó műszerrekesz
  add(new THREE.BoxGeometry(2.3, 1.45, 0.75), M.black, 0, 1.25, -1.72, AS);
  add(new THREE.BoxGeometry(2.36, 0.08, 0.8), M.silver, 0, 2.0, -1.72, AS);
  // dokkolóalagút + célpont
  add(new THREE.CylinderGeometry(0.44, 0.48, 0.42, 20), M.gray, 0, 2.62, -0.15, AS);
  add(new THREE.TorusGeometry(0.42, 0.05, 8, 24), M.silver, 0, 2.84, -0.15, AS).rotation.x = Math.PI / 2;
  // randevúradar
  const rr = new THREE.Group(); rr.position.set(0.0, 2.75, 0.85); AS.add(rr);
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 8), M.silver, 0, -0.15, 0, rr);
  const dish = add(new THREE.SphereGeometry(0.33, 20, 8, 0, Math.PI * 2, 0, 0.9), M.white, 0, 0.1, 0.05, rr);
  dish.rotation.x = Math.PI / 2 + 0.5; dish.material = M.white.clone(); dish.material.side = THREE.DoubleSide;
  // S-sávú irányítható antenna
  rod(new THREE.Vector3(1.4, 2.1, -0.6), new THREE.Vector3(1.95, 2.75, -0.6), 0.04, M.silver, AS);
  const sb = add(new THREE.SphereGeometry(0.33, 20, 8, 0, Math.PI * 2, 0, 0.8), M.white.clone(), 1.95, 2.95, -0.6, AS);
  sb.material.side = THREE.DoubleSide; sb.rotation.z = -0.4;
  // VHF antennák
  rod(new THREE.Vector3(-0.7, 2.4, -1.0), new THREE.Vector3(-1.2, 3.5, -1.5), 0.012, M.silver, AS);
  rod(new THREE.Vector3(0.7, 2.4, -1.0), new THREE.Vector3(1.0, 3.3, -1.7), 0.012, M.silver, AS);
  // RCS négyesek a sarkokon
  const nozzle = new THREE.CylinderGeometry(0.035, 0.08, 0.22, 10, 1, true);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const q = new THREE.Group(); q.position.set(sx * 1.85, 1.55, sz * 1.12); AS.add(q);
    rod(new THREE.Vector3(-sx * 0.35, 0, -sz * 0.1), new THREE.Vector3(0, 0, 0), 0.04, M.silver, q);
    add(new THREE.BoxGeometry(0.22, 0.22, 0.22), M.gold, 0, 0, 0, q);
    const ups = add(nozzle, M.dark, 0, 0.2, 0, q); const dn = add(nozzle, M.dark, 0, -0.2, 0, q); dn.rotation.x = Math.PI;
    const s1 = add(nozzle, M.dark, sx * 0.2, 0, 0, q); s1.rotation.z = -sx * Math.PI / 2;
    const s2 = add(nozzle, M.dark, 0, 0, sz * 0.2, q); s2.rotation.x = sz * Math.PI / 2;
  }

  // ---------- kipufogóláng (vákuumban szinte átlátszó) ----------
  const plumeMat = new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const plume = add(new THREE.CylinderGeometry(0.72, 3.2, 9, 24, 1, true), plumeMat, 0, DS_BOT - 1.02 - 4.5, 0);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const glow = add(new THREE.CircleGeometry(0.62, 24), glowMat, 0, DS_BOT - 0.99, 0);
  glow.rotation.x = Math.PI / 2;

  lm.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  lm.userData = {
    probes,
    setThrottle(x) {
      plumeMat.opacity = 0; plume.visible = false;
      glowMat.opacity = x > 0 ? 0.35 + x * 0.6 : 0;
      plume.scale.set(1, 0.6 + x * 0.8, 1);
      plume.position.y = DS_BOT - 1.02 - 4.5 * (0.6 + x * 0.8);
    },
    setProbes(bend) { // 0 = egyenes, 1 = elhajlott (leszállás után)
      for (const p of probes) { const d = p.userData.dir; p.rotation.set(0, 0, 0); p.rotateOnWorldAxis(new THREE.Vector3(d.z, 0, -d.x), -bend * 1.25); }
    },
    windowCam: { pos: new THREE.Vector3(-0.95, DS_TOP + 1.6, 1.5), look: new THREE.Vector3(-1.5, DS_TOP + 1.6 - 3.4, 1.5 + 4.4) },
  };
  return lm;
}
