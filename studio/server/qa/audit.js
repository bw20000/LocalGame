/* Final audit: the ten quality gates, the advanced design review (fantasy, 10-minute, 1-hour,
   10-hour, late game, failure, screenshot, redundancy, decision, story) and a scorecard. Every
   verdict cites evidence from tests, playtests, browser runs or the definition — no vibes. */
'use strict';
const arr = (x) => Array.isArray(x) ? x : Object.values(x || {});

function gates({ gdl, validation, tests, browser, balance, trace, critics, required = {} }) {
  const G = [];
  const g = (n, name, status, evidence) => G.push({ gate: n, name, status, evidence });
  const testOk = (area) => tests && tests.results ? tests.results.filter(r => r.area === area) : [];
  const allOk = (rs) => rs.length > 0 && rs.every(r => r.ok);
  const critical = [].concat((validation && validation.errors) || [], tests ? tests.results.filter(r => !r.ok).map(r => r.name + ': ' + r.error) : [], browser && !browser.skipped ? (browser.errors || []).map(e => e.text) : []);
  g(1, 'Runs without critical errors', critical.length === 0 ? 'pass' : 'fail', critical.length ? critical.slice(0, 5) : ['validator clean', tests ? `${tests.passed}/${tests.passed + tests.failed} simulation tests` : 'no tests', browser && !browser.skipped ? 'no browser errors' : 'browser QA skipped']);
  const loop = testOk('actions').concat(testOk('time'), testOk('economy'));
  const uiLoop = browser && !browser.skipped ? (browser.steps || []).filter(s => /action|Time advances/.test(s.name)) : [];
  g(2, 'Primary gameplay loop works', allOk(loop) && (!uiLoop.length || uiLoop.every(s => s.ok)) ? 'pass' : 'fail', loop.map(r => `${r.ok ? '✓' : '✗'} ${r.name}`).concat(uiLoop.map(s => `${s.ok ? '✓' : '✗'} UI: ${s.name}`)));
  const saves = testOk('save'); const uiSave = browser && !browser.skipped ? (browser.steps || []).filter(s => /Save|Reload/.test(s.name)) : [];
  g(3, 'Save/load works', allOk(saves) && uiSave.every(s => s.ok) ? 'pass' : 'fail', saves.map(r => `${r.ok ? '✓' : '✗'} ${r.name}`).concat(uiSave.map(s => `${s.ok ? '✓' : '✗'} UI: ${s.name}`)));
  const musts = (trace || []).filter(t => t.kind === 'must');
  const missing = musts.filter(t => t.status === 'not-found');
  g(4, 'Major requested features exist', !musts.length ? 'n/a' : missing.length === 0 ? 'pass' : missing.length <= Math.max(1, musts.length * 0.1) ? 'warn' : 'fail', missing.length ? missing.map(m => 'Missing: ' + m.text) : [`${musts.length} must-have requirements traced to implementations`]);
  const bf = (balance && balance.findings) || [];
  const unstable = bf.filter(f => ['death-spiral', 'too-hard', 'runtime-errors'].includes(f.id) || (f.id === 'too-easy' && f.evidence && f.evidence.margin > 0.35));
  g(5, 'No obvious economy instability', !balance ? 'not-run' : unstable.length ? 'fail' : bf.some(f => f.severity === 'major') ? 'warn' : 'pass', balance ? (bf.length ? bf.map(f => f.text) : ['no balance findings']) : ['balance lab not run']);
  const nav = (gdl.ui && gdl.ui.nav) || [];
  const deadNav = nav.filter(n => n.id !== 'home' && !((gdl.ui.screens || {})[n.id]));
  const screenFail = browser && !browser.skipped ? (browser.steps || []).filter(s => /destinations|Screen/.test(s.name) && !s.ok) : [];
  g(6, 'No major dead-end navigation', deadNav.length || screenFail.length ? 'fail' : nav.length > 7 ? 'warn' : 'pass', deadNav.map(n => 'No screen for ' + n.id).concat(screenFail.map(s => s.name + ' ' + s.note), [`${nav.length} destinations`]));
  const cm = testOk('commissioner'); const cmUi = browser && !browser.skipped ? (browser.steps || []).filter(s => /Commissioner/.test(s.name)) : [];
  g(7, 'Commissioner mode works', (gdl.commissioner && gdl.commissioner.enabled === false) && !required.commissioner ? 'n/a' : allOk(cm) && cmUi.every(s => s.ok) ? 'pass' : 'fail', cm.map(r => `${r.ok ? '✓' : '✗'} ${r.name}`).concat(cmUi.map(s => `${s.ok ? '✓' : '✗'} UI: ${s.name}`)));
  const ob = gdl.onboarding || {};
  g(8, 'Onboarding explains the basic game', ob.intro && (ob.steps || []).length >= 3 && gdl.meta && gdl.meta.howToPlay ? 'pass' : 'fail', [`intro: ${ob.intro ? 'yes' : 'no'}`, `${(ob.steps || []).length} coach-mark steps`, `how-to-play: ${gdl.meta && gdl.meta.howToPlay ? 'yes' : 'no'}`]);
  const lr = testOk('long run');
  const survivors = balance ? Object.entries(balance.aggregate.strategies).filter(([s, st]) => !/passive|careless/.test(s) && st.survival > 0).length : 0;
  g(9, 'Automated long-run simulation succeeds', allOk(lr) || survivors > 0 ? 'pass' : 'fail', lr.map(r => `${r.ok ? '✓' : '✗'} ${r.name} ${r.note || ''}`).concat(balance ? [`${balance.aggregate.runs} playthroughs × ${balance.years} years; ${survivors} competent strategies survive`] : []));
  g(10, 'Final requirements audit completed', trace ? 'pass' : 'fail', trace ? [`${trace.length} requirements: ${trace.filter(t => t.status === 'implemented').length} implemented, ${trace.filter(t => t.status === 'partial').length} partial, ${trace.filter(t => t.status === 'not-found').length} not found, ${trace.filter(t => t.status === 'respected').length} negative respected`] : ['no requirements trace']);
  const placeholders = (critics || []).filter(c => c.id === 'placeholder' || c.id === 'dead-button');
  if (placeholders.length) G[0].status = G[0].status === 'pass' ? 'warn' : G[0].status, G[0].evidence.push(`${placeholders.length} placeholder/dead-button findings`);
  const passed = G.filter(x => x.status === 'pass' || x.status === 'n/a').length;
  const blocking = G.filter(x => x.status === 'fail' || x.status === 'not-run');
  return { gates: G, passed, total: G.length, finished: blocking.length === 0, blocking: blocking.map(b => b.gate) };
}

