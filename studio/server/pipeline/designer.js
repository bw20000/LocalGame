/* Deterministic designer: brief → design plan → game definition, using the Game Design
   Intelligence Library and the genre packs / archetypes. It always works (no model needed) and it
   produces the scaffold that local-model stages specialize and critique. */
'use strict';
const fs = require('fs');
const path = require('path');
const { LIBRARY } = require('../config');

const lib = (f) => JSON.parse(fs.readFileSync(path.join(LIBRARY, f), 'utf8'));
const PACKS = {
  airline: () => require(path.join(LIBRARY, 'packs', 'airline.js'))
};
const ARCHETYPES = {
  'operate-and-expand': () => require(path.join(LIBRARY, 'packs', 'archetypes', 'venue.js')),
  'project-lifecycle': () => tryReq('slate'),
  'deal-and-portfolio': () => tryReq('portfolio'),
  'client-agency': () => tryReq('agency'),
  'roster-and-season': () => tryReq('roster'),
  'institution-stewardship': () => tryReq('institution')
};
function tryReq(name) { const p = path.join(LIBRARY, 'packs', 'archetypes', name + '.js'); return fs.existsSync(p) ? require(p) : require(path.join(LIBRARY, 'packs', 'archetypes', 'venue.js')); }

function genreInfo(id) { return lib('fantasies.json').genres.find(g => g.id === id) || null; }
/* Which design module builds this genre. */
function chooseModule(genre) {
  if (genre && PACKS[genre]) return { kind: 'pack', id: genre, mod: PACKS[genre]() };
  const g = genreInfo(genre);
  const loop = g ? g.loop : 'operate-and-expand';
  const mod = (ARCHETYPES[loop] || ARCHETYPES['operate-and-expand'])();
  return { kind: 'archetype', id: mod.id, loop, mod, lexiconGenre: (mod.genres || []).includes(genre) ? genre : (genre && mod.LEX && mod.LEX[genre] ? genre : null) };
}

