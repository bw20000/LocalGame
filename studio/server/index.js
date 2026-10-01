/* Local Game Studio — HTTP server. Zero dependencies. Binds to 127.0.0.1 by default, rejects
   requests whose Host/Origin is not this machine (DNS-rebinding and cross-site protection), and
   never calls anything outside this machine except the local model runtime you configured (and a
   cloud provider only if you enabled one AND picked it for a build). */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const config = require('./config');
const { Store, MEMORY_DOCS } = require('./projects/store');
const O = require('./pipeline/orchestrator');
const compiler = require('./pipeline/compiler');
const modify = require('./pipeline/modify');
const remaster = require('./pipeline/remaster');
const browser = require('./qa/browser');

const WEB = path.join(config.ROOT, 'studio', 'web');
const VERSION = (() => { try { return JSON.parse(fs.readFileSync(path.join(config.ROOT, 'package.json'), 'utf8')).version; } catch (e) { return '1.0.0'; } })();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.md': 'text/markdown; charset=utf-8', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };

function send(res, code, body, type) {
  const isObj = body !== null && typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(code, { 'content-type': type || (isObj ? MIME['.json'] : 'text/plain; charset=utf-8'), 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(isObj ? JSON.stringify(body) : body);
}
const ok = (res, body) => send(res, 200, body);
const bad = (res, msg, code = 400) => send(res, code, { error: msg });
function serveFile(res, file, extraHeaders) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return bad(res, 'Not found', 404);
    res.writeHead(200, Object.assign({ 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'content-length': st.size, 'cache-control': 'no-store' }, extraHeaders || {}));
    fs.createReadStream(file).pipe(res);
  });
}
/* Resolve `rel` inside `root`, refusing anything that escapes it. */
function inside(root, rel) {
  const p = path.resolve(root, '.' + path.sep + decodeURIComponent(rel || ''));
  return p === root || p.startsWith(root + path.sep) ? p : null;
}
function readBody(req, limit = 60 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('Request too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { const s = Buffer.concat(chunks).toString('utf8'); if (!s) return resolve({}); try { resolve(JSON.parse(s)); } catch (e) { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}
function localOnly(req, port) {
  const host = String(req.headers.host || '').toLowerCase().replace(/:\d+$/, '');
  if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(host)) return false;
  const origin = req.headers.origin;
  if (origin && origin !== 'null') { try { const o = new URL(origin); if (!['127.0.0.1', 'localhost', '[::1]'].includes(o.hostname)) return false; } catch (e) { return false; } }
  return true;
}
function sse(res) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
  res.write(': connected\n\n');
  const keep = setInterval(() => res.write(': ping\n\n'), 15000);
  return { send: (data) => res.write(`data: ${JSON.stringify(data)}\n\n`), close: () => { clearInterval(keep); res.end(); }, keep };
}
function maskSettings(s) {
  const c = JSON.parse(JSON.stringify(s));
  for (const p of Object.values(c.providers || {})) if (p.apiKey) p.apiKey = p.apiKey ? '••••' + String(p.apiKey).slice(-4) : '';
  return c;
}
function projectDetail(pr) {
  const m = pr.meta;
  const reports = {};
  for (const r of ['tests', 'browser', 'balance', 'audit']) { const x = pr.report(r); if (x) reports[r] = r === 'balance' ? { findings: x.findings, aggregate: { strategies: Object.fromEntries(Object.entries(x.aggregate.strategies).map(([k, v]) => [k, { survival: v.survival, medianMargin: v.medianMargin, medianValueGrowth: v.medianValueGrowth, valueByYear: v.valueByYear, profitByYear: v.profitByYear }])), runs: x.aggregate.runs }, years: x.years, at: x.at } : r === 'browser' ? Object.assign({}, x, { metrics: x.metrics }) : x; }
  const shots = fs.existsSync(pr.p('reports', 'screenshots')) ? fs.readdirSync(pr.p('reports', 'screenshots')).filter(f => f.endsWith('.png')).sort() : [];
  return Object.assign(pr.summary(), { meta: m, prompt: pr.prompt(), memoryDocs: MEMORY_DOCS.concat(fs.existsSync(pr.p('memory', 'FEATURE_INVENTORY.md')) ? ['FEATURE_INVENTORY'] : []).filter(n => pr.memory(n)), versions: pr.versions(), releases: pr.releases(), history: pr.history().slice(-80).reverse(), reports, screenshots: shots, trace: pr.artifact('trace'), requirements: pr.artifact('requirements'), brief: pr.artifact('brief') });
}

