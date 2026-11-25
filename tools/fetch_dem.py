# Csak a szükséges sorszeleteket tölti le HTTP Range kérésekkel; kimenet: .npy float32 tömbök.
import sys, os, numpy as np, http.client, urllib.parse, threading
from concurrent.futures import ThreadPoolExecutor
OUT = sys.argv[1]
UA = {'User-Agent': 'Mozilla/5.0'}
local = threading.local()
def conn(host):
    c = getattr(local, 'c', None)
    if c is None or local.host != host:
        c = http.client.HTTPSConnection(host, timeout=60); local.c = c; local.host = host
    return c
def get_range(url, a, b):
    u = urllib.parse.urlparse(url)
    for attempt in range(8):
        try:
            c = conn(u.netloc)
            c.request('GET', u.path, headers={**UA, 'Range': f'bytes={a}-{b}'})
            r = c.getresponse(); data = r.read()
            if r.status == 206 and len(data) == b - a + 1: return data
            if r.status == 429:
                import time; time.sleep(3 + attempt * 4)
            raise IOError(f'status {r.status} len {len(data)}')
        except Exception as e:
            local.c = None
            if attempt == 7: raise
def rows(url, header, row_bytes, r0, r1, c0, c1, name):
    nb = (c1 - c0) * 4
    def one(r):
        a = header + r * row_bytes + c0 * 4
        return np.frombuffer(get_range(url, a, a + nb - 1), dtype='<f4')
    with ThreadPoolExecutor(int(os.environ.get('NTHREADS', '8'))) as ex: res = list(ex.map(one, range(r0, r1)))
    arr = np.stack(res); np.save(os.path.join(OUT, name + '.npy'), arr)
    print(name, arr.shape, 'min/max', float(np.nanmin(arr)), float(np.nanmax(arr)), flush=True)
B1 = 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/sldem2015'
B3 = 'https://pds.mcp.nasa.gov/data/store/img/lunar_reconnaissance_orbiter/pds4/lroc/lro-l-lroc-5-rdr/LROLRC_2001/DATA'
job = sys.argv[2]
if job == 'nac':   # rows 7426..9627 (±2.2 km a LM körül), teljes szélesség, egyetlen összefüggő tartomány
    url = B3 + '/SDP/NAC_DTM/APOLLO11/NAC_DTM_APOLLO11_E008N0234.IMG'
    r0, r1, W = 7426, 9627, 2111
    a = 8444 + r0 * 8444; b = 8444 + r1 * 8444 - 1
    arr = np.frombuffer(get_range(url, a, b), dtype='<f4').reshape(r1 - r0, W)
    np.save(os.path.join(OUT, 'nac.npy'), arr); print('nac', arr.shape, float(arr[arr > -1e30].min()), float(arr.max()))
elif job == 's128':
    rows(B1 + '/global/float_img/sldem2015_128_60s_60n_000_360_float.img', 0, 46080 * 4, 6400, 8704, 1920, 6144, 's128')
elif job == 's256':
    rows(B1 + '/tiles/float_img/sldem2015_256_0n_60n_000_120_float.img', 0, 30720 * 4, 14720, 15360, 5632, 10496, 's256n')
    rows(B1 + '/tiles/float_img/sldem2015_256_60s_0s_000_120_float.img', 0, 30720 * 4, 0, 256, 5632, 10496, 's256s')
elif job == 'wac':
    rows(B3 + '/MDR/WAC_HAPKE/WAC_HAPKE_643NM_E350N0450.IMG', 27360, 27360, 4560, 5321, 1140, 3648, 'wacn')
    rows(B3 + '/MDR/WAC_HAPKE/WAC_HAPKE_643NM_E350S0450.IMG', 27360, 27360, 0, 609, 1140, 3648, 'wacs')
