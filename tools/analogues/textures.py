"""Land-cover texture patches for the imagery renderer, sampled from real Earth landscapes chosen as analogues.

Each class gets two small tileable patches cut from open satellite imagery of one real place:
  fine   - 128 px at the source's own resolution (10 m LINZ, 30 m Landsat WELD): detail for close zoom
  coarse - 128 px over 8x (LINZ) or 4x (WELD) the ground: the pattern of the land at middle zoom
plus that place's mean colour. The renderer (src/gen.js, `tex`) repeats them in world coordinates, with a warp so
the repeat does not show, and picks the mip level from the pixel footprint.

Patches are high-passed (large-scale tone removed) so the engine's own climate and terrain decide where a class is;
the patch only carries the texture of the ground. Slopes in the source carry the morning sun of their satellite
pass; patches are mirrored/rotated so that their baked light falls from the north-west like the engine's hillshade.

New Zealand is the first choice of analogue (LINZ 10 m satellite mosaic, CC BY 4.0); where it has nothing like the
feature (sand seas, steppe, tundra, taiga, sea ice) the analogue comes from NASA Landsat WELD or MODIS (public domain).
See docs/ANALOGUES.md for why each place was chosen.

Run: python3 tools/analogues/textures.py   (writes src/textures.js, tools/analogues/textures.json)
"""
import base64, io, json, math, os, sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import earthdata as ed

HERE = os.path.dirname(os.path.abspath(__file__))
N = 128
# class: (source, lat, lon, analogue place, use in Arda); 'fine'/'coarse' override the default patch centre.
CLASSES = [
    ('pasture',  's2',    (51.950, -8.300), 'East Cork, Ireland: dairy pasture in small hedged fields', 'the Shire, Bree-land, Buckland, Eriador and Gondor grassland'),
    ('arable', 'linz', (-43.700, 171.750), 'Canterbury Plains near Methven: mixed cropping', 'Lebennin, Lossarnach, the Pelennor, Anórien, Nurn, Dorwinion'),
    ('tussock',  'linz',  (-44.050, 170.300, -43.930, 170.300), 'Mackenzie Basin near Twizel: short tussock grassland', 'Rohan, the Wold, Enedwaith, Minhiriath'),
    ('forest', 'linz', (-46.200, 167.200), 'Waitutu, Fiordland: lowland podocarp and beech forest', 'Mirkwood, Fangorn, the Old Forest, Eryn Vorn, Chetwood'),
    ('beech',    'linz',  (-46.564, 169.325, -46.570, 169.330), 'The Catlins: silver and red beech forest', 'Lothlórien, Ithilien, Hollin, montane forest'),
    ('taiga', 'weld', (62.000, 58.800), 'Northern Urals foothills: spruce and fir taiga', 'the Taiga of Forodwaith, the Iron Hills, the north'),
    ('scree', 'linz', (-42.200, 173.600), 'Seaward Kaikōura Range: greywacke scree with tussock gullies', 'mountain slopes above the forest in every range'),
    ('rock', 'linz', (-45.050, 168.810), 'The Remarkables: bare schist rock and talus', 'crags and summit rock'),
    ('neve',     'linz',  ('flat', -43.520, 170.320), 'Upper Tasman Glacier névé', 'glaciers and the snowfields of the high ranges'),
    ('gravel',   'linz',  (-43.880, 170.150, 'flat'), 'Tasman River: braided gravel bed above Lake Pukaki', 'braided river beds below the mountains, the Ethir Anduin'),
    ('bog', 's2', (58.420, -3.850), 'The Flow Country, Caithness, Scotland: blanket bog and its pools', 'the Dead Marshes, the Nindalf, the Midgewater, the Gladden Fields'),
    ('ashplain', 's2', (63.830, -19.050), 'Mælifellssandur, Iceland: black ash plain cut by meltwater gullies', 'Gorgoroth, Udûn, Lithlad, the Dagorlad'),
    ('lava',     's2',    (19.388, -155.105), 'Puʻu ʻŌʻō, Kīlauea, Island of Hawaiʻi: young lava and spatter', 'Orodruin and its slopes'),
    ('schist',   'linz',  (-45.360, 169.650, -45.450, 169.550), 'Poolburn, Central Otago: brown tussock on schist with tors', 'the Brown Lands, Dunland, the downs and hill country'),
    ('sand', 'weld', (25.500, -2.500), 'Erg Chech, Algeria/Mali: linear dunes', 'the sand seas of Far Harad'),
    ('hamada', 'weld', (25.600, 8.600), 'Tassili n\'Ajjer foreland, Algeria: stony desert', 'Near Harad, Khand, the deserts\' rocky ground'),
    ('steppe', 'weld', (51.800, 72.500), 'Kazakh steppe near Astana: feather-grass steppe', 'the steppe of Rhûn'),
    ('tundra', 'weld', (68.500, 70.500), 'Yamal peninsula: lake-studded tundra', 'Forodwaith'),
    ('seaice',   'modis',  (64.800, 23.500), 'Bay of Bothnia in late March (fast ice and leads)', 'the Icebay of Forochel'),
    ('savanna', 'weld', (13.500, 2.500), 'Sahel near Niamey: tiger-bush and dry savanna', 'the southern lands of Far Harad'),
    ('blacklava', 's2', (64.870, -16.760), 'Holuhraun, Iceland: the 2014-15 lava field on black sandur', 'Gorgoroth and the black plains of Mordor'),
    ('cinder',   's2',  (19.620, -155.450), 'Mauna Loa saddle, Island of Hawaiʻi: young lava flows and cinder', 'Udûn, the slopes about Orodruin, Lithlad'),
]
SRC = {  # source: (fine ground size m, coarse ground size m, how to turn its baked light to the north-west)
    'linz': (1280.0, 10240.0, 'mirror'),    # southern summer morning: sun from the north-east -> mirror left-right
    'weld': (3840.0, 15360.0, 'rot180'),    # northern morning: sun from the south-east -> half turn
    'modis': (16000.0, 32000.0, 'rot180'),
    's2': (1280.0, 10240.0, 'rot180'),       # Copernicus Sentinel-2 10 m, northern-hemisphere morning
}
MODIS_TIME = {'seaice': '2018-03-20'}
# water colours read straight from the LINZ mosaic: (lat, lon, ground m, what)
# water pixels of a crop (blue above red), and which brightness percentile stands for which water
WATER = {
    'deep':    (-40.880, 173.060, 8000, 5, 'Abel Tasman coast: open water of Tasman Bay'),
    'shelf':   (-40.880, 173.060, 8000, 60, 'Abel Tasman coast: water over the inshore shelf'),
    'shallow': (-40.880, 173.060, 8000, 97, 'Abel Tasman coast: sand shallows by the beaches'),
    'plume':   (-43.900, 172.220, 8000, 70, 'Rakaia mouth: glacial sediment plume along the shore'),
    'fjord':   (-45.300, 166.980, 8000, 30, 'Doubtful Sound: dark fjord water'),
}


