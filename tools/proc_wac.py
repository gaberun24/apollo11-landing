# WAC Hapke-normált reflektancia → 8 bites szürke PNG + meta (dem/alb.png, dem/meta.json "alb").
# Használat: python proc_wac.py <wac_src mappa: wacn.npy, wacs.npy> <dem mappa>
import sys, os, json, numpy as np
from PIL import Image
src, dem = sys.argv[1], sys.argv[2]
a = np.vstack([np.load(os.path.join(src, 'wacn.npy')), np.load(os.path.join(src, 'wacs.npy'))]).astype(np.float64)
a[(a < -1e30) | ~np.isfinite(a) | (a <= 0)] = np.nan
print('shape', a.shape, 'null', int(np.isnan(a).sum()))
if np.isnan(a).any():  # kitöltés a szomszédos sorok/oszlopok mediánjával
    from scipy.ndimage import generic_filter
    m = np.isnan(a)
    a[m] = np.nanmedian(a)
lat0, dlat, lon0, dlon = (5320.5 - 4560) / 76, -1 / 76, (1140 + 0.5) / 76, 1 / 76
r = (0.67416 - lat0) / dlat; c = (23.47314 - lon0) / dlon
site = a[int(r) - 19:int(r) + 20, int(c) - 19:int(c) + 20]          # ±0,25° a leszállóhely körül
ref = float(np.median(site))
p = np.percentile(a, [1, 50, 99, 99.9])
print('reflectance p1/p50/p99/p99.9', p, 'site median', ref)
top = float(p[3] * 1.05)
img = np.clip(np.round(a / top * 255), 0, 255).astype(np.uint8)
Image.fromarray(img, 'L').save(os.path.join(dem, 'alb.png'), optimize=True)
meta = json.load(open(os.path.join(dem, 'meta.json')))
meta['alb'] = dict(lat0=lat0, dlat=dlat, lon0=lon0, dlon=dlon, rows=int(a.shape[0]), cols=int(a.shape[1]),
                   scale=top / 255, siteRef=ref, file='dem/alb.png',
                   source='LROC WAC Hapke-normalized reflectance, 643 nm, 76 ppd')
json.dump(meta, open(os.path.join(dem, 'meta.json'), 'w'), indent=1)
print('alb.png KB', os.path.getsize(os.path.join(dem, 'alb.png')) / 1e3, 'relative range', p[0] / ref, p[3] / ref)
