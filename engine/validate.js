/* Local Game Studio — Game Definition validator (Node).
   1) Static: structure, references, every formula/template compiles, unknown names/functions,
      op shapes, UI references.  2) Dynamic: dry-run simulation with a random-action bot,
   catching runtime formula errors, NaN/Infinity, broken invariants. Errors carry a path so the
   orchestrator can repair exactly the failing fragment. */
'use strict';
const { loadEngine } = require('./node.js');
const E = loadEngine();
const X = E.expr;

const OPS = new Set(['set', 'add', 'mul', 'push', 'pull', 'let', 'cash', 'resource', 'res', 'create', 'remove', 'transfer', 'project', 'negotiate', 'stake', 'stakeholder', 'remember', 'news', 'log', 'timeline', 'event', 'if', 'chance', 'each', 'forEach', 'loan', 'repay', 'forgiveDebt', 'acquireOrg', 'mergeOrg', 'moment', 'observe', 'flag', 'policy', 'stop', 'toast', 'hook', 'call', 'endGame', 'autoAct']);
const SECTIONS = new Set(['goal', 'metrics', 'needs', 'actions', 'upcoming', 'objectives', 'table', 'cards', 'board', 'map', 'pipeline', 'chart', 'ledger', 'finance', 'rankings', 'feed', 'stakeholders', 'resources', 'world', 'policies', 'rivals', 'text', 'negotiations', 'records', 'awards', 'timeline', 'milestones', 'antiPortfolio', 'annual', 'showcase', 'mix', 'histogram']);
const ROOTS = new Set(['self', 'org', 'player', 'world', 'params', 'time', 'param', 'terms', 'fc', 'it', 'outer', 'them', 'p', 'project', 'me', 'actor', 'sold', 'demand', 'capacity', 'load', 'price', 'revenue', 'segSold', 'segDemand', 'share', 'market', 'size', 'key', 'units', 'base', 'target', 'objective', 'created', 'option', 'policy', 'failed', 'i', 'v', 'relationship', 'newcomer', 'group', 'true', 'false', 'null']);
const FIELD_TYPES = new Set(['number', 'int', 'money', 'pct', 'text', 'enum', 'ref', 'refs', 'list', 'bool']);

function fnNames() { const g = { state: { orgs: {}, world: {} }, def: { kinds: {} } }; return new Set(Object.keys(E.makeEnv(g).fns)); }

