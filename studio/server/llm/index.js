/* LLM service: role → model routing, structured JSON output with schema validation and repair,
   response cache, sequential execution (one big model resident at a time), model management. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadSettings, saveSettings, DATA } = require('../config');
const { providersFrom, logCall } = require('./providers');
const hardware = require('./hardware');
const PRESETS = require('./presets.json').presets;

/* ---------- tiny JSON-schema validator (subset) ---------- */
function validate(schema, v, at = '$', errs = []) {
  if (!schema) return errs;
  const t = Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v;
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const ok = types.some(ty => ty === t || (ty === 'integer' && t === 'number' && Number.isInteger(v)) || (ty === 'number' && t === 'number'));
    if (!ok) { errs.push(`${at}: expected ${types.join('|')}, got ${t}`); return errs; }
  }
  if (schema.enum && !schema.enum.includes(v)) errs.push(`${at}: must be one of ${schema.enum.join(', ')}`);
  if (t === 'object' && schema.properties) {
    for (const r of schema.required || []) if (v[r] === undefined) errs.push(`${at}.${r}: missing`);
    for (const [k, s] of Object.entries(schema.properties)) if (v[k] !== undefined) validate(s, v[k], `${at}.${k}`, errs);
  }
  if (t === 'array') {
    if (schema.minItems && v.length < schema.minItems) errs.push(`${at}: needs at least ${schema.minItems} items`);
    if (schema.maxItems && v.length > schema.maxItems) errs.push(`${at}: at most ${schema.maxItems} items`);
    if (schema.items) v.forEach((x, i) => validate(schema.items, x, `${at}[${i}]`, errs));
  }
  return errs;
}
/* Extract JSON from model text (handles ```json fences, leading prose, trailing commas). */
function extractJSON(text) {
  if (text == null) throw new Error('empty response');
  let s = String(text).trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.search(/[\[{]/);
  if (start > 0) s = s.slice(start);
  // find matching end
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === '{' || c === '[') depth++; else if (c === '}' || c === ']') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end > 0) s = s.slice(0, end + 1);
  try { return JSON.parse(s); } catch (e) {
    const fixed = s.replace(/,\s*([}\]])/g, '$1').replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":');
    return JSON.parse(fixed);
  }
}

