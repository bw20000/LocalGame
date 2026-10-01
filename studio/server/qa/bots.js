/* Playtest bots. Each strategy plays a generated game through the same API the UI uses
   (actions, events, negotiations, policies, rescue), so findings reflect real play.
   Strategies: passive, conservative, balanced, smart, aggressive, expansion, highDebt, careless. */
'use strict';
const path = require('path');
const { loadEngine } = require('../../../engine/node.js');
const E = loadEngine();

const STRATEGIES = {
  passive: { label: 'Minimal intervention', act: 0, reserve: 1, borrow: false, events: 'default', describe: 'Never acts; only answers decisions with their defaults.' },
  conservative: { label: 'Conservative', act: 1, reserve: 0.45, minScore: 0.25, borrow: false, repay: true, events: 'cheapest' },
  balanced: { label: 'Balanced', act: 2, reserve: 0.25, minScore: 0, borrow: false, repay: true, events: 'best' },
  smart: { label: 'Skilled player', act: 3, reserve: 0.2, minScore: 0, borrow: 'opportunistic', repay: true, events: 'best', fixLosers: true },
  aggressive: { label: 'Aggressive', act: 4, reserve: 0.05, minScore: -0.1, borrow: 'often', events: 'first' },
  expansion: { label: 'Expansion at all costs', act: 4, reserve: 0.1, prefer: 'create', borrow: 'often', events: 'first' },
  highDebt: { label: 'High debt', act: 3, reserve: 0.1, borrow: 'max', events: 'first' },
  careless: { label: 'Intentionally poor', act: 2, reserve: 0, random: true, events: 'random' }
};

