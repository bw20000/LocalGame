/* Local Game Studio engine — screens & sections.
   A screen = title + primary actions + optional tabs + a grid of sections. Every section type is
   a small renderer reading the GDL spec and live game state. */
(function (E) {
  'use strict';
  const U = E.util, D = E.dom, esc = U.esc;
  const S = E.ui.sections = {};

  const W = { full: 'w-full', half: 'w-half', third: 'w-third', twoThirds: 'w-two' };
  function card(spec, inner, extraCls = '', head = '') {
    const title = spec.title ? `<div class="sec-head"><h3>${esc(spec.title)}</h3>${head}</div>` : (head ? `<div class="sec-head">${head}</div>` : '');
    return `<section class="sec ${W[spec.width] || 'w-full'} sec-${esc(spec.type)} ${extraCls}" ${spec.tour ? `data-tour="${esc(spec.tour)}"` : ''}>${title}<div class="sec-body">${inner}</div></section>`;
  }
  S.card = card;
  const fmtv = (v, f) => U.format(v, f);
  function evalList(app, spec) {
    const g = app.game;
    let list;
    if (spec.source) list = g.ev(spec.source, g.scope()) || [];
    else if (spec.kind === 'org' || spec.kind === 'orgs') list = g.liveOrgs().filter(o => o.level < 3);
    else list = g.all(spec.kind).slice();
    const p = g.state.player;
    if (spec.owner === 'player') list = list.filter(e => e.owner === p);
    else if (spec.owner === 'rival') list = list.filter(e => e.owner != null && e.owner !== p);
    else if (spec.owner === 'none') list = list.filter(e => e.owner == null);
    const sc = g.scope();
    if (spec.filter) list = list.filter(it => { sc.it = it; sc.self = it; return !!g.ev(spec.filter, sc); });
    const q = app.ui.search[spec.key || spec.kind];
    if (q) { const ql = q.toLowerCase(); list = list.filter(e => String(e.name || '').toLowerCase().includes(ql) || String(e.id).toLowerCase().includes(ql)); }
    return list;
  }
  function sortList(app, list, spec, cols) {
    const g = app.game, sc = g.scope();
    const sk = app.ui.sort && app.ui.sort[spec.key || spec.kind];
    let expr = spec.sort, desc = spec.desc !== false;
    if (sk && cols && cols[sk.col]) { expr = cols[sk.col].sortExpr || cols[sk.col].expr; desc = sk.desc; }
    if (!expr) return list;
    const vals = new Map(list.map(it => { sc.it = it; sc.self = it; const v = g.ev(expr, sc); return [it, typeof v === 'string' ? v : +v || 0]; }));
    return list.slice().sort((a, b) => { const x = vals.get(a), y = vals.get(b); const c = typeof x === 'string' ? String(x).localeCompare(String(y)) : x - y; return desc ? -c : c; });
  }
  function entRef(e) { return e && e.__org ? 'org:' + e.id : `${e.kind}:${e.id}`; }
  S.entRef = entRef;
  function entTitle(app, e) {
    if (!e) return '';
    if (e.__org) return e.name;
    const kd = app.def.kinds[e.kind]; const d = kd && kd.display;
    return d && d.title ? app.game.tpl(d.title, app.game.scope({ self: e, org: app.game.state.orgs[e.owner] || app.game.playerOrg() })) : e.name;
  }
  function entSub(app, e) {
    if (!e || e.__org) return '';
    const kd = app.def.kinds[e.kind]; const d = kd && kd.display;
    return d && d.subtitle ? app.game.tpl(d.subtitle, app.game.scope({ self: e, org: app.game.state.orgs[e.owner] || app.game.playerOrg() })) : '';
  }
  S.entTitle = entTitle; S.entSub = entSub;
  const toneCls = (t) => (t === 'good' || t === 'bad' || t === 'warn' || t === 'info' ? 'tone-' + t : '');
  function pager(app, key, total, per) {
    const pages = Math.ceil(total / per); if (pages <= 1) return '';
    const cur = Math.min(app.ui.tablePage[key] || 0, pages - 1);
    return `<div class="pager"><button class="btn sm ghost" ${cur <= 0 ? 'disabled' : ''} data-a="page:${esc(key)}:${cur - 1}">‹</button><span>${cur + 1} / ${pages} · ${total} total</span><button class="btn sm ghost" ${cur >= pages - 1 ? 'disabled' : ''} data-a="page:${esc(key)}:${cur + 1}">›</button></div>`;
  }

  /* ---------------- screen ---------------- */
  E.ui.renderScreen = (app) => {
    const id = app.route.screen;
    if (id === 'history') return E.ui.historyScreen(app);
    if (id === 'commissioner') return E.ui.commissionerScreen ? E.ui.commissionerScreen(app) : '';
    if (id === 'saves') return E.ui.savesScreen(app);
    const screens = (app.gdl.ui && app.gdl.ui.screens) || E.ui.defaultScreens(app);
    const sc = screens[id] || (id === 'home' ? E.ui.defaultHome(app) : null);
    if (!sc) return `<div class="empty">Unknown screen.</div>`;
    const g = app.game, scope = g.scope();
    const acts = (sc.actions || []).map(aid => {
      const a = app.def.actions[aid]; if (!a || !g.actionVisible(a, g.playerOrg(), null)) return '';
      return `<button class="btn ${a.primary ? 'primary' : ''}" data-a="act:${esc(aid)}" data-tour="action:${esc(aid)}">${D.icon(a.icon || 'plus')}<span>${esc(a.label)}</span></button>`;
    }).join('');
    let tabs = '', sections = sc.sections || [];
    if (sc.tabs && sc.tabs.length) {
      const visTabs = sc.tabs.filter(t => !t.when || g.ev(t.when, scope, true));
      const cur = visTabs.find(t => t.id === app.route.tab) || visTabs[0];
      tabs = `<div class="tabs" role="tablist">${visTabs.map(t => `<button role="tab" class="tab ${t === cur ? 'on' : ''}" data-a="tab:${esc(t.id)}" data-tour="tab:${esc(t.id)}">${esc(t.label)}</button>`).join('')}</div>`;
      sections = cur ? cur.sections || [] : [];
    }
    const body = sections.map(s => {
      if (s.when && !g.ev(s.when, scope, true)) return '';
      const r = S[s.type];
      if (!r) return card(s, `<div class="empty">Unknown section type “${esc(s.type)}”.</div>`);
      try { return r(app, s); } catch (e) { g.report('ui section ' + s.type, e); return card(s, `<div class="empty">This panel could not be drawn (${esc(e.message)}).</div>`); }
    }).join('');
    return `<div class="screen screen-${esc(id)}">
      <div class="screen-head"><div><h1>${esc(g.tpl(sc.title || id, scope))}</h1>${sc.subtitle ? `<p class="sub">${esc(g.tpl(sc.subtitle, scope))}</p>` : ''}</div><div class="screen-actions">${acts}</div></div>
      ${tabs}<div class="grid">${body}</div></div>`;
  };

  /* ---------------- sections ---------------- */
  S.goal = (app, s) => {
    const g = app.game, sc = g.scope();
    const tiers = app.def.progression.tiers;
    const ti = g.tierIndex(g.state.progression.tier);
    const next = tiers[ti + 1];
    let tierHtml = '';
    if (tiers.length) {
      tierHtml = `<div class="tier-track">${tiers.map((t, i) => `<span class="tier-step ${i < ti ? 'done' : i === ti ? 'cur' : ''}"><i></i><b>${esc(t.label)}</b></span>`).join('')}</div>`;
      if (next && s.nextHint !== false) tierHtml += `<p class="tier-next">${D.icon('target')} Next: <b>${esc(next.label)}</b>${next.hint ? ' — ' + esc(g.tpl(next.hint, sc)) : ''}</p>`;
    }
    const goal = s.text ? g.tpl(s.text, sc) : (app.def.meta.goal ? g.tpl(app.def.meta.goal, sc) : '');
    return card(s, `${goal ? `<p class="goal-text">${esc(goal)}</p>` : ''}${tierHtml}`, 'sec-goalband');
  };
  S.metrics = (app, s) => {
    const g = app.game, sc = g.scope();
    const items = (s.items || []).map((m, i) => {
      const v = g.ev(m.expr, sc);
      const tone = m.tone ? toneCls(g.ev(m.tone, Object.assign(sc, { v }))) : '';
      const hist = m.metric ? (g.playerOrg().hist[m.metric] || []).slice(-26) : (m.series ? (g.ev(m.series, sc) || []) : null);
      const why = m.explain ? `<button class="why" data-a="explain:${esc(m.explain)}" title="Why?">?</button>` : '';
      return `<div class="metric ${tone}"><div class="metric-l">${esc(m.label)}${why}</div><div class="metric-v" data-tween="m-${esc(s.key || '')}-${i}" data-value="${+v}" data-fmt="${esc(m.format || 'num')}">${esc(fmtv(v, m.format))}</div>${m.sub ? `<div class="metric-s">${esc(g.tpl(m.sub, sc))}</div>` : ''}${hist && hist.length > 2 ? D.sparkline(hist, 120, 26) : ''}</div>`;
    }).join('');
    return card(s, `<div class="metrics n${(s.items || []).length}">${items}</div>`, 'sec-metrics-row');
  };
  S.needs = (app, s) => {
    const g = app.game;
    const list = g.needs();
    if (!list.length) return card(Object.assign({ title: 'Needs you' }, s), `<div class="calm">${D.icon('check')} Nothing urgent. ${esc(s.calm || 'Your teams are handling the routine work. Look for the next opportunity.')}</div>`, 'sec-needs');
    const rows = list.map(n => `<button class="need tone-${esc(n.tone || 'neutral')} pri${n.pri}" data-a="need:${esc(n.id)}"><span class="need-ic">${D.icon(n.pri >= 3 ? 'alert' : n.type === 'event' ? 'bolt' : n.type === 'negotiation' ? 'handshake' : 'info')}</span><span class="need-t"><b>${esc(n.title)}</b>${n.sub ? `<small>${esc(n.sub)}</small>` : ''}</span><span class="need-go">${D.icon('play')}</span></button>`).join('');
    return card(Object.assign({ title: `Needs you (${list.length})` }, s, { title: s.title ? `${s.title} (${list.length})` : `Needs you (${list.length})` }), `<div class="needs">${rows}</div>`, 'sec-needs');
  };
  S.actions = (app, s) => {
    const g = app.game;
    const btns = (s.ids || []).map(id => {
      const a = app.def.actions[id]; if (!a || !g.actionVisible(a, g.playerOrg(), null)) return '';
      return `<button class="action-tile" data-a="act:${esc(id)}" data-tour="action:${esc(id)}">${D.icon(a.icon || 'plus')}<b>${esc(a.label)}</b>${a.describe ? `<small>${esc(g.tpl(a.describe, g.scope()))}</small>` : ''}</button>`;
    }).join('');
    return card(s, `<div class="action-tiles">${btns}</div>`);
  };
  S.upcoming = (app, s) => {
    const g = app.game;
    const list = g.upcoming();
    const rows = list.map(u => `<li><span class="up-when">${u.at <= g.state.tick ? 'Now' : `in ${U.plural(u.at - g.state.tick, g.cal.unitLabel)}`}</span><span class="up-what">${esc(u.label)}</span></li>`).join('');
    return card(Object.assign({ title: 'Coming up' }, s), list.length ? `<ul class="upcoming">${rows}</ul>` : '<div class="empty">Nothing scheduled.</div>');
  };
  S.objectives = (app, s) => {
    const g = app.game;
    const obs = g.state.progression.objectives || [];
    if (!obs.length) return '';
    const rows = obs.map(o => {
      const pr = o.done ? { progress: o.success ? 1 : 0, value: o.final } : g.objectiveProgress(o);
      return `<div class="objective ${o.done ? (o.success ? 'met' : 'missed') : ''}"><div class="obj-t">${esc(o.text)}</div><div class="obj-bar">${D.meter(pr.progress * 100, 100, o.done ? (o.success ? 'good' : 'bad') : '')}</div><div class="obj-s">${o.done ? (o.success ? 'Met' : 'Missed') : `Now ${esc(U.format(pr.value, o.format || guessFmt(o.metric)))} · due ${esc(g.cal.shortLabel(o.deadline))}`}</div></div>`;
    }).join('');
    return card(Object.assign({ title: 'Board objectives' }, s), rows);
  };
  function guessFmt(expr) { expr = String(expr || ''); if (/margin|load|share|pct|onTime|rate/i.test(expr)) return 'pct'; if (/cash|debt|revenue|profit|value/i.test(expr)) return 'money'; return 'num'; }
  S.table = (app, s) => {
    const g = app.game;
    const key = s.key || s.kind;
    let list = evalList(app, s);
    const cols = s.columns || [{ label: 'Name', expr: 'it.name' }];
    list = sortList(app, list, s, cols);
    const per = s.limit || 25;
    const page = Math.min(app.ui.tablePage[key] || 0, Math.max(0, Math.ceil(list.length / per) - 1));
    const shown = list.slice(page * per, page * per + per);
    const sc = g.scope();
    const sk = app.ui.sort && app.ui.sort[key];
    const head = `<tr>${cols.map((c, i) => `<th class="${c.align === 'right' || /money|pct|int|num|score/.test(c.format || '') ? 'r' : ''}"><button class="th-sort" data-a="sort:${esc(key)}:${i}">${esc(c.label)}${sk && sk.col === i ? (sk.desc ? ' ▾' : ' ▴') : ''}</button></th>`).join('')}${s.rowActions ? '<th></th>' : ''}</tr>`;
    const rows = shown.map(it => {
      sc.it = it; sc.self = it;
      const mine = it.owner === g.state.player || it.isPlayer;
      const tds = cols.map((c, ci) => {
        const v = g.ev(c.expr, sc);
        const tone = c.tone ? toneCls(g.ev(c.tone, Object.assign(sc, { v }))) : '';
        const txt = c.format === 'bar' ? D.meter(+v * 100) : esc(fmtv(v, c.format));
        const first = ci === 0 ? `<button class="link" data-a="inspect:${esc(entRef(it))}">${txt}</button>` : txt;
        return `<td class="${tone} ${c.align === 'right' || /money|pct|int|num|score/.test(c.format || '') ? 'r' : ''}">${first}</td>`;
      }).join('');
      const ra = s.rowActions ? `<td class="row-acts">${s.rowActions.map(aid => { const a = app.def.actions[aid]; return a && g.actionVisible(a, g.playerOrg(), it) ? `<button class="btn xs ghost" data-a="act:${esc(aid)}:${esc(entRef(it))}" title="${esc(a.label)}">${D.icon(a.icon || 'play')}</button>` : ''; }).join('')}</td>` : '';
      return `<tr class="${mine ? 'mine' : ''}">${tds}${ra}</tr>`;
    }).join('');
    const search = s.search ? `<input class="search" type="search" placeholder="Filter…" value="${esc(app.ui.search[key] || '')}" data-input="search:${esc(key)}">` : '';
    const body = list.length ? `<div class="table-wrap"><table class="tbl">${head}${rows}</table></div>${pager(app, key, list.length, per)}` : `<div class="empty">${esc(g.tpl(s.empty || 'Nothing here yet.', g.scope()))}</div>`;
    return card(s, body, '', search);
  };
  S.cards = (app, s) => {
    const g = app.game, key = s.key || s.kind;
    let list = sortList(app, evalList(app, s), s);
    if (s.groupBy) {
      const groups = new Map(); const sc = g.scope();
      for (const it of list) { sc.it = it; sc.self = it; const k = String(g.ev(s.groupBy, sc)); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); }
      const html = Array.from(groups.entries()).map(([k, arr]) => `<div class="card-group"><div class="card-group-h"><b>${esc(k)}</b><span>${arr.length}</span></div><div class="cards size-${esc(s.size || 'm')}">${arr.slice(0, s.limitPerGroup || 24).map(it => cardOf(app, s, it)).join('')}</div></div>`).join('');
      return card(s, list.length ? html : `<div class="empty">${esc(g.tpl(s.empty || 'Nothing here yet.', g.scope()))}</div>`);
    }
    const per = s.limit || 30;
    const page = Math.min(app.ui.tablePage[key] || 0, Math.max(0, Math.ceil(list.length / per) - 1));
    const shown = list.slice(page * per, page * per + per);
    const search = s.search ? `<input class="search" type="search" placeholder="Filter…" value="${esc(app.ui.search[key] || '')}" data-input="search:${esc(key)}">` : '';
    return card(s, list.length ? `<div class="cards size-${esc(s.size || 'm')}">${shown.map(it => cardOf(app, s, it)).join('')}</div>${pager(app, key, list.length, per)}` : `<div class="empty">${esc(g.tpl(s.empty || 'Nothing here yet.', g.scope()))}</div>`, '', search);
  };
  function cardOf(app, s, it) {
    const g = app.game;
    const sc = g.scope({ self: it, it, org: g.state.orgs[it.owner] || g.playerOrg() });
    const title = s.titleExpr ? g.tpl(s.titleExpr, sc) : entTitle(app, it);
    const sub = s.subtitle ? g.tpl(s.subtitle, sc) : entSub(app, it);
    const glyph = s.glyph ? g.ev(s.glyph, sc) : null;
    const gcol = s.glyphColor ? g.ev(s.glyphColor, sc) : null;
    const scale = s.glyphScale ? g.num(s.glyphScale, sc, 0.5) : 0.5;
    const badge = s.badge ? g.tpl(s.badge, sc) : '';
    const btone = s.badgeTone ? toneCls(g.ev(s.badgeTone, sc)) : '';
    const stats = (s.stats || []).map(st => { const v = g.ev(st.expr, sc); const tone = st.tone ? toneCls(g.ev(st.tone, Object.assign(sc, { v }))) : ''; return `<div class="cs ${tone}"><span>${esc(st.label)}</span><b>${st.format === 'bar' ? D.meter(+v * 100) : esc(fmtv(v, st.format))}</b></div>`; }).join('');
    const bar = s.bar ? (() => { const v = g.num(s.bar.expr, sc, 0); return `<div class="card-bar" title="${esc(s.bar.label || '')}">${D.meter(v * 100, 100, toneCls(s.bar.tone ? g.ev(s.bar.tone, Object.assign(sc, { v })) : ''))}<small>${esc(s.bar.label || '')} ${esc(U.format(v, s.bar.format || 'pct'))}</small></div>`; })() : '';
    const acts = (s.actions || []).map(aid => { const a = app.def.actions[aid]; return a && g.actionVisible(a, g.playerOrg(), it) && it.owner === g.state.player ? `<button class="btn xs ghost" data-a="act:${esc(aid)}:${esc(entRef(it))}" title="${esc(a.label)}">${D.icon(a.icon || 'play')}<span>${esc(a.verb || a.label)}</span></button>` : ''; }).join('');
    return `<div class="ecard ${it.owner === g.state.player ? 'mine' : ''}" data-a="inspect:${esc(entRef(it))}">${glyph ? `<div class="ecard-art" ${gcol ? `style="color:${esc(gcol)}"` : ''}>${D.glyph(glyph, null, scale)}</div>` : ''}<div class="ecard-h"><b>${esc(title)}</b>${badge ? `<span class="chip ${btone}">${esc(badge)}</span>` : ''}</div>${sub ? `<div class="ecard-s">${esc(sub)}</div>` : ''}${stats ? `<div class="ecard-stats">${stats}</div>` : ''}${bar}${acts ? `<div class="ecard-a" onclick="event.stopPropagation()">${acts}</div>` : ''}</div>`;
  }
  S.board = (app, s) => {
    // departure-board style listing (rows of status + key numbers), great for signature home panels
    const g = app.game;
    let list = sortList(app, evalList(app, s), s).slice(0, s.limit || 10);
    const cols = s.columns || [];
    const sc = g.scope();
    const head = `<div class="brd-row brd-head">${cols.map(c => `<span class="${c.align === 'right' ? 'r' : ''}">${esc(c.label)}</span>`).join('')}${s.status ? '<span>Status</span>' : ''}</div>`;
    const rows = list.map(it => {
      sc.it = it; sc.self = it;
      const st = s.status ? g.tpl(s.status, sc) : '';
      const tone = s.statusTone ? toneCls(g.ev(s.statusTone, sc)) : '';
      return `<button class="brd-row" data-a="inspect:${esc(entRef(it))}">${cols.map(c => `<span class="${c.align === 'right' ? 'r' : ''}">${esc(fmtv(g.ev(c.expr, sc), c.format))}</span>`).join('')}${s.status ? `<span class="brd-status ${tone}">${esc(st)}</span>` : ''}</button>`;
    }).join('');
    return card(s, list.length ? `<div class="board">${head}${rows}</div>` : `<div class="empty">${esc(s.empty || 'Nothing to show yet.')}</div>`, 'sec-board');
  };
  S.map = (app, s) => {
    const g = app.game, sc = g.scope();
    const w = s.w || 960, h = s.h || 470;
    const N = s.nodes || {}, L = s.links || {};
    let nodes = N.kind ? g.all(N.kind).slice() : [];
    let links = L.kind ? g.all(L.kind).slice() : [];
    if (L.filter) links = links.filter(it => { sc.it = it; sc.self = it; return !!g.ev(L.filter, sc); });
    const mineOnly = app.ui.mapMine !== false && s.toggle !== false;
    const p = g.state.player;
    const mineLinks = links.filter(l => l.owner === p);
    const showLinks = mineOnly ? mineLinks : links;
    const ends = new Set(); for (const l of showLinks) { const a = l[L.a || 'a'], b = l[L.b || 'b']; ends.add(a); ends.add(b); }
    if (N.filter) nodes = nodes.filter(it => { sc.it = it; sc.self = it; return ends.has(it.id) || !!g.ev(N.filter, sc); });
    const fitPts = (s.fit === 'world' || !showLinks.length) ? nodes : nodes.filter(n => ends.has(n.id));
    const pr = D.projector(fitPts.length ? fitPts : nodes, w, h, 0.1, s.fit === 'world');
    let svg = `<svg class="map" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(s.title || 'Map')}">`;
    if (s.basemap === 'world' && E.assets && E.assets.worldLand) {
      const polys = E.assets.worldLand.polys;
      svg += `<g class="land">${polys.map(poly => `<path d="M${poly.map(pt => `${pr.x(pt[0]).toFixed(1)},${pr.y(pt[1]).toFixed(1)}`).join('L')}Z"/>`).join('')}</g>`;
    } else svg += `<g class="graticule">${[-120, -60, 0, 60, 120].map(lon => `<line x1="${pr.x(lon)}" x2="${pr.x(lon)}" y1="0" y2="${h}"/>`).join('')}${[-30, 0, 30, 60].map(lat => `<line y1="${pr.y(lat)}" y2="${pr.y(lat)}" x1="0" x2="${w}"/>`).join('')}</g>`;
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const linkHtml = (showLinks.slice(0, s.maxLinks || 700)).map(l => {
      const a = nodeById.get(l[L.a || 'a']) || g.ent(N.kind, l[L.a || 'a']), b = nodeById.get(l[L.b || 'b']) || g.ent(N.kind, l[L.b || 'b']);
      if (!a || !b) return '';
      sc.it = l; sc.self = l;
      const mine = l.owner === p;
      const tone = L.tone ? g.num(L.tone, sc, 0) : 0;
      const wd = L.width ? g.num(L.width, sc, 1.5) : 1.5;
      const x1 = pr.x(a.lon ?? a.x), y1 = pr.y(a.lat ?? a.y), x2 = pr.x(b.lon ?? b.x), y2 = pr.y(b.lat ?? b.y);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.18;
      const col = mine ? (tone > 0.05 ? 'var(--good)' : tone < -0.05 ? 'var(--bad)' : 'var(--accent)') : (g.state.orgs[l.owner] && g.state.orgs[l.owner].color) || 'var(--muted)';
      return `<path class="lnk ${mine ? 'mine' : 'rival'}" d="M${x1.toFixed(1)},${y1.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}" stroke="${col}" stroke-width="${(mine ? U.clamp(wd, 1, 7) : 0.8).toFixed(1)}" data-a="inspect:${esc(entRef(l))}"><title>${esc(entTitle(app, l))}</title></path>`;
    }).join('');
    svg += `<g class="links">${linkHtml}</g>`;
    const nodeHtml = nodes.map(n => {
      sc.it = n; sc.self = n;
      const r = N.size ? U.clamp(g.num(N.size, sc, 3), 1.5, 14) : 3;
      const hub = N.highlight ? !!g.ev(N.highlight, sc) : false;
      const x = pr.x(n.lon ?? n.x), y = pr.y(n.lat ?? n.y);
      const labTxt = N.label ? (String(N.label).includes('{') ? g.tpl(N.label, sc) : g.ev(N.label, sc, '')) : '';
      const lab = (hub || ends.has(n.id)) && labTxt ? `<text x="${(x + r + 2).toFixed(1)}" y="${(y + 3).toFixed(1)}" class="nlab ${hub ? 'hub' : ''}">${esc(labTxt)}</text>` : '';
      return `<g class="node ${hub ? 'hub' : ''} ${ends.has(n.id) ? 'served' : ''}" data-a="inspect:${esc(entRef(n))}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(hub ? r + 2 : r).toFixed(1)}"><title>${esc(entTitle(app, n))}</title></circle>${lab}</g>`;
    }).join('');
    svg += `<g class="nodes">${nodeHtml}</g></svg>`;
    const toggle = s.toggle !== false ? `<div class="seg sm"><button class="${mineOnly ? 'on' : ''}" data-a="mapMine:1">Your network</button><button class="${!mineOnly ? 'on' : ''}" data-a="mapMine:0">Everyone</button></div>` : '';
    const legend = s.legend ? `<div class="map-legend">${s.legend.map(l => `<span><i style="background:${esc(l.color)}"></i>${esc(l.label)}</span>`).join('')}</div>` : '';
    return card(s, `<div class="map-wrap">${svg}</div>${legend}`, 'sec-map', toggle);
  };
  E.ui.handlers.mapMine = (app, rest) => { app.ui.mapMine = rest[0] === '1'; app.rerender(); };
  S.pipeline = (app, s) => {
    const g = app.game, p = g.state.player;
    const projs = Object.values(g.state.projects).filter(x => x.owner === p && (!s.projects || s.projects.includes(x.id)));
    if (!projs.length) return card(s, `<div class="empty">${esc(s.empty || 'Nothing in the pipeline.')}</div>`);
    const stages = new Map();
    for (const pr of projs) { const k = pr.stageLabel || 'In progress'; if (!stages.has(k)) stages.set(k, []); stages.get(k).push(pr); }
    const cols = Array.from(stages.entries()).map(([k, arr]) => `<div class="pipe-col"><div class="pipe-h">${esc(k)} <span>${arr.length}</span></div>${arr.map(pr => `<div class="pipe-card ${pr.waiting ? 'waiting' : ''}" ${pr.waiting ? `data-a="need:${esc(pr.iid)}"` : ''}><b>${esc(pr.name)}</b><small>${pr.waiting ? 'Decision needed' : `${U.plural(pr.left, g.cal.unitLabel)} left`}</small>${D.meter((1 - pr.left / Math.max(1, pr.total)) * 100)}</div>`).join('')}</div>`).join('');
    return card(s, `<div class="pipeline">${cols}</div>`);
  };
  S.chart = (app, s) => {
    const g = app.game, p = g.playerOrg();
    const series = (s.series || []).map(se => {
      let values = [];
      if (se.metric) values = (p.hist[se.metric] || []).slice(-(s.window || 104));
      else if (se.ledger) values = p.ledger.series.slice(-(s.window || 104)).map(x => x[se.ledger]);
      else if (se.world) values = (g.state.world.hist[se.world] || []).slice(-(s.window || 104));
      else if (se.org) { const o = g.liveOrgs().find(x => x.name === se.org); values = o ? (o.hist[se.metricOf] || []) : []; }
      return { label: se.label, values, color: se.color };
    });
    return card(s, D.lineChart(series, { fmt: (v) => U.format(v, s.format || 'num'), area: s.area !== false, label: s.title, labels: [s.window ? `${s.window} ${g.cal.unitLabel}s ago` : 'Earlier', 'Now'] }));
  };
  S.ledger = (app, s) => {
    const g = app.game, p = g.playerOrg();
    const period = app.ui.ledgerPeriod || 'year';
    const L = period === 'year' ? (Object.keys(p.ledger.prevYear || {}).length && g.cal.tickOfYear(g.state.tick) < g.cal.perYear / 4 ? p.ledger.prevYear : p.ledger.ytd) : p.ledger.last;
    const label = period === 'year' ? (L === p.ledger.prevYear ? 'Last year' : 'Year to date') : 'Last ' + g.cal.unitLabel;
    const ent = Object.entries(L || {});
    const rev = ent.filter(([k, v]) => v > 0 && g.isOperatingCategory(k)).sort((a, b) => b[1] - a[1]);
    const cost = ent.filter(([k, v]) => v < 0 && g.isOperatingCategory(k)).sort((a, b) => a[1] - b[1]);
    const other = ent.filter(([k]) => !g.isOperatingCategory(k));
    const sum = (arr) => arr.reduce((a, [, v]) => a + v, 0);
    const line = ([k, v]) => `<tr><td>${esc(k)}${p.ledger.nonCash && p.ledger.nonCash[k] ? ' <small class="muted">(non-cash)</small>' : ''}</td><td class="r ${v < 0 ? 'neg' : ''}">${esc(U.money(v))}</td></tr>`;
    const tot = sum(rev) + sum(cost);
    const body = `<div class="seg sm"><button class="${period === 'tick' ? 'on' : ''}" data-a="ledgerPeriod:tick">Last ${esc(g.cal.unitLabel)}</button><button class="${period === 'year' ? 'on' : ''}" data-a="ledgerPeriod:year">Year</button></div>
      <table class="tbl ledger"><tr class="grp"><td colspan="2">${esc(label)} — revenue</td></tr>${rev.map(line).join('')}<tr class="sub"><td>Total revenue</td><td class="r">${esc(U.money(sum(rev)))}</td></tr>
      <tr class="grp"><td colspan="2">Costs</td></tr>${cost.map(line).join('')}<tr class="sub"><td>Total costs</td><td class="r neg">${esc(U.money(sum(cost)))}</td></tr>
      <tr class="tot ${tot >= 0 ? 'pos' : 'neg'}"><td>Operating profit</td><td class="r">${esc(U.money(tot))}</td></tr>
      ${other.length ? `<tr class="grp"><td colspan="2">Investment & financing (not in profit)</td></tr>${other.map(line).join('')}` : ''}</table>`;
    return card(Object.assign({ title: 'Profit & loss' }, s), body);
  };
  E.ui.handlers.ledgerPeriod = (app, rest) => { app.ui.ledgerPeriod = rest[0]; app.rerender(); };
  S.finance = (app, s) => {
    const g = app.game, p = g.playerOrg();
    const rows = p.loans.map(l => `<tr><td>${esc(U.money(l.principal))} loan</td><td class="r">${esc(U.pct(l.rate, 1))}</td><td class="r">${esc(U.money(l.balance))}</td><td class="r">${esc(U.plural(l.left, g.cal.unitLabel))}</td></tr>`).join('');
    const body = `<div class="kv-grid"><div><span>Cash</span><b class="${p.cash < 0 ? 'neg' : ''}">${esc(U.money(p.cash))}</b></div><div><span>Debt</span><b>${esc(U.money(p.debt))}</b></div><div><span>Credit line</span><b>${esc(U.money(g.creditLimit(p)))}</b></div><div><span>Borrowing room</span><b>${esc(U.money(g.borrowRoom(p)))}</b></div><div><span>Your interest rate</span><b>${esc(U.pct(g.rateFor(p), 1))}</b></div><div><span>Company value</span><b>${esc(U.money(p.m.value))}</b></div></div>
      ${rows ? `<table class="tbl"><tr><th>Loan</th><th class="r">Rate</th><th class="r">Balance</th><th class="r">Remaining</th></tr>${rows}</table>` : '<div class="empty">No loans.</div>'}`;
    return card(Object.assign({ title: 'Balance sheet & credit' }, s), body);
  };
  S.rankings = (app, s) => {
    const g = app.game;
    const orgs = g.liveOrgs().filter(o => o.level < 3);
    const sc = g.scope();
    const vals = orgs.map(o => { sc.org = o; sc.it = o; return [o, g.num(s.metric || 'org.m.value', sc, 0)]; }).sort((a, b) => b[1] - a[1]);
    const lim = s.limit || 8, pi = vals.findIndex(([o]) => o.isPlayer);
    let shown = vals.slice(0, lim);
    if (pi >= lim) shown = shown.concat([vals[pi]]);
    const mx = Math.max(1e-9, ...vals.map(v => Math.abs(v[1])));
    const rows = shown.map(([o, v]) => `<button class="rank-row ${o.isPlayer ? 'mine' : ''}" data-a="inspect:org:${esc(o.id)}"><span class="rk">${vals.findIndex(x => x[0] === o) + 1}</span><span class="rn">${o.color ? `<i class="dot" style="background:${esc(o.color)}"></i>` : ''}${esc(o.name)}</span><span class="rb">${D.meter(Math.abs(v) / mx * 100, 100, v < 0 ? 'bad' : '')}</span><span class="rv">${esc(U.format(v, s.format))}</span></button>`).join('');
    sc.org = g.playerOrg();
    return card(s, `<div class="rankings">${rows}</div>`);
  };
  S.feed = (app, s) => {
    const g = app.game, st = g.state;
    let items;
    if (s.source === 'transactions') items = st.history.transactions.map(t => ({ t: t.t, text: t.text, pri: 'routine', amount: t.amount }));
    else if (s.source === 'deals') items = (st.history.deals || []).filter(d => d.org === st.player).map(d => ({ t: d.t, text: `${d.label} with ${d.with}: ${d.outcome}`, pri: 'routine' }));
    else items = st.news.filter(n => (s.priority ? (s.priority === 'important' ? n.pri === 'important' || n.pri === 'critical' : true) : n.pri !== 'background' || s.includeBackground) && (!s.tag || n.tag === s.tag) && (!s.mine || !n.org || n.org === st.player));
    const lim = s.limit || 12;
    const rows = items.slice(0, lim).map(n => `<li class="feed-${esc(n.pri)}"><span class="fd">${esc(g.cal.shortLabel(n.t))}</span><span class="ft">${esc(n.text)}</span>${n.amount != null ? `<span class="fa ${n.amount < 0 ? 'neg' : 'pos'}">${esc(U.signed(n.amount, U.money))}</span>` : ''}</li>`).join('');
    return card(s, rows ? `<ul class="feed">${rows}</ul>` : '<div class="empty">Quiet so far.</div>');
  };
  S.stakeholders = (app, s) => {
    const g = app.game;
    const ids = s.ids || Object.keys(app.def.stakeholders);
    const rows = ids.map(id => {
      const d = app.def.stakeholders[id], st = g.state.stakes[id]; if (!d || !st) return '';
      const v = st.value, worse = d.higherIsWorse;
      const tone = (worse ? v > 65 : v < 35) ? 'bad' : (worse ? v < 35 : v > 65) ? 'good' : '';
      const trend = st.target != null ? (st.target > v + 1 ? '↗' : st.target < v - 1 ? '↘' : '→') : '';
      const ths = (d.thresholds || []).map(t => `<i class="th" style="left:${t.below != null ? t.below : t.above}%"></i>`).join('');
      return `<button class="stake ${toneCls(tone)}" data-a="explain:stake:${esc(id)}"><span class="sk-l">${esc(d.label)}</span><span class="sk-bar"><span class="meter ${tone}"><i style="width:${U.clamp(v, 0, 100).toFixed(0)}%"></i>${ths}</span></span><span class="sk-v">${Math.round(v)} <small>${trend}</small></span></button>`;
    }).join('');
    return card(Object.assign({ title: 'Stakeholders' }, s), `<div class="stakes">${rows}</div><p class="hint">Click any bar to see what drives it.</p>`);
  };
  S.resources = (app, s) => {
    const g = app.game, p = g.playerOrg();
    const rows = Object.values(app.def.resources).map(r => `<button class="stake" data-a="explain:resource:${esc(r.id)}"><span class="sk-l">${esc(r.label)}</span><span class="sk-bar">${D.meter(p.res[r.id], r.max || 100)}</span><span class="sk-v">${esc(U.format(p.res[r.id], r.format))}</span></button>`).join('');
    return card(Object.assign({ title: 'Standing' }, s), `<div class="stakes">${rows}</div>`);
  };
  S.world = (app, s) => {
    const g = app.game, w = g.state.world;
    const vars = (s.vars ? s.vars.map(id => app.def.world.vars.find(v => v.id === id)) : app.def.world.vars.filter(v => !v.hidden)).filter(Boolean);
    const ph = w.phaseLabel ? `<div class="phase"><span>Economy</span><b>${esc(w.phaseLabel)}</b><small>Demand ${esc(U.pct((w.demand || 1) - 1, 1))} vs normal · ${esc(U.plural(w.phaseTicks, g.cal.unitLabel))} in</small>${D.sparkline((w.hist.__demand || []).slice(-52), 160, 26)}</div>` : '';
    const vs = vars.map(v => `<div class="wvar" title="${esc(v.explain || '')}"><span>${esc(v.label)}</span><b>${esc(U.format(w.vars[v.id], v.format))}</b>${D.sparkline((w.hist[v.id] || []).slice(-52), 120, 24)}${w.shocks.some(sh => sh.var === v.id) ? '<span class="chip tone-bad">Shock</span>' : ''}</div>`).join('');
    return card(Object.assign({ title: 'The world' }, s), `<div class="world">${ph}${vs}</div>`);
  };
  S.policies = (app, s) => {
    const g = app.game;
    const ids = s.ids || Object.keys(app.def.policies);
    const rows = ids.map(id => {
      const p = app.def.policies[id]; if (!p) return '';
      const cur = g.state.policies[id];
      const opt = p.options.find(o => o.value === cur);
      return `<div class="policy" data-tour="policy:${esc(id)}"><div class="pol-h"><b>${esc(p.label)}</b><small>${esc(p.describe || '')}</small></div><div class="seg">${p.options.map(o => `<button class="${o.value === cur ? 'on' : ''}" data-a="policy:${esc(id)}:${esc(o.value)}" title="${esc(o.describe || '')}">${esc(o.label)}</button>`).join('')}</div>${opt && opt.describe ? `<div class="pol-d">${esc(opt.describe)}</div>` : ''}</div>`;
    }).join('');
    return card(Object.assign({ title: 'Policies — what your teams do automatically' }, s), `<div class="policies">${rows}</div>`);
  };
  /* showcase: one big visual tile per group (e.g. aircraft type) — glyph, headline number,
     meters and stats computed over the group (`group` = the entities in that tile). */
  S.showcase = (app, s) => {
    const g = app.game;
    const list = sortList(app, evalList(app, s), s);
    const sc = g.scope();
    const groups = new Map();
    for (const it of list) { sc.it = it; sc.self = it; const k = String(s.groupBy ? g.ev(s.groupBy, sc) : 'All'); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); }
    let entries = Array.from(groups.entries());
    if (s.groupSort) entries = entries.map(([k, arr]) => { const gs = g.scope({ group: arr, it: arr[0], self: arr[0] }); return [k, arr, g.num(s.groupSort, gs, 0)]; }).sort((a, b) => b[2] - a[2]);
    const tiles = entries.map(([k, arr]) => {
      const gs = g.scope({ group: arr, it: arr[0], self: arr[0], org: g.playerOrg() });
      const glyph = s.glyph ? g.ev(s.glyph, gs) : null;
      const gcol = s.glyphColor ? g.ev(s.glyphColor, gs) : null;
      const big = s.headline ? g.ev(s.headline.expr, gs) : arr.length;
      const meters = (s.meters || []).map(m => { const v = g.num(m.expr, gs, 0); const mx = m.max != null ? g.num(m.max, gs, 1) : 1; const tone = m.tone ? toneCls(g.ev(m.tone, Object.assign(gs, { v }))) : ''; return `<div class="sc-meter"><span>${esc(m.label)}</span>${D.meter(v / (mx || 1) * 100, 100, tone)}<b>${esc(U.format(v, m.format || 'pct'))}</b></div>`; }).join('');
      const stats = (s.stats || []).map(st => { const v = g.ev(st.expr, gs); return `<div><span>${esc(st.label)}</span><b>${esc(fmtv(v, st.format))}</b></div>`; }).join('');
      const dots = s.dots ? `<div class="sc-dots">${arr.slice(0, 60).map(it => { const ds = g.scope({ it, self: it, org: g.playerOrg() }); const t = toneCls(g.ev(s.dots.tone || "'good'", ds)); return `<i class="${t}" data-a="inspect:${esc(entRef(it))}" title="${esc(entTitle(app, it))}"></i>`; }).join('')}${arr.length > 60 ? `<small>+${arr.length - 60}</small>` : ''}</div>` : '';
      const title = s.title_ ? g.tpl(s.title_, gs) : k;
      const act = (s.actions || []).map(aid => { const a = app.def.actions[aid]; return a && g.actionVisible(a, g.playerOrg(), null) ? `<button class="btn xs ghost" data-a="act:${esc(aid)}">${D.icon(a.icon || 'play')}<span>${esc(a.verb || a.label)}</span></button>` : ''; }).join('');
      return `<div class="sc-tile">${glyph ? `<div class="sc-art" ${gcol ? `style="color:${esc(gcol)}"` : ''}>${D.glyph(glyph, null, g.num(s.glyphScale || '1', gs, 1))}</div>` : ''}<div class="sc-head"><b>${esc(title)}</b><span class="sc-big" data-tween="sc:${esc(k)}" data-value="${+big || 0}">${esc(s.headline ? fmtv(big, s.headline.format) : big)}</span>${s.headline && s.headline.label ? `<small>${esc(s.headline.label)}</small>` : ''}</div>${meters}${stats ? `<div class="sc-stats">${stats}</div>` : ''}${dots}${act ? `<div class="ecard-a">${act}</div>` : ''}</div>`;
    }).join('');
    return card(s, entries.length ? `<div class="showcase">${tiles}</div>` : `<div class="empty">${esc(g.tpl(s.empty || 'Nothing here yet.', g.scope()))}</div>`);
  };
  /* mix: composition of a list by a grouping expression, as a donut + legend (share of count or of a weight). */
  S.mix = (app, s) => {
    const g = app.game;
    const list = evalList(app, s);
    const sc = g.scope();
    const m = new Map();
    for (const it of list) { sc.it = it; sc.self = it; const k = String(g.ev(s.groupBy, sc)); const w = s.weight ? g.num(s.weight, sc, 0) : 1; m.set(k, (m.get(k) || 0) + w); }
    const items = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    const total = items.reduce((a, x) => a + x[1], 0) || 1;
    const R = 44, C = 2 * Math.PI * R; let off = 0;
    const arcs = items.map(([k, v], i) => { const len = v / total * C; const el = `<circle r="${R}" cx="60" cy="60" fill="none" class="mix-s s${i % 6}" stroke-width="18" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"><title>${esc(k)}: ${esc(fmtv(v, s.format || 'int'))}</title></circle>`; off += len; return el; }).join('');
    const center = s.center ? g.tpl(s.center, g.scope()) : fmtv(total, s.format || 'int');
    const legend = items.map(([k, v], i) => `<div class="mix-l"><i class="sw s${i % 6}"></i><span>${esc(k)}</span><b>${esc(fmtv(v, s.format || 'int'))}</b><small>${Math.round(v / total * 100)}%</small></div>`).join('');
    return card(s, items.length ? `<div class="mix"><svg viewBox="0 0 120 120" class="donut" role="img" aria-label="${esc(s.title || 'composition')}"><g transform="rotate(-90 60 60)">${arcs}</g><text x="60" y="58" text-anchor="middle" class="donut-v">${esc(center)}</text><text x="60" y="73" text-anchor="middle" class="donut-l">${esc(String(s.centerLabel || 'total').slice(0, 20))}</text></svg><div class="mix-legend">${legend}</div></div>` : `<div class="empty">${esc(s.empty || 'Nothing yet.')}</div>`);
  };
  /* histogram: distribution of a numeric expression across a list, in fixed bins, with tone per bin. */
  S.histogram = (app, s) => {
    const g = app.game;
    const list = evalList(app, s);
    const sc = g.scope();
    const bins = s.bins || [0, 5, 10, 15, 20, 25];
    const counts = bins.map(() => 0);
    for (const it of list) { sc.it = it; sc.self = it; const v = g.num(s.expr, sc, 0); let i = bins.length - 1; while (i > 0 && v < bins[i]) i--; counts[i]++; }
    const mx = Math.max(1, ...counts);
    const cols = counts.map((c, i) => { const lab = i < bins.length - 1 ? `${bins[i]}–${bins[i + 1]}` : `${bins[i]}+`; const tone = s.tone ? toneCls(g.ev(s.tone, g.scope({ v: bins[i] }))) : ''; return `<div class="hist-c ${tone}"><b>${c || ''}</b><i style="height:${(c / mx * 100).toFixed(1)}%"></i><span>${esc(lab)}</span></div>`; }).join('');
    return card(s, `<div class="hist">${cols}</div>${s.unit ? `<div class="hint">${esc(s.unit)}</div>` : ''}`);
  };
  S.rivals = (app, s) => {
    const g = app.game, p = g.playerOrg();
    let orgs = g.liveOrgs().filter(o => !o.isPlayer && o.level < 3);
    orgs.sort((a, b) => (b.m.value || 0) - (a.m.value || 0));
    const cards = orgs.slice(0, s.limit || 12).map(o => {
      const ar = g.archetypeOf(o);
      const riv = g.memory(o, p, 'rivalry');
      return `<button class="rival" data-a="inspect:org:${esc(o.id)}"><div class="rv-h"><i class="dot" style="background:${esc(o.color || 'var(--muted)')}"></i><b>${esc(o.name)}</b>${riv > 6 ? '<span class="chip tone-bad">Rival</span>' : ''}</div><small>${esc(ar ? ar.label : '')}${o.level === 2 ? ' · smaller player' : ''}</small><div class="rv-stats">${(s.stats || [{ label: 'Value', expr: 'org.m.value', format: 'money' }]).map(st => `<span><small>${esc(st.label)}</small><b>${esc(U.format(g.ev(st.expr, g.scope({ org: o })), st.format))}</b></span>`).join('')}</div></button>`;
    }).join('');
    const bg = g.liveOrgs().filter(o => o.level === 3).length;
    return card(Object.assign({ title: 'Competitors' }, s), `<div class="rivals">${cards}</div>${bg ? `<p class="hint">Plus ${bg} smaller ${esc(app.def.orgs.plural.toLowerCase())} competing in the background.</p>` : ''}`);
  };
  S.text = (app, s) => card(s, `<div class="prose">${esc(app.game.tpl(s.text || '', app.game.scope())).replace(/\n/g, '<br>')}</div>`);
  S.negotiations = (app, s) => {
    const g = app.game;
    const list = Object.values(g.state.negotiations).filter(n => n.org === g.state.player);
    return card(Object.assign({ title: 'Open negotiations' }, s), list.length ? list.map(n => `<button class="need" data-a="negotiation:${esc(n.id)}"><span class="need-ic">${D.icon('handshake')}</span><span class="need-t"><b>${esc(n.label)} — ${esc(n.withName)}</b><small>${esc(n.status === 'countered' ? 'They countered' : 'Make an offer')}</small></span></button>`).join('') : '<div class="empty">No open talks.</div>');
  };
  S.records = (app, s) => {
    const g = app.game, R = g.state.history.records;
    const rows = Object.entries(R).map(([id, r]) => `<tr class="${r.isPlayer ? 'mine' : ''}"><td>${esc(r.label)}</td><td class="r">${esc(U.format(r.value, r.format))}</td><td>${esc(r.who)}</td><td>${esc(g.cal.shortLabel(r.t))} ${esc(String(g.cal.yearOf(r.t)))}</td></tr>`).join('');
    return card(Object.assign({ title: 'Record book' }, s), rows ? `<table class="tbl"><tr><th>Record</th><th class="r">Mark</th><th>Holder</th><th>Set</th></tr>${rows}</table>` : '<div class="empty">No records yet.</div>');
  };
  S.awards = (app, s) => {
    const g = app.game, A = g.state.history.awards;
    const rows = A.slice(0, s.limit || 30).map(a => `<tr class="${a.isPlayer ? 'mine' : ''}"><td>${a.year}</td><td>${esc(a.label)}</td><td>${esc(a.winner)}</td></tr>`).join('');
    return card(Object.assign({ title: 'Awards' }, s), rows ? `<table class="tbl"><tr><th>Year</th><th>Award</th><th>Winner</th></tr>${rows}</table>` : '<div class="empty">The first awards are handed out at year end.</div>');
  };
  S.timeline = (app, s) => {
    const g = app.game, T = g.state.history.timeline;
    const rows = T.slice(0, s.limit || 60).map(t => `<li class="tl-${esc(t.tag)}"><span class="tl-d">${esc(g.cal.label(t.t))}</span><span class="tl-t">${esc(t.text)}</span></li>`).join('');
    return card(Object.assign({ title: 'Timeline' }, s), rows ? `<ul class="timeline">${rows}</ul>` : '<div class="empty">History starts now.</div>');
  };
  S.milestones = (app, s) => {
    const g = app.game, M = g.state.history.milestones;
    const all = app.def.history.milestones || [];
    const rows = all.map(m => `<div class="ms ${M[m.id] != null ? 'got' : ''}">${D.icon(M[m.id] != null ? 'star' : 'target')}<div><b>${esc(m.label)}</b><small>${M[m.id] != null ? esc(g.cal.label(M[m.id])) : 'Not yet'}</small></div></div>`).join('');
    return card(Object.assign({ title: 'Milestones' }, s), `<div class="milestones">${rows}</div>`);
  };
  S.antiPortfolio = (app, s) => {
    const g = app.game, A = g.state.history.anti;
    const rows = A.slice(0, 20).map(a => `<li><span class="fd">${esc(g.cal.shortLabel(a.t))}</span><span class="ft">${esc(a.text)}${a.valueNow != null ? ` — a year later: ${esc(U.num(a.valueNow))}` : ''}</span></li>`).join('');
    return card(Object.assign({ title: 'Roads not taken' }, s), rows ? `<ul class="feed">${rows}</ul>` : '<div class="empty">Opportunities you decline are remembered here.</div>');
  };
  S.annual = (app, s) => {
    const g = app.game, A = g.state.history.annual;
    const rows = A.slice(0, 30).map(r => `<tr><td>${r.year}</td><td class="r">${esc(U.money(r.revenue))}</td><td class="r ${r.profit < 0 ? 'neg' : ''}">${esc(U.money(r.profit))}</td><td class="r">${esc(U.money(r.value))}</td><td class="r">#${r.rank} of ${r.of}</td></tr>`).join('');
    return card(Object.assign({ title: 'Year by year' }, s), rows ? `<table class="tbl"><tr><th>Year</th><th class="r">Revenue</th><th class="r">Profit</th><th class="r">Value</th><th class="r">Rank</th></tr>${rows}</table>` : '<div class="empty">Your first annual review comes at year end.</div>');
  };

  /* ---------------- defaults (used when a definition omits ui) ---------------- */
  E.ui.defaultNav = (app) => {
    const nav = [{ id: 'home', label: 'Overview', icon: 'home' }];
    for (const k of app.def.kindOrder) { const kd = app.def.kinds[k]; if (kd.records && !kd.operate) continue; if (kd.operate || Object.values(app.def.actions).some(a => a.kind === k)) nav.push({ id: 'k-' + k, label: kd.plural, icon: kd.icon || 'layers' }); if (nav.length >= 5) break; }
    nav.push({ id: 'market', label: 'Market', icon: 'globe' }, { id: 'company', label: 'Company', icon: 'bank' });
    return nav.slice(0, 7);
  };
  E.ui.defaultHome = (app) => ({ title: '{player.name}', subtitle: '{date()}', actions: Object.values(app.def.actions).filter(a => a.primary).map(a => a.id).slice(0, 3),
    sections: [{ type: 'goal', width: 'full' }, { type: 'needs', width: 'half' }, { type: 'metrics', width: 'half', items: [{ label: 'Cash', expr: 'player.cash', format: 'money' }, { label: 'Profit (year)', expr: 'player.m.profitYear', format: 'money' }, { label: 'Company value', expr: 'player.m.value', format: 'money' }] }, { type: 'objectives', width: 'half' }, { type: 'upcoming', width: 'half' }, { type: 'feed', title: 'Latest', width: 'full', limit: 6 }] });
  E.ui.defaultScreens = (app) => {
    const out = { home: E.ui.defaultHome(app) };
    for (const k of app.def.kindOrder) {
      const kd = app.def.kinds[k];
      const cols = [{ label: 'Name', expr: 'it.name' }].concat(Object.entries(kd.fields).filter(([f, fd]) => !['ref', 'refs', 'text'].includes(fd.type)).slice(0, 4).map(([f, fd]) => ({ label: fd.label, expr: 'it.' + f, format: fd.type === 'money' ? 'money' : fd.type === 'pct' ? 'pct' : 'num' })));
      if (kd.operate) cols.push({ label: 'Profit', expr: 'it._profit', format: 'money' });
      out['k-' + k] = { title: kd.plural, actions: Object.values(app.def.actions).filter(a => a.scope === 'global' && (a.effects || []).some(e => e.kind === k)).map(a => a.id), sections: [{ type: 'table', kind: k, owner: kd.records ? undefined : 'player', columns: cols, rowActions: Object.values(app.def.actions).filter(a => a.kind === k).map(a => a.id).slice(0, 3), search: true }] };
    }
    out.market = { title: 'Market', sections: [{ type: 'world', width: 'half' }, { type: 'rankings', title: 'Most valuable', metric: 'org.m.value', format: 'money', width: 'half' }, { type: 'rivals', width: 'full' }] };
    out.company = { title: 'Company', sections: [{ type: 'ledger', width: 'half' }, { type: 'finance', width: 'half' }, { type: 'stakeholders', width: 'half' }, { type: 'policies', width: 'half' }] };
    return out;
  };
  E.ui.historyScreen = (app) => {
    const tabs = [['story', 'Story'], ['records', 'Records & awards'], ['news', 'News archive'], ['money', 'Transactions']];
    const cur = app.route.tab || 'story';
    let secs;
    if (cur === 'records') secs = [{ type: 'records', width: 'half' }, { type: 'awards', width: 'half' }, { type: 'milestones', width: 'full' }];
    else if (cur === 'news') secs = [{ type: 'feed', title: 'All news', limit: 200, includeBackground: true, width: 'full' }];
    else if (cur === 'money') secs = [{ type: 'feed', title: 'Transactions', source: 'transactions', limit: 200, width: 'half' }, { type: 'feed', title: 'Deals', source: 'deals', limit: 100, width: 'half' }];
    else secs = [{ type: 'annual', width: 'full' }, { type: 'timeline', width: 'half' }, { type: 'antiPortfolio', width: 'half' }];
    const body = secs.map(s => S[s.type](app, s)).join('');
    return `<div class="screen screen-history"><div class="screen-head"><div><h1>History</h1><p class="sub">Everything the world remembers about you.</p></div></div><div class="tabs">${tabs.map(([id, l]) => `<button class="tab ${cur === id ? 'on' : ''}" data-a="tab:${id}">${l}</button>`).join('')}</div><div class="grid">${body}</div></div>`;
  };
  E.ui.inputHandlers.search = (app, rest, el) => { app.ui.search[rest[0]] = el.value; app.ui.tablePage[rest[0]] = 0; app.ui.focusSel = `[data-input="search:${rest[0]}"]`; clearTimeout(app._st); app._st = setTimeout(() => { app.rerender(); const i = D.$(`[data-input="search:${rest[0]}"]`, app.root); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 180); };
})(globalThis.LGE = globalThis.LGE || {});