class LLM {
  constructor() { this.queue = Promise.resolve(); this.reload(); }
  reload() { this.settings = loadSettings(); this.providers = providersFrom(this.settings); this.hw = hardware.detect(); }
  /* Which provider/model serves a role. Cloud only when explicitly requested for this call/build. */
  route(role, opts = {}) {
    if (opts.useCloud && this.providers.cloud) return { provider: this.providers.cloud, model: this.settings.providers.cloud.model };
    const model = opts.model || this.settings.roles[role] || this.settings.roles.main || '';
    const prov = this.providers.ollama || this.providers.openaiCompatible;
    if (opts.provider && this.providers[opts.provider]) return { provider: this.providers[opts.provider], model };
    return { provider: prov, model };
  }
  async status() {
    const out = { providers: {}, roles: this.settings.roles, hardware: this.hw, ready: false };
    for (const [k, p] of Object.entries(this.providers)) out.providers[k] = await p.available();
    const r = this.route('main');
    out.ready = !!(r.provider && r.model && out.providers[r.provider === this.providers.ollama ? 'ollama' : 'openaiCompatible'] && out.providers[r.provider === this.providers.ollama ? 'ollama' : 'openaiCompatible'].ok);
    return out;
  }
  cacheKey(obj) { return crypto.createHash('sha1').update(JSON.stringify(obj)).digest('hex'); }
  cacheGet(k) { try { return JSON.parse(fs.readFileSync(path.join(DATA, 'cache', k + '.json'), 'utf8')); } catch (e) { return null; } }
  cachePut(k, v) { try { fs.mkdirSync(path.join(DATA, 'cache'), { recursive: true }); fs.writeFileSync(path.join(DATA, 'cache', k + '.json'), JSON.stringify(v)); } catch (e) { /* ignore */ } }
  /* Sequential execution: local machines run one large model at a time. */
  run(fn) { const p = this.queue.then(fn, fn); this.queue = p.catch(() => {}); return p; }
  /* Structured completion with validation + repair. Returns parsed JSON. */
  async json({ role = 'main', system, prompt, schema, temperature, maxTokens = 4096, repairs, label = 'call', useCloud = false, cache = true, onLog, model: modelOverride }) {
    const { provider, model } = this.route(role, { useCloud, model: modelOverride });
    if (!provider || !model) throw Object.assign(new Error('No local model configured. Install one on the Models page.'), { code: 'NO_MODEL' });
    const numCtx = role === 'fast' ? this.settings.context.fast : this.settings.context.main;
    const messages = [{ role: 'system', content: system }, { role: 'user', content: prompt }];
    const key = this.cacheKey({ model, messages, schema, temperature });
    if (cache) { const hit = this.cacheGet(key); if (hit) { onLog && onLog(`${label}: cached response`); return hit; } }
    const maxRep = repairs != null ? repairs : this.settings.generation.maxRepairs;
    let lastErr = null;
    for (let attempt = 0; attempt <= maxRep; attempt++) {
      const t0 = Date.now();
      const res = await this.run(() => provider.chat({ model, messages, schema, temperature: temperature != null ? temperature : this.settings.generation.temperature, numCtx, maxTokens }));
      logCall({ label, role, model, provider: provider.kind, ms: Date.now() - t0, attempt, usage: res.usage, chars: res.text.length });
      try {
        const obj = extractJSON(res.text);
        const errs = validate(schema, obj);
        if (errs.length) throw new Error('Schema problems: ' + errs.slice(0, 8).join('; '));
        if (cache) this.cachePut(key, obj);
        onLog && onLog(`${label}: ok (${((Date.now() - t0) / 1000).toFixed(1)}s, ${model})`);
        return obj;
      } catch (e) {
        lastErr = e;
        onLog && onLog(`${label}: repair ${attempt + 1} — ${e.message.slice(0, 160)}`);
        messages.push({ role: 'assistant', content: res.text.slice(0, 6000) }, { role: 'user', content: `That output could not be used: ${e.message}. Reply again with ONLY valid JSON matching the schema. No commentary.` });
      }
    }
    throw Object.assign(new Error(`${label} failed after ${maxRep + 1} attempts: ${lastErr && lastErr.message}`), { code: 'LLM_FAILED' });
  }
  async text({ role = 'main', system, prompt, temperature, maxTokens = 2048, label = 'text', useCloud = false }) {
    const { provider, model } = this.route(role, { useCloud });
    if (!provider || !model) throw Object.assign(new Error('No local model configured.'), { code: 'NO_MODEL' });
    const res = await this.run(() => provider.chat({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], temperature, maxTokens, numCtx: this.settings.context.main }));
    logCall({ label, role, model, provider: provider.kind, chars: res.text.length });
    return res.text;
  }

  /* ---------- model management ---------- */
  async installed() {
    const out = [];
    for (const [k, p] of Object.entries(this.providers)) { if (k === 'cloud') continue; try { for (const m of await p.listModels()) out.push(Object.assign({ provider: k }, m)); } catch (e) { /* provider down */ } }
    return out;
  }
  async recommendations() {
    const inst = await this.installed();
    const ctx = this.settings.context.main;
    return PRESETS.map(p => {
      const i = inst.find(m => m.id === p.id || m.id === p.id + ':latest');
      const sizeGB = i && i.sizeGB ? i.sizeGB : p.approxSizeGB;
      const f = hardware.fit({ sizeGB, paramsB: p.paramsB }, ctx, this.hw);
      return Object.assign({}, p, { installed: !!i, sizeGB, sizeSource: i ? 'measured' : 'catalog estimate', fit: f });
    });
  }
  async pull(model, onProgress) {
    const p = this.providers.ollama;
    if (!p) throw new Error('Model downloads need Ollama. Enable it in Settings or install models through your other runtime.');
    return p.pull(model, onProgress);
  }
  async remove(model) { const p = this.providers.ollama; if (!p) throw new Error('Ollama not enabled'); return p.remove(model); }
  setRoles(roles) { this.settings.roles = Object.assign({}, this.settings.roles, roles); saveSettings(this.settings); return this.settings.roles; }
  /* Measures speed and JSON reliability on THIS machine; results drive recommendations. */
  async benchmark(model) {
    const schema = { type: 'object', required: ['title', 'systems'], properties: { title: { type: 'string' }, systems: { type: 'array', minItems: 3, items: { type: 'object', required: ['name', 'decision'], properties: { name: { type: 'string' }, decision: { type: 'string' } } } } } };
    const prev = this.settings.roles.main;
    const results = [];
    for (let i = 0; i < 2; i++) {
      const t0 = Date.now();
      try {
        const r = await this.json({ role: 'main', model: model || undefined, label: 'benchmark', cache: false, repairs: 0, system: 'You are a game designer. Reply with JSON only.', prompt: 'Design 3 core systems for a restaurant empire management game. Each needs a name and the key player decision.', schema, maxTokens: 600, onLog: null, temperature: 0.3 });
        results.push({ ok: true, ms: Date.now() - t0, systems: r.systems.length });
      } catch (e) { results.push({ ok: false, ms: Date.now() - t0, error: e.message }); }
    }
    const ok = results.filter(r => r.ok);
    const rec = { model: prev, at: new Date().toISOString(), jsonReliability: ok.length / results.length, avgSeconds: ok.length ? ok.reduce((a, r) => a + r.ms, 0) / ok.length / 1000 : null, results };
    const bp = path.join(DATA, 'benchmarks.json');
    let all = {}; try { all = JSON.parse(fs.readFileSync(bp, 'utf8')); } catch (e) { /* first */ }
    all[model || prev] = rec; fs.writeFileSync(bp, JSON.stringify(all, null, 2));
    return rec;
  }
}

let singleton = null;
module.exports = { get: () => (singleton = singleton || new LLM()), LLM, validate, extractJSON, PRESETS };
