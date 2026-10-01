/* Local Game Studio engine — dialogs: actions (live forecast + tradeoffs), events, negotiations,
   rescue, annual review, "Why?" explanations, inspector drawer, command palette, help. */
(function (E) {
  'use strict';
  const U = E.util, D = E.dom, esc = U.esc, S = E.ui.sections;

  function refreshModal(app, html) {
    if (!app.ui.modal) { app.openModal(html, app.ui.dialogCls); return; }
    app.ui.modal.html = html;
    const m = D.$('.modal', app.root);
    if (m) { const focusKey = document.activeElement && document.activeElement.getAttribute('data-input'); const pos = document.activeElement && document.activeElement.selectionStart; m.innerHTML = html; if (focusKey) { const el = D.$(`[data-input="${CSS.escape(focusKey)}"]`, m); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) { /* number input */ } } } }
    else app.rerender();
  }

  /* ---------------- action dialog ---------------- */
  E.ui.actionDialog = (app, actionId, selfRef) => {
    const a = app.def.actions[actionId]; if (!a) return;
    const self = selfRef ? app.game.deref(selfRef) : null;
    app.ui.dialog = { type: 'action', id: actionId, selfRef, raw: {}, q: {} };
    const def = app.game.defaultParams(a, app.game.playerOrg(), self);
    for (const [k, v] of Object.entries(def)) app.ui.dialog.raw[k] = v && typeof v === 'object' ? v.id : v;
    app.ui.dialogCls = 'action-modal';
    app.openModal(renderAction(app), 'action-modal');
    app.coachEvent('open:' + actionId);
  };
  function renderAction(app) {
    const g = app.game, dl = app.ui.dialog, a = app.def.actions[dl.id], org = g.playerOrg();
    const self = dl.selfRef ? g.deref(dl.selfRef) : null;
    // resolve params in order; drop invalid entity choices when earlier params changed
    const partial = {};
    const paramHtml = (a.params || []).map(p => {
      let html = '';
      if (p.type === 'entity' || p.type === 'org') {
        let cands = g.paramCandidates(a, p, org, partial, self, 400);
        const q = (dl.q[p.id] || '').toLowerCase();
        if (q) cands = cands.filter(c => (S.entTitle(app, c) + ' ' + c.name + ' ' + (c.code || '')).toLowerCase().includes(q));
        if (!cands.some(c => c.id === dl.raw[p.id])) dl.raw[p.id] = cands[0] ? cands[0].id : null;
        const chosen = cands.find(c => c.id === dl.raw[p.id]);
        partial[p.id] = chosen || null;
        const list = cands.slice(0, 60).map((c, i) => `<button class="pick ${c.id === dl.raw[p.id] ? 'on' : ''}" data-a="dlgPick:${esc(p.id)}:${esc(c.id)}"><b>${esc(S.entTitle(app, c))}</b><small>${esc(S.entSub(app, c))}</small>${p.hint ? `<em>${esc(g.tpl(p.hint, g.scope({ it: c, param: partial, org })))}</em>` : ''}</button>`).join('');
        html = `<div class="pfield"><div class="pl">${esc(p.label || p.id)} <small>${cands.length} option${cands.length === 1 ? '' : 's'}${p.sort ? ' · best first' : ''}</small></div>${cands.length > 8 || q ? `<input type="search" class="search" placeholder="Search…" value="${esc(dl.q[p.id] || '')}" data-input="dlgQ:${esc(p.id)}">` : ''}<div class="picks">${list || `<div class="empty">${esc(p.emptyText || 'Nothing available right now.')}</div>`}</div></div>`;
      } else if (p.type === 'choice') {
        const cur = dl.raw[p.id];
        partial[p.id] = cur;
        const opts = p.options || [];
        html = `<div class="pfield"><div class="pl">${esc(p.label || p.id)}</div><div class="choice-row">${opts.map(o => `<button class="choice ${String(o.value) === String(cur) ? 'on' : ''}" data-a="dlgSet:${esc(p.id)}:${esc(o.value)}"><b>${esc(o.label)}</b>${o.describe ? `<small>${esc(o.describe)}</small>` : ''}</button>`).join('')}</div></div>`;
      } else if (p.type === 'bool') {
        partial[p.id] = !!dl.raw[p.id];
        html = `<label class="check pfield"><input type="checkbox" data-change="dlgBool:${esc(p.id)}" ${dl.raw[p.id] ? 'checked' : ''}> ${esc(p.label)}</label>`;
      } else if (p.type === 'text') {
        partial[p.id] = dl.raw[p.id] || '';
        html = `<label class="pfield"><div class="pl">${esc(p.label)}</div><input type="text" value="${esc(dl.raw[p.id] || '')}" data-input="dlgText:${esc(p.id)}"></label>`;
      } else {
        const sc = g.scope({ org, self, param: partial });
        const lo = p.min != null ? g.num(p.min, sc, 0) : 0, hi = p.max != null ? g.num(p.max, sc, 100) : 100;
        let v = +dl.raw[p.id]; if (!Number.isFinite(v)) v = lo; v = U.clamp(v, lo, hi); dl.raw[p.id] = v; partial[p.id] = v;
        const step = p.step || (p.type === 'int' ? 1 : p.type === 'pct' ? 0.005 : (hi - lo) / 100);
        const show = p.type === 'money' ? U.money(v) : p.type === 'pct' ? U.pct(v, 1) : U.num(v);
        html = `<div class="pfield"><div class="pl">${esc(p.label || p.id)} <b class="pval">${esc(show)}</b></div><input type="range" min="${lo}" max="${hi}" step="${step}" value="${v}" data-input="dlgNum:${esc(p.id)}"><div class="range-ends"><span>${esc(p.type === 'money' ? U.money(lo) : U.num(lo))}</span><span>${esc(p.type === 'money' ? U.money(hi) : U.num(hi))}</span></div></div>`;
      }
      return html;
    }).join('');
    const pv = g.previewAction(a, org, self, g.resolveParams(a, dl.raw, org, self));
    const cost = pv.cost.cash ? `<div class="pv-cost"><span>Cost now</span><b>${esc(U.money(pv.cost.cash))}</b><small>Cash after: ${esc(U.money(org.cash - pv.cost.cash))}</small></div>` : '';
    const items = pv.items.map(i => `<div class="pv-item ${i.tone ? 'tone-' + esc(i.tone) : ''}"><span>${esc(i.label)}</span><b>${esc(i.text)}</b></div>`).join('');
    const why = pv.why.length ? `<div class="pv-why">${pv.why.map(w => `<div>${D.icon('alert')} ${esc(w)}</div>`).join('')}</div>` : '';
    const right = `<div class="pv">${cost}${items ? `<div class="pv-items"><div class="pv-k">${pv.fc ? 'Forecast' : 'At a glance'}</div>${items}</div>` : ''}
      ${pv.tradeoff ? `<div class="pv-note"><b>What you give up</b><p>${esc(pv.tradeoff)}</p></div>` : ''}${pv.risk ? `<div class="pv-note risk"><b>What could go wrong</b><p>${esc(pv.risk)}</p></div>` : ''}${why}</div>`;
    return `<div class="dlg-h">${D.icon(a.icon || 'play')}<div><h2>${esc(a.label)}${self ? ` <small>· ${esc(S.entTitle(app, self))}</small>` : ''}</h2>${pv.describe ? `<p>${esc(pv.describe)}</p>` : ''}</div><button class="icon-btn" data-a="closeModal" aria-label="Close">${D.icon('close')}</button></div>
      <div class="dlg-b ${a.params && a.params.length ? '' : 'noparams'}"><div class="dlg-params">${paramHtml || '<p class="muted">No choices needed.</p>'}</div>${right}</div>
      <div class="dlg-f"><button class="btn ghost" data-a="closeModal">Cancel</button><button class="btn primary ${a.danger ? 'danger' : ''}" data-a="dlgGo" ${pv.ok ? '' : 'disabled'}>${esc(a.verb || a.label)}</button></div>`;
  }
  E.ui.handlers.dlgPick = (app, rest) => { app.ui.dialog.raw[rest[0]] = rest.slice(1).join(':'); refreshModal(app, renderAction(app)); };
  E.ui.handlers.dlgSet = (app, rest) => { const a = app.def.actions[app.ui.dialog.id]; const p = a.params.find(x => x.id === rest[0]); const o = p && p.options.find(x => String(x.value) === rest.slice(1).join(':')); app.ui.dialog.raw[rest[0]] = o ? o.value : rest[1]; refreshModal(app, renderAction(app)); };
  E.ui.inputHandlers.dlgQ = (app, rest, el) => { app.ui.dialog.q[rest[0]] = el.value; refreshModal(app, renderAction(app)); };
  E.ui.inputHandlers.dlgNum = (app, rest, el) => { app.ui.dialog.raw[rest[0]] = +el.value; clearTimeout(app._dn); app._dn = setTimeout(() => refreshModal(app, renderAction(app)), 60); };
  E.ui.inputHandlers.dlgText = (app, rest, el) => { app.ui.dialog.raw[rest[0]] = el.value; };
  E.ui.changeHandlers.dlgBool = (app, rest, el) => { app.ui.dialog.raw[rest[0]] = el.checked; refreshModal(app, renderAction(app)); };
  E.ui.handlers.dlgGo = (app) => {
    const dl = app.ui.dialog; const g = app.game;
    const r = g.act(dl.id, dl.raw, { self: dl.selfRef ? g.deref(dl.selfRef) : null });
    if (!r.ok) { app.toast(r.why.join(' · '), 'bad'); return; }
    app.coachEvent('acted:' + dl.id);
    app.closeModal();
  };

  /* ---------------- events ---------------- */
  E.ui.eventModal = (app, iid) => {
    const g = app.game, ev = g.state.events.pending.find(p => p.iid === iid);
    if (!ev) return;
    app.ui.dialog = { type: 'event', iid, locked: ev.priority === 'critical' };
    const binds = Object.values(ev.bind || {}).map(r => g.deref(r)).filter(x => x && (x.__ent || x.__org));
    const ctx = binds.length ? `<div class="ev-ctx">${binds.slice(0, 3).map(b => `<button class="chip" data-a="inspect:${esc(S.entRef(b))}">${esc(S.entTitle(app, b))}</button>`).join('')}</div>` : '';
    const html = `<div class="event ${esc(ev.tone)} pri-${esc(ev.priority)}"><div class="ev-k">${esc(ev.priority === 'critical' ? 'Decision required' : 'Decision')} · ${esc(g.cal.longLabel(ev.t))}</div><h2>${esc(ev.title)}</h2>${ev.text ? `<p class="ev-text">${esc(ev.text)}</p>` : ''}${ctx}
      <div class="ev-choices">${ev.choices.map(c => `<button class="ev-choice" data-a="evChoose:${esc(iid)}:${c.i}" ${c.enabled ? '' : 'disabled'}><b>${esc(c.label)}</b>${c.describe ? `<small>${esc(c.describe)}</small>` : ''}${(c.preview || []).map(p => `<em>${esc(p.label)}: ${esc(p.text)}</em>`).join('')}</button>`).join('')}</div>
      ${ev.priority !== 'critical' ? `<div class="dlg-f"><button class="btn ghost" data-a="evLater:${esc(iid)}">Decide later (auto-resolves in ${U.plural(Math.max(0, ev.expires - g.state.tick), g.cal.unitLabel)})</button></div>` : ''}</div>`;
    app.openModal(html, 'event-modal');
  };
  E.ui.handlers.evChoose = (app, rest) => { const r = app.game.resolveEvent(rest[0], +rest[1]); if (r.ok) { app.ui.pendingToast = { text: r.result, tone: 'good' }; app.coachEvent('event'); } app.closeModal(); };
  E.ui.handlers.evLater = (app, rest) => { app.ui.deferred = app.ui.deferred || {}; app.ui.deferred[rest[0]] = true; app.closeModal(); };

  /* ---------------- negotiations ---------------- */
  E.ui.negotiationModal = (app, nid, last) => {
    const g = app.game, n = g.state.negotiations[nid];
    if (!n) { app.closeModal(); return; }
    const nd = app.def.negotiations[n.def];
    app.ui.dialog = { type: 'neg', nid, terms: Object.assign({}, n.status === 'countered' ? n.counter : n.terms) };
    renderNeg(app, last);
  };
  function renderNeg(app, last) {
    const g = app.game, dl = app.ui.dialog, n = g.state.negotiations[dl.nid];
    if (!n) return;
    const nd = app.def.negotiations[n.def];
    const sc = g.negScope(n);
    const terms = nd.terms.map(t => {
      const v = dl.terms[t.id];
      if (t.type === 'choice') return `<div class="pfield"><div class="pl">${esc(t.label)}</div><div class="seg">${t.options.map(o => `<button class="${o.value === v ? 'on' : ''}" data-a="negSet:${esc(t.id)}:${esc(o.value)}">${esc(o.label)}</button>`).join('')}</div></div>`;
      const lo = t.min != null ? g.num(t.min, sc, 0) : 0, hi = t.max != null ? g.num(t.max, sc, Math.max(1, v * 3)) : Math.max(1, v * 3);
      const step = t.step || (t.type === 'int' ? 1 : t.type === 'pct' ? 0.005 : Math.max(1, (hi - lo) / 200));
      const show = t.type === 'money' ? U.money(v) : t.type === 'pct' ? U.pct(v, 1) : U.num(v);
      return `<div class="pfield"><div class="pl">${esc(t.label)} <b class="pval">${esc(show)}</b></div><input type="range" min="${lo}" max="${hi}" step="${step}" value="${v}" data-input="negNum:${esc(t.id)}"></div>`;
    }).join('');
    const hist = n.history.slice(-6).map(h => `<li class="${h.by}">${h.by === 'you' ? 'You offered' : h.reject ? 'They rejected' : 'They countered'} ${h.terms ? esc(Object.entries(h.terms).map(([k, v]) => { const t = nd.terms.find(x => x.id === k); return t ? `${t.label} ${t.type === 'money' ? U.money(v) : t.type === 'pct' ? U.pct(v, 1) : U.num(v)}` : ''; }).filter(Boolean).join(', ')) : ''}${h.reason ? ` — “${esc(h.reason)}”` : ''}</li>`).join('');
    const rel = sc.relationship;
    const html = `<div class="dlg-h">${D.icon('handshake')}<div><h2>${esc(n.label)}: ${esc(n.withName)}</h2><p>Patience left: ${'●'.repeat(Math.max(0, n.patience + 1))}${'○'.repeat(Math.max(0, (nd.patience || 3) - n.patience))} · Relationship ${rel > 0 ? '+' : ''}${Math.round(rel)}</p></div><button class="icon-btn" data-a="closeModal">${D.icon('close')}</button></div>
      <div class="dlg-b"><div class="dlg-params">${terms}${last ? `<div class="neg-last tone-${last.status === 'accepted' ? 'good' : last.status === 'countered' ? 'warn' : 'bad'}"><b>${esc(last.status === 'countered' ? 'They countered' : last.status === 'accepted' ? 'Deal!' : last.status === 'failed' ? 'Talks collapsed' : 'Rejected')}</b>${(last.reasons || []).map(r => `<div>${esc(r)}</div>`).join('')}</div>` : ''}</div>
      <div class="pv"><div class="pv-k">History</div><ul class="neg-hist">${hist || '<li>No offers yet.</li>'}</ul>${n.status === 'countered' ? `<div class="pv-note"><b>Their counter-offer is on the table</b><p>Accept it, or adjust the terms and offer again.</p></div>` : ''}</div></div>
      <div class="dlg-f"><button class="btn ghost danger" data-a="negWalk">Walk away</button>${n.status === 'countered' ? '<button class="btn" data-a="negAccept">Accept counter</button>' : ''}<button class="btn primary" data-a="negOffer">Make offer</button></div>`;
    app.ui.dialogCls = 'neg-modal';
    refreshModal(app, html);
  }
  E.ui.inputHandlers.negNum = (app, rest, el) => { app.ui.dialog.terms[rest[0]] = +el.value; clearTimeout(app._ng); app._ng = setTimeout(() => renderNeg(app), 60); };
  E.ui.handlers.negSet = (app, rest) => { const n = app.game.state.negotiations[app.ui.dialog.nid]; const nd = app.def.negotiations[n.def]; const t = nd.terms.find(x => x.id === rest[0]); const o = t.options.find(x => String(x.value) === rest.slice(1).join(':')); app.ui.dialog.terms[rest[0]] = o.value; renderNeg(app); };
  E.ui.handlers.negOffer = (app) => {
    const r = app.game.offer(app.ui.dialog.nid, app.ui.dialog.terms);
    if (r.status === 'accepted' || r.status === 'failed') { app.ui.pendingToast = { text: r.status === 'accepted' ? 'Deal agreed!' : 'Talks collapsed', tone: r.status === 'accepted' ? 'good' : 'bad' }; app.closeModal(); return; }
    if (r.status === 'countered') app.ui.dialog.terms = Object.assign({}, r.counter);
    renderNeg(app, r);
  };
  E.ui.handlers.negAccept = (app) => { const r = app.game.acceptCounter(app.ui.dialog.nid); app.ui.pendingToast = { text: r.ok ? 'Deal agreed!' : 'Could not accept', tone: r.ok ? 'good' : 'bad' }; app.closeModal(); };
  E.ui.handlers.negWalk = (app) => { app.game.walkAway(app.ui.dialog.nid); app.ui.pendingToast = { text: 'You walked away', tone: 'info' }; app.closeModal(); };
  E.ui.handlers.startNegotiation = (app) => { const n = Object.values(app.game.state.negotiations).find(x => x.org === app.game.state.player); if (n) E.ui.negotiationModal(app, n.id); };

  /* ---------------- rescue / projects / annual ---------------- */
  E.ui.rescueModal = (app) => {
    const g = app.game, f = app.def.progression.failure; if (!f) return;
    const opts = g.rescueOptions();
    const left = (f.grace || 8) - g.state.progression.distress;
    app.ui.dialog = { type: 'rescue', locked: false };
    app.openModal(`<div class="event bad"><div class="ev-k">Crisis · ${U.plural(Math.max(0, left), g.cal.unitLabel)} to act</div><h2>${esc(f.warningTitle || 'Crisis')}</h2><p class="ev-text">${esc(g.tpl(f.warning || '', g.scope()))}</p>
      <div class="ev-choices">${opts.map(o => `<button class="ev-choice" data-a="rescueGo:${o.i}" ${o.enabled ? '' : 'disabled'}><b>${esc(o.label)}</b><small>${esc(o.describe)}</small></button>`).join('')}</div>
      <div class="dlg-f"><button class="btn ghost" data-a="closeModal">Not yet — I'll fix it myself</button></div></div>`, 'event-modal');
  };
  E.ui.handlers.rescueGo = (app, rest) => { const r = app.game.chooseRescue(+rest[0]); app.ui.pendingToast = { text: r.ok ? 'Rescue plan in motion' : 'Not possible', tone: r.ok ? 'good' : 'bad' }; app.closeModal(); };
  E.ui.projectGateModal = (app, iid) => {
    const g = app.game, p = g.state.projects[iid]; if (!p || !p.waiting) return;
    app.openModal(`<div class="event"><div class="ev-k">Project decision</div><h2>${esc(p.name)}</h2><p class="ev-text">${esc(p.waiting.label)}${p.waiting.describe ? ' — ' + esc(p.waiting.describe) : ''}</p><div class="ev-choices">${p.waiting.options.map((o, i) => `<button class="ev-choice" data-a="gateGo:${esc(iid)}:${i}"><b>${esc(o.label)}</b></button>`).join('')}</div></div>`, 'event-modal');
  };
  E.ui.handlers.gateGo = (app, rest) => { app.game.continueProject(rest[0], +rest[1]); app.closeModal(); };
  E.ui.annualModal = (app, r) => {
    const g = app.game;
    const ch = r.valueChange;
    app.openModal(`<div class="annual"><div class="ev-k">Annual review</div><h2>${r.year}: ${esc(ch == null ? 'The first year' : ch > 0.15 ? 'A breakout year' : ch > 0 ? 'Steady progress' : ch > -0.15 ? 'A difficult year' : 'A year to forget')}</h2>
      <div class="kv-grid"><div><span>Revenue</span><b>${esc(U.money(r.revenue))}</b></div><div><span>Operating profit</span><b class="${r.profit < 0 ? 'neg' : 'pos'}">${esc(U.money(r.profit))}</b></div><div><span>Company value</span><b>${esc(U.money(r.value))}</b>${ch != null ? `<small class="${ch >= 0 ? 'pos' : 'neg'}">${esc(U.signedPct(ch))}</small>` : ''}</div><div><span>Industry rank</span><b>#${r.rank} of ${r.of}</b></div></div>
      ${r.objectives && r.objectives.length ? `<div class="pv-k">Board objectives</div><ul class="obj-list">${r.objectives.map(o => `<li class="${o.success ? 'pos' : 'neg'}">${D.icon(o.success ? 'check' : 'close')} ${esc(o.text)}</li>`).join('')}</ul>` : ''}
      ${r.highlights.length ? `<div class="pv-k">Headlines</div><ul class="feed">${r.highlights.map(h => `<li><span class="ft">${esc(h)}</span></li>`).join('')}</ul>` : ''}
      <button class="btn primary lg" data-a="closeModal" autofocus>On to ${r.year + 1}</button></div>`, 'annual-modal');
  };

  /* ---------------- explanations ---------------- */
  E.ui.explainModal = (app, arg) => {
    const [kind, ...rest] = arg.split(':');
    const x = app.game.explain(kind, rest.join(':'));
    if (!x) { app.toast('No breakdown available for this number.', 'info'); return; }
    const items = (x.drivers || []).map(d => ({ label: d.label, value: d.value }));
    const fmt = kind === 'entity' ? (v) => U.num(v) : (v) => U.signed(v, (n) => U.num(n, 1));
    app.openModal(`<div class="explain"><div class="dlg-h">${D.icon('help')}<div><h2>Why? — ${esc(x.title)}</h2>${x.describe ? `<p>${esc(x.describe)}</p>` : ''}</div><button class="icon-btn" data-a="closeModal">${D.icon('close')}</button></div>
      ${x.value != null ? `<div class="kv-grid"><div><span>Now</span><b>${esc(U.num(x.value, 0))}</b></div>${x.target != null ? `<div><span>Heading toward</span><b>${esc(U.num(x.target, 0))}</b></div>` : ''}${x.base != null ? `<div><span>Baseline</span><b>${esc(U.num(x.base, 0))}</b></div>` : ''}</div>` : ''}
      <div class="pv-k">What drives it</div>${D.bars(items, { fmt })}<p class="hint">Positive drivers push the value up; negative ones pull it down. Values move gradually toward their target.</p></div>`, 'explain-modal');
  };

  /* ---------------- inspector ---------------- */
  E.ui.renderInspector = (app) => {
    const g = app.game, x = g.deref(app.ui.inspector);
    if (!x) return '';
    const p = g.state.player;
    if (x.__org) return orgInspector(app, x);
    const kd = app.def.kinds[x.kind];
    const sc = g.scope({ self: x, org: g.state.orgs[x.owner] || g.playerOrg() });
    const owner = x.owner != null ? g.state.orgs[x.owner] : null;
    const stats = ((kd.display && kd.display.stats) || []).concat(kd.inspector && kd.inspector.stats || []).map(s => `<div><span>${esc(s.label)}</span><b>${esc(U.format(g.ev(s.expr, sc), s.format))}${s.suffix ? esc(s.suffix) : ''}</b></div>`).join('');
    const opStats = kd.operate ? `<div><span>Demand / ${esc(g.cal.unitLabel)}</span><b>${esc(U.int(x._demand))}</b></div><div><span>Sold</span><b>${esc(U.int(x._sold))}</b></div><div><span>Capacity</span><b>${esc(U.int(x._cap))}</b></div><div><span>Utilization</span><b>${esc(U.pct(x._load))}</b></div><div><span>Revenue</span><b>${esc(U.money(x._rev))}</b></div><div><span>Profit</span><b class="${x._profit < 0 ? 'neg' : 'pos'}">${esc(U.money(x._profit))}</b></div>` : '';
    const segs = x._seg ? `<div class="pv-k">Customers by segment</div>${D.bars(Object.entries(x._seg).map(([k, v]) => ({ label: ((app.def.markets[kd.operate.market] || {}).segments || []).find(s => s.id === k)?.label || k, value: v })), { fmt: U.int })}` : '';
    const hist = x._hp && x._hp.length > 2 ? `<div class="pv-k">Profit trend</div>${D.sparkline(x._hp, 300, 44)}` : '';
    const fields = Object.entries(kd.fields).filter(([f, fd]) => fd.show !== false && !fd.hidden && !['key'].includes(f) && x[f] != null && x[f] !== '' && typeof x[f] !== 'object').slice(0, 10).map(([f, fd]) => {
      let v = g.env.member(x, f);
      const txt = v && typeof v === 'object' ? S.entTitle(app, v) : U.format(v, fd.type === 'money' ? 'money' : fd.type === 'pct' ? 'pct' : fd.type === 'bool' ? 'bool' : undefined);
      return `<tr><td>${esc(fd.label)}</td><td class="r">${v && typeof v === 'object' ? `<button class="link" data-a="inspect:${esc(S.entRef(v))}">${esc(txt)}</button>` : esc(txt)}</td></tr>`;
    }).join('');
    const hidden = Object.entries(kd.fields).filter(([, fd]) => fd.hidden).map(([f, fd]) => { const est = g.estimate(x, f); return `<tr><td>${esc(fd.label)} <small class="muted">(estimate)</small></td><td class="r">${esc(U.num(est.lo, 0))}–${esc(U.num(est.hi, 0))}</td></tr>`; }).join('');
    // related entities: other kinds with a ref field pointing here
    const rel = [];
    for (const k of app.def.kindOrder) {
      const k2 = app.def.kinds[k];
      for (const [f, fd] of Object.entries(k2.fields)) if (fd.type === 'ref' && fd.ref === x.kind && !k2.records) {
        const list = g.refs(k, f, x.id).filter(e => !e.owner || e.owner === p || !kd.records);
        if (list.length) rel.push(`<div class="pv-k">${esc(k2.plural)} (${list.length})</div><div class="rel">${list.slice(0, 12).map(e => `<button class="chip ${e.owner === p ? 'mine' : ''}" data-a="inspect:${esc(S.entRef(e))}">${esc(S.entTitle(app, e))}</button>`).join('')}${list.length > 12 ? `<span class="muted">+${list.length - 12}</span>` : ''}</div>`);
      }
    }
    const acts = x.owner === p || (!x.owner && kd.records) ? g.listActions(x).map(a => `<button class="btn ${a.danger ? 'danger ghost' : ''}" data-a="act:${esc(a.id)}:${esc(S.entRef(x))}">${D.icon(a.icon || 'play')}<span>${esc(a.label)}</span></button>`).join('') : '';
    const why = kd.explain ? `<button class="btn sm ghost" data-a="explain:entity:${esc(S.entRef(x))}">${D.icon('help')} Why?</button>` : '';
    const glyph = kd.display && kd.display.glyph ? g.ev(kd.display.glyph, sc) : null;
    return `<aside class="inspector" aria-label="Details"><div class="insp-h">${glyph ? `<div class="insp-art">${D.glyph(glyph, null, 0.45)}</div>` : ''}<div><div class="insp-k">${esc(kd.label)}${owner ? ` · ${esc(owner.name)}` : ''}</div><h2>${esc(S.entTitle(app, x))}</h2><p>${esc(S.entSub(app, x))}</p></div><button class="icon-btn" data-a="closeInspector">${D.icon('close')}</button></div>
      <div class="insp-b"><div class="kv-grid">${stats}${opStats}</div>${why}${segs}${hist}${fields || hidden ? `<table class="tbl compact">${fields}${hidden}</table>` : ''}${rel.join('')}</div>
      ${acts ? `<div class="insp-f">${acts}</div>` : ''}</aside>`;
  };
  function orgInspector(app, o) {
    const g = app.game, p = g.playerOrg();
    const ar = g.archetypeOf(o);
    const ms = app.def.orgMetrics.filter(m => m.format !== 'text').slice(0, 10).map(m => `<div><span>${esc(m.label)}</span><b>${esc(U.format(o.m[m.id], m.format))}</b></div>`).join('');
    const riv = g.memory(o, p, 'rivalry'), rel = g.memory(o, p, 'relationship');
    const acts = Object.values(app.def.actions).filter(a => a.scope === 'global' && (a.params || []).some(x => x.type === 'org') && g.actionVisible(a, p, null) && !o.isPlayer).map(a => `<button class="btn" data-a="act:${esc(a.id)}">${D.icon(a.icon || 'play')}<span>${esc(a.label)}</span></button>`).join('');
    const news = g.state.news.filter(n => n.org === o.id || (n.refs || []).includes('org:' + o.id)).slice(0, 6).map(n => `<li><span class="fd">${esc(g.cal.shortLabel(n.t))}</span><span class="ft">${esc(n.text)}</span></li>`).join('');
    return `<aside class="inspector"><div class="insp-h"><div><div class="insp-k">${esc(app.def.orgs.label)}${o.isPlayer ? ' · You' : ''}</div><h2>${o.color ? `<i class="dot" style="background:${esc(o.color)}"></i>` : ''}${esc(o.name)}</h2><p>${esc(ar ? ar.label : o.isPlayer ? 'Your company' : '')}${o.alive ? '' : ' · defunct'}</p></div><button class="icon-btn" data-a="closeInspector">${D.icon('close')}</button></div>
      <div class="insp-b"><div class="kv-grid"><div><span>Value</span><b>${esc(U.money(o.m.value))}</b></div><div><span>Revenue (yr)</span><b>${esc(U.money(o.m.revenueYear))}</b></div><div><span>Profit (yr)</span><b class="${o.m.profitYear < 0 ? 'neg' : 'pos'}">${esc(U.money(o.m.profitYear))}</b></div><div><span>Cash</span><b>${esc(U.money(o.cash))}</b></div>${ms}</div>
      ${!o.isPlayer ? `<div class="pv-k">Toward you</div><div class="kv-grid"><div><span>Rivalry</span><b>${Math.round(riv)}</b></div><div><span>Relationship</span><b>${Math.round(rel)}</b></div></div>` : ''}
      ${news ? `<div class="pv-k">In the news</div><ul class="feed">${news}</ul>` : ''}</div>${acts ? `<div class="insp-f">${acts}</div>` : ''}</aside>`;
  }

  /* ---------------- command palette ---------------- */
  E.ui.palette = (app) => {
    app.ui.dialog = { type: 'palette', q: '' };
    app.openModal(renderPalette(app), 'palette-modal');
    setTimeout(() => { const i = D.$('.palette input', app.root); if (i) i.focus(); }, 20);
  };
  function renderPalette(app) {
    const g = app.game, q = (app.ui.dialog.q || '').toLowerCase().trim();
    const res = [];
    for (const n of app.navItems()) if (!q || n.label.toLowerCase().includes(q)) res.push({ a: 'nav:' + n.id, t: n.label, s: 'Go to', ic: n.icon });
    for (const a of g.listActions(null)) if (!q || a.label.toLowerCase().includes(q)) res.push({ a: 'act:' + a.id, t: a.label, s: 'Action', ic: a.icon });
    if (q.length >= 2) {
      for (const k of app.def.kindOrder) for (const e of g.all(k)) { if (res.length > 60) break; const t = S.entTitle(app, e); if ((t + ' ' + e.name + ' ' + (e.code || '')).toLowerCase().includes(q)) res.push({ a: 'inspect:' + S.entRef(e), t, s: app.def.kinds[k].label + (e.owner === g.state.player ? ' · yours' : ''), ic: 'search' }); }
      for (const o of g.liveOrgs()) if (o.name.toLowerCase().includes(q)) res.push({ a: 'inspect:org:' + o.id, t: o.name, s: app.def.orgs.label, ic: 'building' });
    }
    return `<div class="palette"><input type="search" placeholder="Search screens, actions, ${esc(app.def.orgs.plural.toLowerCase())}, anything…" value="${esc(app.ui.dialog.q)}" data-input="palQ"><div class="pal-list">${res.slice(0, 40).map((r, i) => `<button class="pal-row ${i === 0 ? 'on' : ''}" data-a="palGo:${esc(r.a)}">${D.icon(r.ic || 'play')}<b>${esc(r.t)}</b><small>${esc(r.s)}</small></button>`).join('') || '<div class="empty">No matches.</div>'}</div></div>`;
  }
  E.ui.inputHandlers.palQ = (app, rest, el) => { app.ui.dialog.q = el.value; refreshModal(app, renderPalette(app)); };
  E.ui.handlers.palGo = (app, rest) => { const a = rest.join(':'); app.ui.modal = null; app.ui.dialog = null; app.handle(a); if (!app.ui.modal) app.rerender(); };

  /* ---------------- help ---------------- */
  E.ui.helpModal = (app) => {
    const g = app.gdl, m = app.def.meta;
    const gl = (g.glossary || []).map(x => `<dt>${esc(x.term)}</dt><dd>${esc(x.text)}</dd>`).join('');
    app.openModal(`<div class="help"><div class="dlg-h">${D.icon('help')}<div><h2>How to play ${esc(m.title)}</h2><p>${esc(m.role ? 'You are the ' + m.role + '.' : '')}</p></div><button class="icon-btn" data-a="closeModal">${D.icon('close')}</button></div>
      ${m.howToPlay ? `<div class="prose">${esc(m.howToPlay).replace(/\n/g, '<br>')}</div>` : ''}
      ${(m.fantasy || []).length ? `<div class="pv-k">Things you can do</div><ul class="intro-list">${m.fantasy.map(f => `<li>${D.icon('star')}<div>${esc(f)}</div></li>`).join('')}</ul>` : ''}
      <div class="pv-k">Keys</div><table class="tbl compact"><tr><td>Space</td><td>Advance one ${esc(app.game ? app.game.cal.unitLabel : 'turn')}</td></tr><tr><td>Shift + Space</td><td>Advance until something needs you</td></tr><tr><td>M</td><td>Advance a month</td></tr><tr><td>1–7</td><td>Switch screens</td></tr><tr><td>Ctrl/Cmd + K</td><td>Search anything</td></tr><tr><td>H</td><td>Home</td></tr><tr><td>Esc</td><td>Close</td></tr></table>
      ${gl ? `<div class="pv-k">Glossary</div><dl class="glossary">${gl}</dl>` : ''}
      <div class="dlg-f"><button class="btn" data-a="replayIntro">Replay the tutorial</button><button class="btn primary" data-a="closeModal">Close</button></div></div>`, 'help-modal');
  };
  E.ui.handlers.replayIntro = (app) => { app.prefs.coachStep = 0; app.prefs.coachHidden = false; app.savePrefs(); app.ui.modal = null; app.showIntro(); };

  /* ---------------- title: saves list ---------------- */
  E.ui.titleSaves = async (app) => {
    const saves = await app.store.list();
    const rows = saves.map(s => `<button class="pick" data-a="loadslot:${esc(s.slot)}"><b>${esc(s.name)}${s.auto ? ' <small>(autosave)</small>' : ''}</b><small>${esc(s.meta ? `${s.meta.company} · ${s.meta.date} · ${U.money(s.meta.cash)} cash` : '')} · saved ${esc(new Date(s.updated).toLocaleString())}</small></button>`).join('');
    app.root.innerHTML = `<div class="setup-screen motif-bg"><div class="setup-card"><div class="setup-head"><button class="btn ghost sm" data-a="title">${D.icon('close')} Back</button><h2>Load a game</h2></div><div class="picks">${rows || '<div class="empty">No saves yet.</div>'}</div></div></div>`;
  };
  E.ui.changeHandlers.importTitle = async (app, rest, el) => {
    try { const obj = await E.persist.importFile(el.files[0]); const slot = 'import-' + Date.now().toString(36); await app.store.put({ slot, name: obj.name || 'Imported game', meta: obj.meta, data: obj.data }); await app.loadSlot(slot); }
    catch (e) { alert('Import failed: ' + e.message); }
  };
})(globalThis.LGE = globalThis.LGE || {});