def orient(a, how):
    return a[:, ::-1] if how == 'mirror' else a[::-1, ::-1] if how == 'rot180' else a


def tileable(a, m=20):
    """Seamless patch: the last m rows/cols are cross-faded into the first, then cut away."""
    n = a.shape[0] - m
    w = (np.arange(m) + 0.5) / m
    b = a.copy()
    b[:m] = a[:m] * w[:, None, None] + a[n:n + m] * (1 - w[:, None, None])
    b = b[:n]
    c = b.copy()
    c[:, :m] = b[:, :m] * w[None, :, None] + b[:, n:n + m] * (1 - w[None, :, None])
    return c[:, :n]


def highpass(a, sigma):
    lo = np.stack([gaussian_filter(a[..., k], sigma, mode='wrap') for k in range(3)], -1)
    mean = a.reshape(-1, 3).mean(0)
    return np.clip(a / np.maximum(lo, 1) * mean, 0, 255)


def patch(src, lat, lon, size, how, t=None, sigma=20):
    m = 20
    a = ed.sample(src, lat, lon, size * (N + m) / N, N + m, t)
    a = orient(a, how)
    raw_mean = a.reshape(-1, 3).mean(0)
    a = tileable(a, m)
    return highpass(a, sigma), raw_mean


def main():
    cells, meta, stats = [], [], {}
    for name, src, at, place, use in CLASSES:
        fs, cs, how = SRC[src]
        t = MODIS_TIME.get(name)
        kind = src
        if src == 's2': src = ed.find_scene(at[0], at[1])
        lat, lon = (at[1], at[2]) if at[0] == 'flat' else (at[0], at[1])
        print('sampling', name, place, file=sys.stderr)
        if kind == 'modis':
            coarse, cm = patch(src, lat, lon, cs, how, t, sigma=24)
            fine = np.tile(coarse.reshape(-1, 3).mean(0), (N, N, 1))     # sea ice close up: plain
        elif at[0] == 'flat':                         # snow: no texture at 10 m worth repeating
            coarse, cm = patch(src, lat, lon, cs, how, t, sigma=24)
            fine = np.tile(cm, (N, N, 1))
        else:
            fine, fm = patch(src, lat, lon, fs, how, t, sigma=16)
            if len(at) > 2 and at[2] == 'flat':      # a class narrower than the coarse patch: no coarse pattern
                coarse = np.tile(fm, (N, N, 1)); cm = fm
            else:
                clat, clon = (at[2], at[3]) if len(at) > 3 else (lat, lon)
                coarse, cm = patch(src, clat, clon, cs, how, t, sigma=24)
        cells += [fine, coarse]
        mean = [round(float(v)) for v in cm]
        meta.append({'name': name, 'fine': (1280.0 if kind == 'modis' else fs) / N, 'coarse': cs / N, 'mean': mean})
        stats[name] = {'source': src, 'at': list(at), 'place': place, 'use': use, 'mean': mean,
                       'fine_m_per_px': meta[-1]['fine'], 'coarse_m_per_px': meta[-1]['coarse']}
    # atlas: two cells per class, 8 cells per row
    per = 8; rows = -(-len(cells) // per)
    atlas = np.zeros((rows * N, per * N, 3), np.uint8)
    for k, c in enumerate(cells):
        j, i = divmod(k, per); atlas[j * N:(j + 1) * N, i * N:(i + 1) * N] = np.clip(c, 0, 255).astype(np.uint8)
    buf = io.BytesIO(); Image.fromarray(atlas).save(buf, 'WEBP', quality=88, method=6)
    Image.fromarray(atlas).save(os.path.join(ed.CACHE, 'atlas_preview.png'))
    # preview: each patch tiled 2x2 so seams would show
    prev = np.concatenate([np.concatenate([np.tile(c, (2, 2, 1)) for c in cells[k:k + 8]], 1) for k in range(0, len(cells), 8) if len(cells[k:k + 8]) == 8], 0)
    Image.fromarray(np.clip(prev, 0, 255).astype(np.uint8)).save(os.path.join(ed.CACHE, 'tiles_preview.jpg'), quality=85)
    water = {}
    for k, (lat, lon, size, pc, what) in WATER.items():
        a = ed.sample('linz', lat, lon, size, 400).reshape(-1, 3)
        a = a[(a[:, 2] > a[:, 0] + 8) & (a[:, 2] > 15)]
        lum = a @ np.array([0.3, 0.59, 0.11]); o = np.argsort(lum); i = o[int(pc / 100 * (len(o) - 1))]
        sel = a[o[max(0, int(pc / 100 * len(o)) - len(o) // 50):int(pc / 100 * len(o)) + len(o) // 50 + 1]]
        water[k] = [round(float(v)) for v in np.median(sel, 0)]
        stats['water:' + k] = {'source': 'linz', 'at': [lat, lon], 'percentile': pc, 'place': what, 'mean': water[k]}
    b64 = base64.b64encode(buf.getvalue()).decode()
    doc = {'atlas': {'cell': N, 'per_row': per}, 'classes': meta, 'water': water}
    json.dump({'classes': stats}, open(os.path.join(HERE, 'textures.json'), 'w'), indent=1, ensure_ascii=False)
    js = ('/* Land-cover texture patches sampled from real landscapes (generated by tools/analogues/textures.py; see\n'
          '   docs/ANALOGUES.md). New Zealand patches: LINZ New Zealand 10 m Satellite Imagery 2024-2025, sourced from\n'
          '   LINZ, CC BY 4.0. Iceland and Hawaii: contains modified Copernicus Sentinel data (2022-2024). Others: NASA\n'
          '   Landsat WELD and MODIS via NASA GIBS, public domain. */\n'
          'const TEXTURES = ' + json.dumps(doc, ensure_ascii=False) + ';\n'
          'TEXTURES.webp = "' + b64 + '";\n'
          'if (typeof self !== "undefined") self.TEXTURES = TEXTURES;\n')
    open(os.path.join(HERE, '..', '..', 'src', 'textures.js'), 'w').write(js)
    print('atlas', atlas.shape, 'webp', len(buf.getvalue()) // 1024, 'KB', file=sys.stderr)
    print(json.dumps(water))


if __name__ == '__main__':
    main()
