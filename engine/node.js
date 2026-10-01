/* Load the engine into Node (tests, playtest bots, Balance Lab). Returns the LGE namespace. */
'use strict';
const path = require('path');
const fs = require('fs');
function loadEngine(dir) {
  dir = dir || __dirname;
  const man = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  for (const f of man.sim) require(path.join(dir, f));
  return globalThis.LGE;
}
module.exports = { loadEngine };
