/* Local Game Studio engine — history & legacy: records, milestones, awards, timeline,
   transactions, annual reviews, anti-portfolio, hall of fame. The game remembers so the player
   can tell stories. */
(function (E) {
  'use strict';
  const U = E.util;
  E.extendGame({
    logTransaction(text, meta = {}) {
      if (this.state.warm) return;
      const H = this.state.history;
      H.transactions.unshift({ t: this.state.tick, text, amount: meta.amount != null ? meta.amount : null, org: meta.org || null });
      if (H.transactions.length > 500) H.transactions.length = 500;
    },
    timeline(text, tag = 'major') {
      const H = this.state.history;
      H.timeline.unshift({ t: this.state.tick, text, tag, pre: !!this.state.warm });
      if (H.timeline.length > 400) H.timeline.length = 400;
    },
    updateHistory() {
      const st = this.state, H = st.history, def = this.def.history;
      const yearEnd = this.cal.isYearEnd(st.tick);
      // records
      for (const r of def.records || []) {
        if (r.period === 'year' && !yearEnd) continue;
        const best = r.best === 'min' ? -1 : 1;
        let cand = [];
        if (!r.scope || r.scope === 'org') cand = this.liveOrgs().filter(o => o.level < 3).map(o => ({ v: this.num(r.expr, this.scope({ org: o }), NaN), who: o.name, isPlayer: o.isPlayer, ref: 'org:' + o.id }));
        else if (r.scope.startsWith('kind:')) { const k = r.scope.slice(5); cand = this.all(k).filter(e => e.owner != null).map(e => ({ v: this.num(r.expr, this.scope({ self: e, org: this.state.orgs[e.owner] }), NaN), who: `${e.name}${this.state.orgs[e.owner] ? ' (' + this.state.orgs[e.owner].name + ')' : ''}`, isPlayer: e.owner === st.player, ref: this.refOf(e) })); }
        for (const c of cand) {
          if (!Number.isFinite(c.v) || (r.min != null && c.v < r.min)) continue;
          const cur = H.records[r.id];
          if (!cur || c.v * best > cur.value * best) {
            const was = cur ? cur.who : null;
            H.records[r.id] = { value: c.v, who: c.who, isPlayer: c.isPlayer, ref: c.ref, t: st.tick, label: r.label, format: r.format };
            if (!st.warm && c.isPlayer && (!cur || !cur.isPlayer || st.tick - cur.t > this.cal.perYear / 4)) this.news(`Record: ${r.label} — ${U.format(c.v, r.format)} (${c.who})${was && was !== c.who ? `, breaking ${was}'s mark` : ''}`, 'routine', { tag: 'record' });
          }
        }
      }
      if (st.warm) return;
      // milestones (player)
      const sc = this.scope({ org: this.playerOrg() });
      for (const m of def.milestones || []) {
        if (H.milestones[m.id] != null) continue;
        if (!this.ev(m.when, sc)) continue;
        H.milestones[m.id] = st.tick;
        const text = this.tpl(m.text || m.label, sc);
        this.timeline(m.label + (m.text ? ' — ' + text : ''), 'milestone');
        if (m.moment !== false) this.moment(m.label, text, 'good', m.stat ? this.tpl(m.stat, sc) : null);
        else this.news(`Milestone: ${m.label}`, 'routine', { tag: 'milestone' });
        if (m.effects) this.runOps(m.effects, sc);
      }
      // anti-portfolio follow-up: what became of things you passed on
      for (const a of H.anti) {
        if (a.valueExpr && a.ref && !a.resolved && st.tick - a.t >= this.cal.perYear) {
          const e = this.deref(a.ref);
          if (e) { a.valueNow = this.num(a.valueExpr, this.scope({ self: e, org: this.state.orgs[e.owner] || this.playerOrg() }), 0); a.resolved = st.tick; }
        }
      }
      if (yearEnd) { this.runAwards(); this.annualReview(); }
    },
    runAwards() {
      const st = this.state, year = this.cal.yearOf(st.tick);
      for (const a of this.def.history.awards || []) {
        let cand;
        if (!a.among || a.among === 'orgs') cand = this.liveOrgs().filter(o => o.level < 3).map(o => ({ x: o, sc: this.scope({ org: o, self: o }) }));
        else cand = this.all(a.among).filter(e => e.owner != null).map(e => ({ x: e, sc: this.scope({ self: e, org: this.state.orgs[e.owner] }) }));
        if (a.filter) cand = cand.filter(c => this.ev(a.filter, c.sc));
        if (!cand.length) continue;
        for (const c of cand) c.s = this.num(a.score, c.sc, 0) + this.rng.normal(0, a.noise != null ? a.noise : 0);
        cand.sort((p, q) => q.s - p.s);
        const w = cand[0];
        const winOrg = w.x.__org ? w.x : this.state.orgs[w.x.owner];
        const isPlayer = !!(winOrg && winOrg.isPlayer);
        st.history.awards.unshift({ year, id: a.id, label: a.label, winner: w.x.name, org: winOrg ? winOrg.name : null, isPlayer, nominees: cand.slice(0, 4).map(c => c.x.name) });
        if (st.history.awards.length > 600) st.history.awards.length = 600;
        if (a.prize) this.runOps(a.prize, w.sc);
        if (isPlayer) this.moment(`${a.label}`, `${w.x.name} wins ${a.label} ${year}.`, 'good');
        else this.news(`${a.label} ${year}: ${w.x.name}${winOrg && !w.x.__org ? ' (' + winOrg.name + ')' : ''}`, 'routine', { tag: 'award' });
      }
    },
    annualReview() {
      const st = this.state, p = this.playerOrg();
      const year = this.cal.yearOf(st.tick);
      const ranks = this.liveOrgs().filter(o => o.level < 3).sort((a, b) => (b.m.value || 0) - (a.m.value || 0));
      const last = st.history.annual[0];
      const rev = { year, revenue: p.m.revenueYear, profit: p.m.profitYear, cash: p.cash, debt: p.debt, value: p.m.value, tier: st.progression.tier, rank: ranks.indexOf(p) + 1, of: ranks.length,
        objectives: (st.progression.objectives || []).map(o => ({ text: o.text, done: o.done, success: o.success })),
        highlights: st.news.filter(n => n.t > st.tick - this.cal.perYear && (n.pri === 'important') && (!n.org || n.org === st.player)).slice(0, 6).map(n => n.text),
        valueChange: last ? (p.m.value - last.value) / Math.max(1, Math.abs(last.value)) : null };
      for (const m of this.def.orgMetrics) rev[m.id] = p.m[m.id];
      st.history.annual.unshift(rev);
      if (st.history.annual.length > 100) st.history.annual.length = 100;
      this.emit('annual', rev);
      if (st.settings.autopause && st.settings.autopause.moments) this.interrupt('annual', { review: rev });
    }
  });
})(globalThis.LGE = globalThis.LGE || {});
