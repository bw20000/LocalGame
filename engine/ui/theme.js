/* Local Game Studio engine — visual identity: CSS tokens, motif classes, logo mark. */
(function (E) {
  'use strict';
  const U = E.util, D = E.dom;
  E.ui = E.ui || {};
  const DEFAULTS = {
    light: { bg: '#f4f1ea', surface: '#fffdf8', surface2: '#f0ebe0', ink: '#1d1c1a', ink2: '#3d3a35', muted: '#77716a', line: '#ddd5c6', accent: '#1f4e79', accentInk: '#ffffff', accent2: '#c8892b', good: '#2e7d4f', bad: '#b3412e', warn: '#b7791f', info: '#2f6690' },
    dark: { bg: '#101215', surface: '#171a1f', surface2: '#1f232a', ink: '#eceae6', ink2: '#c9c6c0', muted: '#8d939c', line: '#2b3038', accent: '#e0a43b', accentInk: '#16130c', accent2: '#5aa0d6', good: '#5cbf86', bad: '#e2725b', warn: '#e3b04b', info: '#6fa8dc' }
  };
  const FONT = {
    sans: '-apple-system, BlinkMacSystemFont, "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    serif: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
    didone: 'Didot, "Bodoni 72", "Bodoni MT", "Playfair Display", Georgia, serif',
    condensed: '"Avenir Next Condensed", "DIN Condensed", "Roboto Condensed", "Arial Narrow", sans-serif',
    geometric: 'Futura, "Century Gothic", "Avenir Next", "Trebuchet MS", sans-serif',
    humanist: '"Gill Sans", "Gill Sans MT", Optima, Candara, "Segoe UI", sans-serif',
    slab: 'Rockwell, "Roboto Slab", "American Typewriter", Georgia, serif',
    typewriter: '"American Typewriter", "Courier Prime", Courier, monospace',
    mono: '"SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", monospace',
    board: '"SF Mono", "Menlo", "DIN Condensed", Consolas, monospace'
  };
  E.ui.FONTS = FONT;
  E.ui.applyTheme = (theme, prefs = {}) => {
    if (typeof document === 'undefined') return;
    const mode = prefs.mode || theme.mode || 'light';
    const base = DEFAULTS[mode === 'dark' ? 'dark' : 'light'];
    const pal = Object.assign({}, base, (mode === 'dark' ? theme.paletteDark : theme.palette) || theme.palette || {});
    const r = document.documentElement.style;
    const map = { bg: '--bg', surface: '--surface', surface2: '--surface-2', ink: '--ink', ink2: '--ink-2', muted: '--muted', line: '--line', accent: '--accent', accentInk: '--accent-ink', accent2: '--accent-2', good: '--good', bad: '--bad', warn: '--warn', info: '--info', band: '--band', bandInk: '--band-ink' };
    for (const [k, v] of Object.entries(map)) if (pal[k]) r.setProperty(v, pal[k]);
    if (!pal.band) r.setProperty('--band', pal.ink); if (!pal.bandInk) r.setProperty('--band-ink', pal.bg);
    const f = theme.fonts || {};
    r.setProperty('--font-display', FONT[f.display] || f.display || FONT.serif);
    r.setProperty('--font-body', FONT[f.body] || f.body || FONT.sans);
    r.setProperty('--font-mono', FONT[f.mono] || f.mono || FONT.mono);
    r.setProperty('--radius', (theme.radius != null ? theme.radius : 6) + 'px');
    const body = document.body;
    body.className = body.className.split(' ').filter(c => !/^(motif-|mode-|tex-|lg-)/.test(c)).join(' ');
    body.classList.add('lg-game', 'motif-' + (theme.motif || 'none'), 'mode-' + mode, 'tex-' + (theme.texture || 'none'));
    if (prefs.textSize === 'large') body.classList.add('lg-large');
    document.title = theme.title || document.title;
  };
  E.ui.logo = (gdl, small) => {
    const t = gdl.theme || {}, l = t.logo || {};
    const txt = l.text || U.initials((gdl.meta && gdl.meta.title) || 'G');
    const shape = l.shape || 'roundel';
    const s = small ? 34 : 88;
    if (l.glyph && D.glyphNames.includes(l.glyph)) return `<span class="logo-mark ${small ? 'sm' : ''} shape-${shape}">${D.glyph(l.glyph, 'currentColor', small ? 0.26 : 0.7)}</span>`;
    return `<span class="logo-mark ${small ? 'sm' : ''} shape-${shape}" style="width:${s}px;height:${s}px"><b>${U.esc(txt)}</b></span>`;
  };
  E.ui.badge = (app, expr) => {
    const v = app.game.ev(expr, app.game.scope(), 0);
    return v ? `<i class="nav-badge">${U.esc(typeof v === 'number' ? (v > 99 ? '99+' : v) : '!')}</i>` : '';
  };
})(globalThis.LGE = globalThis.LGE || {});
