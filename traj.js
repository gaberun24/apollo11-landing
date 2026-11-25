// Pálya-rekonstrukció: simító spline-illesztés (súlyozott legkisebb négyzetek) a valós
// magasság-, sebesség- és távolságadatokra, majd ebből a fizikai mennyiségek levezetése.
import * as D from './data.js';

const FT = 0.3048;
export const R_MOON = 1735473; // a leszállóhely sugara
const GM = 4.9048695e12;
const G0 = 9.80665;

function cholSolve(N, b, n) {
  for (let j = 0; j < n; j++) {
    const rj = j * n;
    let s = N[rj + j];
    for (let k = 0; k < j; k++) s -= N[rj + k] * N[rj + k];
    const d = Math.sqrt(Math.max(s, 1e-12));
    N[rj + j] = d;
    for (let i = j + 1; i < n; i++) {
      const ri = i * n;
      let t = N[ri + j];
      for (let k = 0; k < j; k++) t -= N[ri + k] * N[rj + k];
      N[ri + j] = t / d;
    }
  }
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= N[i * n + k] * y[k]; y[i] = s / N[i * n + i]; }
  for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < n; k++) s -= N[k * n + i] * y[k]; y[i] = s / N[i * n + i]; }
  return y;
}

/** 1 s-os rácson illesztett görbe: értékek, deriváltak és integrálok mérései + görbületbüntetés. */
function fitSmooth({ T0, n, val = [], rate = [], integ = [], smooth }) {
  const N = new Float64Array(n * n), b = new Float64Array(n);
  const add = (idx, c, y, w) => {
    for (let a = 0; a < idx.length; a++) {
      b[idx[a]] += w * c[a] * y;
      for (let q = 0; q < idx.length; q++) N[idx[a] * n + idx[q]] += w * c[a] * c[q];
    }
  };
  const cell = (t) => { const x = Math.min(Math.max(t - T0, 0), n - 1.000001); const k = Math.floor(x); return [k, x - k]; };
  for (const [t, y, s] of val) { const [k, f] = cell(t); add([k, k + 1], [1 - f, f], y, 1 / (s * s)); }
  for (const [t, y, s] of rate) { const [k] = cell(t); add([k, k + 1], [-1, 1], y, 1 / (s * s)); }
  for (const [t, y, s, tEnd] of integ) { // ∫_t^tEnd x dt (trapéz)
    const k0 = Math.round(t - T0), k1 = Math.round(tEnd - T0);
    const idx = [], c = [];
    for (let k = k0; k <= k1; k++) { idx.push(k); c.push(k === k0 || k === k1 ? 0.5 : 1); }
    add(idx, c, y, 1 / (s * s));
  }
  for (let k = 1; k < n - 1; k++) { const a = smooth(T0 + k); add([k - 1, k, k + 1], [1, -2, 1], 0, 1 / (a * a)); }
  return cholSolve(N, b, n);
}

const pchip = (knots) => { // monoton köbös interpoláció
  const xs = knots.map((k) => k[0]), ys = knots.map((k) => k[1]), n = xs.length;
  const h = [], dl = [];
  for (let i = 0; i < n - 1; i++) { h.push(xs[i + 1] - xs[i]); dl.push((ys[i + 1] - ys[i]) / h[i]); }
  const m = new Array(n).fill(0);
  m[0] = dl[0]; m[n - 1] = dl[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (dl[i - 1] * dl[i] <= 0) m[i] = 0;
    else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / dl[i - 1] + w2 / dl[i]); }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const t = (x - xs[i]) / h[i], t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1];
  };
};

function gauss(arr, sigma) {
  const r = Math.ceil(sigma * 3), w = [];
  for (let i = -r; i <= r; i++) w.push(Math.exp(-(i * i) / (2 * sigma * sigma)));
  const out = new Float64Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    let s = 0, ws = 0;
    for (let j = -r; j <= r; j++) { const k = i + j; if (k < 0 || k >= arr.length) continue; s += arr[k] * w[j + r]; ws += w[j + r]; }
    out[i] = s / ws;
  }
  return out;
}

