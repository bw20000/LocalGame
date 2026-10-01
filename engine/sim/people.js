/* Local Game Studio engine — people careers (aging, development toward hidden potential,
   retirement, career logs, hall of fame) and imperfect information (hidden true values shown
   as estimates whose uncertainty shrinks when you scout / do diligence). */
(function (E) {
  'use strict';
  const U = E.util;
  E.extendGame({
    updatePeople() {
      const cfgs = this.def.people ? (Array.isArray(this.def.people) ? this.def.people : [this.def.people]) : [];
      if (!cfgs.length || !this.cal.isYearEnd(this.state.tick)) return;
      for (const c of cfgs) {
        const ageF = c.age || 'age';
        for (const e of this.all(c.kind).slice()) {
          e[ageF] = (+e[ageF] || 0) + 1;
          const age = e[ageF];
          const peak = c.peak || 28;
          for (const sk of (c.skills || [])) {
            const pot = c.potential ? (+e[c.potential] || 0) : 100;
            const cur = +e[sk] || 0;
            let d;
            if (age < peak) d = (pot - cur) * (c.growth != null ? c.growth : 0.25) + this.rng.normal(0, 2);
            else if (age < peak + (c.plateau || 4)) d = this.rng.normal(0, 1.5);
            else d = -(c.decline != null ? c.decline : 2.5) * (1 + (age - peak - (c.plateau || 4)) * 0.15) + this.rng.normal(0, 1.5);
            e[sk] = U.clamp(cur + d, 0, c.max || 100);
          }
          const ra = c.retireAge || [60, 70];
          const pRet = age < ra[0] ? 0 : (age >= ra[1] ? 1 : (age - ra[0]) / Math.max(1, ra[1] - ra[0]));
          if (this.rng.next() < pRet) this.retirePerson(e, c);
        }
        // replenish the pool (newcomers keep the world alive)
        if (c.replenish) {
          const n = Math.round(this.num(c.replenish, this.scope(), 0));
          const gen = this.def.kinds[c.kind].generate || {};
          for (let i = 0; i < n; i++) {
            const e = this.createEntity(c.kind, {}, null);
            const sc = this.scope({ self: e, i, newcomer: true });
            for (const [f, x] of Object.entries(c.newcomer || gen.set || {})) e[f] = this.ev(x, sc);
          }
        }
      }
    },
    retirePerson(e, c) {
      const sc = this.scope({ self: e, org: this.state.orgs[e.owner] || this.playerOrg() });
      if (c.hallOfFame && this.ev(c.hallOfFame, sc)) {
        this.state.history.hof.unshift({ t: this.state.tick, name: e.name, kind: e.kind, summary: c.hofText ? this.tpl(c.hofText, sc) : '' });
        this.news(`${e.name} retires and enters the Hall of Fame`, 'routine', { tag: 'legacy' });
      } else if (e.owner === this.state.player) this.news(`${e.name} retires`, 'routine', { tag: 'people' });
      if (c.onRetire) this.runOps(c.onRetire, sc);
      this.removeEntity(e);
    },
    /* imperfect information */
    estimate(e, field) {
      if (!e || !e.__ent) return null;
      const fd = this.def.kinds[e.kind] && this.def.kinds[e.kind].fields[field];
      const v = +e[field] || 0;
      if (!fd || !fd.hidden) return { value: v, lo: v, hi: v, sd: 0 };
      if (e.owner === this.state.player && fd.revealWhenOwned !== false) return { value: v, lo: v, hi: v, sd: 0 };
      e._obs = e._obs || {};
      let o = e._obs[field];
      if (!o) { const r = new E.RNG(e.id + '|' + field + '|' + this.state.seed); o = e._obs[field] = { sd: fd.noise != null ? fd.noise : 12, bias: r.normal() }; }
      const shown = v + o.bias * o.sd;
      return { value: shown, lo: shown - o.sd * 1.2, hi: shown + o.sd * 1.2, sd: o.sd };
    },
    observe(e, field, quality) {
      const fields = field ? [field] : Object.entries(this.def.kinds[e.kind].fields).filter(([, fd]) => fd.hidden).map(([f]) => f);
      for (const f of fields) { this.estimate(e, f); const o = e._obs && e._obs[f]; if (o) o.sd = Math.max(0, o.sd * (1 - U.clamp(quality, 0, 1))); }
    }
  });

  /* Custom code hooks: game-specific modules register handlers (tick, start, remove, or named). */
  const registry = {};
  E.hooks = {
    register(name, fn) { (registry[name] = registry[name] || []).push(fn); },
    clear() { for (const k of Object.keys(registry)) delete registry[k]; },
    forGame(game) {
      return { run(name, ...args) { for (const fn of (registry[name] || [])) { try { fn(game, ...args); } catch (e) { game.report('hook ' + name, e); } } } };
    }
  };
})(globalThis.LGE = globalThis.LGE || {});
