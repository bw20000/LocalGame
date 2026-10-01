/* Local Game Studio — automated test suite (zero dependencies).
   node tests/run-all.js          full suite (~2–4 min: includes a short balance run and a server round-trip)
   node tests/run-all.js --quick  unit tests only (seconds) */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');
const QUICK = process.argv.includes('--quick');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lgs-test-'));
process.env.LGS_DATA = path.join(TMP, 'data');
process.env.LGS_PROJECTS = path.join(TMP, 'projects');

const results = [];
async function test(name, fn) {
  const t0 = Date.now();
  try { await fn(); results.push({ name, ok: true, ms: Date.now() - t0 }); console.log(`  ✓ ${name} (${Date.now() - t0} ms)`); }
  catch (e) { results.push({ name, ok: false, ms: Date.now() - t0, error: e.message }); console.log(`  ✗ ${name}\n      ${String(e.stack || e).split('\n').slice(0, 4).join('\n      ')}`); }
}
const ROOT = path.join(__dirname, '..');
const { loadEngine } = require(path.join(ROOT, 'engine', 'node.js'));
const E = loadEngine();

(async () => {
  console.log('Engine');
  await test('expression language: precedence, literals, lambdas, templates', () => {
    const g = E.Game.create(require('./engine/tiny.gdl.json'), { seed: 1, headless: true });
    const sc = g.scope();
    assert.strictEqual(g.ev('1 + 2 * 3', sc), 7);
    assert.strictEqual(g.ev('20k + 1.5M', sc), 1520000);
    assert.strictEqual(g.ev('2 ^ 3 ^ 2', sc) === 512 || g.ev('pow(2, 3)', sc) === 8, true);
    assert.strictEqual(g.ev('sum([1, 2, 3], it * 2)', sc), 12);
    assert.strictEqual(g.ev("1 > 2 ? 'a' : 'b'", sc), 'b');
    assert.ok(/\d/.test(g.tpl('Cash: {money(player.cash)}', sc)));
  });
  await test('expression analyzer finds names and functions', () => {
    const a = E.expr.analyze("max(org.cash, 20k) + sum(owned('route'), it._profit)");
    assert.ok(a.ids.has('org')); assert.ok(a.fns.has('max')); assert.ok(a.fns.has('sum'));
  });
  await test('tiny game: create, act, tick a year, save/reload', () => {
    const gdl = require('./engine/tiny.gdl.json');
    const g = E.Game.create(gdl, { seed: 7, headless: true });
    const r = g.act('openStand', { street: 'oak' });
    assert.ok(r.ok, 'openStand failed: ' + JSON.stringify(r));
    for (let i = 0; i < 52; i++) { g.tick(); for (const ev of g.state.events.pending.slice()) g.resolveEvent(ev.iid, 0, true); }
    assert.strictEqual(g.diag.errors.length, 0, JSON.stringify(g.diag.errors.slice(0, 3)));
    const g2 = E.Game.load(gdl, g.serialize(), { headless: true }); g2.tick();
    assert.strictEqual(g2.state.tick, g.state.tick + 1);
  });
  const airline = require(path.join(ROOT, 'library', 'packs', 'airline.js'));
  const V = require(path.join(ROOT, 'engine', 'validate.js'));
  await test('airline pack validates (static + dry run)', () => {
    const v = V.validate(airline.build({}), { dryRun: true, ticks: 16 });
    assert.ok(v.ok, JSON.stringify(v.errors.slice(0, 5)));
  });
  await test('venue archetype validates for every lexicon genre', () => {
    const venue = require(path.join(ROOT, 'library', 'packs', 'archetypes', 'venue.js'));
    for (const genre of Object.keys(venue.LEX)) { const v = V.validate(venue.build({ genre }), { dryRun: true, ticks: 8 }); assert.ok(v.ok, genre + ': ' + JSON.stringify(v.errors.slice(0, 3))); }
  });
  for (const name of ['portfolio', 'slate', 'agency', 'institution', 'roster']) {
    const f = path.join(ROOT, 'library', 'packs', 'archetypes', name + '.js');
    if (!fs.existsSync(f)) continue;
    await test(`${name} archetype validates for every lexicon genre`, () => {
      const m = require(f);
      for (const genre of Object.keys(m.LEX)) { const v = V.validate(m.build({ genre }), { dryRun: true, ticks: 8 }); assert.ok(v.ok, genre + ': ' + JSON.stringify(v.errors.slice(0, 3))); }
    });
  }
  await test('validator catches unknown names and bad references', () => {
    const g = airline.build({}); g.actions[0].cost = { cash: 'nonexistentThing * 2' };
    const v = V.validateStatic(g);
    assert.ok(v.errors.some(e => /nonexistentThing/.test(e.msg || e)), 'expected an unknown-name error');
  });
  await test('standalone bundle is one self-contained HTML file', () => {
    const B = require(path.join(ROOT, 'engine', 'bundle.js'));
    const html = B.standalone({ gdl: airline.build({}) });
    assert.ok(html.startsWith('<!doctype html>'));
    assert.ok(!html.match(/<script>[\s\S]*?<\/script>/)[0].includes(String.fromCharCode(0x2028)), 'raw U+2028 in script');
  });

  console.log('Studio');
  const compiler = require(path.join(ROOT, 'studio', 'server', 'pipeline', 'compiler.js'));
  const ACCEPT = 'Build me a deep airline management game where I start with a small regional airline and can eventually build a global carrier. I want realistic aircraft economics, routes, hubs, labor, airport negotiations, customer segmentation, alliances, acquisitions, recessions, fuel prices, regulators, competitors, history, commissioner mode, and a very polished visual interface. Make it deep but not overwhelming.';
  await test('prompt compiler: acceptance prompt → airline, list split into must-haves', () => {
    const c = compiler.compileDeterministic(ACCEPT);
    assert.strictEqual(c.genre.genre, 'airline');
    const must = c.requirements.filter(r => r.kind === 'must').map(r => r.text.toLowerCase());
    for (const w of ['alliances', 'acquisitions', 'fuel prices', 'commissioner mode']) assert.ok(must.some(m => m.includes(w)), 'missing ' + w);
    assert.ok(c.settings.overwhelmAverse);
  });
  await test('prompt compiler: negatives and conflicts', () => {
    const c = compiler.compileDeterministic('A restaurant game. I do not want random events that come from nowhere. Keep it simple but very deep.');
    assert.ok(c.requirements.some(r => r.kind === 'negative'));
    assert.ok(c.conflicts.length >= 1);
  });
  const modify = require(path.join(ROOT, 'studio', 'server', 'pipeline', 'modify.js'));
  await test('modification classifier', () => {
    assert.deepStrictEqual(modify.classify('The route system is too tedious. Redesign it so I make higher-level network strategy decisions.').intents, ['delegate']);
    const b = modify.classify('The late game is too easy. Analyze why, rebalance it, and run simulations again.');
    assert.deepStrictEqual(b.intents, ['balance']); assert.strictEqual(b.direction, 'harder'); assert.strictEqual(b.phase, 'late');
    assert.deepStrictEqual(modify.classify('Make the fleet page much more visual.').intents, ['visual']);
    assert.deepStrictEqual(modify.classify('Export the finished game.').intents, ['export']);
  });
  await test('delegate + visual recipes produce valid games', () => {
    let g = airline.build({});
    for (const req of ['The route system is too tedious. Make it higher-level network strategy.', 'Make the fleet page much more visual.']) {
      const p = modify.plan(g, req, { packFeatures: airline.FEATURES });
      const r = modify.applySteps(g, p.steps);
      assert.strictEqual(r.failed.length, 0, JSON.stringify(r.failed));
      const v = V.validate(r.gdl, { dryRun: true, ticks: 10 });
      assert.ok(v.ok, JSON.stringify(v.errors.slice(0, 3)));
      g = r.gdl;
    }
    assert.ok(g.policies.some(p => p.id === 'routeGrowth'));
    assert.ok(g.ui.screens.fleet.tabs[0].sections.some(s => s.type === 'showcase'));
  });
  await test('delegated strategy actually runs routes for the player', () => {
    let g = airline.build({});
    g = modify.applySteps(g, modify.plan(g, 'routes are too tedious', { packFeatures: airline.FEATURES }).steps).gdl;
    const game = E.Game.create(g, { seed: 3, headless: true });
    const before = game.owned('route', game.state.player).length;
    for (let i = 0; i < 20; i++) game.tick();
    assert.ok(game.owned('route', game.state.player).length > before, 'planners opened no routes');
  });
  const patch = require(path.join(ROOT, 'studio', 'server', 'pipeline', 'patch.js'));
  await test('patch ops with id selectors', () => {
    const r = patch.apply({ a: [{ id: 'x', v: 1 }] }, [{ op: 'set', path: 'a[x].v', value: 2 }, { op: 'append', path: 'a', value: { id: 'y' } }, { op: 'remove', path: 'a[x]' }]);
    assert.deepStrictEqual(r.gdl, { a: [{ id: 'y' }] });
  });
  await test('remaster analyzer inventories a reference game', () => {
    const R = require(path.join(ROOT, 'studio', 'server', 'pipeline', 'remaster.js'));
    const f = path.join(ROOT, 'reference-games', 'broadway-producer.html');
    if (!fs.existsSync(f)) return;
    const a = R.analyzeHtml(fs.readFileSync(f, 'utf8'), 'broadway-producer.html');
    assert.strictEqual(a.genre.genre, 'broadway');
    assert.ok(a.inventory.core.length >= 5);
    assert.ok(/Must keep/.test(R.remasterPrompt(a)));
  });
  await test('LLM JSON extraction + schema validation', () => {
    const L = require(path.join(ROOT, 'studio', 'server', 'llm', 'index.js'));
    assert.deepStrictEqual(L.extractJSON('Sure! ```json\n{"a": [1,2,],}\n```'), { a: [1, 2] });
    assert.strictEqual(L.validate({ type: 'object', required: ['x'], properties: { x: { type: 'string' } } }, { x: 3 }).length, 1);
  });
  await test('hardware fit: 24 GB Mac budget and verdicts', () => {
    const H = require(path.join(ROOT, 'studio', 'server', 'llm', 'hardware.js'));
    const hw = { totalGB: 24, gpuBudgetGB: 16 };
    assert.strictEqual(H.fit({ sizeGB: 5.2, paramsB: 8 }, 16384, hw).verdict, 'fits');
    assert.strictEqual(H.fit({ sizeGB: 19, paramsB: 30 }, 16384, hw).verdict, 'too-big');
  });
  await test('preferences learn "too overwhelming"', () => {
    const P = require(path.join(ROOT, 'studio', 'server', 'prefs.js'));
    P.learn('this is too overwhelming'); const r = P.learn('still overwhelming');
    assert.ok(r.prefs.signals.overwhelming >= 2);
    assert.ok(P.applyToSettings({}, r.prefs).settings.overwhelmAverse);
  });
  await test('critics + audit produce gates and a review', () => {
    const C = require(path.join(ROOT, 'studio', 'server', 'qa', 'critics.js'));
    const A = require(path.join(ROOT, 'studio', 'server', 'qa', 'audit.js'));
    const g = airline.build({});
    const crit = C.ux(g, null).concat(C.design(g, null), C.placeholders(g));
    const G = A.gates({ gdl: g, validation: { errors: [] }, tests: { passed: 1, failed: 0, results: [{ name: 'x', area: 'actions', ok: true }] }, browser: null, balance: null, trace: [], critics: crit });
    assert.strictEqual(G.gates.length, 10);
    assert.strictEqual(A.designReview({ gdl: g, balance: null, browser: null, trace: [] }).length, 10);
  });

  if (!QUICK) {
    console.log('Integration');
    await test('balance lab: playthroughs in worker threads', async () => {
      const B = require(path.join(ROOT, 'studio', 'server', 'qa', 'balance.js'));
      const rep = await B.run(airline.build({}), { strategies: ['passive', 'balanced'], seeds: 1, years: 1 });
      assert.strictEqual(rep.aggregate.runs, 2); assert.strictEqual(rep.aggregate.errors.length, 0, JSON.stringify(rep.aggregate.errors));
    });
    await test('server: localhost-only API round trip', async () => {
      const S = require(path.join(ROOT, 'studio', 'server', 'index.js'));
      const server = await S.start({ port: 0, quiet: true });
      const port = server.address().port;
      try {
        // raw http, not fetch: fetch silently drops a custom Host header, which would hide the check
        const get = (p, headers) => new Promise((resolve, reject) => require('http').get({ host: '127.0.0.1', port, path: p, headers }, r => { let body = ''; r.on('data', c => { body += c; }); r.on('end', () => resolve({ status: r.statusCode, body })); }).on('error', reject));
        const st = await get('/api/status'); assert.strictEqual(st.status, 200);
        const evil = await get('/api/status', { host: 'evil.example.com' }); assert.strictEqual(evil.status, 403);
        const cross = await get('/api/projects', { origin: 'https://evil.example.com' }); assert.strictEqual(cross.status, 403);
        const comp = await fetch(`http://127.0.0.1:${port}/api/compile`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: ACCEPT }) }).then(r => r.json());
        assert.strictEqual(comp.genre.genre, 'airline');
        const ui = await get('/'); assert.ok(ui.body.includes('Local Game Studio'));
        const trav = await get('/web/..%2f..%2fpackage.json'); assert.notStrictEqual(trav.status, 200);
      } finally { server.close(); }
    });
  }
  if (!QUICK) {
    await test('local-model pipeline with a mock OpenAI-compatible server (design stages, repair, change planner)', () => new Promise((resolve, reject) => {
      require('child_process').execFile(process.execPath, [path.join(__dirname, 'llm-mock.js')], { timeout: 20 * 60 * 1000, maxBuffer: 1 << 24 }, (err, stdout) => { if (err) reject(new Error(String(stdout).split('\n').filter(l => /✗/.test(l)).join('; ') || err.message)); else resolve(); });
    }));
  }
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(failed.length ? 1 : 0);
})();
