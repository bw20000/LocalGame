/* Local Game Studio engine — UI application shell.
   Title → one-screen setup → game shell with ≤7 task-based destinations, time controls with
   auto-pause, needs-you queue, command palette, toasts, moments, coach-mark onboarding,
   autosave. Screens are composed from GDL ui.screens sections (see sections.js). */
(function (E) {
  'use strict';
  const U = E.util, D = E.dom;
  const esc = U.esc;

  class App {
    constructor(root, gdl, opts = {}) {
      this.root = root; this.gdl = gdl; this.opts = opts;
      this.def = E.normalizeDef(gdl);
      this.gameId = (gdl.meta && gdl.meta.id) || U.slug(gdl.meta && gdl.meta.title);
      this.store = new E.persist.Store(this.gameId);
      this.route = { screen: 'home', tab: null, params: {} };
      this.ui = { tablePage: {}, search: {}, collapsed: {}, inspector: null, modal: null, busy: false };
      this.prefs = this.loadPrefs();
      E.ui.applyTheme(gdl.theme || {}, this.prefs);
      if (gdl.currency) U.setCurrency(gdl.currency);
    }
    loadPrefs() { try { return JSON.parse(localStorage.getItem('lgs-prefs-' + this.gameId) || '{}'); } catch (e) { return {}; } }
    savePrefs() { try { localStorage.setItem('lgs-prefs-' + this.gameId, JSON.stringify(this.prefs)); } catch (e) { /* private mode */ } }

    /* ---------------- boot / title / setup ---------------- */
    async boot() {
      this.root.addEventListener('click', (e) => this.onClick(e));
      this.root.addEventListener('change', (e) => this.onChange(e));
      this.root.addEventListener('input', (e) => this.onInput(e));
      document.addEventListener('keydown', (e) => this.onKey(e));
      if (this.opts.autostart) { this.startNew(this.opts.autostart); return; }
      await this.showTitle();
    }
    async showTitle() {
      this.game = null;
      let saves = [];
      try { saves = await this.store.list(); } catch (e) { saves = []; }
      const m = this.def.meta, last = saves[0];
      const disc = m.disclaimer ? `<p class="disclaimer">${esc(m.disclaimer)}</p>` : '';
      this.root.innerHTML = `<div class="title-screen motif-bg">
        <div class="title-card">
          <div class="title-mark">${E.ui.logo(this.gdl)}</div>
          <h1 class="title-name">${esc(m.title)}</h1>
          ${m.tagline ? `<p class="title-tag">${esc(m.tagline)}</p>` : ''}
          <div class="title-buttons">
            ${last ? `<button class="btn primary lg" data-a="loadslot:${esc(last.slot)}">${D.icon('play')} Continue — ${esc(last.meta && last.meta.company || last.name)} · ${esc(last.meta && last.meta.date || '')}</button>` : ''}
            <button class="btn ${last ? '' : 'primary'} lg" data-a="setup">${D.icon('plus')} New game</button>
            ${saves.length ? `<button class="btn ghost" data-a="titleSaves">${D.icon('save')} Load a saved game</button>` : ''}
            <label class="btn ghost">${D.icon('upload')} Import save<input type="file" accept=".gz,.json" data-change="importTitle" hidden></label>
          </div>
          ${disc}
        </div></div>`;
    }
    showSetup() {
      const ng = this.gdl.newGame || {}, m = this.def.meta;
      const opts = (ng.options || []);
      this.setup = this.setup || {};
      for (const o of opts) if (this.setup[o.id] == null) this.setup[o.id] = o.default;
      const field = (o) => {
        if (o.type === 'text') return `<label class="field"><span>${esc(o.label)}</span><input type="text" value="${esc(this.setup[o.id] || '')}" data-setup="${esc(o.id)}" maxlength="40"></label>`;
        const ch = o.choices || [];
        if (ch.length > 4) return `<div class="field"><span>${esc(o.label)}</span><div class="choice-grid">${ch.map(c => `<button class="choice ${this.setup[o.id] === c.value ? 'on' : ''}" data-a="setupPick:${esc(o.id)}:${esc(c.value)}"><b>${esc(c.label)}</b>${c.describe ? `<small>${esc(c.describe)}</small>` : ''}</button>`).join('')}</div></div>`;
        return `<div class="field"><span>${esc(o.label)}</span><div class="seg">${ch.map(c => `<button class="${this.setup[o.id] === c.value ? 'on' : ''}" data-a="setupPick:${esc(o.id)}:${esc(c.value)}" title="${esc(c.describe || '')}">${esc(c.label)}</button>`).join('')}</div></div>`;
      };
      const scen = (ng.scenarios || []).length ? `<div class="field"><span>Scenario (optional)</span><div class="choice-grid">${[{ id: '', label: 'Standard start', describe: 'The intended experience' }].concat(ng.scenarios).map(s => `<button class="choice ${(this.setup.scenario || '') === s.id ? 'on' : ''}" data-a="setupPick:scenario:${esc(s.id)}"><b>${esc(s.label)}</b><small>${esc(s.describe || '')}</small></button>`).join('')}</div></div>` : '';
      this.root.innerHTML = `<div class="setup-screen motif-bg"><div class="setup-card">
        <div class="setup-head"><button class="btn ghost sm" data-a="title">${D.icon('close')} Back</button><h2>New game</h2></div>
        <p class="lead">${esc(m.role ? `You are the ${m.role}.` : '')} ${esc(m.pitch || m.tagline || '')}</p>
        ${opts.map(field).join('')}${scen}
        <details class="advanced"><summary>Advanced</summary>
          <label class="field"><span>World seed</span><input type="text" data-setup="seed" value="${esc(this.setup.seed || '')}" placeholder="random"></label>
          <label class="check"><input type="checkbox" data-setup-check="sandbox" ${this.setup.sandbox ? 'checked' : ''}> Sandbox: commissioner tools from day one, no game over</label>
        </details>
        <div class="setup-foot"><button class="btn primary lg" data-a="startNew">${D.icon('play')} Start</button></div>
      </div></div>`;
    }
    startNew(options) {
      const o = Object.assign({}, this.setup || {}, options || {});
      const seed = o.seed || String(Math.floor(Math.random() * 1e9));
      if (o.sandbox) { o.noBankruptcy = true; o.commissioner = true; }
      this.root.innerHTML = `<div class="loading motif-bg"><div class="spinner"></div><p>Building the world…</p></div>`;
      setTimeout(() => {
        try {
          this.game = E.Game.create(this.gdl, { seed, options: Object.assign({ difficulty: o.difficulty }, o) });
        } catch (e) { this.fatal(e); return; }
        this.slot = 'game-' + Date.now().toString(36);
        this.onboardingStart = true;
        this.attachGame();
        this.render();
        this.showIntro();
      }, 30);
    }
    attachGame() {
      const g = this.game;
      g.on('moment', (m) => { if (!this.ui.advancing) this.queueMoment(m); else (this.momentQueue = this.momentQueue || []).push(m); });
      g.on('acted', (d) => this.consequence(d));
      g.on('annual', (r) => { (this.annualQueue = this.annualQueue || []).push(r); });
      this.momentQueue = []; this.annualQueue = [];
      if (this.game.state.options && this.game.state.options.commissioner) this.prefs.commissioner = true;
    }
    fatal(e) {
      console.error(e);
      this.root.innerHTML = `<div class="fatal"><h2>Something went wrong</h2><pre>${esc(e && e.stack || e)}</pre><button class="btn" data-a="title">Back to title</button></div>`;
    }

    /* ---------------- shell ---------------- */
    navItems() {
      const nav = (this.gdl.ui && this.gdl.ui.nav) || E.ui.defaultNav(this);
      return nav.filter(n => !n.when || this.game.ev(n.when, this.game.scope(), true));
    }
    render() {
      if (!this.game) return;
      const g = this.game, st = g.state, p = g.playerOrg();
      const layout = (this.gdl.theme && this.gdl.theme.layout) || 'sidebar';
      const nav = this.navItems();
      const needs = g.needs();
      const topMetrics = (this.gdl.ui && this.gdl.ui.topbar) || [{ label: 'Cash', expr: 'player.cash', format: 'money' }, { label: 'Profit / ' + g.cal.unitLabel, expr: 'player.m.profit', format: 'signedMoney' }];
      const tm = topMetrics.map((m, i) => {
        const v = g.ev(m.expr, g.scope());
        const tone = typeof v === 'number' && m.format && m.format.startsWith('signed') ? (v >= 0 ? 'good' : 'bad') : (m.label === 'Cash' && v < 0 ? 'bad' : '');
        return `<div class="tb-metric ${tone}" ${m.explain ? `data-a="explain:${esc(m.explain)}"` : ''}><span>${esc(m.label)}</span><b data-tween="top${i}" data-value="${+v}" data-fmt="${esc(m.format || 'num')}">${esc(U.format(v, m.format))}</b></div>`;
      }).join('');
      const navHtml = nav.map((n, i) => `<button class="nav-item ${this.route.screen === n.id ? 'on' : ''}" data-a="nav:${esc(n.id)}" data-tour="nav:${esc(n.id)}" title="${esc(n.label)} (${i + 1})">${D.icon(n.icon || 'layers')}<span>${esc(n.label)}</span>${n.badge ? E.ui.badge(this, n.badge) : ''}</button>`).join('');
      const util = `<button class="nav-item util ${this.route.screen === 'history' ? 'on' : ''}" data-a="nav:history" title="History">${D.icon('history')}<span>History</span></button>
        ${this.prefs.commissioner ? `<button class="nav-item util ${this.route.screen === 'commissioner' ? 'on' : ''}" data-a="nav:commissioner" title="Commissioner">${D.icon('gavel')}<span>Commissioner</span></button>` : ''}
        <button class="nav-item util ${this.route.screen === 'saves' ? 'on' : ''}" data-a="nav:saves" title="Saves & settings">${D.icon('save')}<span>Saves & settings</span></button>
        <button class="nav-item util" data-a="help" title="Help">${D.icon('help')}<span>Help</span></button>`;
      const over = st.progression.over;
      const tick = g.cal;
      const timeCtl = over && !st.progression.continueAfterEnd ? `<button class="btn" data-a="continueAfterEnd">Keep playing</button>` : `
        <button class="btn primary time-btn" data-a="advance:1" data-tour="advance" title="Space">${D.icon('play')}<span>Next ${esc(tick.unitLabel)}</span></button>
        <button class="btn time-btn" data-a="advance:${Math.max(2, Math.round(tick.ticksPerMonth))}" title="M">${D.icon('ff')}<span>Month</span></button>
        <button class="btn ghost time-btn" data-a="advanceEvent" title="Shift+Space — run until something needs you">${D.icon('bolt')}<span>Until event</span></button>`;
      const screen = E.ui.renderScreen(this);
      this.root.innerHTML = `<div class="app layout-${esc(layout)} ${this.prefs.density === 'compact' ? 'compact' : ''}">
        <header class="topbar">
          <div class="brand" data-a="nav:home">${E.ui.logo(this.gdl, true)}<div class="brand-txt"><b>${esc(p.name)}</b><small>${esc(this.tierLabel())}</small></div></div>
          <div class="clock"><b>${esc(tick.longLabel(st.tick))}</b><small>${esc(st.world.phaseLabel ? 'Economy: ' + st.world.phaseLabel : '')}</small></div>
          <div class="time">${timeCtl}</div>
          <div class="tb-metrics">${tm}</div>
          <div class="tb-tools">
            <button class="icon-btn" data-a="palette" title="Search (Ctrl/Cmd+K)">${D.icon('search')}</button>
            <button class="icon-btn needs-btn ${needs.length ? 'has' : ''}" data-a="nav:home" title="Needs you">${D.icon('alert')}${needs.length ? `<i>${needs.length}</i>` : ''}</button>
            <button class="icon-btn menu-btn" data-a="toggleNav" title="Menu">${D.icon('menu')}</button>
          </div>
        </header>
        <nav class="sidenav ${this.ui.navOpen ? 'open' : ''}" aria-label="Main">${navHtml}<div class="nav-sep"></div>${util}</nav>
        <main class="main" id="main">${screen}</main>
        ${this.ui.inspector ? E.ui.renderInspector(this) : ''}
        ${this.renderCoach()}
        <div class="toasts" id="toasts"></div>
      </div>${this.ui.modal ? `<div class="modal-back" data-a="modalBackdrop"><div class="modal ${esc(this.ui.modal.cls || '')}" role="dialog" aria-modal="true">${this.ui.modal.html}</div></div>` : ''}`;
      D.tween(this.root);
      if (this.ui.focusSel) { const el = D.$(this.ui.focusSel, this.root); if (el) el.focus(); this.ui.focusSel = null; }
      this.checkCoach();
    }
    tierLabel() {
      const t = this.def.progression.tiers.find(x => x.id === this.game.state.progression.tier);
      return t ? t.label : (this.def.meta.role || '');
    }
    rerender() { const sc = D.$('#main', this.root); const top = sc ? sc.scrollTop : 0; this.render(); const sc2 = D.$('#main', this.root); if (sc2) sc2.scrollTop = top; }

    /* ---------------- time ---------------- */
    async advance(n, untilEvent) {
      if (this.ui.advancing || !this.game) return;
      this.ui.advancing = true;
      const g = this.game;
      let interrupts = [];
      const maxTicks = untilEvent ? Math.max(4, Math.round(g.cal.perYear / 4)) : n;
      const t0 = g.state.tick;
      for (let i = 0; i < maxTicks; i++) {
        const r = g.tick();
        interrupts = r.interrupts || [];
        const ap = g.state.settings.autopause || {};
        const stop = interrupts.some(x => x.kind === 'event' || x.kind === 'crisis' || x.kind === 'gameover' || (x.kind === 'moment' && ap.moments !== false) || x.kind === 'annual');
        if (g.state.progression.over) break;
        if (stop) break;
        if (untilEvent && (g.state.events.pending.length || g.needs().some(x => x.pri >= 2))) break;
        if (maxTicks > 2 && i % 2 === 1) { this.rerender(); await new Promise(r => setTimeout(r, 16)); }
      }
      this.ui.advancing = false;
      this.afterAdvance(g.state.tick - t0);
    }
    afterAdvance(ticks) {
      const g = this.game;
      this.maybeAutosave(ticks);
      this.rerender();
      const digest = g.takeDigest().filter(d => d.pri !== 'background');
      if (digest.length && !this.prefs.quietDigest) this.toast(`${digest.length > 1 ? digest.length + ' updates — ' : ''}${digest[digest.length - 1].text}`, digest.some(d => d.pri === 'important' || d.pri === 'critical') ? 'warn' : 'info');
      // presentation order: moments → annual review → decisions
      if (this.momentQueue.length) { this.queueMoment(this.momentQueue.shift()); return; }
      if (this.annualQueue.length) { E.ui.annualModal(this, this.annualQueue.shift()); return; }
      const crit = g.state.events.pending.find(p => p.priority === 'critical') || (g.state.settings.autopause.important ? g.state.events.pending.find(p => p.priority === 'important') : null);
      if (crit) { E.ui.eventModal(this, crit.iid); return; }
      if (g.state.progression.rescueOpen && !this.ui.rescueShown) { this.ui.rescueShown = true; E.ui.rescueModal(this); }
    }
    async maybeAutosave(ticks) {
      const every = this.prefs.autosaveEvery != null ? this.prefs.autosaveEvery : Math.max(1, Math.round(this.game.cal.ticksPerMonth));
      if (!every) return;
      this.ui.sinceSave = (this.ui.sinceSave || 0) + ticks;
      if (this.ui.sinceSave >= every) {
        this.ui.sinceSave = 0;
        try { await E.persist.save(this.store, this.game, 'autosave', 'Autosave', true); } catch (e) { console.warn('autosave failed', e); }
      }
    }

    /* ---------------- feedback ---------------- */
    toast(text, tone = 'info', ms = 4200) {
      const box = D.$('#toasts', this.root); if (!box) return;
      const el = document.createElement('div'); el.className = 'toast ' + tone; el.innerHTML = `${D.icon(tone === 'bad' ? 'alert' : tone === 'good' ? 'check' : 'info')}<span>${esc(text)}</span>`;
      box.appendChild(el); setTimeout(() => el.classList.add('out'), ms); setTimeout(() => el.remove(), ms + 400);
    }
    consequence(d) {
      if (!d || !d.result) return;
      const dc = d.after.cash - d.before.cash;
      this.ui.pendingToast = { text: d.result + (Math.abs(dc) >= 1 ? ` (${U.signed(dc, U.money)} cash)` : ''), tone: 'good' };
    }
    queueMoment(m) {
      const toneIcon = m.tone === 'bad' ? 'alert' : 'star';
      this.openModal(`<div class="moment ${esc(m.tone)}"><div class="moment-orn">${D.icon(toneIcon)}</div><div class="moment-date">${esc(this.game.cal.longLabel(m.t))}</div><h2>${esc(m.title)}</h2>${m.text ? `<p>${esc(m.text)}</p>` : ''}${m.stat ? `<div class="moment-stat">${esc(m.stat)}</div>` : ''}<button class="btn primary lg" data-a="closeMoment" autofocus>Continue</button></div>`, 'moment-modal');
    }

    /* ---------------- modals ---------------- */
    openModal(html, cls) { this.ui.modal = { html, cls }; this.rerender(); const f = D.$('.modal [autofocus], .modal button.primary', this.root); if (f) f.focus(); }
    closeModal() {
      this.ui.modal = null; this.ui.dialog = null;
      this.rerender();
      if (this.ui.pendingToast) { this.toast(this.ui.pendingToast.text, this.ui.pendingToast.tone); this.ui.pendingToast = null; }
      // continue presentation chain
      if (this.momentQueue && this.momentQueue.length) { this.queueMoment(this.momentQueue.shift()); return; }
      if (this.annualQueue && this.annualQueue.length) { E.ui.annualModal(this, this.annualQueue.shift()); return; }
      const g = this.game; if (!g) return;
      const crit = g.state.events.pending.find(p => p.priority === 'critical' && !this.ui.deferred?.[p.iid]);
      if (crit) E.ui.eventModal(this, crit.iid);
    }

    /* ---------------- navigation & input ---------------- */
    go(screen, tab) {
      this.route = { screen, tab: tab || null, params: {} };
      this.ui.navOpen = false;
      this.render();
      const m = D.$('#main', this.root); if (m) m.scrollTop = 0;
      this.coachEvent('nav:' + screen);
    }
    onClick(e) {
      const el = e.target.closest('[data-a]');
      if (!el || !this.root.contains(el)) return;
      const a = el.getAttribute('data-a');
      if (a === 'modalBackdrop') { if (e.target === el && !(this.ui.modal && this.ui.modal.cls === 'moment-modal')) { if (this.ui.dialog && this.ui.dialog.locked) return; this.closeModal(); } return; }
      e.preventDefault();
      this.handle(a, el);
    }
    handle(a, el) {
      const [cmd, ...rest] = a.split(':');
      const arg = rest.join(':');
      const g = this.game;
      switch (cmd) {
        case 'title': this.showTitle(); return;
        case 'setup': this.setup = {}; this.showSetup(); return;
        case 'setupPick': { const [id, ...v] = rest; const val = v.join(':'); const o = ((this.gdl.newGame || {}).options || []).find(x => x.id === id); const ch = o && (o.choices || []).find(c => String(c.value) === val); this.setup[id] = ch ? ch.value : val; this.showSetup(); return; }
        case 'startNew': this.startNew(); return;
        case 'titleSaves': E.ui.titleSaves(this); return;
        case 'loadslot': this.loadSlot(arg); return;
        case 'nav': this.go(arg); return;
        case 'tab': this.route.tab = arg; this.rerender(); return;
        case 'toggleNav': this.ui.navOpen = !this.ui.navOpen; this.rerender(); return;
        case 'advance': this.advance(+arg || 1); return;
        case 'advanceEvent': this.advance(0, true); return;
        case 'continueAfterEnd': g.continueAfterEnd(); this.rerender(); return;
        case 'closeModal': this.closeModal(); return;
        case 'closeMoment': this.closeModal(); return;
        case 'act': E.ui.actionDialog(this, rest[0], rest.slice(1).join(':') || null); return;
        case 'inspect': this.ui.inspector = arg; this.rerender(); this.coachEvent('inspect'); return;
        case 'closeInspector': this.ui.inspector = null; this.rerender(); return;
        case 'event': E.ui.eventModal(this, arg); return;
        case 'need': this.openNeed(arg); return;
        case 'explain': E.ui.explainModal(this, arg); return;
        case 'negotiation': E.ui.negotiationModal(this, arg); return;
        case 'rescue': E.ui.rescueModal(this); return;
        case 'policy': { const [id, ...v] = rest; const p = this.def.policies[id]; const opt = p && p.options.find(o => String(o.value) === v.join(':')); if (opt) { g.setPolicy(id, opt.value); g.applyPolicies && null; this.toast(`${p.label}: ${opt.label}`, 'good'); this.coachEvent('policy:' + id); this.rerender(); } return; }
        case 'page': { const [key, n] = rest; this.ui.tablePage[key] = +n; this.rerender(); return; }
        case 'sort': { const [key, col] = rest; const cur = this.ui.sort && this.ui.sort[key]; this.ui.sort = this.ui.sort || {}; this.ui.sort[key] = cur && cur.col === +col ? { col: +col, desc: !cur.desc } : { col: +col, desc: true }; this.rerender(); return; }
        case 'collapse': this.ui.collapsed[arg] = !this.ui.collapsed[arg]; this.rerender(); return;
        case 'palette': E.ui.palette(this); return;
        case 'help': E.ui.helpModal(this); return;
        case 'coachNext': this.coachAdvance(true); return;
        case 'coachShow': this.coachShow(); return;
        case 'coachHide': this.prefs.coachHidden = true; this.savePrefs(); this.rerender(); return;
        case 'introStart': this.closeModal(); return;
        default:
          if (E.ui.handlers[cmd]) { E.ui.handlers[cmd](this, rest, el); return; }
          console.warn('Unknown UI action', a);
      }
    }
    openNeed(id) {
      const n = this.game.needs().find(x => x.id === id);
      if (!n) return;
      if (n.type === 'event') E.ui.eventModal(this, n.id);
      else if (n.type === 'negotiation') E.ui.negotiationModal(this, n.id);
      else if (n.type === 'project') E.ui.projectGateModal(this, n.id);
      else if (n.type === 'rescue') E.ui.rescueModal(this);
      else if (n.action) E.ui.actionDialog(this, n.action, n.ref && this.def.actions[n.action] && this.def.actions[n.action].scope === 'entity' ? n.ref : null);
      else if (n.ref) { this.ui.inspector = n.ref; this.rerender(); }
      else if (n.nav) this.go(n.nav);
    }
    onChange(e) {
      const el = e.target;
      const ch = el.getAttribute && el.getAttribute('data-change');
      if (ch) { const [cmd, ...rest] = ch.split(':'); if (E.ui.changeHandlers[cmd]) E.ui.changeHandlers[cmd](this, rest, el, e); return; }
      if (el.hasAttribute && el.hasAttribute('data-setup-check')) { this.setup[el.getAttribute('data-setup-check')] = el.checked; }
    }
    onInput(e) {
      const el = e.target;
      if (el.hasAttribute('data-setup')) { this.setup[el.getAttribute('data-setup')] = el.value; return; }
      const inp = el.getAttribute('data-input');
      if (inp) { const [cmd, ...rest] = inp.split(':'); if (E.ui.inputHandlers[cmd]) E.ui.inputHandlers[cmd](this, rest, el, e); }
    }
    onKey(e) {
      if (!this.game) return;
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); E.ui.palette(this); return; }
      if (e.key === 'Escape') { if (this.ui.modal) { if (this.ui.modal.cls === 'moment-modal' || !(this.ui.dialog && this.ui.dialog.locked)) this.closeModal(); } else if (this.ui.inspector) { this.ui.inspector = null; this.rerender(); } return; }
      if (typing || this.ui.modal) return;
      if (e.key === ' ') { e.preventDefault(); if (e.shiftKey) this.advance(0, true); else this.advance(1); return; }
      if (e.key.toLowerCase() === 'm') { this.advance(Math.max(2, Math.round(this.game.cal.ticksPerMonth))); return; }
      if (e.key.toLowerCase() === 'h') { this.go('home'); return; }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9) { const nav = this.navItems(); if (nav[n - 1]) this.go(nav[n - 1].id); }
    }
    async loadSlot(slot) {
      try {
        this.root.innerHTML = `<div class="loading motif-bg"><div class="spinner"></div><p>Loading…</p></div>`;
        this.game = await E.persist.load(this.store, this.gdl, slot, {});
        this.slot = slot === 'autosave' ? 'game-' + Date.now().toString(36) : slot;
        this.attachGame(); this.route = { screen: 'home', tab: null, params: {} }; this.ui.modal = null;
        this.render(); this.toast('Game loaded', 'good');
      } catch (e) { this.fatal(e); }
    }

    /* ---------------- onboarding (coach marks) ---------------- */
    showIntro() {
      const ob = this.gdl.onboarding || {};
      const intro = ob.intro;
      if (!intro) return;
      this.prefs.coachHidden = false; this.prefs.coachStep = 0; this.savePrefs();
      const sc = this.game.scope();
      this.openModal(`<div class="intro"><div class="intro-kicker">${esc(this.def.meta.role || '')}</div><h2>${esc(this.game.tpl(intro.title, sc))}</h2><p>${esc(this.game.tpl(intro.text || '', sc))}</p>
        ${(intro.bullets || []).length ? `<ul class="intro-list">${intro.bullets.map(b => `<li>${D.icon(b.icon || 'check')}<div><b>${esc(this.game.tpl(b.title || '', sc))}</b><span>${esc(this.game.tpl(b.text || '', sc))}</span></div></li>`).join('')}</ul>` : ''}
        <button class="btn primary lg" data-a="introStart" autofocus>${esc(intro.button || 'Take the controls')}</button></div>`, 'intro-modal');
    }
    coachSteps() { return ((this.gdl.onboarding || {}).steps) || []; }
    renderCoach() {
      const steps = this.coachSteps();
      const i = this.prefs.coachStep || 0;
      if (!steps.length || this.prefs.coachHidden || i >= steps.length) return '';
      const s = steps[i];
      return `<div class="coach" role="status"><div class="coach-k">Getting started · ${i + 1} / ${steps.length}</div><p>${esc(this.game.tpl(s.text, this.game.scope()))}</p>
        <div class="coach-b">${s.target ? `<button class="btn sm" data-a="coachShow">${D.icon('eye')} Show me</button>` : ''}<button class="btn sm ghost" data-a="coachNext">${i + 1 < steps.length ? 'Skip step' : 'Done'}</button><button class="btn sm ghost" data-a="coachHide">Hide</button></div>
        <div class="coach-prog"><i style="width:${((i) / steps.length * 100).toFixed(0)}%"></i></div></div>`;
    }
    coachShow() {
      const s = this.coachSteps()[this.prefs.coachStep || 0]; if (!s || !s.target) return;
      if (s.nav && this.route.screen !== s.nav) { this.go(s.nav); }
      setTimeout(() => {
        const el = D.$(`[data-tour="${CSS.escape(s.target)}"]`, this.root) || D.$(s.target.startsWith('.') || s.target.startsWith('#') ? s.target : `[data-tour="${s.target}"]`, this.root);
        if (!el) { this.toast('Look for it in ' + (s.nav || 'the menu'), 'info'); return; }
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.classList.add('coach-pulse'); setTimeout(() => el.classList.remove('coach-pulse'), 2600);
      }, 60);
    }
    coachEvent(evt) { this.ui.coachEvents = this.ui.coachEvents || new Set(); this.ui.coachEvents.add(evt); this.checkCoach(); }
    checkCoach() {
      const steps = this.coachSteps(); const i = this.prefs.coachStep || 0;
      if (!this.game || !steps.length || i >= steps.length) return;
      const s = steps[i];
      let done = false;
      if (s.event && this.ui.coachEvents && this.ui.coachEvents.has(s.event)) done = true;
      if (!done && s.done) done = !!this.game.ev(s.done, this.game.scope(), false);
      if (done) { this.ui.coachEvents && this.ui.coachEvents.clear(); this.coachAdvance(false); }
    }
    coachAdvance(manual) {
      this.prefs.coachStep = (this.prefs.coachStep || 0) + 1; this.savePrefs();
      if (!manual) { const steps = this.coachSteps(); if (this.prefs.coachStep >= steps.length) this.toast('You know the basics. The rest is strategy.', 'good'); }
      if (!this.ui.modal) this.rerender();
    }
  }

  E.ui = E.ui || {};
  E.ui.App = App;
  E.ui.handlers = E.ui.handlers || {};
  E.ui.changeHandlers = E.ui.changeHandlers || {};
  E.ui.inputHandlers = E.ui.inputHandlers || {};
  E.ui.start = (root, gdl, opts) => { const app = new App(root, gdl, opts); app.boot(); return app; };
})(globalThis.LGE = globalThis.LGE || {});
