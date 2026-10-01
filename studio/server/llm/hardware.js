/* Hardware detection + honest memory-fit estimates for local models.
   macOS lets the GPU wire roughly 2/3 of unified memory on ≤36 GB machines (3/4 above) unless
   iogpu.wired_limit_mb is raised. We read the real numbers where possible. */
'use strict';
const os = require('os');
const { execFileSync } = require('child_process');

function sysctl(name) {
  try { return execFileSync('sysctl', ['-n', name], { encoding: 'utf8', timeout: 2000 }).trim(); } catch (e) { return null; }
}
function detect() {
  const totalGB = os.totalmem() / 1024 ** 3;
  const info = { platform: process.platform, arch: process.arch, cpus: os.cpus().length, cpuModel: (os.cpus()[0] || {}).model || 'unknown', totalGB: +totalGB.toFixed(1), appleSilicon: false, gpuBudgetGB: null, notes: [] };
  if (process.platform === 'darwin') {
    const brand = sysctl('machdep.cpu.brand_string');
    if (brand) info.cpuModel = brand;
    info.appleSilicon = process.arch === 'arm64';
    const wired = +sysctl('iogpu.wired_limit_mb') || 0;
    if (wired > 0) { info.gpuBudgetGB = +(wired / 1024).toFixed(1); info.notes.push(`GPU wired limit set to ${info.gpuBudgetGB} GB (iogpu.wired_limit_mb).`); }
    else { info.gpuBudgetGB = +(totalGB * (totalGB <= 36 ? 0.667 : 0.75)).toFixed(1); info.notes.push(`Default macOS GPU memory budget ≈ ${info.gpuBudgetGB} GB of ${info.totalGB} GB unified memory.`); }
  } else {
    info.gpuBudgetGB = +(totalGB * 0.7).toFixed(1);
    info.notes.push('Not running on macOS: estimates assume CPU/GPU share ~70% of system RAM.');
  }
  return info;
}
/* KV cache estimate: GB ≈ 2 (K,V) × layers × kvHeads × headDim × ctx × bytes. Without metadata we use a
   conservative per-1k-token figure scaled by model size class. */
function kvCacheGB(paramsB, ctx) {
  const perK = paramsB <= 9 ? 0.07 : paramsB <= 15 ? 0.12 : paramsB <= 24 ? 0.10 : 0.16; // GQA models are lean
  return perK * ctx / 1024;
}
function fit(model, ctx, hw) {
  const size = model.sizeGB || 0;
  const params = model.paramsB || size * 1.8;
  const need = size + kvCacheGB(params, ctx) + 0.8; // + runtime overhead
  const budget = hw.gpuBudgetGB || hw.totalGB * 0.6;
  const ratio = need / budget;
  return { needGB: +need.toFixed(1), budgetGB: budget, verdict: ratio <= 0.85 ? 'fits' : ratio <= 1.0 ? 'tight' : 'too-big', ratio: +ratio.toFixed(2) };
}
module.exports = { detect, fit, kvCacheGB };
