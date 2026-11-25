// Procedurális holdfelszín: görbült (R = 1737,4 km) gömbfelület, kráterekkel,
// kamera körüli poláris rácson, lebegő origóval (float32 pontosság miatt).
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { DEM_GLSL } from './dem.js';

export const R_MOON = 1735473; // a leszállóhely sugara (1737,4 km − 1927 m)

// --- kráter-oktávok (közös a GLSL és a JS magasságfüggvényhez) ---
const GRIDS = [];
{
  let C = 46000;
  for (let i = 0; i < 13; i++) {
    for (let k = 0; k < 2; k++) {
      const a = 0.61 + i * 1.6180339 + k * 2.39996;
      GRIDS.push({
        C, ca: Math.cos(a), sa: Math.sin(a),
        seed: ((i * 2 + k) * 7919 + 13) >>> 0,
        prob: C >= 9000 ? 0.28 : C >= 1800 ? 0.5 : 0.84,
      });
    }
    C /= 2.15;
  }
}
const NOISE = [ // [hullámhossz m, amplitúdó m, seed]
  [9000, 38, 101], [2100, 9, 202], [420, 1.6, 303],
];

const f = (x) => {
  const s = Number(x).toPrecision(9);
  return s.includes('.') || s.includes('e') ? s : s + '.0';
};

const GLSL_COMMON = /* glsl */ `
#define INV 2.3283064365386963e-10
uniform vec4 uNamed[6];
uniform float uNoise0;

uint pcg(uint v){ uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
uint h2(ivec2 c, uint seed){ return pcg(uint(c.x) ^ pcg(uint(c.y) ^ seed)); }

vec3 vnoise(vec2 p, uint seed){
  vec2 i = floor(p); vec2 fr = p - i;
  vec2 u = fr*fr*fr*(fr*(fr*6.0-15.0)+10.0);
  vec2 du = 30.0*fr*fr*(fr*(fr-2.0)+1.0);
  ivec2 ii = ivec2(i);
  float a = float(h2(ii, seed))*INV, b = float(h2(ii+ivec2(1,0), seed))*INV;
  float c = float(h2(ii+ivec2(0,1), seed))*INV, d = float(h2(ii+ivec2(1,1), seed))*INV;
  float k1 = b-a, k2 = c-a, k4 = a-b-c+d;
  return vec3(2.0*(a + k1*u.x + k2*u.y + k4*u.x*u.y)-1.0, 2.0*du*vec2(k1 + k4*u.y, k2 + k4*u.x));
}

// dn: a kráter középpontjától mért, sugárral normált vektor (a kráter saját forgatott keretében)
void prof(vec2 dn, float rm, float fr, float fade, float ca, float sa, vec2 s2, float tanE,
          inout float h, inout vec2 gr, inout float sh){
  float d = length(dn);
  if (d >= 3.0) return;
  float depth = 0.42*fr, rim = 0.075*fr;
  float hh, dh;
  if (d < 1.0){
    hh = rim + depth*(d*d - 1.0); dh = 2.0*depth*d;
    float fl = rim - depth*0.86;
    if (hh < fl){ hh = fl; dh = 0.0; }
    float b = dot(dn, s2); float c = d*d - 1.0;
    float t = -b + sqrt(max(b*b - c, 0.0));
    float need = rim - (hh + t*tanE);
    sh = min(sh, 1.0 - fade*smoothstep(0.0, 0.025, need));
  } else {
    float id3 = 1.0/(d*d*d);
    hh = rim*(id3 - 0.0370370)*1.0384615; dh = -3.0*rim*id3/d*1.0384615;
  }
  h += hh*rm*fade;
  vec2 gl = dh*dn/max(d, 1e-6)*fade;
  gr += vec2(ca*gl.x + sa*gl.y, -sa*gl.x + ca*gl.y);
}

void crater(vec2 p, float C, float ca, float sa, uint seed, float prob, float fade, vec2 sun2, float tanE,
            inout float h, inout vec2 gr, inout float sh){
  vec2 q = vec2(ca*p.x - sa*p.y, sa*p.x + ca*p.y) / C;
  vec2 cell = floor(q);
  uint s = h2(ivec2(cell), seed);
  if (float(s)*INV > prob) return;
  s = pcg(s); float cx = 0.34 + 0.32*float(s)*INV;
  s = pcg(s); float cy = 0.34 + 0.32*float(s)*INV;
  s = pcg(s); float ur = float(s)*INV;
  s = pcg(s); float uf = float(s)*INV;
  float r = 0.11*mix(0.35, 1.0, ur);
  vec2 cc = cell + vec2(cx, cy);
  if (C > 60.0){
    vec2 wc = vec2(ca*cc.x + sa*cc.y, -sa*cc.x + ca*cc.y)*C;
    if (length(wc) < 3.2*r*C) return;   // a leszállóhely körül nincs nagy kráter
  }
  vec2 s2 = vec2(ca*sun2.x - sa*sun2.y, sa*sun2.x + ca*sun2.y);
  prof((q - cc)/r, r*C, 0.12 + 0.88*uf*uf, fade, ca, sa, s2, tanE, h, gr, sh);
}
`;

