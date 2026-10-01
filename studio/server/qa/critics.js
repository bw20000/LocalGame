/* Critics. Deterministic first (they always run, cost nothing, and are reproducible); a local
   model critic can add judgement on top (stages.designCritic). Each finding has an id from the
   failure taxonomy, a severity, evidence, and a concrete fix the studio can apply. */
'use strict';
const arr = (x) => Array.isArray(x) ? x : Object.values(x || {});

/* UX critic — reads the game definition plus browser DOM metrics (when browser QA ran). */
function ux(gdl, browser) {
  const F = [];
  const add = (id, severity, text, fix, evidence) => F.push({ id, severity, area: 'ux', text, fix, evidence });
  const ui = gdl.ui || {}, nav = ui.nav || [], screens = ui.screens || {};
  if (nav.length > 7) add('menu-maze', 'major', `${nav.length} top-level destinations.`, 'Merge destinations into ≤7 task-based screens; move detail into tabs and inspectors.');
  for (const [sid, sc] of Object.entries(screens)) {
    const secs = (sc.sections || []).concat(...(sc.tabs || []).map(t => t.sections || []));
    const tabs = (sc.tabs || []).length;
    if (!tabs && secs.length > 9) add('dashboard-syndrome', 'minor', `Screen “${sid}” shows ${secs.length} panels at once.`, 'Split into tabs by task, or move secondary panels into the inspector.', { screen: sid });
    if (secs.length && !secs.some(s => /map|chart|cards|board|showcase|mix|histogram|pipeline|rankings|stakeholders/.test(s.type))) add('number-soup', 'minor', `Screen “${sid}” has no visual element — only lists and numbers.`, 'Add a signature visual (map, board, showcase or chart) that answers the screen’s main question at a glance.', { screen: sid });
    for (const s of secs) if (s.type === 'table' && (s.columns || []).length > 9) add('wide-table', 'minor', `Table “${s.title || s.kind}” on ${sid} has ${(s.columns || []).length} columns.`, 'Keep ≤8 columns; put the rest in the inspector.', { screen: sid });
  }
  const acts = arr(gdl.actions).filter(a => !a.aiOnly);
  const noTrade = acts.filter(a => (a.cost || a.danger || a.forecast) && !a.tradeoff && !a.risk);
  if (noTrade.length > 2) add('hidden-tradeoffs', 'minor', `${noTrade.length} costly actions don't say what you give up: ${noTrade.slice(0, 5).map(a => a.label).join(', ')}.`, 'Add tradeoff/risk text to each.', noTrade.map(a => a.id));
  const creates = acts.filter(a => (a.effects || []).some(op => op.op === 'create' && gdl.kinds[op.kind] && gdl.kinds[op.kind].operate));
  const noFc = creates.filter(a => !a.forecast && !(a.preview || []).length);
  if (noFc.length) add('blind-decisions', 'major', `Actions that create operating units without a forecast: ${noFc.map(a => a.label).join(', ')}.`, 'Add forecast + preview so the player sees expected results before committing.');
  if (!arr(gdl.policies).length) add('micromanagement', 'major', 'No policies — every routine decision is manual.', 'Add delegation policies for routine work (pricing, staffing, maintenance).');
  if (!gdl.onboarding || !(gdl.onboarding.steps || []).length) add('no-onboarding', 'major', 'No guided onboarding.', 'Add an intro and 4–7 coach-mark steps tied to real UI targets.');
  const metricsNoExplain = [];
  for (const sc of Object.values(screens)) for (const s of (sc.sections || []).concat(...(sc.tabs || []).map(t => t.sections || []))) if (s.type === 'metrics') for (const m of s.items || []) if (!m.metric && !m.explain) metricsNoExplain.push(m.label);
  if (metricsNoExplain.length > 6) add('unexplained-numbers', 'minor', `${metricsNoExplain.length} headline numbers have no “Why?” breakdown or history.`, 'Link metrics to a tracked metric or an explain driver.', metricsNoExplain.slice(0, 8));
  if (!gdl.theme || !gdl.theme.motif) add('generic-look', 'minor', 'No visual motif — screenshots will look generic.', 'Pick an industry motif (e.g. departure-board for airlines).');
  if (browser && !browser.skipped) {
    for (const [sid, m] of Object.entries(browser.metrics && browser.metrics.screens || {})) {
      if (m.words > 650) add('text-wall', 'minor', `“${sid}” shows ~${m.words} words at once.`, 'Summarize; move detail into inspectors or tabs.', m);
      if (m.numbers > 220) add('number-soup', 'minor', `“${sid}” shows ~${m.numbers} numbers at once.`, 'Highlight the 3–5 numbers that drive decisions; paginate the rest.', m);
      if (m.buttons > 70) add('button-overload', 'minor', `“${sid}” has ${m.buttons} buttons.`, 'Use row menus or the inspector for per-row actions.', m);
      if (m.overflowX) add('layout-overflow', 'major', `“${sid}” overflows horizontally at desktop width.`, 'Constrain wide tables; wrap metrics.', m);
    }
    for (const [name, l] of Object.entries(browser.layout || {})) if (l.overflowX) add('layout-overflow', 'major', `Layout overflows on a ${name} screen (${l.scrollW}px).`, 'Fix responsive rules.', l);
    for (const st of browser.steps || []) if (!st.ok) add('ui-broken', 'critical', `Browser check failed: ${st.name}${st.note ? ' — ' + st.note : ''}.`, 'Repair the failing interaction.', st);
    if (browser.metrics && browser.metrics.msPerTurnUI > 900) add('slow-turns', 'major', `A turn takes ~${browser.metrics.msPerTurnUI} ms including rendering.`, 'Lower simulation level for background entities; render only the visible screen.');
  }
  return F;
}

