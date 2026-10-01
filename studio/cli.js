#!/usr/bin/env node
/* Local Game Studio — command line. Same pipeline as the web UI, useful for scripting and tests.
   node studio/cli.js create "Build me a restaurant empire game…" [--review] [--no-llm]
   node studio/cli.js modify <project> "The late game is too easy"
   node studio/cli.js audit|balance|export <project>
   node studio/cli.js remaster path/to/game.html ["what to improve"]
   node studio/cli.js list | status | serve */
'use strict';
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--')));
const pos = args.filter(a => !a.startsWith('--'));
const cmd = pos[0];

function usage() {
  console.log(`Local Game Studio CLI
  create "<prompt>" [--no-llm]          build a new game
  remaster <file.html> ["<request>"]    import and remaster an HTML game
  modify <project> "<request>"          change an existing game (tedious / too easy / more visual / export …)
  audit <project>                       quality gates + design review, no changes
  balance <project>                     simulate → analyze → rebalance → simulate again
  export <project>                      standalone HTML release
  list                                  list projects
  status                                local model + hardware status
  serve                                 start the web studio`);
}
function follow(job) {
  return new Promise((resolve) => {
    job.on('event', (e) => {
      if (e.type === 'log') console.log(e.level === 'error' ? '\x1b[31m' + e.text + '\x1b[0m' : e.level === 'warn' ? '\x1b[33m' + e.text + '\x1b[0m' : e.text);
      if (e.type === 'status' && ['done', 'failed', 'cancelled'].includes(e.status)) resolve(job.snapshot());
    });
  });
}
(async () => {
  if (!cmd || cmd === 'help' || flags.has('--help')) return usage();
  if (cmd === 'serve') return require('./server/index.js').start({});
  const { Store } = require('./server/projects/store');
  const O = require('./server/pipeline/orchestrator');
  const opts = { useLLM: !flags.has('--no-llm'), review: false };
  if (cmd === 'list') { for (const p of Store.list()) console.log(`${p.id.padEnd(36)} ${String(p.status || '').padEnd(10)} ${p.gates ? `gates ${p.gates.passed}/${p.gates.total}` : ''}  ${p.title || ''}`); return; }
  if (cmd === 'status') { const llm = require('./server/llm').get(); console.log(JSON.stringify(await llm.status(), null, 2)); return; }
  let job, pr;
  if (cmd === 'create') {
    const prompt = pos.slice(1).join(' ') || (pos[1] && fs.existsSync(pos[1]) ? fs.readFileSync(pos[1], 'utf8') : '');
    if (!prompt) return usage();
    pr = Store.create({ prompt }); job = O.start('create', pr.id, {}, opts);
  } else if (cmd === 'remaster') {
    const file = pos[1]; if (!file || !fs.existsSync(file)) { console.error('File not found'); process.exit(1); }
    pr = Store.create({ prompt: pos.slice(2).join(' '), mode: 'remaster', attachments: [{ name: path.basename(file), content: fs.readFileSync(file, 'utf8') }] });
    job = O.start('remaster', pr.id, {}, opts);
  } else {
    pr = Store.get(pos[1]); if (!pr) { console.error('Project not found: ' + pos[1]); process.exit(1); }
    if (cmd === 'modify') { const request = pos.slice(2).join(' '); const cls = require('./server/pipeline/modify').classify(request); job = O.start(cls.intents.length === 1 && cls.intents[0] === 'export' ? 'export' : 'modify', pr.id, { request }, opts); }
    else if (['audit', 'balance', 'export'].includes(cmd)) job = O.start(cmd, pr.id, {}, opts);
    else return usage();
  }
  console.log(`Project ${pr.id} · job ${job.id}`);
  const snap = await follow(job);
  console.log(`\n${snap.status.toUpperCase()}${snap.error ? ': ' + snap.error : ''}`);
  if (snap.result && snap.result.release) console.log(`Release: ${path.join(Store.get(pr.id).p('releases'), snap.result.release)}`);
  if (snap.result && snap.result.scorecard) console.log(`Score ${snap.result.scorecard.score}/100 · gates ${snap.result.scorecard.gates} · review ${snap.result.scorecard.review}`);
  process.exit(snap.status === 'done' ? 0 : 1);
})().catch(e => { console.error(e.stack || e); process.exit(1); });