function terrainGLSL() {
  const calls = GRIDS.map((g) =>
    `  fd = clamp(${f(0.08 * g.C)}/foot - 1.0, 0.0, 1.0)*(1.0 - smoothstep(0.5*cmax, cmax, ${f(g.C)})); if (fd > 0.0) crater(p, ${f(g.C)}, ${f(g.ca)}, ${f(g.sa)}, ${g.seed}u, ${f(g.prob)}, fd${g.C < 200 ? '*siteMask' : ''}, sun2, tanE, h, gr, sh);`
  ).join('\n');
  const noise = NOISE.map(([w, a, s]) =>
    `  fd = clamp(${f(0.25 * w)}/foot - 1.0, 0.0, 1.0); if (fd > 0.0){ vec3 n = vnoise(p/${f(w)}, ${s}u); h += n.x*${f(a)}*fd; gr += n.yz*${f(a / w)}*fd; }`
  ).join('\n');
  return GLSL_COMMON + DEM_GLSL + `
float terrain(vec2 p, float foot, vec2 sun2, float tanE, bool wantGrad, out vec2 gr, out float sh){
  float h = -uNoise0; gr = vec2(0.0); sh = 1.0; float fd; float cmax = 1e9;
  float siteMask = smoothstep(9.0, 30.0, length(p));
  if (uDemOn > 0.5){
    vec2 dg; vec3 d = demSample(p, wantGrad, dg);
    h = d.x; gr = dg; cmax = 8.0*d.z;
    sh = 1.0 - smoothstep(0.05, 0.6 + 0.01*d.z, d.y - d.x);
  } else {
${noise}
  }
${calls}
  if (uDemOn < 0.5){
    for (int i = 0; i < 6; i++){
      vec4 c = uNamed[i];
      if (c.z > 0.0) prof((p - c.xy)/c.z, c.z, c.w, 1.0, 1.0, 0.0, sun2, tanE, h, gr, sh);
    }
  }
  return h;
}
`;
}

