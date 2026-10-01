/* Local Game Studio engine — negotiation (generalized from Billionaire Empire's deal model).
   The counterparty values the offer with a formula, compares it to a hidden reservation value,
   adjusts for relationship memory, then accepts, counters (solving for the term it cares about)
   or rejects with stated reasons. Patience runs out; walking away is remembered. */
(function (E) {
  'use strict';
  const U = E.util;
  E.extendGame({
    startNegotiation(id, withWho, org, sc0) {
      const nd = this.def.negotiations[id];
      if (!nd || !withWho) { this.report('negotiation', new Error('Bad negotiation ' + id)); return null; }
      org = org || this.playerOrg();
      const them = withWho;
      const n = { id: this.newId('neg_'), def: id, label: nd.label || id, org: org.id, with: this.refOf(them), withName: them.name || 'Counterparty', status: 'open', round: 0, patience: nd.patience, history: [], started: this.state.tick, ctx: {} };
      // carry context values (e.g., the route or asset being negotiated)
      for (const [k, x] of Object.entries(nd.context || {})) { let v = this.ev(x, sc0 || this.scope({ org, them })); if (v && typeof v === 'object' && (v.__ent || v.__org)) v = this.refOf(v); n.ctx[k] = v; }
      const sc = this.negScope(n);
      n.terms = {};
      for (const t of nd.terms) n.terms[t.id] = t.type === 'choice' ? (t.default != null ? this.ev(t.default, sc) : t.options[0].value) : this.num(t.default != null ? t.default : 0, sc, 0);
      sc.terms = n.terms;
      n.reservation = this.num(nd.reservation, sc, 1) * (1 + this.rng.normal(0, nd.noise != null ? nd.noise : 0.06));
      n.expires = this.state.tick + Math.round(this.num(nd.expires != null ? nd.expires : this.cal.perYear / 4, sc, 12));
      this.state.negotiations[n.id] = n;
      if (!org.isPlayer) { this.aiNegotiate(n); return n; }
      this.emit('negotiation', n);
      return n;
    },
    negScope(n) {
      const org = this.state.orgs[n.org];
      const them = this.deref(n.with);
      const sc = this.scope({ org, them, self: them, terms: n.terms || {} });
      for (const [k, v] of Object.entries(n.ctx || {})) sc[k] = this.deref(v);
      sc.relationship = this.memory(them, org, n.relKey || (this.def.negotiations[n.def].relationshipKey || 'relationship'));
      return sc;
    },
    evaluateOffer(n, terms) {
      const nd = this.def.negotiations[n.def];
      const sc = this.negScope(n); sc.terms = terms;
      const value = this.num(nd.value, sc, 0);
      const rel = sc.relationship || 0;
      const score = value / Math.max(1e-9, n.reservation) + rel * (nd.relationshipWeight != null ? nd.relationshipWeight : 0.002);
      const reasons = [];
      for (const r of (nd.reasons || [])) if (this.ev(r.when, sc)) reasons.push(this.tpl(r.text, sc));
      if (rel > 10) reasons.push('They value their relationship with you');
      if (rel < -10) reasons.push('They remember bad dealings with you');
      return { score, value, reasons, sc };
    },
    /* Solve for the counter term so the counterparty's value ≈ reservation × margin. */
    solveCounter(n, terms) {
      const nd = this.def.negotiations[n.def];
      const ct = nd.counter && nd.counter.term ? nd.terms.find(t => t.id === nd.counter.term) : nd.terms.find(t => t.type !== 'choice');
      if (!ct) return null;
      const sc = this.negScope(n);
      let lo = this.num(ct.min != null ? ct.min : 0, sc, 0), hi = this.num(ct.max != null ? ct.max : (terms[ct.id] || 1) * 4 + 1, sc, 1);
      const target = 1 + this.rng.float(0.01, 0.06);
      const f = (x) => this.evaluateOffer(n, Object.assign({}, terms, { [ct.id]: x })).score - target;
      const fl = f(lo), fh = f(hi);
      if (Math.sign(fl) === Math.sign(fh)) return null;
      for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (Math.sign(f(mid)) === Math.sign(fl)) lo = mid; else hi = mid; }
      let v = (lo + hi) / 2;
      if (ct.step) v = Math.round(v / ct.step) * ct.step;
      if (ct.type === 'int') v = Math.round(v);
      return Object.assign({}, terms, { [ct.id]: v });
    },
    offer(negId, terms) {
      const n = this.state.negotiations[negId];
      if (!n || (n.status !== 'open' && n.status !== 'countered')) return { ok: false, why: ['Negotiation is closed'] };
      const nd = this.def.negotiations[n.def];
      terms = Object.assign({}, n.terms, terms || {});
      for (const t of nd.terms) if (t.type !== 'choice') terms[t.id] = +terms[t.id] || 0;
      const org = this.state.orgs[n.org];
      const ev = this.evaluateOffer(n, terms);
      n.round++;
      n.history.push({ t: this.state.tick, by: 'you', terms: Object.assign({}, terms) });
      if (ev.score >= 1) return this.closeNegotiation(n, terms, 'accepted', ev.reasons);
      if (ev.score >= (nd.counterAt != null ? nd.counterAt : 0.82) && n.patience > 0) {
        const ct = this.solveCounter(n, terms);
        if (ct) {
          n.status = 'countered'; n.counter = ct; n.terms = terms; n.patience--;
          n.lastReason = ev.reasons[0] || 'They want a better deal';
          n.history.push({ t: this.state.tick, by: 'them', terms: Object.assign({}, ct), reason: n.lastReason });
          return { ok: true, status: 'countered', counter: ct, reasons: ev.reasons, score: ev.score };
        }
      }
      n.patience--;
      n.status = n.patience < 0 ? 'failed' : 'open';
      n.terms = terms;
      n.lastReason = ev.reasons[0] || 'The offer is too far from what they need';
      n.history.push({ t: this.state.tick, by: 'them', reject: true, reason: n.lastReason });
      if (n.status === 'failed') { this.closeNegotiation(n, terms, 'failed', ev.reasons); return { ok: true, status: 'failed', reasons: ev.reasons, score: ev.score }; }
      return { ok: true, status: 'rejected', reasons: ev.reasons, score: ev.score, patience: n.patience };
    },
    acceptCounter(negId) {
      const n = this.state.negotiations[negId];
      if (!n || n.status !== 'countered') return { ok: false };
      return this.closeNegotiation(n, n.counter, 'accepted', ['You accepted their counter-offer']);
    },
    walkAway(negId) {
      const n = this.state.negotiations[negId];
      if (!n) return { ok: false };
      return this.closeNegotiation(n, n.terms, 'walked', []);
    },
    closeNegotiation(n, terms, outcome, reasons) {
      const nd = this.def.negotiations[n.def];
      n.status = outcome; n.terms = terms; n.closed = this.state.tick;
      const sc = this.negScope(n); sc.terms = terms;
      const org = this.state.orgs[n.org], them = this.deref(n.with);
      const relKey = nd.relationshipKey || 'relationship';
      if (outcome === 'accepted') {
        if (nd.cost) { const c = this.num(nd.cost, sc, 0); if (c) this.addCash(org, -c, nd.costCategory || nd.label || 'Deals', null, !!nd.capex); }
        this.runOps(nd.onAccept, sc);
        this.remember(them, org, relKey, nd.acceptRel != null ? nd.acceptRel : 3);
        if (org.isPlayer && !this.state.warm) this.news(this.tpl(nd.acceptNews || `${nd.label}: deal agreed with ${n.withName}`, sc), 'important', { tag: 'deal', refs: [n.with] });
      } else {
        this.runOps(outcome === 'walked' ? (nd.onWalk || nd.onReject) : nd.onReject, sc);
        this.remember(them, org, relKey, outcome === 'walked' ? -2 : -4);
        if (org.isPlayer && !this.state.warm) this.news(`${nd.label}: talks with ${n.withName} ${outcome === 'walked' ? 'ended — you walked away' : 'collapsed'}`, 'routine', { tag: 'deal', refs: [n.with] });
      }
      // keep a short record, drop the live negotiation
      const H = this.state.history;
      H.deals = H.deals || [];
      H.deals.unshift({ t: this.state.tick, label: n.label, with: n.withName, outcome, rounds: n.round, org: n.org });
      if (H.deals.length > 200) H.deals.length = 200;
      delete this.state.negotiations[n.id];
      this.computeDerived();
      return { ok: true, status: outcome, reasons };
    },
    aiNegotiate(n) {
      const nd = this.def.negotiations[n.def];
      const org = this.state.orgs[n.org];
      // AI makes up to 3 offers climbing toward the reservation value
      const ct = nd.counter && nd.counter.term ? nd.counter.term : (nd.terms.find(t => t.type !== 'choice') || {}).id;
      for (let i = 0; i < 3 && this.state.negotiations[n.id]; i++) {
        const target = this.solveCounter(n, n.terms) || n.terms;
        const r = this.offer(n.id, target);
        if (r.status === 'countered') { if (this.rng.chance(0.75)) this.acceptCounter(n.id); else this.walkAway(n.id); break; }
        if (r.status === 'accepted' || r.status === 'failed') break;
      }
      if (this.state.negotiations[n.id]) this.walkAway(n.id);
      return ct;
    },
    progressNegotiations() {
      for (const n of Object.values(this.state.negotiations)) {
        if (n.expires != null && n.expires <= this.state.tick) this.closeNegotiation(n, n.terms, 'expired', []);
      }
    }
  });
})(globalThis.LGE = globalThis.LGE || {});
