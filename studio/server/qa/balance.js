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

/* Detectors (library/failure-taxonomy.json) computed from playtest data. Bands come from
   gdl.balance.targets when the design declares them. */
function detect(agg, targets = {}) {
  const F = [];
  const S = agg.strategies;
  const add = (id, severity, text, evidence, phase) => F.push({ id, severity, text, evidence, phase: phase || 'all' });
  const active = ['balanced', 'smart', 'aggressive', 'expansion', 'conservative', 'highDebt'].filter(s => S[s]);
  const marginBand = targets.smartMargin || [0.03, 0.22];
  const maxGrowth = targets.maxGrowth || 10;
  // dominant strategy
  const totalWins = Object.values(agg.wins).reduce((a, b) => a + b, 0);
  for (const [s, w] of Object.entries(agg.wins)) if (totalWins >= 3 && w / totalWins > 0.7 && active.length > 2) add('dominant-strategy', 'major', `"${s}" wins ${Math.round(w / totalWins * 100)}% of seeds.`, agg.wins);
  // passive simulation
  if (S.passive && S.balanced && S.passive.medianFinalValue >= 0.85 * S.balanced.medianFinalValue) add('passive-simulation', 'major', 'Doing nothing performs about as well as playing.', { passive: S.passive.medianFinalValue, balanced: S.balanced.medianFinalValue });
  // too easy / too hard — judged on the best-performing competent strategy
  const best = active.map(s => [s, S[s]]).filter(([, st]) => st.survival > 0.5).sort((a, b) => (b[1].medianMargin || 0) - (a[1].medianMargin || 0))[0];
  if (best && best[1].medianMargin > marginBand[1]) add('too-easy', 'major', `${best[0]} play reaches a ${Math.round(best[1].medianMargin * 100)}% operating margin (target ≤ ${Math.round(marginBand[1] * 100)}%).`, { strategy: best[0], margin: best[1].medianMargin });
  // targets.maxGrowth is "over six years"; scale it to the simulated horizon
  const horizon = Math.max(1, ...Object.values(S).map(st => (st.valueByYear || []).length));
  const allowed = Math.pow(maxGrowth, horizon / 6);
  const growthers = active.filter(s => S[s].medianValueGrowth > allowed);
  if (growthers.length) add('runaway-growth', 'major', `Company value grows ×${Math.max(...growthers.map(s => S[s].medianValueGrowth)).toFixed(1)} in ${horizon} years (target ≤ ×${allowed.toFixed(1)}) — success stops being challenging.`, Object.fromEntries(growthers.map(s => [s, S[s].medianValueGrowth])), 'late');
  if (S.smart && S.smart.survival < 0.7) add('too-hard', 'major', `Even skilled play goes bankrupt in ${Math.round((1 - S.smart.survival) * 100)}% of runs.`, S.smart);
  if (best && best[1].medianMargin < marginBand[0]) add('too-hard', 'major', `The best strategy only reaches a ${Math.round(best[1].medianMargin * 100)}% margin.`, best[1]);
  if (S.careless && S.careless.survival > 0.9) add('no-failure', 'minor', 'Careless play almost never fails — mistakes may not matter enough.', S.careless);
  // snowballing: value growth accelerating late, or the player lapping the field
  for (const s of ['smart', 'aggressive', 'expansion', 'balanced']) {
    const v = S[s] && S[s].valueByYear; if (!v || v.length < 3 || !v[0]) continue;
    const early = v[1] / Math.max(1, v[0]), late = v[v.length - 1] / Math.max(1, v[v.length - 2]);
    if (late > 1.5 && late >= early * 0.95) add('snowballing', 'major', `${s}: growth keeps accelerating late (×${late.toFixed(2)} in the last year vs ×${early.toFixed(2)} early).`, v, 'late');
  }
  // death spiral
  for (const [s, st] of Object.entries(S)) if (st.crisisRate > 0.3 && st.recoveryRate != null && st.recoveryRate < 0.1 && s !== 'passive' && s !== 'careless') add('death-spiral', 'major', `${s}: once in crisis, almost nobody recovers.`, st);
  for (const [s, st] of Object.entries(S)) if (st.interruptsPerMonth > 3) add('notification-fatigue', 'minor', `${s}: ${st.interruptsPerMonth.toFixed(1)} interrupting decisions per month.`, st);
  if (S.smart && S.smart.actionsPerYear > 300) add('click-burden', 'minor', `Skilled play needs ~${Math.round(S.smart.actionsPerYear)} actions a year — consider more delegation.`, S.smart.topActions);
  if (agg.world.rivalsFailedMedian === 0 && agg.world.entrantsMedian === 0) add('static-world', 'minor', 'No rival failed or entered in any run.', agg.world);
  if (agg.errors.length) add('runtime-errors', 'critical', `${agg.errors.length} runtime errors during playtests.`, agg.errors.slice(0, 5));
  return F;
}

