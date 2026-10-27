"""Render gate: checks what the renderer actually draws, in a headless browser.

- drawn rivers: no stretch over rendered sea longer than 0.75 mi; never more than 1 mi from their authored line;
  no rise of more than 5 m within a mile downstream; never more than 5 m above the lower bank at 1, 1.5 and 2 mi
  (allowed on at most 2% of the sampled miles);
- every place stands on rendered land;
- the rendered coast differs from the vector coast on no more than 1% of each checked region.

Run: python3 tools/qa/qa_render.py [--verbose]   (starts scripts/serve.js if nothing listens on 8765; exit 1 on
failure; writes tools/qa/render_report.json). Part of `npm run audit`.
"""
import asyncio, json, os, socket, subprocess, sys, time
from playwright.async_api import async_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')) + '/'
STRAY, SEA, RISE, VF_SHARE, COAST_PCT = 1.0, 0.75, 5, 0.02, 1.0


async def run():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('PW_CHROME') or None, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width': 800, 'height': 600})
        await pg.route('https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist/maplibre-gl.js', lambda r: r.fulfill(path=ROOT + 'node_modules/maplibre-gl/dist/maplibre-gl.js', content_type='text/javascript'))
        await pg.route('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js', lambda r: r.fulfill(path=ROOT + 'node_modules/three/build/three.module.js', content_type='text/javascript', headers={'Access-Control-Allow-Origin': '*'}))
        await pg.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(body='', content_type='text/css'))
        await pg.route('https://fonts.gstatic.com/**', lambda r: r.abort())
        await pg.goto('http://localhost:8765/dist/preview.html')
        await pg.wait_for_function("window.ARDA && window.GEN && document.getElementById('loader')==null", timeout=300000)
        rep = await pg.evaluate(open(os.path.join(ROOT, 'tools', 'qa', 'qa_render.js'), encoding='utf8').read())
        await b.close()
        return rep


def ensure_server():
    try:
        socket.create_connection(('localhost', 8765), timeout=1).close(); return None
    except OSError:
        p = subprocess.Popen(['node', 'scripts/serve.js'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(1.5); return p


def main():
    srv = ensure_server()
    try:
        rep = asyncio.run(run())
    finally:
        if srv: srv.terminate()
    json.dump(rep, open(os.path.join(ROOT, 'tools', 'qa', 'render_report.json'), 'w'), indent=1)
    verbose = '--verbose' in sys.argv
    fails = []
    for r in rep['rivers']:
        why = []
        if r['sea'] > SEA: why.append(f"{r['sea']} mi over sea near {r['seaAt']}")
        if r['stray'] > STRAY: why.append(f"strays {r['stray']} mi from its line near {r['strayAt']}")
        if r['rise'] > RISE: why.append(f"rises {r['rise']} m downstream near {r['riseAt']} ({r['risePts']} places)")
        if r['vfOf'] and r['vfBad'] / r['vfOf'] > VF_SHARE: why.append(f"above its banks on {r['vfBad']}/{r['vfOf']} miles (worst {r['vfMax']} m near {r['vfAt']})")
        if why: fails.append(f"{r['name']}: " + '; '.join(why))
        elif verbose: print(f"ok   {r['name']}")
    for p in rep['places']: fails.append(f"{p['name']} at {p['at']} renders in the sea (s {p['s']}, h {p['h']} m)")
    for c in rep['coast']:
        line = f"{c['name']}: rendered coast differs on {c['pct']}% (sea drawn as land {c['seaDrawnAsLand']} sq mi, land drawn as sea {c['landDrawnAsSea']} sq mi)"
        (fails.append(line) if c['pct'] > COAST_PCT else print('ok   ' + line))
    for f in fails: print('FAIL ' + f)
    n = len(rep['rivers'])
    print(f"\n{len(fails)} render check(s) failed" if fails else f"\nrender ok ({n} rivers, {len(rep['coast'])} coast regions)")
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
