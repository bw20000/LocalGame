/* The production pipeline. Jobs run one at a time (a local machine has one GPU and one set of CPU
   cores to share), report progress per stage, survive individual stage failures with targeted
   repair, pause for design review when asked, and snapshot the project at V0–V4 and Release.

   Deterministic software does everything that can be computed (design scaffold, simulation,
   validation, tests, playtests, balance, browser QA, bundling). Local models — when installed —
   interpret, specialize, write content and critique; every model output is validated and is
   dropped or repaired if it breaks the game. */
'use strict';
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const { DATA, loadSettings, loadPrefs } = require('../config');
const { Store } = require('../projects/store');
const compiler = require('./compiler');
const designer = require('./designer');
const stages = require('./stages');
const patch = require('./patch');
const modify = require('./modify');
const remaster = require('./remaster');
const prefs = require('../prefs');
const validator = require('../../../engine/validate.js');
const bundle = require('../../../engine/bundle.js');
const tests = require('../qa/tests');
const balance = require('../qa/balance');
const browser = require('../qa/browser');
const critics = require('../qa/critics');
const audit = require('../qa/audit');

const CREATE_STAGES = [
  ['brief', 'Understanding brief'], ['loop', 'Designing core loop'], ['sim', 'Designing simulation'], ['world', 'Building world model'],
  ['ui', 'Building interface'], ['systems', 'Implementing systems'], ['tests', 'Running tests'], ['playtest', 'Playtesting'],
  ['balance', 'Balancing'], ['polish', 'Polishing'], ['package', 'Packaging']
];
const MODIFY_STAGES = [['understand', 'Understanding the request'], ['plan', 'Planning changes'], ['apply', 'Applying changes'], ['tests', 'Running tests'], ['balance', 'Simulating & balancing'], ['polish', 'Checking the interface'], ['package', 'Packaging']];
const AUDIT_STAGES = [['tests', 'Running tests'], ['playtest', 'Playtesting'], ['polish', 'Browser & UX checks'], ['audit', 'Auditing']];
const BALANCE_STAGES = [['playtest', 'Simulating'], ['balance', 'Rebalancing'], ['tests', 'Running tests'], ['package', 'Packaging']];
const EXPORT_STAGES = [['tests', 'Final checks'], ['package', 'Packaging']];

class Job extends EventEmitter {
  constructor(kind, projectId, input, opts) {
    super();
    this.id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    this.kind = kind; this.projectId = projectId; this.input = input || {}; this.opts = opts || {};
    const list = kind === 'create' || kind === 'remaster' ? CREATE_STAGES : kind === 'modify' ? MODIFY_STAGES : kind === 'audit' ? AUDIT_STAGES : kind === 'balance' ? BALANCE_STAGES : EXPORT_STAGES;
    this.stages = list.map(([id, label]) => ({ id, label, status: 'pending', notes: [], repairs: 0 }));
    this.status = 'queued'; this.log = []; this.result = null; this.error = null; this.created = new Date().toISOString();
    this.setMaxListeners(50);
  }
  stage(id) { return this.stages.find(s => s.id === id); }
  get progress() { const done = this.stages.filter(s => s.status === 'done' || s.status === 'skipped' || s.status === 'failed').length; return { done, total: this.stages.length }; }
  snapshot() { return { id: this.id, kind: this.kind, projectId: this.projectId, status: this.status, stages: this.stages, progress: this.progress, result: this.result, error: this.error, created: this.created, finished: this.finished || null, waiting: this.waiting || null, log: this.log.slice(-200) }; }
  push(type, data) { this.emit('event', Object.assign({ type, job: this.id, t: Date.now() }, data)); }
  info(text, level = 'info') { const e = { t: new Date().toISOString(), level, text: String(text) }; this.log.push(e); if (this.log.length > 2000) this.log.shift(); this.push('log', e); }
  begin(id) { const s = this.stage(id); if (!s) return; s.status = 'running'; s.started = Date.now(); this.current = id; this.push('stage', { stage: s, progress: this.progress }); this.info(`▶ ${s.label}`); }
  done(id, note, status = 'done') { const s = this.stage(id); if (!s) return; if (note) s.notes.push(note); s.status = status; s.ms = Date.now() - (s.started || Date.now()); this.push('stage', { stage: s, progress: this.progress }); this.info(`${status === 'done' ? '✓' : status === 'skipped' ? '–' : '✗'} ${s.label}${note ? ' — ' + note : ''}`, status === 'failed' ? 'error' : 'info'); }
  note(id, text) { const s = this.stage(id); if (s) s.notes.push(text); this.info(text); }
  repair(id, text) { const s = this.stage(id); if (s) s.repairs++; this.info('↻ repair: ' + text, 'warn'); }
}

const jobs = new Map();
let queue = Promise.resolve();
function persistJob(job) { try { const d = path.join(DATA, 'jobs'); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, job.id + '.json'), JSON.stringify(job.snapshot(), null, 1)); } catch (e) { /* ignore */ } }
function start(kind, projectId, input, opts = {}) {
  const job = new Job(kind, projectId, input, opts);
  jobs.set(job.id, job);
  job.on('event', () => { if (job._persistT) return; job._persistT = setTimeout(() => { job._persistT = null; persistJob(job); }, 500); });
  const run = async () => {
    job.status = 'running'; job.push('status', { status: job.status });
    const pr = Store.get(projectId);
    if (pr) pr.update(m => { m.lastJob = { id: job.id, kind, status: 'running', at: job.created }; m.status = 'building'; });
    try {
      const fn = { create: runCreate, remaster: runCreate, modify: runModify, audit: runAudit, balance: runBalance, export: runExport }[kind];
      job.result = await fn(job);
      job.status = job.cancelled ? 'cancelled' : 'done';
    } catch (e) {
      job.status = 'failed'; job.error = e.message || String(e);
      if (job.current) { const s = job.stage(job.current); if (s && s.status === 'running') job.done(job.current, job.error, 'failed'); }
      job.info('Job failed: ' + (e.stack || e), 'error');
    }
    job.finished = new Date().toISOString();
    const p2 = Store.get(projectId);
    if (p2) { p2.update(m => { m.lastJob = { id: job.id, kind, status: job.status, at: job.finished, error: job.error }; m.status = job.status === 'done' ? (m.gates && m.gates.finished ? 'finished' : 'playable') : job.status; }); p2.log('job', `${kind} ${job.status}`, { job: job.id, error: job.error }); }
    job.push('status', { status: job.status, result: job.result, error: job.error });
    persistJob(job);
  };
  queue = queue.then(run, run);
  return job;
}
function get(id) {
  if (jobs.has(id)) return jobs.get(id);
  try { return { snapshot: () => JSON.parse(fs.readFileSync(path.join(DATA, 'jobs', path.basename(id) + '.json'), 'utf8')), on() {}, off() {} }; } catch (e) { return null; }
}
function list() { return Array.from(jobs.values()).map(j => j.snapshot()).reverse(); }
function cancel(id) { const j = jobs.get(id); if (j) { j.cancelled = true; if (j._resume) j._resume(null); } return !!j; }
function resume(id, edits) { const j = jobs.get(id); if (j && j._resume) { j._resume(edits || {}); return true; } return false; }
const checkCancel = (job) => { if (job.cancelled) throw new Error('Cancelled by user'); };

