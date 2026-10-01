/* Local Game Studio engine — world simulation: economic cycle (Markov phases), world variables
   (constant / random walk / mean-reverting / phase-driven), shocks with durations, seasonality. */
(function (E) {
  'use strict';
  const U = E.util;
  E.extendGame({
    phaseDef(id) { const c = this.def.world.cycle; return c && c.phases ? c.phases.find(p => p.id === (id || this.state.world.phase)) : null; },
    applyPhaseVars() {
      const w = this.state.world, ph = this.phaseDef();
      w.phaseLabel = ph ? (ph.label || ph.id) : null;
      if (w.demand == null) w.demand = ph && ph.demand != null ? ph.demand : 1;
      if (w.credit == null) w.credit = ph && ph.credit != null ? ph.credit : 0;
    },
    updateWorld() {
      const w = this.state.world, rng = this.rng, cyc = this.def.world.cycle;
      // 1. economic cycle
      if (cyc && cyc.phases && cyc.phases.length) {
        w.phaseTicks++;
        const ph = this.phaseDef();
        const minT = this.num(ph.minTicks != null ? ph.minTicks : this.cal.perYear / 2, this.scope());
        const maxT = this.num(ph.maxTicks != null ? ph.maxTicks : this.cal.perYear * 4, this.scope());
        let switchNow = w.phaseTicks >= maxT;
        if (!switchNow && w.phaseTicks >= minT) switchNow = rng.next() < 1 / Math.max(1, (maxT - minT) / 2);
        if (w.forcedPhase) { switchNow = true; }
        if (switchNow) {
          const nextIds = w.forcedPhase ? [w.forcedPhase] : Object.keys(ph.next || {});
          const nxt = w.forcedPhase || (nextIds.length ? rng.weighted(nextIds, nextIds.map(k => ph.next[k])) : cyc.phases[(cyc.phases.indexOf(ph) + 1) % cyc.phases.length].id);
          w.forcedPhase = null;
          if (nxt && nxt !== w.phase) {
            w.phase = nxt; w.phaseTicks = 0;
            const np = this.phaseDef();
            w.phaseLabel = np.label || np.id;
            if (!this.state.warm) {
              this.news(np.news || `Economy enters ${w.phaseLabel.toLowerCase()}`, np.severity === 'bad' ? 'important' : 'routine', { tag: 'economy' });
              if (np.event) this.scheduleEvent(np.event, 0, {}, this.playerOrg());
              this.timeline(`Economy: ${w.phaseLabel}`, 'world');
            }
          }
        }
        const target = this.phaseDef();
        const tgtDemand = target && target.demand != null ? target.demand : 1;
        const tgtCredit = target && target.credit != null ? target.credit : 0;
        w.demand = (w.demand != null ? w.demand : 1) + (tgtDemand - (w.demand != null ? w.demand : 1)) * 0.15;
        w.credit = (w.credit != null ? w.credit : 0) + (tgtCredit - (w.credit != null ? w.credit : 0)) * 0.2;
      } else { w.demand = 1; w.credit = 0; }
      // 2. seasonality factor (by month), optional
      const seas = this.def.world.seasonality;
      w.season = Array.isArray(seas) && seas.length === 12 ? seas[this.cal.monthOf(this.state.tick) - 1] : 1;
      // 3. shocks: start new
      for (const v of this.def.world.vars) {
        for (const sh of (v.shocks || [])) {
          if (w.shocks.some(s => s.var === v.id && s.id === sh.id)) continue;
          const p = this.num(sh.chance != null ? sh.chance : 0, this.scope());
          if (p > 0 && rng.next() < p) {
            const dur = Math.max(1, Math.round(this.num(sh.duration != null ? sh.duration : this.cal.perYear / 4, this.scope())));
            w.shocks.push({ id: sh.id, var: v.id, mult: this.num(sh.size != null ? sh.size : 1.4, this.scope()), left: dur, total: dur, label: sh.label || sh.id });
            if (!this.state.warm) {
              this.news(this.tpl(sh.news || `${sh.label || 'Shock'}: ${v.label || v.id} jumps`, this.scope()), sh.priority || 'important', { tag: 'world' });
              if (sh.event) this.scheduleEvent(sh.event, 0, {}, this.playerOrg());
              this.timeline(sh.label || sh.id, 'world');
            }
          }
        }
      }
      // 4. variable processes
      for (const v of this.def.world.vars) {
        const pr = v.process || { type: 'constant' };
        let x = w.vars[v.id];
        if (x == null) x = v.start != null ? v.start : 1;
        let shockMult = 1;
        for (const s of w.shocks) if (s.var === v.id) shockMult *= 1 + (s.mult - 1) * Math.min(1, s.left / Math.max(1, s.total * 0.5));
        const phaseMult = pr.phase && pr.phase[w.phase] != null ? pr.phase[w.phase] : 1;
        const mean = (pr.mean != null ? this.num(pr.mean, this.scope()) : (v.start != null ? v.start : x)) * phaseMult;
        const vol = pr.vol != null ? pr.vol : 0.02;
        switch (pr.type) {
          case 'walk': x = x * Math.exp(rng.normal(pr.drift || 0, vol)); break;
          case 'meanRevert': { const sp = pr.speed != null ? pr.speed : 0.08; const tgt = mean * shockMult; x = x + sp * (tgt - x) + vol * Math.abs(tgt) * rng.normal(); break; }
          case 'phase': x = x + 0.2 * (mean - x); break;
          case 'trend': x = x * Math.exp((pr.drift || 0) + rng.normal(0, vol)); break;
          case 'formula': x = this.num(pr.expr, this.scope(), x); break;
          default: break;
        }
        if (pr.min != null) x = Math.max(pr.min, x);
        if (pr.max != null) x = Math.min(pr.max, x);
        w.vars[v.id] = U.finite(x, v.start || 1);
        const h = w.hist[v.id] = w.hist[v.id] || [];
        h.push(+w.vars[v.id].toFixed(4)); if (h.length > 260) h.shift();
      }
      for (const s of w.shocks) s.left--;
      w.shocks = w.shocks.filter(s => s.left > 0);
      const dh = w.hist.__demand = w.hist.__demand || []; dh.push(+(w.demand || 1).toFixed(4)); if (dh.length > 260) dh.shift();
    },
    forcePhase(id) { this.state.world.forcedPhase = id; },
    triggerShock(varId, shockId) {
      const v = this.def.world.vars.find(x => x.id === varId); if (!v) return false;
      const sh = (v.shocks || []).find(s => s.id === shockId) || { id: 'manual', label: 'Commissioner shock', size: 1.5 };
      const dur = Math.max(1, Math.round(this.num(sh.duration != null ? sh.duration : this.cal.perYear / 4, this.scope())));
      this.state.world.shocks.push({ id: sh.id, var: v.id, mult: this.num(sh.size != null ? sh.size : 1.4, this.scope()), left: dur, total: dur, label: sh.label || sh.id });
      this.news(this.tpl(sh.news || `${sh.label}: ${v.label || v.id} jumps`, this.scope()), 'important', { tag: 'world' });
      return true;
    }
  });
})(globalThis.LGE = globalThis.LGE || {});
