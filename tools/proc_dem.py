import sys, os, json, gzip, numpy as np
SRC, OUT = sys.argv[1], sys.argv[2]
R = 1737400.0
LAT0, LON0 = 0.67416, 23.47314
SUN_ALT, SUN_AZ = 10.65, 88.81
d2r = np.pi / 180
def unitv(lat, lon):
    la, lo = lat * d2r, lon * d2r
    return np.array([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)])
def enu(lat, lon):
    la, lo = lat * d2r, lon * d2r
    E = np.array([-np.sin(lo), np.cos(lo), 0.0]); N = np.array([-np.sin(la) * np.cos(lo), -np.sin(la) * np.sin(lo), np.cos(la)])
    return E, N, unitv(lat, lon)
E0, N0, U0 = enu(LAT0, LON0)
sun = np.cos(SUN_ALT * d2r) * (np.sin(SUN_AZ * d2r) * E0 + np.cos(SUN_AZ * d2r) * N0) + np.sin(SUN_ALT * d2r) * U0
# keret: +x a PDI felé mutató azimut
lat1, lon1 = 1.037, 39.371
p1 = unitv(lat1, lon1)
t = p1 - U0 * np.dot(p1, U0); t /= np.linalg.norm(t)
FRAME_AZ = np.degrees(np.arctan2(np.dot(t, E0), np.dot(t, N0)))
ang = np.degrees(np.arccos(np.dot(unitv(lat1, lon1), U0)))
print('FRAME_AZ', FRAME_AZ, 'PDI arc km', ang * d2r * R / 1000)

nac = np.load(os.path.join(SRC, 'nac.npy')).astype(np.float64)
s128 = np.load(os.path.join(SRC, 's128.npy')).astype(np.float64) * 1000
cor = np.vstack([np.load(os.path.join(SRC, 's256n.npy')), np.load(os.path.join(SRC, 's256s.npy'))]).astype(np.float64) * 1000
nac[nac < -1e30] = np.nan
# --- rácsok: első pixelközéppont + lépés (fok) ---
RES_NAC = 15161.67521207; COS1 = np.cos(1 * d2r)
g = {
 'reg': dict(lat0=(7679.5 - 6400) / 128 - 0.5 / 128 * 0 , dlat=-1 / 128, lon0=(1920 + 0.5) / 128, dlon=1 / 128),
 'cor': dict(lat0=(15359.5 - 14720) / 256, dlat=-1 / 256, lon0=180 + (5632 - 46079.5) / 256, dlon=1 / 256),
 'nac': dict(lat0=(18747.5 - 7426) / RES_NAC, dlat=-1 / RES_NAC, lon0=180 + (0 - 2374376.5) / (RES_NAC * COS1), dlon=1 / (RES_NAC * COS1)),
}
from scipy.ndimage import map_coordinates
def sample(arr, gg, lat, lon):
    r = (lat - gg['lat0']) / gg['dlat']; c = (lon - gg['lon0']) / gg['dlon']
    return map_coordinates(arr, [np.atleast_1d(r), np.atleast_1d(c)], order=1, mode='nearest')