export function buildTrajectory() {
  const tPDI = D.PDI_GET;
  const tContact = D.CONTACT - tPDI, tOff = D.ENGINE_OFF - tPDI;
  const tTD = tContact + 2.6;                    // talpak a felszínen (~1,7 m / 0,5 m/s)
  const T0 = D.T_START - tPDI - 1;               // −66 s
  const n = Math.ceil(tTD - T0) + 2;
  const T1 = D.T_END - tPDI;

  // --- magasság (ft) ---
  const hft = fitSmooth({
    T0, n,
    val: [...D.ALT_OBS, [tTD, 0, 0.05], [tTD + 1, 0, 0.05]],
    rate: D.RATE_OBS,
    smooth: (t) => (t < 480 ? 2.2 : t < 600 ? 1.6 : 0.5),
  });
  // --- vízszintes sebesség (ft/s) + távolság-integrálok ---
  const vft = fitSmooth({
    T0, n,
    val: [...D.VEL_OBS, [tTD, 0, 0.3], [tTD + 1, 0, 0.2]],
    integ: D.RANGE_OBS.map(([t, y, s]) => [t, y, s, tTD]),
    smooth: (t) => (t < 360 ? 0.15 : t < 430 ? 0.5 : t < 600 ? 0.2 : 0.1),
  });

  // rács → méter, levezetett mennyiségek
  const L = Math.ceil(T1 - T0) + 1;
  const H = new Float64Array(L), V = new Float64Array(L), S = new Float64Array(L);
  for (let k = 0; k < L; k++) {
    H[k] = k < n ? Math.max(hft[k] * FT, 0) : 0;
    V[k] = k < n ? Math.max(vft[k] * FT, 0) : 0;
  }
  const kTD = Math.round(tTD - T0);
  for (let k = kTD; k < L; k++) { H[k] = 0; V[k] = 0; }
  // távolság: a leszállási ponttól visszafelé integrálva
  S[L - 1] = 0;
  for (let k = L - 2; k >= 0; k--) S[k] = S[k + 1] + 0.5 * (V[k] / (1 + H[k] / R_MOON) + V[k + 1] / (1 + H[k + 1] / R_MOON)); // felszíni ív

  const Hs = gauss(H, 1.5), Vs = gauss(V, 2.0);
  const Hd = new Float64Array(L), Vd = new Float64Array(L), Hdd = new Float64Array(L);
  for (let k = 1; k < L - 1; k++) { Hd[k] = (Hs[k + 1] - Hs[k - 1]) / 2; Vd[k] = (Vs[k + 1] - Vs[k - 1]) / 2; }
  const Hds = gauss(Hd, 2.5);
  for (let k = 1; k < L - 1; k++) Hdd[k] = (Hds[k + 1] - Hds[k - 1]) / 2;
  const Hdds = gauss(Hdd, 3), Vds = gauss(Vd, 3);

  // tolóerő: a = r̈ − g  (poláris koordinátákban, centrifugális és Coriolis-taggal)
  const throttle = new Float64Array(L), mass = new Float64Array(L), aMag = new Float64Array(L), pitchDer = new Float64Array(L);
  const VEH = D.VEH;
  for (let k = 0; k < L; k++) {
    const r = R_MOON + Hs[k];
    const gr = GM / (r * r);
    const aR = Hdds[k] - (Vs[k] * Vs[k]) / r + gr;
    const aT = Vds[k] + (Hds[k] * Vs[k]) / r;
    aMag[k] = Math.hypot(aR, aT);
    pitchDer[k] = (Math.atan2(-aT, aR) * 180) / Math.PI;
  }
  const tDown = D.EVENTS.find((e) => e[1] === 'Visszavétel')[0] - tPDI;
  let m = VEH.mass0, consumedRaw = new Float64Array(L), cons = 0;
  for (let k = 0; k < L; k++) {
    const t = T0 + k;
    let thr = 0;
    if (t >= 0 && t < 26) thr = VEH.minThrottle;
    else if (t >= 26 && t < tDown) thr = VEH.thrustFTP / VEH.thrustMax;
    else if (t >= tDown && t < tOff) thr = Math.min(Math.max((m * aMag[k]) / VEH.thrustMax, 0.1), 0.65);
    throttle[k] = thr;
    const mdot = (thr * VEH.thrustMax) / (VEH.isp * G0);
    mass[k] = m;
    consumedRaw[k] = cons;
    if (t >= 0 && t < tOff) { m -= mdot; cons += mdot; }
  }
  // hajtóanyag kalibrálása: PDI 17 900 lb → leállításkor 770 lb [MR 9-XIII]
  const kOff = Math.round(tOff - T0);
  const scale = (VEH.propPDI - VEH.propCutoff) / consumedRaw[kOff];
  const prop = new Float64Array(L);
  for (let k = 0; k < L; k++) prop[k] = VEH.propPDI - consumedRaw[Math.min(k, kOff)] * scale;
  const thrS = gauss(throttle.map((x, k) => (T0 + k >= tDown ? x : x)), 1.2);
  for (let k = 0; k < L; k++) { const t = T0 + k; if (t >= tDown + 3) throttle[k] = thrS[k]; }

  const pitchF = pchip(D.PITCH_KNOTS);
  const sm = (a, b, x) => { const u = Math.min(Math.max((x - a) / (b - a), 0), 1); return u * u * (3 - 2 * u); };
  const tP64 = D.EVENTS.find((e) => e[1] === 'P64')[0] - tPDI;

  const lerpArr = (A, x) => { const i = Math.min(Math.max(Math.floor(x), 0), L - 2); const f = Math.min(Math.max(x - i, 0), 1); return A[i] + (A[i + 1] - A[i]) * f; };
  const hermArr = (A, x) => { // Catmull–Rom
    const i = Math.min(Math.max(Math.floor(x), 1), L - 3); const f = Math.min(Math.max(x - i, 0), 1);
    const p0 = A[i - 1], p1 = A[i], p2 = A[i + 1], p3 = A[i + 2];
    return 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
  };

  /** Állapot egy adott GET pillanatban (s). */
  function sample(get) {
    const t = get - tPDI, x = t - T0;
    const h = hermArr(Hs, x), s = hermArr(S, x);
    const yaw = 90 - 180 * sm(D.YAW_START, D.YAW_END, t) + D.YAW_FINAL_LEFT * sm(tP64, tP64 + 40, t);
    return {
      get, t,
      alt: Math.max(h, 0),
      hdot: t >= tTD ? 0 : lerpArr(Hds, x),
      vh: t >= tTD ? 0 : lerpArr(Vs, x),
      range: Math.max(s, 0),
      phi: s / R_MOON,
      pitch: pitchF(t),
      pitchDerived: lerpArr(pitchDer, x),
      yaw,
      throttle: t < 0 || t >= tOff ? 0 : lerpArr(throttle, x),
      mass: lerpArr(mass, x) - (lerpArr(consumedRaw, x) * (scale - 1)),
      prop: lerpArr(prop, x),
      propPct: (lerpArr(prop, x) / VEH.propLoaded) * 100,
      onGround: t >= tTD,
      engineOn: t >= 0 && t < tOff,
    };
  }

  // pálya-pontok világkoordinátában (x kelet, y fel; görbült Hold) a vonalhoz
  const path = [];
  for (let k = 0; k < L; k += 1) {
    const phi = S[k] / R_MOON, r = R_MOON + Hs[k];
    path.push([r * Math.sin(phi), r * Math.cos(phi) - R_MOON, 0, T0 + k + tPDI]);
  }
  return { sample, path, tPDI, tTD: tTD + tPDI, scale, T0, L, H: Hs, V: Vs, S, throttle, pitchDer, mass };
}