/* Advanced design review (spec §48), evidence-based. */
function designReview({ gdl, balance, browser, trace, brief }) {
  const R = [];
  const r = (test, verdict, evidence, suggestion) => R.push({ test, verdict, evidence, suggestion: suggestion || '' });
  const acts = arr(gdl.actions).filter(a => !a.aiOnly);
  const kinds = Object.keys(gdl.kinds || {});
  const domainActs = acts.filter(a => a.kind || (a.effects || []).some(op => op.kind && kinds.includes(op.kind)) || (a.params || []).some(p => p.kind && kinds.includes(p.kind)));
  const S = balance ? balance.aggregate.strategies : {};
  const raw = balance ? balance.raw || [] : [];
  // fantasy
  const musts = (trace || []).filter(t => t.kind === 'must');
  const impl = musts.filter(t => t.status === 'implemented').length;
  r('Fantasy', (domainActs.length >= 8 || domainActs.length / Math.max(1, acts.length) >= 0.6) && (!musts.length || impl / musts.length > 0.85) ? 'pass' : 'concern', [`${domainActs.length}/${acts.length} player actions operate on domain objects (${kinds.slice(0, 6).join(', ')}…)`, `${impl}/${musts.length} must-haves implemented`, brief ? `Role: ${brief.role}` : ''].filter(Boolean), 'Every main screen should be a decision the role actually makes.');
  // 10 minutes
  const ob = gdl.onboarding || {};
  const firstActs = acts.filter(a => a.primary).length;
  r('10-minute', ob.intro && (ob.steps || []).length >= 4 && firstActs >= 2 ? 'pass' : 'concern', [`Intro + ${(ob.steps || []).length} guided steps`, `${firstActs} primary actions available from turn 1`, browser && !browser.skipped ? `new game ready in ${browser.metrics.newGameMs} ms` : ''].filter(Boolean));
  // 1 hour ≈ first two years
  const bal = S.balanced || S.smart;
  const y2 = bal && bal.valueByYear[1] && bal.valueByYear[0] ? bal.valueByYear[1] / bal.valueByYear[0] : null;
  const tierUp = raw.filter(x => x.strategy === 'balanced' && x.final && x.final.tierIndex > 0).length;
  r('1-hour', bal && (tierUp > 0 || (y2 && y2 > 1.3)) ? 'pass' : 'concern', bal ? [`Balanced play: value ×${y2 ? y2.toFixed(2) : '?'} in year 2`, `${tierUp} of ${raw.filter(x => x.strategy === 'balanced').length} balanced runs reached a new tier`] : ['no playtests'], 'Make the first tier reachable within ~2 in-game years for decent play.');
  // 10 hours: strategic variety late
  const late = raw.filter(x => x.strategy === 'smart');
  const used = S.smart ? S.smart.topActions.length : 0;
  r('10-hour', used >= 4 && ((gdl.progression || {}).tiers || []).length >= 3 ? 'pass' : 'concern', [`Skilled play uses ${used}+ different actions regularly`, `${((gdl.progression || {}).tiers || []).length} tiers unlock new options`, `${arr(gdl.projects).length} multi-stage projects, ${arr(gdl.negotiations).length} negotiation types`]);
  // late game
  const lateIssues = (balance ? balance.findings : []).filter(f => ['snowballing', 'runaway-growth', 'too-easy'].includes(f.id));
  r('Late-game', !balance ? 'not-run' : lateIssues.length ? 'concern' : 'pass', lateIssues.length ? lateIssues.map(f => f.text) : [`no snowballing detected over ${balance ? balance.years : '?'} years`, `rivals failed (median): ${balance ? balance.aggregate.world.rivalsFailedMedian : '?'}, entrants: ${balance ? balance.aggregate.world.entrantsMedian : '?'}`], 'Scale-dependent costs, regulators and rivals targeting the leader keep success interesting.');
  // failure
  const rescue = gdl.progression && gdl.progression.failure && (gdl.progression.failure.rescue || []).length;
  const rec = Object.values(S).map(s => s.recoveryRate).filter(x => x != null);
  r('Failure', rescue ? 'pass' : 'concern', [`${rescue || 0} rescue options when cash runs out`, rec.length ? `recovery rate after a crisis: ${Math.round(Math.max(...rec) * 100)}% (best strategy)` : 'no crises observed', S.careless ? `careless play fails at year ~${S.careless.bankruptcyYear || '—'}` : ''].filter(Boolean));
  // screenshot
  const motif = gdl.theme && gdl.theme.motif;
  const home = ((gdl.ui || {}).screens || {}).home || {};
  const sig = (home.sections || []).find(s => /map|board|showcase/.test(s.type) || (s.type === 'cards' && s.glyph));
  r('Screenshot', motif && motif !== 'editorial' && sig ? 'pass' : 'concern', [`Motif: ${motif || 'none'}`, sig ? `Signature panel on home: ${sig.type} “${sig.title || ''}”` : 'No signature visual on the home screen', browser && !browser.skipped ? `${browser.screenshots.length} screenshots captured` : ''].filter(Boolean));
  // redundancy
  const scr = browser && !browser.skipped ? browser.metrics.screens : {};
  const thin = Object.entries(scr || {}).filter(([k, m]) => m.panels <= 1 && m.words < 40 && !/history|saves/.test(k)).map(([k]) => k);
  r('Redundancy', thin.length ? 'concern' : 'pass', thin.length ? [`Thin screens that could merge: ${thin.join(', ')}`] : [`${Object.keys(scr || {}).length || ((gdl.ui || {}).nav || []).length} screens, none thin enough to merge`]);
  // decisions
  const withTrade = acts.filter(a => a.tradeoff || a.risk).length, withFc = acts.filter(a => a.forecast || (a.preview || []).length).length;
  const used2 = Object.values(S).flatMap(s => s.topActions.map(x => x[0]));
  const interesting = [...new Set(used2)].slice(0, 6);
  r('Decision', withTrade / Math.max(1, acts.length) > 0.4 ? 'pass' : 'concern', [`${withTrade}/${acts.length} actions state what you give up`, `${withFc} show a forecast before you commit`, interesting.length ? `Most-used by playtest bots: ${interesting.join(', ')}` : ''].filter(Boolean));
  // story
  const h = gdl.history || {};
  const events = arr(gdl.events);
  r('Story', (h.records || h.awards || h.annual) && events.length >= 8 ? 'pass' : 'concern', [`${events.length} state-driven events`, `history: ${Object.keys(h).join(', ') || 'none'}`, `${(((gdl.orgs || {}).rivals || {}).archetypes || []).length} rival archetypes with memory/rivalry`]);
  return R;
}