/* ---------- helpers ---------- */
async function llmIfReady(job) {
  if (job.opts.useLLM === false) return null;
  try {
    const llm = require('../llm').get(); llm.reload();
    const st = await llm.status();
    if (st.ready) { job.info(`Local model ready: ${st.roles.main}`); return llm; }
    job.info('No local model is running — the deterministic designer builds the game; model stages are skipped. (Install a model on the Models page for richer content.)', 'warn');
  } catch (e) { job.info('Local model check failed: ' + e.message, 'warn'); }
  return null;
}
function vErrors(v) { return (v.errors || []).map(e => typeof e === 'string' ? e : `${e.path}: ${e.msg}`); }
/* Apply a model-proposed patch only if the game still validates; otherwise feed errors back (repair) or drop it. */
async function guardedPatch(job, stageId, gdl, propose, { label, attempts = 2, dry = true } = {}) {
  let errors = null;
  for (let i = 0; i <= attempts; i++) {
    let p;
    try { p = await propose(errors); } catch (e) { job.repair(stageId, `${label}: ${e.message.slice(0, 160)}`); return { gdl, ok: false }; }
    const ops = p.ops || p;
    const r = patch.apply(gdl, ops);
    if (r.failed.length) { errors = r.failed.map(f => `${f.op.path}: ${f.error}`).join('\n'); job.repair(stageId, `${label}: ${errors.slice(0, 200)}`); continue; }
    const v = validator.validate(r.gdl, { dryRun: dry, ticks: 12 });
    if (v.ok) { job.note(stageId, `${label}: applied ${ops.length} change(s)${p.summary ? ' — ' + p.summary : ''}`); return { gdl: r.gdl, ok: true, ops, summary: p.summary }; }
    errors = vErrors(v).slice(0, 12).join('\n');
    job.repair(stageId, `${label}: validation failed — ${errors.slice(0, 200)}`);
  }
  job.note(stageId, `${label}: dropped after ${attempts + 1} attempts (game left unchanged)`);
  return { gdl, ok: false };
}
function rivalCount(gdl) { const c = gdl.orgs && gdl.orgs.rivals && gdl.orgs.rivals.count; return typeof c === 'number' ? c : c && typeof c === 'object' ? Object.values(c).reduce((a, b) => a + (+b || 0), 0) + ((gdl.orgs.rivals.fixed || []).length || 0) : 0; }
function writeBuildInfo(pr, info) { pr.writeArtifact('build', info); }
function rebuildFromBase(pr, flagsOverride) {
  const b = pr.artifact('build');
  if (!b || !b.module) return null;
  const module = designer.chooseModule(b.module.genre);
  const buildOpts = Object.assign({}, b.buildOpts, { features: Object.assign({}, b.buildOpts.features, flagsOverride || {}) });
  let gdl = module.mod.build(buildOpts);
  gdl.meta = Object.assign(gdl.meta, b.metaOverrides || {});
  const patches = pr.artifact('patches') || [];
  for (const p of patches) { const r = patch.apply(gdl, p.ops); gdl = r.gdl; }
  return { gdl, buildOpts, module };
}
function recordPatch(pr, request, ops, kind) {
  if (!ops || !ops.length) return;
  const list = pr.artifact('patches') || [];
  list.push({ at: new Date().toISOString(), request, kind, ops });
  pr.writeArtifact('patches', list);
}
function releaseFile(pr, gdl) {
  const html = bundle.standaloneFromProject(pr.p('game'));
  const slug = require('../projects/store').slugify(gdl.meta && gdl.meta.title || pr.meta.title);
  const file = pr.release(html, slug);
  return { file, bytes: Buffer.byteLength(html), name: path.basename(file) };
}
function balanceMarkdown(title, hist, extra) {
  let md = `# Balance report — ${title}\n\n_${new Date().toISOString().slice(0, 16).replace('T', ' ')}_\n\n${extra || ''}\n`;
  for (const h of hist) {
    md += `\n## ${h.iteration === 0 ? 'Measured' : h.final ? 'Final measurement' : 'After adjustment ' + h.iteration}\n\n| Strategy | Survival | Op. margin | Value growth | Last-year growth | Bankrupt (yr) |\n|---|---|---|---|---|---|\n`;
    for (const [s, v] of Object.entries(h.summary)) md += `| ${s} | ${Math.round(v.survival * 100)}% | ${v.margin == null ? '—' : (v.margin * 100).toFixed(1) + '%'} | ×${v.growth == null ? '—' : v.growth} | ${v.lateGrowth == null ? '—' : '×' + v.lateGrowth} | ${v.bankruptcyYear ? 'year ' + (+v.bankruptcyYear).toFixed(1) : '—'} |\n`;
    md += h.findings.length ? `\n**Findings:** ${h.findings.map(f => f.text).join(' · ')}\n` : '\n**Findings:** none\n';
    if (h.tuning.length) md += `\n**Adjustments:**\n${h.tuning.map(t => '- ' + t.why).join('\n')}\n`;
  }
  return md;
}

