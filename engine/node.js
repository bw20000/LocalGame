/* Load the engine into Node (tests, playtest bots, Balance Lab). Returns the LGE namespace.
   Only the simulation layer is loaded; the UI layer needs a browser. */
'use strict';
const path = require('path');
const fs = require('fs');
function loadEngine(dir) {
  dir = dir || __dirname;
  const man = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  for (const f of man.sim) require(path.join(dir, f));
  return globalThis.LGE;
}
/* Load an isolated engine instance (fresh namespace) — used when two engine versions must coexist. */
function loadIsolated(dir) {
  const vm = require('vm');
  dir = dir || __dirname;
  const man = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const ctx = vm.createContext({ console, Math, JSON, Date, setTimeout, clearTimeout });
  ctx.globalThis = ctx;
  for (const f of man.sim) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
  return ctx.LGE;
}
module.exports = { loadEngine, loadIsolated };