async function run(gdl, { strategies = ['passive', 'careless', 'conservative', 'balanced', 'smart', 'aggressive'], seeds = 3, years = 5, threads, onProgress, targets } = {}) {
  targets = targets || (gdl.balance && gdl.balance.targets) || {};
  const jobs = [];
  for (let sd = 1; sd <= seeds; sd++) for (const s of strategies) jobs.push({ strategy: s, seed: 1000 + sd, years });
  const t0 = Date.now();
  const results = await runPool(gdl, jobs, { threads, onProgress });
  const agg = aggregate(results, years);
  return { at: new Date().toISOString(), ms: Date.now() - t0, years, seeds, aggregate: agg, findings: detect(agg, targets), raw: results.map(r => ({ strategy: r.strategy, seed: r.seed, outcome: r.outcome, final: r.final, years: r.years, error: r.error })) };
}

/* Auto-tuner: adjusts balance knobs toward target bands.
   Knobs come from gdl.balance.knobs: [{path, min, max, effect:'easier'|'harder', phase?:'late', step?}].
   focus 'late' prefers knobs that bite as the company grows (complexity costs) so the early game
   keeps its feel while the late game gets harder. */
function suggestTuning(gdl, report, { focus, direction } = {}) {
  const knobs = (gdl.balance && gdl.balance.knobs) || [];
  const S = report.aggregate.strategies;
  const ids = new Set(report.findings.map(f => f.id));
  // a player's report ("late game too easy") counts as a finding even when the bots disagree
  if (direction === 'harder') ids.add(focus === 'late' ? 'snowballing' : 'too-easy');
  if (direction === 'easier') ids.add('too-hard');
  const tooEasy = ids.has('too-easy') || ids.has('snowballing') || ids.has('passive-simulation') || ids.has('runaway-growth');
  const tooHard = !tooEasy && (ids.has('too-hard') || ids.has('death-spiral'));
  if (!tooEasy && !tooHard) return [];
  const lateIssue = ids.has('snowballing') || ids.has('runaway-growth');
  const best = Object.values(S).reduce((m, st) => Math.max(m, st.medianMargin || 0), 0);
  const strength = direction ? 0.22 : tooEasy ? (best > 0.3 ? 0.12 : 0.07) : 0.07;
  let use = knobs;
  if (focus === 'late' || (lateIssue && !ids.has('too-easy'))) { const late = knobs.filter(k => k.phase === 'late'); if (late.length) use = late; }
  const out = [];
  for (const k of use) {
    const cur = k.path.split('.').reduce((o, x) => (o ? o[x] : undefined), gdl);
    if (typeof cur !== 'number') continue;
    const harder = tooEasy;
    const up = (k.effect === 'harder') === harder; // increase this knob?
    let nv = k.step ? cur + (up ? 1 : -1) * k.step * (strength / 0.07) : cur * (up ? 1 + strength : 1 / (1 + strength));
    if (k.min != null) nv = Math.max(k.min, nv); if (k.max != null) nv = Math.min(k.max, nv);
    nv = +nv.toPrecision(4);
    if (Math.abs(nv - cur) / Math.max(1e-9, Math.abs(cur)) > 0.004) out.push({ op: 'set', path: k.path, value: nv, from: cur, why: `${harder ? 'Too easy' : 'Too hard'}: ${k.label || k.path} ${cur} → ${nv}` });
  }
  return out;
}

/* SIMULATE → ANALYZE → REBALANCE → SIMULATE AGAIN, until clean or out of iterations.
   Returns the tuned GDL and the per-iteration history (before/after evidence). */
async function autoBalance(gdl, { iterations = 3, seeds = 2, years = 4, strategies, focus, direction, threads, onProgress } = {}) {
  const setPath = (o, p, v) => { const ks = p.split('.'); let c = o; for (const k of ks.slice(0, -1)) c = c[k]; c[ks[ks.length - 1]] = v; };
  let cur = JSON.parse(JSON.stringify(gdl));
  const history = []; let lastReport = null; const reports = [];
  const targets = (cur.balance && cur.balance.targets) || {};
  for (let i = 0; i <= iterations; i++) {
    const rep = await run(cur, { seeds, years, strategies, threads, targets, onProgress: onProgress && ((d, n) => onProgress({ iteration: i, done: d, total: n })) });
    lastReport = rep; reports.push({ rep, params: JSON.parse(JSON.stringify(cur.params || {})) });
    // the reported direction drives the first adjustment; later iterations follow the measurements
    const tuning = i < iterations ? suggestTuning(cur, rep, { focus, direction: i === 0 ? direction : undefined }) : [];
    history.push({ iteration: i, summary: summarize(rep), findings: rep.findings, tuning });
    if (!tuning.length) break;
    for (const t of tuning) setPath(cur, t.path, t.value);
  }
  return { gdl: cur, history, final: history[history.length - 1], lastReport, reports };
}
function summarize(rep) {
  const out = {};
  for (const [s, st] of Object.entries(rep.aggregate.strategies)) {
    const p = st.profitByYear.filter(Number.isFinite), v = st.valueByYear.filter(Number.isFinite);
    out[s] = { survival: st.survival, margin: st.medianMargin == null ? null : +st.medianMargin.toFixed(3), growth: st.medianValueGrowth == null ? null : +st.medianValueGrowth.toFixed(2), bankruptcyYear: st.bankruptcyYear, rankEnd: st.rankByYear[st.rankByYear.length - 1],
      lateGrowth: v.length >= 2 && v[v.length - 2] > 0 ? +(v[v.length - 1] / v[v.length - 2]).toFixed(2) : null, lateProfit: p.length ? p[p.length - 1] : null };
  }
  return out;
}
/* Explain WHY the game plays the way it does, from the raw playthroughs (not just thresholds):
   early vs late margins and growth, who ends up on top, whether cash piles up with nothing to spend
   it on, and whether the world pushes back. Used for "the late game is too easy — analyze why". */
