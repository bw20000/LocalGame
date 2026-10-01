/* Local-model design stages. Each stage has one responsibility, a JSON schema, and a compact
   context built from the library and the current definition (never the whole project). Outputs
   are either refinements of design documents or targeted patches that the validator checks. */
'use strict';
const fs = require('fs');
const path = require('path');
const { LIBRARY } = require('../config');
const patch = require('./patch');

const read = (f) => fs.readFileSync(path.join(LIBRARY, f), 'utf8');
const CHEAT = () => read('gdl-cheatsheet.md');
const FAILS = () => JSON.parse(read('failure-taxonomy.json')).patterns.map(p => `- ${p.name}: ${p.definition}`).join('\n');
const FUN = () => JSON.parse(read('fun-patterns.json')).patterns.map(p => `- ${p.principle}`).join('\n');

const STUDIO = 'You are part of a small professional game studio that builds deep management / tycoon / front-office simulation games. You care about meaningful decisions, clear feedback, distinct visual identity and avoiding feature bloat. You always answer with JSON only.';

/* 1. Executive Producer — refine the brief. */
const BRIEF_SCHEMA = { type: 'object', required: ['title', 'tagline', 'role', 'fantasy', 'pitch'], properties: {
  title: { type: 'string' }, tagline: { type: 'string' }, role: { type: 'string' }, pitch: { type: 'string' },
  fantasy: { type: 'array', minItems: 4, items: { type: 'string' } }, tensions: { type: 'array', items: { type: 'string' } },
  tone: { type: 'string' }, notToSimulate: { type: 'array', items: { type: 'string' } } } };
async function producer(llm, { prompt, brief, log }) {
  return llm.json({ role: 'main', label: 'Executive producer', schema: BRIEF_SCHEMA, onLog: log, maxTokens: 1500,
    system: STUDIO + ' Role: Executive Producer. Identify what the player fantasizes about doing BEFORE any mechanic. Fantasy items are concrete verbs ("open a bold new route and watch it fill"), not features ("route system").',
    prompt: `Original request:\n"""${String(prompt).slice(0, 5000)}"""\n\nDraft brief from the library:\n${JSON.stringify({ genre: brief.genreName, role: brief.role, fantasy: brief.fantasy, tensions: brief.tensions, mustHaves: brief.mustHaves.slice(0, 25), dislikes: brief.dislikes }, null, 1)}\n\nReturn JSON {title (evocative, 1–4 words, not generic like "X Tycoon"), tagline, role, pitch (2 sentences), fantasy[6–9 verbs-first moments], tensions[3–5], tone, notToSimulate[]}.` });
}

/* 2. Lead Game Designer — review features with the anti-bloat rubric; propose systems for unmet musts. */
const PLAN_SCHEMA = { type: 'object', required: ['verdicts', 'missing'], properties: {
  verdicts: { type: 'array', items: { type: 'object', required: ['id', 'verdict'], properties: { id: { type: 'string' }, verdict: { type: 'string', enum: ['keep', 'automate', 'merge', 'cut'] }, why: { type: 'string' } } } },
  missing: { type: 'array', items: { type: 'object', required: ['requirement', 'design'], properties: { requirement: { type: 'string' }, design: { type: 'string' }, decision: { type: 'string' }, worthIt: { type: 'boolean' } } } },
  coreLoop: { type: 'string' }, pillars: { type: 'array', items: { type: 'string' } } } };
async function leadDesigner(llm, { brief, plan, traceRows, log }) {
  const missing = traceRows.filter(t => t.status === 'not-found' && t.kind === 'must').map(t => t.text);
  return llm.json({ role: 'main', label: 'Lead game designer', schema: PLAN_SCHEMA, onLog: log, maxTokens: 2500,
    system: STUDIO + ' Role: Lead Game Designer. For every feature ask: does it create a meaningful decision? Requested features must be kept unless they are truly redundant. For requirements the current design misses, sketch the smallest system that delivers the decision (or say it is not worth it).\nFun principles:\n' + FUN(),
    prompt: `Brief: ${JSON.stringify({ title: brief.title, fantasy: brief.fantasy, role: brief.role })}\nCurrent features with rubric scores:\n${JSON.stringify(plan.features.map(f => ({ id: f.id, label: f.label, requested: f.requested, net: f.net, verdict: f.verdict })), null, 0)}\nRequirements not yet covered: ${JSON.stringify(missing)}\nReturn JSON {verdicts:[{id,verdict,why}], missing:[{requirement, design, decision, worthIt}], coreLoop, pillars[3-5]}.` });
}

