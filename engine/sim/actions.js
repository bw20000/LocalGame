/* Local Game Studio engine — actions & policies.
   Actions are the player's verbs (and the rivals'): params, requirements with reasons, costs,
   what-if forecast, previews ("what you give up / expected result"), effects, cooldowns.
   Policies are standing decisions (delegation/automation) applied every tick. */
(function (E) {
  'use strict';
  const U = E.util;

  function reqList(a) {
    if (!a.requires) return [];
    if (typeof a.requires === 'string') return [{ expr: a.requires, msg: a.requiresMsg || 'Requirements not met' }];
    return a.requires.map(r => (typeof r === 'string' ? { expr: r, msg: 'Requirements not met' } : { expr: r.expr || r.when, msg: r.msg || r.text || 'Requirements not met' }));
  }

  E.extendGame({
    actionDef(id) { return this.def.actions[id]; },
    actionVisible(a, org, self) {
      if (a.aiOnly && org && org.isPlayer) return false;
      if (a.playerOnly && org && !org.isPlayer) return false;
      const sc = this.scope({ org, self });
      if (a.tier && this.def.tierIds.length && org && org.isPlayer && this.tierIndex(this.state.progression.tier) < this.tierIndex(a.tier)) return false;
      if (a.visible && !this.ev(a.visible, sc)) return false;
      return true;
    },
    tierIndex(id) { const i = this.def.tierIds.indexOf(id); return i < 0 ? 0 : i; },
    /* Actions available globally (scope=global) or for an entity. */
    listActions(entity, org) {
      org = org || this.playerOrg();
      const out = [];
      for (const a of Object.values(this.def.actions)) {
        if (entity) { if (a.scope !== 'entity' || a.kind !== entity.kind) continue; }
        else if (a.scope !== 'global') continue;
        if (!this.actionVisible(a, org, entity)) continue;
        out.push(a);
      }
      return out;
    },
    paramCandidates(a, p, org, partial = {}, self = null, limit = 300) {
      if (p.type !== 'entity' && p.type !== 'org') return [];
      const sc = this.scope({ org, self, param: partial });
      let list = p.type === 'org' ? this.liveOrgs().filter(o => o.level < 3) : this.all(p.kind).slice();
      if (p.filter) list = list.filter(it => { sc.it = it; return !!this.ev(p.filter, sc); });
      sc.it = undefined;
      if (p.sort) { const sv = new Map(list.map(it => { sc.it = it; return [it, this.num(p.sort, sc, 0)]; })); list.sort((x, y) => sv.get(y) - sv.get(x)); sc.it = undefined; }
      return list.slice(0, limit);
    },
    defaultParams(a, org, self) {
      const out = {};
      for (const p of a.params || []) {
        const sc = this.scope({ org, self, param: out });
        if (p.type === 'entity' || p.type === 'org') {
          if (p.default != null) { const v = this.ev(p.default, sc); out[p.id] = v && typeof v === 'object' ? v : (p.type === 'org' ? this.state.orgs[v] : this.ent(p.kind, v)); }
          else { const c = this.paramCandidates(a, p, org, out, self, 1); out[p.id] = c[0] || null; }
        } else if (p.type === 'choice') {
          const d = p.default != null ? (typeof p.default === 'string' && (p.options || []).some(o => o.value === p.default) ? p.default : this.ev(p.default, sc)) : (p.options && p.options[0] && p.options[0].value);
          out[p.id] = d;
        } else if (p.type === 'bool') out[p.id] = p.default != null ? !!this.ev(p.default, sc) : false;
        else if (p.type === 'text') out[p.id] = p.default != null ? this.tpl(p.default, sc) : '';
        else out[p.id] = p.default != null ? this.num(p.default, sc, 0) : (p.min != null ? this.num(p.min, sc, 0) : 0);
      }
      return out;
    },
    /* Resolve raw params (ids from UI) into a param object with entities. */
    resolveParams(a, raw, org, self) {
      const out = {};
      for (const p of a.params || []) {
        let v = raw ? raw[p.id] : undefined;
        if (v === undefined) { const d = this.defaultParams({ params: [p] }, org, self); v = d[p.id]; }
        if (p.type === 'entity') v = v && typeof v === 'object' ? v : this.ent(p.kind, v);
        else if (p.type === 'org') v = v && typeof v === 'object' ? v : this.state.orgs[v];
        else if (p.type === 'number' || p.type === 'money' || p.type === 'int' || p.type === 'pct') {
          v = +v; const sc = this.scope({ org, self, param: out });
          if (p.min != null) v = Math.max(this.num(p.min, sc), v);
          if (p.max != null) v = Math.min(this.num(p.max, sc), v);
          if (p.type === 'int') v = Math.round(v);
          if (!Number.isFinite(v)) v = 0;
        } else if (p.type === 'bool') v = !!v;
        out[p.id] = v;
      }
      return out;
    },
    actionScope(a, org, self, param) {
      const sc = this.scope({ org, self, param, actor: org });
      for (const [k, x] of Object.entries(a.vars || {})) sc[k] = this.ev(x, sc);
      if (a.forecast) {
        const set = {};
        for (const [f, x] of Object.entries(a.forecast.set || {})) { let v = this.ev(x, sc); if (v && typeof v === 'object' && v.__ent) v = v.id; set[f] = v; }
        if (a.forecast.exclude) set.__exclude = this.ev(a.forecast.exclude, sc) && this.ev(a.forecast.exclude, sc).id;
        sc.fc = this.forecast(a.forecast.kind, set, org) || { demand: 0, sold: 0, revenue: 0, cost: 0, profit: 0, load: 0, capacity: 0 };
      }
      return sc;
    },
    actionCost(a, sc) {
      const out = {};
      for (const [k, x] of Object.entries(a.cost || {})) out[k] = this.num(x, sc, 0);
      return out;
    },
    /* Full check used by UI (enabled/disabled with reasons) and by AI. */
    checkAction(a, org, self, param) {
      const why = [];
      const sc = this.actionScope(a, org, self, param);
      for (const p of a.params || []) {
        if (p.optional) continue;
        const v = param[p.id];
        if ((p.type === 'entity' || p.type === 'org') && !v) why.push(`Choose ${p.label || p.id}`);
        if ((p.type === 'entity' || p.type === 'org') && v && p.filter) { sc.it = v; if (!this.ev(p.filter, sc)) why.push(`${v.name} is not a valid ${p.label || p.id}`); sc.it = undefined; }
      }
      for (const r of reqList(a)) if (!this.ev(r.expr, sc)) why.push(this.tpl(r.msg, sc));
      const cost = this.actionCost(a, sc);
      if (cost.cash > 0) {
        const allowance = a.allowDebt ? this.creditLimit(org) : 0;
        if (org.cash + allowance < cost.cash) why.push(`Needs ${U.money(cost.cash)} (you have ${U.money(org.cash)})`);
      }
      for (const [k, v] of Object.entries(cost)) if (k !== 'cash' && v > 0 && (org.res[k] || 0) < v) why.push(`Needs ${U.num(v)} ${(this.def.resources[k] && this.def.resources[k].label) || k}`);
      const cdKey = a.id + (self ? ':' + self.id : '') + ':' + org.id;
      const cd = this.state.cooldowns && this.state.cooldowns[cdKey];
      if (cd != null && cd > this.state.tick) why.push(`Available again in ${U.plural(cd - this.state.tick, this.cal.unitLabel)}`);
      return { ok: why.length === 0, why, sc, cost };
    },
    previewAction(a, org, self, param) {
      const chk = this.checkAction(a, org, self, param);
      const items = (a.preview || []).map(pv => {
        const v = this.ev(pv.expr, chk.sc);
        return { label: pv.label, value: v, text: pv.format === 'text' || typeof v === 'string' ? String(v) : U.format(v, pv.format), tone: pv.tone ? this.ev(pv.tone, chk.sc) : null };
      });
      return { ok: chk.ok, why: chk.why, cost: chk.cost, items, fc: chk.sc.fc, describe: a.describe ? this.tpl(a.describe, chk.sc) : '', tradeoff: a.tradeoff ? this.tpl(a.tradeoff, chk.sc) : '', risk: a.risk ? this.tpl(a.risk, chk.sc) : '' };
    },
    /* Execute an action. raw params may be ids. Returns {ok, why, result}. */
    act(actionId, raw = {}, opts = {}) {
      const a = this.def.actions[actionId];
      if (!a) return { ok: false, why: [`Unknown action ${actionId}`] };
      const org = opts.org || this.playerOrg();
      const self = opts.self ? (typeof opts.self === 'object' ? opts.self : this.ent(a.kind, opts.self)) : null;
      if (a.scope === 'entity' && !self) return { ok: false, why: ['No target selected'] };
      if (!this.actionVisible(a, org, self)) return { ok: false, why: ['Not available'] };
      const param = this.resolveParams(a, raw, org, self);
      const chk = this.checkAction(a, org, self, param);
      if (!chk.ok) return { ok: false, why: chk.why };
      const sc = chk.sc;
      const cash = chk.cost.cash || 0;
      if (cash) this.addCash(org, -cash, a.costCategory || (a.capex ? 'Capex' : (a.category ? U.cap1(a.category) : 'Other costs')), null, !!a.capex);
      for (const [k, v] of Object.entries(chk.cost)) if (k !== 'cash' && v) org.res[k] = (org.res[k] || 0) - v;
      const before = org.isPlayer ? this.snapshotOrg(org) : null;
      this.runOps(a.effects, sc);
      if (a.cooldown) { this.state.cooldowns = this.state.cooldowns || {}; this.state.cooldowns[a.id + (self ? ':' + self.id : '') + ':' + org.id] = this.state.tick + Math.round(this.num(a.cooldown, sc, 0)); }
      const st = this.state.stats.actions; st[a.id] = (st[a.id] || 0) + 1;
      this.computeDerived();
      let result = a.result ? this.tpl(a.result, sc) : null;
      if (org.isPlayer && !this.state.warm) {
        if (result) this.logTransaction(result, { org: org.id, amount: cash ? -cash : null });
        this.emit('acted', { action: a.id, result, before, after: this.snapshotOrg(org) });
      } else if (!org.isPlayer && a.ai && a.ai.news && !this.state.warm) {
        this.news(this.tpl(a.ai.news, sc), a.ai.newsPriority || 'background', { tag: 'rival', org: org.id, refs: this.autoRefs(sc) });
      }
      return { ok: true, result, scope: sc };
    },
    snapshotOrg(org) { return { cash: org.cash, value: org.m.value, res: Object.assign({}, org.res) }; },

    /* ----- policies (delegation & automation) ----- */
    initPolicies() {
      for (const p of Object.values(this.def.policies)) if (this.state.policies[p.id] == null) this.state.policies[p.id] = p.default != null ? p.default : (p.options && p.options[0] && p.options[0].value);
    },
    policyValue(p, org) {
      if (org.isPlayer) return this.state.policies[p.id];
      const ar = this.archetypeOf(org);
      if (ar && ar.policies && ar.policies[p.id] != null) return ar.policies[p.id];
      return p.aiDefault != null ? p.aiDefault : (p.default != null ? p.default : (p.options && p.options[0] && p.options[0].value));
    },
    applyPolicies() {
      const t = this.state.tick;
      for (const p of Object.values(this.def.policies)) {
        const every = p.every || 1;
        if (t % every !== 0) continue;
        for (const org of this.liveOrgs()) {
          if (org.level === 3) continue;
          const val = this.policyValue(p, org);
          const opt = (p.options || []).find(o => o.value === val);
          if (!opt || !opt.effects) continue;
          const scopeKind = p.scope && p.scope.startsWith('kind:') ? p.scope.slice(5) : null;
          if (scopeKind) {
            for (const e of this.owned(scopeKind, org.id).slice()) this.runOps(opt.effects, this.scope({ org, self: e, policy: val }));
          } else this.runOps(opt.effects, this.scope({ org, policy: val }));
        }
      }
    },
    setPolicy(id, value) {
      const p = this.def.policies[id];
      if (!p || !(p.options || []).some(o => o.value === value)) return false;
      this.state.policies[id] = value;
      return true;
    }
  });
})(globalThis.LGE = globalThis.LGE || {});