/* ---------- QA bundle shared by create / modify / audit ---------- */
async function runTests(job, pr, stageId = 'tests') {
  job.begin(stageId);
  const rep = await tests.runSuite(pr.p('game'));
  pr.writeReport('tests', rep);
  job.done(stageId, `${rep.passed}/${rep.passed + rep.failed} simulation tests passed`, rep.failed ? 'failed' : 'done');
  if (rep.failed) for (const r of rep.results.filter(x => !x.ok)) job.info(`✗ ${r.name}: ${r.error}`, 'error');
  return rep;
}
async function runBrowser(job, pr, stageId = 'polish', quick = false) {
  const settings = loadSettings();
  if (settings.generation.browserTests === false) { job.note(stageId, 'Browser tests disabled in settings'); return { skipped: true, reason: 'disabled in settings' }; }
  const html = bundle.standaloneFromProject(pr.p('game'));
  const tmp = pr.p('reports', 'qa-build.html'); fs.mkdirSync(path.dirname(tmp), { recursive: true }); fs.writeFileSync(tmp, html);
  const rep = await browser.run(tmp, { outDir: pr.p('reports', 'screenshots'), quick, onLog: (m) => job.info('  ' + m) });
  pr.writeReport('browser', rep);
  if (rep.skipped) job.note(stageId, 'Browser QA skipped: ' + rep.reason);
  else job.note(stageId, `Browser QA: ${rep.passed}/${rep.passed + rep.failed} checks passed, ${rep.screenshots.length} screenshots`);
  return rep;
}
async function runAuditCore(job, pr, gdl, { testsRep, browserRep, balanceRep }) {
  const trace = pr.artifact('trace');
  const ux = critics.ux(gdl, browserRep), des = critics.design(gdl, balanceRep), ph = critics.placeholders(gdl, pr.customFiles());
  const all = ux.concat(des, ph);
  const v = validator.validate(gdl, { dryRun: false });
  const G = audit.gates({ gdl, validation: v, tests: testsRep, browser: browserRep, balance: balanceRep, trace, critics: all, required: { commissioner: true } });
  const review = audit.designReview({ gdl, balance: balanceRep, browser: browserRep, trace, brief: pr.artifact('brief') });
  const card = audit.scorecard({ gates: G, review, critics: all });
  const a = { title: gdl.meta.title, at: new Date().toISOString(), gates: G, review, critics: all, scorecard: card };
  pr.writeReport('audit', a);
  fs.writeFileSync(pr.p('reports', 'AUDIT.md'), audit.toMarkdown(a));
  pr.update(m => { m.gates = { passed: G.passed, total: G.total, finished: G.finished, blocking: G.blocking }; m.score = card.score; });
  const bugs = all.filter(c => c.severity === 'critical' || c.severity === 'major');
  pr.writeMemory('KNOWN_BUGS', `# Known issues\n\n${bugs.length ? bugs.map(b => `- **${b.severity}** ${b.text}${b.fix ? ' → ' + b.fix : ''}`).join('\n') : '(none open)'}\n\n_Updated ${new Date().toISOString().slice(0, 10)}_\n`);
  return a;
}