function validateStatic(gdl) {
  const errors = [], warnings = [];
  const err = (path, msg) => errors.push({ path, msg });
  const warn = (path, msg) => warnings.push({ path, msg });
  const FN = fnNames();
  if (!gdl || typeof gdl !== 'object') { err('$', 'Definition is not an object'); return { errors, warnings }; }
  if (!gdl.meta || !gdl.meta.title) err('meta.title', 'Missing title');
  if (gdl.time && gdl.time.unit && !['day', 'week', 'month'].includes(gdl.time.unit)) err('time.unit', 'Must be day, week or month');
  const kinds = gdl.kinds || {};
  if (!Object.keys(kinds).length) err('kinds', 'No entity kinds defined');
  const def = E.normalizeDef(gdl);
  const kindNames = new Set(Object.keys(kinds));
  const actionIds = new Set((gdl.actions || []).map(a => a.id));
  const eventIds = new Set((gdl.events || []).map(e => e.id));
  const projectIds = new Set((gdl.projects || []).map(p => p.id));
  const negIds = new Set((gdl.negotiations || []).map(n => n.id));
  const stakeIds = new Set((gdl.stakeholders || []).map(s => s.id));
  const resIds = new Set((gdl.resources || []).map(r => r.id));
  const policyIds = new Set((gdl.policies || []).map(p => p.id));
  const tierIds = new Set(((gdl.progression || {}).tiers || []).map(t => t.id));

  function checkExpr(src, path, extraRoots) {
    if (src == null || typeof src === 'number' || typeof src === 'boolean') return;
    let info;
    try { X.compile(src); info = X.analyze(String(src)); } catch (e) { err(path, `Formula does not parse: ${e.message}`); return; }
    for (const id of info.ids) if (!ROOTS.has(id) && !(extraRoots && extraRoots.has(id)) && !FN.has(id)) err(path, `Unknown name '${id}' in "${src}"`);
    for (const f of info.fns) if (!FN.has(f)) err(path, `Unknown function '${f}()' in "${src}"`);
  }
  function checkTpl(text, path, extraRoots) {
    if (text == null) return;
    try { X.compileTemplate(String(text)); } catch (e) { err(path, `Text template broken: ${e.message}`); return; }
    const re = /\{([^{}]+)\}/g; let m;
    while ((m = re.exec(String(text)))) { let inner = m[1]; const pm = inner.match(/^(.*?)\|\s*([a-zA-Z]+)\s*$/); if (pm && !inner.includes('||')) inner = pm[1]; checkExpr(inner, path, extraRoots); }
  }
  function checkOps(ops, path, roots) {
    if (!ops) return;
    if (!Array.isArray(ops)) { err(path, 'Effects must be a list of operations'); return; }
    roots = new Set(roots || []);
    ops.forEach((op, i) => {
      const p = `${path}[${i}]`;
      if (!op || typeof op !== 'object') { err(p, 'Operation must be an object'); return; }
      const k = op.op || Object.keys(op)[0];
      if (!OPS.has(k)) { err(p, `Unknown operation '${k}'`); return; }
      switch (k) {
        case 'set': case 'add': case 'mul': case 'push': case 'pull':
          if (op.path) { const root = String(op.path).split('.')[0]; if (!ROOTS.has(root) && !roots.has(root)) err(p, `Unknown target '${root}' in path ${op.path}`); checkExpr(op.value, p + '.value', roots); }
          else if (op.target) { checkExpr(op.target, p + '.target', roots); if (!op.field) err(p, 'Missing field'); checkExpr(op.value, p + '.value', new Set([...roots, 'it'])); }
          else err(p, 'Needs path or target+field'); break;
        case 'let': if (!op.name) err(p, 'let needs a name'); checkExpr(op.value, p + '.value', roots); roots.add(op.name); break;
        case 'cash': checkExpr(op.amount, p + '.amount', roots); break;
        case 'resource': case 'res': if (!resIds.has(op.id)) err(p, `Unknown resource '${op.id}'`); checkExpr(op.add != null ? op.add : op.set, p, roots); break;
        case 'create':
          if (!kindNames.has(op.kind)) err(p, `Unknown kind '${op.kind}'`);
          else for (const [f, x] of Object.entries(op.set || {})) { if (!def.kinds[op.kind].fields[f] && !(def.kinds[op.kind].derived || {})[f] && f !== 'name') warn(p, `Field '${f}' is not declared on ${op.kind}`); checkExpr(x, `${p}.set.${f}`, new Set([...roots, 'i'])); }
          if (op.as) roots.add(op.as); roots.add('created'); if (op.then) checkOps(op.then, p + '.then', new Set([...roots, 'self'])); break;
        case 'remove': checkExpr(op.target || 'self', p, roots); break;
        case 'transfer': checkExpr(op.target, p, roots); checkExpr(op.to, p, roots); break;
        case 'project': if (!projectIds.has(op.id)) err(p, `Unknown project '${op.id}'`); for (const [f, x] of Object.entries(op.set || {})) checkExpr(x, `${p}.set.${f}`, roots); if (op.name) checkTpl(op.name, p + '.name', roots); break;
        case 'negotiate': if (!negIds.has(op.id)) err(p, `Unknown negotiation '${op.id}'`); checkExpr(op.with || op.target, p, roots); break;
        case 'stake': case 'stakeholder': if (!stakeIds.has(op.id)) err(p, `Unknown stakeholder '${op.id}'`); checkExpr(op.add != null ? op.add : op.value, p, roots); break;
        case 'remember': checkExpr(op.b || op.who, p, roots); if (op.a) checkExpr(op.a, p, roots); checkExpr(op.add != null ? op.add : op.value, p, roots); break;
        case 'news': case 'log': case 'timeline': checkTpl(op.text, p + '.text', roots); break;
        case 'moment': checkTpl(op.title, p + '.title', roots); checkTpl(op.text, p + '.text', roots); break;
        case 'event': if (!eventIds.has(op.id)) err(p, `Unknown event '${op.id}'`); if (op.bind) for (const x of Object.values(op.bind)) checkExpr(x, p + '.bind', roots); break;
        case 'if': checkExpr(op.cond || op.when, p + '.cond', roots); checkOps(op.then, p + '.then', roots); checkOps(op.else, p + '.else', roots); break;
        case 'chance': checkExpr(op.p != null ? op.p : op.chance, p + '.p', roots); checkOps(op.then, p + '.then', roots); checkOps(op.else, p + '.else', roots); break;
        case 'each': case 'forEach': { if (op.kind && !kindNames.has(op.kind)) err(p, `Unknown kind '${op.kind}'`); if (op.list) checkExpr(op.list, p + '.list', roots); const r2 = new Set([...roots, 'it', op.as || 'it']); if (op.filter) checkExpr(op.filter, p + '.filter', r2); checkOps(op.do || op.then, p + '.do', r2); break; }
        case 'loan': checkExpr(op.amount, p, roots); break;
        case 'repay': checkExpr(op.amount, p, roots); break;
        case 'policy': if (!policyIds.has(op.id)) err(p, `Unknown policy '${op.id}'`); break;
        case 'autoAct': if (!actionIds.has(op.action)) err(p, `Unknown action '${op.action}'`); else if (!(gdl.actions || []).find(a => a.id === op.action).ai) err(p, `Action '${op.action}' has no ai.score, so staff cannot perform it`); break;
        default: break;
      }
    });
  }

  // kinds
  for (const [k, kd] of Object.entries(kinds)) {
    const base = `kinds.${k}`;
    for (const [f, fd0] of Object.entries(kd.fields || {})) {
      const fd = typeof fd0 === 'string' ? { type: fd0 } : fd0;
      if (fd.type && !FIELD_TYPES.has(fd.type)) err(`${base}.fields.${f}`, `Unknown field type '${fd.type}'`);
      if ((fd.type === 'ref' || fd.type === 'refs') && fd.ref && !kindNames.has(fd.ref)) err(`${base}.fields.${f}`, `Refers to unknown kind '${fd.ref}'`);
      if (typeof fd.default === 'string' && fd.type !== 'text' && fd.type !== 'enum') checkExpr(fd.default, `${base}.fields.${f}.default`, new Set(['self']));
    }
    if (kd.records) { const ids = new Set(); kd.records.forEach((r, i) => { if (r.id != null) { if (ids.has(r.id)) err(`${base}.records[${i}]`, `Duplicate id ${r.id}`); ids.add(r.id); } }); }
    for (const [f, d] of Object.entries(kd.derived || {})) checkExpr(typeof d === 'string' ? d : d.expr, `${base}.derived.${f}`);
    if (kd.generate) { checkExpr(kd.generate.count, `${base}.generate.count`); for (const [f, x] of Object.entries(kd.generate.set || {})) checkExpr(x, `${base}.generate.set.${f}`, new Set(['i'])); }
    for (const u of [].concat(kd.upkeep || [])) { if (typeof u === 'string') checkExpr(u, `${base}.upkeep`); else { checkExpr(u.expr, `${base}.upkeep`); if (u.when) checkExpr(u.when, `${base}.upkeep.when`); } }
    for (const u of [].concat(kd.income || [])) { checkExpr(u.expr, `${base}.income`); if (u.when) checkExpr(u.when, `${base}.income.when`); }
    if (kd.tick) { checkOps(kd.tick, `${base}.tick`, new Set(['self'])); if (kd.tickWhen) checkExpr(kd.tickWhen, `${base}.tickWhen`); }
    if (kd.operate) {
      const op = kd.operate;
      if (op.market && !(gdl.markets || {})[op.market]) err(`${base}.operate.market`, `Unknown market '${op.market}'`);
      for (const x of ['capacity', 'price', 'active', 'utility']) if (op[x] != null) checkExpr(op[x], `${base}.operate.${x}`);
      for (const [a, x] of Object.entries(op.attrs || {})) checkExpr(x, `${base}.operate.attrs.${a}`);
      for (const l of op.revenue || []) checkExpr(l.expr, `${base}.operate.revenue`);
      for (const l of op.costs || []) checkExpr(l.expr, `${base}.operate.costs`);
      checkOps(op.after, `${base}.operate.after`);
      if (!op.capacity) err(`${base}.operate.capacity`, 'Operating kinds need a capacity formula');
      if (!op.price) err(`${base}.operate.price`, 'Operating kinds need a price formula');
    }
    if (kd.display) { if (kd.display.title) checkTpl(kd.display.title, `${base}.display.title`); if (kd.display.subtitle) checkTpl(kd.display.subtitle, `${base}.display.subtitle`); }
    if (kd.name && kd.name.template) checkTpl(kd.name.template, `${base}.name.template`);
  }
  // markets
  for (const [id, m] of Object.entries(gdl.markets || {})) {
    for (const x of ['key', 'size', 'refPrice', 'outside']) if (m[x] != null) checkExpr(m[x], `markets.${id}.${x}`);
    if (!m.segments || !m.segments.length) warn(`markets.${id}.segments`, 'No customer segments; a single segment will be assumed');
    (m.segments || []).forEach((s, i) => { if (s.size) checkExpr(s.size, `markets.${id}.segments[${i}].size`); if (typeof s.priceMult === 'string') checkExpr(s.priceMult, `markets.${id}.segments[${i}].priceMult`); if (s.capShare) checkExpr(s.capShare, `markets.${id}.segments[${i}].capShare`); });
  }
  // orgs
  const O = gdl.orgs || {};
  for (const m of O.metrics || []) checkExpr(m.expr, `orgs.metrics.${m.id}`);
  for (const c of [].concat(O.costs || [], O.income || [])) checkExpr(c.expr, `orgs.costs.${c.label}`);
  if (O.valuation) checkExpr(O.valuation, 'orgs.valuation'); if (O.assets) checkExpr(O.assets, 'orgs.assets');
  checkOps(O.tick, 'orgs.tick');
  if (O.player) { checkOps(O.player.start, 'orgs.player.start'); if (O.player.cash) checkExpr(O.player.cash, 'orgs.player.cash'); }
  if (O.rivals) { checkOps(O.rivals.start, 'orgs.rivals.start'); for (const a of O.rivals.archetypes || []) { checkOps(a.start, `orgs.rivals.archetypes.${a.id}.start`); for (const w of Object.keys(a.weights || {})) if (!actionIds.has(w)) warn(`orgs.rivals.archetypes.${a.id}.weights`, `Weight for unknown action '${w}'`); for (const [pid, v] of Object.entries(a.policies || {})) if (!policyIds.has(pid)) warn(`orgs.rivals.archetypes.${a.id}.policies`, `Unknown policy '${pid}'`); } }
  // resources / stakeholders / policies / world
  for (const r of gdl.resources || []) for (const d of r.drivers || []) checkExpr(d.expr, `resources.${r.id}.drivers`);
  for (const s of gdl.stakeholders || []) { for (const d of s.drivers || []) checkExpr(d.expr, `stakeholders.${s.id}.drivers`); for (const t of s.thresholds || []) if (t.event && !eventIds.has(t.event)) err(`stakeholders.${s.id}.thresholds`, `Unknown event '${t.event}'`); }
  for (const p of gdl.policies || []) { if (!p.options || !p.options.length) err(`policies.${p.id}`, 'Policy needs options'); for (const o of p.options || []) checkOps(o.effects, `policies.${p.id}.options.${o.value}`, ['self', 'policy']); }
  for (const v of ((gdl.world || {}).vars || [])) { const pr = v.process || {}; if (pr.expr) checkExpr(pr.expr, `world.vars.${v.id}.process.expr`); for (const sh of v.shocks || []) { checkExpr(sh.chance, `world.vars.${v.id}.shocks.${sh.id}`); if (sh.event && !eventIds.has(sh.event)) err(`world.vars.${v.id}.shocks.${sh.id}`, `Unknown event '${sh.event}'`); } }
  // actions
  const seenA = new Set();
  for (const a of gdl.actions || []) {
    const base = `actions.${a.id}`;
    if (!a.id) { err('actions', 'Action without id'); continue; }
    if (seenA.has(a.id)) err(base, 'Duplicate action id'); seenA.add(a.id);
    if (!a.label) warn(base, 'Missing label');
    if (a.kind && !kindNames.has(a.kind)) err(base + '.kind', `Unknown kind '${a.kind}'`);
    if (a.tier && !tierIds.has(a.tier)) err(base + '.tier', `Unknown tier '${a.tier}'`);
    const roots = new Set(Object.keys(a.vars || {}));
    for (const p of a.params || []) {
      if (!p.id || !p.type) { err(base + '.params', 'Param needs id and type'); continue; }
      if (p.type === 'entity' && !kindNames.has(p.kind)) err(`${base}.params.${p.id}`, `Unknown kind '${p.kind}'`);
      if (p.filter) checkExpr(p.filter, `${base}.params.${p.id}.filter`, roots); if (p.sort) checkExpr(p.sort, `${base}.params.${p.id}.sort`, roots);
      if (p.type === 'choice' && (!p.options || !p.options.length)) err(`${base}.params.${p.id}`, 'Choice needs options');
      for (const x of ['min', 'max', 'aiValue']) if (typeof p[x] === 'string') checkExpr(p[x], `${base}.params.${p.id}.${x}`, roots);
    }
    for (const [k, x] of Object.entries(a.vars || {})) checkExpr(x, `${base}.vars.${k}`, roots);
    const reqs = typeof a.requires === 'string' ? [{ expr: a.requires }] : (a.requires || []);
    for (const r of reqs) { checkExpr(r.expr || r.when, `${base}.requires`, roots); if (r.msg) checkTpl(r.msg, `${base}.requires.msg`, roots); }
    for (const [k, x] of Object.entries(a.cost || {})) { checkExpr(x, `${base}.cost.${k}`, roots); if (k !== 'cash' && !resIds.has(k)) err(`${base}.cost.${k}`, `Unknown resource '${k}'`); }
    if (a.forecast) { if (!kindNames.has(a.forecast.kind)) err(base + '.forecast', `Unknown kind '${a.forecast.kind}'`); for (const [f, x] of Object.entries(a.forecast.set || {})) checkExpr(x, `${base}.forecast.set.${f}`, roots); }
    for (const pv of a.preview || []) checkExpr(pv.expr, `${base}.preview.${pv.label}`, roots);
    checkOps(a.effects, base + '.effects', roots);
    if (!a.effects || !a.effects.length) err(base + '.effects', 'Action has no effects (a button that does nothing)');
    for (const x of ['describe', 'tradeoff', 'risk', 'result']) if (a[x]) checkTpl(a[x], `${base}.${x}`, roots);
    if (a.ai && a.ai.score) checkExpr(a.ai.score, `${base}.ai.score`, roots);
  }
  // events — names bound by whatever schedules the event ({op:'event', id, bind:{...}}) are valid too
  const schedBinds = {};
  (function scan(o) { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) { o.forEach(scan); return; } if (o.op === 'event' && o.id && o.bind) { schedBinds[o.id] = schedBinds[o.id] || new Set(); for (const k of Object.keys(o.bind)) schedBinds[o.id].add(k); } for (const v of Object.values(o)) scan(v); })(gdl);
  for (const ev of gdl.events || []) {
    const base = `events.${ev.id}`;
    const roots = new Set([...Object.keys(ev.bind || {}), ...(schedBinds[ev.id] || []), ...(ev.binds || [])]);
    for (const [n, b] of Object.entries(ev.bind || {})) { if (b.kind !== 'org' && !kindNames.has(b.kind)) err(`${base}.bind.${n}`, `Unknown kind '${b.kind}'`); if (b.filter) checkExpr(b.filter, `${base}.bind.${n}.filter`, roots); }
    if (ev.when) checkExpr(ev.when, base + '.when', roots); if (ev.chance) checkExpr(ev.chance, base + '.chance', roots);
    checkTpl(ev.title, base + '.title', roots); checkTpl(ev.text, base + '.text', roots);
    if (!['critical', 'important', 'routine', 'background'].includes(ev.priority || 'important')) err(base + '.priority', 'Priority must be critical, important, routine or background');
    (ev.choices || []).forEach((c, i) => { checkTpl(c.label, `${base}.choices[${i}].label`, roots); if (c.describe) checkTpl(c.describe, `${base}.choices[${i}].describe`, roots); checkOps(c.effects, `${base}.choices[${i}].effects`, roots); if (c.cost) checkExpr(c.cost, `${base}.choices[${i}].cost`, roots); });
    checkOps(ev.effects, base + '.effects', roots);
    if (!(ev.choices || []).length && !(ev.effects || []).length && !ev.news) warn(base, 'Event has neither choices nor effects');
    if ((ev.choices || []).length === 1) warn(base, 'An event with a single choice is not a decision (fake choice)');
  }
  for (const p of gdl.projects || []) (p.stages || []).forEach((s, i) => { checkExpr(s.duration, `projects.${p.id}.stages[${i}].duration`); if (s.cost) checkExpr(s.cost, `projects.${p.id}.stages[${i}].cost`); checkOps(s.onComplete, `projects.${p.id}.stages[${i}].onComplete`); checkOps(s.onEnter, `projects.${p.id}.stages[${i}].onEnter`); });
  for (const p of gdl.projects || []) checkOps(p.onComplete, `projects.${p.id}.onComplete`);
  for (const n of gdl.negotiations || []) {
    const ctx = new Set(Object.keys(n.context || {}));
    for (const [k, x] of Object.entries(n.context || {})) checkExpr(x, `negotiations.${n.id}.context.${k}`);
    checkExpr(n.value, `negotiations.${n.id}.value`, ctx); checkExpr(n.reservation, `negotiations.${n.id}.reservation`, ctx);
    checkOps(n.onAccept, `negotiations.${n.id}.onAccept`, ctx); checkOps(n.onReject, `negotiations.${n.id}.onReject`, ctx);
    for (const r of n.reasons || []) checkExpr(r.when, `negotiations.${n.id}.reasons`, ctx);
    for (const t of n.terms || []) for (const x of ['default', 'min', 'max']) if (typeof t[x] === 'string') checkExpr(t[x], `negotiations.${n.id}.terms.${t.id}.${x}`, ctx);
  }
  const pg = gdl.progression || {};
  for (const t of pg.tiers || []) if (t.when) checkExpr(t.when, `progression.tiers.${t.id}`);
  if (pg.failure) { checkExpr(pg.failure.when, 'progression.failure.when'); (pg.failure.rescue || []).forEach((r, i) => checkOps(r.effects, `progression.failure.rescue[${i}]`)); }
  if (pg.objectives) for (const o of pg.objectives.templates || []) { checkExpr(o.metric, `progression.objectives.${o.id}.metric`); checkExpr(o.target, `progression.objectives.${o.id}.target`); checkTpl(o.text, `progression.objectives.${o.id}.text`, new Set(['target', 'base'])); }
  const H = gdl.history || {};
  for (const r of H.records || []) checkExpr(r.expr, `history.records.${r.id}`);
  for (const a of H.awards || []) checkExpr(a.score, `history.awards.${a.id}`);
  for (const m of H.milestones || []) checkExpr(m.when, `history.milestones.${m.id}`);
  // ui
  const ui = gdl.ui || {};
  const screens = ui.screens || {};
  for (const n of ui.nav || []) if (!screens[n.id] && n.id !== 'home') err(`ui.nav.${n.id}`, 'Navigation item has no screen');
  if ((ui.nav || []).length > 7) warn('ui.nav', `${ui.nav.length} top-level destinations — menu maze risk (≤7 recommended)`);
  for (const [sid, sc] of Object.entries(screens)) {
    for (const aid of sc.actions || []) if (!actionIds.has(aid)) err(`ui.screens.${sid}.actions`, `Unknown action '${aid}'`);
    const secs = (sc.sections || []).concat(...(sc.tabs || []).map(t => t.sections || []));
    secs.forEach((s, i) => {
      const p = `ui.screens.${sid}.sections[${i}]`;
      if (!SECTIONS.has(s.type)) err(p, `Unknown section type '${s.type}'`);
      if (s.kind && s.kind !== 'org' && s.kind !== 'orgs' && !kindNames.has(s.kind)) err(p, `Unknown kind '${s.kind}'`);
      for (const aid of [].concat(s.rowActions || [], s.actions || [], s.ids && s.type === 'actions' ? s.ids : [])) if (!actionIds.has(aid)) err(p, `Unknown action '${aid}'`);
      for (const c of s.columns || []) checkExpr(c.expr, p + '.columns', new Set(['it', 'v']));
      for (const m of s.items || []) checkExpr(m.expr, p + '.items', new Set(['v']));
      if (s.filter) checkExpr(s.filter, p + '.filter'); if (s.sort) checkExpr(s.sort, p + '.sort');
      for (const m of [].concat(s.meters || [], s.type === 'showcase' ? s.stats || [] : [], s.headline ? [s.headline] : [])) checkExpr(m.expr, p + '.meters', new Set(['group', 'v']));
      for (const x of ['groupBy', 'weight', 'expr', 'glyph', 'groupSort']) if (typeof s[x] === 'string' && (s.type === 'showcase' || s.type === 'mix' || s.type === 'histogram')) checkExpr(s[x], p + '.' + x, new Set(['group']));
    });
  }
  if (!ui.nav) warn('ui.nav', 'No navigation defined; defaults will be generated');
  return { errors, warnings };
}

