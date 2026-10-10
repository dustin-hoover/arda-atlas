// Assembles src/ into one self-contained page: dist/index.html (no <html>/<head>, for the claude.ai
// artifact host) and dist/preview.html (a full document for local testing).
const fs = require('fs');
const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
let html = rd('src/index.tpl.html');
const guard = (name, s) => { if (/<\/script/i.test(s)) throw new Error(name + ' contains a closing script tag'); return s; };
const put = (k, v) => { const i = html.indexOf(k); if (i < 0) throw new Error('template placeholder missing: ' + k); html = html.slice(0, i) + v + html.slice(i + k.length); };
put('/*MAPLIBRE_CSS*/', rd('node_modules/maplibre-gl/dist/maplibre-gl.css'));
put('/*APP_CSS*/', rd('src/app.css'));
for (const [k, f] of [['GEN_JS', 'gen.js'], ['WX_JS', 'wx.js'], ['WORKER_JS', 'worker.js'], ['GEO_JS', 'geo.js'], ['ANALOGUES_JS', 'analogues.js'], ['ROUTES_JS', 'routes.js'], ['SOURCES_JS', 'sources.js'], ['AVATARS_JS', 'avatars.js'], ['RASTERS_JS', 'rasters.js'], ['AUDIO_JS', 'audio.js'], ['APP_JS', 'app.js'], ['GROUND_JS', 'ground.js']])
  put('/*' + k + '*/', guard(f, rd('src/' + f) + (f === 'ground.js' ? '\n' + rd('src/world3d.js') : '')));
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist/index.html'), html);
fs.writeFileSync(path.join(__dirname, 'dist/preview.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + html + '</body></html>');
// site/: full documents ready for any static host (GitHub Pages, Netlify, Cloudflare Pages)
const wrap = body => '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + body + '</body></html>';
fs.mkdirSync(path.join(__dirname, 'site'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'site/index.html'), wrap(html));
fs.writeFileSync(path.join(__dirname, 'site/blueprint.html'), wrap(rd('dist/blueprint.html')));
console.log('built dist/index.html', (html.length / 1024).toFixed(0) + ' KB');