function createsOperatingUnit(gdl, a) {
  return (a.effects || []).some(op => op.op === 'create' && gdl.kinds[op.kind] && gdl.kinds[op.kind].operate);
}
function eventChoice(g, inst, mode, rng) {
  const ev = g.def.events[inst.id];
  const ok = inst.choices.filter(c => c.enabled);
  if (!ok.length) return inst.default != null ? inst.default : 0;
  if (mode === 'random') return rng.pick(ok).i;
  if (mode === 'first') return ok[0].i;
  if (mode === 'default') return inst.default != null ? inst.default : ok[0].i;
  const sc = g.eventScope(inst.bind);
  const cost = (c) => { const ch = ev.choices[c.i]; return ch.cost ? g.num(ch.cost, sc, 0) : 0; };
  if (mode === 'cheapest') return ok.slice().sort((a, b) => cost(a) - cost(b))[0].i;
  // 'best': prefer choices with stakeholder/reputation upside and affordable cost; mild randomness
  const P = g.playerOrg();
  const scored = ok.map(c => { const ch = ev.choices[c.i]; const txt = JSON.stringify(ch.effects || []); let s = 0; s += (txt.match(/"add":"\d/g) || []).length * 0.5; s -= (txt.match(/"add":"-/g) || []).length * 0.5; s -= cost(c) / Math.max(1, P.cash) * 3; s += rng.next() * 0.6; return [c.i, s]; });
  scored.sort((a, b) => b[1] - a[1]);
  return scored[0][0];
}
function playNegotiations(g, rng, strat) {
  for (const n of Object.values(g.state.negotiations)) {
    if (n.org !== g.state.player) continue;
    const nd = g.def.negotiations[n.def];
    // offer toward their reservation using the solver; accept counters when reasonable
    const target = g.solveCounter(n, n.terms) || n.terms;
    const r = g.offer(n.id, strat.random ? n.terms : target);
    if (r.status === 'countered') { if (!strat.random || rng.chance(0.5)) g.acceptCounter(n.id); else g.walkAway(n.id); }
    else if (g.state.negotiations[n.id]) g.walkAway(n.id);
    void nd;
  }
}
/* One player turn for a strategy. */
function turn(g, strat, rng, stats) {
  const P = g.playerOrg();
  // events, negotiations, rescue
  for (const inst of g.state.events.pending.slice()) { const ci = eventChoice(g, inst, strat.events, rng); const r = g.resolveEvent(inst.iid, ci); if (!r.ok) g.resolveEvent(inst.iid, ci, true); stats.decisions++; }
  playNegotiations(g, rng, strat);
  if (g.state.progression.rescueOpen && strat.act > 0) { const opts = g.rescueOptions().filter(o => o.enabled); if (opts.length) { g.chooseRescue(strat.random ? rng.pick(opts).i : opts[0].i); stats.rescues++; } }
  for (const [id, p] of Object.entries(g.state.projects)) if (p.owner === P.id && p.waiting) g.continueProject(id, 0);
  if (!strat.act) return;
  const reserveCash = Math.max(0, (P.m.costs || 0) * g.cal.perYear * 0.12 * strat.reserve);
  // finance
  if ((strat.borrow === 'often' && P.cash < reserveCash * 2) || (strat.borrow === 'max' && g.cal.isYearStart(g.state.tick)) || (strat.borrow === 'opportunistic' && P.cash < 0)) {
    const room = g.borrowRoom(P); if (room > 1) { g.takeLoan(P, strat.borrow === 'max' ? room * 0.8 : Math.min(room, Math.max(reserveCash, Math.abs(P.cash) * 1.5)), 5); stats.borrows++; }
  }
  if (strat.repay && P.debt > 0 && P.cash > reserveCash * 3 + P.debt * 0.2) g.repayDebt(P, Math.min(P.debt, P.cash - reserveCash * 3));
  // actions
  const actions = Object.values(g.def.actions).filter(a => !a.aiOnly && a.effects && !a.effects.some(op => op.op === 'negotiate'));
  for (let k = 0; k < strat.act; k++) {
    if (strat.random) {
      const pool = [];
      for (const a of actions) {
        if (a.scope === 'entity') { for (const e of g.owned(a.kind, P.id).slice(0, 6)) if (g.actionVisible(a, P, e)) pool.push([a, e]); }
        else if (g.actionVisible(a, P, null)) pool.push([a, null]);
      }
      if (!pool.length) break;
      const [a, self] = rng.pick(pool);
      const raw = g.defaultParams(a, P, self);
      const r = g.act(a.id, Object.fromEntries(Object.entries(raw).map(([x, v]) => [x, v && typeof v === 'object' ? v.id : v])), { self });
      if (r.ok) { stats.actions[a.id] = (stats.actions[a.id] || 0) + 1; stats.acted++; } else stats.blocked++;
      continue;
    }
    // AI-scored best action
    let best = null;
    for (const a of actions) {
      if (!a.ai) continue;
      if (strat.prefer === 'create' && !createsOperatingUnit(g.def.gdl, a) && rng.next() < 0.6) continue;
      const selves = a.scope === 'entity' ? g.owned(a.kind, P.id).slice(0, 12) : [null];
      for (const self of selves) {
        if (!g.actionVisible(a, P, self)) continue;
        for (const param of g.aiCandidateParams(a, P, self, 3)) {
          const chk = g.checkAction(a, P, self, param);
          if (!chk.ok) continue;
          const cost = chk.cost.cash || 0;
          if (cost > 0 && P.cash - cost < reserveCash && strat.borrow !== 'often' && strat.borrow !== 'max') continue;
          let s = g.num(a.ai.score != null ? a.ai.score : 1, chk.sc, 0);
          if (!(s > 0)) continue;
          const scale = Math.max(1, Math.abs(P.m.revenueYear || 1e6) / 52);
          const norm = s / scale;
          if (norm <= (strat.minScore || 0)) continue;
          if (!best || norm > best.norm) best = { a, self, param, norm };
        }
      }
    }
    if (!best) break;
    const r = g.act(best.a.id, best.param, { self: best.self });
    if (r.ok) { stats.actions[best.a.id] = (stats.actions[best.a.id] || 0) + 1; stats.acted++; } else stats.blocked++;
  }
  // skilled players also fix losing units by repricing / reducing capacity via entity actions with ai scores
  if (strat.fixLosers) {
    for (const k of g.def.kindOrder) {
      const kd = g.def.kinds[k]; if (!kd.operate) continue;
      for (const e of g.owned(k, P.id)) {
        if (!(e._profit < 0) || g.state.tick - (e.launched || e.opened || e.born || 0) < 12) continue;
        // try frequency / price actions (non-AI) using forecast previews to pick the best option
        for (const a of Object.values(g.def.actions).filter(x => x.kind === k && x.forecast && x.params && x.params.length === 1 && x.params[0].type === 'choice')) {
          const p0 = a.params[0];
          let bestOpt = null;
          for (const o of p0.options) { const pv = g.previewAction(a, P, e, { [p0.id]: o.value }); if (pv.ok && pv.fc && (!bestOpt || pv.fc.profit > bestOpt.profit)) bestOpt = { v: o.value, profit: pv.fc.profit }; }
          if (bestOpt && bestOpt.profit > e._profit + 1) { const r = g.act(a.id, { [p0.id]: bestOpt.v }, { self: e }); if (r.ok) stats.actions[a.id] = (stats.actions[a.id] || 0) + 1; }
        }
      }
    }
  }
}