# a leszállóhely magassága (NAC), és az adatkészletek közti eltolás ellenőrzése
# --- a máig ott álló leszállási fokozat púpjának eltávolítása: síkillesztés a 7–14 m-es gyűrűre ---
_r = (g['nac']['lat0'] - LAT0) / -g['nac']['dlat']; _c = (LON0 - g['nac']['lon0']) / g['nac']['dlon']
_ri, _ci = int(round(_r)), int(round(_c))
_rr, _cc = np.mgrid[_ri - 10:_ri + 11, _ci - 10:_ci + 11]
_dy = (_rr - _r) * 2.0; _dx = (_cc - _c) * 2.0; _d = np.hypot(_dx, _dy)
_ring = (_d > 7) & (_d < 14)
_A = np.c_[np.ones(_ring.sum()), _dx[_ring], _dy[_ring]]
_coef, *_ = np.linalg.lstsq(_A, nac[_rr[_ring], _cc[_ring]], rcond=None)
_plane = _coef[0] + _coef[1] * _dx + _coef[2] * _dy
_w = np.clip((9.0 - _d) / 2.5, 0, 1)
nac[_rr, _cc] = nac[_rr, _cc] * (1 - _w) + _plane * _w
print('LM plane: h', _coef[0], 'slope E', _coef[1], 'slope S', _coef[2], 'tilt deg', np.degrees(np.arctan(np.hypot(_coef[1], _coef[2]))))
h_site = float(sample(np.nan_to_num(nac, nan=-1927), g['nac'], LAT0, LON0)[0])
print('site NAC', h_site, 'cor', sample(cor, g['cor'], LAT0, LON0)[0], 's128', sample(s128, g['reg'], LAT0, LON0)[0])
# NAC vs cor átlagos eltérés a NAC területén (simított)
rr, cc = np.mgrid[0:nac.shape[0]:50, 0:nac.shape[1]:50]
la = g['nac']['lat0'] + rr * g['nac']['dlat']; lo = g['nac']['lon0'] + cc * g['nac']['dlon']
v = nac[rr, cc]; m = ~np.isnan(v)
off = float(np.median(v[m] - sample(cor, g['cor'], la[m], lo[m])))
print('NAC - cor median offset', off)
# NaN kitöltése a cor adatból
if np.isnan(nac).any():
    rr, cc = np.nonzero(np.isnan(nac))
    nac[rr, cc] = sample(cor, g['cor'], g['nac']['lat0'] + rr * g['nac']['dlat'], g['nac']['lon0'] + cc * g['nac']['dlon']) + off
    print('filled NaN', len(rr))
# regionális: 2x2 átlag → 64 ppd
reg = s128.reshape(1152, 2, 2112, 2).mean(axis=(1, 3))
g['reg'] = dict(lat0=g['reg']['lat0'] - 0.5 / 128, dlat=-1 / 64, lon0=g['reg']['lon0'] + 0.5 / 128, dlon=1 / 64)
# a cor-t a NAC szintjére toljuk? nem: a NAC-ot toljuk a cor-hoz (folytonos átmenet), a site-ot a NAC adja
nac -= off
h_site -= off
# --- vetett árnyék felület: S(p) = max_k [H(p+k*step) - D*tanE - D^2/2R] ---
# --- vetett árnyék: a finom rácsot keletre (napirány) és É/D-re kibővítjük a durvább adatból ---
def grid_latlon(gg, r, c):
    return gg['lat0'] + gg['dlat'] * r, gg['lon0'] + gg['dlon'] * c

def shadow(H, gg, max_m, step_px_list, coarse=None):
    rows, cols = H.shape
    lat_c, lon_c = grid_latlon(gg, rows / 2, cols / 2)
    Ec, Nc, Uc = enu(lat_c, lon_c)
    de, dn = np.dot(sun, Ec), np.dot(sun, Nc); hn = np.hypot(de, dn); de, dn = de / hn, dn / hn
    px_e = abs(gg['dlon']) * d2r * R * np.cos(lat_c * d2r); px_n = abs(gg['dlat']) * d2r * R
    kmax = 0.0
    for st in step_px_list:
        kmax += st
    kmax = int(min(kmax, max_m * de / px_e)) + 2
    rpad = int(abs(kmax * px_e / de * dn / px_n)) + 2
    ext = np.full((rows + 2 * rpad, cols + kmax), np.nan)
    ext[rpad:rpad + rows, :cols] = H
    if coarse is not None:
        Hc, gc = coarse
        rr, cc = np.nonzero(np.isnan(ext))
        la, lo = grid_latlon(gg, rr - rpad, cc)
        ext[rr, cc] = sample(Hc, gc, la, lo)
    ext = np.nan_to_num(ext, nan=-1e9)
    lat, lon = grid_latlon(gg, np.arange(rows)[:, None], np.arange(cols)[None, :])
    la, lo = lat * d2r, lon * d2r
    sinE = sun[0] * np.cos(la) * np.cos(lo) + sun[1] * np.cos(la) * np.sin(lo) + sun[2] * np.sin(la)
    tanE = sinE / np.sqrt(np.maximum(1 - sinE ** 2, 1e-9))
    S = H.copy()
    k = 0
    for st in step_px_list:
        k += st
        D = k * px_e / de
        if D > max_m or k >= kmax: break
        dr = -int(round(D * dn / px_n))
        sh = ext[rpad + dr:rpad + dr + rows, k:k + cols]
        S = np.maximum(S, sh - D * tanE - D * D / (2 * R))
    return S - H

