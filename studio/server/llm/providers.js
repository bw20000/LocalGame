/* LLM providers. Local first:
   - ollama: native API (/api/chat with JSON-schema `format`), model management (/api/tags, /api/pull…)
   - openaiCompatible: LM Studio, mlx_lm.server, llama.cpp server (/v1/chat/completions)
   - cloud: optional, disabled by default, only used when the user explicitly selects it.
   No provider is ever called implicitly; every request goes through `complete()` which logs it. */
'use strict';
const fs = require('fs');
const path = require('path');
const { DATA } = require('../config');

async function http(url, body, { method = 'POST', timeoutMs = 600000, headers = {}, stream = false } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method, headers: Object.assign({ 'content-type': 'application/json' }, headers), body: body == null ? undefined : JSON.stringify(body), signal: ctrl.signal });
    if (stream) return res;
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 300)}`);
    try { return JSON.parse(text); } catch (e) { return text; }
  } finally { clearTimeout(timer); }
}
function logCall(entry) {
  try { fs.mkdirSync(path.join(DATA, 'logs'), { recursive: true }); fs.appendFileSync(path.join(DATA, 'logs', 'llm-calls.jsonl'), JSON.stringify(Object.assign({ t: new Date().toISOString() }, entry)) + '\n'); } catch (e) { /* logging must never break a build */ }
}

class OllamaProvider {
  constructor(cfg) { this.cfg = cfg; this.base = cfg.baseUrl.replace(/\/$/, ''); this.kind = 'ollama'; }
  async available() { try { const r = await http(this.base + '/api/version', null, { method: 'GET', timeoutMs: 2500 }); return { ok: true, version: r.version }; } catch (e) { return { ok: false, error: e.message }; } }
  async listModels() { const r = await http(this.base + '/api/tags', null, { method: 'GET', timeoutMs: 5000 }); return (r.models || []).map(m => ({ id: m.name, sizeGB: +(m.size / 1024 ** 3).toFixed(2), family: m.details && m.details.family, params: m.details && m.details.parameter_size, quant: m.details && m.details.quantization_level, modified: m.modified_at })); }
  async show(model) { return http(this.base + '/api/show', { model }); }
  async remove(model) { return http(this.base + '/api/delete', { model }, { method: 'DELETE' }); }
  async pull(model, onProgress) {
    const res = await http(this.base + '/api/pull', { model, stream: true }, { stream: true, timeoutMs: 6 * 3600 * 1000 });
    if (!res.ok) throw new Error(`pull failed: ${res.status}`);
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ''; let last = null;
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue; try { last = JSON.parse(line); if (last.error) throw new Error(last.error); onProgress && onProgress(last); } catch (e) { if (e.message && !e.message.startsWith('Unexpected')) throw e; } }
    }
    return last;
  }
  async chat({ model, messages, schema, temperature = 0.4, numCtx = 16384, maxTokens = 4096, timeoutMs }) {
    const body = { model, messages, stream: false, options: { temperature, num_ctx: numCtx, num_predict: maxTokens } };
    if (schema) body.format = schema;
    const r = await http(this.base + '/api/chat', body, { timeoutMs: timeoutMs || 900000 });
    return { text: (r.message && r.message.content) || '', usage: { prompt: r.prompt_eval_count, completion: r.eval_count, ms: r.total_duration ? r.total_duration / 1e6 : null } };
  }
}

class OpenAICompatProvider {
  constructor(cfg) { this.cfg = cfg; this.base = cfg.baseUrl.replace(/\/$/, ''); this.kind = 'openai-compatible'; }
  headers() { return this.cfg.apiKey ? { authorization: 'Bearer ' + this.cfg.apiKey } : {}; }
  async available() { try { await http(this.base + '/models', null, { method: 'GET', timeoutMs: 2500, headers: this.headers() }); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } }
  async listModels() { const r = await http(this.base + '/models', null, { method: 'GET', timeoutMs: 5000, headers: this.headers() }); return (r.data || []).map(m => ({ id: m.id, sizeGB: null })); }
  async chat({ model, messages, schema, temperature = 0.4, maxTokens = 4096, timeoutMs }) {
    const body = { model, messages, temperature, max_tokens: maxTokens };
    if (schema) body.response_format = { type: 'json_schema', json_schema: { name: 'output', schema, strict: false } };
    let r;
    try { r = await http(this.base + '/chat/completions', body, { headers: this.headers(), timeoutMs: timeoutMs || 900000 }); }
    catch (e) { if (schema) { body.response_format = { type: 'json_object' }; r = await http(this.base + '/chat/completions', body, { headers: this.headers(), timeoutMs: timeoutMs || 900000 }); } else throw e; }
    const c = r.choices && r.choices[0];
    return { text: (c && c.message && c.message.content) || '', usage: r.usage || {} };
  }
}

/* Optional premium provider (OpenAI-style or Anthropic-style). Never used unless enabled AND chosen. */
class CloudProvider {
  constructor(cfg) { this.cfg = cfg; this.kind = 'cloud'; }
  async available() { return { ok: !!(this.cfg.enabled && this.cfg.apiKey && this.cfg.model) }; }
  async listModels() { return this.cfg.model ? [{ id: this.cfg.model, cloud: true }] : []; }
  async chat({ messages, schema, temperature = 0.4, maxTokens = 4096 }) {
    if (!this.cfg.enabled) throw new Error('Cloud provider is disabled');
    if (this.cfg.provider === 'anthropic') {
      const sys = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
      const r = await http('https://api.anthropic.com/v1/messages', { model: this.cfg.model, max_tokens: maxTokens, temperature, system: sys + (schema ? '\n\nRespond with JSON only.' : ''), messages: messages.filter(m => m.role !== 'system') }, { headers: { 'x-api-key': this.cfg.apiKey, 'anthropic-version': '2023-06-01' } });
      return { text: (r.content || []).map(c => c.text || '').join(''), usage: r.usage || {} };
    }
    const r = await http((this.cfg.baseUrl || 'https://api.openai.com/v1') + '/chat/completions', { model: this.cfg.model, messages, temperature, max_tokens: maxTokens, response_format: schema ? { type: 'json_object' } : undefined }, { headers: { authorization: 'Bearer ' + this.cfg.apiKey } });
    return { text: r.choices[0].message.content, usage: r.usage || {} };
  }
}

function providersFrom(settings) {
  const P = settings.providers;
  const out = {};
  if (P.ollama && P.ollama.enabled) out.ollama = new OllamaProvider(P.ollama);
  if (P.openaiCompatible && P.openaiCompatible.enabled) out.openaiCompatible = new OpenAICompatProvider(P.openaiCompatible);
  if (P.cloud && P.cloud.enabled) out.cloud = new CloudProvider(P.cloud);
  return out;
}

module.exports = { OllamaProvider, OpenAICompatProvider, CloudProvider, providersFrom, http, logCall };
