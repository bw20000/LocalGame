/* Prompt Compiler: turns a brief of any length (one line or 30,000 words) into structured
   requirements: MUST / SHOULD / OPTIONAL / NEGATIVE, by area (simulation, visual, content,
   sandbox, ui, economy, meta), inferred settings, genre, and conflicts.
   Deterministic extraction always runs (fast, reliable); a local model refines it when available
   (long briefs are chunked map-reduce style). */
'use strict';
const fs = require('fs');
const path = require('path');
const { LIBRARY } = require('../config');

const fantasies = () => JSON.parse(fs.readFileSync(path.join(LIBRARY, 'fantasies.json'), 'utf8')).genres;

const AREA_WORDS = {
  visual: /\b(visual|look|looks|ui|interface|design|polished|beautiful|style|stylish|color|colour|font|theme|map|screen|aesthetic|animation|graphics|layout|dashboard|cards?|icons?)\b/i,
  sandbox: /\b(commissioner|sandbox|god mode|edit (?:any|the)|editor|cheats?|modding|custom (?:players|teams|companies))\b/i,
  content: /\b(events?|news|stories|story|dilemmas?|crises|crisis|flavor|narrative|personalit(?:y|ies)|rivalr(?:y|ies)|awards?|milestones?|history|records?|hall of fame|legacy)\b/i,
  economy: /\b(econom(?:y|ics)|finances?|budget|cash|debt|loans?|prices?|pricing|fares?|costs?|revenue|profit|recession|inflation|interest|valuation|stock|ipo|equity)\b/i,
  ui: /\b(onboarding|tutorial|overwhelming|cluttered|simple|easy to (?:use|understand)|navigation|menus?|clicks?|readable)\b/i
};
const NEG = /\b(no|not|never|don'?t|do not|avoid|without|hate|dislike|less|stop|remove|instead of)\b/i;
const MUST = /\b(must|need|needs|required|require|essential|critical|important|have to|has to|make sure|i want|i'd like|i would like|should have|include|including|with)\b/i;
const OPTIONAL = /\b(maybe|optional|could|nice to have|if possible|perhaps|bonus)\b/i;

function sentences(text) {
  return String(text).replace(/\r/g, '').split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(s => s.length > 2);
}
/* Break "with A, B, C and D" lists into individual features. */
function featureList(sentence) {
  const m = sentence.match(/\b(?:with|including|include|includes|featuring|such as|want|wants|like)\b\s+(.+)/i);
  if (!m) return [];
  return m[1].replace(/\.$/, '').split(/,|;|\band\b|\bplus\b/i).map(s => s.trim().replace(/^(a|an|the|some|lots of|deep|realistic|real)\s+/i, '')).filter(s => s && s.split(/\s+/).length <= 6 && !/^(it|this|that|them)$/i.test(s));
}
function classifyGenre(text) {
  const t = text.toLowerCase();
  const scores = fantasies().map(g => {
    let s = 0;
    for (const k of g.keywords) { const re = new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(s|es)?\\b', 'g'); const n = (t.match(re) || []).length; s += n * (k.includes(' ') ? 3 : 1.5); }
    if (t.includes(g.name.toLowerCase())) s += 6;
    return { id: g.id, name: g.name, score: s };
  }).sort((a, b) => b.score - a.score);
  const top = scores[0];
  return { genre: top && top.score > 0 ? top.id : null, confidence: top ? Math.min(1, top.score / 8) : 0, candidates: scores.slice(0, 3).filter(x => x.score > 0) };
}
function inferSettings(text) {
  const t = text.toLowerCase();
  const pick = (pairs, d) => { for (const [re, v] of pairs) if (re.test(t)) return v; return d; };
  return {
    depth: pick([[/\bextreme(ly)? deep|as deep as possible|insanely deep/, 'extreme'], [/\bvery deep|incredibly deep|super deep|deepest/, 'very-deep'], [/\bdeep\b|depth/, 'deep'], [/\bsimple|casual|accessible|light\b/, 'accessible']], 'deep'),
    realism: pick([[/simulation-heavy|hyper-?realistic|extremely realistic|incredibly realistic/, 'simulation-heavy'], [/\brealistic|realism|real-world/, 'high'], [/\bstylized|arcade|cartoon/, 'stylized']], 'balanced'),
    length: pick([[/open-?ended|endless|forever|decades|dynasty/, 'open-ended'], [/\blong\b|long-term|career/, 'long'], [/\bshort\b|quick/, 'short']], 'long'),
    visual: pick([[/very polished|highly visual|beautiful|stunning|very visual/, 'highly-visual'], [/polished|nice ui|clean/, 'polished']], 'polished'),
    universe: pick([[/real \+ fictional|real and fictional|mixed real|mix of real/, 'mixed'], [/real(?:-world)? (?:teams|companies|airlines|people|players|data|brands|schools)|actual (?:teams|companies)/, 'real-start'], [/fictional|made[- ]up|invented/, 'fictional']], 'realistic-fictional'),
    commissioner: !/no commissioner|without commissioner/.test(t),
    overwhelmAverse: /overwhelm|not overwhelming|cluttered|too many (?:screens|tables|numbers)|easy to understand/.test(t)
  };
}
function detectConflicts(reqs, settings, text) {
  const out = [];
  const t = text.toLowerCase();
  if (/\bsimple\b/.test(t) && /\b(very deep|extremely deep|extreme depth)\b/.test(t)) out.push({ severity: 'minor', text: 'Asked for both "simple" and "very deep".', resolution: 'Deep simulation behind a simple surface: progressive disclosure, delegation, ≤7 destinations.' });
  if (/\bfictional\b/.test(t) && /\breal (teams|companies|people|airlines)\b/.test(t)) out.push({ severity: 'minor', text: 'Mentions both fictional and real entities.', resolution: 'Mixed universe: real starting facts, everything after the start is fictional and labeled as such.' });
  if (/\bno (money|finances|economy)\b/.test(t) && reqs.some(r => r.area === 'economy' && r.kind === 'must')) out.push({ severity: 'major', text: 'Asks for no economy but also economic features.', resolution: 'Needs your decision.' });
  return out;
}
function compileDeterministic(prompt) {
  const text = String(prompt || '');
  const reqs = []; let n = 0;
  const add = (o) => { const key = o.text.toLowerCase(); if (reqs.some(r => r.text.toLowerCase() === key)) return; reqs.push(Object.assign({ id: 'R' + (++n), source: 'prompt' }, o)); };
  for (const s of sentences(text)) {
    const area = Object.entries(AREA_WORDS).find(([, re]) => re.test(s));
    const kind = NEG.test(s) && !/\bnot overwhelming|without being overwhelming|but not overwhelming/i.test(s) ? 'negative' : OPTIONAL.test(s) ? 'optional' : MUST.test(s) ? 'must' : 'should';
    const feats = featureList(s);
    if (feats.length >= 2 && kind !== 'negative') {
      for (const f of feats) add({ text: f, kind: kind === 'optional' ? 'optional' : 'must', area: classifyFeatureArea(f), feature: true, quote: s.slice(0, 200) });
    } else if (s.length < 400) {
      add({ text: s.replace(/\s+/g, ' '), kind, area: area ? area[0] : 'simulation', quote: s.slice(0, 200) });
    }
  }
  const settings = inferSettings(text);
  if (settings.overwhelmAverse) add({ text: 'Deep but not overwhelming: progressive disclosure, task-based navigation', kind: 'must', area: 'ui', source: 'inferred' });
  if (settings.commissioner) add({ text: 'Commissioner mode that edits the real simulation', kind: 'should', area: 'sandbox', source: 'standard' });
  add({ text: 'Robust saves: autosave, slots, export/import', kind: 'should', area: 'meta', source: 'standard' });
  const genre = classifyGenre(text);
  return { requirements: reqs, settings, genre, conflicts: detectConflicts(reqs, settings, text), stats: { chars: text.length, words: text.split(/\s+/).filter(Boolean).length, sentences: sentences(text).length } };
}
function classifyFeatureArea(f) {
  for (const [a, re] of Object.entries(AREA_WORDS)) if (re.test(f)) return a;
  return 'simulation';
}

/* LLM refinement: chunked map-reduce for long briefs. */
const REQ_SCHEMA = {
  type: 'object', required: ['requirements'],
  properties: {
    requirements: { type: 'array', items: { type: 'object', required: ['text', 'kind', 'area'], properties: { text: { type: 'string' }, kind: { type: 'string', enum: ['must', 'should', 'optional', 'negative'] }, area: { type: 'string', enum: ['simulation', 'visual', 'content', 'sandbox', 'ui', 'economy', 'meta'] } } } },
    conflicts: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, resolution: { type: 'string' }, severity: { type: 'string', enum: ['minor', 'major'] } } } }
  }
};
async function compileWithLLM(prompt, llm, log) {
  const det = compileDeterministic(prompt);
  const chunks = [];
  const paras = String(prompt).split(/\n\s*\n/);
  let cur = '';
  for (const p of paras) { if ((cur + '\n\n' + p).length > 6000 && cur) { chunks.push(cur); cur = p; } else cur = cur ? cur + '\n\n' + p : p; }
  if (cur) chunks.push(cur);
  const merged = [];
  const conflicts = det.conflicts.slice();
  for (let i = 0; i < chunks.length; i++) {
    log && log(`Prompt compiler: reading part ${i + 1} of ${chunks.length}`);
    const r = await llm.json({ role: 'fast', label: `compile ${i + 1}/${chunks.length}`, schema: REQ_SCHEMA, maxTokens: 3000, onLog: log,
      system: 'You extract requirements from game design briefs for a management/tycoon simulation game generator. Be faithful to the text: do not invent requirements. Split lists into separate items. kind: must (explicitly wanted), should (implied/important), optional (nice to have), negative (things the author does NOT want). area: simulation, visual, content, sandbox, ui, economy or meta. Report contradictions in conflicts.',
      prompt: `Brief (part ${i + 1}/${chunks.length}):\n"""\n${chunks[i]}\n"""\nReturn JSON {"requirements":[{"text","kind","area"}], "conflicts":[{"text","resolution","severity"}]}.` });
    for (const q of r.requirements || []) merged.push(Object.assign({ source: 'llm' }, q));
    for (const c of r.conflicts || []) conflicts.push(c);
  }
  // merge: keep LLM items, add deterministic items not covered (word-overlap test)
  const words = (s) => new Set(String(s).toLowerCase().match(/[a-z]{4,}/g) || []);
  const covered = (t) => merged.some(m => { const a = words(m.text), b = words(t); let k = 0; for (const w of b) if (a.has(w)) k++; return b.size && k / b.size >= 0.6; });
  for (const d of det.requirements) if (!covered(d.text)) merged.push(d);
  merged.forEach((r, i) => { r.id = 'R' + (i + 1); });
  return Object.assign({}, det, { requirements: merged, conflicts, refinedBy: 'llm' });
}

module.exports = { compileDeterministic, compileWithLLM, classifyGenre, inferSettings, sentences, featureList };