/* 3. Feature engineer — implement one missing requirement as a GDL patch. */
const PATCH_SCHEMA = { type: 'object', required: ['ops', 'summary'], properties: { summary: { type: 'string' }, ops: { type: 'array', items: { type: 'object', required: ['op', 'path'], properties: { op: { type: 'string', enum: ['set', 'merge', 'append', 'remove', 'insert'] }, path: { type: 'string' }, value: {}, why: { type: 'string' } } } } } };
function gdlOutline(gdl) {
  return {
    kinds: Object.fromEntries(Object.entries(gdl.kinds).map(([k, kd]) => [k, Object.keys(kd.fields || {}).concat(Object.keys(kd.derived || {}).map(x => x + '*'))])),
    orgFields: Object.keys((gdl.orgs || {}).fields || {}), orgMetrics: ((gdl.orgs || {}).metrics || []).map(m => m.id),
    resources: (gdl.resources || []).map(r => r.id), stakeholders: (gdl.stakeholders || []).map(s => s.id), policies: (gdl.policies || []).map(p => p.id),
    actions: (gdl.actions || []).map(a => a.id + (a.kind ? '@' + a.kind : '')), events: (gdl.events || []).map(e => e.id), negotiations: (gdl.negotiations || []).map(n => n.id), projects: (gdl.projects || []).map(p => p.id),
    screens: Object.keys(((gdl.ui || {}).screens) || {}), tiers: ((gdl.progression || {}).tiers || []).map(t => t.id), params: gdl.params
  };
}
async function featureEngineer(llm, { gdl, requirement, design, log, errors }) {
  const example = (gdl.actions || []).find(a => a.forecast) || (gdl.actions || [])[0];
  const exEvent = (gdl.events || []).find(e => (e.choices || []).length >= 2);
  return llm.json({ role: 'main', label: 'Systems designer', schema: PATCH_SCHEMA, onLog: log, maxTokens: 4000,
    system: STUDIO + ' Role: Systems Designer. You extend an existing game definition with the SMALLEST set of patch operations that delivers a requirement as a real decision with visible feedback. Only use names that exist in the outline or that you add in the same patch. Follow the GDL exactly:\n' + CHEAT(),
    prompt: `Requirement: ${requirement}\nDesign sketch: ${design || '(none)'}\n\nCurrent definition outline:\n${JSON.stringify(gdlOutline(gdl))}\n\nExample action from this game:\n${JSON.stringify(example).slice(0, 2500)}\n\nExample event from this game:\n${JSON.stringify(exEvent).slice(0, 2000)}\n${errors ? `\nYour previous patch failed validation:\n${errors}\nFix these problems.` : ''}\nReturn JSON {summary, ops:[{op:'append', path:'actions', value:{...}}, ...]}. Typical: append to actions/events/stakeholders/policies, merge into orgs.fields, append a screen section with op 'append' path 'ui.screens.<id>.sections'.` });
}

/* 4. Content designer — state-bound events. */
const EVENTS_SCHEMA = { type: 'object', required: ['events'], properties: { events: { type: 'array', items: { type: 'object', required: ['id', 'title', 'priority'], properties: { id: { type: 'string' }, title: { type: 'string' }, text: { type: 'string' }, priority: { type: 'string', enum: ['critical', 'important', 'routine', 'background'] }, chance: { type: 'string' }, cooldown: { type: 'number' }, bind: { type: 'object' }, choices: { type: 'array' }, effects: { type: 'array' } } } } } };
async function contentDesigner(llm, { gdl, brief, count = 6, log, errors }) {
  const ex = (gdl.events || []).filter(e => e.bind && (e.choices || []).length >= 2).slice(0, 2);
  return llm.json({ role: 'main', label: 'Content designer', schema: EVENTS_SCHEMA, onLog: log, maxTokens: 5000, temperature: 0.7,
    system: STUDIO + ' Role: Content Designer. Write events that emerge from simulation state: bind to real entities with filters, reference real numbers in the text, give 2–3 choices that trade off DIFFERENT things (cash vs reputation vs relationships vs risk). Never write "An unexpected event happened". Keep text under 45 words. GDL reference:\n' + CHEAT(),
    prompt: `Game: ${brief.title || gdl.meta.title} — ${gdl.meta.tagline || ''}\nFantasy: ${(brief.fantasy || gdl.meta.fantasy || []).join('; ')}\nOutline:\n${JSON.stringify(gdlOutline(gdl))}\nExisting event ids (do not repeat): ${(gdl.events || []).map(e => e.id).join(', ')}\nTwo good examples from this game:\n${JSON.stringify(ex).slice(0, 4000)}\n${errors ? `\nPrevious attempt had validation problems:\n${errors}\n` : ''}\nWrite ${count} NEW events as JSON {events:[...]}. Use chance like "0.02" (per week) and cooldown 20–60.` });
}

