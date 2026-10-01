/* Browser QA: opens the standalone game in a real (headless) browser and plays through the UI the
   way a person would — title → new game → intro → every destination and tab → open every primary
   action dialog → advance time and answer interrupts → save → reload → load → commissioner →
   narrow (phone/tablet) layout. Captures console errors, screenshots and DOM metrics that feed the
   UX critic. Uses Playwright when installed (any of: local node_modules, a global install, the
   system Chrome via playwright-core). If no browser automation is available the stage is reported
   as skipped — never silently passed. */
'use strict';
const fs = require('fs');
const path = require('path');

function findPlaywright() {
  const tries = ['playwright', 'playwright-core', '/opt/node22/lib/node_modules/playwright', path.join(__dirname, '..', '..', '..', 'studio-data', 'tools', 'node_modules', 'playwright-core')];
  for (const t of tries) { try { return require(t); } catch (e) { /* next */ } }
  return null;
}
async function launch(pw) {
  const opts = [{}, { channel: 'chrome' }, { channel: 'msedge' }];
  if (process.env.LGS_CHROME) opts.unshift({ executablePath: process.env.LGS_CHROME });
  if (fs.existsSync('/opt/pw-browsers/chromium')) opts.push({ executablePath: '/opt/pw-browsers/chromium' });
  let lastErr = null;
  for (const o of opts) { try { return await pw.chromium.launch(Object.assign({ headless: true }, o)); } catch (e) { lastErr = e; } }
  throw lastErr || new Error('No browser');
}
function available() { return !!findPlaywright(); }

