# LROC WAC Hapke-normált albedó (643 nm, 76 ppd) sorszeletei többtartományos HTTP Range kérésekkel
# (multipart/byteranges), hogy kevés kéréssel is csak a szükséges ~14 MB jöjjön le.
# Használat: python fetch_wac.py <kimeneti mappa> [test]
import sys, os, re, time, http.client, numpy as np

HOST = 'pds.mcp.nasa.gov'
BASE = '/data/store/img/lunar_reconnaissance_orbiter/pds4/lroc/lro-l-lroc-5-rdr/LROLRC_2001/DATA/MDR/WAC_HAPKE/'
HDR, ROWB = 27360, 27360          # címke-bájtok, sorhossz (6840 × float32)
C0, C1 = 1140, 3648               # 15°K – 48°K
UA = {'User-Agent': 'Mozilla/5.0'}


def multi(path, ranges):
    """ranges: [(a, b)], visszaad: {a: bytes}. Ha a szerver nem 206 multiparttal felel, a törzset nem olvassa be."""
    c = http.client.HTTPSConnection(HOST, timeout=90)
    c.request('GET', path, headers={**UA, 'Range': 'bytes=' + ','.join(f'{a}-{b}' for a, b in ranges)})
    r = c.getresponse()
    ct = r.getheader('Content-Type', '')
    if r.status == 206 and len(ranges) == 1:
        return {ranges[0][0]: r.read()}
    if r.status != 206 or 'multipart/byteranges' not in ct:
        c.close()
        raise IOError(f'status {r.status} {ct} retry-after={r.getheader("Retry-After")}')
    body = r.read(); c.close()
    out = {}
    for m in re.finditer(rb'Content-Range:\s*bytes\s+(\d+)-(\d+)/\d+\r?\n(?:[^\r\n]*\r?\n)*?\r?\n', body, re.I):
        a, b = int(m.group(1)), int(m.group(2))
        out[a] = body[m.end():m.end() + (b - a + 1)]
    return out


def rows(name, r0, r1, per=40):
    path = BASE + name
    nb = (C1 - C0) * 4
    want = [(HDR + r * ROWB + C0 * 4, HDR + r * ROWB + C0 * 4 + nb - 1) for r in range(r0, r1)]
    got = {}
    for i in range(0, len(want), per):
        chunk = want[i:i + per]
        for attempt in range(4):
            try:
                got.update(multi(path, chunk)); break
            except IOError as e:
                print('retry', i, e, flush=True)
                if 'status 429' in str(e) or attempt == 3: raise
                time.sleep(5)
        time.sleep(1.0)
    arr = np.stack([np.frombuffer(got[a], '<f4') for a, _ in want])
    return arr


def rows_slow(name, r0, r1, pause=0.45):
    """Soronként egy Range kérés, egyetlen tartós kapcsolaton, lassú ütemben (a szerver multipartot nem ad, és korlátoz)."""
    path = BASE + name
    nb = (C1 - C0) * 4
    c = None
    res = []
    for r in range(r0, r1):
        a = HDR + r * ROWB + C0 * 4
        for attempt in range(6):
            try:
                if c is None: c = http.client.HTTPSConnection(HOST, timeout=60)
                c.request('GET', path, headers={**UA, 'Range': f'bytes={a}-{a + nb - 1}'})
                resp = c.getresponse()
                if resp.status == 429:
                    ra = resp.getheader('Retry-After'); resp.read(); c.close(); c = None
                    raise RuntimeError(f'429 Retry-After={ra}')
                data = resp.read()
                if resp.status != 206 or len(data) != nb: raise IOError(f'status {resp.status} len {len(data)}')
                res.append(np.frombuffer(data, '<f4')); break
            except RuntimeError:
                raise
            except Exception as e:
                c = None; time.sleep(2 + attempt * 2)
                if attempt == 5: raise
        if (r - r0) % 100 == 0: print(name[-15:], r - r0, '/', r1 - r0, flush=True)
        time.sleep(pause)
    return np.stack(res)


def rows_block(name, r0, r1, per=170, pause=3.0):
    """Teljes, összefüggő sorblokkok néhány nagy kéréssel (a szerver kevés kérést tűr), utána oszlopvágás."""
    path = BASE + name
    blocks = []
    for s in range(r0, r1, per):
        e = min(s + per, r1)
        a, b = HDR + s * ROWB, HDR + e * ROWB - 1
        c = http.client.HTTPSConnection(HOST, timeout=180)
        c.request('GET', path, headers={**UA, 'Range': f'bytes={a}-{b}'})
        resp = c.getresponse()
        if resp.status != 206:
            ra = resp.getheader('Retry-After'); c.close()
            raise RuntimeError(f'status {resp.status} Retry-After={ra}')
        data = resp.read(); c.close()
        if len(data) != b - a + 1: raise IOError(f'short read {len(data)}')
        blocks.append(np.frombuffer(data, '<f4').reshape(e - s, ROWB // 4)[:, C0:C1])
        print(name[-15:], f'rows {s}-{e}', flush=True)
        time.sleep(pause)
    return np.vstack(blocks)


if __name__ == '__main__':
    out = sys.argv[1]
    if len(sys.argv) > 2 and sys.argv[2] == 'block':
        n = rows_block('WAC_HAPKE_643NM_E350N0450.IMG', 4560, 5321)
        np.save(os.path.join(out, 'wacn.npy'), n)
        s = rows_block('WAC_HAPKE_643NM_E350S0450.IMG', 0, 609)
        np.save(os.path.join(out, 'wacs.npy'), s)
        print('wac', n.shape, s.shape, flush=True)
        sys.exit(0)
    if len(sys.argv) > 2 and sys.argv[2] == 'slow':
        n = rows_slow('WAC_HAPKE_643NM_E350N0450.IMG', 4560, 5321)
        np.save(os.path.join(out, 'wacn.npy'), n)
        s = rows_slow('WAC_HAPKE_643NM_E350S0450.IMG', 0, 609)
        np.save(os.path.join(out, 'wacs.npy'), s)
        print('wac', n.shape, s.shape, float(np.nanmin(n)), float(np.nanmax(n)), flush=True)
        sys.exit(0)
    if len(sys.argv) > 2 and sys.argv[2] == 'test':
        res = multi(BASE + 'WAC_HAPKE_643NM_E350N0450.IMG', [(HDR, HDR + 15), (HDR + ROWB, HDR + ROWB + 15)])
        print('multipart ok', {k: len(v) for k, v in res.items()})
        sys.exit(0)
    n = rows('WAC_HAPKE_643NM_E350N0450.IMG', 4560, 5321)
    s = rows('WAC_HAPKE_643NM_E350S0450.IMG', 0, 609)
    np.save(os.path.join(out, 'wacn.npy'), n); np.save(os.path.join(out, 'wacs.npy'), s)
    print('wac', n.shape, s.shape, float(np.nanmin(n)), float(np.nanmax(n)))