/* ================= CREATE / REMASTER ================= */
async function runCreate(job) {
  const pr = Store.get(job.projectId);
  if (!pr) throw new Error('Project not found');
  const settings = loadSettings();
  let prompt = pr.prompt();
  // remaster: analyze imported game(s) first
  if (job.kind === 'remaster') {
    const atts = fs.existsSync(pr.p('attachments')) ? fs.readdirSync(pr.p('attachments')).filter(f => /\.html?$/i.test(f)) : [];
    if (!atts.length) throw new Error('Remaster needs an HTML game attached to the project.');
    const an = remaster.analyzeHtml(fs.readFileSync(pr.p('attachments', atts[0]), 'utf8'), atts[0]);
    pr.writeArtifact('inventory', an);
    pr.writeMemory('FEATURE_INVENTORY', `# Feature inventory — ${an.title}\n\n${Object.entries(an.inventory).map(([k, v]) => `## ${k}\n${v.length ? v.map(x => '- ' + x).join('\n') : '- (none)'}`).join('\n\n')}\n\nArchitecture of the original: ${an.architecture}. Screens detected: ${an.screens.join(', ') || '—'}.\n`);
    prompt = remaster.remasterPrompt(an, prompt);
    job.info(`Imported “${an.title}”: ${an.systems.length} systems inventoried (${an.inventory.core.length} core); genre ${an.genre.genre || 'unknown'}.`);
  }
  const llm = await llmIfReady(job);
  const log = (m) => job.info('  ' + m);

  // 1. brief
  job.begin('brief');
  let compiled = compiler.compileDeterministic(prompt);
  if (llm && prompt.length > 400) { try { compiled = await compiler.compileWithLLM(prompt, llm, log); } catch (e) { job.repair('brief', 'model requirement extraction failed, using the deterministic compiler: ' + e.message); } }
  const pf = prefs.applyToSettings(compiled.settings, loadPrefs());
  compiled.settings = pf.settings;
  for (const a of pf.applied) job.note('brief', 'Preference: ' + a);
  if (job.input.options) Object.assign(compiled.settings, job.input.options);
  prefs.learn(prompt, 'create');
  pr.writeArtifact('requirements', compiled);
  const majors = compiled.conflicts.filter(c => c.severity === 'major');
  job.done('brief', `${compiled.requirements.length} requirements (${compiled.requirements.filter(r => r.kind === 'must').length} must), genre: ${compiled.genre.genre || 'generic'}${compiled.conflicts.length ? `, ${compiled.conflicts.length} conflict(s) resolved` : ''}`);
  if (majors.length) job.info('Conflicts needing your decision: ' + majors.map(c => c.text).join('; '), 'warn');
  checkCancel(job);

  // 2. core loop + feature plan
  job.begin('loop');
  const module = designer.chooseModule(compiled.genre.genre);
  let brief = designer.makeBrief(compiled, prompt, loadPrefs());
  if (llm) { try { const b = await stages.producer(llm, { prompt, brief, log }); brief = Object.assign(brief, { title: b.title, tagline: b.tagline, role: b.role || brief.role, pitch: b.pitch, fantasy: b.fantasy, tensions: b.tensions && b.tensions.length ? b.tensions : brief.tensions, tone: b.tone }); } catch (e) { job.repair('loop', 'producer: ' + e.message); } }
  let features = designer.scoreFeatures(module.mod, compiled, brief);
  let plan = designer.designPlan(brief, features, module);
  if (llm) {
    try {
      const traceRows0 = designer.trace(compiled, module, module.mod.build({ features: Object.fromEntries(features.filter(f => f.flag).map(f => [f.flag, true])) }));
      const ld = await stages.leadDesigner(llm, { brief, plan, traceRows: traceRows0, log });
      for (const v of ld.verdicts || []) { const f = features.find(x => x.id === v.id); if (f && !(f.requested && v.verdict === 'cut')) { f.verdict = v.verdict; f.why = v.why; } }
      plan = designer.designPlan(brief, features, module);
      if (ld.pillars && ld.pillars.length) plan.pillars = ld.pillars;
      plan.missingDesigns = (ld.missing || []).filter(m => m.worthIt !== false);
    } catch (e) { job.repair('loop', 'lead designer: ' + e.message); }
  }
  pr.writeArtifact('brief', brief); pr.writeArtifact('plan', plan);
  const docs0 = designer.memoryDocs(brief, plan, { meta: { title: brief.title || '' }, kinds: {}, params: {}, ui: {} }, compiled, []);
  for (const k of ['GAME_BRIEF', 'DESIGN_PILLARS', 'CORE_LOOP']) pr.writeMemory(k, docs0[k]);
  job.done('loop', `${module.kind === 'pack' ? 'Genre pack' : 'Archetype'} “${module.id}”: kept ${plan.kept.length}, automated/merged ${plan.features.filter(f => f.verdict === 'automate' || f.verdict === 'merge').length}, cut ${plan.cut.length} features`);
  pr.snapshot('v0-design', 'Design brief, pillars, core loop and feature plan');

  // optional review pause
  if (job.opts.review) {
    job.status = 'paused'; job.waiting = { kind: 'design-review', brief, plan: { pillars: plan.pillars, features: plan.features.map(f => ({ id: f.id, label: f.label, verdict: f.verdict, requested: f.requested })) } };
    job.push('status', { status: 'paused', waiting: job.waiting });
    job.info('Paused for design review. Edit the brief or feature verdicts, then continue.');
    const edits = await new Promise(res => { job._resume = res; });
    job._resume = null; job.waiting = null; job.status = 'running'; job.push('status', { status: 'running' });
    checkCancel(job);
    if (edits) {
      if (edits.brief) brief = Object.assign(brief, edits.brief);
      for (const [id, verdict] of Object.entries(edits.verdicts || {})) { const f = features.find(x => x.id === id); if (f) f.verdict = verdict; }
      plan = designer.designPlan(brief, features, module); pr.writeArtifact('brief', brief); pr.writeArtifact('plan', plan);
      job.info('Design edits applied.');
    }
  }

  // 3. simulation
  job.begin('sim');
  const title = brief.title || designer.titleFor(brief, module, compiled, prompt) || null;
  let gdl = designer.buildGDL(brief, plan, module, { title });
  if (brief.tagline) gdl.meta.tagline = brief.tagline;
  if (brief.fantasy && brief.fantasy.length) gdl.meta.fantasy = brief.fantasy;
  const buildOpts = { features: Object.fromEntries(plan.features.filter(f => f.flag).map(f => [f.flag, f.verdict !== 'cut'])), title: title || undefined, genre: module.lexiconGenre || brief.genre, role: brief.role };
  writeBuildInfo(pr, { module: { kind: module.kind, id: module.id, genre: compiled.genre.genre }, buildOpts, metaOverrides: { tagline: gdl.meta.tagline, fantasy: gdl.meta.fantasy } });
  pr.writeArtifact('patches', []);
  let v = validator.validate(gdl, { dryRun: true, ticks: 20 });
  if (!v.ok) { job.repair('sim', 'scaffold failed validation: ' + vErrors(v).slice(0, 3).join('; ')); throw new Error('The design module produced an invalid game: ' + vErrors(v).slice(0, 5).join('; ')); }
  if (compiled.settings.delegateByDefault) {
    const d = modify.recipeDelegate(gdl, prompt);
    const r = patch.apply(gdl, d.ops); const vv = validator.validate(r.gdl, { dryRun: false });
    if (d.ops.length && vv.ok) { gdl = r.gdl; recordPatch(pr, 'preference: delegate routine work', r.applied, 'delegate'); job.note('sim', 'Preference applied: ' + (d.notes || []).slice(-1)[0]); }
  }
  job.done('sim', `${Object.keys(gdl.kinds).length} entity kinds, ${(gdl.actions || []).length} actions, ${(gdl.policies || []).length} policies, ${(gdl.events || []).length} events · dry run ${v.stats ? v.stats.ms + ' ms' : ''}`);
  checkCancel(job);

  // 4. world (content)
  job.begin('world');
  if (llm) {
    const r = await guardedPatch(job, 'world', gdl, async (errors) => { const out = await stages.contentDesigner(llm, { gdl, brief, count: 6, log, errors }); return { ops: [{ op: 'append', path: 'events', value: out.events }], summary: `${out.events.length} new events` }; }, { label: 'Content designer' });
    if (r.ok) { gdl = r.gdl; recordPatch(pr, 'content', r.ops, 'content'); }
  } else job.note('world', 'Content from the genre library (no model running).');
  job.done('world', `${Object.values(gdl.kinds).reduce((a, k) => a + (k.records ? k.records.length : 0), 0)} catalog records · ${(gdl.events || []).length} events · ${rivalCount(gdl)} rival organizations`);

  // 5. interface
  job.begin('ui');
  if (llm) {
    const r = await guardedPatch(job, 'ui', gdl, async () => { const t = await stages.creativeDirector(llm, { gdl, brief, log }); return { ops: [{ op: 'merge', path: 'theme', value: { motif: t.motif, mode: t.mode, palette: Object.assign({}, gdl.theme.palette, t.palette), fonts: t.fonts || gdl.theme.fonts, voice: t.voice, logoText: t.logoText || gdl.theme.logoText } }], summary: `motif ${t.motif}, ${t.mode}` }; }, { label: 'Creative director', dry: false });
    if (r.ok) { gdl = r.gdl; recordPatch(pr, 'theme', r.ops, 'ui'); }
  }
  pr.writeGame(gdl);
  job.done('ui', `${(gdl.ui.nav || []).length} destinations · motif ${gdl.theme.motif} (${gdl.theme.mode})`);
  pr.snapshot('v1-prototype', 'First playable build');

  // 6. systems: requirement trace and gap filling
  job.begin('systems');
  let traceRows = designer.trace(compiled, module, gdl);
  const gaps = traceRows.filter(t => t.status === 'not-found' && t.kind === 'must');
  if (gaps.length && llm) {
    for (const g of gaps.slice(0, 6)) {
      checkCancel(job);
      const design = ((plan.missingDesigns || []).find(m => m.requirement && g.text.toLowerCase().includes(m.requirement.toLowerCase().slice(0, 20))) || {}).design;
      const r = await guardedPatch(job, 'systems', gdl, (errors) => stages.featureEngineer(llm, { gdl, requirement: g.text, design, log, errors }), { label: `Feature “${g.text.slice(0, 50)}”` });
      if (r.ok) { gdl = r.gdl; recordPatch(pr, g.text, r.ops, 'feature'); g.status = 'implemented'; g.where = (r.ops || []).map(o => o.path); g.features = ['model-implemented']; }
    }
  }
  for (const g of traceRows.filter(t => t.status === 'not-found')) g.note = llm ? 'Could not be implemented automatically — visibly incomplete.' : 'Not covered by the genre library — install a local model to implement it, or request it as a modification.';
  pr.writeArtifact('trace', traceRows);
  pr.writeGame(gdl);
  const docs = designer.memoryDocs(brief, plan, gdl, compiled, traceRows);
  for (const [k, txt] of Object.entries(docs)) if (k !== 'CHANGELOG' || !pr.memory('CHANGELOG')) pr.writeMemory(k, txt);
  const still = traceRows.filter(t => t.status === 'not-found' && t.kind === 'must');
  job.done('systems', `${traceRows.filter(t => t.status === 'implemented').length}/${traceRows.length} requirements implemented${still.length ? ` · ${still.length} must-have(s) open: ${still.map(s => s.text).slice(0, 3).join('; ')}` : ''}`);

  // 7. tests (with targeted repair: report failures; a model can patch formulas)
  let testsRep = await runTests(job, pr);
  if (testsRep.failed && llm) {
    const failing = testsRep.results.filter(r => !r.ok).map(r => `${r.name}: ${r.error}`).join('\n');
    const r = await guardedPatch(job, 'tests', gdl, (errors) => stages.designCritic(llm, { gdl, report: { failingTests: failing }, findings: [{ id: 'runtime-errors', text: failing }], log }), { label: 'Repair failing tests' });
    if (r.ok) { gdl = r.gdl; recordPatch(pr, 'repair', r.ops, 'fix'); pr.writeGame(gdl); testsRep = await runTests(job, pr); }
  }
  if (!testsRep.failed) pr.snapshot('v2-functional', `${testsRep.passed} simulation tests pass`);
  checkCancel(job);

  // 8–9. playtest + balance
  job.begin('playtest');
  const years = Math.max(3, Math.min(10, settings.generation.balanceYears || 6));
  const seeds = Math.max(1, Math.round((settings.generation.balanceRuns || 12) / 6));
  const onProgress = (p) => job.push('progress', { stage: 'playtest', detail: `iteration ${p.iteration} · run ${p.done}/${p.total}` });
  const first = await balance.run(gdl, { seeds, years, onProgress: (d, n) => job.push('progress', { stage: 'playtest', detail: `run ${d}/${n}` }) });
  job.done('playtest', `${first.aggregate.runs} playthroughs × ${years} years in ${(first.ms / 1000).toFixed(0)} s · findings: ${first.findings.map(f => f.id).join(', ') || 'none'}`);
  job.begin('balance');
  let balanceRep = first, history = [{ iteration: 0, summary: balance.summarize(first), findings: first.findings, tuning: [] }];
  const tuning = balance.suggestTuning(gdl, first);
  if (tuning.length) {
    history[0].tuning = tuning;
    const before = JSON.parse(JSON.stringify(gdl));
    for (const t of tuning) patch.applyOne(gdl, { op: 'set', path: t.path, value: t.value });
    const ab = await balance.autoBalance(gdl, { iterations: 1, seeds, years, onProgress });
    gdl = ab.gdl; history = history.concat(ab.history.map((h, i) => Object.assign({}, h, { iteration: i + 1 })));
    const ops = []; for (const k of Object.keys(gdl.params)) if (gdl.params[k] !== before.params[k]) ops.push({ op: 'set', path: 'params.' + k, value: gdl.params[k], why: 'auto-balance' });
    recordPatch(pr, 'auto-balance', ops, 'balance');
    balanceRep = await balance.run(gdl, { seeds, years });
    job.note('balance', `Adjusted: ${ops.map(o => `${o.path.replace('params.', '')} → ${o.value}`).join(', ')}`);
  } else job.note('balance', 'Within target bands — no adjustment needed.');
  if (llm && balanceRep.findings.some(f => f.severity === 'major')) {
    const r = await guardedPatch(job, 'balance', gdl, () => stages.designCritic(llm, { gdl, report: balance.summarize(balanceRep), findings: balanceRep.findings, log }), { label: 'Design critic' });
    if (r.ok) { gdl = r.gdl; recordPatch(pr, 'design critic', r.ops, 'balance'); balanceRep = await balance.run(gdl, { seeds, years }); }
  }
  pr.writeReport('balance', balanceRep);
  pr.writeMemory('BALANCE_REPORT', balanceMarkdown(gdl.meta.title, history.concat([{ iteration: history.length, final: true, summary: balance.summarize(balanceRep), findings: balanceRep.findings, tuning: [] }]).filter((h, i, a) => i === 0 || i === a.length - 1)));
  pr.writeGame(gdl);
  job.done('balance', `findings after balancing: ${balanceRep.findings.map(f => f.id).join(', ') || 'none'}`);
  pr.snapshot('v3-playtested', 'Playtested and balanced');
  checkCancel(job);

  // 10. polish: browser QA + critics; deterministic fixes for common UX findings
  job.begin('polish');
  let browserRep = await runBrowser(job, pr, 'polish');
  const uxF = critics.ux(gdl, browserRep);
  const autoFix = [];
  if (uxF.some(f => f.id === 'menu-maze')) autoFix.push(...modify.recipeSimplify(gdl).ops);
  if (autoFix.length) { const r = patch.apply(gdl, autoFix); const vv = validator.validate(r.gdl, { dryRun: false }); if (vv.ok) { gdl = r.gdl; recordPatch(pr, 'polish', autoFix, 'ui'); pr.writeGame(gdl); job.note('polish', `Applied ${autoFix.length} interface fix(es)`); browserRep = await runBrowser(job, pr, 'polish', true); } }
  job.done('polish', `${uxF.length} UX notes`);
  pr.snapshot('v4-polished', 'Interface checked in a real browser');

  // 11. package + audit
  job.begin('package');
  const rel = releaseFile(pr, gdl);
  const a = await runAuditCore(job, pr, gdl, { testsRep, browserRep, balanceRep });
  pr.writeMemory('CHANGELOG', (pr.memory('CHANGELOG') || '# Changelog\n') + `\n- ${new Date().toISOString().slice(0, 10)}: Build complete — score ${a.scorecard.score}/100, gates ${a.scorecard.gates}.`);
  pr.snapshot('release', `Release ${rel.name} · gates ${a.scorecard.gates}`);
  job.done('package', `${rel.name} (${(rel.bytes / 1024 / 1024).toFixed(1)} MB) · gates ${a.scorecard.gates} · score ${a.scorecard.score}`);
  return { release: rel.name, gates: a.gates, scorecard: a.scorecard, title: gdl.meta.title };
}

/* ================= MODIFY (expand / fix / redesign UI / simplify / deepen / balance requests) ================= */
async function runModify(job) {
  const pr = Store.get(job.projectId);
  if (!pr) throw new Error('Project not found');
  const request = String(job.input.request || '').trim();
  if (!request) throw new Error('Empty request');
  const llm = await llmIfReady(job);
  const log = (m) => job.info('  ' + m);
  pr.update(m => { m.requests = (m.requests || []).concat([{ t: new Date().toISOString(), text: request, job: job.id }]); });
  pr.log('request', request, { job: job.id });
  prefs.learn(request, 'modify');
  let gdl = pr.gdl;
  if (!gdl) throw new Error('This project has no game yet. Build it first.');
  const before = JSON.parse(JSON.stringify(gdl));

  job.begin('understand');
  const b = pr.artifact('build');
  const packFeatures = b && b.module ? (designer.chooseModule(b.module.genre).mod.FEATURES || []) : [];
  const plan = modify.plan(gdl, request, { packFeatures, features: (pr.artifact('plan') || {}).features });
  pr.writeArtifact('last-change-plan', plan);
  job.done('understand', `Intent: ${plan.classification.intents.join(' + ')}${plan.classification.direction ? ` (${plan.classification.direction}, ${plan.classification.phase} game)` : ''}`);

  job.begin('plan');
  for (const s of plan.steps) for (const n of s.notes || []) job.note('plan', n);
  const needsLLM = plan.steps.filter(s => s.needsLLM);
  if (needsLLM.length && !llm) job.note('plan', 'This request needs a local model to design new systems (no model is running). Known recipes were applied; nothing else changed.');
  job.done('plan', `${plan.steps.length} step(s)`);

  job.begin('apply');
  const flags = Object.assign({}, ...plan.steps.map(s => s.flags || {}));
  const changed = [];
  if (Object.keys(flags).length && b && b.module) {
    const rb = rebuildFromBase(pr, flags);
    if (rb) { const vv = validator.validate(rb.gdl, { dryRun: true, ticks: 12 }); if (vv.ok) { gdl = rb.gdl; b.buildOpts.features = Object.assign({}, b.buildOpts.features, flags); writeBuildInfo(pr, b); changed.push(`features: ${Object.entries(flags).map(([k, v]) => (v ? '+' : '−') + k).join(', ')}`); } else job.repair('apply', 'feature rebuild failed validation: ' + vErrors(vv).slice(0, 3).join('; ')); }
  }
  const recipeOps = [].concat(...plan.steps.map(s => s.ops || []));
  if (recipeOps.length) {
    const r = patch.apply(gdl, recipeOps);
    if (r.failed.length) job.repair('apply', r.failed.map(f => `${f.op.path}: ${f.error}`).join('; '));
    const vv = validator.validate(r.gdl, { dryRun: true, ticks: 16 });
    if (vv.ok) { gdl = r.gdl; recordPatch(pr, request, r.applied, plan.classification.intents.join('+')); changed.push(`${r.applied.length} definition change(s)`); }
    else {
      job.repair('apply', 'recipe output failed validation: ' + vErrors(vv).slice(0, 4).join('; '));
      // targeted: apply ops one at a time, keep the ones that validate
      let cur = gdl; const kept = [];
      for (const op of recipeOps) { const r1 = patch.apply(cur, [op]); if (r1.failed.length) continue; const v1 = validator.validate(r1.gdl, { dryRun: false }); if (v1.ok) { cur = r1.gdl; kept.push(op); } }
      gdl = cur; if (kept.length) { recordPatch(pr, request, kept, plan.classification.intents.join('+')); changed.push(`${kept.length}/${recipeOps.length} change(s) kept after repair`); }
    }
  }
  if (needsLLM.length && llm) {
    const retrieved = stages.retrieve(gdl, request);
    const memory = ['GAME_BRIEF', 'SYSTEM_MAP', 'UI_MAP'].map(k => pr.memory(k)).join('\n').slice(0, 4000);
    const r = await guardedPatch(job, 'apply', gdl, (errors) => stages.changePlanner(llm, { gdl, request, memory, retrieved, log, errors }), { label: 'Change planner' });
    if (r.ok) { gdl = r.gdl; recordPatch(pr, request, r.ops, 'llm'); changed.push(`model: ${r.summary || r.ops.length + ' change(s)'}`); }
  }
  pr.writeGame(gdl);
  job.done('apply', changed.length ? changed.join(' · ') : 'no definition changes');

  const testsRep = await runTests(job, pr);
  if (testsRep.failed) {
    job.repair('tests', 'tests failed after the change — reverting to the previous definition and re-testing');
    pr.writeGame(before); gdl = before;
    const t2 = await runTests(job, pr);
    if (!t2.failed) throw new Error('The change broke the game and was reverted. Failing tests: ' + testsRep.results.filter(r => !r.ok).map(r => r.name).join(', '));
  }

  // balance: always measure when the request is about balance or changes automation/economy
  job.begin('balance');
  const balStep = plan.steps.find(s => s.intent === 'balance');
  const touchesSim = plan.steps.some(s => s.intent === 'delegate' || s.intent === 'feature' || s.intent === 'deepen' || s.intent === 'simplify');
  let balanceRep = pr.report('balance');
  const settings = loadSettings();
  const years = Math.max(4, Math.min(10, settings.generation.balanceYears || 6)), seeds = Math.max(1, Math.round((settings.generation.balanceRuns || 12) / 6));
  if (balStep || touchesSim) {
    const onProgress = (p) => job.push('progress', { stage: 'balance', detail: `iteration ${p.iteration} · run ${p.done}/${p.total}` });
    if (balStep) {
      const late = balStep.focus === 'late';
      const yb = late ? Math.max(8, years) : years, sb = Math.max(3, seeds);
      const strategies = ['passive', 'balanced', 'smart', 'aggressive'];
      job.note('balance', `Analyzing the game as it was: ${sb * strategies.length} playthroughs × ${yb} years${late ? ' (long runs, so the late game is actually played)' : ''}.`);
      const beforeRep = await balance.run(before, { seeds: sb, years: yb, strategies, onProgress: (d, n) => job.push('progress', { stage: 'balance', detail: `measuring before · run ${d}/${n}` }) });
      const dBefore = balance.diagnose(beforeRep, { phase: balStep.focus });
      for (const w of dBefore.why) job.note('balance', 'Why: ' + w);
      if ((balStep.ops || []).length) job.note('balance', 'Structural change: ' + (balStep.notes || []).filter(n => /system|Adds/.test(n)).join(' '));
      // With a structural change in place, the player's report has been answered; further knob tuning
      // follows the measurements only (no forced direction) and must respect guardrails.
      const structural = (balStep.ops || []).length > 0;
      const ab = await balance.autoBalance(gdl, { iterations: 2, seeds: sb, years: yb, strategies, focus: balStep.focus, direction: structural || balStep.direction === 'auto' ? undefined : balStep.direction, onProgress: (p) => job.push('progress', { stage: 'balance', detail: `rebalancing · round ${p.iteration + 1} · run ${p.done}/${p.total}` }) });
      const guard = (d) => {
        const v = [];
        if (dBefore.metrics.survival != null && d.metrics.survival != null && d.metrics.survival < dBefore.metrics.survival - 0.15) v.push(`competent survival ${Math.round(dBefore.metrics.survival * 100)}% → ${Math.round(d.metrics.survival * 100)}%`);
        if (late && dBefore.metrics.earlyGrowth && d.metrics.earlyGrowth && d.metrics.earlyGrowth < dBefore.metrics.earlyGrowth * 0.75) v.push(`early growth ×${dBefore.metrics.earlyGrowth.toFixed(2)} → ×${d.metrics.earlyGrowth.toFixed(2)}`);
        return v;
      };
      // candidates: each measured configuration (structural only, then each tuning round)
      const cands = ab.reports.map((r, i) => ({ i, rep: r.rep, params: r.params, d: balance.diagnose(r.rep, { phase: balStep.focus }) }));
      for (const c of cands) c.violations = guard(c.d);
      const ok = cands.filter(c => !c.violations.length);
      const harder = balStep.direction !== 'easier';
      const score = (c) => harder ? -((c.d.metrics.lateGrowth || 1) + (c.d.metrics.lateMargin || 0)) : (c.d.metrics.survival || 0);
      const pick = (ok.length ? ok : cands.slice().sort((a, b) => (b.d.metrics.survival || 0) - (a.d.metrics.survival || 0)).slice(0, 1)).sort((a, b) => score(b) - score(a))[0];
      for (const h of ab.history) for (const t of h.tuning) job.note('balance', t.why);
      if (pick.i < cands.length - 1) job.note('balance', `Guardrails: kept round ${pick.i + 1} of ${cands.length}${cands[cands.length - 1].violations.length ? ' — later tuning went too far (' + cands[cands.length - 1].violations.join('; ') + ')' : ''}.`);
      if (!ok.length) job.note('balance', 'No configuration met every guardrail; kept the one where the most competent strategies survive.');
      const ops = []; for (const k of Object.keys(pick.params || {})) if (pick.params[k] !== gdl.params[k]) ops.push({ op: 'set', path: 'params.' + k, value: pick.params[k], why: 'rebalance' });
      if (ops.length) { for (const o of ops) gdl.params[o.path.slice(7)] = o.value; recordPatch(pr, request, ops, 'balance'); }
      pr.writeGame(gdl);
      balanceRep = pick.rep;
      const dAfter = pick.d;
      const pc = (x) => x == null ? '—' : Math.round(x * 100) + '%';
      const fx = (x) => x == null ? '—' : '×' + x.toFixed(2);
      const rows = [['Late-game operating margin', pc(dBefore.metrics.lateMargin), pc(dAfter.metrics.lateMargin)], ['Late-game value growth per year', fx(dBefore.metrics.lateGrowth), fx(dAfter.metrics.lateGrowth)], ['Early-game value growth per year', fx(dBefore.metrics.earlyGrowth), fx(dAfter.metrics.earlyGrowth)], ['Runs finishing #1', pc(dBefore.metrics.topShare), pc(dAfter.metrics.topShare)], ['Cash as share of value at the end', pc(dBefore.metrics.cashShare), pc(dAfter.metrics.cashShare)], ['Competent strategies surviving', pc(dBefore.metrics.survival), pc(dAfter.metrics.survival)]];
      for (const r of rows) job.note('balance', `${r[0]}: ${r[1]} → ${r[2]}`);
      const improved = (balStep.direction === 'harder' ? ((dAfter.metrics.lateGrowth || 0) < (dBefore.metrics.lateGrowth || 0) || (dAfter.metrics.lateMargin || 0) < (dBefore.metrics.lateMargin || 0)) : balStep.direction === 'easier' ? (dAfter.metrics.survival || 0) >= (dBefore.metrics.survival || 0) : true) && !pick.violations.length;
      const earlyKept = dBefore.metrics.earlyGrowth == null || dAfter.metrics.earlyGrowth == null || dAfter.metrics.earlyGrowth >= dBefore.metrics.earlyGrowth * 0.85;
      job.note('balance', improved ? `Verdict: the ${late ? 'late game' : 'game'} is measurably ${balStep.direction === 'easier' ? 'easier' : 'harder'}${late ? (earlyKept ? ', and the opening plays about the same' : ' — the opening also got somewhat harder') : ''}.` : pick.violations.length ? `Verdict: partial — ${pick.violations.join('; ')}. Review the balance report before shipping.` : 'Verdict: the measurements did not move enough — the dominance costs still apply to big companies; try again or adjust the knobs on the Balance page.');
      pr.writeMemory('BALANCE_REPORT', `# Balance report — ${gdl.meta.title}\n\n_${new Date().toISOString().slice(0, 16).replace('T', ' ')}_ · Request: “${request}”\n\n## Diagnosis (before)\n${dBefore.why.map(w => '- ' + w).join('\n')}\n\n## Changes\n${(balStep.notes || []).map(n => '- ' + n).join('\n')}\n${ab.history.flatMap(h => h.tuning).map(t => '- ' + t.why).join('\n')}\n\n## Before → after (same seeds, ${sb * strategies.length} playthroughs × ${yb} years each)\n\n| Measure | Before | After |\n|---|---|---|\n${rows.map(r => `| ${r[0]} | ${r[1]} | ${r[2]} |`).join('\n')}\n\n**Verdict:** ${improved ? 'improved' : pick.violations.length ? 'partial (' + pick.violations.join('; ') + ')' : 'not measurably changed'}${late ? (earlyKept ? '; early game preserved' : '; early game also affected') : ''}.\n\n## Diagnosis (after)\n${dAfter.why.map(w => '- ' + w).join('\n')}\n` + balanceMarkdown(gdl.meta.title, ab.history).replace(/^# .*\n/, '\n## Rebalancing rounds\n'));
    } else {
      balanceRep = await balance.run(gdl, { seeds, years: Math.min(years, 5), onProgress: (d, n) => job.push('progress', { stage: 'balance', detail: `run ${d}/${n}` }) });
      job.note('balance', `Re-simulated after the change: ${balanceRep.findings.map(f => f.id).join(', ') || 'no findings'}`);
    }
    pr.writeReport('balance', balanceRep);
    job.done('balance', `${balanceRep.findings.length} finding(s) after the change`);
  } else job.done('balance', 'Not needed for this change', 'skipped');

  job.begin('polish');
  const uiChanged = plan.steps.some(s => s.intent === 'visual' || s.intent === 'delegate' || s.intent === 'simplify' || s.intent === 'feature');
  let browserRep = pr.report('browser');
  if (uiChanged || plan.steps.some(s => s.diagnose)) browserRep = await runBrowser(job, pr, 'polish');
  job.done('polish', browserRep && !browserRep.skipped ? `${browserRep.passed}/${browserRep.passed + browserRep.failed} browser checks` : 'skipped');

  job.begin('package');
  const rel = releaseFile(pr, gdl);
  const a = await runAuditCore(job, pr, gdl, { testsRep: pr.report('tests'), browserRep, balanceRep });
  const summary = plan.steps.flatMap(s => s.notes || []).join(' ');
  pr.writeMemory('CHANGELOG', (pr.memory('CHANGELOG') || '# Changelog\n') + `\n- ${new Date().toISOString().slice(0, 10)}: “${request}” → ${summary || 'no changes'} (gates ${a.scorecard.gates})`);
  const b2 = pr.artifact('brief'), pl = pr.artifact('plan'), req = pr.artifact('requirements'), tr = pr.artifact('trace');
  if (b2 && pl && req) { const docs = designer.memoryDocs(b2, pl, gdl, req, tr || []); for (const k of ['SYSTEM_MAP', 'UI_MAP', 'ECONOMY_RULES', 'ENTITY_SCHEMA']) pr.writeMemory(k, docs[k]); }
  const vid = pr.snapshot(plan.steps.some(s => s.export) ? 'release' : 'change', request.slice(0, 120));
  job.done('package', `${rel.name} · version ${vid}`);
  return { release: rel.name, version: vid, plan: plan.steps.map(s => ({ intent: s.intent, notes: s.notes })), scorecard: a.scorecard, gates: a.gates };
}

/* ================= AUDIT (no changes) ================= */
async function runAudit(job) {
  const pr = Store.get(job.projectId); const gdl = pr && pr.gdl;
  if (!gdl) throw new Error('No game to audit');
  const testsRep = await runTests(job, pr);
  job.begin('playtest');
  const settings = loadSettings();
  const balanceRep = await balance.run(gdl, { seeds: Math.max(1, Math.round((settings.generation.balanceRuns || 12) / 6)), years: settings.generation.balanceYears || 6, onProgress: (d, n) => job.push('progress', { stage: 'playtest', detail: `run ${d}/${n}` }) });
  pr.writeReport('balance', balanceRep);
  job.done('playtest', `${balanceRep.aggregate.runs} playthroughs · ${balanceRep.findings.length} findings`);
  job.begin('polish');
  const browserRep = await runBrowser(job, pr, 'polish');
  job.done('polish');
  job.begin('audit');
  const a = await runAuditCore(job, pr, gdl, { testsRep, browserRep, balanceRep });
  job.done('audit', `score ${a.scorecard.score}/100 · gates ${a.scorecard.gates} · review ${a.scorecard.review}`);
  return { scorecard: a.scorecard, gates: a.gates };
}

/* ================= BALANCE ================= */
async function runBalance(job) {
  const pr = Store.get(job.projectId); let gdl = pr && pr.gdl;
  if (!gdl) throw new Error('No game to balance');
  const settings = loadSettings();
  const years = settings.generation.balanceYears || 6, seeds = Math.max(1, Math.round((settings.generation.balanceRuns || 12) / 6));
  job.begin('playtest');
  const onProgress = (p) => job.push('progress', { stage: 'playtest', detail: `iteration ${p.iteration} · run ${p.done}/${p.total}` });
  const ab = await balance.autoBalance(gdl, { iterations: 3, seeds, years, onProgress, direction: job.input.direction, focus: job.input.focus });
  job.done('playtest', `${ab.history.length} simulate/analyze rounds`);
  job.begin('balance');
  const ops = []; for (const k of Object.keys(ab.gdl.params || {})) if (ab.gdl.params[k] !== gdl.params[k]) ops.push({ op: 'set', path: 'params.' + k, value: ab.gdl.params[k] });
  for (const h of ab.history) for (const t of h.tuning) job.note('balance', t.why);
  if (ops.length) { gdl = ab.gdl; recordPatch(pr, 'balance', ops, 'balance'); pr.writeGame(gdl); }
  pr.writeMemory('BALANCE_REPORT', balanceMarkdown(gdl.meta.title, ab.history));
  job.done('balance', ops.length ? `${ops.length} parameter(s) changed` : 'already within targets');
  await runTests(job, pr);
  job.begin('package'); const rel = releaseFile(pr, gdl); pr.snapshot('balance', 'Auto-balance'); job.done('package', rel.name);
  return { release: rel.name, history: ab.history.map(h => ({ iteration: h.iteration, findings: h.findings.map(f => f.text), tuning: h.tuning.map(t => t.why) })) };
}

/* ================= EXPORT ================= */
async function runExport(job) {
  const pr = Store.get(job.projectId); const gdl = pr && pr.gdl;
  if (!gdl) throw new Error('Nothing to export');
  job.begin('tests');
  const v = validator.validate(gdl, { dryRun: true, ticks: 20 });
  job.done('tests', v.ok ? 'definition valid, dry run clean' : 'problems: ' + vErrors(v).slice(0, 3).join('; '), v.ok ? 'done' : 'failed');
  job.begin('package');
  const rel = releaseFile(pr, gdl);
  // portable zip-free dev bundle: the project's game/ folder is already self-contained (pinned engine copy)
  pr.snapshot('release', `Exported ${rel.name}`);
  pr.log('export', rel.name);
  job.done('package', `${rel.name} (${(rel.bytes / 1024 / 1024).toFixed(1)} MB standalone) + dev project in game/`);
  return { release: rel.name, path: rel.file, devProject: pr.p('game') };
}

module.exports = { start, get, list, cancel, resume, Job, CREATE_STAGES, MODIFY_STAGES };