// ---------- JS tükörfüggvény (magasság a világkoordinátában, x=kelet, z=dél) ----------
const imul = Math.imul;
function pcg(v) {
  const s = (imul(v >>> 0, 747796405) + 2891336453) >>> 0;
  const w = imul(((s >>> ((s >>> 28) + 4)) ^ s) >>> 0, 277803737) >>> 0;
  return ((w >>> 22) ^ w) >>> 0;
}
const h2 = (x, y, seed) => pcg(((x | 0) >>> 0) ^ pcg((((y | 0) >>> 0) ^ seed) >>> 0));
const INV = 2.3283064365386963e-10;
function vnoiseJS(px, py, seed) {
  const ix = Math.floor(px), iy = Math.floor(py);
  const fx = px - ix, fy = py - iy;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10), uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = h2(ix, iy, seed) * INV, b = h2(ix + 1, iy, seed) * INV;
  const c = h2(ix, iy + 1, seed) * INV, d = h2(ix + 1, iy + 1, seed) * INV;
  return 2 * (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy) - 1;
}
function profJS(dx, dy, rm, fr) {
  const d = Math.hypot(dx, dy);
  if (d >= 3) return 0;
  const depth = 0.42 * fr, rim = 0.075 * fr;
  let hh;
  if (d < 1) hh = Math.max(rim + depth * (d * d - 1), rim - depth * 0.86);
  else hh = rim * (1 / (d * d * d) - 0.037037) * 1.0384615;
  return hh * rm;
}
let named = [];
let noise0 = 0;
let demSampler = null;
function rawHeight(x, z, foot, noNoiseOffset) {
  let h = noNoiseOffset ? 0 : -noise0;
  let cmax = 1e9;
  const siteMask = smooth(9, 30, Math.hypot(x, z));
  if (demSampler) {
    const d = demSampler(x, z); h = d.h; cmax = 8 * d.res;
  } else {
    for (const [w, a, s] of NOISE) {
      const fd = clamp(0.25 * w / foot - 1);
      if (fd > 0) h += vnoiseJS(x / w, z / w, s) * a * fd;
    }
  }
  for (const g of GRIDS) {
    let fd = clamp(0.08 * g.C / foot - 1) * (1 - smooth(0.5 * cmax, cmax, g.C));
    if (fd <= 0) continue;
    if (g.C < 200) fd *= siteMask;
    const qx = (g.ca * x - g.sa * z) / g.C, qy = (g.sa * x + g.ca * z) / g.C;
    const cx0 = Math.floor(qx), cy0 = Math.floor(qy);
    let s = h2(cx0, cy0, g.seed);
    if (s * INV > g.prob) continue;
    s = pcg(s); const cx = 0.34 + 0.32 * s * INV;
    s = pcg(s); const cy = 0.34 + 0.32 * s * INV;
    s = pcg(s); const ur = s * INV;
    s = pcg(s); const uf = s * INV;
    const r = 0.11 * (0.35 + 0.65 * ur);
    const ccx = cx0 + cx, ccy = cy0 + cy;
    if (g.C > 60) {
      const wx = (g.ca * ccx + g.sa * ccy) * g.C, wz = (-g.sa * ccx + g.ca * ccy) * g.C;
      if (Math.hypot(wx, wz) < 3.2 * r * g.C) continue;
    }
    h += profJS((qx - ccx) / r, (qy - ccy) / r, r * g.C, 0.12 + 0.88 * uf * uf) * fd;
  }
  if (!demSampler) for (const c of named) h += profJS((x - c[0]) / c[2], (z - c[1]) / c[2], c[2], c[3]);
  return h;
}
function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function smooth(a, b, x) { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); }

/** Terepmagasság (m) a világ (x kelet, z dél) pontban, a leszállóhely síkjához képest (görbület nélkül). */
export function heightAt(x, z, foot = 0.3) { return rawHeight(x, z, foot, false); }
/** A gömbi esés (m) a leszállóhelytől d távolságra: drop(d) = -d²/(R+√(R²-d²)) */
export function drop(d) { return -(d * d) / (R_MOON + Math.sqrt(Math.max(R_MOON * R_MOON - d * d, 0))); }

// ---------- rács + anyag ----------
// CDLOD: világhoz rögzített négyzetes foltok (quadtree), szintenként kétszeres rácstávolság,
// a szinthatárokon folyamatos "geomorph" – így a csúcsok nem úsznak a kamerával.
const PATCH = 32, LEAF = 32, LEVELS = 14, RANGE_K = 3, MORPH0 = 0.75, MAX_NODES = 1600;
const RANGES = Array.from({ length: LEVELS }, (_, l) => LEAF * Math.pow(2, l) * RANGE_K);
function patchGeometry() {
  const pos = [], idx = [];
  for (let j = 0; j <= PATCH; j++) for (let i = 0; i <= PATCH; i++) pos.push(i, 0, j);
  const W = PATCH + 1;
  for (let j = 0; j < PATCH; j++) for (let i = 0; i < PATCH; i++) {
    const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const mk = (n) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(MAX_NODES * n), n); a.setUsage(THREE.DynamicDrawUsage); return a; };
  geo.setAttribute('aRel', mk(2));
  geo.setAttribute('aW', mk(2));
  geo.setAttribute('aS', mk(4));
  geo.instanceCount = 0;
  return geo;
}