async function run(htmlFile, { outDir, quick = false, onLog } = {}) {
  const log = (m) => onLog && onLog(m);
  const pw = findPlaywright();
  if (!pw) return { skipped: true, reason: 'Browser automation (Playwright) is not installed. Run the setup script with --with-browser-tests, or install Playwright. Simulation tests still ran.' };
  let browser;
  try { browser = await launch(pw); } catch (e) { return { skipped: true, reason: 'Could not start a headless browser: ' + e.message.split('\n')[0] }; }
  fs.mkdirSync(outDir, { recursive: true });
  const report = { steps: [], errors: [], screenshots: [], metrics: {}, layout: {}, ok: true };
  const step = (name, ok, note) => { report.steps.push({ name, ok, note: note || '' }); if (!ok) report.ok = false; log(`${ok ? '✓' : '✗'} ${name}${note ? ' — ' + note : ''}`); };
  const shot = async (page, name) => { const f = path.join(outDir, name + '.png'); try { await page.screenshot({ path: f }); report.screenshots.push(path.basename(f)); } catch (e) { /* ignore */ } };
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => report.errors.push({ kind: 'pageerror', text: e.message }));
    page.on('console', m => { if (m.type() === 'error') report.errors.push({ kind: 'console', text: m.text() }); });
    page.on('dialog', d => d.accept(d.type() === 'prompt' ? 'QA save' : undefined));
    const t0 = Date.now();
    await page.goto('file://' + htmlFile);
    await page.waitForSelector('[data-a="startNew"], [data-a="setup"], .title', { timeout: 15000 });
    report.metrics.loadMs = Date.now() - t0;
    step('Title screen loads', true, `${report.metrics.loadMs} ms`);
    await shot(page, '01-title');
    // new game
    const setupBtn = await page.$('[data-a="setup"]');
    if (setupBtn) { await setupBtn.click(); await page.waitForTimeout(200); await shot(page, '02-setup'); }
    const t1 = Date.now();
    await page.click('[data-a="startNew"]');
    await page.waitForFunction(() => window.__app && window.__app.game, null, { timeout: 60000 });
    report.metrics.newGameMs = Date.now() - t1;
    step('New game starts', true, `${report.metrics.newGameMs} ms`);
    await page.waitForTimeout(300);
    await shot(page, '03-intro');
    const intro = await page.$('[data-a="introStart"]'); if (intro) await intro.click();
    await page.waitForTimeout(250);
    await shot(page, '04-home');
    // every destination + tab
    const navs = await page.$$eval('[data-a^="nav:"]', els => Array.from(new Set(els.map(e => e.getAttribute('data-a')))));
    report.metrics.destinations = navs.filter(n => !/history|saves|commissioner/.test(n)).length;
    const perScreen = {};
    for (const n of navs) {
      const sid = n.slice(4);
      await page.click(`[data-a="${n}"]`).catch(() => {}); await page.waitForTimeout(220);
      const tabs = await page.$$eval('.tabs [data-a^="tab:"]', els => els.map(e => e.getAttribute('data-a')));
      const visit = async (label) => {
        const m = await page.evaluate(() => {
          const root = document.querySelector('.screen') || document.body;
          const text = (root.innerText || '').trim();
          const panels = root.querySelectorAll('.sec').length;
          const broken = Array.from(root.querySelectorAll('.sec .empty')).map(e => e.textContent).filter(t => /could not be drawn|Unknown section/.test(t));
          const visuals = root.querySelectorAll('svg.chart, svg.donut, .map svg, .showcase, .hist, .glyph, .spark').length;
          const numbers = (text.match(/[$€£]?\d[\d,.]*\s?[%kKMB]?/g) || []).length;
          return { panels, words: text.split(/\s+/).length, numbers, buttons: root.querySelectorAll('button').length, visuals, broken, overflowX: document.documentElement.scrollWidth > window.innerWidth + 2 };
        });
        perScreen[label] = m;
        if (m.broken.length) step(`Screen ${label} renders`, false, m.broken.join('; '));
      };
      if (tabs.length) { for (const t of tabs) { await page.click(`.tabs [data-a="${t}"]`).catch(() => {}); await page.waitForTimeout(150); await visit(`${sid}/${t.slice(4)}`); await shot(page, `10-${sid}-${t.slice(4)}`); } }
      else { await visit(sid); await shot(page, `10-${sid}`); }
    }
    report.metrics.screens = perScreen;
    step('All destinations render', !Object.values(perScreen).some(m => m.broken.length), `${Object.keys(perScreen).length} screens/tabs`);
    // action dialogs: open each visible primary action, check it renders a forecast/preview, cancel
    if (!quick) {
      await page.click('[data-a="nav:home"]').catch(() => {});
      let opened = 0, failed = [];
      for (const n of navs.filter(x => !/history|saves|commissioner/.test(x))) {
        await page.click(`[data-a="${n}"]`).catch(() => {}); await page.waitForTimeout(150);
        const acts = await page.$$eval('.screen-actions [data-a^="act:"]', els => els.map(e => e.getAttribute('data-a')));
        for (const a of acts) {
          await page.click(`.screen-actions [data-a="${a}"]`).catch(() => {}); await page.waitForTimeout(250);
          const ok = await page.$('.modal [data-a="dlgGo"]');
          if (!ok) failed.push(a); else { opened++; if (opened <= 3) await shot(page, `20-dialog-${a.slice(4)}`); }
          await page.click('.modal [data-a="closeModal"]').catch(() => {}); await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(80);
        }
      }
      step('Action dialogs open', failed.length === 0, `${opened} opened${failed.length ? ', failed: ' + failed.join(', ') : ''}`);
    }
    // perform the first enabled primary action for real
    await page.click('[data-a="nav:home"]').catch(() => {});
    const acted = await page.evaluate(() => { const app = window.__app; const g = app.game; const P = g.playerOrg(); for (const a of Object.values(g.def.actions)) { if (a.scope === 'entity' || a.kind || a.aiOnly) continue; if (!g.actionVisible(a, P, null)) continue; const pv = g.previewAction(a, P, null, g.defaultParams(a, P, null)); if (pv && pv.ok) return a.id; } return null; });
    if (acted) {
      const navOf = await page.evaluate((id) => { const sc = window.__app.gdl.ui && window.__app.gdl.ui.screens || {}; for (const [k, v] of Object.entries(sc)) if ((v.actions || []).includes(id)) return k; return null; }, acted);
      if (navOf) { await page.click(`[data-a="nav:${navOf}"]`).catch(() => {}); await page.waitForTimeout(150); }
      await page.click(`.screen-actions [data-a="act:${acted}"]`).catch(() => {}); await page.waitForTimeout(250);
      const before = await page.evaluate(() => window.__app.game.state.stats ? JSON.stringify(window.__app.game.state.stats.actions || {}) : '');
      await page.click('.modal [data-a="dlgGo"]').catch(() => {}); await page.waitForTimeout(250);
      const after = await page.evaluate(() => window.__app.game.state.stats ? JSON.stringify(window.__app.game.state.stats.actions || {}) : '');
      step(`Take an action through the UI (${acted})`, before !== after || after === '', '');
    }
    // advance time, answering interrupts like a player
    const ticks0 = await page.evaluate(() => window.__app.game.state.tick);
    const tAdv = Date.now();
    for (let i = 0; i < (quick ? 8 : 26); i++) {
      await page.keyboard.press('Space'); await page.waitForTimeout(120);
      for (let k = 0; k < 4; k++) {
        const btn = await page.$('.modal .ev-choice:not([disabled]), .modal [data-a="closeMoment"], .modal [data-a="rescueGo"], .modal [data-a="gateGo"], .modal [data-a="closeModal"]');
        if (!btn) break; await btn.click().catch(() => {}); await page.waitForTimeout(80);
      }
    }
    const ticks1 = await page.evaluate(() => window.__app.game.state.tick);
    report.metrics.msPerTurnUI = Math.round((Date.now() - tAdv) / Math.max(1, ticks1 - ticks0));
    step('Time advances through the UI', ticks1 > ticks0, `${ticks1 - ticks0} turns, ~${report.metrics.msPerTurnUI} ms per turn incl. rendering`);
    await page.click('[data-a="nav:home"]').catch(() => {}); await page.waitForTimeout(150);
    await shot(page, '30-home-later');
    // saves
    await page.click('[data-a="nav:saves"]').catch(() => {}); await page.waitForTimeout(200);
    const saveBtn = await page.$('[data-a="saveNow"]');
    if (saveBtn) { await saveBtn.click(); await page.waitForTimeout(600); }
    const slots = await page.$$('[data-a^="loadslot:"]');
    step('Save from the UI', slots.length > 0, `${slots.length} slot(s)`);
    await shot(page, '40-saves');
    const tickBefore = await page.evaluate(() => window.__app.game.state.tick);
    await page.reload(); await page.waitForTimeout(800);
    const cont = await page.$('[data-a^="loadslot:"]');
    if (cont) { await cont.click(); await page.waitForFunction(() => window.__app && window.__app.game, null, { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(400); }
    const tickAfter = await page.evaluate(() => window.__app && window.__app.game ? window.__app.game.state.tick : -1);
    step('Reload and continue a save', tickAfter === tickBefore, `turn ${tickBefore} → ${tickAfter}`);
    // commissioner
    const hasCm = await page.$('[data-a="nav:commissioner"]');
    if (hasCm) { await hasCm.click(); await page.waitForTimeout(250); const ok = await page.$('.screen-commissioner, [data-a^="cmKind"], [data-a^="cmOrg"]'); step('Commissioner opens', !!ok); await shot(page, '50-commissioner'); }
    // layout at narrow widths
    for (const [w, h, name] of [[1024, 768, 'tablet'], [390, 844, 'phone']]) {
      await page.setViewportSize({ width: w, height: h }); await page.click('[data-a="nav:home"]').catch(() => {}); await page.waitForTimeout(250);
      const lay = await page.evaluate(() => ({ overflowX: document.documentElement.scrollWidth > window.innerWidth + 2, scrollW: document.documentElement.scrollWidth }));
      report.layout[name] = lay;
      await shot(page, `60-${name}`);
      step(`Layout fits a ${name} screen`, !lay.overflowX, lay.overflowX ? `page is ${lay.scrollW}px wide` : '');
    }
    const diag = await page.evaluate(() => window.__app && window.__app.game ? window.__app.game.diag.errors.slice(0, 10) : []);
    for (const d of diag) report.errors.push({ kind: 'engine', text: `${d.where}: ${d.msg}` });
    const realErrors = report.errors.filter(e => !/favicon|ERR_FILE_NOT_FOUND/.test(e.text));
    step('No script errors', realErrors.length === 0, realErrors.slice(0, 3).map(e => e.text).join(' | '));
    report.errors = realErrors;
  } catch (e) {
    step('Browser run', false, e.message.split('\n')[0]);
  } finally { await browser.close().catch(() => {}); }
  report.passed = report.steps.filter(s => s.ok).length; report.failed = report.steps.filter(s => !s.ok).length;
  return report;
}
module.exports = { run, available, findPlaywright };
