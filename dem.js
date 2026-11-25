// Valós holdi domborzat: SLDEM2015 (LOLA + Kaguya, 474 m és 118 m) + LROC NAC DTM (2 m) a leszállóhelyen.
// A magasságok a leszállóhely sugarához viszonyítva, méterben; minden rácshoz előre számolt
// "árnyékfelület" (S): a pont akkor árnyékban van, ha a magassága S alatt marad.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const D2R = Math.PI / 180;

/** Keret: +x a megadott azimut felé (érintősík), +y fel, +z attól 90°-kal jobbra. Hold-fix (X: 0° h., Z: észak). */
export function makeFrame(latDeg, lonDeg, azDeg) {
  const la = latDeg * D2R, lo = lonDeg * D2R, A = azDeg * D2R;
  const U = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  const E = [-Math.sin(lo), Math.cos(lo), 0];
  const N = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
  const X = E.map((e, i) => Math.sin(A) * e + Math.cos(A) * N[i]);
  const Z = E.map((e, i) => Math.cos(A) * e - Math.sin(A) * N[i]);
  return { X, U, Z, sinA: Math.sin(A), cosA: Math.cos(A) };
}

export const DEM_GLSL = /* glsl */ `
uniform float uDemOn;
uniform mat3 uFrame;
uniform float uSinA, uCosA;
uniform sampler2D tReg, tCor, tNac;
uniform vec4 uRegG, uCorG, uNacG;   // lat0, dlat, lon0, dlon (radián)
uniform vec2 uRegN, uCorN, uNacN;   // sorok, oszlopok
uniform sampler2D tAlb; uniform vec4 uAlbG; uniform vec2 uAlbN; uniform float uAlbK, uAlbOn; // WAC albedó
vec2 latlon(vec2 p){
  vec2 q = p / uR;
  vec3 v = uFrame * vec3(q.x, sqrt(max(1.0 - dot(q, q), 0.0)), q.y);
  return vec2(asin(clamp(v.z, -1.0, 1.0)), atan(v.y, v.x));
}
vec2 tf(sampler2D t, ivec2 rc){ return texelFetch(t, ivec2(rc.y, rc.x), 0).rg; }
vec2 bil(sampler2D t, vec2 rc, vec2 n){
  vec2 b = clamp(rc, vec2(0.0), n - 1.001);
  vec2 i = floor(b); vec2 f = b - i; ivec2 ii = ivec2(i);
  vec2 a00 = tf(t, ii), a01 = tf(t, ii + ivec2(0, 1)), a10 = tf(t, ii + ivec2(1, 0)), a11 = tf(t, ii + ivec2(1, 1));
  return mix(mix(a00, a01, f.y), mix(a10, a11, f.y), f.x);
}
void demOne(sampler2D t, vec4 G, vec2 N, vec2 ll, float margin, float res, bool wantGrad,
            inout vec2 hs, inout vec2 grad, inout float r){
  vec2 rc = vec2((ll.x - G.x) / G.y, (ll.y - G.z) / G.w);
  vec2 dd = min(rc, N - 1.0 - rc);
  float w = smoothstep(0.0, margin, min(dd.x, dd.y));
  if (w <= 0.0) return;
  hs = mix(hs, bil(t, rc, N), w);
  r = mix(r, res, w);
  if (wantGrad){
    float gR = (bil(t, rc + vec2(1.0, 0.0), N).x - bil(t, rc - vec2(1.0, 0.0), N).x) * 0.5 / (G.y * uR);
    float gE = (bil(t, rc + vec2(0.0, 1.0), N).x - bil(t, rc - vec2(0.0, 1.0), N).x) * 0.5 / (G.w * uR * cos(ll.x));
    vec2 g = vec2(gE * uSinA + gR * uCosA, gE * uCosA - gR * uSinA);
    grad = mix(grad, g, w);
  }
}
// x: magasság, y: árnyékfelület, z: felbontás (m)
vec3 demSample(vec2 p, bool wantGrad, out vec2 grad){
  vec2 ll = latlon(p);
  vec2 hs = vec2(0.0); grad = vec2(0.0); float r = 474.0;
  demOne(tReg, uRegG, uRegN, ll, 4.0, 474.0, wantGrad, hs, grad, r);
  hs = hs; // a regionális rács mindenhol lefed (a látható tartományban)
  demOne(tCor, uCorG, uCorN, ll, 24.0, 118.0, wantGrad, hs, grad, r);
  demOne(tNac, uNacG, uNacN, ll, 60.0, 2.0, wantGrad, hs, grad, r);
  return vec3(hs, r);
}
`;