function scorecard({ gates: G, review, critics }) {
  const crit = (critics || []).filter(c => c.severity === 'critical').length, major = (critics || []).filter(c => c.severity === 'major').length, minor = (critics || []).filter(c => c.severity === 'minor').length;
  const gatePts = G.gates.filter(g => g.status === 'pass' || g.status === 'n/a').length * 6 + G.gates.filter(g => g.status === 'warn').length * 3;
  const revPts = review.filter(x => x.verdict === 'pass').length * 4;
  const score = Math.max(0, Math.min(100, Math.round(gatePts + revPts - crit * 10 - major * 3 - minor * 1)));
  return { score, gates: `${G.passed}/${G.total}`, review: `${review.filter(x => x.verdict === 'pass').length}/${review.length}`, critical: crit, major, minor };
}

function toMarkdown(a) {
  const icon = (s) => ({ pass: '✅', warn: '⚠️', fail: '❌', 'n/a': '➖', 'not-run': '⏸', concern: '⚠️' })[s] || s;
  let md = `# Audit — ${a.title}\n\n_${a.at}_\n\n**Score ${a.scorecard.score}/100** · gates ${a.scorecard.gates} · design review ${a.scorecard.review} · ${a.scorecard.critical} critical / ${a.scorecard.major} major findings\n\n`;
  md += `**Status:** ${a.gates.finished ? 'All quality gates pass — the build can be marked finished.' : 'Not finished — blocking gates: ' + a.gates.blocking.join(', ')}\n\n## Quality gates\n\n| # | Gate | Status | Evidence |\n|---|---|---|---|\n`;
  for (const g of a.gates.gates) md += `| ${g.gate} | ${g.name} | ${icon(g.status)} ${g.status} | ${(g.evidence || []).join('<br>').replace(/\|/g, '/')} |\n`;
  md += `\n## Design review\n\n| Test | Verdict | Evidence |\n|---|---|---|\n`;
  for (const r of a.review) md += `| ${r.test} | ${icon(r.verdict)} ${r.verdict} | ${r.evidence.join('<br>').replace(/\|/g, '/')}${r.verdict !== 'pass' && r.suggestion ? '<br>→ ' + r.suggestion : ''} |\n`;
  if (a.critics && a.critics.length) { md += `\n## Findings\n\n`; for (const c of a.critics) md += `- **${c.severity}** (${c.area}) ${c.text}${c.fix ? ' → ' + c.fix : ''}\n`; }
  return md;
}
module.exports = { gates, designReview, scorecard, toMarkdown };
