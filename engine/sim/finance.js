/* Local Game Studio engine — finance: ledger by category, loans with amortization, interest
   linked to the credit cycle, credit limits, per-entity upkeep, org-level overhead, valuation,
   metrics and history series. */
(function (E) {
  'use strict';
  const U = E.util;
  E.extendGame({
    addCash(org, amount, category = 'Other', note = null, capex = false) {
      if (!org || !Number.isFinite(amount) || amount === 0) return;
      org.cash += amount;
      const c = org.ledger.cur;
      c[category] = (c[category] || 0) + amount;
      if (capex) org.ledger.capex = (org.ledger.capex || 0) + amount;
      if (note && org.isPlayer && Math.abs(amount) > 0) this.logTransaction(note, { org: org.id, amount });
    },
    baseRate() {
      const fin = this.def.gdl.finance || {};
      const w = this.state.world;
      const base = fin.baseRate != null ? this.num(fin.baseRate, this.scope()) : 0.05;
      return Math.max(0.005, base + (w.credit || 0));
    },
    creditLimit(org) {
      const fin = this.def.gdl.finance || {};
      if (fin.creditLimit) return Math.max(0, this.num(fin.creditLimit, this.scope({ org })));
      const v = org.m.value || 0;
      return Math.max(0, v * 0.25 + (org.m.revenueYear || 0) * 0.1);
    },
    borrowRoom(org) {
      const fin = this.def.gdl.finance || {};
      const cap = fin.maxDebt ? this.num(fin.maxDebt, this.scope({ org })) : Math.max(0, (org.m.assets || 0) * 0.6 + Math.max(0, org.m.ebitdaYear || 0) * 3);
      return Math.max(0, cap - (org.debt || 0));
    },
    rateFor(org) {
      const fin = this.def.gdl.finance || {};
      const lev = (org.debt || 0) / Math.max(1, (org.m.assets || 0) + Math.max(0, org.cash));
      const spread = fin.spread != null ? this.num(fin.spread, this.scope({ org })) : 0.02 + Math.max(0, lev - 0.3) * 0.12;
      return this.baseRate() + spread;
    },
    takeLoan(org, amount, years = 5, rate = null) {
      if (!org || !(amount > 0)) return null;
      const r = rate != null ? rate : this.rateFor(org);
      const n = Math.max(1, Math.round(years * this.cal.perYear));
      const loan = { id: this.newId('loan_'), principal: amount, balance: amount, rate: r, ticks: n, left: n, start: this.state.tick };
      org.loans.push(loan);
      org.debt = (org.debt || 0) + amount;
      this.addCash(org, amount, 'Financing');
      if (org.isPlayer && !this.state.warm) this.logTransaction(`Borrowed ${U.money(amount)} at ${U.pct(r, 1)} for ${years} years`, { org: org.id, amount });
      return loan;
    },
    repayDebt(org, amount) {
      if (!org) return 0;
      let left = Math.min(amount, Math.max(0, org.cash));
      let paid = 0;
      for (const l of org.loans.slice().sort((a, b) => b.rate - a.rate)) {
        if (left <= 0) break;
        const p = Math.min(left, l.balance);
        l.balance -= p; left -= p; paid += p;
      }
      org.loans = org.loans.filter(l => l.balance > 1);
      org.debt = U.sum(org.loans, l => l.balance);
      if (paid > 0) { org.cash -= paid; org.ledger.cur.Financing = (org.ledger.cur.Financing || 0) - paid; if (org.isPlayer && !this.state.warm) this.logTransaction(`Repaid ${U.money(paid)} of debt`, { org: org.id, amount: -paid }); }
      return paid;
    },
    runUpkeep() {
      // per-entity running costs (e.g., aircraft ownership, theater rent, staff salaries)
      for (const k of this.def.kindOrder) {
        const kd = this.def.kinds[k];
        if (!kd.upkeep) continue;
        const ups = Array.isArray(kd.upkeep) ? kd.upkeep : [{ label: kd.upkeepLabel || `${kd.plural}`, expr: kd.upkeep }];
        for (const e of this.all(k)) {
          if (e.owner == null) continue;
          const org = this.state.orgs[e.owner];
          if (!org || !org.alive || org.level === 3) continue;
          const sc = this.scope({ self: e, org });
          for (const u of ups) {
            if (u.when && !this.ev(u.when, sc)) continue;
            const c = this.num(u.expr, sc);
            if (!c) continue;
            if (u.nonCash) { const cat = u.category || u.label || 'Depreciation'; org.ledger.cur[cat] = (org.ledger.cur[cat] || 0) - Math.abs(c); (org.ledger.nonCash = org.ledger.nonCash || {})[cat] = true; }
            else this.addCash(org, -Math.abs(c), u.category || u.label || 'Upkeep');
          }
        }
      }
      // org-level costs and income (overhead, scale costs, sponsorship...)
      const tickOps = this.def.orgs.tick;
      const warm = this.state.warm;
      if (tickOps) for (const org of this.liveOrgs()) if (org.level < 3 && !(warm && org.isPlayer)) this.runOps(tickOps, this.scope({ org }));
      const oc = this.def.orgs.costs || [];
      const oi = this.def.orgs.income || [];
      for (const org of this.liveOrgs()) {
        if (org.level === 3 || (warm && org.isPlayer)) continue;
        const sc = this.scope({ org });
        for (const c of oc) { if (c.when && !this.ev(c.when, sc)) continue; const v = this.num(c.expr, sc); if (v) this.addCash(org, -Math.abs(v), c.label || 'Overhead'); }
        for (const c of oi) { if (c.when && !this.ev(c.when, sc)) continue; const v = this.num(c.expr, sc); if (v) this.addCash(org, Math.abs(v), c.label || 'Other income'); }
      }
    },
    forgiveDebt(org, fraction) {
      let cut = 0;
      for (const l of org.loans) { const c = l.balance * fraction; l.balance -= c; cut += c; }
      org.loans = org.loans.filter(l => l.balance > 1);
      org.debt = U.sum(org.loans, l => l.balance);
      if (org.cash < 0) { const c = -org.cash * fraction; org.cash += c; cut += c; }
      return cut;
    },
    runFinance() {
      for (const org of this.liveOrgs()) {
        if (org.level === 3) { this.backgroundOrgStep(org); continue; }
        // interest + amortization
        let interest = 0, principal = 0;
        for (const l of org.loans) {
          const i = l.balance * l.rate / this.cal.perYear;
          const pmt = l.left > 0 ? l.balance / l.left : l.balance;
          interest += i; principal += Math.min(pmt, l.balance);
          l.balance = Math.max(0, l.balance - pmt); l.left = Math.max(0, l.left - 1);
        }
        org.loans = org.loans.filter(l => l.balance > 1);
        if (interest) this.addCash(org, -interest, 'Interest');
        if (principal) { org.cash -= principal; org.ledger.cur.Financing = (org.ledger.cur.Financing || 0) - principal; }
        // revolving credit: negative cash accrues interest at a penalty rate
        if (org.cash < 0) this.addCash(org, org.cash * (this.rateFor(org) + 0.04) / this.cal.perYear, 'Interest');
        org.debt = U.sum(org.loans, l => l.balance);
      }
    },
    backgroundOrgStep(org) {
      // L3 statistical simulation: size follows the cycle with noise
      const w = this.state.world;
      org.m.size = Math.max(0.05, (org.m.size || 1) * Math.exp(this.rng.normal(((w.demand || 1) - 1) * 0.02, 0.015)));
      org.m.value = org.m.size * this.num(this.def.orgs.rivals && this.def.orgs.rivals.backgroundValue || 1e8, this.scope({ org }));
      org.m.revenueYear = org.m.value * 0.6;
    },
    ledgerSum(org, period = 'last', filter = null) {
      const L = org.ledger[period] || {};
      let t = 0; for (const [k, v] of Object.entries(L)) if (!filter || filter(k, v)) t += v; return t;
    },
    isOperatingCategory(cat) {
      const fin = this.def.gdl.finance || {};
      const non = fin.nonOperating || ['Financing', 'Capex', 'Asset sales', 'Equity', 'Acquisitions'];
      return !non.includes(cat);
    },
    updateOrgMetrics() {
      const per = this.cal.perYear;
      for (const org of this.liveOrgs()) {
        if (org.level === 3) continue;
        const L = org.ledger.cur;
        let rev = 0, cost = 0;
        for (const [k, v] of Object.entries(L)) { if (!this.isOperatingCategory(k)) continue; if (v >= 0) rev += v; else cost += v; }
        const m = org.m;
        m.revenue = rev; m.costs = -cost; m.profit = rev + cost;
        const ser = org.ledger.series;
        const n = Math.min(ser.length, per - 1);
        let ry = rev, py = rev + cost;
        for (let i = ser.length - n; i < ser.length; i++) { ry += ser[i].rev; py += ser[i].profit; }
        const scale = ser.length + 1 < per ? per / (ser.length + 1) : 1; // annualize early
        m.revenueYear = ry * scale; m.profitYear = py * scale;
        m.interestYear = (-(L.Interest || 0)) * per;
        m.ebitdaYear = m.profitYear + m.interestYear;
        m.debt = org.debt || 0; m.cash = org.cash;
        const sc = this.scope({ org });
        m.assets = this.def.orgs.assets ? this.num(this.def.orgs.assets, sc) : 0;
        const valExpr = this.def.orgs.valuation;
        m.value = valExpr ? this.num(valExpr, sc) : Math.max(0, m.assets + org.cash - (org.debt || 0) + Math.max(0, m.profitYear) * 6);
        m.netWorth = m.value;
        for (const md of this.def.orgMetrics) { m[md.id] = this.num(md.expr, sc, 0); }
      }
    },
    closeTick() {
      const st = this.state;
      const per = this.cal.perYear;
      for (const org of this.liveOrgs()) {
        if (org.level === 3) continue;
        const L = org.ledger;
        for (const [k, v] of Object.entries(L.cur)) L.ytd[k] = (L.ytd[k] || 0) + v;
        L.last = L.cur; L.cur = {};
        L.series.push({ t: st.tick, rev: org.m.revenue || 0, profit: org.m.profit || 0, cash: org.cash, debt: org.debt || 0, value: org.m.value || 0 });
        if (L.series.length > per * 6) L.series.shift();
        // tracked metric history (for charts)
        for (const md of this.def.orgMetrics) if (md.track !== false) { const h = org.hist[md.id] = org.hist[md.id] || []; h.push(+(+org.m[md.id] || 0).toFixed(4)); if (h.length > per * 6) h.shift(); }
        if (this.cal.isYearEnd(st.tick)) { L.prevYear = L.ytd; L.ytd = {}; L.years = L.years || []; L.years.push({ year: this.cal.yearOf(st.tick), rev: org.m.revenueYear, profit: org.m.profitYear, value: org.m.value, cash: org.cash }); if (L.years.length > 80) L.years.shift(); }
      }
      // stakeholder history
      for (const [id, s] of Object.entries(st.stakes)) { s.hist = s.hist || []; s.hist.push(+(+s.value).toFixed(2)); if (s.hist.length > per * 4) s.hist.shift(); }
    }
  });
})(globalThis.LGE = globalThis.LGE || {});
