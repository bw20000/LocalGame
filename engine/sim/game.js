/* Local Game Studio engine — Game core.
   Owns state, the normalized definition, entity storage + indexes, the effect-op interpreter and
   tick orchestration. Feature modules (market, finance, actions, events, ai, history...) extend
   Game.prototype from their own files via E.extendGame(). The simulation never touches the DOM. */
(function (E) {
  'use strict';
  const U = E.util, X = E.expr;
  const STATE_VERSION = 3;

  /* ---------- definition normalization ---------- */
  function normFields(fields) {
    const out = {};
    for (const [k, v0] of Object.entries(fields || {})) {
      const v = typeof v0 === 'string' ? { type: v0 } : Object.assign({}, v0);
      if (!v.type) v.type = v.ref ? 'ref' : (v.options ? 'enum' : (typeof v.default === 'string' && !v.expr ? 'text' : 'number'));
      if (v.type === 'ref' && !v.ref) v.ref = k;
      v.label = v.label || U.cap1(k.replace(/([A-Z])/g, ' $1'));
      out[k] = v;
    }
    return out;
  }
  function normalize(gdl) {
    const g = gdl || {};
    const def = { gdl: g, kinds: {}, actions: {}, events: {}, projects: {}, negotiations: {}, stakeholders: {}, policies: {}, markets: {}, resources: {}, kindOrder: [] };
    def.meta = Object.assign({ title: 'Untitled', role: 'Owner' }, g.meta || {});
    def.time = Object.assign({ unit: 'week' }, g.time || {});
    def.params = Object.assign({}, g.params || {});
    for (const [k, kd0] of Object.entries(g.kinds || {})) {
      const kd = Object.assign({ label: U.cap1(k), plural: U.cap1(k) + 's', level: 1 }, kd0);
      kd.id = k;
      kd.fields = normFields(kd.fields);
      kd.derived = kd.derived || {};
      def.kinds[k] = kd; def.kindOrder.push(k);
    }
    const o = g.orgs || {};
    def.orgs = Object.assign({ label: 'Company', plural: 'Companies' }, o);
    def.orgFields = normFields(o.fields);
    def.orgMetrics = (o.metrics || []).map(m => Object.assign({ format: 'num' }, m));
    for (const r of (g.resources || [])) def.resources[r.id] = Object.assign({ format: 'score', start: 50 }, r);
    for (const a of (g.actions || [])) def.actions[a.id] = Object.assign({ scope: a.kind ? 'entity' : 'global', params: [], effects: [] }, a);
    for (const e of (g.events || [])) def.events[e.id] = Object.assign({ priority: 'important', choices: [] }, e);
    for (const p of (g.projects || [])) def.projects[p.id] = p;
    for (const n of (g.negotiations || [])) def.negotiations[n.id] = Object.assign({ patience: 3, terms: [] }, n);
    for (const s of (g.stakeholders || [])) def.stakeholders[s.id] = Object.assign({ start: 50, speed: 0.15, drivers: [] }, s);
    for (const p of (g.policies || [])) def.policies[p.id] = p;
    for (const [id, m] of Object.entries(g.markets || {})) def.markets[id] = Object.assign({ id, segments: [{ id: 'all', share: 1, price: 1, weights: {} }] }, m);
    def.world = Object.assign({ vars: [], trends: [] }, g.world || {});
    def.progression = Object.assign({ tiers: [], objectives: null, failure: null, victory: [] }, g.progression || {});
    def.history = Object.assign({ records: [], awards: [], milestones: [] }, g.history || {});
    def.ui = g.ui || {};
    def.onboarding = g.onboarding || {};
    def.people = g.people || null;
    def.tierIds = def.progression.tiers.map(t => t.id);
    return def;
  }

  /* ---------- Game ---------- */
  class Game {
    constructor(gdl, opts = {}) {
      this.def = normalize(gdl);
      this.opts = opts;
      this.cal = U.makeCalendar(this.def.time);
      U.setCurrency(gdl && gdl.currency);
      this.env = E.makeEnv(this);
      this.listeners = {};
      this.diag = { errors: [], seen: new Set() };
      this._idx = null;
      this.headless = !!opts.headless;
      this.hooks = E.hooks ? E.hooks.forGame(this) : null;
    }

    /* ----- events to UI ----- */
    on(ev, cb) { (this.listeners[ev] = this.listeners[ev] || []).push(cb); return () => { this.listeners[ev] = this.listeners[ev].filter(f => f !== cb); }; }
    emit(ev, data) { for (const cb of (this.listeners[ev] || [])) { try { cb(data); } catch (e) { this.report('listener ' + ev, e); } } }
    report(where, err) {
      const key = where + '|' + (err && err.message);
      if (this.diag.seen.has(key)) return;
      this.diag.seen.add(key);
      this.diag.errors.push({ where, msg: String(err && err.message || err), tick: this.state ? this.state.tick : 0 });
      if (this.diag.errors.length > 200) this.diag.errors.shift();
      if (this.opts.throwOnError) throw err;
    }

    /* ----- creation ----- */
    static create(gdl, opts = {}) {
      const g = new Game(gdl, opts);
      g.newState(opts);
      return g;
    }
    newState(opts) {
      const seed = opts.seed != null ? String(opts.seed) : String(Math.floor(Math.random() * 1e9));
      this.rng = new E.RNG(seed);
      const st = this.state = {
        v: STATE_VERSION, gdlVersion: (this.def.gdl.meta && this.def.gdl.meta.version) || 1, seed,
        tick: 0, idc: 1, player: null, orgs: {}, ents: {}, world: { __world: true, vars: {}, phase: null, phaseTicks: 0, shocks: [], trends: {}, hist: {} },
        projects: {}, negotiations: {}, stakes: {}, policies: {}, flags: {}, mem: {},
        events: { pending: [], scheduled: [], cooldown: {}, fired: {}, log: [] },
        news: [], history: { records: {}, awards: [], milestones: {}, timeline: [], transactions: [], anti: [], annual: [], hof: [] },
        progression: { tier: this.def.tierIds[0] || null, objectives: [], distress: 0, over: null, rescuesUsed: {} },
        options: Object.assign({}, opts.options || {}), settings: Object.assign({ autopause: { critical: true, important: false, moments: true } }, opts.settings || {}),
        stats: { actions: {}, events: { critical: 0, important: 0, routine: 0, background: 0 }, ticks: 0 },
        warm: false, digest: []
      };
      for (const k of this.def.kindOrder) st.ents[k] = {};
      // params can be overridden by difficulty/options
      this.params = Object.assign({}, this.def.params, this.difficultyParams(st.options.difficulty), opts.params || {});
      st.params = this.params;
      this.initWorld();
      this.createCatalogs();
      this.createOrgs(opts);
      this.generateEntities();
      this.initStakeholders();
      this.initPolicies();
      this.computeDerived();
      this.warmup();
      // the player's company starts AFTER the world has been running (warm-up builds rival networks & history)
      const p0 = this.playerOrg(); const cash0 = p0.cash;
      p0.ledger = { cur: {}, last: {}, ytd: {}, prevYear: {}, series: [] };
      p0.hist = {};
      p0.cash = cash0;
      this.runStartOps(opts);
      this.computeDerived();
      this.runOperationsPreview && this.runOperationsPreview();
      this.updateOrgMetrics();
      this.initObjectives && this.initObjectives();
      this.emit('created', {});
      return st;
    }
    difficultyParams(level) {
      const d = this.def.gdl.difficulty;
      if (!d || !level || !d[level]) return {};
      return d[level].params || {};
    }

    /* ----- scope & evaluation ----- */
    timeObj() {
      const t = this.state.tick, cal = this.cal;
      return { tick: t, year: cal.yearOf(t), month: cal.monthOf(t), week: (cal.tickOfYear(t) + 1), tickOfYear: cal.tickOfYear(t), yearsElapsed: t / cal.perYear, perYear: cal.perYear, isYearEnd: cal.isYearEnd(t), startYear: cal.startYear, season: this.seasonOf(t) };
    }
    seasonOf(t) { const m = this.cal.monthOf(t); return m <= 2 || m === 12 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn'; }
    scope(extra) {
      const p = this.playerOrg();
      const s = { world: this.state.world, params: this.params, time: this._time || this.timeObj(), player: p, org: p, me: p };
      if (extra) Object.assign(s, extra);
      return s;
    }
    ev(src, scope, dflt) {
      if (src == null) return dflt;
      if (typeof src === 'number' || typeof src === 'boolean') return src;
      try {
        const f = X.compile(src);
        const v = f(scope, this.env);
        return v === undefined ? dflt : v;
      } catch (e) { this.report('expr: ' + src, e); return dflt; }
    }
    num(src, scope, dflt = 0) {
      const v = this.ev(src, scope, dflt);
      const n = typeof v === 'number' ? v : (typeof v === 'boolean' ? (v ? 1 : 0) : +v);
      if (!Number.isFinite(n)) { if (src != null) this.report('non-finite: ' + src, new Error('value ' + v)); return dflt; }
      return n;
    }
    tpl(text, scope) {
      if (text == null) return '';
      try { return X.compileTemplate(text)(scope, this.env); } catch (e) { this.report('template: ' + text, e); return String(text); }
    }

    /* ----- entities & orgs ----- */
    newId(prefix) { return `${prefix}${this.state.idc++}`; }
    ent(kind, id) { if (id == null) return null; if (kind) { const m = this.state.ents[kind]; return m ? m[id] || null : null; } for (const k in this.state.ents) if (this.state.ents[k][id]) return this.state.ents[k][id]; return null; }
    all(kind) { this._index(); return this._idx.all[kind] || []; }
    owned(kind, orgId) { this._index(); const m = this._idx.owner[kind]; return (m && m[orgId]) || []; }
    refs(kind, field, id) {
      this._index();
      const key = kind + '.' + field;
      let m = this._idx.refs[key];
      if (!m) {
        m = {};
        for (const e of (this._idx.all[kind] || [])) { const v = e[field]; if (v == null) continue; if (Array.isArray(v)) { for (const x of v) (m[x] = m[x] || []).push(e); } else (m[v] = m[v] || []).push(e); }
        this._idx.refs[key] = m;
      }
      return m[id] || [];
    }
    _index() {
      if (this._idx) return;
      const all = {}, owner = {};
      for (const k in this.state.ents) {
        const arr = Object.values(this.state.ents[k]); all[k] = arr;
        const om = owner[k] = {};
        for (const e of arr) if (e.owner != null) (om[e.owner] = om[e.owner] || []).push(e);
      }
      this._idx = { all, owner, refs: {} };
    }
    dirty() { this._idx = null; }
    createEntity(kind, fields = {}, owner = null) {
      const kd = this.def.kinds[kind];
      if (!kd) throw new Error(`Unknown kind '${kind}'`);
      const id = fields.id && !this.state.ents[kind][fields.id] ? String(fields.id) : this.newId((kd.idPrefix || kind.slice(0, 3)) + '_');
      const e = { __ent: true, id, kind, owner: owner != null ? (typeof owner === 'object' ? owner.id : owner) : null, born: this.state.tick };
      const sc = this.scope({ self: e, org: owner && typeof owner === 'object' ? owner : (owner ? this.state.orgs[owner] : this.playerOrg()) });
      for (const [f, fd] of Object.entries(kd.fields)) {
        if (fields[f] !== undefined) continue;
        if (fd.default !== undefined) e[f] = (typeof fd.default === 'string' && fd.type !== 'text' && fd.type !== 'enum') || fd.expr ? this.ev(fd.expr || fd.default, sc, null) : fd.default;
        else if (fd.type === 'refs' || fd.type === 'list') e[f] = [];
      }
      for (const [f, v] of Object.entries(fields)) if (f !== 'id') e[f] = v;
      if (e.name == null) e.name = this.genName(kind, e, sc);
      this.state.ents[kind][id] = e;
      this.dirty();
      return e;
    }
    removeEntity(e) {
      if (!e) return;
      const m = this.state.ents[e.kind];
      if (m && m[e.id]) { delete m[e.id]; this.dirty(); this.hooks && this.hooks.run('remove', e); }
    }
    genName(kind, e, sc) {
      const kd = this.def.kinds[kind];
      const nm = kd.name;
      if (nm && nm.template) return this.tpl(nm.template, sc);
      if (nm && nm.list && nm.list.length) return this.rng.pick(nm.list) + (nm.numbered ? ' ' + this.rng.int(2, 99) : '');
      if (nm && nm.generator === 'person') return U.personName(this.rng);
      if (nm && nm.generator === 'company') return U.companyName(this.rng, nm.suffixes);
      if (nm && nm.generator === 'code') return (nm.prefix || '') + String(this.rng.int(100, 999));
      return `${kd.label} ${this.state.idc}`;
    }
    playerOrg() { return this.state && this.state.orgs[this.state.player]; }
    liveOrgs() { return Object.values(this.state.orgs).filter(o => o.alive); }
    createOrg(spec) {
      const id = spec.id || this.newId('org_');
      const o = Object.assign({ __org: true, id, name: 'Company', archetype: null, isPlayer: false, alive: true, level: 1, cash: 0, debt: 0, res: {}, m: {}, hist: {}, ledger: { cur: {}, last: {}, ytd: {}, prevYear: {}, series: [] }, loans: [], founded: this.state.tick, color: null, flags: {} }, spec);
      o.id = id;
      for (const [f, fd] of Object.entries(this.def.orgFields)) if (o[f] === undefined) o[f] = fd.default !== undefined && typeof fd.default !== 'string' ? fd.default : (fd.type === 'text' ? '' : (fd.type === 'refs' || fd.type === 'list') ? [] : (fd.type === 'enum' ? (fd.default || (fd.options && fd.options[0] && (fd.options[0].value ?? fd.options[0]))) : 0));
      for (const r of Object.values(this.def.resources)) if (o.res[r.id] === undefined) o.res[r.id] = r.start;
      this.state.orgs[id] = o;
      return o;
    }

    /* ----- world creation ----- */
    initWorld() {
      const w = this.state.world;
      for (const v of this.def.world.vars) w.vars[v.id] = v.start != null ? v.start : (v.process && v.process.mean != null ? v.process.mean : 1);
      const cyc = this.def.world.cycle;
      if (cyc && cyc.phases && cyc.phases.length) { w.phase = cyc.start || cyc.phases[0].id; w.phaseTicks = 0; }
      for (const t of this.def.world.trends || []) w.trends[t.id] = t.start != null ? t.start : 1;
      w.season = 1; w.demand = 1; w.credit = 0;
      this.applyPhaseVars && this.applyPhaseVars();
    }
    createCatalogs() {
      for (const k of this.def.kindOrder) {
        const kd = this.def.kinds[k];
        if (!kd.records) continue;
        const filt = kd.recordFilter;
        for (const r of kd.records) {
          if (filt && !this.ev(filt, this.scope({ self: r }), true)) continue;
          this.createEntity(k, Object.assign({}, r), null);
        }
      }
    }
    createOrgs(opts) {
      const od = this.def.orgs;
      const P = od.player || {};
      const sc0 = this.scope();
      const oo = opts.options || {};
      const player = this.createOrg({ id: 'player', isPlayer: true, level: 1, name: oo.companyName || oo.name || this.tpl(P.name || 'Your Company', sc0), color: P.color || null });
      this.state.player = player.id;
      player.cash = this.num(P.cash != null ? P.cash : 1e6, this.scope({ org: player }));
      if (P.set) for (const [f, x] of Object.entries(P.set)) this.assign(player, f, this.ev(x, this.scope({ org: player })), 'set');
      const R = od.rivals;
      if (!R) return;
      const arch = (R.archetypes || [{ id: 'standard', label: 'Competitor' }]);
      const counts = R.count || { full: 3, light: 3, background: 0 };
      const used = new Set([player.name]);
      const mkName = (a) => {
        for (let i = 0; i < 20; i++) {
          let n = a.names && a.names.length ? this.rng.pick(a.names) : (R.names && R.names.length ? this.rng.pick(R.names) : U.companyName(this.rng, R.suffixes || a.suffixes));
          if (!used.has(n)) { used.add(n); return n; }
        }
        return U.companyName(this.rng) + ' ' + this.rng.int(2, 99);
      };
      const levels = [['full', 1], ['light', 2], ['background', 3]];
      let ai = 0;
      for (const [key, lvl] of levels) {
        const n = Math.max(0, Math.round(this.num(counts[key] || 0, sc0)));
        for (let i = 0; i < n; i++) {
          const a = R.fixed && R.fixed[ai] ? arch.find(x => x.id === R.fixed[ai].archetype) || arch[ai % arch.length] : this.rng.weighted(arch, arch.map(x => x.share || 1));
          const fixed = R.fixed && R.fixed[ai];
          ai++;
          const o = this.createOrg({ name: fixed && fixed.name ? fixed.name : mkName(a), archetype: a.id, level: lvl, color: a.color || null, real: !!(fixed && fixed.real) });
          const sc = this.scope({ org: o });
          o.cash = this.num(a.cash != null ? a.cash : (R.cash != null ? R.cash : player.cash), sc) * (lvl === 3 ? 1 : this.rng.float(0.8, 1.25));
          if (a.set) for (const [f, x] of Object.entries(a.set)) this.assign(o, f, this.ev(x, sc), 'set');
          if (fixed && fixed.set) for (const [f, x] of Object.entries(fixed.set)) this.assign(o, f, this.ev(x, sc), 'set');
          if (lvl === 3) { o.m.size = this.num(R.backgroundSize || 1, sc) * this.rng.float(0.3, 1.5); continue; }
          if (a.start) this.runOps(a.start, sc);
          if (R.start) this.runOps(R.start, sc);
        }
      }
    }
    generateEntities() {
      for (const k of this.def.kindOrder) {
        const kd = this.def.kinds[k];
        const gen = kd.generate;
        if (!gen) continue;
        const per = gen.per || 'world';
        const owners = per === 'org' ? this.liveOrgs().filter(o => o.level < 3) : [null];
        for (const owner of owners) {
          const sc = this.scope({ org: owner || this.playerOrg() });
          const n = Math.round(this.num(gen.count, sc, 0));
          for (let i = 0; i < n; i++) {
            const e = this.createEntity(k, {}, per === 'org' ? owner : (gen.owner ? this.ev(gen.owner, sc) : null));
            const s2 = Object.assign({}, sc, { self: e, i });
            if (gen.set) for (const [f, x] of Object.entries(gen.set)) e[f] = this.ev(x, s2);
            if (gen.name) e.name = this.tpl(gen.name, s2);
          }
        }
      }
    }
    runStartOps(opts) {
      const P = this.def.orgs.player || {};
      const sc = this.scope({ org: this.playerOrg() });
      const ng = this.def.gdl.newGame || {};
      for (const o of (ng.options || [])) {
        const val = this.state.options[o.id] != null ? this.state.options[o.id] : o.default;
        this.state.options[o.id] = val;
        const choice = (o.choices || []).find(c => c.value === val);
        if (choice && choice.effects) this.runOps(choice.effects, Object.assign(this.scope({ org: this.playerOrg() }), { option: val }));
      }
      if (P.start) this.runOps(P.start, sc);
      const scen = (ng.scenarios || []).find(s => s.id === this.state.options.scenario);
      if (scen && scen.effects) this.runOps(scen.effects, this.scope({ org: this.playerOrg() }));
      if (this.hooks) this.hooks.run('start', this);
    }
    warmup() {
      const n = Math.round(this.num(this.def.gdl.warmup || 0, this.scope(), 0));
      if (!n) return;
      this.state.warm = true;
      this.state.tick = -n;
      for (let i = 0; i < n; i++) this.tick();
      this.state.warm = false;
      // warm-up history is "pre-history": keep records/timeline, clear player-facing noise
      this.state.events.pending = [];
      this.state.news = this.state.news.filter(x => x.pri !== 'routine').slice(0, 30).map(x => Object.assign(x, { read: true }));
      this.state.digest = [];
      for (const o of Object.values(this.state.orgs)) { o.ledger.ytd = {}; }
    }

    /* ----- effect operations ----- */
    resolvePathTarget(path, scope) {
      const parts = String(path).split('.');
      const field = parts.pop();
      let obj = scope[parts[0]];
      if (obj === undefined && parts[0] === 'world') obj = this.state.world;
      for (let i = 1; i < parts.length; i++) obj = this.env.member(obj, parts[i]);
      return { obj, field };
    }
    assign(obj, field, value, mode) {
      if (obj == null) return;
      let holder = obj, key = field;
      if (obj.__org) {
        if (field === 'cash') { this.addCash(obj, mode === 'set' ? value - obj.cash : (mode === 'mul' ? obj.cash * (value - 1) : value), 'Other'); return; }
        if (obj.res && field in obj.res) holder = obj.res;
      } else if (obj.__world) {
        if (field in obj.vars || !(field in obj)) holder = obj.vars;
      }
      if (value && typeof value === 'object' && value.id != null && !Array.isArray(value)) value = value.id;
      const cur = holder[key];
      let nv = value;
      if (mode === 'add') nv = (+cur || 0) + (+value || 0);
      else if (mode === 'mul') nv = (+cur || 0) * (+value || 0);
      else if (mode === 'push') { nv = Array.isArray(cur) ? cur.concat([value]) : [value]; }
      else if (mode === 'pull') { nv = Array.isArray(cur) ? cur.filter(x => x !== value) : []; }
      if (obj.__ent) {
        const fd = this.def.kinds[obj.kind] && this.def.kinds[obj.kind].fields[field];
        if (fd && typeof nv === 'number') { if (fd.min != null) nv = Math.max(fd.min, nv); if (fd.max != null) nv = Math.min(fd.max, nv); }
        if ((fd && (fd.type === 'ref' || fd.type === 'refs')) || field === 'owner') this.dirty();
      } else if (obj.__org && holder === obj.res) {
        const rd = this.def.resources[field];
        if (rd && typeof nv === 'number') { if (rd.min != null) nv = Math.max(rd.min, nv); if (rd.max != null) nv = Math.min(rd.max, nv); }
      }
      if (typeof nv === 'number' && !Number.isFinite(nv)) { this.report('assign ' + field, new Error('non-finite')); return; }
      holder[key] = nv;
    }
    runOps(ops, scope) {
      if (!ops) return;
      if (!Array.isArray(ops)) ops = [ops];
      for (const op of ops) {
        try { this.runOp(op, scope); } catch (e) { this.report('op ' + (op && op.op), e); }
        if (scope.__stop) break;
      }
    }
    runOp(op, sc) {
      if (!op) return;
      const kind = op.op || Object.keys(op)[0];
      // entity ticks of unowned entities have no actor: nothing is charged to (or announced for) the player
      const actor = sc.org || (sc.__noActor ? null : this.playerOrg());
      const quiet = actor ? !actor.isPlayer : !!sc.__noActor;
      switch (kind) {
        case 'set': case 'add': case 'mul': case 'push': case 'pull': {
          if (op.path) { const { obj, field } = this.resolvePathTarget(op.path, sc); this.assign(obj, field, this.ev(op.value, sc), kind); }
          else if (op.target) { const obj = this.ev(op.target, sc); const list = Array.isArray(obj) ? obj : [obj]; for (const o of list) { const s2 = Object.assign({}, sc, { it: o }); this.assign(o, op.field, this.ev(op.value, s2), kind); } }
          else if (op[kind] && typeof op[kind] === 'object') { for (const [p, v] of Object.entries(op[kind])) { const { obj, field } = this.resolvePathTarget(p, sc); this.assign(obj, field, this.ev(v, sc), kind); } }
          return;
        }
        case 'let': sc[op.name] = this.ev(op.value, sc); return;
        case 'cash': {
          const org = op.org ? this.ev(op.org, sc) : actor;
          const o = org && (org.__org ? org : this.state.orgs[org]);
          if (o) this.addCash(o, this.num(op.amount, sc), op.category || (this.num(op.amount, sc) >= 0 ? 'Other income' : 'Other costs'), op.note ? this.tpl(op.note, sc) : null, op.capex);
          return;
        }
        case 'resource': case 'res': {
          const org = op.org ? this.ev(op.org, sc) : actor;
          const o = org && (org.__org ? org : this.state.orgs[org]);
          if (!o) return;
          const rd = this.def.resources[op.id];
          let v = o.res[op.id] != null ? o.res[op.id] : (rd ? rd.start : 0);
          if (op.set != null) v = this.num(op.set, sc); else v += this.num(op.add != null ? op.add : op.value, sc);
          if (rd) v = U.clamp(v, rd.min != null ? rd.min : -Infinity, rd.max != null ? rd.max : Infinity);
          o.res[op.id] = v; return;
        }
        case 'create': {
          const n = op.count != null ? Math.max(0, Math.round(this.num(op.count, sc))) : 1;
          let owner = op.owner !== undefined ? this.ev(op.owner, sc) : actor;
          if (owner === 'none') owner = null;
          let last = null;
          for (let i = 0; i < n; i++) {
            const fields = {};
            const s2 = Object.assign({}, sc, { i });
            for (const [f, x] of Object.entries(op.set || {})) { let v = this.ev(x, s2); if (v && typeof v === 'object' && v.__ent) v = v.id; fields[f] = v; }
            last = this.createEntity(op.kind, fields, owner);
            if (op.name) last.name = this.tpl(op.name, Object.assign({}, s2, { self: last }));
            if (op.then) this.runOps(op.then, Object.assign({}, s2, { self: last, created: last }));
          }
          sc.created = last; if (op.as) sc[op.as] = last;
          return;
        }
        case 'remove': { const t = this.ev(op.target || 'self', sc); for (const e of (Array.isArray(t) ? t : [t])) if (e && e.__ent) this.removeEntity(e); return; }
        case 'transfer': {
          const t = this.ev(op.target, sc), to = this.ev(op.to, sc);
          const toId = to && typeof to === 'object' ? to.id : to;
          for (const e of (Array.isArray(t) ? t : [t])) if (e && e.__ent) { e.owner = toId; }
          this.dirty(); return;
        }
        case 'project': this.startProject(op.id, sc, op); return;
        case 'negotiate': if (!actor) return; this.startNegotiation(op.id, this.ev(op.with || op.target, sc), actor, sc); return;
        case 'stake': case 'stakeholder': if (!actor) return; this.addStake(op.id, this.num(op.add != null ? op.add : op.value, sc), actor); return;
        case 'remember': {
          const a = op.a ? this.ev(op.a, sc) : actor, b = this.ev(op.b || op.who, sc);
          this.remember(a, b, op.key || 'relationship', this.num(op.add != null ? op.add : op.value, sc)); return;
        }
        case 'news': if (quiet && !op.always) return; this.news(this.tpl(op.text, sc), op.priority || 'routine', { tag: op.tag, org: (sc.org && sc.org.id), refs: op.ref ? [this.refOf(this.ev(op.ref, sc))] : this.autoRefs(sc) }); return;
        case 'log': if (quiet) return; this.logTransaction(this.tpl(op.text, sc), { org: actor && actor.id, amount: op.amount != null ? this.num(op.amount, sc) : null }); return;
        case 'timeline': this.timeline(this.tpl(op.text, sc), op.tag || 'major'); return;
        case 'event': this.scheduleEvent(op.id, op.delay ? this.num(op.delay, sc) : 0, op.bind ? Object.fromEntries(Object.entries(op.bind).map(([k, v]) => [k, this.refOf(this.ev(v, sc))])) : this.bindFromScope(sc), actor); return;
        case 'if': { if (this.ev(op.cond || op.when, sc)) this.runOps(op.then, sc); else if (op.else) this.runOps(op.else, sc); return; }
        case 'chance': { if (this.rng.next() < this.num(op.p != null ? op.p : op.chance, sc)) this.runOps(op.then, sc); else if (op.else) this.runOps(op.else, sc); return; }
        case 'each': case 'forEach': {
          let list = op.list ? this.ev(op.list, sc) : (op.kind ? this.all(op.kind).slice() : []);
          if (!Array.isArray(list)) list = list ? [list] : [];
          const as = op.as || 'it';
          let n = 0;
          for (const it of list) {
            const s2 = Object.assign({}, sc); s2[as] = it; if (as !== 'it') s2.it = it;
            if (op.filter && !this.ev(op.filter, s2)) continue;
            this.runOps(op.do || op.then, s2);
            if (op.limit && ++n >= op.limit) break;
          }
          return;
        }
        case 'loan': if (!actor) return; this.takeLoan(actor, this.num(op.amount, sc), op.years != null ? this.num(op.years, sc) : 5, op.rate != null ? this.num(op.rate, sc) : null); return;
        case 'repay': if (!actor) return; this.repayDebt(actor, this.num(op.amount, sc)); return;
        case 'forgiveDebt': this.forgiveDebt(actor, this.num(op.fraction != null ? op.fraction : 0.5, sc)); return;
        case 'acquireOrg': case 'mergeOrg': { const t = this.ev(op.target, sc); const to = op.to ? this.ev(op.to, sc) : actor; this.mergeOrgs(to, t, sc); return; }
        case 'moment': if (quiet && !op.always) return; this.moment(this.tpl(op.title, sc), this.tpl(op.text || '', sc), op.tone || 'good', op.stat ? this.tpl(op.stat, sc) : null); return;
        case 'observe': { const t = this.ev(op.target, sc); if (t) this.observe(t, op.field, this.num(op.quality != null ? op.quality : 0.5, sc)); return; }
        case 'flag': this.state.flags[op.name] = op.value === undefined ? true : this.ev(op.value, sc); return;
        case 'policy': this.state.policies[op.id] = this.ev(op.value, sc); return;
        case 'stop': sc.__stop = true; return;
        case 'toast': if (quiet) return; this.emit('toast', { text: this.tpl(op.text, sc), tone: op.tone || 'info' }); return;
        case 'hook': case 'call': if (this.hooks) this.hooks.run(op.hook || op.name, sc, op.args); return;
        case 'autoAct': {
          if (!actor) return;
          // delegation: the org's staff take an action using its ai.score (same logic rivals use)
          const n = op.max != null ? Math.max(0, Math.round(this.num(op.max, sc, 1))) : 1;
          const min = op.minScore != null ? this.num(op.minScore, sc, 0) : 0;
          for (let i = 0; i < n; i++) { const r = this.autoAct(op.action, actor, { minScore: min, self: op.self ? this.ev(op.self, sc) : null, candidates: op.candidates }); if (!r) break; }
          return;
        }
        case 'endGame': this.endGame(op.outcome || 'over', this.tpl(op.text || '', sc)); return;
        default: this.report('op', new Error('Unknown op ' + kind));
      }
    }
    refOf(x) { return x && typeof x === 'object' ? (x.__org ? 'org:' + x.id : x.__ent ? x.kind + ':' + x.id : null) : x; }
    deref(r) {
      if (r == null || typeof r !== 'string') return r;
      const i = r.indexOf(':'); if (i < 0) return r;
      const k = r.slice(0, i), id = r.slice(i + 1);
      return k === 'org' ? this.state.orgs[id] || null : this.ent(k, id);
    }
    autoRefs(sc) { const out = []; for (const k of ['self', 'param', 'it']) { const v = sc[k]; if (v && (v.__ent || v.__org)) out.push(this.refOf(v)); } return out; }
    bindFromScope(sc) { const b = {}; if (sc.self && (sc.self.__ent || sc.self.__org)) b.self = this.refOf(sc.self); return b; }

    /* ----- memory / relationships ----- */
    memKey(a, b) { const ida = a && typeof a === 'object' ? a.id : a, idb = b && typeof b === 'object' ? b.id : b; return ida + '>' + idb; }
    memory(a, b, key) { const m = this.state.mem[this.memKey(a, b)]; return m ? (m[key || 'relationship'] || 0) : 0; }
    remember(a, b, key, delta) {
      if (a == null || b == null) return;
      const k = this.memKey(a, b);
      const m = this.state.mem[k] = this.state.mem[k] || {};
      m[key] = U.clamp((m[key] || 0) + delta, -100, 100);
    }

    /* Per-entity tick ops (kinds.x.tick, optional tickEvery / tickWhen): startups growing, shows
       aging, clients' careers… Runs for every entity of the kind, owned or not. */
    runEntityTicks() {
      const t = this.state.tick;
      for (const k of this.def.kindOrder) {
        const kd = this.def.kinds[k];
        if (!kd.tick || !kd.tick.length) continue;
        const every = kd.tickEvery || 1;
        if (t % every !== 0) continue;
        for (const e of this.all(k).slice()) {
          if (!this.ent(k, e.id)) continue;
          const org = e.owner != null ? this.state.orgs[e.owner] : null;
          if (org && (!org.alive || org.level === 3) && !kd.tickBackground) continue;
          const sc = this.scope({ self: e, org: org || null, __noActor: true });
          if (kd.tickWhen && !this.ev(kd.tickWhen, sc)) continue;
          this.runOps(kd.tick, sc);
        }
      }
    }
    /* ----- tick orchestration ----- */
    tick() {
      const st = this.state;
      if (st.progression.over && !st.progression.continueAfterEnd) return { interrupts: [] };
      this._time = this.timeObj();
      this._interrupts = [];
      const steps = [
        ['world', () => this.updateWorld()],
        ['derived', () => this.computeDerived()],
        ['entities', () => this.runEntityTicks()],
        ['policies', () => this.applyPolicies()],
        ['ai', () => !this.opts.noAI && this.runAI()],
        ['projects', () => this.progressProjects()],
        ['operate', () => this.runOperations()],
        ['upkeep', () => this.runUpkeep()],
        ['finance', () => this.runFinance()],
        ['metrics', () => this.updateOrgMetrics()],
        ['resources', () => this.updateResources()],
        ['stakeholders', () => this.updateStakeholders()],
        ['people', () => this.updatePeople && this.updatePeople()],
        ['hooks', () => this.hooks && this.hooks.run('tick', this)],
        ['events', () => !st.warm && this.checkEvents()],
        ['negotiations', () => this.progressNegotiations()],
        ['progression', () => !st.warm && this.checkProgression()],
        ['history', () => this.updateHistory()],
        ['lifecycle', () => this.orgLifecycle()],
        ['close', () => this.closeTick()]
      ];
      for (const [name, fn] of steps) {
        try { fn(); } catch (e) { this.report('tick:' + name, e); }
      }
      st.tick++;
      st.stats.ticks++;
      this._time = null;
      if (!st.warm) this.emit('tick', { interrupts: this._interrupts });
      return { interrupts: this._interrupts };
    }
    advance(n = 1, opts = {}) {
      const out = [];
      for (let i = 0; i < n; i++) {
        const r = this.tick();
        out.push(...r.interrupts);
        if (opts.stopOnInterrupt !== false && r.interrupts.length) break;
        if (this.state.progression.over) break;
      }
      return out;
    }
    interrupt(kind, data) { if (this._interrupts) this._interrupts.push(Object.assign({ kind }, data)); }

    /* ----- serialization ----- */
    serialize() {
      const st = this.state;
      st.rngState = this.rng.getState();
      return JSON.stringify(st, (k, v) => (k === '__cache' ? undefined : v));
    }
    static load(gdl, json, opts = {}) {
      const g = new Game(gdl, opts);
      const st = typeof json === 'string' ? JSON.parse(json) : json;
      g.state = st;
      g.rng = new E.RNG(st.seed || 'seed');
      if (st.rngState) g.rng.setState(st.rngState);
      g.params = Object.assign({}, g.def.params, st.params || {});
      g.migrate();
      return g;
    }
    migrate() {
      // Robust to added properties: fill every missing structure/field from the current definition.
      const st = this.state, def = this.def;
      const blank = { orgs: {}, ents: {}, projects: {}, negotiations: {}, stakes: {}, policies: {}, flags: {}, mem: {}, news: [], digest: [] };
      for (const [k, v] of Object.entries(blank)) if (st[k] == null) st[k] = v;
      st.world = Object.assign({ __world: true, vars: {}, phase: null, phaseTicks: 0, shocks: [], trends: {}, hist: {} }, st.world || {});
      st.world.__world = true;
      st.events = Object.assign({ pending: [], scheduled: [], cooldown: {}, fired: {}, log: [] }, st.events || {});
      st.history = Object.assign({ records: {}, awards: [], milestones: {}, timeline: [], transactions: [], anti: [], annual: [], hof: [] }, st.history || {});
      st.progression = Object.assign({ tier: def.tierIds[0] || null, objectives: [], distress: 0, over: null, rescuesUsed: {} }, st.progression || {});
      st.stats = Object.assign({ actions: {}, events: { critical: 0, important: 0, routine: 0, background: 0 }, ticks: 0 }, st.stats || {});
      st.settings = Object.assign({ autopause: { critical: true, important: false, moments: true } }, st.settings || {});
      for (const v of def.world.vars) if (st.world.vars[v.id] == null) st.world.vars[v.id] = v.start != null ? v.start : 1;
      for (const k of def.kindOrder) {
        st.ents[k] = st.ents[k] || {};
        const kd = def.kinds[k];
        for (const e of Object.values(st.ents[k])) {
          e.__ent = true; e.kind = k;
          for (const [f, fd] of Object.entries(kd.fields)) if (e[f] === undefined && fd.default !== undefined && (typeof fd.default !== 'string' || fd.type === 'text' || fd.type === 'enum')) e[f] = fd.default;
        }
      }
      for (const o of Object.values(st.orgs)) {
        o.__org = true; o.res = o.res || {}; o.m = o.m || {}; o.hist = o.hist || {}; o.loans = o.loans || []; o.flags = o.flags || {};
        o.ledger = Object.assign({ cur: {}, last: {}, ytd: {}, prevYear: {}, series: [] }, o.ledger || {});
        for (const r of Object.values(def.resources)) if (o.res[r.id] == null) o.res[r.id] = r.start;
        for (const [f, fd] of Object.entries(def.orgFields)) if (o[f] === undefined && fd.default !== undefined && typeof fd.default !== 'string') o[f] = fd.default;
      }
      for (const s of Object.values(def.stakeholders)) if (!st.stakes[s.id]) st.stakes[s.id] = { value: s.start, hist: [] };
      for (const p of Object.values(def.policies)) if (st.policies[p.id] == null) st.policies[p.id] = p.default != null ? p.default : (p.options && p.options[0] && p.options[0].value);
      st.v = STATE_VERSION;
      this.dirty();
    }
  }

  E.Game = Game;
  E.normalizeDef = normalize;
  E.extendGame = (methods) => Object.assign(Game.prototype, methods);
  E.STATE_VERSION = STATE_VERSION;
})(globalThis.LGE = globalThis.LGE || {});
