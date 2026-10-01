/* Local Game Studio engine — Saves & Settings screen and Commissioner mode.
   Commissioner edits the REAL state: entities, companies, world variables, cycle phase, shocks,
   events, rules (params), time. The simulation continues logically from the edited state. */
(function (E) {
  'use strict';
  const U = E.util, D = E.dom, esc = U.esc, S = E.ui.sections;

  /* ---------------- saves & settings ---------------- */
  E.ui.savesScreen = (app) => {
    if (!app.ui.saveList) { app.store.list().then(l => { app.ui.saveList = l; app.rerender(); }).catch(() => { app.ui.saveList = []; }); }
    const list = app.ui.saveList || [];
    const g = app.game, st = g.state, ap = st.settings.autopause;
    const rows = list.map(s => `<tr><td><b>${esc(s.name)}</b>${s.auto ? ' <span class="chip">auto</span>' : ''}<br><small class="muted">${esc(s.meta ? `${s.meta.company} · ${s.meta.date}` : '')}</small></td><td class="r">${esc(s.meta ? U.money(s.meta.cash) : '')}</td><td>${esc(new Date(s.updated).toLocaleString())}</td>
      <td class="row-acts"><button class="btn xs" data-a="loadslot:${esc(s.slot)}" title="Load">${D.icon('upload')}</button><button class="btn xs ghost" data-a="saveRename:${esc(s.slot)}" title="Rename">${D.icon('edit')}</button><button class="btn xs ghost" data-a="saveDup:${esc(s.slot)}" title="Duplicate">${D.icon('copy')}</button><button class="btn xs ghost" data-a="saveExportSlot:${esc(s.slot)}" title="Export">${D.icon('download')}</button><button class="btn xs ghost danger" data-a="saveDel:${esc(s.slot)}" title="Delete">${D.icon('trash')}</button></td></tr>`).join('');
    const tog = (k, label) => `<label class="check"><input type="checkbox" data-change="autopause:${k}" ${ap[k] ? 'checked' : ''}> ${esc(label)}</label>`;
    return `<div class="screen"><div class="screen-head"><div><h1>Saves & settings</h1><p class="sub">Storage: ${esc(app.store.mode || '…')}${app.store.mode === 'mem' ? ' — this browser blocks storage; export your save to keep it' : ''}</p></div>
      <div class="screen-actions"><button class="btn primary" data-a="saveNow">${D.icon('save')} Save game</button><button class="btn" data-a="saveExport">${D.icon('download')} Export to file</button><label class="btn">${D.icon('upload')} Import file<input type="file" accept=".gz,.json" data-change="importGame" hidden></label></div></div>
      <div class="grid">
        <section class="sec w-full"><div class="sec-head"><h3>Saved games</h3></div><div class="sec-body">${rows ? `<div class="table-wrap"><table class="tbl"><tr><th>Name</th><th class="r">Cash</th><th>Saved</th><th></th></tr>${rows}</table></div>` : '<div class="empty">No saves yet.</div>'}</div></section>
        <section class="sec w-half"><div class="sec-head"><h3>Pause automatically for…</h3></div><div class="sec-body">${tog('critical', 'Critical decisions (recommended)')}${tog('important', 'Important decisions')}${tog('moments', 'Milestones, crises and the annual review')}
          <label class="field"><span>Autosave every</span><div class="seg">${[0, 1, 4, 13].map(n => `<button class="${(app.prefs.autosaveEvery ?? Math.round(g.cal.ticksPerMonth)) === n ? 'on' : ''}" data-a="autosaveEvery:${n}">${n === 0 ? 'Off' : U.plural(n, g.cal.unitLabel)}</button>`).join('')}</div></label></div></section>
        <section class="sec w-half"><div class="sec-head"><h3>Display & access</h3></div><div class="sec-body">
          <label class="field"><span>Theme</span><div class="seg"><button class="${!app.prefs.mode ? 'on' : ''}" data-a="prefMode:">Game default</button><button class="${app.prefs.mode === 'light' ? 'on' : ''}" data-a="prefMode:light">Light</button><button class="${app.prefs.mode === 'dark' ? 'on' : ''}" data-a="prefMode:dark">Dark</button></div></label>
          <label class="field"><span>Text size</span><div class="seg"><button class="${app.prefs.textSize !== 'large' ? 'on' : ''}" data-a="prefText:normal">Normal</button><button class="${app.prefs.textSize === 'large' ? 'on' : ''}" data-a="prefText:large">Large</button></div></label>
          <label class="field"><span>Density</span><div class="seg"><button class="${app.prefs.density !== 'compact' ? 'on' : ''}" data-a="prefDensity:comfortable">Comfortable</button><button class="${app.prefs.density === 'compact' ? 'on' : ''}" data-a="prefDensity:compact">Compact</button></div></label>
          <label class="check"><input type="checkbox" data-change="prefCommish" ${app.prefs.commissioner ? 'checked' : ''}> Commissioner mode (edit the world — marks this save as sandbox)</label>
          <div class="dlg-f"><button class="btn ghost" data-a="title">Quit to title</button></div></div></section>
      </div></div>`;
  };
  const H = E.ui.handlers, C = E.ui.changeHandlers;
  H.saveNow = async (app) => { const name = prompt('Name this save', `${app.game.playerOrg().name} — ${app.game.cal.label(app.game.state.tick)}`); if (name == null) return; await E.persist.save(app.store, app.game, app.slot + '-' + Date.now().toString(36), name); app.ui.saveList = null; app.toast('Saved', 'good'); app.rerender(); };
  H.saveExport = async (app) => { const { blob, ext } = await E.persist.exportBlob(app.game, app.game.playerOrg().name); E.persist.download(blob, U.slug(app.def.meta.title) + '-' + U.slug(app.game.cal.label(app.game.state.tick)) + ext); };
  H.saveExportSlot = async (app, rest) => { const g = await E.persist.load(app.store, app.gdl, rest[0], {}); const { blob, ext } = await E.persist.exportBlob(g, g.playerOrg().name); E.persist.download(blob, U.slug(app.def.meta.title) + '-' + rest[0] + ext); };
  H.saveRename = async (app, rest) => { const rec = await app.store.get(rest[0]); const name = prompt('New name', rec.name); if (!name) return; rec.name = name; await app.store.put(rec); app.ui.saveList = null; app.rerender(); };
  H.saveDup = async (app, rest) => { const rec = await app.store.get(rest[0]); rec.slot = rest[0] + '-copy-' + Date.now().toString(36); rec.name = rec.name + ' (copy)'; rec.auto = false; await app.store.put(rec); app.ui.saveList = null; app.rerender(); };
  H.saveDel = async (app, rest) => { if (!confirm('Delete this save permanently?')) return; await app.store.del(rest[0]); app.ui.saveList = null; app.rerender(); };
  H.autosaveEvery = (app, rest) => { app.prefs.autosaveEvery = +rest[0]; app.savePrefs(); app.rerender(); };
  H.prefMode = (app, rest) => { app.prefs.mode = rest[0] || undefined; app.savePrefs(); E.ui.applyTheme(app.gdl.theme || {}, app.prefs); app.rerender(); };
  H.prefText = (app, rest) => { app.prefs.textSize = rest[0]; app.savePrefs(); E.ui.applyTheme(app.gdl.theme || {}, app.prefs); app.rerender(); };
  H.prefDensity = (app, rest) => { app.prefs.density = rest[0]; app.savePrefs(); app.rerender(); };
  C.autopause = (app, rest, el) => { app.game.state.settings.autopause[rest[0]] = el.checked; };
  C.prefCommish = (app, rest, el) => { app.prefs.commissioner = el.checked; if (el.checked) app.game.state.flags.sandbox = true; app.savePrefs(); app.rerender(); };
  C.importGame = async (app, rest, el) => { try { const obj = await E.persist.importFile(el.files[0]); const slot = 'import-' + Date.now().toString(36); await app.store.put({ slot, name: obj.name || 'Imported game', meta: obj.meta, data: obj.data }); app.ui.saveList = null; await app.loadSlot(slot); } catch (e) { alert('Import failed: ' + e.message); } };

  /* ---------------- commissioner ---------------- */
  E.ui.commissionerScreen = (app) => {
    const tabs = [['world', 'World'], ['companies', 'Companies'], ['entities', 'Everything else'], ['events', 'Events'], ['rules', 'Rules'], ['time', 'Time']];
    const cur = app.route.tab || 'world';
    const body = ({ world: cWorld, companies: cCompanies, entities: cEntities, events: cEvents, rules: cRules, time: cTime })[cur](app);
    return `<div class="screen screen-commish"><div class="screen-head"><div><h1>${D.icon('gavel')} Commissioner</h1><p class="sub">Every change here alters the real simulation. The world carries on from whatever you create.</p></div></div>
      <div class="tabs">${tabs.map(([id, l]) => `<button class="tab ${cur === id ? 'on' : ''}" data-a="tab:${id}">${l}</button>`).join('')}</div><div class="grid">${body}</div></div>`;
  };
  function sec(title, inner, w = 'w-full') { return `<section class="sec ${w}"><div class="sec-head"><h3>${esc(title)}</h3></div><div class="sec-body">${inner}</div></section>`; }
  function cWorld(app) {
    const g = app.game, w = g.state.world, def = app.def;
    const phases = (def.world.cycle && def.world.cycle.phases) || [];
    const ph = phases.length ? `<div class="seg">${phases.map(p => `<button class="${w.phase === p.id ? 'on' : ''}" data-a="cmPhase:${esc(p.id)}">${esc(p.label || p.id)}</button>`).join('')}</div><p class="hint">Forcing a phase starts it next ${esc(g.cal.unitLabel)}; the cycle continues naturally afterwards.</p>` : '<p class="muted">This game has no economic cycle.</p>';
    const vars = def.world.vars.map(v => `<tr><td>${esc(v.label || v.id)}</td><td><input type="number" step="any" value="${+w.vars[v.id]}" data-change="cmVar:${esc(v.id)}"></td><td>${(v.shocks || []).map(sh => `<button class="btn xs" data-a="cmShock:${esc(v.id)}:${esc(sh.id)}">${esc(sh.label || sh.id)}</button>`).join(' ')}</td></tr>`).join('');
    return sec('Economic cycle', ph, 'w-half') + sec('World variables', `<table class="tbl">${vars}</table>`, 'w-half');
  }
  function cCompanies(app) {
    const g = app.game;
    const rows = Object.values(g.state.orgs).filter(o => o.level < 3 || app.ui.cmShowBg).map(o => `<tr class="${o.isPlayer ? 'mine' : ''}"><td><button class="link" data-a="cmOrg:${esc(o.id)}">${esc(o.name)}</button>${o.alive ? '' : ' <span class="chip">defunct</span>'}</td><td>${esc((g.archetypeOf(o) || {}).label || (o.isPlayer ? 'You' : ''))}</td><td class="r">${esc(U.money(o.cash))}</td><td class="r">${esc(U.money(o.m.value))}</td></tr>`).join('');
    const sel = app.ui.cmOrg ? g.state.orgs[app.ui.cmOrg] : null;
    let ed = '';
    if (sel) {
      const fields = Object.entries(app.def.orgFields).filter(([, fd]) => !['refs', 'list'].includes(fd.type)).map(([f, fd]) => `<label class="field"><span>${esc(fd.label)}</span><input type="${fd.type === 'text' ? 'text' : 'number'}" step="any" value="${esc(sel[f] ?? '')}" data-change="cmOrgField:${esc(sel.id)}:${esc(f)}"></label>`).join('');
      const res = Object.values(app.def.resources).map(r => `<label class="field"><span>${esc(r.label)}</span><input type="number" step="any" value="${+sel.res[r.id]}" data-change="cmOrgRes:${esc(sel.id)}:${esc(r.id)}"></label>`).join('');
      const arch = ((app.def.orgs.rivals || {}).archetypes || []);
      const others = g.liveOrgs().filter(o => o !== sel && o.level < 3);
      ed = sec(`Edit: ${sel.name}`, `<label class="field"><span>Name</span><input type="text" value="${esc(sel.name)}" data-change="cmOrgName:${esc(sel.id)}"></label><label class="field"><span>Cash</span><input type="number" step="any" value="${Math.round(sel.cash)}" data-change="cmOrgCash:${esc(sel.id)}"></label>${res}${fields}
        ${!sel.isPlayer && arch.length ? `<label class="field"><span>Strategy</span><select data-change="cmOrgArch:${esc(sel.id)}">${arch.map(a => `<option value="${esc(a.id)}" ${a.id === sel.archetype ? 'selected' : ''}>${esc(a.label)}</option>`).join('')}</select></label>` : ''}
        ${!sel.isPlayer ? `<div class="dlg-f"><button class="btn danger ghost" data-a="cmOrgFail:${esc(sel.id)}">Force collapse</button><select data-change="cmMerge:${esc(sel.id)}"><option value="">Merge into…</option>${others.map(o => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('')}</select></div>` : ''}`, 'w-half');
    }
    const arch = ((app.def.orgs.rivals || {}).archetypes || []);
    const create = arch.length ? sec('Create a competitor', `<div class="seg">${arch.map(a => `<button data-a="cmNewOrg:${esc(a.id)}">${esc(a.label)}</button>`).join('')}</div><p class="hint">New competitors start with their archetype's assets and begin acting next ${esc(g.cal.unitLabel)}.</p>`, 'w-half') : '';
    return sec('Companies', `<label class="check"><input type="checkbox" data-change="cmShowBg" ${app.ui.cmShowBg ? 'checked' : ''}> Show background companies</label><div class="table-wrap"><table class="tbl"><tr><th>Name</th><th>Strategy</th><th class="r">Cash</th><th class="r">Value</th></tr>${rows}</table></div>`, sel ? 'w-half' : 'w-full') + ed + create;
  }
  function cEntities(app) {
    const g = app.game;
    const kinds = app.def.kindOrder;
    const k = app.ui.cmKind || kinds.find(x => app.def.kinds[x].operate) || kinds[0];
    const q = (app.ui.search['cm-' + k] || '').toLowerCase();
    let list = g.all(k);
    if (q) list = list.filter(e => (S.entTitle(app, e) + ' ' + e.name).toLowerCase().includes(q));
    const rows = list.slice(0, 80).map(e => `<tr class="${e.owner === g.state.player ? 'mine' : ''}"><td><button class="link" data-a="cmEnt:${esc(k)}:${esc(e.id)}">${esc(S.entTitle(app, e))}</button></td><td>${esc(e.owner ? (g.state.orgs[e.owner] || {}).name || '' : '—')}</td></tr>`).join('');
    const sel = app.ui.cmEnt ? g.ent(k, app.ui.cmEnt) : null;
    let ed = '';
    if (sel) {
      const kd = app.def.kinds[k];
      const inputs = Object.entries(kd.fields).map(([f, fd]) => {
        const v = sel[f];
        if (fd.type === 'ref') { const opts = g.all(fd.ref); return opts.length <= 300 ? `<label class="field"><span>${esc(fd.label)}</span><select data-change="cmEntField:${esc(k)}:${esc(sel.id)}:${esc(f)}"><option value="">—</option>${opts.map(o => `<option value="${esc(o.id)}" ${o.id === v ? 'selected' : ''}>${esc(S.entTitle(app, o))}</option>`).join('')}</select></label>` : ''; }
        if (fd.type === 'bool') return `<label class="check"><input type="checkbox" data-change="cmEntBool:${esc(k)}:${esc(sel.id)}:${esc(f)}" ${v ? 'checked' : ''}> ${esc(fd.label)}</label>`;
        if (fd.type === 'enum' && fd.options) return `<label class="field"><span>${esc(fd.label)}</span><select data-change="cmEntField:${esc(k)}:${esc(sel.id)}:${esc(f)}">${fd.options.map(o => { const ov = o && typeof o === 'object' ? o.value : o; return `<option ${ov === v ? 'selected' : ''}>${esc(ov)}</option>`; }).join('')}</select></label>`;
        if (fd.type === 'refs' || fd.type === 'list') return '';
        return `<label class="field"><span>${esc(fd.label)}</span><input type="${fd.type === 'text' ? 'text' : 'number'}" step="any" value="${esc(v ?? '')}" data-change="cmEntField:${esc(k)}:${esc(sel.id)}:${esc(f)}"></label>`;
      }).join('');
      const owners = g.liveOrgs().filter(o => o.level < 3);
      ed = sec(`Edit: ${S.entTitle(app, sel)}`, `<label class="field"><span>Name</span><input type="text" value="${esc(sel.name)}" data-change="cmEntField:${esc(k)}:${esc(sel.id)}:name"></label><label class="field"><span>Owner</span><select data-change="cmEntOwner:${esc(k)}:${esc(sel.id)}"><option value="">Nobody</option>${owners.map(o => `<option value="${esc(o.id)}" ${o.id === sel.owner ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></label>${inputs}<div class="dlg-f"><button class="btn danger ghost" data-a="cmEntDel:${esc(k)}:${esc(sel.id)}">Delete</button></div>`, 'w-half');
    }
    return sec('Browse', `<div class="seg wrap">${kinds.map(x => `<button class="${x === k ? 'on' : ''}" data-a="cmKind:${esc(x)}">${esc(app.def.kinds[x].plural)}</button>`).join('')}</div>
      <div class="row"><input class="search" type="search" placeholder="Filter…" value="${esc(app.ui.search['cm-' + k] || '')}" data-input="search:cm-${esc(k)}"><button class="btn sm" data-a="cmNewEnt:${esc(k)}">${D.icon('plus')} Create ${esc(app.def.kinds[k].label.toLowerCase())}</button></div>
      <div class="table-wrap"><table class="tbl"><tr><th>Name</th><th>Owner</th></tr>${rows}</table></div>${list.length > 80 ? `<p class="hint">Showing 80 of ${list.length}. Filter to narrow.</p>` : ''}`, sel ? 'w-half' : 'w-full') + ed;
  }
  function cEvents(app) {
    const evs = Object.values(app.def.events);
    return sec('Trigger an event now', `<p class="hint">Events bind to matching entities automatically. If nothing matches, the event cannot fire.</p><div class="table-wrap"><table class="tbl">${evs.map(e => `<tr><td><b>${esc(e.id)}</b><br><small class="muted">${esc(String(e.title || '').replace(/\{[^}]*\}/g, '…'))}</small></td><td>${esc(e.priority)}</td><td class="row-acts"><button class="btn xs" data-a="cmEvent:${esc(e.id)}">Trigger</button></td></tr>`).join('')}</table></div>`);
  }
  function cRules(app) {
    const g = app.game;
    const rows = Object.entries(g.params).map(([k, v]) => `<tr><td>${esc(k)}</td><td><input type="number" step="any" value="${+v}" data-change="cmParam:${esc(k)}"></td></tr>`).join('');
    return sec('Balance parameters', `<p class="hint">These numbers drive the simulation's formulas (demand, prices, costs). Changes apply immediately.</p><table class="tbl">${rows}</table>`, 'w-half') +
      sec('Player', `<label class="check"><input type="checkbox" data-change="cmNoBk" ${g.state.options.noBankruptcy ? 'checked' : ''}> No game over (stay in charge even when broke)</label>
        <label class="field"><span>Progression tier</span><div class="seg wrap">${app.def.progression.tiers.map(t => `<button class="${g.state.progression.tier === t.id ? 'on' : ''}" data-a="cmTier:${esc(t.id)}">${esc(t.label)}</button>`).join('')}</div></label>
        ${Object.values(app.def.stakeholders).map(s => `<label class="field"><span>${esc(s.label)}</span><input type="number" min="0" max="100" value="${Math.round(g.state.stakes[s.id].value)}" data-change="cmStake:${esc(s.id)}"></label>`).join('')}`, 'w-half');
  }
  function cTime(app) {
    return sec('Jump ahead', `<p class="hint">Simulates quickly without stopping for decisions (pending decisions auto-resolve to their defaults).</p><div class="seg">${[4, 13, 26, 52, 260].map(n => `<button data-a="cmJump:${n}">${U.plural(n, app.game.cal.unitLabel)}</button>`).join('')}</div>`);
  }
  const after = (app, msg) => { const g = app.game; g.dirty(); g.computeDerived(); g.updateOrgMetrics(); if (msg) app.toast(msg, 'good'); app.rerender(); };
  H.cmPhase = (app, r) => { app.game.forcePhase(r[0]); after(app, 'Phase change scheduled'); };
  H.cmShock = (app, r) => { app.game.triggerShock(r[0], r[1]); after(app, 'Shock triggered'); };
  C.cmVar = (app, r, el) => { app.game.state.world.vars[r[0]] = +el.value; after(app); };
  H.cmOrg = (app, r) => { app.ui.cmOrg = r[0]; app.rerender(); };
  C.cmShowBg = (app, r, el) => { app.ui.cmShowBg = el.checked; app.rerender(); };
  C.cmOrgName = (app, r, el) => { app.game.state.orgs[r[0]].name = el.value; after(app); };
  C.cmOrgCash = (app, r, el) => { const o = app.game.state.orgs[r[0]]; app.game.addCash(o, +el.value - o.cash, 'Commissioner'); after(app); };
  C.cmOrgRes = (app, r, el) => { app.game.state.orgs[r[0]].res[r[1]] = +el.value; after(app); };
  C.cmOrgField = (app, r, el) => { const fd = app.def.orgFields[r[1]]; app.game.state.orgs[r[0]][r[1]] = fd && fd.type === 'text' ? el.value : +el.value; after(app); };
  C.cmOrgArch = (app, r, el) => { app.game.state.orgs[r[0]].archetype = el.value; after(app, 'Strategy changed'); };
  C.cmMerge = (app, r, el) => { if (!el.value) return; app.game.mergeOrgs(app.game.state.orgs[el.value], app.game.state.orgs[r[0]]); app.ui.cmOrg = null; after(app, 'Merged'); };
  H.cmOrgFail = (app, r) => { app.game.failOrg(app.game.state.orgs[r[0]], 'collapsed (commissioner)'); app.ui.cmOrg = null; after(app, 'Company collapsed'); };
  H.cmNewOrg = (app, r) => {
    const g = app.game, R = app.def.orgs.rivals, a = R.archetypes.find(x => x.id === r[0]);
    const o = g.createOrg({ name: U.companyName(g.rng, R.suffixes || a.suffixes), archetype: a.id, level: 1, color: a.color || null });
    const sc = g.scope({ org: o });
    o.cash = g.num(a.cash != null ? a.cash : 1e6, sc);
    if (a.set) for (const [f, x] of Object.entries(a.set)) g.assign(o, f, g.ev(x, sc), 'set');
    if (a.start) g.runOps(a.start, sc); if (R.start) g.runOps(R.start, sc);
    g.news(`New competitor: ${o.name} enters the market`, 'routine', { tag: 'rival' });
    after(app, 'Created ' + o.name);
  };
  H.cmKind = (app, r) => { app.ui.cmKind = r[0]; app.ui.cmEnt = null; app.rerender(); };
  H.cmEnt = (app, r) => { app.ui.cmKind = r[0]; app.ui.cmEnt = r[1]; app.rerender(); };
  C.cmEntField = (app, r, el) => { const [k, id, f] = r; const e = app.game.ent(k, id); const fd = app.def.kinds[k].fields[f]; let v = el.value; if (fd && !['text', 'enum', 'ref'].includes(fd.type)) v = +v; if (fd && fd.type === 'ref' && !v) v = null; app.game.assign(e, f, v, 'set'); if (f === 'name') e.name = el.value; after(app); };
  C.cmEntBool = (app, r, el) => { const [k, id, f] = r; app.game.ent(k, id)[f] = el.checked; after(app); };
  C.cmEntOwner = (app, r, el) => { const e = app.game.ent(r[0], r[1]); e.owner = el.value || null; after(app, 'Ownership changed'); };
  H.cmEntDel = (app, r) => { const e = app.game.ent(r[0], r[1]); if (!confirm(`Delete ${e.name}?`)) return; for (const k of app.def.kindOrder) for (const [f, fd] of Object.entries(app.def.kinds[k].fields)) if (fd.type === 'ref' && fd.ref === r[0]) for (const x of app.game.refs(k, f, e.id).slice()) x[f] = null; app.game.removeEntity(e); app.ui.cmEnt = null; after(app, 'Deleted'); };
  H.cmNewEnt = (app, r) => { const e = app.game.createEntity(r[0], {}, null); app.ui.cmEnt = e.id; after(app, 'Created — set its fields and owner'); };
  H.cmEvent = (app, r) => { const g = app.game; const ev = app.def.events[r[0]]; const sc = g.scope(); const b = g.bindEvent(ev, sc); if (!b) { app.toast('Nothing in the world matches this event right now', 'bad'); return; } const inst = g.fireEvent(ev.id, Object.fromEntries(Object.entries(b).map(([k, v]) => [k, g.refOf(v)])), true); after(app); if (inst) E.ui.eventModal(app, inst.iid); else app.toast('Event fired', 'good'); };
  C.cmParam = (app, r, el) => { app.game.params[r[0]] = +el.value; app.game.state.params = app.game.params; after(app); };
  C.cmNoBk = (app, r, el) => { app.game.state.options.noBankruptcy = el.checked; };
  H.cmTier = (app, r) => { app.game.state.progression.tier = r[0]; after(app, 'Tier set'); };
  C.cmStake = (app, r, el) => { app.game.state.stakes[r[0]].value = +el.value; after(app); };
  H.cmJump = (app, r) => {
    const g = app.game, n = +r[0];
    app.root.querySelector('#main').innerHTML = `<div class="loading"><div class="spinner"></div><p>Simulating ${U.plural(n, g.cal.unitLabel)}…</p></div>`;
    setTimeout(() => { for (let i = 0; i < n; i++) { g.tick(); for (const p of g.state.events.pending.slice()) g.resolveEvent(p.iid, p.default != null ? p.default : 0, true); if (g.state.progression.over) break; } app.momentQueue = []; app.annualQueue = []; g.takeDigest(); after(app, `Jumped ${U.plural(n, g.cal.unitLabel)}`); }, 30);
  };
})(globalThis.LGE = globalThis.LGE || {});
