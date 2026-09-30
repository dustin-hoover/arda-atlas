import sys, asyncio, json, time
from playwright.async_api import async_playwright
import os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..'))+'/'
async def main(steps, w=1440, h=900):
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'])
        pg = await b.new_page(viewport={'width':w,'height':h})
        msgs=[]
        pg.on('console', lambda m: msgs.append(f'{m.type}: {m.text[:300]}'))
        pg.on('pageerror', lambda e: msgs.append('PAGEERROR '+str(e)[:600]))
        await pg.route('https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist/maplibre-gl.js', lambda r: r.fulfill(path=ROOT+'node_modules/maplibre-gl/dist/maplibre-gl.js', content_type='text/javascript'))
        await pg.route('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js', lambda r: r.fulfill(path=ROOT+'node_modules/three/build/three.module.js', content_type='text/javascript', headers={'Access-Control-Allow-Origin':'*'}))
        await pg.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(body='', content_type='text/css'))
        await pg.route('https://fonts.gstatic.com/**', lambda r: r.abort())
        t0=time.time()
        await pg.goto('http://localhost:8765/dist/preview.html')
        for st in steps:
            kind=st[0]
            if kind=='waitready':
                await pg.wait_for_function("window.ARDA && document.getElementById('loader')==null", timeout=240000)
                print('ready', round(time.time()-t0,1))
            elif kind=='eval':
                r = await pg.evaluate(st[1]); 
                if r is not None: print('eval->', str(r)[:500])
            elif kind=='idle':
                try:
                    await pg.wait_for_function("window.ARDA && ARDA.map.loaded() && ARDA.map.areTilesLoaded()", timeout=st[1] if len(st)>1 else 120000, polling=500)
                except Exception as e: print('idle timeout')
                await asyncio.sleep(1.0)
            elif kind=='sleep':
                await asyncio.sleep(st[1])
            elif kind=='shot':
                await pg.screenshot(path=ROOT+'tools/shots/'+st[1], timeout=180000); print('shot', st[1], round(time.time()-t0,1))
            elif kind=='click':
                await pg.mouse.click(st[1], st[2])
            elif kind=='key':
                await pg.keyboard.down(st[1]); await asyncio.sleep(st[2]); await pg.keyboard.up(st[1])
        for m in msgs[-40:]: print(m)
        await b.close()
steps=json.loads(sys.argv[1])
w=int(sys.argv[2]) if len(sys.argv)>2 else 1440
h=int(sys.argv[3]) if len(sys.argv)>3 else 900
asyncio.run(main(steps,w,h))
