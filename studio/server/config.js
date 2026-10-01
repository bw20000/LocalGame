/* Local Game Studio — configuration and local data paths. Nothing leaves this machine unless the
   user explicitly enables a cloud provider in settings. */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA = process.env.LGS_DATA || path.join(ROOT, 'studio-data');
const PROJECTS = process.env.LGS_PROJECTS || path.join(ROOT, 'projects');
const LIBRARY = path.join(ROOT, 'library');
const ENGINE = path.join(ROOT, 'engine');

const DEFAULT_SETTINGS = {
  version: 1,
  port: 4317,
  host: '127.0.0.1',
  providers: {
    ollama: { enabled: true, baseUrl: 'http://127.0.0.1:11434' },
    openaiCompatible: { enabled: false, baseUrl: 'http://127.0.0.1:1234/v1', apiKey: '', label: 'LM Studio / mlx-lm / llama.cpp server' },
    cloud: { enabled: false, provider: 'none', apiKey: '', model: '', note: 'Optional. Disabled by default. Only used when you explicitly pick it for a build.' }
  },
  roles: { fast: '', main: '', critic: '' },
  context: { main: 16384, fast: 8192 },
  generation: { temperature: 0.4, maxRepairs: 2, criticRounds: 2, balanceRuns: 12, balanceYears: 6, browserTests: true },
  telemetry: false
};

function ensureDirs() {
  for (const d of [DATA, PROJECTS, path.join(DATA, 'logs'), path.join(DATA, 'cache')]) fs.mkdirSync(d, { recursive: true });
}
function deepMerge(a, b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return b === undefined ? a : b;
  const out = Object.assign({}, a);
  for (const [k, v] of Object.entries(b)) out[k] = a && typeof a[k] === 'object' && !Array.isArray(a[k]) ? deepMerge(a[k], v) : v;
  return out;
}
function settingsPath() { return path.join(DATA, 'settings.json'); }
function loadSettings() {
  ensureDirs();
  let s = {};
  try { s = JSON.parse(fs.readFileSync(settingsPath(), 'utf8')); } catch (e) { /* first run */ }
  return deepMerge(DEFAULT_SETTINGS, s);
}
function saveSettings(s) {
  ensureDirs();
  fs.writeFileSync(settingsPath(), JSON.stringify(s, null, 2));
  return s;
}
function prefsPath() { return path.join(DATA, 'preferences.json'); }
const DEFAULT_PREFS = {
  about: 'Your personal design preferences. The studio learns these from your requests and you can edit them freely. They are hints, never hard rules.',
  likes: [], dislikes: [], notes: [],
  signals: { overwhelming: 0, wantsCommissioner: 0, wantsRealData: 0, wantsDepth: 0, wantsHistory: 0 }
};
function loadPrefs() { try { return deepMerge(DEFAULT_PREFS, JSON.parse(fs.readFileSync(prefsPath(), 'utf8'))); } catch (e) { return JSON.parse(JSON.stringify(DEFAULT_PREFS)); } }
function savePrefs(p) { ensureDirs(); fs.writeFileSync(prefsPath(), JSON.stringify(p, null, 2)); return p; }

module.exports = { ROOT, DATA, PROJECTS, LIBRARY, ENGINE, loadSettings, saveSettings, loadPrefs, savePrefs, ensureDirs, deepMerge, hostname: os.hostname() };