/* Run one simulated playthrough. Returns a compact record for the Balance Lab. */
function playthrough(gdl, { strategy = 'balanced', seed = 1, years = 6, options = {} } = {}) {
  const strat = STRATEGIES[strategy] || STRATEGIES.balanced;
  const t0 = Date.now();
  const g = E.Game.create(gdl, { seed, headless: true, options });
  const rng = new E.RNG('bot|' + strategy + '|' + seed);
  const P = g.playerOrg();
  const stats = { actions: {}, acted: 0, blocked: 0, decisions: 0, rescues: 0, borrows: 0 };
  const years_ = [];
  const per = g.cal.perYear;
  let needsSum = 0, interrupts = 0, ticks = 0, crisisTicks = 0, minCash = P.cash, firstNegative = null, recovered = false;
  const startValue = P.m.value || 1;
  for (let t = 0; t < years * per; t++) {
    turn(g, strat, rng, stats);
    const r = g.tick();
    ticks++;
    interrupts += (r.interrupts || []).filter(x => x.kind === 'event' || x.kind === 'crisis').length;
    needsSum += g.needs().length;
    if (P.cash < minCash) minCash = P.cash;
    if (g.state.progression.distress > 0) { crisisTicks++; if (firstNegative == null) firstNegative = t; }
    else if (firstNegative != null && !recovered) recovered = true;
    if ((t + 1) % per === 0) {
      const live = g.liveOrgs().filter(o => o.level < 3).sort((a, b) => (b.m.value || 0) - (a.m.value || 0));
      years_.push({ year: (t + 1) / per, cash: Math.round(P.cash), revenue: Math.round(P.m.revenueYear || 0), profit: Math.round(P.m.profitYear || 0), value: Math.round(P.m.value || 0), debt: Math.round(P.debt || 0), tier: g.state.progression.tier, rank: live.indexOf(P) + 1, of: live.length, leaderValue: Math.round(live[0] ? live[0].m.value : 0), rivalsAlive: live.length - 1 });
    }
    if (g.state.progression.over) break;
  }
  const over = g.state.progression.over;
  const live = g.liveOrgs().filter(o => o.level < 3);
  return {
    strategy, seed, years: years_, ticks, ms: Date.now() - t0, msPerTick: (Date.now() - t0) / Math.max(1, ticks),
    outcome: over ? over.outcome : 'running', endedAtYear: over ? +(over.t / per).toFixed(2) : null,
    final: { cash: Math.round(P.cash), value: Math.round(P.m.value || 0), valueGrowth: (P.m.value || 0) / startValue, debt: Math.round(P.debt || 0), tier: g.state.progression.tier, tierIndex: g.tierIndex(g.state.progression.tier), margin: (P.m.revenueYear || 0) > Math.max(1, Math.abs(P.m.value || 0)) * 0.02 ? (P.m.profitYear || 0) / Math.max(1, P.m.revenueYear || 0) : null },
    stats, minCash: Math.round(minCash), crisisTicks, recovered,
    pacing: { avgNeeds: needsSum / Math.max(1, ticks), interruptsPerMonth: interrupts / Math.max(1, ticks / g.cal.ticksPerMonth), eventsByPriority: g.state.stats.events },
    world: { rivalsAlive: live.length - 1, rivalsFailed: Object.values(g.state.orgs).filter(o => !o.alive).length, entrants: Object.values(g.state.orgs).filter(o => o.founded > 0).length, phase: g.state.world.phase },
    errors: g.diag.errors.slice(0, 10)
  };
}
module.exports = { STRATEGIES, playthrough, turn };
