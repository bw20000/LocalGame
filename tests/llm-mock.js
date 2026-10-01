/* Integration test for the local-model code paths without a real model: a mock OpenAI-compatible
   server (like LM Studio / mlx_lm.server / llama.cpp) answers each design stage with plausible JSON
   — including one deliberately invalid answer to exercise the repair loop — and the real pipeline
   builds and modifies a game with it. Proves: provider wiring, schema validation + repair, guarded
   patches (valid model output is applied, the game still validates), and the change planner. */
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lgs-llm-'));
process.env.LGS_DATA = path.join(TMP, 'data');
process.env.LGS_PROJECTS = path.join(TMP, 'projects');

const calls = [];
let creativeCalls = 0;
function answer(system, user) {
  if (/extract requirements/i.test(system)) return { requirements: [{ text: 'Start as a small regional airline', kind: 'must', area: 'simulation' }, { text: 'Grow into a global carrier', kind: 'must', area: 'simulation' }, { text: 'Alliances', kind: 'must', area: 'simulation' }, { text: 'Not overwhelming', kind: 'must', area: 'ui' }], conflicts: [] };
  if (/Executive Producer/.test(system)) return { title: 'Skyward', tagline: 'From turboprops to the world.', role: 'Founder & CEO', pitch: 'Build an airline. Beat the giants.', fantasy: ['Open a bold new route and watch it fill', 'Win a slot battle at a congested hub', 'Ride out a fuel spike with smart hedging', 'Sign an alliance that changes your network', 'Buy a struggling rival', 'Become a global carrier'], tensions: ['Growth vs. cash', 'Fares vs. load factor', 'Unions vs. margins'], tone: 'Confident, precise', notToSimulate: ['Individual flight crews'] };
  if (/Lead Game Designer/.test(system)) return { verdicts: [], missing: [], coreLoop: 'Open routes, fill seats, grow the fleet, outlast rivals.', pillars: ['Network strategy over chores', 'Every aircraft is a bet', 'The world fights back'] };
  if (/Content Designer/.test(system)) return { events: [{ id: 'mockStorm', title: 'Storms ground {r.name}', text: 'A week of storms hits {r.name}. Passengers are stranded.', priority: 'important', chance: '0.02', cooldown: 30, bind: { r: { kind: 'route', owner: 'player' } },
    choices: [{ label: 'Rebook everyone for free', describe: 'Costly, but customers remember.', cost: '200000', effects: [{ op: 'resource', id: 'brand', add: '2' }], result: 'Passengers rebooked' }, { label: 'Follow the rules, nothing more', effects: [{ op: 'resource', id: 'brand', add: '-2' }], result: 'Complaints pile up' }] }] };
  if (/Creative Director/.test(system)) { creativeCalls++; return creativeCalls === 1 ? { motif: 'neon-disco', mode: 'dark', palette: { accent: '#ff6600' }, voice: 'Crisp.' } : { motif: 'departure-board', mode: 'dark', palette: { accent: '#ff6600', accent2: '#00aaff' }, fonts: { display: 'condensed', body: 'sans' }, voice: 'Crisp, confident, a little playful.', logoText: 'SK' }; }
  if (/Game Design Critic/.test(system)) return { summary: 'No change needed', ops: [] };
  if (/change request on an EXISTING game/.test(system)) return { kind: 'add-feature', summary: 'Frequent-flyer program as a policy', risks: ['Costs a little revenue'], ops: [
    { op: 'append', path: 'policies', value: { id: 'loyalty', label: 'Frequent-flyer program', scope: 'org', default: 'off', aiDefault: 'off', describe: 'Reward repeat travelers. Lifts your brand slowly; costs a share of revenue.', options: [{ value: 'off', label: 'None' }, { value: 'basic', label: 'Basic', effects: [{ op: 'resource', id: 'brand', add: '0.03' }] }, { value: 'premium', label: 'Premium tiers', effects: [{ op: 'resource', id: 'brand', add: '0.06' }] }] } },
    { op: 'append', path: 'ui.screens.commercial.sections', value: { type: 'policies', width: 'half', ids: ['loyalty'], title: 'Loyalty' } }] };
  if (/Systems Designer/.test(system)) return { summary: 'nothing', ops: [] };
  return { ok: true };
}
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    if (req.url.endsWith('/models')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ data: [{ id: 'mock-model' }] })); return; }
    const b = JSON.parse(body || '{}');
    const system = (b.messages || []).find(m => m.role === 'system');
    const user = (b.messages || []).filter(m => m.role === 'user').slice(-1)[0];
    const out = answer(system ? system.content : '', user ? user.content : '');
    calls.push(system ? system.content.slice(0, 60) : '?');
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Here you go:\n```json\n' + JSON.stringify(out) + '\n```' } }], usage: { prompt_tokens: 100, completion_tokens: 50 } }));
  });
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  fs.mkdirSync(process.env.LGS_DATA, { recursive: true });
  fs.writeFileSync(path.join(process.env.LGS_DATA, 'settings.json'), JSON.stringify({ providers: { ollama: { enabled: false }, openaiCompatible: { enabled: true, baseUrl: `http://127.0.0.1:${port}/v1` } }, roles: { fast: 'mock-model', main: 'mock-model', critic: 'mock-model' }, generation: { balanceRuns: 6, balanceYears: 3, browserTests: false, maxRepairs: 2 } }));
  const O = require('../studio/server/pipeline/orchestrator.js');
  const { Store } = require('../studio/server/projects/store.js');
  const wait = (job) => new Promise(res => job.on('event', e => { if (e.type === 'status' && ['done', 'failed', 'cancelled'].includes(e.status)) res(job.snapshot()); }));
  const prompt = 'Build me a deep airline management game where I start with a small regional airline and can eventually build a global carrier. I want realistic aircraft economics, routes, hubs, labor, airport negotiations, customer segmentation, alliances, acquisitions, recessions, fuel prices, regulators, competitors, history, commissioner mode, and a very polished visual interface. Make it deep but not overwhelming.';
  const results = [];
  const check = (name, fn) => { try { fn(); results.push([name, true]); console.log('  ✓ ' + name); } catch (e) { results.push([name, false]); console.log('  ✗ ' + name + ': ' + e.message); } };
  const pr = Store.create({ prompt });
  const snap = await wait(O.start('create', pr.id, {}));
  const log = snap.log.map(l => l.text).join('\n');
  check('build finished', () => assert.strictEqual(snap.status, 'done', snap.error));
  check('local model detected and used', () => assert.ok(/Local model ready: mock-model/.test(log), 'model not used'));
  const gdl = Store.get(pr.id).gdl;
  check('producer named the game', () => assert.ok(/Skyward/.test(gdl.meta.title), gdl.meta.title));
  check('content designer event validated and added', () => assert.ok(gdl.events.some(e => e.id === 'mockStorm')));
  check('invalid creative direction repaired, then applied', () => { assert.ok(/repair/.test(log)); assert.strictEqual(gdl.theme.motif, 'departure-board'); assert.strictEqual(gdl.theme.palette.accent, '#ff6600'); });
  check('model calls were logged locally', () => assert.ok(fs.existsSync(path.join(process.env.LGS_DATA, 'logs', 'llm-calls.jsonl'))));
  const m = await wait(O.start('modify', pr.id, { request: 'Add a frequent flyer loyalty program.' }));
  const g2 = Store.get(pr.id).gdl;
  check('change planner added a validated feature', () => { assert.strictEqual(m.status, 'done', m.error); assert.ok(g2.policies.some(p => p.id === 'loyalty')); });
  check('feature recorded as a replayable patch', () => assert.ok((Store.get(pr.id).artifact('patches') || []).some(p => /loyalty/i.test(p.request))));
  console.log(`\n${results.filter(r => r[1]).length}/${results.length} passed · ${calls.length} model calls`);
  server.close(); fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(results.every(r => r[1]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
