"""Colour palettes for Arda's mountain ranges, sampled from Earth's mountains of like height and latitude.

Imagery: NASA Blue Marble: Next Generation (public domain, NASA Earth Observatory / GIBS), summer month.
Only colour statistics are kept (a handful of RGB values per range), never the imagery itself: for each analogue
region we take the pixels, and pick robust colours for its forest, its meadows and low ground, its bare rock, and
its snow, by brightness and greenness. Run: python3 tools/analogues/sample.py  (writes analogues.json beside it)
"""
import io, json, os, sys, urllib.request
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
# Arda range -> (Earth analogue, bbox lat0, lat1, lon0, lon1); chosen for height, latitude and climate
ANALOGUES = {
    'Hithaeglir':                    ('The Alps (Bernese Oberland to the Valais)',  45.8, 46.8, 7.0, 8.6),
    'Ered Mithrin':                  ('The Scandes (Jotunheimen)',                   61.2, 61.9, 7.6, 9.4),
    'Ered Luin':                     ('The Scottish Highlands (Lochaber)',           56.6, 57.3, -5.6, -4.4),
    'Ered Nimrais':                  ('The Pyrenees (central)',                      42.5, 42.9, -0.6, 1.4),
    'Ered Nimrais (Mindolluin spur)':('The Pyrenees (central)',                      42.5, 42.9, -0.6, 1.4),
    'Ephel Dúath':                   ('The Armenian Highlands (Ararat, Aragats)',    39.6, 40.6, 43.8, 44.6),
    'Ered Lithui':                   ('The Alborz (Damavand)',                       35.8, 36.2, 51.6, 52.6),
    'Mountains of Angmar':           ('The Cairngorms',                              56.9, 57.3, -4.0, -3.2),
    'Iron Hills':                    ('The Northern Urals',                          61.5, 63.0, 58.6, 59.6),
    'Mountains of Mirkwood':         ('The Harz',                                    51.6, 51.9, 10.3, 11.0),
    'Orocarni':                      ('The Tian Shan (Kyrgyz Range)',                42.3, 42.8, 73.6, 75.4),
    'Ered Gorgoroth of the East':    ('The Altai (Katun Range)',                     49.6, 50.2, 85.6, 87.4),
    'Mountains of Harad':            ('The High Atlas (Toubkal)',                    30.9, 31.4, -8.4, -6.8),
    'Mountains of Far Harad':        ('The Ethiopian Highlands (Simien)',            13.0, 13.5, 37.9, 38.6),
    'Yellow Mountains':              ('The Zagros (central)',                        32.5, 33.4, 48.6, 50.0),
    'Northern Heights':              ('The Khibiny',                                 67.5, 67.9, 33.2, 34.2),
}
LAYER = 'BlueMarble_NextGeneration'
URL = ('https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS={l}'
       '&TIME=2004-07-01&CRS=EPSG:4326&BBOX={a},{c},{b},{d}&WIDTH={w}&HEIGHT={h}&FORMAT=image/png')


def fetch(a, b, c, d):
    w = max(64, int((d - c) * 240)); h = max(64, int((b - a) * 240))       # ~460 m/px, the layer's resolution
    with urllib.request.urlopen(URL.format(l=LAYER, a=a, b=b, c=c, d=d, w=w, h=h), timeout=60) as r:
        return np.asarray(Image.open(io.BytesIO(r.read())).convert('RGB'), dtype=np.float32)


def palette(img):
    px = img.reshape(-1, 3); r, g, b = px.T
    lum = 0.3 * r + 0.59 * g + 0.11 * b; chroma = px.max(1) - px.min(1)
    land = (b < r + 25) | (lum > 150)                                      # leave out lakes and sea
    px, r, g, b, lum, chroma = px[land], r[land], g[land], b[land], lum[land], chroma[land]
    green = g - (r + b) / 2
    def med(m, fb):
        return [int(v) for v in np.median(px[m], 0)] if m.sum() > 20 else fb
    snow = med((lum > 185) & (chroma < 40), [238, 242, 247])
    forest = med((green > 6) & (lum < np.percentile(lum, 35)), None)
    meadow = med((green > 2) & (lum >= np.percentile(lum, 35)) & (lum < 175), None)
    rock = med((green <= 2) & (lum > 70) & (lum < 185) & (chroma < 60), None)
    shares = {'forest': float(((green > 6) & (lum < np.percentile(lum, 35))).mean()), 'snow': float(((lum > 185) & (chroma < 40)).mean()),
              'bare': float(((green <= 2) & (lum > 70) & (lum < 185)).mean())}
    return {'forest': forest, 'meadow': meadow, 'rock': rock, 'snow': snow, 'shares': {k: round(v, 3) for k, v in shares.items()}}


def main():
    out = {}
    for name, (earth, a, b, c, d) in ANALOGUES.items():
        try:
            img = fetch(a, b, c, d)
        except Exception as e:
            print('failed', name, e, file=sys.stderr); continue
        p = palette(img); p['earth'] = earth; p['bbox'] = [a, b, c, d]
        out[name] = p
        print(f'{name:34s} {earth:44s} forest {p["forest"]} meadow {p["meadow"]} rock {p["rock"]} snow {p["snow"]} {p["shares"]}')
    doc = {'source': 'NASA Blue Marble: Next Generation, July (public domain), via NASA GIBS', 'ranges': out}
    json.dump(doc, open(os.path.join(HERE, 'analogues.json'), 'w'), indent=1, ensure_ascii=False)
    js = ('/* Colour palettes for the mountain ranges from Earth analogues of like height and latitude (generated by\n'
          '   tools/analogues/sample.py from NASA Blue Marble: Next Generation, public domain; colours only). */\n'
          'const ANALOGUES = ' + json.dumps({k: {f: v[f] for f in ('earth', 'forest', 'meadow', 'rock', 'shares')} for k, v in out.items()}, ensure_ascii=False) + ';\n'
          'if (typeof self !== "undefined") self.ANALOGUES = ANALOGUES;\n')
    open(os.path.join(HERE, '..', '..', 'src', 'analogues.js'), 'w').write(js)


if __name__ == '__main__':
    main()