/* 5. Creative director — theme + voice. */
const THEME_SCHEMA = { type: 'object', required: ['motif', 'mode', 'palette', 'voice'], properties: { motif: { type: 'string', enum: ['departure-board', 'playbill', 'broadcast', 'editorial', 'blueprint', 'ledger', 'menu-card', 'terminal', 'deal-room', 'atelier', 'resort', 'paddock'] }, mode: { type: 'string', enum: ['light', 'dark'] }, palette: { type: 'object', properties: { accent: { type: 'string' }, accent2: { type: 'string' }, bg: { type: 'string' }, ink: { type: 'string' } } }, fonts: { type: 'object' }, voice: { type: 'string' }, logoText: { type: 'string' } } };
async function creativeDirector(llm, { gdl, brief, log }) {
  const motifs = JSON.parse(read('ui-patterns.json')).visualMotifs;
  return llm.json({ role: 'fast', label: 'Creative director', schema: THEME_SCHEMA, onLog: log, maxTokens: 800,
    system: STUDIO + ' Role: Creative Director. Pick a motif that makes screenshots instantly recognizable as THIS industry. Mature, premium, not gaudy. Colors as hex.',
    prompt: `Game: ${gdl.meta.title} (${brief.genreName}). Fantasy: ${(brief.fantasy || []).slice(0, 5).join('; ')}.\nMotifs:\n${Object.entries(motifs).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\nReturn JSON {motif, mode, palette{accent, accent2, bg, ink}, fonts{display, body} (one of: sans, serif, didone, condensed, geometric, humanist, slab, typewriter, mono), voice (one sentence describing UI copy tone), logoText (1–2 letters)}.` });
}

/* 6. Game design critic — reads metrics + detector findings, proposes patches. */
async function designCritic(llm, { gdl, report, findings, log }) {
  return llm.json({ role: 'critic', label: 'Game design critic', schema: PATCH_SCHEMA, onLog: log, maxTokens: 3000,
    system: STUDIO + ' Role: Game Design Critic. You read playtest statistics and automated findings, then propose a SMALL set of patch operations (prefer params tweaks and policy/effect adjustments) that fix the most important problem without adding bloat. Bad patterns:\n' + FAILS() + '\nGDL reference:\n' + CHEAT(),
    prompt: `Game: ${gdl.meta.title}\nParams: ${JSON.stringify(gdl.params)}\nPlaytest summary:\n${JSON.stringify(report).slice(0, 5000)}\nAutomated findings:\n${JSON.stringify(findings).slice(0, 3000)}\nReturn JSON {summary, ops} with at most 6 ops. Use paths like "params.demandK" (op set) or "actions[id].cost.cash".` });
}

/* 7. Change planner — understand a modification request against the existing project. */
const CHANGE_SCHEMA = { type: 'object', required: ['kind', 'summary', 'ops'], properties: { kind: { type: 'string', enum: ['balance', 'redesign-system', 'ui', 'add-feature', 'simplify', 'content', 'fix', 'other'] }, summary: { type: 'string' }, ops: PATCH_SCHEMA.properties.ops, risks: { type: 'array', items: { type: 'string' } } } };
async function changePlanner(llm, { gdl, request, memory, retrieved, log, errors }) {
  return llm.json({ role: 'main', label: 'Change planner', schema: CHANGE_SCHEMA, onLog: log, maxTokens: 5000,
    system: STUDIO + ' Role: Lead designer handling a change request on an EXISTING game. Preserve existing systems unless the request says otherwise. Produce targeted patch ops, never a rewrite. GDL reference:\n' + CHEAT(),
    prompt: `Request: "${request}"\n\nProject memory (summary):\n${String(memory).slice(0, 3000)}\n\nOutline:\n${JSON.stringify(gdlOutline(gdl))}\n\nRelevant parts of the definition:\n${JSON.stringify(retrieved).slice(0, 9000)}\n${errors ? `\nPrevious patch failed validation:\n${errors}\n` : ''}\nReturn JSON {kind, summary, ops, risks}.` });
}

/* Retrieval: pick definition fragments relevant to a request (keyword overlap, cheap and local). */
function retrieve(gdl, request, max = 8) {
  const words = new Set(String(request).toLowerCase().match(/[a-z]{3,}/g) || []);
  const cand = [];
  const push = (pathStr, obj) => { const txt = JSON.stringify(obj).toLowerCase(); let score = 0; for (const w of words) if (txt.includes(w)) score += 1; if (score) cand.push({ path: pathStr, score: score / Math.sqrt(1 + txt.length / 2000), obj }); };
  for (const a of gdl.actions || []) push(`actions[${a.id}]`, a);
  for (const e of gdl.events || []) push(`events[${e.id}]`, e);
  for (const p of gdl.policies || []) push(`policies[${p.id}]`, p);
  for (const [k, kd] of Object.entries(gdl.kinds || {})) push(`kinds.${k}`, Object.assign({}, kd, { records: kd.records ? `(${kd.records.length} records)` : undefined }));
  for (const [s, sc] of Object.entries((gdl.ui || {}).screens || {})) push(`ui.screens.${s}`, sc);
  for (const s of gdl.stakeholders || []) push(`stakeholders[${s.id}]`, s);
  for (const n of gdl.negotiations || []) push(`negotiations[${n.id}]`, n);
  push('progression', gdl.progression); push('params', gdl.params);
  return cand.sort((a, b) => b.score - a.score).slice(0, max).map(c => ({ path: c.path, value: c.obj }));
}

module.exports = { producer, leadDesigner, featureEngineer, contentDesigner, creativeDirector, designCritic, changePlanner, retrieve, gdlOutline, patch };
