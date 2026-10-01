/* Player-specific learning (spec §49). The studio notices what you keep asking for and stores it as
   editable, local, soft preferences — never hard rules. Preferences shape defaults (e.g. a repeated
   “too overwhelming” makes new games start with more delegation and fewer visible controls). */
'use strict';
const { loadPrefs, savePrefs } = require('./config');

const SIGNALS = [
  { id: 'overwhelming', re: /(overwhelm|too (much|many|complex|complicated|busy|cluttered)|confusing|simplif)/i, note: 'Prefers depth beneath the surface rather than many visible controls.' },
  { id: 'wantsCommissioner', re: /(commissioner|god ?mode|sandbox|edit (anything|everything))/i, note: 'Likes commissioner / sandbox editing.' },
  { id: 'wantsRealData', re: /(real (teams|companies|airlines|people|world|data)|realistic|real-world)/i, note: 'Likes real-world grounding (clearly separated from fiction).' },
  { id: 'wantsDepth', re: /(deep|depth|complex simulation|detailed|realistic economics)/i, note: 'Wants deep simulation.' },
  { id: 'wantsHistory', re: /(history|records|hall of fame|legacy|dynasty)/i, note: 'Values history and records.' },
  { id: 'wantsVisual', re: /(visual|polished|beautiful|graphic)/i, note: 'Cares about visual polish.' },
  { id: 'wantsDelegation', re: /(tedious|micromanag|automate|delegat|higher[- ]level)/i, note: 'Prefers strategic control over unit-by-unit micromanagement.' },
  { id: 'wantsChallenge', re: /(too easy|more challenge|harder)/i, note: 'Wants a real challenge in the late game.' }
];
function learn(text, kind = 'request') {
  const p = loadPrefs();
  const hits = [];
  for (const s of SIGNALS) if (s.re.test(String(text))) { p.signals[s.id] = (p.signals[s.id] || 0) + 1; hits.push(s.id); if (p.signals[s.id] >= 2 && !p.notes.includes(s.note)) p.notes.push(s.note); }
  p.history = (p.history || []).concat([{ t: new Date().toISOString(), kind, text: String(text).slice(0, 300), signals: hits }]).slice(-100);
  savePrefs(p);
  return { signals: hits, prefs: p };
}
/* Apply soft preferences to a compiled brief's settings (never overrides an explicit request). */
function applyToSettings(settings, prefs) {
  const s = Object.assign({}, settings), sig = (prefs && prefs.signals) || {};
  const applied = [];
  if (sig.overwhelming >= 2 && !s.overwhelmAverse) { s.overwhelmAverse = true; applied.push('Starts with more delegation and fewer visible controls (you have said “too overwhelming” before).'); }
  if (sig.wantsCommissioner >= 2 && s.commissioner == null) { s.commissioner = true; applied.push('Commissioner mode included (you usually ask for it).'); }
  if (sig.wantsHistory >= 2) applied.push('History and records emphasized.');
  if (sig.wantsDelegation >= 1) { s.delegateByDefault = true; applied.push('Routine unit-level work delegated by default.'); }
  return { settings: s, applied };
}
module.exports = { learn, applyToSettings, SIGNALS };
