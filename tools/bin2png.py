import sys, gzip, json, numpy as np
from PIL import Image
d = sys.argv[1]
meta = json.load(open(d + '/meta.json'))
for k in ['reg', 'cor', 'nac']:
    raw = gzip.decompress(open(f'{d}/{k}.bin', 'rb').read())
    W = 2048
    n = len(raw); h = -(-n // (3 * W))
    buf = np.zeros(h * W * 3, np.uint8); buf[:n] = np.frombuffer(raw, np.uint8)
    Image.fromarray(buf.reshape(h, W, 3), 'RGB').save(f'{d}/{k}.png', optimize=True, compress_level=9)
    meta[k]['file'] = f'dem/{k}.png'; meta[k]['bytes'] = n
    import os; print(k, 'png MB', os.path.getsize(f'{d}/{k}.png') / 1e6, 'gz MB', os.path.getsize(f'{d}/{k}.bin') / 1e6)
json.dump(meta, open(d + '/meta.json', 'w'), indent=1)
