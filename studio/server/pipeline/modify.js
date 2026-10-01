/* Modification requests on an EXISTING game ("route system too tedious", "late game too easy",
   "fleet page much more visual", "simplify", "add X"). A request is classified into intents; each
   intent has a deterministic recipe that inspects the game definition and produces targeted patch
   ops. Recipes are generic: they look for structure (operating kinds, their create/adjust actions,
   screens with entity lists), not for one genre. A local model, when available, handles requests no
   recipe covers (changePlanner) and can refine recipe output. Nothing is rewritten wholesale. */
'use strict';
const patch = require('./patch');

const has = (re, t) => re.test(t);
const INTENTS = [
  { id: 'export', re: /\b(export|standalone|single[- ]?(file|html)|ship it|release|package)\b/i },
  { id: 'delegate', re: /(tedious|micro-?manag|repetitive|busywork|too many clicks|grind|chore|automate|automation|higher[- ]level|delegat|less manual|hands[- ]off)/i },
  { id: 'balance', re: /(too easy|too hard|too difficult|easy|difficult|rebalance|re-balance|balance|snowball|runaway|challenge|challenging|punishing|forgiving|economy)/i },
  { id: 'visual', re: /(visual|graphic|prettier|beautiful|look better|charts?|more pictures|eye[- ]candy|dashboard|more vivid|illustrat)/i },
  { id: 'simplify', re: /(simplif|overwhelm|too complex|too complicated|cluttered|too many (screens|buttons|menus|options)|confusing|streamline)/i },
  { id: 'deepen', re: /(deeper|more depth|more strategic|more decisions|more complex|more options|richer)/i },
  { id: 'fix', re: /(bug|broken|crash|error|doesn'?t work|not working|freez|stuck|wrong)/i }
];
function classify(request) {
  const t = String(request);
  const intents = INTENTS.filter(i => i.re.test(t)).map(i => i.id);
  // "late game too easy" is a balance request even though it also mentions difficulty words
  if (intents.includes('delegate') && intents.includes('balance') && !/(easy|hard|difficult|balance)/i.test(t)) intents.splice(intents.indexOf('balance'), 1);
  const out = { intents: intents.length ? intents : ['feature'] };
  if (intents.includes('balance')) {
    out.direction = /(too easy|easy|forgiving|snowball|runaway|not challenging|more challenge|harder)/i.test(t) ? 'harder' : /(too hard|too difficult|punishing|easier|frustrat)/i.test(t) ? 'easier' : 'auto';
    out.phase = /(late|end[- ]?game|mid[- ]?game|later|once you|after a few|long[- ]term)/i.test(t) ? 'late' : /(early|start|opening|first (year|few))/i.test(t) ? 'early' : 'all';
  }
  return out;
}

/* ---------- helpers that read structure from a GDL ---------- */
const arr = (x) => Array.isArray(x) ? x : Object.values(x || {});
function operatingKinds(gdl) { return Object.entries(gdl.kinds || {}).filter(([, kd]) => kd.operate).map(([k]) => k); }
function words(s) { return String(s || '').toLowerCase().match(/[a-z]{3,}/g) || []; }
const stem = (w) => w.replace(/(ies)$/, 'y').replace(/(es|s)$/, '');
function mentionScore(request, label) { const r = new Set(words(request).map(stem)); return words(label).map(stem).filter(w => r.has(w)).length; }
/* Which kind does the request talk about? Falls back to the main operating kind. */
function targetKind(gdl, request) {
  let best = null, bs = 0;
  for (const [k, kd] of Object.entries(gdl.kinds || {})) {
    const managed = managedKinds(gdl).includes(k);
    const sc = mentionScore(request, `${k} ${kd.label || ''} ${kd.plural || ''}`) * (kd.operate ? 1.5 : managed ? 1.2 : 0.5);
    if (sc > bs) { bs = sc; best = k; }
  }
  return best || operatingKinds(gdl)[0] || managedKinds(gdl)[0] || null;
}
function targetScreen(gdl, request) {
  const screens = (gdl.ui && gdl.ui.screens) || {};
  const nav = (gdl.ui && gdl.ui.nav) || [];
  let best = null, bs = 0;
  for (const [id, sc] of Object.entries(screens)) {
    const navItem = nav.find(n => n.id === id);
    const s = mentionScore(request, `${id} ${sc.title || ''} ${navItem ? navItem.label : ''}`) * 2 + mentionScore(request, JSON.stringify(sc).slice(0, 4000)) * 0.05;
    if (s > bs) { bs = s; best = id; }
  }
  return bs >= 1 ? best : null;
}
const navLabel = (gdl, sid) => { const n = ((gdl.ui && gdl.ui.nav) || []).find(x => x.id === sid); return n ? n.label : sid; };
/* Does an action bring a new unit of `k` into the company? (create it, or take ownership of one) */
const creates = (a, k) => {
  const walk = (ops) => (ops || []).some(op => (op.op === 'create' && op.kind === k) || (op.op === 'transfer' && /org/.test(String(op.to)) && (a.params || []).some(p => p.kind === k && String(op.target).includes('param.' + p.id))) || walk(op.then) || walk(op.else) || walk(op.do));
  return walk(a.effects);
};
/* Kinds the player manages: owned lists on screens, or units with create/adjust actions. */
function managedKinds(gdl) {
  const acts = arr(gdl.actions);
  return Object.keys(gdl.kinds || {}).map(k => ({ k, n: acts.filter(a => !a.aiOnly && a.ai && (a.kind === k || creates(a, k))).length + (gdl.kinds[k].operate ? 2 : 0) })).filter(x => x.n > 0).sort((a, b) => b.n - a.n).map(x => x.k);
}
function actionsFor(gdl, kind) {
  const acts = arr(gdl.actions);
  return {
    create: acts.filter(a => a.scope !== 'entity' && !a.kind && creates(a, kind) && a.ai && !a.playerOnly),
    adjust: acts.filter(a => a.kind === kind && a.ai),
    adjustManual: acts.filter(a => a.kind === kind && !a.ai && a.forecast && a.params && a.params.length === 1 && a.params[0].type === 'choice'),
    supply: acts.filter(a => !a.kind && a.ai && !creates(a, kind) && (a.effects || []).some(op => op.op === 'project' || op.op === 'create') && !(a.effects || []).some(op => op.op === 'acquireOrg' || op.op === 'mergeOrg' || op.op === 'negotiate') && /(lease|order|hire|buy|recruit|acquire|build|purchase|sign)/i.test(a.id + ' ' + a.label))
  };
}
/* The screen where the player manages a kind: has a player-owned list of it with row actions; the
   home dashboard only as a last resort. A screen named in the request wins. */
function screenOfKind(gdl, kind, request) {
  const screens = (gdl.ui && gdl.ui.screens) || {};
  const named = request ? targetScreen(gdl, request) : null;
  if (named && named !== 'home') return named;
  let best = null, bs = -1;
  for (const [id, sc] of Object.entries(screens)) {
    const secs = (sc.sections || []).concat(...(sc.tabs || []).map(t => t.sections || []));
    const mine = secs.filter(s => s.kind === kind && s.owner === 'player');
    if (!mine.length) continue;
    const score = mine.length + mine.filter(s => s.rowActions || s.actions).length * 2 + (id === 'home' ? -10 : 0) + (sc.actions || []).filter(a => (arr(gdl.actions).find(x => x.id === a) || {}).effects && creates(arr(gdl.actions).find(x => x.id === a), kind)).length * 3;
    if (score > bs) { bs = score; best = id; }
  }
  return best;
}

/* ---------- recipe: delegate tedious unit-by-unit work to a strategy layer ---------- */
function recipeDelegate(gdl, request) {
  const kind = targetKind(gdl, request);
  if (!kind) return { ops: [], notes: ['No operating unit found to delegate.'] };
  const kd = gdl.kinds[kind];
  const L = (kd.label || kind).toLowerCase(), Ls = (kd.plural || L + 's').toLowerCase();
  const A = actionsFor(gdl, kind);
  if (!A.create.length && !A.adjust.length) return { ops: [], notes: [`No automatable actions for ${Ls}.`] };
  const open = A.create[0];
  const closers = A.adjust.filter(a => a.danger || /(close|drop|exit|sell|shut|cancel|retire)/i.test(a.id + a.label));
  const growers = A.adjust.filter(a => !closers.includes(a));
  const ops = [], notes = [];
  const pid = (s) => `${kind}${s}`;
  const existing = new Set(arr(gdl.policies).map(p => p.id));
  const auto = (id, max, min) => ({ op: 'autoAct', action: id, max: String(max), minScore: min });
  // 1) growth strategy: where the planners take the network next, and how fast
  const growthOpts = open ? [
    { value: 'manual', label: 'Manual', describe: `You plan every ${L} yourself.` },
    { value: 'cautious', label: 'Cautious', describe: `Your team adds a ${L} only when the numbers are clearly good, and looks after the ones you have.`, effects: [].concat([auto(open.id, 1, 'max(1, org.revenueYear * 0.004)')], growers.map(a => auto(a.id, 1, '0'))) },
    { value: 'steady', label: 'Steady growth', describe: `Your team takes the best opportunities each month and invests where it pays.`, effects: [].concat([auto(open.id, 2, '0')], growers.map(a => auto(a.id, 2, '0'))) },
    { value: 'aggressive', label: 'Land grab', describe: `Your team expands fast — more ${Ls}, thinner margins, more risk.`, effects: [].concat([auto(open.id, 3, '-(org.revenueYear * 0.002)')], growers.map(a => auto(a.id, 3, '0'))) }
  ] : [
    { value: 'manual', label: 'Manual', describe: `You manage every ${L} yourself.` },
    { value: 'light', label: 'Light touch', describe: `Your staff step in only when a ${L} clearly needs it.`, effects: growers.map(a => auto(a.id, 1, 'max(1, org.revenueYear * 0.002)')) },
    { value: 'steady', label: 'Standard', describe: `Your staff run the routine decisions for every ${L} each month.`, effects: growers.map(a => auto(a.id, 1, '0')) },
    { value: 'proactive', label: 'Proactive', describe: `Your staff push every ${L} hard — more spending, more upside.`, effects: growers.map(a => auto(a.id, 2, '0')) }
  ];
  ops.push({ op: 'append', path: 'policies', value: { id: pid('Growth'), label: `${kd.label || kind} strategy`, scope: 'org', default: 'steady', aiDefault: 'manual', every: 4, playerOnly: true,
    describe: `Set the direction; your planning team picks, launches and sizes individual ${Ls} every month using the same forecasts you see. Switch to Manual any time.`, options: growthOpts }, why: `Strategic layer over individual ${Ls}` });
  // 2) portfolio pruning
  if (closers.length) {
    ops.push({ op: 'append', path: 'policies', value: { id: pid('Pruning'), label: `Underperforming ${Ls}`, scope: 'org', default: 'prune', aiDefault: 'manual', every: 4, playerOnly: true,
      describe: `What the team does with ${Ls} that keep losing money. Pricing and capacity policies keep working on every ${L} either way.`,
      options: [
        { value: 'manual', label: 'Ask me', describe: 'Losers stay on your desk (Needs you).' },
        { value: 'prune', label: 'Close chronic losers', describe: `${kd.plural || kind} that have lost money for months are closed; new ones get time to mature.`, effects: closers.map(a => auto(a.id, 2, '0')) }
      ] }, why: `Automatic handling of losing ${Ls}` });
    notes.push(`Chronic losers are closed by policy (or kept on your desk if you prefer).`);
  }
  // 3) supply planning (fleet, staff, inventory…) so growth is not blocked by the next tedious task
  if (A.supply.length) {
    ops.push({ op: 'append', path: 'policies', value: { id: pid('Capacity'), label: 'Capacity planning', scope: 'org', default: 'manual', aiDefault: 'manual', every: 4, playerOnly: true,
      describe: `Let the team acquire capacity (${A.supply.map(a => a.label.toLowerCase()).join(', ')}) when the network is short of it.`,
      options: [
        { value: 'manual', label: 'Manual', describe: 'You decide every acquisition.' },
        { value: 'match', label: 'Match demand', describe: 'Acquire when everything is busy and demand is strong.', effects: A.supply.slice(0, 2).map(a => auto(a.id, 1, '0')) }
      ] }, why: 'Capacity follows strategy' });
  }
  // policies are re-applied if the ids already exist (append replaces by id)
  void existing;
  // 4) put the strategy layer at the top of the screen that lists these units
  const sid = screenOfKind(gdl, kind, request);
  if (sid) {
    const sc = gdl.ui.screens[sid];
    const sec = { type: 'policies', width: 'full', title: `${kd.label || kind} strategy — you set direction, your planners do the legwork`, ids: [pid('Growth')].concat(closers.length ? [pid('Pruning')] : [], A.supply.length ? [pid('Capacity')] : []), tour: 'strategy' };
    const feed = { type: 'feed', width: 'full', title: 'What your planners did', tag: 'delegated', limit: 8 };
    if (sc.tabs && sc.tabs.length) {
      ops.push({ op: 'insert', path: `ui.screens.${sid}.tabs`, index: 0, value: { id: 'strategy', label: 'Strategy', sections: [sec, feed] } });
    } else {
      ops.push({ op: 'insert', path: `ui.screens.${sid}.sections`, index: 0, value: sec });
      ops.push({ op: 'append', path: `ui.screens.${sid}.sections`, value: feed });
    }
    notes.push(`Added a Strategy tab/panel to the ${navLabel(gdl, sid)} screen.`);
  }
  // 5) needs-you queue should stop nagging about routine unit work the team now owns
  ops.push({ op: 'set', path: 'meta.delegation', value: Object.assign({}, gdl.meta && gdl.meta.delegation, { [kind]: pid('Growth') }) });
  notes.push(`New policies: ${kd.label || kind} strategy (${growthOpts.map(o => o.label).join(' / ')})${closers.length ? ', underperformer handling' : ''}${A.supply.length ? ', capacity planning' : ''}. Defaults hand routine ${L} work to your planners; Manual restores full control.`);
  return { ops, notes, kind };
}

/* ---------- recipe: balance via the Balance Lab (async; returns a runner) ---------- */
function recipeBalance(gdl, request, cls) {
  const knobs = (gdl.balance && gdl.balance.knobs) || [];
  const ops = [], notes = [];
  if (!knobs.length) notes.push('This game declares no balance knobs; the critic will propose parameter changes.');
  // Late-game pressure that does not punish the opening: costs that grow with DOMINANCE (your value
  // relative to the average company) — regulation, bureaucracy, antitrust attention, coordination.
  // An average-sized company pays nothing; a company five times the average pays several % of revenue.
  if (cls.phase === 'late' && cls.direction !== 'easier' && !(gdl.params && gdl.params.dominanceK != null)) {
    ops.push({ op: 'set', path: 'params.dominanceK', value: 0.035 });
    ops.push({ op: 'append', path: 'orgs.costs', value: { label: 'Size & market-power costs', expr: 'params.dominanceK * max(0, org.revenue) * max(0, log(max(1, org.value / max(1, avg(orgs(), it.value)))))' } });
    ops.push({ op: 'append', path: 'balance.knobs', value: { path: 'params.dominanceK', label: 'Cost of dominance (regulation, bureaucracy, scrutiny)', effect: 'harder', min: 0.01, max: 0.2, phase: 'late' } });
    notes.push('Adds a late-game system: costs of dominance (regulation, bureaucracy, antitrust attention) that grow with your size relative to the average competitor. Small companies pay nothing.');
  }
  const late = knobs.filter(k => k.phase === 'late');
  notes.push(`Balance Lab: simulate many playthroughs with different strategies, diagnose${cls.phase === 'late' ? ' the late game' : ''}, adjust ${cls.phase === 'late' && late.length ? late.map(k => (k.label || k.path).toLowerCase()).join(' and ') : 'the balance parameters'}, then simulate again and compare.`);
  return { ops, notes, needsLab: true, focus: cls.phase === 'late' ? 'late' : undefined, direction: cls.direction };
}

/* A natural category to group a kind by: a reference to a catalog (records) kind — e.g. aircraft
   type, restaurant concept, company sector — or one hop further, or a short text field. */
function naturalGroup(gdl, kind) {
  const kd = gdl.kinds[kind] || {};
  const fields = Object.entries(kd.fields || {}).map(([f, fd]) => [f, typeof fd === 'string' ? { type: fd } : fd]);
  const role = fields.find(([f, fd]) => fd.type === 'text' && f === 'role');
  if (role) return 'it.role';
  const refs = fields.filter(([, fd]) => fd.type === 'ref' && gdl.kinds[fd.ref]);
  const catalog = refs.find(([, fd]) => (gdl.kinds[fd.ref].records || []).length && fd.ref !== 'city' && fd.ref !== 'airport');
  if (catalog) return `it.${catalog[0]}.name`;
  for (const [f, fd] of refs) {
    const inner = Object.entries(gdl.kinds[fd.ref].fields || {}).find(([, x]) => x && typeof x === 'object' && x.type === 'ref' && gdl.kinds[x.ref] && (gdl.kinds[x.ref].records || []).length);
    if (inner) return `it.${f}.${inner[0]}.name`;
  }
  const text = fields.find(([f, fd]) => fd.type === 'text' && /^(role|stage|type|category|genre|kind|segment)$/.test(f));
  if (text) return `it.${text[0]}`;
  return "'All'";
}
const groupWord = (expr) => expr === "'All'" ? 'group' : expr.replace(/^it\./, '').replace(/\.name$/, '').split('.').slice(-1)[0];

/* ---------- recipe: make a screen much more visual ---------- */
function recipeVisual(gdl, request) {
  const sid = targetScreen(gdl, request) || 'home';
  const sc = gdl.ui && gdl.ui.screens && gdl.ui.screens[sid];
  if (!sc) return { ops: [], notes: [`Screen “${sid}” not found.`] };
  const secs = (sc.sections || []).concat(...(sc.tabs || []).map(t => t.sections || []));
  const list = secs.find(s => (s.type === 'cards' || s.type === 'table') && s.kind && s.owner === 'player') || secs.find(s => (s.type === 'cards' || s.type === 'table') && s.kind);
  const ops = [], notes = [];
  if (!list) {
    // no entity list: promote metrics into a chart-rich layout
    notes.push('No entity list on this screen; added trend charts for its metrics.');
    const m = secs.find(s => s.type === 'metrics');
    const series = m ? (m.items || []).filter(i => i.metric).slice(0, 3).map(i => ({ label: i.label, metric: i.metric })) : [];
    if (series.length) ops.push({ op: 'append', path: `ui.screens.${sid}.sections`, value: { type: 'chart', width: 'full', title: 'Trends', series, window: 104 } });
    return { ops, notes, screen: sid };
  }
  const kind = list.kind, kd = gdl.kinds[kind] || {};
  const groupBy = list.groupBy || naturalGroup(gdl, kind);
  const glyph = list.glyph || "'star'";
  const statusTone = list.badgeTone || null;
  const numStats = (list.stats || list.columns || []).filter(st => /num|int|money|pct|score|x/.test(st.format || '') && !/\?|'/.test(st.expr));
  const label = (kd.plural || kind).toLowerCase();
  const ageStat = numStats.find(st => /\bage\b/i.test(st.label));
  const meters = [];
  if (statusTone) meters.push({ label: 'In service', expr: `count(group, ${statusTone.replace(/'good'/g, 'true').replace(/'warn'|'bad'|'info'/g, 'false')}) / max(1, len(group))`, format: 'pct', tone: "v < 0.8 ? 'warn' : 'good'" });
  if (ageStat) meters.push({ label: `Avg ${ageStat.label.toLowerCase()}`, expr: `round(avg(group, ${ageStat.expr}), 1)`, max: '25', format: 'num', tone: "v > 15 ? 'bad' : v > 10 ? 'warn' : 'good'" });
  const tileStats = numStats.filter(st => st !== ageStat).slice(0, 3).map(st => ({ label: st.label, expr: /seat|capacity|size/i.test(st.label) ? `sum(group, ${st.expr})` : `avg(group, ${st.expr})`, format: st.format }));
  const showcase = { type: 'showcase', width: 'full', title: `Your ${label} at a glance`, kind, owner: 'player', groupBy, groupSort: 'len(group)',
    glyph, glyphColor: "'var(--accent)'", glyphScale: '0.95',
    headline: { expr: 'len(group)', format: 'int', label: label }, meters, stats: tileStats.slice(0, 3),
    dots: statusTone ? { tone: statusTone } : undefined, tour: 'showcase' };
  // (glyph expressions reference `it`; inside a group tile `it` is bound to the group's first member)
  const visuals = [showcase];
  // composition donut
  const catField = kd.fields && kd.fields.type ? (gdl.kinds[(kd.fields.type || {}).ref] && gdl.kinds[(kd.fields.type || {}).ref].fields && gdl.kinds[(kd.fields.type || {}).ref].fields.category ? 'it.type.category' : 'it.type.name') : groupBy;
  const capStat = numStats.find(st => /seat|capacity|size|cover/i.test(st.label));
  visuals.push({ type: 'mix', width: 'half', title: capStat ? `Capacity mix (${capStat.label.toLowerCase()})` : `${kd.plural || kind} by type`, kind, owner: 'player', groupBy: catField, weight: capStat ? capStat.expr : undefined, format: 'int', centerLabel: capStat ? capStat.label.toLowerCase() : label });
  if (ageStat) visuals.push({ type: 'histogram', width: 'half', title: `${ageStat.label} profile`, kind, owner: 'player', expr: ageStat.expr, bins: [0, 4, 8, 12, 16, 20, 25], tone: "v >= 20 ? 'bad' : v >= 12 ? 'warn' : 'good'", unit: `${kd.plural || kind} by ${ageStat.label.toLowerCase()} (years). Older units cost more to maintain and hurt reliability.` });
  const pipeline = secs.find(s => s.type === 'pipeline');
  if (pipeline) visuals.push(Object.assign({}, pipeline, { width: 'full' }));
  // the existing detailed list becomes the second tab, rendered as compact cards
  const detail = secs.filter(s => s !== pipeline).map(s => s === list && s.type === 'cards' ? Object.assign({}, s, { size: 's' }) : s);
  ops.push({ op: 'set', path: `ui.screens.${sid}.tabs`, value: [
    { id: 'overview', label: 'Overview', sections: visuals },
    { id: 'all', label: `Every ${kd.label ? kd.label.toLowerCase() : kind}`, sections: detail }
  ] });
  ops.push({ op: 'set', path: `ui.screens.${sid}.sections`, value: [] });
  notes.push(`${navLabel(gdl, sid)}: new visual Overview — a tile per ${groupWord(groupBy)} with silhouettes, live status dots${meters.length ? ', ' + meters.map(m => m.label.toLowerCase()).join(' and ') + ' meters' : ''}, a capacity-mix donut${ageStat ? ' and an age histogram' : ''}. The full list moved to its own tab.`);
  return { ops, notes, screen: sid };
}

/* ---------- recipe: simplify ---------- */
function recipeSimplify(gdl) {
  const ops = [], notes = [];
  const nav = (gdl.ui && gdl.ui.nav) || [];
  if (nav.length > 6) { notes.push(`Navigation reduced from ${nav.length} to 6 destinations (the rest are reachable from their parent screens).`); ops.push({ op: 'set', path: 'ui.nav', value: nav.slice(0, 6) }); }
  // default every policy that has an automated option to it, so routine work is delegated
  for (const p of arr(gdl.policies)) {
    if (p.default === 'manual' && (p.options || []).length > 1) { const auto = p.options.find(o => o.value !== 'manual' && o.effects); if (auto) { ops.push({ op: 'set', path: `policies[${p.id}].default`, value: auto.value }); notes.push(`“${p.label}” now starts delegated (${auto.label}).`); } }
  }
  // fewer routine events: halve background/routine event chances
  for (const e of arr(gdl.events)) if ((e.priority === 'routine' || e.priority === 'background') && e.chance) ops.push({ op: 'set', path: `events[${e.id}].chance`, value: `(${e.chance}) * 0.5` });
  if (ops.length) notes.push('Routine notifications halved.');
  return { ops, notes };
}

/* ---------- recipe: deepen — enable pack features that were automated or cut ---------- */
function recipeDeepen(gdl, request, features) {
  const notes = [], flags = {};
  for (const f of features || []) if (f.flag && (f.verdict === 'cut' || f.verdict === 'automate' || f.verdict === 'merge')) { flags[f.flag] = true; notes.push(`Enable: ${f.label}`); }
  return { ops: [], flags, notes };
}
/* Feature requests that match a pack feature flag (e.g. "add alliances") */
function recipeFeatureFlags(request, packFeatures) {
  const t = String(request).toLowerCase();
  const flags = {}, notes = [];
  for (const f of packFeatures || []) if (f.flag && f.keywords.some(k => t.includes(k.toLowerCase()))) { flags[f.flag] = !/(remove|without|disable|no more|get rid)/i.test(t); notes.push(`${flags[f.flag] ? 'Enable' : 'Disable'}: ${f.label}`); }
  return { flags, notes };
}

/* Plan a modification (deterministic part). Async work (Balance Lab, LLM) happens in the orchestrator. */
function plan(gdl, request, ctx = {}) {
  const cls = classify(request);
  const out = { request, classification: cls, steps: [] };
  for (const intent of cls.intents) {
    if (intent === 'delegate') out.steps.push(Object.assign({ intent }, recipeDelegate(gdl, request)));
    else if (intent === 'balance') out.steps.push(Object.assign({ intent }, recipeBalance(gdl, request, cls)));
    else if (intent === 'visual') out.steps.push(Object.assign({ intent }, recipeVisual(gdl, request)));
    else if (intent === 'simplify') out.steps.push(Object.assign({ intent }, recipeSimplify(gdl)));
    else if (intent === 'deepen') out.steps.push(Object.assign({ intent }, recipeDeepen(gdl, request, ctx.features)));
    else if (intent === 'export') out.steps.push({ intent, ops: [], notes: ['Export the current version as a standalone HTML file and a dev project.'], export: true });
    else if (intent === 'fix') out.steps.push({ intent, ops: [], notes: ['Run diagnostics (tests, dry run, browser QA) and repair what fails.'], diagnose: true });
    else {
      const ff = recipeFeatureFlags(request, ctx.packFeatures);
      out.steps.push({ intent: 'feature', ops: [], flags: ff.flags, notes: ff.notes, needsLLM: !Object.keys(ff.flags).length });
    }
  }
  return out;
}
function applySteps(gdl, steps) {
  const ops = [].concat(...steps.map(s => s.ops || []));
  return patch.apply(gdl, ops);
}
module.exports = { classify, plan, applySteps, recipeDelegate, recipeBalance, recipeVisual, recipeSimplify, recipeFeatureFlags, targetKind, targetScreen, actionsFor };