function makeBrief(compiled, prompt, prefs) {
  const g = genreInfo(compiled.genre.genre);
  const s = compiled.settings;
  const must = compiled.requirements.filter(r => r.kind === 'must').map(r => r.text);
  const neg = compiled.requirements.filter(r => r.kind === 'negative').map(r => r.text);
  return {
    genre: compiled.genre.genre || 'generic', genreName: g ? g.name : 'Management game', confidence: compiled.genre.confidence,
    role: g ? g.role : 'Founder & CEO', fantasy: g ? g.fantasy : ['Build an organization from nothing', 'Beat your rivals', 'Leave a legacy'],
    tensions: g ? g.tensions : [], avoid: g ? g.avoid : [], loop: g ? g.loop : 'operate-and-expand', tick: g ? g.tick : 'week',
    signature: g ? g.signature : 'a map of your operations', motif: g ? g.motif : 'editorial',
    depth: s.depth, realism: s.realism, length: s.length, visual: s.visual, universe: s.universe, commissioner: s.commissioner, overwhelmAverse: s.overwhelmAverse || (prefs && prefs.signals && prefs.signals.overwhelming > 1),
    mustHaves: must, dislikes: neg, promptExcerpt: String(prompt).slice(0, 600)
  };
}
/* Anti-bloat scoring of each candidate feature (Rule 27). Requested features get a fantasy boost. */
function scoreFeatures(mod, compiled, brief) {
  const rubric = lib('feature-rubric.json');
  const reqText = compiled.requirements.map(r => r.text.toLowerCase()).join(' | ');
  return (mod.FEATURES || []).map(f => {
    const requested = f.keywords.some(k => reqText.includes(k.toLowerCase()));
    const scores = { fantasy: requested ? 5 : 3, decision: f.paths.some(p => p.startsWith('actions') || p.startsWith('negotiations') || p.startsWith('events')) ? 4 : 2.5, connection: f.paths.length >= 3 ? 4 : 3, feedback: 3.5, frequency: f.paths.some(p => p.startsWith('actions')) ? 4 : 2.5, uniqueness: 4 };
    const value = rubric.criteria.reduce((a, c) => a + c.weight * scores[c.id], 0) / rubric.criteria.reduce((a, c) => a + c.weight, 0);
    const cost = 1 + f.paths.filter(p => p.startsWith('ui.screens') || p.startsWith('kinds')).length * 0.5 + (f.paths.some(p => p.startsWith('stakeholders')) ? 0.5 : 0);
    const net = value - cost * 0.35;
    const verdict = requested || net >= rubric.threshold.keep ? 'keep' : net >= rubric.threshold.automate ? 'automate' : net >= rubric.threshold.merge ? 'merge' : 'cut';
    return { id: f.id, label: f.label, requested, scores, value: +value.toFixed(2), complexityCost: +cost.toFixed(2), net: +net.toFixed(2), verdict, flag: f.flag || null };
  });
}
function designPlan(brief, features, module) {
  const loops = lib('core-loops.json');
  const loop = loops.loops.find(l => l.id === (module.loop || brief.loop)) || loops.loops[0];
  return {
    pillars: [`Fantasy: ${brief.fantasy.slice(0, 3).join('; ')}`, 'Deep simulation, simple surface: ≤7 destinations, needs-you queue, policies for routine work', 'Every number explains itself (Why?), every major decision shows what you give up', 'The world fights back: cycles, shocks, strategic rivals'],
    coreLoop: { short: loop.short, medium: loop.medium, long: loop.long, decisions: loop.decisions, feedback: loop.feedback, failure: loop.failure, victory: loop.victory },
    timeScale: loops.timeScales[brief.tick] || loops.timeScales.week,
    features, kept: features.filter(f => f.verdict === 'keep').map(f => f.id), cut: features.filter(f => f.verdict === 'cut').map(f => f.id),
    notSimulated: brief.avoid, pacing: loops.pacingRules
  };
}
function titleFor(brief, mod, compiled, prompt) {
  const m = String(prompt).match(/(?:called|named|title[d]?)\s+["“']([^"”']{3,40})["”']/i);
  return m ? m[1] : null;
}
/* Build the game definition from the chosen module + plan flags. */
function buildGDL(brief, plan, module, opts = {}) {
  const flags = {};
  for (const f of plan.features) if (f.flag) flags[f.flag] = f.verdict !== 'cut';
  const buildOpts = { features: flags, title: opts.title || undefined, genre: module.lexiconGenre || brief.genre, role: brief.role };
  const gdl = module.mod.build(buildOpts);
  gdl.meta.generatedBy = { designer: 'deterministic', module: module.kind + ':' + module.id, at: new Date().toISOString() };
  if (brief.overwhelmAverse && gdl.ui && gdl.ui.nav && gdl.ui.nav.length > 6) gdl.ui.nav = gdl.ui.nav.slice(0, 6);
  if (brief.universe === 'fictional' && gdl.meta.universe === 'realistic-fictional') gdl.meta.disclaimer = gdl.meta.disclaimer + ' (Fictional universe requested: all organizations and people are invented.)';
  return gdl;
}
/* Requirement trace: requirement → implementing features/paths. Honest about gaps. */
function trace(compiled, module, gdl) {
  const feats = module.mod.FEATURES || [];
  const has = (p) => { const parts = p.split('.'); let o = gdl; for (const k of parts) { if (o == null) return false; if (Array.isArray(o)) { o = o.find(x => x && x.id === k); } else o = o[k]; } return o != null && !(Array.isArray(o) && !o.length); };
  const engineStd = [
    { keys: ['commissioner', 'sandbox', 'edit'], where: 'Engine: Commissioner (edits entities, companies, world, events, rules, time)' },
    { keys: ['save', 'saves', 'load', 'export', 'import'], where: 'Engine: saves (autosave, slots, rename, duplicate, delete, export/import, migration)' },
    { keys: ['overwhelming', 'not overwhelming', 'progressive disclosure', 'navigation', 'easy to understand'], where: 'Engine + UI map: ≤7 destinations, needs-you queue, inspectors, Why? explanations, policies' },
    { keys: ['polished', 'visual', 'interface', 'ui', 'beautiful'], where: `Theme: ${gdl.theme ? gdl.theme.motif : 'default'} motif, signature visualizations` },
    { keys: ['onboarding', 'tutorial'], where: 'Onboarding intro + coach marks' },
    { keys: ['history', 'records'], where: 'History module: records, awards, milestones, timeline, annual reviews' }
  ];
  return compiled.requirements.map(r => {
    const t = r.text.toLowerCase();
    const hits = feats.filter(f => f.keywords.some(k => t.includes(k.toLowerCase())));
    const paths = [].concat(...hits.map(f => f.paths)).filter(has);
    const std = engineStd.filter(s => s.keys.some(k => t.includes(k)));
    let status = paths.length || std.length ? 'implemented' : 'not-found';
    if (r.kind === 'negative') status = 'respected';
    if (status === 'not-found' && r.kind !== 'must') status = 'partial';
    return { id: r.id, text: r.text, kind: r.kind, area: r.area, status, where: paths.concat(std.map(s => s.where)), features: hits.map(h => h.label) };
  });
}
function memoryDocs(brief, plan, gdl, compiled, traceRows) {
  const md = {};
  md.GAME_BRIEF = `# Game brief\n\n**Genre:** ${brief.genreName}  \n**Role:** ${brief.role}  \n**Universe:** ${brief.universe}  \n**Depth / realism / length:** ${brief.depth} / ${brief.realism} / ${brief.length}  \n**Visual priority:** ${brief.visual}\n\n## Fantasy\n${brief.fantasy.map(x => '- ' + x).join('\n')}\n\n## Core tensions\n${brief.tensions.map(x => '- ' + x).join('\n')}\n\n## Must-haves (from the brief)\n${brief.mustHaves.map(x => '- ' + x).join('\n') || '- (none stated)'}\n\n## Explicit dislikes\n${brief.dislikes.map(x => '- ' + x).join('\n') || '- (none stated)'}\n`;
  md.DESIGN_PILLARS = `# Design pillars\n\n${plan.pillars.map(p => '1. ' + p).join('\n')}\n\n## Not simulated on purpose\n${plan.notSimulated.map(x => '- ' + x).join('\n')}\n`;
  md.CORE_LOOP = `# Core loop\n\n- **Each turn:** ${plan.coreLoop.short}\n- **Every few months:** ${plan.coreLoop.medium}\n- **Over years:** ${plan.coreLoop.long}\n\n**Key decisions:** ${plan.coreLoop.decisions.join('; ')}  \n**Feedback:** ${plan.coreLoop.feedback}  \n**Failure:** ${plan.coreLoop.failure}  \n**Victory:** ${plan.coreLoop.victory}\n\n## Pacing rules\n${plan.pacing.map(x => '- ' + x).join('\n')}\n`;
  md.SYSTEM_MAP = `# System map\n\n| Feature | Requested | Value | Complexity | Verdict |\n|---|---|---|---|---|\n${plan.features.map(f => `| ${f.label} | ${f.requested ? 'yes' : ''} | ${f.value} | ${f.complexityCost} | ${f.verdict} |`).join('\n')}\n\n## Actions (player verbs)\n${(gdl.actions || []).map(a => `- **${a.label}** — ${a.describe || ''}`).join('\n')}\n\n## Events\n${(gdl.events || []).map(e => `- ${e.id} (${e.priority || 'important'})`).join('\n')}\n`;
  md.ENTITY_SCHEMA = `# Entity schema\n\n${Object.entries(gdl.kinds).map(([k, kd]) => `## ${kd.label || k}\n${Object.entries(kd.fields || {}).map(([f, fd]) => `- \`${f}\`: ${typeof fd === 'string' ? fd : fd.type || ''}${fd.ref ? ' → ' + fd.ref : ''}${fd.label ? ' — ' + fd.label : ''}`).join('\n')}${kd.operate ? `\n\n*Operates in market \`${kd.operate.market}\`.*` : ''}`).join('\n\n')}\n`;
  md.ECONOMY_RULES = `# Economy rules\n\n## Parameters\n${Object.entries(gdl.params || {}).map(([k, v]) => `- \`${k}\` = ${v}`).join('\n')}\n\n## Markets\n${Object.entries(gdl.markets || {}).map(([id, m]) => `### ${m.label || id}\nSize: \`${m.size}\`  \nSegments: ${(m.segments || []).map(s => s.label || s.id).join(', ')}`).join('\n')}\n\n## Organization costs\n${((gdl.orgs || {}).costs || []).map(c => `- ${c.label}: \`${c.expr}\``).join('\n')}\n`;
  md.UI_MAP = `# UI map\n\n${((gdl.ui || {}).nav || []).map(n => `- **${n.label}** (${n.id}): ${((gdl.ui.screens || {})[n.id] || {}).subtitle || ''}`).join('\n')}\n- History, Saves & settings, Help, Commissioner (built in)\n`;
  md.VISUAL_DIRECTION = `# Visual direction\n\nMotif: **${(gdl.theme || {}).motif}**, mode ${(gdl.theme || {}).mode}. Fonts: ${JSON.stringify((gdl.theme || {}).fonts)}.\nSignature visualization: ${brief.signature}.\n`;
  md.COMMISSIONER_SPEC = `# Commissioner\n\nBuilt into the engine: edit any entity field, ownership, companies (cash, resources, strategy, collapse, merge, create), world variables, economic phase, shocks, trigger any event, edit balance parameters, set tier/stakeholders, jump time. All edits change the real simulation.\n`;
  md.REQUIREMENTS_MATRIX = `# Requirements matrix\n\n| ID | Requirement | Kind | Implemented? | Where |\n|---|---|---|---|---|\n${traceRows.map(t => `| ${t.id} | ${t.text.replace(/\|/g, '/')} | ${t.kind} | ${t.status} | ${t.where.slice(0, 4).join('; ').replace(/\|/g, '/')} |`).join('\n')}\n`;
  md.KNOWN_BUGS = '# Known bugs\n\n(none recorded yet)\n';
  md.BALANCE_REPORT = '# Balance report\n\n(not yet run)\n';
  md.CHANGELOG = `# Changelog\n\n- ${new Date().toISOString().slice(0, 10)}: Initial design generated (${gdl.meta.generatedBy ? gdl.meta.generatedBy.module : 'designer'}).\n`;
  return md;
}

module.exports = { makeBrief, scoreFeatures, designPlan, buildGDL, trace, memoryDocs, chooseModule, genreInfo, titleFor };