function diagnose(rep, { phase = 'all' } = {}) {
  const raw = (rep.raw || []).filter(r => !r.error && r.years && r.years.length);
  // "Too easy" is a claim about skilled play: judge on the better half of competent runs
  const comp0 = raw.filter(r => !/passive|careless/.test(r.strategy));
  const byFinal = comp0.slice().sort((a, b) => (b.final.value || 0) - (a.final.value || 0));
  const comp = byFinal.slice(0, Math.max(1, Math.ceil(byFinal.length / 2)));
  const yrs = Math.max(0, ...comp.map(r => r.years.length));
  const med = (a) => median(a);
  const span = Math.max(1, Math.min(3, Math.floor(yrs / 3)));
  const marginOf = (y) => (y.revenue ? y.profit / Math.max(1, Math.abs(y.revenue)) : null);
  const early = comp.map(r => r.years.slice(0, span)).filter(a => a.length);
  const late = comp.map(r => r.years.slice(-span)).filter(a => a.length);
  const m = {
    years: yrs,
    earlyMargin: med([].concat(...early.map(a => a.map(marginOf)))),
    lateMargin: med([].concat(...late.map(a => a.map(marginOf)))),
    earlyGrowth: med(comp.map(r => r.years.length > span && r.years[0].value > 0 ? Math.pow(Math.max(1e-9, r.years[span].value / r.years[0].value), 1 / span) : null)),
    lateGrowth: med(comp.map(r => r.years.length > span + 1 && r.years[r.years.length - 1 - span].value > 0 ? Math.pow(Math.max(1e-9, r.years[r.years.length - 1].value / r.years[r.years.length - 1 - span].value), 1 / span) : null)),
    finalRank: med(comp.map(r => r.years[r.years.length - 1].rank)),
    topShare: comp.length ? comp.filter(r => r.years[r.years.length - 1].rank === 1).length / comp.length : 0,
    cashShare: med(comp.map(r => { const y = r.years[r.years.length - 1]; return y.value > 0 ? y.cash / y.value : null; })),
    survival: comp0.length ? comp0.filter(r => r.outcome !== 'failed').length / comp0.length : null,
    rivalsFailed: rep.aggregate.world.rivalsFailedMedian, entrants: rep.aggregate.world.entrantsMedian
  };
  const why = [];
  const pc = (x) => x == null ? '—' : Math.round(x * 100) + '%';
  if (m.lateMargin != null && m.earlyMargin != null && m.lateMargin > m.earlyMargin + 0.03) why.push(`Margins rise with size: ${pc(m.earlyMargin)} in the first ${span} years → ${pc(m.lateMargin)} in the last ${span}. Scale makes the business easier instead of harder.`);
  if (m.lateGrowth != null && m.earlyGrowth != null && m.lateGrowth >= m.earlyGrowth * 0.9 && m.lateGrowth > 1.15) why.push(`Growth does not slow down: ×${m.lateGrowth.toFixed(2)} a year late vs ×${m.earlyGrowth.toFixed(2)} early. Nothing caps a successful company.`);
  if (m.topShare >= 0.4) why.push(`Competent play finishes #1 in ${pc(m.topShare)} of runs — rivals stop being a threat.`);
  if (m.cashShare != null && m.cashShare > 0.35) why.push(`Cash piles up (${pc(m.cashShare)} of company value at the end) — there is little worth spending it on late.`);
  if (m.rivalsFailed != null && m.entrants != null && m.rivalsFailed > m.entrants + 1) why.push('More rivals die than enter: the field thins out as you grow.');
  const noEffect = !why.length;
  if (comp.length < comp0.length) why.push(`(Measured on the stronger half of ${comp0.length} competent playthroughs — the late game is about skilled play.)`);
  if (noEffect) why.unshift(phase === 'late' ? `The measurements show no strong late-game effect (late margin ${pc(m.lateMargin)}, late growth ×${m.lateGrowth ? m.lateGrowth.toFixed(2) : '—'}/yr); your report is treated as the signal.` : 'No strong balance problem in the measurements.');
  return { metrics: m, why };
}
module.exports = { run, aggregate, detect, suggestTuning, autoBalance, summarize, runPool, diagnose };
