/* Local Game Studio — project workspaces.
   Each generated game is a persistent folder: prompt, memory documents, modular game source,
   versions (restorable snapshots), reports, releases, change history. */
'use strict';
const fs = require('fs');
const path = require('path');
const { PROJECTS } = require('../config');
const bundle = require('../../../engine/bundle.js');

const MEMORY_DOCS = ['GAME_BRIEF', 'DESIGN_PILLARS', 'CORE_LOOP', 'SYSTEM_MAP', 'ENTITY_SCHEMA', 'ECONOMY_RULES', 'UI_MAP', 'VISUAL_DIRECTION', 'COMMISSIONER_SPEC', 'REQUIREMENTS_MATRIX', 'KNOWN_BUGS', 'BALANCE_REPORT', 'CHANGELOG'];
const STAGES = ['v0-design', 'v1-prototype', 'v2-functional', 'v3-playtested', 'v4-polished', 'release'];

function slugify(s) { return String(s || 'game').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'game'; }
function readJSON(p, d) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return d; } }
function writeJSON(p, o) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(o, null, 2)); }
function copyDir(src, dst, skip = () => false) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip(e.name)) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d, skip); else fs.copyFileSync(s, d);
  }
}
function rmDir(p) { fs.rmSync(p, { recursive: true, force: true }); }

class Project {
  constructor(dir) { this.dir = dir; this.id = path.basename(dir); }
  p(...rel) { return path.join(this.dir, ...rel); }
  get meta() { return readJSON(this.p('project.json'), {}); }
  saveMeta(m) { writeJSON(this.p('project.json'), m); }
  update(fn) { const m = this.meta; fn(m); m.updated = new Date().toISOString(); this.saveMeta(m); return m; }
  get gdl() { return readJSON(this.p('game', 'data', 'game.json'), null); }
  prompt() { try { return fs.readFileSync(this.p('prompt.md'), 'utf8'); } catch (e) { return ''; } }
  memory(name) { try { return fs.readFileSync(this.p('memory', name + '.md'), 'utf8'); } catch (e) { return ''; } }
  writeMemory(name, text) { fs.mkdirSync(this.p('memory'), { recursive: true }); fs.writeFileSync(this.p('memory', name + '.md'), text); }
  memoryAll() { const out = {}; for (const n of MEMORY_DOCS) out[n] = this.memory(n); return out; }
  artifact(name) { return readJSON(this.p('artifacts', name + '.json'), null); }
  writeArtifact(name, obj) { writeJSON(this.p('artifacts', name + '.json'), obj); }
  report(name) { return readJSON(this.p('reports', name + '.json'), null); }
  writeReport(name, obj) { writeJSON(this.p('reports', name + '.json'), obj); }
  /* Write the game definition + dev build. */
  writeGame(gdl, customFiles = {}) {
    bundle.writeDevProject(this.p('game'), gdl, { customFiles });
    this.update(m => { m.title = gdl.meta && gdl.meta.title || m.title; m.genre = gdl.meta && gdl.meta.genre || m.genre; });
  }
  customFiles() { return bundle.readCustom(this.p('game')); }
  /* Versions: full snapshots of game/ + memory/ + artifacts/ */
  versions() {
    const dir = this.p('versions');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(d => fs.existsSync(path.join(dir, d, 'version.json'))).map(d => Object.assign({ id: d }, readJSON(path.join(dir, d, 'version.json'), {}))).sort((a, b) => String(a.created).localeCompare(String(b.created)));
  }
  snapshot(stage, note) {
    const n = this.versions().length;
    const id = `${String(n).padStart(3, '0')}-${stage}`;
    const dst = this.p('versions', id);
    for (const sub of ['game', 'memory', 'artifacts']) if (fs.existsSync(this.p(sub))) copyDir(this.p(sub), path.join(dst, sub), (name) => name === 'engine');
    writeJSON(path.join(dst, 'version.json'), { stage, note: note || '', created: new Date().toISOString() });
    this.update(m => { m.currentVersion = id; m.stage = stage; });
    return id;
  }
  restore(versionId) {
    const src = this.p('versions', versionId);
    if (!fs.existsSync(src)) throw new Error('Version not found');
    this.snapshot('backup', `Automatic backup before restoring ${versionId}`);
    for (const sub of ['memory', 'artifacts']) { rmDir(this.p(sub)); if (fs.existsSync(path.join(src, sub))) copyDir(path.join(src, sub), this.p(sub)); }
    const gdl = readJSON(path.join(src, 'game', 'data', 'game.json'), null);
    if (gdl) {
      rmDir(this.p('game', 'src')); if (fs.existsSync(path.join(src, 'game', 'src'))) copyDir(path.join(src, 'game', 'src'), this.p('game', 'src'));
      bundle.writeDevProject(this.p('game'), gdl);
    }
    this.log('restore', `Restored ${versionId}`);
    return true;
  }
  log(kind, text, extra) {
    const p = this.p('history.json');
    const h = readJSON(p, []);
    h.push(Object.assign({ t: new Date().toISOString(), kind, text }, extra || {}));
    writeJSON(p, h.slice(-500));
  }
  history() { return readJSON(this.p('history.json'), []); }
  release(html, slug) {
    fs.mkdirSync(this.p('releases'), { recursive: true });
    const file = this.p('releases', `${slug || slugify(this.meta.title)}.html`);
    fs.writeFileSync(file, html);
    return file;
  }
  releases() { const d = this.p('releases'); return fs.existsSync(d) ? fs.readdirSync(d).map(f => ({ file: f, size: fs.statSync(path.join(d, f)).size, mtime: fs.statSync(path.join(d, f)).mtime })) : []; }
  summary() {
    const m = this.meta;
    return { id: this.id, title: m.title, genre: m.genre, status: m.status, stage: m.stage, created: m.created, updated: m.updated, gates: m.gates || null, lastJob: m.lastJob || null, mode: m.mode, hasGame: fs.existsSync(this.p('game', 'data', 'game.json')) };
  }
}

const Store = {
  list() {
    if (!fs.existsSync(PROJECTS)) return [];
    return fs.readdirSync(PROJECTS).filter(d => fs.existsSync(path.join(PROJECTS, d, 'project.json'))).map(d => new Project(path.join(PROJECTS, d)).summary()).sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
  },
  get(id) {
    const dir = path.join(PROJECTS, path.basename(String(id)));
    if (!fs.existsSync(path.join(dir, 'project.json'))) return null;
    return new Project(dir);
  },
  create({ title, prompt, mode = 'create', options = {}, attachments = [] }) {
    fs.mkdirSync(PROJECTS, { recursive: true });
    let base = slugify(title || (prompt || '').split(/\s+/).slice(0, 6).join(' ')), id = base, n = 2;
    while (fs.existsSync(path.join(PROJECTS, id))) id = `${base}-${n++}`;
    const dir = path.join(PROJECTS, id);
    fs.mkdirSync(path.join(dir, 'memory'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'attachments'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'prompt.md'), prompt || '');
    for (const a of attachments) fs.writeFileSync(path.join(dir, 'attachments', path.basename(a.name)), a.content);
    const now = new Date().toISOString();
    const pr = new Project(dir);
    pr.saveMeta({ id, title: title || 'Untitled game', mode, options, status: 'new', stage: null, created: now, updated: now, requests: [] });
    pr.log('create', 'Project created', { mode });
    return pr;
  },
  remove(id) { const p = Store.get(id); if (p) rmDir(p.dir); }
};

module.exports = { Store, Project, MEMORY_DOCS, STAGES, slugify, readJSON, writeJSON, copyDir };
