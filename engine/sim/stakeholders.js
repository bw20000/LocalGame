/* Local Game Studio engine — stakeholders (unions, boards, regulators, fans, critics) and org
   resources (reputation, brand…). Both move toward a target computed from named DRIVERS, so the
   UI can always answer "Why?" with a breakdown. Thresholds trigger events. */
(function (E) {
  'use strict';
  const U = E.util;
  E.extendGame({
    initStakeholders() {
      for (const s of Object.values(this.def.stakeholders)) if (!this.state.stakes[s.id]) this.state.stakes[s.id] = { value: this.num(s.start, this.scope(), 50), hist: [], crossed: {} };
    },
    addStake(id, delta, org) {
      if (org && !org.isPlayer) return;
      const s = this.state.stakes[id], d = this.def.stakeholders[id];
      if (!s || !d) return;
      s.value = U.clamp(s.value + delta, d.min != null ? d.min : 0, d.max != null ? d.max : 100);
      s.lastShock = (s.lastShock || 0) + delta;
    },
    drivers(list, sc) {
      return (list || []).map(dr => ({ label: dr.label, value: this.num(dr.expr, sc, 0), describe: dr.describe || '' }));
    },
    stakeTarget(d, sc) {
      const base = d.base != null ? this.num(d.base, sc, 50) : 50;
      const drv = this.drivers(d.drivers, sc);
      return { target: U.clamp(base + U.sum(drv, x => x.value), d.min != null ? d.min : 0, d.max != null ? d.max : 100), drivers: drv, base };
    },
    updateStakeholders() {
      if (this.state.warm) return;
      const sc = this.scope({ org: this.playerOrg() });
      for (const d of Object.values(this.def.stakeholders)) {
        const s = this.state.stakes[d.id];
        if (!s) continue;
        const { target } = this.stakeTarget(d, sc);
        const sp = d.speed != null ? d.speed : 0.15;
        const prev = s.value;
        s.value = U.clamp(s.value + sp * (target - s.value) + this.rng.normal(0, d.noise != null ? d.noise : 0.3), d.min != null ? d.min : 0, d.max != null ? d.max : 100);
        s.target = target;
        s.crossed = s.crossed || {};
        for (const th of (d.thresholds || [])) {
          const key = (th.below != null ? 'b' + th.below : 'a' + th.above) + (th.event || '');
          const inZone = th.below != null ? s.value < th.below : s.value > th.above;
          const wasIn = th.below != null ? prev < th.below : prev > th.above;
          if (inZone && (!wasIn || !s.crossed[key])) {
            const cdOk = !s.crossed[key] || this.state.tick - s.crossed[key] > (th.cooldown != null ? th.cooldown : this.cal.perYear / 2);
            if (cdOk) {
              s.crossed[key] = this.state.tick;
              if (th.event) this.scheduleEvent(th.event, 0, {}, this.playerOrg());
              if (th.news) this.news(this.tpl(th.news, sc), th.priority || 'important', { tag: 'stakeholder' });
              if (th.effects) this.runOps(th.effects, sc);
            }
          }
        }
      }
    },
    updateResources() {
      for (const r of Object.values(this.def.resources)) {
        if (!r.decay && !r.drivers && !r.formula) continue;
        for (const org of this.liveOrgs()) {
          if (org.level === 3) continue;
          const sc = this.scope({ org });
          let v = org.res[r.id] != null ? org.res[r.id] : r.start;
          if (r.formula) v = this.num(r.formula, sc, v);
          if (r.drivers) {
            const base = r.base != null ? this.num(r.base, sc, 50) : 50;
            const tgt = base + U.sum(this.drivers(r.drivers, sc), x => x.value);
            v += (r.speed != null ? r.speed : 0.1) * (tgt - v);
          }
          if (r.decay) { const tw = this.num(r.decay.toward != null ? r.decay.toward : 0, sc, 0); v += (tw - v) * (r.decay.rate != null ? r.decay.rate : 0.02); }
          if (r.min != null) v = Math.max(r.min, v);
          if (r.max != null) v = Math.min(r.max, v);
          org.res[r.id] = U.finite(v, r.start);
        }
      }
    },
    /* "Why?" explanation for any explainable quantity. */
    explain(kind, id) {
      const p = this.playerOrg();
      if (kind === 'stake') {
        const d = this.def.stakeholders[id]; if (!d) return null;
        const t = this.stakeTarget(d, this.scope({ org: p }));
        return { title: d.label, value: this.state.stakes[id].value, target: t.target, base: t.base, drivers: t.drivers, describe: d.describe || '' };
      }
      if (kind === 'resource') {
        const r = this.def.resources[id]; if (!r) return null;
        const sc = this.scope({ org: p });
        const drv = this.drivers(r.drivers, sc);
        return { title: r.label, value: p.res[id], target: r.drivers ? (r.base != null ? this.num(r.base, sc, 50) : 50) + U.sum(drv, x => x.value) : null, drivers: drv, describe: r.describe || '' };
      }
      if (kind === 'metric') {
        const items = [].concat(this.def.ui.home && this.def.ui.home.metrics || []).concat(this.def.orgMetrics);
        const m = items.find(x => x.id === id || x.label === id);
        if (!m || !m.drivers) return null;
        const sc = this.scope({ org: p });
        return { title: m.label, value: this.num(m.expr, sc, 0), drivers: this.drivers(m.drivers, sc), describe: m.describe || '', format: m.format };
      }
      if (kind === 'entity') {
        const e = this.deref(id); if (!e) return null;
        const kd = this.def.kinds[e.kind];
        const ex = kd.explain; if (!ex) return null;
        const sc = this.scope({ self: e, org: this.state.orgs[e.owner] || p });
        return { title: this.tpl(ex.title || e.name, sc), drivers: this.drivers(ex.drivers, sc), describe: ex.describe ? this.tpl(ex.describe, sc) : '' };
      }
      return null;
    }
  });
})(globalThis.LGE = globalThis.LGE || {});
