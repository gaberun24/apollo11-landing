import sys, numpy as np
def env(path, rate=8000, hop=80):
    x = np.fromfile(path, dtype=np.int16).astype(np.float32)
    n = len(x)//hop
    e = np.sqrt((x[:n*hop].reshape(n, hop)**2).mean(1))
    e = np.log1p(e)
    e -= np.convolve(e, np.ones(200)/200, mode='same')  # high-pass (remove slow level changes)
    return e  # 100 Hz
a = env(sys.argv[1]); b = env(sys.argv[2])
# find lag L (s) such that a[t] ~ b[t - L]  (a = pao, b = ch14)
n = 1 << int(np.ceil(np.log2(len(a)+len(b))))
A = np.fft.rfft(a, n); B = np.fft.rfft(b, n)
c = np.fft.irfft(A*np.conj(B), n)
lags = np.arange(n); lags[lags > n//2] -= n
m = (np.abs(lags) < 100*90)
idx = np.argsort(c[m])[::-1][:5]
for i in idx: print('lag_s', lags[m][i]/100.0, 'score', round(float(c[m][i]/np.sqrt((a*a).sum()*(b*b).sum())),4))
# segment check: local lags in 120 s windows
L0 = lags[m][idx[0]]
for st in range(0, len(b)-12000, 12000):
    seg = b[st:st+12000]
    best=None
    for d in range(-300, 301, 1):
        s2 = st + L0 + d
        if s2 < 0 or s2+12000 > len(a): continue
        v = float(np.dot(a[s2:s2+12000], seg))
        if best is None or v > best[1]: best=(d, v)
    print('window ch14@%ds local_dlag_s %.2f' % (st//100, best[0]/100.0 if best else float('nan')))
