"""Sample the atlas terrain onto a 2-mile grid for journey routing.
Run with the dev server up (npm run serve). Writes tools/routing/terrain.npz (git-ignored)."""
import asyncio, json, os, sys
import numpy as np
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
X0, X1, Y0, Y1, S = -460, 1010, -790, 210, 2.0
JS = """([x0, x1, y, s]) => { const out = [];
  for (let x = x0; x < x1; x += s) { const h = GEN.evaluate(x, y, s), F = GEN.F, R = GEN.R;
    out.push([Math.round(h), +R.s.toFixed(3), +F[2].toFixed(2), +F[3].toFixed(2), +F[4].toFixed(2), +F[6].toFixed(2), +F[7].toFixed(2), +F[15].toFixed(2)]); }
  return out; }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('PW_CHROME') or None)
        pg = await b.new_page()
        root = os.path.abspath(os.path.join(HERE, '..', '..')) + '/'
        await pg.route('https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist/maplibre-gl.js', lambda r: r.fulfill(path=root + 'node_modules/maplibre-gl/dist/maplibre-gl.js', content_type='text/javascript'))
        await pg.route('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js', lambda r: r.fulfill(path=root + 'node_modules/three/build/three.module.js', content_type='text/javascript', headers={'Access-Control-Allow-Origin': '*'}))
        await pg.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(body='', content_type='text/css'))
        await pg.route('https://fonts.gstatic.com/**', lambda r: r.abort())
        await pg.goto('http://localhost:8765/dist/preview.html')
        await pg.wait_for_function('window.GEN && GEN.F && window.GEO && (()=>{try{GEN.evaluate(0,0,1);return true}catch(e){return false}})()', timeout=240000)
        rows = []
        ys = np.arange(Y1, Y0, -S) - S / 2
        for i, y in enumerate(ys):
            rows.append(await pg.evaluate(JS, [X0 + S / 2, X1, float(y), S]))
            if i % 50 == 0: print('row', i, '/', len(ys), flush=True)
        a = np.array(rows, dtype=np.float32)
        np.savez_compressed(os.path.join(HERE, 'terrain.npz'), a=a, box=np.array([X0, X1, Y0, Y1, S]))
        print('saved', a.shape)
        await b.close()
asyncio.run(main())