Hreg = reg - h_site; Hcor = cor - h_site; Hnac = nac - h_site
Dreg = shadow(Hreg, g['reg'], 60000, [1] * 200)
Dcor = shadow(Hcor, g['cor'], 25000, [1] * 120 + [2] * 50, coarse=(Hreg, g['reg']))
Dnac = shadow(Hnac, g['nac'], 1500, [1] * 120 + [2] * 200 + [4] * 90, coarse=(Hcor, g['cor']))
for n_, D_ in [('reg', Dreg), ('cor', Dcor), ('nac', Dnac)]:
    print(n_, 'shadowed frac', round(float((D_ > 0.05).mean()), 4), 'p99 D', round(float(np.percentile(D_, 99)), 2))
# --- West kráter keresése a NAC-ban: legmélyebb simított pont 300–750 m-re keletre ---
from scipy.ndimage import uniform_filter
sm = uniform_filter(Hnac, 15)
r_lm = (LAT0 - g['nac']['lat0']) / g['nac']['dlat']; c_lm = (LON0 - g['nac']['lon0']) / g['nac']['dlon']
rr, cc = np.mgrid[0:Hnac.shape[0], 0:Hnac.shape[1]]
dx = (cc - c_lm) * 2.0; dz = (rr - r_lm) * 2.0
win = (dx > 250) & (dx < 800) & (np.abs(dz) < 300)
i = np.argmin(np.where(win, sm, 1e9)); wr, wc = np.unravel_index(i, sm.shape)
print('West crater approx: dx_east', (wc - c_lm) * 2, 'dz_south', (wr - r_lm) * 2, 'depth', float(sm[wr, wc]))
# --- írás: int16, sorirányú delta + gzip ---
def write(name, H, D, unit):
    h = np.round(H / unit).astype(np.int32); d = np.round(np.clip(D, 0, None) / unit).astype(np.int32)
    assert h.min() > -32768 and h.max() < 32767, (name, h.min(), h.max())
    d = np.clip(d, 0, 32767); d[d < 2] = 0
    hd = h.copy(); hd[:, 1:] = h[:, 1:] - h[:, :-1]
    buf = np.concatenate([hd.astype('<i2').ravel(), d.astype('<i2').ravel()]).tobytes()
    gz = gzip.compress(buf, 9)
    with open(os.path.join(OUT, name + '.bin'), 'wb') as fh:
        fh.write(gz)
    print(name, H.shape, 'unit', unit, 'raw MB', len(buf) / 1e6, 'gz MB', len(gz) / 1e6)
os.makedirs(OUT, exist_ok=True)
write('reg', Hreg, Dreg, 0.5)
write('cor', Hcor, Dcor, 0.5)
write('nac', Hnac, Dnac, 0.05)
meta = {}
for (k, v), a, u in zip(g.items(), [Hreg, Hcor, Hnac], [0.5, 0.5, 0.05]):
    meta[k] = dict(v, rows=int(a.shape[0]), cols=int(a.shape[1]), unit=u, file='dem/' + k + '.bin')
meta['frameAz'] = float(FRAME_AZ); meta['site'] = [LAT0, LON0]; meta['siteH'] = h_site
meta['west'] = [float((wc - c_lm) * 2), float((wr - r_lm) * 2)]
with open(os.path.join(OUT, 'meta.json'), 'w') as fh:
    json.dump(meta, fh, indent=1)
print(json.dumps(meta))