function dummyTex() {
  const t = new THREE.DataTexture(new Float32Array([0, 0]), 1, 1, THREE.RGFormat, THREE.FloatType);
  t.internalFormat = 'RG32F'; t.needsUpdate = true; return t;
}
export function createTerrain(namedCraters) {
  named = namedCraters.map((c) => [c.x, c.z, c.r, c.fresh]);
  noise0 = 0;
  noise0 = rawHeight(0, 0, 0.3, true);
  const namedU = [];
  for (let i = 0; i < 6; i++) {
    const c = named[i];
    namedU.push(c ? new THREE.Vector4(c[0], c[1], c[2], c[3]) : new THREE.Vector4(0, 0, 0, 0));
  }
  const uniforms = {
    uNamed: { value: namedU },
    uNoise0: { value: noise0 },
    uOrigin: { value: new THREE.Vector3() },
    uCamAGL: { value: 10 },
    uR: { value: R_MOON }, uSO: { value: R_MOON }, uDO2: { value: 0 },
    uSun: { value: new THREE.Vector3(1, 0.2, 0).normalize() },
    uSunI: { value: 3.2 },
    uCam: { value: new THREE.Vector3() },
    uPixAng: { value: 0.001 },
    uLMInv: { value: new THREE.Matrix4() },
    uLMOn: { value: 0 },
    uDust: { value: new THREE.Vector4(0, 0, 0, 0) },
    uTime: { value: 0 },
    uDemOn: { value: 0 }, uFrame: { value: new THREE.Matrix3() }, uSinA: { value: 1 }, uCosA: { value: 0 },
    tReg: { value: dummyTex() }, tCor: { value: dummyTex() }, tNac: { value: dummyTex() },
    uRegG: { value: new THREE.Vector4(0, -1, 0, 1) }, uCorG: { value: new THREE.Vector4(0, -1, 0, 1) }, uNacG: { value: new THREE.Vector4(0, -1, 0, 1) },
    uRegN: { value: new THREE.Vector2(1, 1) }, uCorN: { value: new THREE.Vector2(1, 1) }, uNacN: { value: new THREE.Vector2(1, 1) },
  };
  const header = /* glsl */ `
    precision highp float; precision highp int;
    uniform vec3 uOrigin; uniform float uCamAGL; uniform float uR, uSO, uDO2;
    uniform vec3 uSun; uniform float uSunI; uniform vec3 uCam; uniform float uPixAng;
    uniform mat4 uLMInv; uniform float uLMOn; uniform vec4 uDust; uniform float uTime;
    varying vec2 vP; varying vec3 vRP; varying float vWY;
  ` + terrainGLSL();

  const vertexShader = header + /* glsl */ `
    #include <common>
    #include <logdepthbuf_pars_vertex>
    attribute vec2 aRel; attribute vec2 aW; attribute vec4 aS; // folt sarka (origóhoz / világban); cella, alaplépés, morph-tartomány
    void main(){
      float cell = aS.x, b = aS.y;
      vec2 g = position.xz;
      g -= fract(g/b)*b;
      vec2 l0 = aRel + g*cell;
      float dist = length(vec2(length(l0 - uCam.xz), uCamAGL));
      float mk = clamp((dist - aS.z)/(aS.w - aS.z), 0.0, 1.0);
      g -= fract(g/(2.0*b))*(2.0*b)*mk;
      vec2 l = aRel + g*cell;
      vec2 p = aW + g*cell;
      float foot = cell*b*2.0*(1.0 + mk);
      vec2 gr; float sh;
      float h = terrain(p, foot, vec2(1.0, 0.0), 0.2, false, gr, sh);
      float d2 = dot(p, p);
      float S = sqrt(max(uR*uR - d2, 0.0));
      float k = 2.0*dot(uOrigin.xz, l) + dot(l, l);
      float dy = -k/(uR + S)*(1.0 + uDO2/((S + uSO)*(uR + uSO)));
      vec3 rp = vec3(l.x, h + dy, l.y);
      vP = p; vRP = rp; vWY = rp.y + uOrigin.y;
      gl_Position = projectionMatrix * viewMatrix * vec4(rp, 1.0);
      #include <logdepthbuf_vertex>
    }`;

  const fragmentShader = header + /* glsl */ `
    #include <common>
    #include <logdepthbuf_pars_fragment>
    bool hitBox(vec3 o, vec3 d, vec3 bmin, vec3 bmax){
      vec3 inv = 1.0/d; vec3 t0 = (bmin - o)*inv, t1 = (bmax - o)*inv;
      vec3 tmin = min(t0, t1), tmax = max(t0, t1);
      float a = max(max(tmin.x, tmin.y), tmin.z), b = min(min(tmax.x, tmax.y), tmax.z);
      return b > max(a, 0.0);
    }
    void main(){
      #include <logdepthbuf_fragment>
      vec2 p = vP;
      vec3 toCam = uCam - vRP; float cd = length(toCam); vec3 V = toCam/cd;
      float foot = max(cd*uPixAng, 0.01);
      vec3 ns = normalize(vec3(p.x, uR + vWY, p.y));
      vec3 tx = normalize(vec3(ns.y, -ns.x, 0.0));
      vec3 tz = vec3(0.0, 0.0, 1.0);
      float sinE = dot(uSun, ns);
      float tanE = sinE/max(sqrt(1.0 - sinE*sinE), 1e-3);
      vec2 sun2 = normalize(vec2(dot(uSun, tx), dot(uSun, tz)) + 1e-6);
      vec2 gr; float sh;
      float h = terrain(p, foot*1.2, sun2, tanE, true, gr, sh);
      vec3 n = normalize(ns - gr.x*tx - gr.y*tz);
      float mu0 = dot(n, uSun);
      float mu = max(dot(n, V), 0.0);
      float lit = max(mu0, 0.0)*sh;
      if (uLMOn > 0.5){
        vec3 o = (uLMInv*vec4(vRP, 1.0)).xyz; vec3 dd = mat3(uLMInv)*uSun;
        if (hitBox(o, dd, vec3(-2.15, 0.9, -2.15), vec3(2.15, 2.8, 2.15)) ||
            hitBox(o, dd, vec3(-1.9, 2.8, -1.4), vec3(1.9, 5.5, 1.6)) ||
            hitBox(o, dd, vec3(-0.25, 0.0, -4.6), vec3(0.25, 1.4, 4.6)) ||
            hitBox(o, dd, vec3(-4.6, 0.0, -0.25), vec3(4.6, 1.4, 0.25))) lit = 0.0;
      }
      float ls = 2.0*lit/(lit + mu + 0.02);
      float brdf = mix(lit, ls*max(mu0, 0.0)*sh, 0.55);
      float cosA = clamp(dot(uSun, V), -1.0, 1.0);
      float alpha = acos(cosA);
      float opp = 1.0 + 0.9*exp(-alpha*9.0) + 0.25*exp(-alpha*2.0);
      vec3 an = vnoise(p/350.0, 11u); vec3 bn = vnoise(p/37.0, 23u);
      float alb = 0.12*(1.0 + 0.12*an.x + 0.07*bn.x*clamp(2.0/foot - 0.5, 0.0, 1.0));
      vec3 tint = vec3(0.95, 0.91, 0.85);
      vec3 col = tint*alb*(uSunI*brdf*opp + 0.035);
      if (uDust.z > 0.0){
        vec2 dv = vRP.xz - uDust.xy; float rr = length(dv); float ang = atan(dv.y, dv.x);
        float st = vnoise(vec2(ang*38.0, rr*0.22 - uTime*9.0), 7u).x*0.5 + 0.5;
        float st2 = vnoise(vec2(ang*90.0, rr*0.5 - uTime*15.0), 9u).x*0.5 + 0.5;
        float ring = smoothstep(1.5, 7.0, rr)*(1.0 - smoothstep(14.0, 25.0 + 110.0*uDust.z, rr));
        float k = clamp(uDust.z*ring*(0.25 + 0.55*st + 0.3*st2), 0.0, 0.85);
        col = mix(col, tint*0.12*uSunI*0.75*opp, k);
      }
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;

  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
  const geo = patchGeometry();
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  const aRel = geo.attributes.aRel, aW = geo.attributes.aW, aS = geo.attributes.aS;
  const frustum = new THREE.Frustum(), pm = new THREE.Matrix4(), box = new THREE.Box3();
  let n = 0;

  /**
   * origin: a renderelési origó világkoordinátái {x,y,z} (nagy számok, double).
   * camRender: kamera render-koordinátában (THREE.Vector3).
   */
  function update(origin, camRender, camera, height) {
    const dO = Math.hypot(origin.x, origin.z);
    uniforms.uOrigin.value.set(origin.x, drop(dO), origin.z);
    uniforms.uSO.value = Math.sqrt(R_MOON * R_MOON - dO * dO);
    uniforms.uDO2.value = dO * dO;
    uniforms.uCam.value.copy(camRender);
    uniforms.uPixAng.value = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / Math.max(height, 1);
    // kamera a világban + talaj feletti magasság
    const cx = origin.x + camRender.x, cz = origin.z + camRender.z;
    const cy = origin.y + camRender.y;
    const agl = Math.max(cy - (heightAt(cx, cz, 4) + drop(Math.hypot(cx, cz))), 0.5);
    uniforms.uCamAGL.value = agl;
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    n = 0;
    const dist2 = (x0, z0, s) => { // vízszintes táv a folthoz + magasság
      const dx = Math.max(x0 - cx, 0, cx - (x0 + s)), dz = Math.max(z0 - cz, 0, cz - (z0 + s));
      return dx * dx + dz * dz + agl * agl;
    };
    const visible = (x0, z0, s) => {
      const dn = Math.hypot(Math.max(Math.abs(x0 + s / 2) - s / 2, 0), Math.max(Math.abs(z0 + s / 2) - s / 2, 0));
      const df = Math.hypot(Math.max(Math.abs(x0), Math.abs(x0 + s)), Math.max(Math.abs(z0), Math.abs(z0 + s)));
      box.min.set(x0 - origin.x, drop(df) - 5000 - origin.y, z0 - origin.z);
      box.max.set(x0 + s - origin.x, drop(dn) + 5000 - origin.y, z0 + s - origin.z);
      return frustum.intersectsBox(box);
    };
    const add = (x0, z0, s, lvl, base) => { // s: a folt mérete; base 2 = a szülő felbontásán rajzolt negyed
      if (n >= MAX_NODES) return;
      aRel.setXY(n, x0 - origin.x, z0 - origin.z);
      aW.setXY(n, x0, z0);
      aS.setXYZW(n, s / PATCH, base, RANGES[lvl] * MORPH0, RANGES[lvl]);
      n++;
    };
    const select = (x0, z0, lvl) => {
      const s = LEAF * Math.pow(2, lvl);
      if (!visible(x0, z0, s)) return;
      const r2 = lvl > 0 ? RANGES[lvl - 1] * RANGES[lvl - 1] : 0;
      if (lvl === 0 || dist2(x0, z0, s) > r2) { add(x0, z0, s, lvl, 1); return; }
      const h = s / 2;
      for (const [qx, qz] of [[x0, z0], [x0 + h, z0], [x0, z0 + h], [x0 + h, z0 + h]]) {
        if (dist2(qx, qz, h) <= r2) select(qx, qz, lvl - 1);
        else if (visible(qx, qz, h)) add(qx, qz, h, lvl, 2);
      }
    };
    const top = LEVELS - 1, S = LEAF * Math.pow(2, top), R = 420000;
    for (let ix = Math.floor((cx - R) / S); ix <= Math.floor((cx + R) / S); ix++)
      for (let iz = Math.floor((cz - R) / S); iz <= Math.floor((cz + R) / S); iz++) select(ix * S, iz * S, top);
    geo.instanceCount = n;
    aRel.needsUpdate = aW.needsUpdate = aS.needsUpdate = true;
    aRel.addUpdateRange?.(0, n * 2); aW.addUpdateRange?.(0, n * 2); aS.addUpdateRange?.(0, n * 4);
  }
  /** Valós domborzat bekapcsolása (dem.js loadDEM eredménye + keret + JS-mintavételező). */
  function enableDEM(sets, frame, sampler) {
    const U = uniforms;
    const put = (k, t, G, N) => { U[t].value = sets[k].tex; U[G].value.set(...sets[k].G); U[N].value.set(sets[k].rows, sets[k].cols); };
    put('reg', 'tReg', 'uRegG', 'uRegN'); put('cor', 'tCor', 'uCorG', 'uCorN'); put('nac', 'tNac', 'uNacG', 'uNacN');
    U.uFrame.value.set(frame.X[0], frame.U[0], frame.Z[0], frame.X[1], frame.U[1], frame.Z[1], frame.X[2], frame.U[2], frame.Z[2]);
    U.uSinA.value = frame.sinA; U.uCosA.value = frame.cosA;
    U.uDemOn.value = 1;
    demSampler = sampler;
  }
  return { mesh, material, uniforms, update, enableDEM, stats: () => n };
}
