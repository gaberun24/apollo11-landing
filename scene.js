// Égbolt (Föld, halvány csillagok), környezeti térkép, sziklák, porfelhő, pályavonal.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { heightAt, drop } from './terrain.js';

export const dirFromAltAz = (alt, az) => { // x = kelet, y = fel, z = dél
  const a = THREE.MathUtils.degToRad(alt), z = THREE.MathUtils.degToRad(az);
  return new THREE.Vector3(Math.sin(z) * Math.cos(a), Math.sin(a), -Math.cos(z) * Math.cos(a)).normalize();
};

export function createSky(sunDir, earthDir) {
  const sky = new THREE.Group();
  sky.renderOrder = -10;
  // Föld: a Napból megvilágított gömb, ~1,9° látszó átmérő
  const D = 9000, r = D * Math.tan(THREE.MathUtils.degToRad(0.95));
  const earthMat = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: sunDir } },
    vertexShader: `varying vec3 vN; varying vec3 vL; void main(){ vN = normalize(mat3(modelMatrix)*normal); vL = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uSun; varying vec3 vN; varying vec3 vL;
      float hsh(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
      float nz(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(hsh(i),hsh(i+vec3(1,0,0)),f.x),mix(hsh(i+vec3(0,1,0)),hsh(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(hsh(i+vec3(0,0,1)),hsh(i+vec3(1,0,1)),f.x),mix(hsh(i+vec3(0,1,1)),hsh(i+vec3(1,1,1)),f.x),f.y),f.z); }
      void main(){ vec3 n = normalize(vN); float l = max(dot(n, uSun), 0.0);
        vec3 p = normalize(vL)*3.0; float land = smoothstep(0.55, 0.62, nz(p) * 0.6 + nz(p*2.3)*0.4);
        float cloud = smoothstep(0.5, 0.8, nz(p*4.0+7.0)*0.7 + nz(p*9.0)*0.3);
        vec3 c = mix(vec3(0.05,0.14,0.35), vec3(0.32,0.30,0.2), land); c = mix(c, vec3(0.95), cloud*0.85);
        gl_FragColor = vec4(c*(l*1.6) + vec3(0.02,0.04,0.09)*l, 1.0);
        #include <colorspace_fragment>
      }`,
    depthWrite: false, depthTest: false,
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), earthMat);
  earth.position.copy(earthDir).multiplyScalar(D);
  earth.rotation.set(0.4, 2.1, 0.41);
  earth.renderOrder = -10;
  sky.add(earth);
  // halvány csillagok (a valós felvételeken a fényes felszín miatt alig látszanak)
  const N = 1600, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(9500);
    pos.set([v.x, v.y, v.z], i * 3);
    const b = Math.pow(Math.random(), 6) * 0.55 + 0.04;
    col.set([b, b, b * 1.05], i * 3);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.4, sizeAttenuation: false, vertexColors: true, depthWrite: false, depthTest: false }));
  stars.renderOrder = -11;
  sky.add(stars);
  sky.traverse((o) => { o.frustumCulled = false; });
  return sky;
}

export function createEnvMap(renderer, sunDir) {
  const env = new THREE.Scene();
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uSun: { value: sunDir } },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uSun; varying vec3 vD; void main(){
      float g = smoothstep(0.02, -0.08, vD.y);
      vec3 c = vec3(0.30, 0.285, 0.26) * g * (0.6 + 0.4*clamp(dot(normalize(vec3(vD.x, 0.0, vD.z)), normalize(vec3(uSun.x,0.0,uSun.z))), 0.0, 1.0));
      c += vec3(60.0) * pow(max(dot(vD, uSun), 0.0), 900.0);
      gl_FragColor = vec4(c, 1.0); }`,
  });
  env.add(new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), m));
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(env, 0.02);
  pm.dispose();
  return rt.texture;
}

function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9) >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; }; }

export function createBoulders(named) {
  const rand = rng(1969);
  const list = [];
  const west = named.find((c) => c.name === 'West');
  for (let i = 0; i < 520; i++) { // a West-kráter sánca és törmelékmezője
    const a = rand() * Math.PI * 2, d = west.r * (0.85 + Math.pow(rand(), 1.8) * 1.6);
    const s = 0.35 + Math.pow(rand(), 3.2) * 3.4;
    list.push([west.x + Math.cos(a) * d, west.z + Math.sin(a) * d, s]);
  }
  for (let i = 0; i < 420; i++) { // szórt kisebb kövek a leszállóhely körül
    const a = rand() * Math.PI * 2, d = 14 + Math.pow(rand(), 0.8) * 320;
    const s = 0.12 + Math.pow(rand(), 4) * 0.9;
    list.push([Math.cos(a) * d * 1.1 + 40, Math.sin(a) * d, s]);
  }
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 0.75 + rand() * 0.45;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.72, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0x44413c, roughness: 1, metalness: 0, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  list.forEach(([x, z, s], i) => {
    const y = heightAt(x, z, 0.5) + drop(Math.hypot(x, z)) + s * 0.25;
    e.set(rand() * 6, rand() * 6, rand() * 6); q.setFromEuler(e);
    m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s));
    mesh.setMatrixAt(i, m4);
  });
  mesh.frustumCulled = false;
  return mesh;
}

export function createDust() {
  const N = 2600;
  const seed = new Float32Array(N * 4);
  const r = rng(7);
  for (let i = 0; i < N; i++) seed.set([r() * Math.PI * 2, 18 + r() * 55, r(), r()], i * 4);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uAmt: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uSunI: { value: 1 } },
    vertexShader: `attribute vec4 seed; uniform float uTime, uAmt; uniform vec3 uCenter; varying float vA;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){
        float life = 1.6; float t = mod(uTime*(0.8+seed.w*0.4) + seed.z*life, life);
        float r = 2.5 + seed.y*t; float h = 0.05 + seed.w*0.5*(1.0 - t/life);
        vec3 p = uCenter + vec3(cos(seed.x)*r, h, sin(seed.x)*r);
        vA = uAmt * (1.0 - t/life) * smoothstep(0.0, 0.15, t);
        vec4 mv = modelViewMatrix*vec4(p, 1.0);
        gl_Position = projectionMatrix*mv; gl_PointSize = clamp(260.0/-mv.z, 1.0, 9.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `varying float vA; uniform float uSunI;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      void main(){
        #include <logdepthbuf_fragment>
        vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(c)) * vA * 0.32;
        gl_FragColor = vec4(vec3(0.42, 0.40, 0.37)*uSunI*0.3, a);
        #include <colorspace_fragment>
      }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  return pts;
}

export function createPathLine(path) {
  const n = path.length, pos = new Float32Array(n * 3), tt = new Float32Array(n);
  path.forEach(([x, y, z, t], i) => { pos.set([x, y + 2.2, z], i * 3); tt[i] = t; });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('tt', new THREE.BufferAttribute(tt, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uNow: { value: 0 } },
    vertexShader: `attribute float tt; varying float vT;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){ vT = tt; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `uniform float uNow; varying float vT;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      void main(){
        #include <logdepthbuf_fragment>
        vec3 c = vT < uNow ? vec3(0.91, 0.77, 0.48) : vec3(0.75, 0.8, 0.85);
        float a = vT < uNow ? 0.85 : 0.28;
        gl_FragColor = vec4(c, a);
        #include <colorspace_fragment>
      }`,
  });
  const line = new THREE.Line(g, mat);
  line.frustumCulled = false;
  return line;
}

export function createTargetMarker() {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: 0xe8c47a, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(9, 10.5, 64), m);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.25; g.add(ring);
  return g;
}
