"""Readers for the open Earth imagery the analogue tools sample. Nothing here is Google, Bing, Apple, Esri or Mapbox data.

- LINZ New Zealand 10 m satellite mosaic 2024-2025 (Sentinel-2 based), CC BY 4.0, "Sourced from LINZ":
  public S3 bucket nz-imagery (Registry of Open Data on AWS), cloud-optimised GeoTIFFs with WebP tiles.
- NASA Landsat WELD true colour, global annual composite (30 m, public domain), via NASA GIBS WMS.
- NASA MODIS Terra corrected reflectance (250 m, public domain), via NASA GIBS WMS.
- NASA Blue Marble: Next Generation (500 m, public domain), via NASA GIBS WMS.

Downloads are cached in tools/analogues/cache/ (git-ignored).
"""
import io, json, math, os, threading, urllib.request
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, 'cache')
os.makedirs(CACHE, exist_ok=True)

NZ_BASE = 'https://nz-imagery.s3.ap-southeast-2.amazonaws.com/new-zealand/new-zealand_2024-2025_10m/rgb/2193/'
WMS = ('https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS={l}'
       '&TIME={t}&CRS=EPSG:4326&BBOX={a},{c},{b},{d}&WIDTH={w}&HEIGHT={h}&FORMAT=image/png')
LAYERS = {
    'weld': ('Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual', '2000-12-01', 30.0),
    'modis': ('MODIS_Terra_CorrectedReflectance_TrueColor', None, 250.0),
    'bluemarble': ('BlueMarble_NextGeneration', '2004-07-01', 500.0),
}


def _get(url, timeout=180):
    last = None
    for _ in range(3):
        try:
            with urllib.request.urlopen(url, timeout=timeout) as r:
                return r.read()
        except Exception as e:  # network hiccups through the proxy
            last = e
    raise last


# ---------------- NZTM2000 (EPSG:2193) forward projection, for exact pixel lookups in the LINZ tiles -------------
def nztm(lat, lon):
    return tmerc(lat, lon, 173.0, 1600000.0, 10000000.0)


def tmerc(lat, lon, lon0_deg, FE, FN):
    a, f = 6378137.0, 1 / 298.257222101
    k0, lon0 = 0.9996, math.radians(lon0_deg)
    e2 = f * (2 - f); ep2 = e2 / (1 - e2)
    phi, lam = math.radians(lat), math.radians(lon)
    N = a / math.sqrt(1 - e2 * math.sin(phi) ** 2)
    T = math.tan(phi) ** 2; C = ep2 * math.cos(phi) ** 2; A = (lam - lon0) * math.cos(phi)
    M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * math.sin(2 * phi)
             + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * math.sin(4 * phi) - (35 * e2 ** 3 / 3072) * math.sin(6 * phi))
    x = FE + k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120)
    y = FN + k0 * (M + N * math.tan(phi) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720))
    return x, y


def _nz_index():
    p = os.path.join(CACHE, 'nz_index.json')
    if os.path.exists(p):
        return json.load(open(p))
    col = json.loads(_get(NZ_BASE + 'collection.json'))
    import concurrent.futures as cf
    names = [l['href'][2:-5] for l in col['links'] if l['rel'] == 'item']
    def one(n):
        return n, json.loads(_get(NZ_BASE + n + '.json'))['bbox']
    with cf.ThreadPoolExecutor(16) as ex:
        idx = dict(ex.map(one, names))
    json.dump(idx, open(p, 'w'))
    return idx


_LOCK = threading.Lock()


def _nz_tile(name):
    with _LOCK:
        return _nz_tile_locked(name)


