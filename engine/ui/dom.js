/* Local Game Studio engine — UI helpers: escaping, icons, glyphs, charts, tweening. No framework. */
(function (E) {
  'use strict';
  const U = E.util;
  const D = {};
  D.esc = U.esc;
  D.$ = (sel, root) => (root || document).querySelector(sel);
  D.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  D.attr = (v) => U.esc(v == null ? '' : String(v));

  /* 24px line icons (stroke = currentColor) */
  const P = {
    home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
    route: 'M5 19c4-9 10-9 14-14M5 19a2 2 0 1 0 0-.01M19 5a2 2 0 1 0 0-.01',
    plane: 'M2 13l8-2 4-8h2l-2 8 6 1 2-3h2l-1 5 1 5h-2l-2-3-6 1 2 8h-2l-4-8-8-2z',
    hub: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M12 3v6M12 15v6M3 12h6M15 12h6M5.6 5.6l4.2 4.2M14.2 14.2l4.2 4.2M5.6 18.4l4.2-4.2M14.2 9.8l4.2-4.2',
    globe: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
    chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    bank: 'M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18',
    users: 'M9 11a3 3 0 1 0 0-6a3 3 0 0 0 0 6M3 20c0-3 3-5 6-5s6 2 6 5M16 5a3 3 0 0 1 0 6M18 15c2 .5 3 2.5 3 5',
    history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3',
    settings: 'M12 15a3 3 0 1 0 0-6a3 3 0 0 0 0 6M19 12l2-1-1-3-2 .2-1.3-1.3L17 5l-3-1-1 2h-2l-1-2-3 1 .3 2.2L6 8.2 4 8l-1 3 2 1v1l-2 1 1 3 2-.2 1.3 1.3L7 19l3 1 1-2h2l1 2 3-1-.3-2.2 1.3-1.3 2 .2 1-3-2-1z',
    save: 'M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-7h8v7',
    gavel: 'M14 4l6 6M11 7l6 6M13 5l-6 6 4 4 6-6M9 13l-6 6',
    bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
    tag: 'M3 12V4h8l10 10-8 8zM7.5 8a1 1 0 1 0 0-.01',
    plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', close: 'M6 6l12 12M18 6L6 18', up: 'M12 19V5M5 12l7-7 7 7', down: 'M12 5v14M5 12l7 7 7-7',
    key: 'M15 9a4 4 0 1 0-4 4l-8 8M7 17l2 2M9 15l2 2', factory: 'M3 21V10l6 4V10l6 4V6l6 4v11z',
    seat: 'M7 4v10h10M7 14l-2 7M17 14l2 7M7 9h7', megaphone: 'M3 10v4h4l8 5V5L7 10zM18 9a4 4 0 0 1 0 6',
    handshake: 'M2 11l5-5 5 4 5-4 5 5-6 6-4-3-4 3z', merge: 'M6 3v6c0 4 6 5 6 9v3M18 3v6c0 4-6 5-6 9',
    news: 'M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v9a1 1 0 0 1-2 0V9M8 9h5M8 13h5', star: 'M12 3l3 6 6 1-4.5 4.5 1 6.5L12 18l-5.5 3 1-6.5L3 10l6-1z',
    trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H4a3 3 0 0 0 4 4M16 6h4a3 3 0 0 1-4 4M12 13v4M8 21h8M10 17h4v4h-4z', calendar: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5',
    search: 'M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14M21 21l-5-5', play: 'M7 4l13 8-13 8z', pause: 'M7 4h3v16H7zM14 4h3v16h-3z', ff: 'M3 5l9 7-9 7zM12 5l9 7-9 7z',
    alert: 'M12 3l10 18H2zM12 10v5M12 18v.01', info: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18M12 11v6M12 7v.01', check: 'M4 12l5 5L20 6',
    menu: 'M4 6h16M4 12h16M4 18h16', briefcase: 'M3 8h18v12H3zM8 8V5h8v3M3 13h18', building: 'M4 21V4h10v17M14 9h6v12M7 8h2M7 12h2M7 16h2M17 13h1M17 17h1',
    film: 'M4 4h16v16H4zM8 4v16M16 4v16M4 8h4M4 12h4M4 16h4M16 8h4M16 12h4M16 16h4', ticket: 'M3 7h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4z',
    dish: 'M3 16h18M5 16a7 7 0 0 1 14 0M12 6v3', user: 'M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8M4 21c0-4 4-6 8-6s8 2 8 6', target: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8',
    shield: 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z', airport: 'M4 20h16M7 20V9h10v11M10 9V5h4v4M9 13h6', compass: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18M15 9l-2 5-5 2 2-5z',
    wrench: 'M14 7a4 4 0 0 0 5 5l-9 9-3-3 9-9a4 4 0 0 0-2-2z', fuel: 'M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h14M15 9h2l2 2v6a1 1 0 0 0 2 0V8l-3-3',
    help: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17v.01', download: 'M12 4v12M6 10l6 6 6-6M4 20h16', upload: 'M12 20V8M6 14l6-6 6 6M4 4h16',
    copy: 'M8 8h12v12H8zM4 16V4h12', edit: 'M4 20h4L20 8l-4-4L4 16z', trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12M12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6',
    layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5', map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15'
  };
  D.icon = (name, cls = '') => {
    const d = P[name] || P.info;
    return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  };
  D.iconNames = Object.keys(P);

  /* Entity glyphs: larger illustrative silhouettes for cards (filled, currentColor). */
  const G = {
    'plane-turboprop': { w: 140, h: 48, d: 'M8 26c0-5 6-8 14-8h86l14-12h7l-5 14h8c3 0 5 3 5 6s-2 6-5 6H22c-8 0-14-1-14-6zM46 15h40v3H46zM56 12h8v6h-8zM40 9h3v16h-3zM54 28h12l4 9h-6z' },
    'plane-regional': { w: 140, h: 48, d: 'M6 27c0-5 7-8 15-8h88l14-13h7l-5 15h7c3 0 5 3 5 6s-2 6-5 6H21C13 33 6 32 6 27zM97 16h14v5H97zM48 30h26l8 10h-9zM50 31h12v6H50z' },
    'plane-narrowbody': { w: 160, h: 52, d: 'M5 29c0-6 8-9 17-9h104l16-15h8l-6 17h8c3 0 6 3 6 6s-3 6-6 6H22c-9 0-17-1-17-5zM52 33h34l10 12h-10zM58 36h14c2 0 3 2 3 4s-1 3-3 3H58zM20 24h4v3h-4zM30 24h90v2H30z' },
    'plane-widebody': { w: 180, h: 60, d: 'M5 34c0-8 10-12 21-12h118l18-18h9l-7 20h9c4 0 7 4 7 8s-3 8-7 8H26C15 40 5 39 5 34zM56 40h42l12 15H98zM60 43h17c3 0 4 3 4 5s-1 4-4 4H60zM84 41h15c2 0 3 2 3 4s-1 3-3 3H84zM22 27h5v4h-5zM34 27h104v2H34z' },
    'plane-jumbo': { w: 200, h: 66, d: 'M5 38c0-9 10-14 22-14h10c4-8 14-12 30-12h28c8 0 12 3 14 6h52l20-20h10l-8 22h10c4 0 8 4 8 9s-4 9-8 9H27C15 47 5 46 5 38zM62 46h48l14 16h-13zM66 49h18c3 0 4 3 4 5s-1 4-4 4H66zM92 47h16c3 0 4 3 4 5s-1 4-4 4H92zM40 20h4v3h-4zM26 30h5v4h-5zM38 30h112v2H38z' },
    building: { w: 80, h: 80, d: 'M10 74V18l30-12 30 12v56zM20 28h10v10H20zM50 28h10v10H50zM20 48h10v10H20zM50 48h10v10H50zM34 58h12v16H34z' },
    person: { w: 64, h: 80, d: 'M32 6a14 14 0 1 1 0 28a14 14 0 0 1 0-28M6 76c0-18 12-28 26-28s26 10 26 28z' },
    star: { w: 80, h: 80, d: 'M40 4l11 24 26 3-19 18 5 26-23-13-23 13 5-26L3 31l26-3z' },
    ticket: { w: 100, h: 60, d: 'M4 8h92v14a8 8 0 0 0 0 16v14H4V38a8 8 0 0 0 0-16z' },
    dish: { w: 100, h: 60, d: 'M6 46h88v6H6zM12 44a38 34 0 0 1 76 0zM46 8h8v6h-8z' },
    tower: { w: 60, h: 90, d: 'M22 86V20l8-14 8 14v66zM14 86V40h8v46zM38 86V34h8v52z' },
    hub: { w: 80, h: 80, d: 'M40 30a10 10 0 1 1 0 20a10 10 0 0 1 0-20M40 4v22M40 54v22M4 40h22M54 40h22' },
    route: { w: 120, h: 50, d: 'M8 40C40 4 80 4 112 40M8 40a5 5 0 1 0 0 .1M112 40a5 5 0 1 0 0 .1' },
    film: { w: 90, h: 70, d: 'M6 8h78v54H6zM16 8v54M74 8v54' },
    chart: { w: 90, h: 70, d: 'M8 62V36h12v26zM28 62V20h12v42zM48 62V30h12v32zM68 62V8h12v54z' }
  };
  D.glyph = (name, color, scale = 1, cls = '') => {
    const g = G[name] || G.star;
    return `<svg class="glyph ${cls}" viewBox="0 0 ${g.w} ${g.h}" width="${Math.round(g.w * scale)}" height="${Math.round(g.h * scale)}" aria-hidden="true"><path d="${g.d}" fill="${color || 'currentColor'}"/></svg>`;
  };
  D.glyphNames = Object.keys(G);
  D.registerGlyph = (name, w, h, d) => { G[name] = { w, h, d }; };

  /* Charts (SVG) */
  D.sparkline = (vals, w = 110, h = 28, cls = '') => {
    vals = (vals || []).filter(v => Number.isFinite(v));
    if (vals.length < 2) return `<svg class="spark ${cls}" width="${w}" height="${h}"></svg>`;
    const mn = Math.min(...vals), mx = Math.max(...vals), r = mx - mn || 1;
    const pts = vals.map((v, i) => `${(i / (vals.length - 1) * (w - 2) + 1).toFixed(1)},${(h - 2 - (v - mn) / r * (h - 4)).toFixed(1)}`).join(' ');
    const zero = mn < 0 && mx > 0 ? `<line x1="0" x2="${w}" y1="${(h - 2 - (0 - mn) / r * (h - 4)).toFixed(1)}" y2="${(h - 2 - (0 - mn) / r * (h - 4)).toFixed(1)}" class="spark-zero"/>` : '';
    const last = vals[vals.length - 1], tone = last >= vals[0] ? 'up' : 'down';
    return `<svg class="spark ${tone} ${cls}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${zero}<polyline points="${pts}" fill="none"/></svg>`;
  };
  D.lineChart = (series, opts = {}) => {
    const w = opts.w || 640, h = opts.h || 200, pad = { l: 56, r: 12, t: 12, b: 24 };
    const all = series.flatMap(s => s.values.filter(Number.isFinite));
    if (all.length < 2) return `<div class="chart-empty">History builds as time passes.</div>`;
    let mn = Math.min(...all), mx = Math.max(...all);
    if (opts.zero !== false && mn > 0) mn = 0;
    if (mx === mn) mx = mn + 1;
    const n = Math.max(...series.map(s => s.values.length));
    const X = i => pad.l + i / Math.max(1, n - 1) * (w - pad.l - pad.r);
    const Y = v => pad.t + (1 - (v - mn) / (mx - mn)) * (h - pad.t - pad.b);
    const fmt = opts.fmt || U.num;
    const ticks = [mn, mn + (mx - mn) / 2, mx];
    let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${D.attr(opts.label || 'chart')}">`;
    for (const t of ticks) s += `<line class="grid" x1="${pad.l}" x2="${w - pad.r}" y1="${Y(t)}" y2="${Y(t)}"/><text class="axis" x="${pad.l - 6}" y="${Y(t) + 4}" text-anchor="end">${D.esc(fmt(t))}</text>`;
    if (mn < 0 && mx > 0) s += `<line class="zero" x1="${pad.l}" x2="${w - pad.r}" y1="${Y(0)}" y2="${Y(0)}"/>`;
    series.forEach((se, si) => {
      const pts = se.values.map((v, i) => Number.isFinite(v) ? `${X(i).toFixed(1)},${Y(v).toFixed(1)}` : null).filter(Boolean).join(' ');
      if (opts.area && si === 0) s += `<polygon class="area s${si}" points="${X(0)},${Y(Math.max(mn, 0))} ${pts} ${X(se.values.length - 1)},${Y(Math.max(mn, 0))}"/>`;
      s += `<polyline class="line s${si}" points="${pts}" fill="none" ${se.color ? `style="stroke:${se.color}"` : ''}/>`;
    });
    if (opts.labels) s += `<text class="axis" x="${pad.l}" y="${h - 6}">${D.esc(opts.labels[0] || '')}</text><text class="axis" x="${w - pad.r}" y="${h - 6}" text-anchor="end">${D.esc(opts.labels[1] || '')}</text>`;
    s += '</svg>';
    const legend = series.length > 1 ? `<div class="legend">${series.map((se, i) => `<span><i class="sw s${i}" ${se.color ? `style="background:${se.color}"` : ''}></i>${D.esc(se.label)}</span>`).join('')}</div>` : '';
    return `<div class="chart-wrap">${s}${legend}</div>`;
  };
  D.bars = (items, opts = {}) => {
    const mx = Math.max(1e-9, ...items.map(i => Math.abs(i.value)));
    return `<div class="bars">${items.map(i => `<div class="bar-row"><span class="bar-l">${D.esc(i.label)}</span><span class="bar-t"><i class="${i.value < 0 ? 'neg' : 'pos'}" style="width:${(Math.abs(i.value) / mx * 100).toFixed(1)}%"></i></span><span class="bar-v">${D.esc((opts.fmt || U.num)(i.value))}</span></div>`).join('')}</div>`;
  };
  D.meter = (v, max = 100, cls = '') => `<span class="meter ${cls}"><i style="width:${U.clamp(v / max * 100, 0, 100).toFixed(1)}%"></i></span>`;

  /* Animated number transitions for elements marked data-tween="key" data-value="123" data-fmt="money" */
  const last = new Map();
  D.tween = (root) => {
    if (typeof window === 'undefined') return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const el of D.$$('[data-tween]', root)) {
      const key = el.getAttribute('data-tween'), to = +el.getAttribute('data-value'), fmt = el.getAttribute('data-fmt') || 'num';
      const from = last.get(key);
      last.set(key, to);
      if (reduce || from == null || !Number.isFinite(from) || from === to) continue;
      el.classList.add(to > from ? 'tick-up' : 'tick-down');
      const t0 = performance.now(), dur = 650;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = U.format(from + (to - from) * e, fmt);
        if (k < 1) requestAnimationFrame(step); else { el.textContent = U.format(to, fmt); setTimeout(() => el.classList.remove('tick-up', 'tick-down'), 600); }
      };
      requestAnimationFrame(step);
    }
  };

  /* Equirectangular projection fitted to a set of points */
  D.projector = (pts, w, h, padFrac = 0.08, world = false) => {
    let minLon = -170, maxLon = 190, minLat = -58, maxLat = 78;
    if (!world && pts.length) {
      minLon = Math.min(...pts.map(p => p.lon)); maxLon = Math.max(...pts.map(p => p.lon));
      minLat = Math.min(...pts.map(p => p.lat)); maxLat = Math.max(...pts.map(p => p.lat));
      // keep a minimum geographic span so small networks still show coastlines and context
      const cx = (minLon + maxLon) / 2, cy = (minLat + maxLat) / 2;
      const dx = Math.max(46, (maxLon - minLon) * (1 + padFrac * 2)), dy = Math.max(26, (maxLat - minLat) * (1 + padFrac * 2));
      minLon = cx - dx / 2; maxLon = cx + dx / 2; minLat = Math.max(-60, cy - dy / 2); maxLat = Math.min(80, cy + dy / 2);
    }
    const sx = w / (maxLon - minLon), sy = h / (maxLat - minLat), s = Math.min(sx, sy * 1.25);
    const ox = (w - (maxLon - minLon) * s) / 2, oy = (h - (maxLat - minLat) * s / 1.25) / 2;
    return { x: lon => ox + (lon - minLon) * s, y: lat => oy + (maxLat - lat) * s / 1.25, bounds: { minLon, maxLon, minLat, maxLat } };
  };

  E.dom = D;
  E.ui = E.ui || {};
  E.ui.handlers = E.ui.handlers || {};
  E.ui.changeHandlers = E.ui.changeHandlers || {};
  E.ui.inputHandlers = E.ui.inputHandlers || {};
})(globalThis.LGE = globalThis.LGE || {});
