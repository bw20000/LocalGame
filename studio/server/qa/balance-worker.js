/* Worker: one playthrough, isolated so many can run in parallel. */
'use strict';
const { parentPort, workerData } = require('worker_threads');
const bots = require('./bots.js');
try {
  const gdl = JSON.parse(workerData.gdl);
  const r = bots.playthrough(gdl, workerData.job);
  parentPort.postMessage(r);
} catch (e) {
  parentPort.postMessage({ strategy: workerData.job.strategy, seed: workerData.job.seed, error: String(e && e.stack || e) });
}
