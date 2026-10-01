/* Local Game Studio engine — events, news, moments, needs-you queue, upcoming, digest.
   Events bind to REAL entities (a route losing money, a rival that poached you…), carry a
   priority tier (critical / important / routine / background) with rate limits to prevent
   notification fatigue, and expire to a default choice if ignored. */
(function (E) {
  'use strict';
  const U = E.util;
  const PRI = { critical: 3, important: 2, routine: 1, background: 0 };

  E.extendGame({
    news(text, pri = 'routine', meta = {}) {
      if (!text) return;
      const st = this.state;
      const item = { id: this.newId('n'), t: st.tick, text, pri, tag: meta.tag || null, refs: meta.refs || [], org: meta.org || null, read: st.warm };
      st.news.unshift(item);
      if (st.news.length > 400) st.news.length = 400;
      if (!st.warm && (pri === 'important' || pri === 'critical' || (pri === 'routine' && (!meta.org || meta.org === st.player)))) st.digest.push({ t: st.tick, text, pri });
      if (st.digest.length > 60) st.digest.shift();
      return item;
    },
    moment(title, text, tone = 'good', stat = null) {
      const st = this.state;
      if (st.warm) return;
      const m = { id: this.newId('m'), t: st.tick, title, text, tone, stat };
      st.moments = st.moments || [];
      st.moments.unshift(m); if (st.moments.length > 50) st.moments.length = 50;
      this.emit('moment', m);
      if (st.settings.autopause && st.settings.autopause.moments) this.interrupt('moment', { moment: m });
    },
    eventBudgetOk(pri) {
      // anti-notification-fatigue: cap interrupting events per month and per year
      const st = this.state, tpm = Math.max(1, this.cal.ticksPerMonth);
      const recent = st.events.log.filter(l => st.tick - l.t < tpm * 1 && PRI[l.pri] >= 2);
      const cap = this.def.gdl.eventBudget || { critical: 1, important: 2 };
      if (pri === 'critical') return recent.filter(l => l.pri === 'critical').length < (cap.critical || 1);
      if (pri === 'important') return recent.length < (cap.important || 2) + (cap.critical || 1);
      return true;
    },
    bindEvent(ev, sc) {
      const binds = {};
      for (const [name, b] of Object.entries(ev.bind || {})) {
        let list;
        if (b.kind === 'org' || b.type === 'org') list = this.liveOrgs().filter(o => o.level < 3);
        else list = this.all(b.kind).slice();
        if (b.owner === 'player') list = list.filter(e => e.owner === this.state.player);
        else if (b.owner === 'rival') list = list.filter(e => e.owner != null && e.owner !== this.state.player);
        if (b.filter) list = list.filter(it => { sc.it = it; return !!this.ev(b.filter, sc); });
        sc.it = undefined;
        if (!list.length) return null;
        let pick;
        if (b.pick === 'max' || b.pick === 'min') {
          const by = b.by || '0';
          const vals = list.map(it => { sc.it = it; return this.num(by, sc, 0); }); sc.it = undefined;
          let bi = 0; for (let i = 1; i < vals.length; i++) if (b.pick === 'max' ? vals[i] > vals[bi] : vals[i] < vals[bi]) bi = i;
          pick = list[bi];
        } else pick = this.rng.pick(list);
        binds[name] = pick; sc[name] = pick;
      }
      return binds;
    },
    checkEvents() {
      const st = this.state, t = st.tick;
      // scheduled first
      const due = st.events.scheduled.filter(s => s.at <= t);
      st.events.scheduled = st.events.scheduled.filter(s => s.at > t);
      for (const s of due) this.fireEvent(s.id, s.bind || {}, true);
      // expire pending
      for (const p of st.events.pending.slice()) if (p.expires != null && p.expires <= t) this.resolveEvent(p.iid, p.default != null ? p.default : 0, true);
      // random/conditional templates
      const tickYear = this.cal.tickOfYear(t);
      for (const ev of Object.values(this.def.events)) {
        if (ev.trigger === 'manual' || ev.trigger === 'scheduled') continue;
        if (ev.once && st.events.fired[ev.id]) continue;
        const cd = st.events.cooldown[ev.id];
        if (cd != null && cd > t) continue;
        if (ev.minTick != null && t < ev.minTick) continue;
        if (ev.atTickOfYear != null && tickYear !== ev.atTickOfYear) continue;
        if (st.events.pending.some(p => p.id === ev.id)) continue;
        const sc = this.scope({ org: this.playerOrg() });
        const ch = ev.chance != null ? this.num(ev.chance, sc, 0) : (ev.when ? 1 : 0.02);
        if (ch <= 0 || this.rng.next() >= ch) continue;
        if (!this.eventBudgetOk(ev.priority)) continue;
        const binds = this.bindEvent(ev, sc);
        if (!binds) continue;
        if (ev.when && !this.ev(ev.when, sc)) continue;
        this.fireEvent(ev.id, Object.fromEntries(Object.entries(binds).map(([k, v]) => [k, this.refOf(v)])), false, sc);
      }
    },
    scheduleEvent(id, delay, bind, org) {
      if (!this.def.events[id]) { this.report('event', new Error('Unknown event ' + id)); return; }
      if (org && !org.isPlayer && this.def.events[id].scope !== 'world') return;
      this.state.events.scheduled.push({ id, at: this.state.tick + Math.max(0, Math.round(delay || 0)), bind: bind || {} });
    },
    eventScope(bind) {
      const sc = this.scope({ org: this.playerOrg() });
      for (const [k, r] of Object.entries(bind || {})) sc[k] = this.deref(r);
      return sc;
    },
    fireEvent(id, bind, forced, scIn) {
      const ev = this.def.events[id];
      if (!ev) return null;
      const st = this.state;
      const sc = scIn || this.eventScope(bind);
      for (const [k, r] of Object.entries(bind || {})) if (sc[k] === undefined) sc[k] = this.deref(r);
      // drop if a bound entity vanished
      for (const [k, r] of Object.entries(bind || {})) if (r && typeof r === 'string' && r.includes(':') && !this.deref(r)) return null;
      st.events.fired[ev.id] = (st.events.fired[ev.id] || 0) + 1;
      if (ev.cooldown != null) st.events.cooldown[ev.id] = st.tick + Math.round(this.num(ev.cooldown, sc, 0));
      st.stats.events[ev.priority] = (st.stats.events[ev.priority] || 0) + 1;
      st.events.log.push({ id: ev.id, t: st.tick, pri: ev.priority });
      if (st.events.log.length > 300) st.events.log.shift();
      if (ev.effects) this.runOps(ev.effects, sc);
      const title = this.tpl(ev.title || ev.id, sc), text = this.tpl(ev.text || '', sc);
      const choices = (ev.choices || []).map((c, i) => ({ i, label: this.tpl(c.label, sc), describe: c.describe ? this.tpl(c.describe, sc) : '', enabled: c.requires ? !!this.ev(c.requires, sc) : true, preview: (c.preview || []).map(p => ({ label: p.label, text: U.format(this.ev(p.expr, sc), p.format) })) }));
      if (!choices.length || st.warm) {
        if (ev.priority !== 'background' || ev.news) this.news(ev.news ? this.tpl(ev.news, sc) : `${title}${text ? ' — ' + text : ''}`, ev.priority === 'critical' ? 'important' : ev.priority, { tag: ev.tag || 'event', refs: Object.values(bind || {}) });
        if (ev.moment) this.moment(title, text, ev.tone || 'good');
        return null;
      }
      const inst = { iid: this.newId('ev'), id: ev.id, t: st.tick, title, text, priority: ev.priority, bind: bind || {}, choices, default: ev.default != null ? ev.default : null, expires: ev.expires != null ? st.tick + Math.round(this.num(ev.expires, sc, 4)) : st.tick + Math.max(2, Math.round(this.cal.ticksPerMonth * 2)), tone: ev.tone || (ev.priority === 'critical' ? 'bad' : 'neutral') };
      st.events.pending.push(inst);
      if (ev.priority === 'critical' || (ev.priority === 'important' && st.settings.autopause && st.settings.autopause.important)) this.interrupt('event', { event: inst });
      this.emit('event', inst);
      return inst;
    },
    resolveEvent(iid, choiceIndex = 0, auto = false) {
      const st = this.state;
      const i = st.events.pending.findIndex(p => p.iid === iid);
      if (i < 0) return { ok: false };
      const inst = st.events.pending[i];
      const ev = this.def.events[inst.id];
      const ch = ev && ev.choices[choiceIndex];
      if (!ch) return { ok: false };
      const sc = this.eventScope(inst.bind);
      if (!auto && ch.requires && !this.ev(ch.requires, sc)) return { ok: false, why: ['Not possible right now'] };
      st.events.pending.splice(i, 1);
      if (ch.cost) { const c = this.num(ch.cost, sc, 0); if (c) this.addCash(this.playerOrg(), -c, ch.costCategory || 'Other costs'); }
      this.runOps(ch.effects, sc);
      const res = ch.result ? this.tpl(ch.result, sc) : `${inst.title}: ${this.tpl(ch.label, sc)}`;
      this.news((auto ? 'No response in time — ' : '') + res, inst.priority === 'critical' ? 'important' : 'routine', { tag: 'decision', refs: Object.values(inst.bind) });
      if (ch.track) st.history.anti.push({ t: st.tick, text: this.tpl(ch.track.text || inst.title, sc), ref: ch.track.ref ? this.refOf(this.ev(ch.track.ref, sc)) : null, valueThen: ch.track.value ? this.num(ch.track.value, sc, 0) : null, valueExpr: ch.track.value || null });
      this.emit('resolved', { iid, choice: choiceIndex, result: res });
      this.computeDerived();
      return { ok: true, result: res };
    },
    /* Needs-you queue: everything that is waiting on the player, prioritized. */
    needs() {
      const st = this.state, out = [];
      for (const p of st.events.pending) out.push({ pri: PRI[p.priority] || 1, type: 'event', id: p.iid, title: p.title, sub: `${p.priority === 'critical' ? 'Decide now' : 'Decide'} · ${p.expires != null ? `auto-resolves in ${U.plural(Math.max(0, p.expires - st.tick), this.cal.unitLabel)}` : ''}`, tone: p.tone });
      for (const n of Object.values(st.negotiations)) if (n.org === st.player && n.status === 'countered') out.push({ pri: 2, type: 'negotiation', id: n.id, title: `${n.label}: ${n.withName} countered`, sub: n.lastReason || 'Review the counter-offer', tone: 'neutral' });
      for (const p of Object.values(st.projects)) if (p.owner === st.player && p.waiting) out.push({ pri: 2, type: 'project', id: p.iid, title: `${p.name}: ${p.waiting.label || 'decision needed'}`, sub: p.waiting.describe || 'Approve to continue', tone: 'neutral' });
      if (st.progression.distress > 0 && st.progression.rescueOpen) out.push({ pri: 3, type: 'rescue', id: 'rescue', title: 'Cash crisis: choose a rescue plan', sub: `${U.plural(Math.max(0, (this.def.progression.failure.grace || 8) - st.progression.distress), this.cal.unitLabel)} before the board acts`, tone: 'bad' });
      for (const n of (this.def.gdl.needs || [])) {
        const sc = this.scope();
        if (n.forEach) {
          for (const e of this.owned(n.forEach, st.player)) { sc.self = e; if (this.ev(n.when, sc)) out.push({ pri: n.priority || 1, type: 'hint', id: n.id + ':' + e.id, title: this.tpl(n.text, sc), sub: n.sub ? this.tpl(n.sub, sc) : '', ref: this.refOf(e), action: n.action || null, tone: n.tone || 'neutral' }); }
        } else if (this.ev(n.when, sc)) out.push({ pri: n.priority || 1, type: 'hint', id: n.id, title: this.tpl(n.text, sc), sub: n.sub ? this.tpl(n.sub, sc) : '', action: n.action || null, nav: n.nav || null, tone: n.tone || 'neutral' });
      }
      out.sort((a, b) => b.pri - a.pri);
      return out.slice(0, 12);
    },
    upcoming() {
      const st = this.state, out = [];
      for (const p of Object.values(st.projects)) if (p.owner === st.player) out.push({ at: st.tick + Math.max(0, p.left), label: `${p.name} — ${p.stageLabel}`, kind: 'project' });
      for (const o of st.progression.objectives || []) if (!o.done) out.push({ at: o.deadline, label: `Objective: ${o.text}`, kind: 'objective' });
      for (const s of st.events.scheduled) { const ev = this.def.events[s.id]; if (ev && ev.upcoming) out.push({ at: s.at, label: this.tpl(ev.upcoming, this.eventScope(s.bind)), kind: 'event' }); }
      for (const u of (this.def.gdl.upcoming || [])) { const sc = this.scope(); const at = this.num(u.at, sc, -1); if (at >= st.tick) out.push({ at, label: this.tpl(u.label, sc), kind: 'scheduled' }); }
      const ye = st.tick + (this.cal.perYear - 1 - this.cal.tickOfYear(st.tick));
      out.push({ at: ye, label: 'Year-end review & awards', kind: 'year' });
      out.sort((a, b) => a.at - b.at);
      return out.slice(0, 8);
    },
    takeDigest() { const d = this.state.digest; this.state.digest = []; return d; }
  });
  E.PRI = PRI;
})(globalThis.LGE = globalThis.LGE || {});
