/* Local Game Studio — build tools for generated games.
   devIndex(): a modular development build that opens straight from disk (file://).
   standalone(): ONE self-contained HTML file: engine + styles + game definition + assets + custom
   modules, no network requests. */
'use strict';
const fs = require('fs');
const path = require('path');
const ENGINE = __dirname;
const manifest = () => JSON.parse(fs.readFileSync(path.join(ENGINE, 'manifest.json'), 'utf8'));
const safeJS = (s) => String(s).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const LS = new RegExp(String.fromCharCode(0x2028), 'g'), PS = new RegExp(String.fromCharCode(0x2029), 'g');
const safeJSON = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(LS, '\\u2028').replace(PS, '\\u2029');
const escHtml = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function needsAsset(gdl, key) {
  const s = JSON.stringify((gdl && gdl.ui) || {});
  if (key === 'worldLand') return /"basemap"\s*:\s*"world"/.test(s);
  return false;
}
function readAssets(gdl) {
  const m = manifest(); const out = {};
  for (const [k, rel] of Object.entries(m.assets || {})) if (needsAsset(gdl, k)) out[k] = JSON.parse(fs.readFileSync(path.join(ENGINE, rel), 'utf8'));
  return out;
}
function iconSvg(gdl) {
  const t = gdl.theme || {}, pal = t.palette || {};
  const bg = pal.accent || '#1f4e79', fg = pal.accentInk || '#fff';
  const txt = ((t.logo && t.logo.text) || (gdl.meta && gdl.meta.title || 'G').split(/\s+/).map(w => w[0]).join('').slice(0, 2)).toUpperCase();
  return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${bg}"/><text x="32" y="41" font-family="Georgia,serif" font-size="26" font-weight="700" text-anchor="middle" fill="${fg}">${txt}</text></svg>`);
}

/* Single-file release. customJs: array of {name, code}. */
function standalone({ gdl, customJs = [], extraCss = '' }) {
  const m = manifest();
  const css = m.css.map(f => fs.readFileSync(path.join(ENGINE, f), 'utf8')).join('\n') + '\n' + (extraCss || '');
  const js = m.sim.concat(m.ui).map(f => `/* ${f} */\n` + fs.readFileSync(path.join(ENGINE, f), 'utf8')).join('\n');
  const assets = readAssets(gdl);
  const title = (gdl.meta && gdl.meta.title) || 'Game';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(title)}</title><link rel="icon" href="${iconSvg(gdl)}">
<meta name="generator" content="Local Game Studio">
<style>${css}</style></head>
<body class="lg-game"><div id="app"><noscript>This game needs JavaScript.</noscript></div>
<script>${safeJS(js)}</script>
<script>LGE.assets = ${safeJSON(assets)};</script>
<script id="gdl" type="application/json">${safeJSON(gdl)}</script>
${customJs.map(c => `<script>/* custom: ${escHtml(c.name)} */\n${safeJS(c.code)}</script>`).join('\n')}
<script>
(function(){ try { var gdl = JSON.parse(document.getElementById('gdl').textContent); window.__app = LGE.ui.start(document.getElementById('app'), gdl); }
catch (e) { document.getElementById('app').innerHTML = '<pre style="padding:20px">Failed to start: ' + String(e && e.stack || e) + '</pre>'; console.error(e); } })();
</script></body></html>`;
}

/* Development build inside a project folder:
   game/index.html, game/engine/** (copy), game/data/game.json + game.js, game/src/custom/*.js, game/styles/theme.css */
function writeDevProject(gameDir, gdl, { customFiles = {} } = {}) {
  const m = manifest();
  fs.mkdirSync(path.join(gameDir, 'data'), { recursive: true });
  fs.mkdirSync(path.join(gameDir, 'src', 'custom'), { recursive: true });
  fs.mkdirSync(path.join(gameDir, 'styles'), { recursive: true });
  fs.mkdirSync(path.join(gameDir, 'tests'), { recursive: true });
  // pinned engine copy
  for (const f of m.sim.concat(m.ui).concat(m.css).concat(Object.values(m.assets || {})).concat(['manifest.json', 'node.js', 'bundle.js'])) {
    const dst = path.join(gameDir, 'engine', f);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(path.join(ENGINE, f), dst);
  }
  const assets = readAssets(gdl);
  fs.writeFileSync(path.join(gameDir, 'data', 'game.json'), JSON.stringify(gdl, null, 1));
  fs.writeFileSync(path.join(gameDir, 'data', 'game.js'), `/* generated from game.json — do not edit by hand */\nwindow.GDL = ${safeJSON(gdl)};\nLGE.assets = ${safeJSON(assets)};\n`);
  for (const [name, code] of Object.entries(customFiles)) fs.writeFileSync(path.join(gameDir, 'src', 'custom', name), code);
  const customs = fs.readdirSync(path.join(gameDir, 'src', 'custom')).filter(f => f.endsWith('.js'));
  const title = (gdl.meta && gdl.meta.title) || 'Game';
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(title)} (dev)</title>
<link rel="icon" href="${iconSvg(gdl)}">
${m.css.map(f => `<link rel="stylesheet" href="engine/${f}">`).join('\n')}
<link rel="stylesheet" href="styles/theme.css">
</head><body class="lg-game"><div id="app"></div>
${m.sim.concat(m.ui).map(f => `<script src="engine/${f}"></script>`).join('\n')}
<script src="data/game.js"></script>
${customs.map(f => `<script src="src/custom/${f}"></script>`).join('\n')}
<script>window.__app = LGE.ui.start(document.getElementById('app'), window.GDL);</script>
</body></html>`;
  fs.writeFileSync(path.join(gameDir, 'index.html'), html);
  if (!fs.existsSync(path.join(gameDir, 'styles', 'theme.css'))) fs.writeFileSync(path.join(gameDir, 'styles', 'theme.css'), '/* game-specific style overrides (optional) */\n');
  return path.join(gameDir, 'index.html');
}
function readCustom(gameDir) {
  const dir = path.join(gameDir, 'src', 'custom');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort().map(f => ({ name: f, code: fs.readFileSync(path.join(dir, f), 'utf8') }));
}
function standaloneFromProject(gameDir) {
  const gdl = JSON.parse(fs.readFileSync(path.join(gameDir, 'data', 'game.json'), 'utf8'));
  const extraCss = fs.existsSync(path.join(gameDir, 'styles', 'theme.css')) ? fs.readFileSync(path.join(gameDir, 'styles', 'theme.css'), 'utf8') : '';
  return standalone({ gdl, customJs: readCustom(gameDir), extraCss });
}
module.exports = { standalone, writeDevProject, standaloneFromProject, readCustom, manifest };
