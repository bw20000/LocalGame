/* Local Game Studio engine — operations & markets.
   Generalizes Broadway Producer's demand model: every operating unit (route, restaurant, show,
   hotel…) competes in a market keyed by an expression. Each customer segment chooses among the
   units in that market (and an outside option) with a multinomial logit over declared attributes
   and price. Capacity is sold premium-segments-first. Revenue/cost lines are formulas. */
(function (E) {
  'use strict';
  const U = E.util;

  E.extendGame({
    computeDerived(onlyKind) {
      for (const k of this.def.kindOrder) {
        if (onlyKind && k !== onlyKind) continue;
        const kd = this.def.kinds[k];
        const der = Object.entries(kd.derived || {});
        if (!der.length) continue;
        for (const e of this.all(k)) this.deriveEntity(e, der);
      }
    },
    deriveEntity(e, der, skip) {
      const kd = this.def.kinds[e.kind];
      der = der || Object.entries(kd.derived || {});
      const org = e.owner != null ? this.state.orgs[e.owner] : null;
      const sc = this.scope({ self: e, org: org || this.playerOrg() });
      for (const [f, d] of der) {
        if (skip && skip.has(f)) continue;
        const ex = typeof d === 'string' ? d : d.expr;
        const v = this.ev(ex, sc);
        e[f] = typeof v === 'number' && !Number.isFinite(v) ? 0 : v;
      }
    },
    operatingKinds() { return this.def.kindOrder.filter(k => this.def.kinds[k].operate); },
    activeUnits(kind) {
      const op = this.def.kinds[kind].operate;
      return this.all(kind).filter(e => {
        if (e.owner == null) return false;
        const org = this.state.orgs[e.owner];
        if (!org || !org.alive || org.level === 3) return false;
        return op.active ? !!this.ev(op.active, this.scope({ self: e, org })) : true;
      });
    },
    unitUtility(e, seg, mk, op, org, sc) {
      let u = 0;
      const w = seg.weights || {};
      for (const a in w) {
        const ex = (op.attrs && op.attrs[a]) || (mk.attrs && mk.attrs[a]) || ('self.' + a);
        const v = this.num(ex, sc, 0);
        u += (w[a] || 0) * v;
      }
      const price = this.num(op.price, sc, 0);
      const ref = Math.max(1e-9, this.num(mk.refPrice || op.refPrice || price || 1, sc, price || 1));
      const ps = seg.priceSens != null ? seg.priceSens : (seg.price != null ? seg.price : 1);
      u -= ps * Math.log(Math.max(0.05, price / ref));
      if (op.utility) u += this.num(op.utility, sc, 0);
      if (seg.utility) u += this.num(seg.utility, sc, 0);
      return U.clamp(u, -30, 30);
    },
    /* Solve one market: units competing for the same key. Returns per-unit results. */
    solveMarket(kind, mk, units, opts = {}) {
      const kd = this.def.kinds[kind], op = kd.operate;
      if (!units.length) return [];
      const rep = units[0];
      const scRep = this.scope({ self: rep, org: this.state.orgs[rep.owner] || this.playerOrg(), key: opts.key, units: units.length });
      const size = Math.max(0, this.num(mk.size, scRep, 0));
      const outside = this.num(mk.outside != null ? mk.outside : 0, scRep, 0);
      const res = units.map(e => {
        const org = this.state.orgs[e.owner] || opts.org || this.playerOrg();
        const sc = this.scope({ self: e, org, key: opts.key });
        return { e, org, sc, cap: Math.max(0, this.num(op.capacity, sc, 0)), price: Math.max(0, this.num(op.price, sc, 0)), dem: {}, sold: {}, demand: 0, soldTot: 0 };
      });
      const segs = mk.segments;
      for (const seg of segs) {
        const segSize = seg.size != null ? this.num(seg.size, scRep, 0) : size * (seg.share != null ? seg.share : 1 / segs.length);
        let den = Math.exp(outside);
        const ex = res.map(r => { const v = r.cap > 0 ? Math.exp(this.unitUtility(r.e, seg, mk, op, r.org, r.sc)) : 0; den += v; return v; });
        res.forEach((r, i) => { const d = segSize * ex[i] / den; r.dem[seg.id] = d; r.demand += d; });
      }
      const order = segs.slice().sort((a, b) => (b.priceMult || 1) - (a.priceMult || 1));
      for (const r of res) {
        let left = r.cap; let rev = 0;
        for (const seg of order) { const s = Math.min(r.dem[seg.id] || 0, left); r.sold[seg.id] = s; left -= s; r.soldTot += s; rev += s * r.price * (seg.priceMult || 1); }
        r.sales = rev;
      }
      const totalSold = res.reduce((a, r) => a + r.soldTot, 0);
      for (const r of res) { r.share = totalSold > 0 ? r.soldTot / totalSold : 0; r.size = size; }
      return res;
    },
    finishUnit(kind, r, post) {
      const op = this.def.kinds[kind].operate;
      const e = r.e;
      const ctx = Object.assign(r.sc, { sold: r.soldTot, demand: r.demand, capacity: r.cap, price: r.price, load: r.cap > 0 ? r.soldTot / r.cap : 0, segSold: r.sold, segDemand: r.dem, share: r.share, market: { size: r.size, share: r.share } });
      let rev = r.sales, cost = 0;
      const lines = [];
      if (r.sales) lines.push([op.salesLabel || 'Sales', r.sales]);
      for (const l of (op.revenue || [])) { const v = this.num(l.expr, ctx, 0); if (v) { rev += v; lines.push([l.label || 'Revenue', v]); } }
      ctx.revenue = rev;
      for (const l of (op.costs || [])) { const v = Math.abs(this.num(l.expr, ctx, 0)); if (v) { cost += v; lines.push([l.label || 'Costs', -v]); } }
      const out = { demand: r.demand, sold: r.soldTot, capacity: r.cap, load: ctx.load, revenue: rev, cost, profit: rev - cost, share: r.share, price: r.price, segSold: r.sold, lines };
      if (post) {
        for (const [lab, v] of lines) this.addCash(r.org, v, lab);
        e._demand = r.demand; e._sold = r.soldTot; e._cap = r.cap; e._load = ctx.load; e._rev = rev; e._cost = cost; e._profit = rev - cost; e._share = r.share;
        e._seg = Object.fromEntries(Object.entries(r.sold).map(([k, v]) => [k, Math.round(v)]));
        const hp = e._hp = e._hp || []; hp.push(Math.round(rev - cost)); if (hp.length > 52) hp.shift();
        for (const [f, ex] of Object.entries(op.stats || {})) { const v = this.ev(ex, ctx); e[f] = typeof v === 'number' && !Number.isFinite(v) ? 0 : v; }
        if (op.after) this.runOps(op.after, ctx);
      }
      return out;
    },
    runOperations() {
      for (const kind of this.operatingKinds()) {
        const op = this.def.kinds[kind].operate;
        const mk = this.def.markets[op.market] || { segments: [{ id: 'all', share: 1, priceSens: 1, weights: {} }], size: op.size || 0, outside: 0 };
        const groups = new Map();
        for (const e of this.activeUnits(kind)) {
          const key = mk.key ? String(this.ev(mk.key, this.scope({ self: e, org: this.state.orgs[e.owner] }))) : (op.market || 'all') + ':' + e.id;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(e);
        }
        const summary = {};
        for (const [key, units] of groups) {
          const res = this.solveMarket(kind, mk, units, { key });
          let tot = 0;
          for (const r of res) { const o = this.finishUnit(kind, r, true); tot += o.sold; }
          summary[key] = { size: res[0] ? res[0].size : 0, sold: tot, units: units.length };
        }
        this.state.markets = this.state.markets || {};
        this.state.markets[kind] = summary;
        // inactive units get zeroed stats so the UI never shows stale numbers
        const live = new Set(); for (const arr of groups.values()) for (const e of arr) live.add(e.id);
        for (const e of this.all(kind)) if (!live.has(e.id) && (e._sold || e._rev)) { e._sold = 0; e._rev = 0; e._demand = 0; e._load = 0; e._profit = 0; e._cost = 0; }
      }
    },
    /* What-if: evaluate a hypothetical unit (not stored) against current competitors. */
    forecast(kind, fields, org) {
      const kd = this.def.kinds[kind];
      if (!kd || !kd.operate) return null;
      const op = kd.operate, mk = this.def.markets[op.market] || { segments: [{ id: 'all', share: 1, priceSens: 1, weights: {} }], outside: 0 };
      org = org || this.playerOrg();
      const tmp = { __ent: true, id: '__forecast', kind, owner: org.id, born: this.state.tick, name: 'Forecast' };
      for (const [f, fd] of Object.entries(kd.fields)) if (fd.default !== undefined && (typeof fd.default !== 'string' || fd.type === 'text' || fd.type === 'enum')) tmp[f] = fd.default;
      Object.assign(tmp, fields);
      const set = new Set(Object.keys(fields));
      this.deriveEntity(tmp, null, set);
      const key = mk.key ? String(this.ev(mk.key, this.scope({ self: tmp, org }))) : null;
      const comps = key == null ? [] : this.activeUnits(kind).filter(e => String(this.ev(mk.key, this.scope({ self: e, org: this.state.orgs[e.owner] }))) === key && e.id !== fields.__exclude);
      const units = comps.concat([tmp]);
      const res = this.solveMarket(kind, mk, units, { key, org });
      const mine = res.find(r => r.e === tmp);
      if (!mine) return null;
      const out = this.finishUnit(kind, mine, false);
      out.competitors = comps.length;
      out.marketSize = mine.size;
      return out;
    }
  });
})(globalThis.LGE = globalThis.LGE || {});
