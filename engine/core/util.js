/* Local Game Studio engine — formatting, calendar, names. Pure functions, no DOM. */
(function (E) {
  'use strict';
  const U = {};
  U.clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
  U.finite = (x, d = 0) => (Number.isFinite(x) ? x : d);
  U.round = (x, d = 0) => { const m = Math.pow(10, d); return Math.round(x * m) / m; };
  U.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'game';
  U.deepClone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  U.uniq = (arr) => [...new Set(arr)];
  U.sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + (+f(x) || 0), 0);
  U.byKey = (arr, k = 'id') => Object.fromEntries(arr.map(x => [x[k], x]));
  U.cap1 = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
  U.plural = (n, w, pl) => `${U.num(n)} ${Math.abs(n) === 1 ? w : (pl || (w.endsWith('y') && !/[aeiou]y$/.test(w) ? w.slice(0, -1) + 'ies' : w + 's'))}`;

  let currency = { symbol: '$', suffix: '' };
  U.setCurrency = (c) => { currency = Object.assign({ symbol: '$', suffix: '' }, c || {}); };
  function compact(v, digits) {
    const a = Math.abs(v);
    if (a >= 1e12) return (v / 1e12).toFixed(digits ?? (a >= 1e13 ? 1 : 2)).replace(/\.0+$/, '') + 'T';
    if (a >= 1e9) return (v / 1e9).toFixed(digits ?? (a >= 1e10 ? 1 : 2)).replace(/\.0+$/, '') + 'B';
    if (a >= 1e6) return (v / 1e6).toFixed(digits ?? (a >= 1e7 ? 1 : 2)).replace(/\.0+$/, '') + 'M';
    if (a >= 1e4) return (v / 1e3).toFixed(digits ?? (a >= 1e5 ? 0 : 1)).replace(/\.0+$/, '') + 'K';
    return a >= 100 ? Math.round(v).toLocaleString('en-US') : (Math.round(v * 100) / 100).toLocaleString('en-US');
  }
  U.money = (v, d) => { v = +v; if (!Number.isFinite(v)) return '—'; return (v < 0 ? '−' : '') + currency.symbol + compact(Math.abs(v), d) + currency.suffix; };
  U.moneyFull = (v) => { v = +v; if (!Number.isFinite(v)) return '—'; return (v < 0 ? '−' : '') + currency.symbol + Math.round(Math.abs(v)).toLocaleString('en-US'); };
  U.num = (v, d) => { v = +v; if (!Number.isFinite(v)) return '—'; if (d != null) return v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }); return (v < 0 ? '−' : '') + compact(Math.abs(v)); };
  U.int = (v) => { v = +v; return Number.isFinite(v) ? Math.round(v).toLocaleString('en-US') : '—'; };
  U.pct = (v, d = 0) => { v = +v; if (!Number.isFinite(v)) return '—'; return (v * 100).toFixed(d) + '%'; };
  U.signed = (v, f = U.num) => { v = +v; if (!Number.isFinite(v)) return '—'; return (v > 0 ? '+' : v < 0 ? '−' : '±') + f(Math.abs(v)); };
  U.signedPct = (v, d = 1) => U.signed(v, (x) => U.pct(x, d));
  U.score = (v) => { v = +v; return Number.isFinite(v) ? String(Math.round(v)) : '—'; };
  U.format = (v, fmt) => {
    switch (fmt) {
      case 'money': return U.money(v);
      case 'moneyFull': return U.moneyFull(v);
      case 'pct': return U.pct(v);
      case 'pct1': return U.pct(v, 1);
      case 'int': return U.int(v);
      case 'score': return U.score(v);
      case 'signedMoney': return U.signed(v, U.money);
      case 'signedPct': return U.signedPct(v);
      case 'x': return (Number.isFinite(+v) ? (+v).toFixed(2) + '×' : '—');
      case 'km': return U.int(v) + ' km';
      case 'text': return v == null ? '' : String(v);
      case 'bool': return v ? 'Yes' : 'No';
      case 'date': return v;
      default:
        if (typeof v === 'number') return U.num(v);
        if (typeof v === 'boolean') return v ? 'Yes' : 'No';
        if (v && typeof v === 'object') return v.name != null ? v.name : '';
        return v == null ? '—' : String(v);
    }
  };

  /* Calendar: ticks are days, weeks or months from a start date. */
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  U.MONTHS = MONTHS;
  U.makeCalendar = (time) => {
    const unit = (time && time.unit) || 'week';
    const perYear = (time && time.perYear) || (unit === 'month' ? 12 : unit === 'day' ? 365 : 52);
    const start = new Date(((time && time.start) || '2026-01-05') + 'T12:00:00Z');
    function dateOf(tick) {
      const d = new Date(start.getTime());
      if (unit === 'month') d.setUTCMonth(d.getUTCMonth() + tick);
      else if (unit === 'day') d.setUTCDate(d.getUTCDate() + tick);
      else d.setUTCDate(d.getUTCDate() + 7 * tick);
      return d;
    }
    return {
      unit, perYear,
      dateOf,
      yearOf: (t) => start.getUTCFullYear() + Math.floor(t / perYear),
      startYear: start.getUTCFullYear(),
      monthOf: (t) => dateOf(t).getUTCMonth() + 1,
      label: (t) => { const d = dateOf(t); return unit === 'month' ? `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; },
      longLabel: (t) => { const d = dateOf(t); return unit === 'month' ? `${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}` : `${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; },
      shortLabel: (t) => { const d = dateOf(t); return unit === 'month' ? `${MONTHS[d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(2)}` : `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`; },
      isYearEnd: (t) => (t + 1) % perYear === 0,
      isYearStart: (t) => t % perYear === 0,
      tickOfYear: (t) => t % perYear,
      ticksPerMonth: perYear / 12,
      unitLabel: unit === 'month' ? 'month' : unit === 'day' ? 'day' : 'week'
    };
  };

  /* Fictional names. Mixed-culture pools; combined so collisions with real people are unlikely and never intentional. */
  const FIRST = ['Ada', 'Amara', 'Anika', 'Beatriz', 'Camille', 'Chiara', 'Dalia', 'Elena', 'Freya', 'Grace', 'Hana', 'Imani', 'Ines', 'Jun', 'Keira', 'Leila', 'Lucia', 'Maya', 'Mei', 'Nadia', 'Noor', 'Olivia', 'Priya', 'Rosa', 'Saoirse', 'Sofia', 'Talia', 'Valentina', 'Yara', 'Zara',
    'Adrian', 'Ahmed', 'Andre', 'Arjun', 'Benedikt', 'Caleb', 'Dario', 'Elias', 'Felix', 'Gabriel', 'Hiro', 'Idris', 'Jonah', 'Kenji', 'Luca', 'Malik', 'Marcus', 'Mateo', 'Nikolai', 'Omar', 'Pavel', 'Rafael', 'Ravi', 'Samuel', 'Soren', 'Theo', 'Tobias', 'Viktor', 'Wesley', 'Yusuf'];
  const LAST = ['Abara', 'Alvarez', 'Ambrose', 'Asante', 'Bergstrom', 'Calloway', 'Castellanos', 'Chandra', 'Delacroix', 'Duarte', 'Eastwood', 'Falk', 'Fontaine', 'Gallagher', 'Halloran', 'Haddad', 'Ishikawa', 'Jansen', 'Kaur', 'Kowalski', 'Lindqvist', 'Lomax', 'Marchetti', 'Mbeki', 'Moreau', 'Nakamura', 'Navarro', 'Okafor', 'Ostrova', 'Pellegrini',
    'Quintero', 'Rahman', 'Reyes', 'Rinaldi', 'Sandoval', 'Saito', 'Sorensen', 'Takeda', 'Thorne', 'Valdez', 'Varga', 'Vasquez', 'Whitlock', 'Winslow', 'Yilmaz', 'Zhou', 'Achterberg', 'Brennan', 'Carvalho', 'Dumont', 'Ekwueme', 'Fairweather', 'Greer', 'Holloway', 'Iyer', 'Kincaid', 'Mercer', 'Osei', 'Petrov', 'Quill'];
  const CO_A = ['Atlas', 'Aurora', 'Beacon', 'Cardinal', 'Cascade', 'Cobalt', 'Crescent', 'Crown', 'Ember', 'Falcon', 'Frontier', 'Granite', 'Harbor', 'Horizon', 'Juniper', 'Keystone', 'Lantern', 'Meridian', 'Northstar', 'Oakline', 'Orchid', 'Pinnacle', 'Polaris', 'Quarry', 'Redwood', 'Sable', 'Silverline', 'Summit', 'Tidewater', 'Vantage', 'Vela', 'Westbrook', 'Zenith', 'Sterling', 'Mosaic', 'Halcyon', 'Ironwood', 'Lumen', 'Solace', 'Kestrel'];
  U.personName = (rng) => `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
  U.brandWord = (rng) => rng.pick(CO_A);
  U.companyName = (rng, suffixes) => `${rng.pick(CO_A)} ${rng.pick(suffixes && suffixes.length ? suffixes : ['Group', 'Holdings', 'Partners', 'Company'])}`;
  U.NAME_POOLS = { FIRST, LAST, CO_A };
  U.initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  /* Great-circle distance in km between objects with lat/lon. */
  U.haversine = (a, b) => {
    if (!a || !b || a.lat == null || b.lat == null) return 0;
    const R = 6371, toR = Math.PI / 180;
    const dLat = (b.lat - a.lat) * toR, dLon = (b.lon - a.lon) * toR;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  };

  E.util = U;
})(globalThis.LGE = globalThis.LGE || {});