/* Dry run: simulate with a random bot. Returns runtime diagnostics. */
function dryRun(gdl, { ticks = 30, seed = 1, bot = 'random' } = {}) {
  const out = { ok: true, errors: [], warnings: [], stats: {} };
  let g;
  const t0 = Date.now();
  try { g = E.Game.create(gdl, { seed, headless: true }); } catch (e) { out.ok = false; out.errors.push({ path: 'create', msg: e.message }); return out; }
  out.stats.createMs = Date.now() - t0;
  const rng = new E.RNG('bot' + seed);
  const P = g.playerOrg();
  let actions = 0, failedActs = 0;
  for (let t = 0; t < ticks; t++) {
    // random valid actions (bot also exercises entity actions)
    for (let k = 0; k < 2; k++) {
      const pool = g.listActions(null).concat(...['_'].map(() => { const ents = []; for (const kind of g.def.kindOrder) for (const e of g.owned(kind, P.id).slice(0, 4)) ents.push(...g.listActions(e).map(a => ({ a, e }))); return ents; }));
      if (!pool.length) break;
      const pick = rng.pick(pool);
      const a = pick.a || pick, self = pick.e || null;
      if (a.effects && a.effects.some(op => op.op === 'negotiate')) { /* negotiations open a dialog; test them separately */ }
      const raw = g.defaultParams(a, P, self);
      const res = g.act(a.id, Object.fromEntries(Object.entries(raw).map(([k2, v]) => [k2, v && typeof v === 'object' ? v.id : v])), { self });
      if (res.ok) actions++; else failedActs++;
    }
    for (const n of Object.values(g.state.negotiations)) if (n.org === P.id) { g.offer(n.id, n.terms); if (g.state.negotiations[n.id]) g.walkAway(n.id); }
    for (const ev of g.state.events.pending.slice()) g.resolveEvent(ev.iid, rng.int(0, Math.max(0, ev.choices.length - 1)), true);
    if (g.state.progression.rescueOpen) g.chooseRescue(0);
    g.tick();
    if (!Number.isFinite(P.cash)) { out.errors.push({ path: 'runtime', msg: `Player cash became ${P.cash} at tick ${t}` }); break; }
    if (g.state.progression.over) break;
  }
  // invariants
  for (const k of g.def.kindOrder) for (const e of g.all(k)) for (const [f, v] of Object.entries(e)) if (typeof v === 'number' && !Number.isFinite(v)) { out.errors.push({ path: `entity ${k}.${f}`, msg: `Non-finite value ${v} on ${e.id}` }); break; }
  for (const o of Object.values(g.state.orgs)) for (const [f, v] of Object.entries(o.m || {})) if (typeof v === 'number' && !Number.isFinite(v)) out.errors.push({ path: `org metric ${f}`, msg: `Non-finite on ${o.name}` });
  for (const d of g.diag.errors) out.errors.push({ path: d.where, msg: d.msg });
  out.stats.ms = Date.now() - t0; out.stats.actions = actions; out.stats.failedActions = failedActs; out.stats.ticks = g.state.tick;
  out.stats.entities = g.def.kindOrder.reduce((a, k) => a + g.all(k).length, 0); out.stats.orgs = Object.keys(g.state.orgs).length;
  out.stats.saveBytes = g.serialize().length;
  try { const g2 = E.Game.load(gdl, g.serialize(), { headless: true }); g2.tick(); } catch (e) { out.errors.push({ path: 'save', msg: 'Reload failed: ' + e.message }); }
  out.ok = out.errors.length === 0;
  return out;
}

function validate(gdl, opts = {}) {
  const st = validateStatic(gdl);
  let dyn = null;
  if (!st.errors.length && opts.dryRun !== false) dyn = dryRun(gdl, opts);
  const errors = st.errors.concat(dyn ? dyn.errors : []);
  return { ok: errors.length === 0, errors, warnings: st.warnings.concat(dyn ? dyn.warnings : []), stats: dyn ? dyn.stats : null };
}
module.exports = { validate, validateStatic, dryRun, ROOTS, OPS, SECTIONS };