// Az int16 adatfolyam veszteségmentes RGB PNG-be csomagolva (3 bájt/pixel, "terrain-RGB" módszer).
async function loadPng(url, nBytes, onBytes) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url + ' ' + res.status);
  const reader = res.body.getReader();
  const chunks = [];
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); onBytes?.(value.length); }
  const bmp = await createImageBitmap(new Blob(chunks, { type: 'image/png' }), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
  const ctx = cv.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' });
  ctx.drawImage(bmp, 0, 0);
  const px = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
  const out = new Uint8Array(nBytes);
  for (let i = 0, j = 0; j < nBytes; i += 4) { out[j++] = px[i]; if (j < nBytes) out[j++] = px[i + 1]; if (j < nBytes) out[j++] = px[i + 2]; }
  return new Int16Array(out.buffer);
}

function decode(raw, rows, cols, unit, decimate) {
  const n = rows * cols;
  const oc = decimate ? Math.ceil(cols / 2) : cols;
  const out = new Float32Array(rows * oc * 2);
  for (let r = 0; r < rows; r++) {
    let acc = 0;
    const base = r * cols;
    for (let c = 0; c < cols; c++) {
      acc = ((acc + raw[base + c]) << 16) >> 16;
      if (decimate && (c & 1)) continue;
      const o = (r * oc + (decimate ? c >> 1 : c)) * 2;
      const h = acc * unit;
      out[o] = h;
      out[o + 1] = h + raw[n + base + c] * unit;
    }
  }
  return { data: out, rows, cols: oc };
}

/** Betölti a DEM-csomagot; visszaad: uniform-értékek + JS-mintavételező. */
export async function loadDEM(meta, maxTex, onProgress) {
  const keys = ['reg', 'cor', 'nac'];
  let got = 0;
  const raws = await Promise.all(keys.map((k) => loadPng(meta[k].file, meta[k].bytes, (n) => { got += n; onProgress?.(got); })));
  // ellenőrzőösszeg: a PNG-dekódolásnak bájtpontosnak kell lennie (színkezelés nélkül)
  keys.forEach((k, i) => { let sum = 0, sa = 0; const r = raws[i]; for (let j = 0; j < r.length; j++) { sum += r[j]; sa = (sa + Math.abs(r[j])) % 1000000007; } if (sum !== meta[k].sum || sa !== meta[k].sumAbs) throw new Error("ellenőrzőösszeg: " + k); });
  const sets = {};
  keys.forEach((k, i) => {
    const m = meta[k];
    const dec = m.cols > maxTex;
    const d = decode(raws[i], m.rows, m.cols, m.unit, dec);
    const tex = new THREE.DataTexture(d.data, d.cols, d.rows, THREE.RGFormat, THREE.FloatType);
    tex.internalFormat = 'RG32F';
    tex.minFilter = tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false; tex.flipY = false; tex.needsUpdate = true;
    sets[k] = {
      tex, data: d.data, rows: d.rows, cols: d.cols,
      G: [m.lat0 * D2R, m.dlat * D2R, m.lon0 * D2R, m.dlon * D2R * (dec ? 2 : 1)],
      res: k === 'reg' ? 474 : k === 'cor' ? 118 : 2,
      margin: k === 'reg' ? 4 : k === 'cor' ? 24 : 60,
    };
  });
  return sets;
}

/** JS tükör: (H, S, felbontás) a keret (x, z) pontjában. */
export function makeSampler(sets, frame, R) {
  const bil = (s, r, c) => {
    r = Math.min(Math.max(r, 0), s.rows - 1.001); c = Math.min(Math.max(c, 0), s.cols - 1.001);
    const r0 = Math.floor(r), c0 = Math.floor(c), fr = r - r0, fc = c - c0;
    const i = (r0 * s.cols + c0) * 2, j = i + s.cols * 2, d = s.data;
    const top = d[i] + (d[i + 2] - d[i]) * fc, bot = d[j] + (d[j + 2] - d[j]) * fc;
    return top + (bot - top) * fr;
  };
  const sm = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
  return (x, z) => {
    const qx = x / R, qz = z / R, w = Math.sqrt(Math.max(1 - qx * qx - qz * qz, 0));
    const vx = frame.X[0] * qx + frame.U[0] * w + frame.Z[0] * qz;
    const vy = frame.X[1] * qx + frame.U[1] * w + frame.Z[1] * qz;
    const vz = frame.X[2] * qx + frame.U[2] * w + frame.Z[2] * qz;
    const lat = Math.asin(Math.min(Math.max(vz, -1), 1)), lon = Math.atan2(vy, vx);
    let h = 0, res = 474;
    for (const k of ['reg', 'cor', 'nac']) {
      const s = sets[k];
      const r = (lat - s.G[0]) / s.G[1], c = (lon - s.G[2]) / s.G[3];
      const wgt = sm(0, s.margin, Math.min(r, s.rows - 1 - r, c, s.cols - 1 - c));
      if (wgt <= 0) continue;
      h += (bil(s, r, c) - h) * wgt; res += (s.res - res) * wgt;
    }
    return { h, res };
  };
}