async function route(req, res, port) {
  const u = url.parse(req.url, true);
  const p = u.pathname;
  const M = req.method;
  const seg = p.split('/').filter(Boolean);
  // ---------- static studio UI ----------
  if (M === 'GET' && (p === '/' || p === '/index.html')) return serveFile(res, path.join(WEB, 'index.html'));
  if (M === 'GET' && seg[0] === 'web') { const f = inside(WEB, seg.slice(1).join('/')); return f ? serveFile(res, f) : bad(res, 'Not found', 404); }
  // play a project's dev build (pinned engine copy inside the project)
  if (M === 'GET' && seg[0] === 'play' && seg[1]) {
    const pr = Store.get(seg[1]); if (!pr) return bad(res, 'No such project', 404);
    if (seg.length === 2) { res.writeHead(302, { location: `/play/${pr.id}/index.html` }); return res.end(); }
    const f = inside(pr.p('game'), seg.slice(2).join('/')); return f ? serveFile(res, f) : bad(res, 'Not found', 404);
  }
  if (seg[0] !== 'api') return bad(res, 'Not found', 404);
  const api = seg.slice(1);

  // ---------- status / settings / preferences ----------
  if (M === 'GET' && api[0] === 'status') {
    const llm = require('./llm').get(); llm.reload();
    const st = await llm.status().catch(e => ({ error: e.message }));
    return ok(res, { version: VERSION, llm: st, browserQA: browser.available(), projects: Store.list().length, jobs: O.list().filter(j => j.status === 'running' || j.status === 'queued' || j.status === 'paused').length, host: config.hostname, node: process.version, dataDir: config.DATA, projectsDir: config.PROJECTS });
  }
  if (api[0] === 'settings') {
    if (M === 'GET') return ok(res, maskSettings(config.loadSettings()));
    if (M === 'PUT') {
      const body = await readBody(req); const cur = config.loadSettings();
      // keep stored secrets when the UI sends back the masked value
      for (const [k, prov] of Object.entries((body.providers || {}))) if (prov && typeof prov.apiKey === 'string' && prov.apiKey.startsWith('••••')) prov.apiKey = cur.providers[k] && cur.providers[k].apiKey;
      const next = config.deepMerge(cur, body);
      if (next.host !== '127.0.0.1' && next.host !== 'localhost' && !body.confirmExpose) next.host = '127.0.0.1'; // exposing the server needs explicit confirmation
      config.saveSettings(next); require('./llm').get().reload();
      return ok(res, maskSettings(next));
    }
  }
  if (api[0] === 'preferences') {
    if (M === 'GET') return ok(res, config.loadPrefs());
    if (M === 'PUT') { const body = await readBody(req); return ok(res, config.savePrefs(config.deepMerge(config.loadPrefs(), body))); }
  }
  // ---------- models ----------
  if (api[0] === 'models') {
    const llm = require('./llm').get(); llm.reload();
    if (M === 'GET' && !api[1]) {
      const [st, rec, inst] = await Promise.all([llm.status().catch(() => null), llm.recommendations().catch(() => []), llm.installed().catch(() => [])]);
      let bench = {}; try { bench = JSON.parse(fs.readFileSync(path.join(config.DATA, 'benchmarks.json'), 'utf8')); } catch (e) { /* none yet */ }
      return ok(res, { status: st, recommendations: rec, installed: inst, roles: llm.settings.roles, hardware: llm.hw, benchmarks: bench });
    }
    if (M === 'GET' && api[1] === 'pull') {
      const model = String(u.query.model || ''); if (!/^[\w.:\-/]+$/.test(model)) return bad(res, 'Invalid model name');
      const s = sse(res);
      llm.pull(model, (p) => s.send({ type: 'progress', status: p.status, completed: p.completed, total: p.total })).then(() => { s.send({ type: 'done' }); s.close(); }).catch(e => { s.send({ type: 'error', error: e.message }); s.close(); });
      req.on('close', () => clearInterval(s.keep));
      return;
    }
    if (M === 'POST' && api[1] === 'roles') { const body = await readBody(req); return ok(res, llm.setRoles(body)); }
    if (M === 'POST' && api[1] === 'remove') { const body = await readBody(req); await llm.remove(body.model); return ok(res, { removed: body.model }); }
    if (M === 'POST' && api[1] === 'benchmark') { const body = await readBody(req); try { return ok(res, await llm.benchmark(body.model)); } catch (e) { return bad(res, e.message, 500); } }
  }
  // ---------- library ----------
  if (M === 'GET' && api[0] === 'library') {
    if (!api[1]) {
      const files = fs.readdirSync(config.LIBRARY).filter(f => f.endsWith('.json') || f.endsWith('.md'));
      return ok(res, files.map(f => { let n = null; try { const j = f.endsWith('.json') ? JSON.parse(fs.readFileSync(path.join(config.LIBRARY, f), 'utf8')) : null; n = j ? (j.patterns || j.loops || j.mechanics || j.genres || j.games || j.criteria || j.briefs || []).length : null; } catch (e) { /* ignore */ } return { file: f, items: n, bytes: fs.statSync(path.join(config.LIBRARY, f)).size }; }));
    }
    const f = inside(config.LIBRARY, api.slice(1).join('/')); return f ? serveFile(res, f) : bad(res, 'Not found', 404);
  }
  if (M === 'GET' && api[0] === 'benchmarks') { try { return ok(res, JSON.parse(fs.readFileSync(path.join(config.LIBRARY, 'benchmarks.json'), 'utf8'))); } catch (e) { return ok(res, { briefs: [] }); } }
  if (M === 'POST' && api[0] === 'benchmarks' && api[1] === 'run') {
    const body = await readBody(req);
    const all = JSON.parse(fs.readFileSync(path.join(config.LIBRARY, 'benchmarks.json'), 'utf8')).briefs;
    const out = [];
    for (const b of all.filter(x => (body.ids || []).includes(x.id))) {
      const pr = Store.create({ title: `Benchmark ${b.id}: ${b.name}`, prompt: b.prompt, mode: 'create', options: { benchmark: b.id } });
      pr.update(m => { m.benchmark = b.id; });
      out.push({ project: pr.id, job: O.start('create', pr.id, {}, { useLLM: body.useLLM !== false }).id });
    }
    return ok(res, out);
  }
  // ---------- prompt tools ----------
  if (M === 'POST' && api[0] === 'compile') { const body = await readBody(req); return ok(res, compiler.compileDeterministic(body.prompt || '')); }
  if (M === 'POST' && api[0] === 'analyze') { const body = await readBody(req); return ok(res, remaster.analyzeHtml(body.content || '', body.name || 'game.html')); }
  if (M === 'POST' && api[0] === 'classify') { const body = await readBody(req); return ok(res, modify.classify(body.request || '')); }
  // ---------- jobs ----------
  if (api[0] === 'jobs') {
    if (M === 'GET' && !api[1]) return ok(res, O.list());
    const job = O.get(api[1]); if (!job) return bad(res, 'No such job', 404);
    if (M === 'GET' && !api[2]) return ok(res, job.snapshot());
    if (M === 'GET' && api[2] === 'events') {
      const s = sse(res);
      s.send({ type: 'snapshot', job: job.snapshot() });
      const snap = job.snapshot();
      if (['done', 'failed', 'cancelled'].includes(snap.status)) { s.close(); return; }
      const on = (e) => { s.send(e); if (e.type === 'status' && ['done', 'failed', 'cancelled'].includes(e.status)) { job.off('event', on); s.close(); } };
      job.on('event', on);
      req.on('close', () => { job.off('event', on); clearInterval(s.keep); });
      return;
    }
    if (M === 'POST' && api[2] === 'cancel') return ok(res, { cancelled: O.cancel(api[1]) });
    if (M === 'POST' && api[2] === 'resume') { const body = await readBody(req); return ok(res, { resumed: O.resume(api[1], body) }); }
  }
  // ---------- projects ----------
  if (api[0] === 'projects') {
    if (M === 'GET' && !api[1]) return ok(res, Store.list());
    if (M === 'POST' && !api[1]) {
      const body = await readBody(req);
      const mode = ['create', 'remaster', 'expand'].includes(body.mode) ? body.mode : 'create';
      if (!String(body.prompt || '').trim() && mode === 'create') return bad(res, 'Describe the game you want.');
      const atts = (body.attachments || []).filter(a => a && a.name && typeof a.content === 'string').slice(0, 10);
      if ((mode === 'remaster' || mode === 'expand') && !atts.some(a => /\.html?$/i.test(a.name))) return bad(res, 'Attach the HTML game to remaster.');
      const pr = Store.create({ title: body.title || '', prompt: body.prompt || '', mode, options: body.options || {}, attachments: atts });
      const job = O.start(mode === 'create' ? 'create' : 'remaster', pr.id, { options: body.options || {} }, { review: !!body.review, useLLM: body.useLLM !== false });
      return ok(res, { project: pr.summary(), job: job.snapshot() });
    }
    const pr = Store.get(api[1]); if (!pr) return bad(res, 'No such project', 404);
    if (M === 'GET' && !api[2]) return ok(res, projectDetail(pr));
    if (M === 'DELETE' && !api[2]) { Store.remove(pr.id); return ok(res, { deleted: pr.id }); }
    if (M === 'PATCH' && !api[2]) { const body = await readBody(req); pr.update(m => { if (body.title) m.title = String(body.title).slice(0, 80); if (body.notes != null) m.notes = String(body.notes).slice(0, 4000); }); return ok(res, pr.summary()); }
    if (api[2] === 'memory' && api[3]) {
      const name = api[3].replace(/[^A-Z_]/g, '');
      if (M === 'GET') return send(res, 200, pr.memory(name), MIME['.md']);
      if (M === 'PUT') { const body = await readBody(req); pr.writeMemory(name, String(body.text || '')); pr.log('edit', `Edited ${name}`); return ok(res, { saved: name }); }
    }
    if (M === 'GET' && api[2] === 'report' && api[3]) { if (api[3] === 'AUDIT.md') return serveFile(res, pr.p('reports', 'AUDIT.md')); const r = pr.report(api[3].replace(/[^a-z-]/g, '')); return r ? ok(res, r) : bad(res, 'No report yet', 404); }
    if (M === 'GET' && api[2] === 'screenshots' && api[3]) { const f = inside(pr.p('reports', 'screenshots'), api[3]); return f ? serveFile(res, f) : bad(res, 'Not found', 404); }
    if (M === 'GET' && api[2] === 'release' && api[3]) { const f = inside(pr.p('releases'), api[3]); return f ? serveFile(res, f, u.query.download ? { 'content-disposition': `attachment; filename="${path.basename(f)}"` } : null) : bad(res, 'Not found', 404); }
    if (M === 'GET' && api[2] === 'gdl') return ok(res, pr.gdl || {});
    if (M === 'POST' && api[2] === 'request') {
      const body = await readBody(req);
      const request = String(body.request || '').trim(); if (!request) return bad(res, 'Type what you want changed.');
      const cls = modify.classify(request);
      const kind = cls.intents.length === 1 && cls.intents[0] === 'export' ? 'export' : 'modify';
      const job = O.start(kind, pr.id, { request }, { useLLM: body.useLLM !== false });
      return ok(res, { job: job.snapshot(), classification: cls });
    }
    if (M === 'POST' && api[2] === 'jobs') {
      const body = await readBody(req);
      const kind = ['audit', 'balance', 'export', 'create'].includes(body.kind) ? body.kind : null; if (!kind) return bad(res, 'Unknown job kind');
      const job = O.start(kind, pr.id, body.input || {}, { useLLM: body.useLLM !== false, review: !!body.review });
      return ok(res, { job: job.snapshot() });
    }
    if (M === 'POST' && api[2] === 'restore') { const body = await readBody(req); try { pr.restore(String(body.version)); return ok(res, projectDetail(pr)); } catch (e) { return bad(res, e.message); } }
  }
  return bad(res, 'Not found', 404);
}

function start({ port, host, quiet } = {}) {
  const settings = config.loadSettings();
  port = port || +process.env.LGS_PORT || settings.port || 4317;
  host = host || settings.host || '127.0.0.1';
  const server = http.createServer((req, res) => {
    if (!localOnly(req, port)) return bad(res, 'This studio only answers requests from this computer.', 403);
    route(req, res, port).catch(e => { if (!res.headersSent) bad(res, e.message || String(e), 500); else try { res.end(); } catch (x) { /* ignore */ } });
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, host, () => { if (!quiet) console.log(`Local Game Studio ${VERSION} → http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`); resolve(server); });
  });
}
if (require.main === module) {
  const argPort = process.argv.find(a => a.startsWith('--port='));
  start({ port: argPort ? +argPort.split('=')[1] : undefined }).then(() => {
    if (process.argv.includes('--open')) { const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'; require('child_process').exec(`${cmd} http://127.0.0.1:${config.loadSettings().port}`); }
  }).catch(e => { console.error(e.code === 'EADDRINUSE' ? 'The studio is already running (port in use). Open http://127.0.0.1:4317' : e.message); process.exit(1); });
}
module.exports = { start, route };
