/* Balance Lab: many accelerated playthroughs (worker threads), aggregate statistics, failure-
   pattern detectors (dominant strategy, snowballing, death spiral, passive play, notification
   fatigue, static world), and an auto-tuner that nudges balance parameters toward targets.
   BUILD → SIMULATE → ANALYZE → REBALANCE → SIMULATE AGAIN. */
'use strict';
const path = require('path');
const os = require('os');
const { Worker } = require('worker_threads');

const WORKER = path.join(__dirname, 'balance-worker.js');

function runPool(gdl, jobs, { threads, onProgress } = {}) {
  threads = Math.max(1, Math.min(threads || Math.max(1, os.cpus().length - 1), jobs.length));
  return new Promise((resolve) => {
    const results = []; let next = 0, done = 0;
    const gdlStr = JSON.stringify(gdl);
    if (!jobs.length) { resolve(results); return; }
    const spawn = () => {
      if (next >= jobs.length) return;
      const job = jobs[next++];
      const w = new Worker(WORKER, { workerData: { gdl: gdlStr, job } });
      w.on('message', (r) => { results.push(r); });
      w.on('error', (e) => { results.push({ strategy: job.strategy, seed: job.seed, error: String(e && e.message || e) }); });
      w.on('exit', () => { done++; onProgress && onProgress(done, jobs.length); if (done === jobs.length) resolve(results); else spawn(); });
    };
    for (let i = 0; i < threads; i++) spawn();
  });
}
const median = (a) => { const s = a.filter(Number.isFinite).slice().sort((x, y) => x - y); if (!s.length) return null; const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = (a) => { const s = a.filter(Number.isFinite); return s.length ? s.reduce((x, y) => x + y, 0) / s.length : null; };

function aggregate(results, years) {
  const ok = results.filter(r => !r.error);
  const byStrat = {};
  for (const r of ok) (byStrat[r.strategy] = byStrat[r.strategy] || []).push(r);
  const strategies = {};
  for (const [s, rs] of Object.entries(byStrat)) {
    strategies[s] = {
      runs: rs.length,
      survival: rs.filter(r => r.outcome !== 'failed').length / rs.length,
      bankruptcyYear: median(rs.filter(r => r.outcome === 'failed').map(r => r.endedAtYear)),
      medianValueGrowth: median(rs.map(r => r.final.valueGrowth)),
      medianFinalValue: median(rs.map(r => r.final.value)),
      medianMargin: median(rs.map(r => r.final.margin)),
      medianTier: median(rs.map(r => r.final.tierIndex)),
      crisisRate: rs.filter(r => r.crisisTicks > 0).length / rs.length,
      recoveryRate: rs.filter(r => r.crisisTicks > 0).length ? rs.filter(r => r.crisisTicks > 0 && r.recovered && r.outcome !== 'failed').length / rs.filter(r => r.crisisTicks > 0).length : null,
      actionsPerYear: mean(rs.map(r => r.stats.acted / Math.max(1, r.years.length || 1))),
      topActions: Object.entries(rs.reduce((acc, r) => { for (const [k, v] of Object.entries(r.stats.actions || {})) acc[k] = (acc[k] || 0) + v; return acc; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6),
      valueByYear: Array.from({ length: years }, (_, i) => median(rs.map(r => r.years[i] ? r.years[i].value : null))),
      profitByYear: Array.from({ length: years }, (_, i) => median(rs.map(r => r.years[i] ? r.years[i].profit : null))),
      rankByYear: Array.from({ length: years }, (_, i) => median(rs.map(r => r.years[i] ? r.years[i].rank : null))),
      interruptsPerMonth: mean(rs.map(r => r.pacing.interruptsPerMonth)), avgNeeds: mean(rs.map(r => r.pacing.avgNeeds)),
      msPerTick: mean(rs.map(r => r.msPerTick))
    };
  }
  // per seed winner
  const seeds = [...new Set(ok.map(r => r.seed))];
  const wins = {};
  for (const sd of seeds) { const rs = ok.filter(r => r.seed === sd && r.strategy !== 'passive' && r.strategy !== 'careless'); if (!rs.length) continue; rs.sort((a, b) => b.final.value - a.final.value); wins[rs[0].strategy] = (wins[rs[0].strategy] || 0) + 1; }
  const world = { rivalsFailedMedian: median(ok.map(r => r.world.rivalsFailed)), entrantsMedian: median(ok.map(r => r.world.entrants)) };
  const errors = [].concat(...ok.map(r => r.errors || [])).slice(0, 20).concat(results.filter(r => r.error).map(r => ({ where: 'worker', msg: r.error })));
  return { strategies, wins, seeds: seeds.length, world, errors, runs: ok.length };
}

/* Detectors (library/failure-taxonomy.json) computed from playtest data. */
function detect(agg) {
  const F = [];
  const S = agg.strategies;
  const add = (id, severity, text, evidence) => F.push({ id, severity, text, evidence });
  const active = ['balanced', 'smart', 'aggressive', 'expansion', 'conservative', 'highDebt'].filter(s => S[s]);
  // dominant strategy
  const totalWins = Object.values(agg.wins).reduce((a, b) => a + b, 0);
  for (const [s, w] of Object.entries(agg.wins)) if (totalWins >= 3 && w / totalWins > 0.7 && active.length > 2) add('dominant-strategy', 'major', `"${s}" wins ${Math.round(w / totalWins * 100)}% of seeds.`, agg.wins);
  // passive simulation
  if (S.passive && S.balanced && S.passive.medianFinalValue >= 0.85 * S.balanced.medianFinalValue) add('passive-simulation', 'major', 'Doing nothing performs about as well as playing.', { passive: S.passive.medianFinalValue, balanced: S.balanced.medianFinalValue });
  // too easy / too hard
  if (S.smart && S.smart.medianMargin > 0.22) add('too-easy', 'major', `Skilled play reaches a ${Math.round(S.smart.medianMargin * 100)}% operating margin — very generous.`, S.smart);
  if (S.smart && S.smart.survival < 0.7) add('too-hard', 'major', `Even skilled play goes bankrupt in ${Math.round((1 - S.smart.survival) * 100)}% of runs.`, S.smart);
  if (S.careless && S.careless.survival > 0.9) add('no-failure', 'minor', 'Careless play almost never fails — mistakes may not matter enough.', S.careless);
  // snowballing: value growth accelerating late
  for (const s of ['smart', 'aggressive', 'expansion']) {
    const v = S[s] && S[s].valueByYear; if (!v || v.length < 4 || !v[0]) continue;
    const early = v[1] / Math.max(1, v[0]), late = v[v.length - 1] / Math.max(1, v[v.length - 2]);
    if (late > 1.5 && late > early) add('snowballing', 'major', `${s}: growth accelerates late (×${late.toFixed(2)} in the last year vs ×${early.toFixed(2)} early) — success may stop being challenging.`, v);
  }
  // death spiral
  for (const [s, st] of Object.entries(S)) if (st.crisisRate > 0.3 && st.recoveryRate != null && st.recoveryRate < 0.1 && s !== 'passive' && s !== 'careless') add('death-spiral', 'major', `${s}: once in crisis, almost nobody recovers.`, st);
  // notification fatigue
  for (const [s, st] of Object.entries(S)) if (st.interruptsPerMonth > 3) add('notification-fatigue', 'minor', `${s}: ${st.interruptsPerMonth.toFixed(1)} interrupting decisions per month.`, st);
  // click burden
  if (S.smart && S.smart.actionsPerYear > 300) add('click-burden', 'minor', `Skilled play needs ~${Math.round(S.smart.actionsPerYear)} actions a year — consider more delegation.`, S.smart.topActions);
  // static world
  if (agg.world.rivalsFailedMedian === 0 && agg.world.entrantsMedian === 0) add('static-world', 'minor', 'No rival failed or entered in any run.', agg.world);
  if (agg.errors.length) add('runtime-errors', 'critical', `${agg.errors.length} runtime errors during playtests.`, agg.errors.slice(0, 5));
  return F;
}

async function run(gdl, { strategies = ['passive', 'careless', 'conservative', 'balanced', 'smart', 'aggressive'], seeds = 3, years = 5, threads, onProgress } = {}) {
  const jobs = [];
  for (let sd = 1; sd <= seeds; sd++) for (const s of strategies) jobs.push({ strategy: s, seed: 1000 + sd, years });
  const t0 = Date.now();
  const results = await runPool(gdl, jobs, { threads, onProgress });
  const agg = aggregate(results, years);
  return { at: new Date().toISOString(), ms: Date.now() - t0, years, seeds, aggregate: agg, findings: detect(agg), raw: results.map(r => ({ strategy: r.strategy, seed: r.seed, outcome: r.outcome, final: r.final, years: r.years, error: r.error })) };
}

/* Auto-tuner: adjusts a balance parameter (or a value-scaling knob) toward target bands.
   Knobs come from gdl.balance.knobs: [{path:'params.demandK', min, max, effect:'easier'|'harder'}]. */
function suggestTuning(gdl, report) {
  const knobs = (gdl.balance && gdl.balance.knobs) || [];
  const S = report.aggregate.strategies;
  const out = [];
  const tooEasy = report.findings.some(f => f.id === 'too-easy' || f.id === 'snowballing' || f.id === 'passive-simulation');
  const tooHard = report.findings.some(f => f.id === 'too-hard' || f.id === 'death-spiral');
  if (!tooEasy && !tooHard) return out;
  const factor = tooEasy ? (S.smart && S.smart.medianMargin > 0.3 ? 0.88 : 0.93) : 1.07;
  for (const k of knobs) {
    const cur = k.path.split('.').reduce((o, x) => (o ? o[x] : undefined), gdl);
    if (typeof cur !== 'number') continue;
    const dir = k.effect === 'easier' ? factor : 1 / factor; // knob that makes the game easier when increased
    let nv = cur * dir;
    if (k.min != null) nv = Math.max(k.min, nv); if (k.max != null) nv = Math.min(k.max, nv);
    if (Math.abs(nv - cur) / Math.max(1e-9, Math.abs(cur)) > 0.005) out.push({ op: 'set', path: k.path, value: +nv.toPrecision(4), why: `${tooEasy ? 'Too easy' : 'Too hard'}: ${k.label || k.path} ${cur} → ${+nv.toPrecision(4)}` });
  }
  return out;
}
module.exports = { run, aggregate, detect, suggestTuning, runPool };
