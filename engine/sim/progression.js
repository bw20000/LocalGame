/* Local Game Studio engine — progression: tiers with unlocks, yearly board objectives with
   rewards/penalties, failure with rescue options (no instant game over → no death spiral),
   victory milestones (open-ended play continues). */
(function (E) {
  'use strict';
  const U = E.util;
  E.extendGame({
    initObjectives() { if (!this.state.progression.objectives.length) this.rollObjectives(); },
    rollObjectives() {
      const cfg = this.def.progression.objectives;
      if (!cfg || !cfg.templates || !cfg.templates.length) return;
      const st = this.state, p = this.playerOrg();
      const sc = this.scope({ org: p });
      const pool = cfg.templates.filter(t => !t.when || this.ev(t.when, sc));
      const n = Math.min(cfg.count || 3, pool.length);
      const chosen = [];
      const avail = pool.slice();
      for (let i = 0; i < n; i++) { const t = this.rng.weighted(avail, avail.map(x => x.weight || 1)); chosen.push(t); avail.splice(avail.indexOf(t), 1); }
      const deadline = st.tick + (this.cal.perYear - 1 - this.cal.tickOfYear(st.tick));
      st.progression.objectives = chosen.map(t => {
        const base = this.num(t.metric, sc, 0);
        const s2 = Object.assign({}, sc, { base });
        const target = this.num(t.target, s2, base);
        return { id: t.id, text: this.tpl(t.text, Object.assign(s2, { target })), metric: t.metric, target, base, check: t.check || '>=', deadline, done: false, success: null, format: t.format };
      });
    },
    objectiveProgress(o) {
      const v = this.num(o.metric, this.scope({ org: this.playerOrg() }), 0);
      const denom = o.target - o.base;
      const pr = o.check === '<=' ? (v <= o.target ? 1 : U.clamp((o.base - v) / Math.max(1e-9, o.base - o.target), 0, 1)) : (Math.abs(denom) < 1e-9 ? (v >= o.target ? 1 : 0) : U.clamp((v - o.base) / denom, 0, 1));
      return { value: v, progress: pr };
    },
    checkProgression() {
      const st = this.state, def = this.def.progression, p = this.playerOrg();
      const sc = this.scope({ org: p });
      // tiers (upward only)
      const ti = this.tierIndex(st.progression.tier);
      const next = def.tiers[ti + 1];
      if (next && next.when && this.ev(next.when, sc)) {
        st.progression.tier = next.id;
        this.moment(next.label || next.id, this.tpl(next.text || next.describe || 'Your organization has grown into a new league.', sc), 'good');
        this.timeline(`Became ${next.label || next.id}`, 'tier');
        if (next.effects) this.runOps(next.effects, sc);
        const unlocked = Object.values(this.def.actions).filter(a => a.tier === next.id).map(a => a.label);
        if (unlocked.length) this.news(`New options unlocked: ${unlocked.join(', ')}`, 'important', { tag: 'tier' });
      }
      // objectives at deadline
      const cfg = def.objectives;
      if (cfg && cfg.templates) {
        for (const o of st.progression.objectives) {
          if (o.done || st.tick < o.deadline) continue;
          const { value } = this.objectiveProgress(o);
          o.done = true; o.success = o.check === '<=' ? value <= o.target : value >= o.target; o.final = value;
          const t = cfg.templates.find(x => x.id === o.id) || {};
          this.runOps(o.success ? (t.reward || cfg.reward) : (t.penalty || cfg.penalty), Object.assign({}, sc, { objective: o }));
          this.news(`${o.success ? 'Objective met' : 'Objective missed'}: ${o.text}`, 'important', { tag: 'objective' });
        }
        if (this.cal.isYearStart(st.tick + 1) && st.progression.objectives.every(o => o.done)) {
          // roll next year's objectives on the first tick of the new year (handled below)
        }
        if (this.cal.isYearStart(st.tick) && st.tick > 0 && st.progression.objectives.every(o => o.done || o.deadline < st.tick)) this.rollObjectives();
      }
      // failure & rescue
      const f = def.failure;
      if (f && f.when) {
        if (this.ev(f.when, sc)) {
          st.progression.distress++;
          if (st.progression.distress === 1) {
            st.progression.rescueOpen = true;
            this.news(this.tpl(f.warning || 'Cash crisis: lenders and the board are alarmed.', sc), 'critical', { tag: 'crisis' });
            this.moment(f.warningTitle || 'Cash crisis', this.tpl(f.warning || 'You are out of cash. Choose a rescue plan before the board acts.', sc), 'bad');
            this.interrupt('crisis', {});
          }
          if (st.progression.distress >= (f.grace || 8)) {
            if (this.state.options.noBankruptcy) { st.progression.distress = 0; return; }
            this.endGame('failed', this.tpl(f.gameOver || 'The board has removed you. Your tenure is over.', sc));
          }
        } else if (st.progression.distress > 0) { st.progression.distress = 0; st.progression.rescueOpen = false; this.news('Crisis averted: the business is solvent again.', 'important', { tag: 'crisis' }); }
      }
      // victory conditions (celebrate once, continue playing)
      for (const v of def.victory || []) {
        st.progression.victories = st.progression.victories || {};
        if (st.progression.victories[v.id]) continue;
        if (this.ev(v.when, sc)) { st.progression.victories[v.id] = st.tick; this.moment(v.label, this.tpl(v.text || '', sc), 'good'); this.timeline(v.label, 'victory'); }
      }
    },
    rescueOptions() {
      const f = this.def.progression.failure; if (!f) return [];
      const sc = this.scope({ org: this.playerOrg() });
      return (f.rescue || []).map((r, i) => ({ i, id: r.id, label: this.tpl(r.label, sc), describe: this.tpl(r.describe || '', sc), enabled: (!r.once || !this.state.progression.rescuesUsed[r.id]) && (!r.requires || !!this.ev(r.requires, sc)) }));
    },
    chooseRescue(i) {
      const f = this.def.progression.failure; if (!f) return { ok: false };
      const r = (f.rescue || [])[i]; if (!r) return { ok: false };
      const sc = this.scope({ org: this.playerOrg() });
      if (r.requires && !this.ev(r.requires, sc)) return { ok: false };
      if (r.once && this.state.progression.rescuesUsed[r.id]) return { ok: false };
      this.state.progression.rescuesUsed[r.id] = this.state.tick;
      this.runOps(r.effects, sc);
      this.timeline(`Rescue: ${this.tpl(r.label, sc)}`, 'crisis');
      this.news(`Rescue plan: ${this.tpl(r.label, sc)}`, 'important', { tag: 'crisis' });
      this.updateOrgMetrics();
      if (!this.ev(f.when, sc)) { this.state.progression.distress = 0; this.state.progression.rescueOpen = false; }
      return { ok: true };
    },
    endGame(outcome, text) {
      const st = this.state;
      if (st.progression.over) return;
      st.progression.over = { outcome, text, t: st.tick };
      this.timeline(text || 'The end', 'end');
      this.moment(outcome === 'failed' ? 'Game over' : 'The end', text || '', outcome === 'failed' ? 'bad' : 'good');
      this.interrupt('gameover', { outcome });
      this.emit('gameover', st.progression.over);
    },
    continueAfterEnd() { this.state.progression.continueAfterEnd = true; this.state.progression.distress = 0; }
  });
})(globalThis.LGE = globalThis.LGE || {});