/* Design critic — structure of decisions, events, progression, rivals; plus playtest findings. */
function design(gdl, balance) {
  const F = [];
  const add = (id, severity, text, fix, evidence) => F.push({ id, severity, area: 'design', text, fix, evidence });
  const events = arr(gdl.events);
  const generic = events.filter(e => /unexpected event|something happened|an event occurred/i.test(JSON.stringify([e.title, e.text])));
  if (generic.length) add('generic-events', 'major', `${generic.length} events have generic text.`, 'Bind events to real entities and quote real numbers.', generic.map(e => e.id));
  const unbound = events.filter(e => !e.bind && !e.when && !(e.trigger) && (e.choices || []).length);
  if (events.length && unbound.length / events.length > 0.6) add('random-events', 'minor', `${unbound.length}/${events.length} events are not tied to the simulation state.`, 'Use bind/when so events emerge from what is happening.');
  const sameChoice = events.filter(e => (e.choices || []).length >= 2 && new Set(e.choices.map(c => JSON.stringify((c.effects || []).map(o => o.op + (o.id || o.path || '')).sort()))).size === 1);
  if (sameChoice.length) add('false-choices', 'minor', `${sameChoice.length} events offer choices that change the same things.`, 'Make each choice trade off different resources.', sameChoice.map(e => e.id));
  const tiers = ((gdl.progression || {}).tiers || []);
  if (tiers.length < 3) add('flat-progression', 'minor', 'Fewer than 3 progression tiers.', 'Add tiers that unlock new strategic options, not just bigger numbers.');
  const archetypes = (((gdl.orgs || {}).rivals || {}).archetypes || []);
  if (archetypes.length < 2) add('samey-rivals', 'minor', 'Rivals have fewer than 2 strategic archetypes.', 'Give rivals distinct strategies (low-cost, premium, aggressive…).');
  if (!gdl.history) add('no-history', 'minor', 'No history/records module.', 'Enable history: records, awards, annual reviews, milestones.');
  if (!(gdl.world && gdl.world.cycle)) add('static-world', 'minor', 'No economic cycle.', 'Add a Markov economic cycle with shocks.');
  for (const f of (balance && balance.findings) || []) F.push(Object.assign({ area: 'balance', fix: fixFor(f.id) }, f));
  return F;
}
function fixFor(id) {
  return ({ 'too-easy': 'Run the auto-tuner (Balance) or raise competition/costs.', 'runaway-growth': 'Add costs that grow with size (complexity, regulation) and rival responses to the leader.', snowballing: 'Add late-game pressure: complexity costs, antitrust/regulators, rivals targeting the leader.', 'too-hard': 'Lower costs or raise demand via the tuner.', 'passive-simulation': 'Make neglect costly: aging assets, decaying reputation, rivals taking share.', 'dominant-strategy': 'Counter the dominant strategy with a cost that scales with it.', 'death-spiral': 'Add recovery tools: rescue options, restructuring, cheaper capacity.', 'notification-fatigue': 'Lower event frequencies; delegate routine events.', 'click-burden': 'Add delegation policies.', 'static-world': 'Allow entries, exits and mergers.', 'runtime-errors': 'Fix the formulas named in the errors.', 'no-failure': 'Make mistakes matter: tighter cash, stronger rivals.' })[id] || '';
}

/* No-placeholder rule: scan the definition and custom code. */
function placeholders(gdl, customFiles = []) {
  const F = [];
  const re = /\b(TODO|TBD|FIXME|lorem ipsum|placeholder|coming soon|not implemented|mock(ed)? (button|data)|stub)\b/i;
  const walk = (o, p) => {
    if (typeof o === 'string') { if (re.test(o)) F.push({ id: 'placeholder', severity: 'major', area: 'completeness', text: `Placeholder text at ${p}: “${o.slice(0, 80)}”`, fix: 'Implement or remove.' }); return; }
    if (Array.isArray(o)) o.forEach((x, i) => walk(x, `${p}[${x && x.id ? x.id : i}]`));
    else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (k === 'records') continue; walk(v, p ? `${p}.${k}` : k); }
  };
  walk(gdl, '');
  for (const c of customFiles) if (re.test(c.code)) F.push({ id: 'placeholder', severity: 'major', area: 'completeness', text: `Placeholder in custom code ${c.name}`, fix: 'Implement or remove.' });
  // buttons with no action: screen actions referencing actions without effects
  for (const a of arr(gdl.actions)) if (!a.aiOnly && !(a.effects || []).length) F.push({ id: 'dead-button', severity: 'major', area: 'completeness', text: `Action “${a.label}” has no effects.`, fix: 'Give it effects or remove it.' });
  return F;
}
module.exports = { ux, design, placeholders };