def _nz_tile_locked(name):
    """Decode one LINZ COG at full resolution; returns (rgb uint8 array, geotransform origin x, y, pixel size)."""
    npy = os.path.join(CACHE, name + '.npz')
    if os.path.exists(npy):
        z = np.load(npy); return z['img'], tuple(z['geo'])
    import tifffile
    path = os.path.join(CACHE, name + '.tif')
    if not os.path.exists(path):
        open(path, 'wb').write(_get(NZ_BASE + name + '.tiff', timeout=600))
    t = tifffile.TiffFile(path); p = t.pages[0]; fh = t.filehandle
    H, W = p.shape[:2]; th, tw = p.tile; nx = -(-W // tw); ny = -(-H // th)
    out = np.zeros((ny * th, nx * tw, 3), np.uint8)
    for k, (o, c) in enumerate(zip(p.dataoffsets, p.databytecounts)):
        if not c:
            continue
        fh.seek(o); im = np.asarray(Image.open(io.BytesIO(fh.read(c))).convert('RGB'))
        j, i = divmod(k, nx); out[j * th:j * th + im.shape[0], i * tw:i * tw + im.shape[1]] = im
    tp = p.tags['ModelTiepointTag'].value; sc = p.tags['ModelPixelScaleTag'].value
    geo = (tp[3], tp[4], sc[0])
    img = out[:H, :W]
    t.close(); os.remove(path)
    np.savez_compressed(npy, img=img, geo=np.array(geo))
    return img, geo


def linz(lat, lon, size_m, px):
    """A size_m square of the LINZ 10 m mosaic centred on lat, lon, resampled to px x px."""
    idx = _nz_index()
    res = 10.0
    x, y = nztm(lat, lon)
    n = int(round(size_m / res)); gx0 = round((x - size_m / 2) / res) * res; gy1 = round((y + size_m / 2) / res) * res
    out = np.zeros((n, n, 3), np.uint8); have = np.zeros((n, n), bool)
    dlat = size_m / 111320.0; dlon = size_m / (111320.0 * math.cos(math.radians(lat)))
    for name, b in idx.items():
        if b[2] < lon - dlon or b[0] > lon + dlon or b[3] < lat - dlat or b[1] > lat + dlat:
            continue
        img, (x0, y0, r) = _nz_tile(name)
        i0 = int(round((gx0 - x0) / r)); j0 = int(round((y0 - gy1) / r))
        a0, b0 = max(0, -j0), max(0, -i0)
        a1, b1 = min(n, img.shape[0] - j0), min(n, img.shape[1] - i0)
        if a1 <= a0 or b1 <= b0:
            continue
        sub = img[j0 + a0:j0 + a1, i0 + b0:i0 + b1]
        m = sub.any(2)                       # tiles are black outside the coverage
        out[a0:a1, b0:b1][m] = sub[m]; have[a0:a1, b0:b1] |= m
    if have.mean() < 0.98:
        raise ValueError(f'LINZ mosaic has no data over part of the crop at {lat},{lon}')
    return np.asarray(Image.fromarray(out).resize((px, px), Image.LANCZOS), np.float32)


def gibs(layer, lat, lon, size_m, px, time=None):
    """A size_m square from a NASA GIBS layer, centred on lat, lon, fetched at px x px."""
    l, t0, _ = LAYERS[layer]
    dlat = size_m / 111320.0; dlon = size_m / (111320.0 * math.cos(math.radians(lat)))
    a, b, c, d = lat - dlat / 2, lat + dlat / 2, lon - dlon / 2, lon + dlon / 2
    key = f'{layer}_{time or t0}_{a:.5f}_{c:.5f}_{size_m:.0f}_{px}.png'
    p = os.path.join(CACHE, key)
    if not os.path.exists(p):
        open(p, 'wb').write(_get(WMS.format(l=l, t=time or t0, a=a, b=b, c=c, d=d, w=px, h=px)))
    return np.asarray(Image.open(p).convert('RGB'), np.float32)


# ---------------- Copernicus Sentinel-2 L2A true colour (TCI, 10 m), via the Earth Search catalogue on AWS ----------
# Contains modified Copernicus Sentinel data. Read by HTTP range requests from the cloud-optimised GeoTIFFs.
class _RangeFile:
    def __init__(self, url):
        self.url, self.pos, self.cache = url, 0, {}
        req = urllib.request.Request(url, method='HEAD')
        with urllib.request.urlopen(req, timeout=60) as r:
            self.size = int(r.headers['Content-Length'])
    def seek(self, o, whence=0):
        self.pos = o if whence == 0 else self.pos + o if whence == 1 else self.size + o
        return self.pos
    def tell(self):
        return self.pos
    def _block(self, b):
        if b not in self.cache:
            lo = b << 16; hi = min(self.size, lo + (1 << 16)) - 1
            req = urllib.request.Request(self.url, headers={'Range': f'bytes={lo}-{hi}'})
            for k in range(3):
                try:
                    with urllib.request.urlopen(req, timeout=120) as r:
                        self.cache[b] = r.read(); break
                except Exception:
                    if k == 2: raise
        return self.cache[b]
    def read(self, n=-1):
        if n < 0: n = self.size - self.pos
        out = bytearray()
        while n > 0 and self.pos < self.size:
            b = self.pos >> 16; blk = self._block(b); off = self.pos - (b << 16)
            chunk = blk[off:off + n]; out += chunk; self.pos += len(chunk); n -= len(chunk)
        return bytes(out)
    def readinto(self, buf):
        d = self.read(len(buf)); buf[:len(d)] = d; return len(d)
    def close(self):
        pass
    @property
    def closed(self):
        return False
    def seekable(self):
        return True
    def readable(self):
        return True


def sentinel(lat, lon, size_m, px, scene):
    """A size_m square of a Sentinel-2 TCI scene (Earth Search id, e.g. S2B_27WXN_20230814_0_L2A)."""
    key = os.path.join(CACHE, f's2_{scene}_{lat:.4f}_{lon:.4f}_{size_m:.0f}.npy')
    if os.path.exists(key):
        crop = np.load(key)
    else:
        import tifffile
        import re
        tile = scene.split('_')[1]; d = scene.split('_')[2]
        zs, band, sq = re.match(r'(\d+)([A-Z])([A-Z]{2})', tile).groups(); zone = int(zs)
        url = (f'https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/{zone}/{band}/{sq}/'
               f'{int(d[:4])}/{int(d[4:6])}/{scene}/TCI.tif')
        fh = _RangeFile(url)
        t = tifffile.TiffFile(fh); p = t.pages[0]
        tp = p.tags['ModelTiepointTag'].value; sc = p.tags['ModelPixelScaleTag'].value
        x0, y0, res = tp[3], tp[4], sc[0]
        x, y = tmerc(lat, lon, zone * 6 - 183, 500000.0, 0.0 if lat >= 0 else 10000000.0)
        n = int(round(size_m / res)); i0 = int((x - size_m / 2 - x0) / res); j0 = int((y0 - (y + size_m / 2)) / res)
        th, tw = p.tile; nx = -(-p.shape[1] // tw)
        crop = np.zeros((n, n, 3), np.uint8)
        for tj in range(j0 // th, (j0 + n - 1) // th + 1):
            for ti in range(i0 // tw, (i0 + n - 1) // tw + 1):
                k = tj * nx + ti; fh.seek(p.dataoffsets[k]); data = fh.read(p.databytecounts[k])
                arr = p.decode(data, k)[0].reshape(th, tw, -1)[..., :3]
                a0, b0 = tj * th - j0, ti * tw - i0
                ys, xs = max(0, a0), max(0, b0); ye, xe = min(n, a0 + th), min(n, b0 + tw)
                crop[ys:ye, xs:xe] = arr[ys - a0:ye - a0, xs - b0:xe - b0]
        np.save(key, crop)
    return np.asarray(Image.fromarray(crop).resize((px, px), Image.LANCZOS), np.float32)


def sample(src, lat, lon, size_m, px, time=None):
    if src.startswith('S2'):
        return sentinel(lat, lon, size_m, px, src)
    if src == 'linz':
        return linz(lat, lon, size_m, px)
    return gibs(src, lat, lon, size_m, px, time)


def find_scene(lat, lon, dates='2022-07-01T00:00:00Z/2024-09-15T00:00:00Z', months=(7, 8, 9)):
    """The clearest Sentinel-2 L2A scene over a point (least cloud and snow) in the given summer months."""
    p = os.path.join(CACHE, f's2find_{lat:.3f}_{lon:.3f}.json')
    if os.path.exists(p):
        return json.load(open(p))
    feats = []
    for cc in (5, 20):                         # cloudy places (Iceland) may have no scene under 5 % cloud
        body = json.dumps({'collections': ['sentinel-2-l2a'], 'intersects': {'type': 'Point', 'coordinates': [lon, lat]},
                           'datetime': dates, 'query': {'eo:cloud_cover': {'lt': cc}}, 'limit': 200}).encode()
        req = urllib.request.Request('https://earth-search.aws.element84.com/v1/search', data=body, headers={'Content-Type': 'application/json'})
        feats = json.loads(urllib.request.urlopen(req, timeout=120).read())['features']
        feats = [f for f in feats if int(f['properties']['datetime'][5:7]) in months]
        if feats: break
    best = min(feats, key=lambda f: f['properties']['eo:cloud_cover'] + (f['properties'].get('s2:snow_ice_percentage') or 0)
               + 0.5 * (f['properties'].get('s2:nodata_pixel_percentage') or 0))
    json.dump(best['id'], open(p, 'w'))
    return best['id']
