/* Local Game Studio engine — rival AI and organizational lifecycle.
   Rivals use the SAME action set as the player. Each archetype weights actions differently and
   has a risk appetite; candidates are scored by the action's ai.score formula (often driven by a
   forecast), so rivals make sensible but imperfect decisions. Rivals remember the player,
   enter, grow, decline, change leadership, merge and fail. */
(function (E) {
  'use strict';
  const U = E.util;

  E.extendGame({
    archetypeOf(org) {
      const R = this.def.orgs.rivals;
      return R && R.archetypes ? R.archetypes.find(a => a.id === org.archetype) : null;
    },
    aiCandidateParams(a, org, self, k) {
      const sets = [];
      const P = a.params || [];
      for (let n = 0; n < k; n++) {
        const param = {};
        let fail = false;
        for (const p of P) {
          const sc = this.scope({ org, self, param });
          if (p.type === 'entity' || p.type === 'org') {
            const cands = this.paramCandidates(a, p, org, param, self, 60);
            if (!cands.length) { if (!p.optional) fail = true; param[p.id] = null; continue; }
            // bias toward the top of the sorted list but keep exploration
            const idx = Math.min(cands.length - 1, Math.floor(Math.pow(this.rng.next(), 2.2) * cands.length));
            param[p.id] = cands[idx];
          } else if (p.type === 'choice') {
            param[p.id] = p.aiValue ? this.ev(p.aiValue, sc) : (p.options && p.options.length ? this.rng.pick(p.options).value : null);
          } else if (p.type === 'bool') param[p.id] = p.aiValue ? !!this.ev(p.aiValue, sc) : this.rng.chance(0.5);
          else if (p.type === 'text') param[p.id] = '';
          else {
            if (p.aiValue) param[p.id] = this.num(p.aiValue, sc, 0);
            else { const lo = this.num(p.min != null ? p.min : 0, sc), hi = this.num(p.max != null ? p.max : lo, sc); param[p.id] = p.default != null ? this.num(p.default, sc, lo) : lo + (hi - lo) * this.rng.next(); }
          }
        }
        if (!fail) sets.push(param);
      }
      return sets;
    },
    runAI() {
      const t = this.state.tick;
      const R = this.def.orgs.rivals || {};
      const every = R.aiEvery || Math.max(1, Math.round(this.cal.perYear / 13));
      const aiActions = Object.values(this.def.actions).filter(a => a.ai && !a.playerOnly);
      if (!aiActions.length) return;
      for (const org of this.liveOrgs()) {
        if (org.isPlayer || org.level === 3) continue;
        // stagger orgs so they do not all act on the same tick
        const phase = (parseInt(String(org.id).replace(/\D/g, ''), 10) || 0) % every;
        if ((t + phase) % every !== 0 && !this.state.warm) continue;
        if (this.state.warm && t % Math.max(1, Math.floor(every / 2)) !== 0) continue;
        const ar = this.archetypeOf(org) || {};
        const risk = ar.risk != null ? ar.risk : 0.5;
        const tempo = ar.tempo != null ? ar.tempo : (org.level === 1 ? 2 : 1);
        const reserve = (org.m.costs || 0) * this.cal.perYear * (0.08 + (1 - risk) * 0.12) * (this.state.warm ? 0.3 : 1);
        for (let step = 0; step < tempo; step++) {
          let best = null;
          for (const a of aiActions) {
            const w = (ar.weights && ar.weights[a.id] != null ? ar.weights[a.id] : 1) * (a.ai.weight != null ? a.ai.weight : 1);
            if (w <= 0) continue;
            if (a.ai.every && (t % a.ai.every) !== 0) continue;
            if (a.ai.when && !this.ev(a.ai.when, this.scope({ org }))) continue;
            const selves = a.scope === 'entity' ? this.rng.sample(this.owned(a.kind, org.id), a.ai.selfSample || 4) : [null];
            for (const self of selves) {
              if (!this.actionVisible(a, org, self)) continue;
              const cands = this.aiCandidateParams(a, org, self, a.ai.candidates || 3);
              for (const param of cands) {
                const chk = this.checkAction(a, org, self, param);
                if (!chk.ok) continue;
                const cost = chk.cost.cash || 0;
                if (cost > 0 && org.cash - cost < reserve && !a.ai.ignoreReserve) continue;
                const raw = this.num(a.ai.score != null ? a.ai.score : 1, chk.sc, 0);
                if (!(raw > 0)) continue;
                const score = raw * w * (1 + this.rng.normal(0, 0.15 + risk * 0.1));
                if (!best || score > best.score) best = { a, self, param, score };
              }
            }
          }
          if (!best) break;
          const res = this.act(best.a.id, best.param, { org, self: best.self });
          if (res.ok) this.noteRivalry(org, best.param, best.self);
        }
      }
    },
    noteRivalry(org, param, self) {
      const pid = this.state.player;
      const touches = (x) => x && typeof x === 'object' && (x.owner === pid || x.id === pid);
      let hit = touches(self);
      for (const v of Object.values(param || {})) if (touches(v)) hit = true;
      if (hit) { this.remember(org, pid, 'rivalry', 2); this.remember(pid, org, 'rivalry', 2); }
    },
    mergeOrgs(to, target, sc) {
      if (!to || !target || to === target) return false;
      to = to.__org ? to : this.state.orgs[to];
      target = target.__org ? target : this.state.orgs[target];
      if (!to || !target || !target.alive) return false;
      for (const k of this.def.kindOrder) for (const e of this.owned(k, target.id).slice()) e.owner = to.id;
      to.cash += target.cash; target.cash = 0;
      to.loans = to.loans.concat(target.loans); target.loans = [];
      to.debt = U.sum(to.loans, l => l.balance);
      target.alive = false; target.endedAt = this.state.tick; target.endReason = `merged into ${to.name}`;
      this.dirty();
      const mergeOps = this.def.orgs.onMerge;
      if (mergeOps) this.runOps(mergeOps, this.scope({ org: to, target }));
      if (!this.state.warm) {
        this.news(`${to.name} completes acquisition of ${target.name}`, to.isPlayer || target.isPlayer ? 'important' : 'routine', { tag: 'deal', refs: ['org:' + to.id] });
        this.timeline(`${to.name} acquires ${target.name}`, 'deal');
      }
      return true;
    },
    failOrg(org, reason) {
      org.alive = false; org.endedAt = this.state.tick; org.endReason = reason || 'bankrupt';
      const R = this.def.orgs.rivals || {};
      const buyers = this.liveOrgs().filter(o => o.level < 3 && !o.isPlayer && o.cash > 0).sort((a, b) => b.cash - a.cash);
      const acquirer = R.acquireOnFail !== false && buyers.length && this.rng.chance(0.35) ? buyers[0] : null;
      if (acquirer) { org.alive = true; this.mergeOrgs(acquirer, org); return; }
      const onFail = this.def.orgs.onFail;
      if (onFail) this.runOps(onFail, this.scope({ org, failed: org }));
      for (const k of this.def.kindOrder) for (const e of this.owned(k, org.id).slice()) {
        const kd = this.def.kinds[k];
        if (kd.onOwnerFail === 'release') e.owner = null; else this.removeEntity(e);
      }
      this.dirty();
      if (!this.state.warm) {
        this.news(`${org.name} collapses${reason ? ' — ' + reason : ''}`, 'important', { tag: 'rival' });
        this.timeline(`${org.name} fails`, 'world');
      }
    },
    orgLifecycle() {
      const R = this.def.orgs.rivals;
      if (!R) return;
      const per = this.cal.perYear, t = this.state.tick;
      for (const org of this.liveOrgs()) {
        if (org.isPlayer || org.level === 3) continue;
        // distress → failure
        const limit = this.creditLimit(org);
        if (org.cash < -limit) org.distress = (org.distress || 0) + 1; else org.distress = Math.max(0, (org.distress || 0) - 1);
        if (org.distress > (R.failGrace || Math.round(per / 4))) { this.failOrg(org, 'insolvent'); continue; }
        // AI emergency: borrow if possible
        if (org.cash < 0 && this.borrowRoom(org) > -org.cash) this.takeLoan(org, -org.cash * 1.3 + (org.m.costs || 0) * 4, 5);
        // leadership change after a bad year
        if (this.cal.isYearEnd(t) && (org.m.profitYear || 0) < 0 && R.archetypes && R.archetypes.length > 1 && this.rng.chance(R.leadershipChange != null ? R.leadershipChange : 0.25)) {
          const others = R.archetypes.filter(a => a.id !== org.archetype);
          const na = this.rng.weighted(others, others.map(a => a.share || 1));
          const old = this.archetypeOf(org);
          org.archetype = na.id;
          if (!this.state.warm) this.news(`${org.name} replaces its chief executive; new strategy: ${na.label || na.id}${old ? ` (was ${old.label || old.id})` : ''}`, 'routine', { tag: 'rival', refs: ['org:' + org.id] });
        }
      }
      // entrants (keeps the world from going static)
      if (this.cal.isYearStart(t) && t > 0 && R.entryChance && this.rng.chance(this.num(R.entryChance, this.scope()))) {
        const live = this.liveOrgs().filter(o => !o.isPlayer && o.level < 3).length;
        if (live < (R.maxActive || 12)) {
          const arch = R.archetypes || [{ id: 'standard' }];
          const a = this.rng.weighted(arch, arch.map(x => x.share || 1));
          const o = this.createOrg({ name: U.companyName(this.rng, R.suffixes || a.suffixes), archetype: a.id, level: 2, color: a.color || null });
          const sc = this.scope({ org: o });
          o.cash = this.num(a.entrantCash != null ? a.entrantCash : (a.cash != null ? a.cash : 1e6), sc) * 0.6;
          if (a.set) for (const [f, x] of Object.entries(a.set)) o[f] = this.ev(x, sc);
          if (a.start) this.runOps(a.start, sc);
          if (R.start) this.runOps(R.start, sc);
          this.dirty();
          if (!this.state.warm) { this.news(`New competitor: ${o.name} (${a.label || a.id}) enters the market`, 'routine', { tag: 'rival', refs: ['org:' + o.id] }); this.timeline(`${o.name} founded`, 'world'); }
        }
      }
    }
  });
})(globalThis.LGE = globalThis.LGE || {});
