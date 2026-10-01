/* Local Game Studio engine — expression environment bound to a game.
   Resolves member access (with reference fields auto-resolving to entities), provides math,
   random (seeded), aggregates over entity kinds with cached indexes, and formatting helpers. */
(function (E) {
  'use strict';
  const U = E.util;

  function makeEnv(game) {
    const env = { strict: false };
    const st = () => game.state;

    env.ident = (name, s) => {
      if (name === 'it' || name === 'param' || name === 'terms' || name === 'fc') return undefined;
      if (env.strict) throw new Error(`Unknown name '${name}'`);
      return undefined;
    };
    env.unknownFn = (name) => { throw new Error(`Unknown function '${name}()'`); };

    env.member = (obj, prop) => {
      if (obj == null) return undefined;
      if (typeof obj !== 'object') {
        if (typeof obj === 'string' && prop === 'length') return obj.length;
        return undefined;
      }
      if (Array.isArray(obj)) { if (prop === 'length' || prop === 'count') return obj.length; return obj[prop]; }
      if (obj.__org) {
        if (prop in obj) { const v = obj[prop]; return v; }
        if (obj.res && prop in obj.res) return obj.res[prop];
        if (obj.m && prop in obj.m) return obj.m[prop];
        const fd = game.def.orgFields[prop];
        if (fd) return fd.default != null && typeof fd.default !== 'string' ? fd.default : (fd.type === 'number' || fd.type === 'money' ? 0 : undefined);
        return undefined;
      }
      if (obj.__ent) {
        let v = obj[prop];
        if (prop === 'owner') return v != null ? (st().orgs[v] || v) : null;
        const kd = game.def.kinds[obj.kind];
        const fd = kd && kd.fields[prop];
        if (v === undefined && fd) v = fd.default != null && typeof fd.default !== 'string' ? fd.default : (fd.type === 'number' || fd.type === 'money' || fd.type === 'int' || fd.type === 'pct' ? 0 : undefined);
        if (fd && fd.type === 'ref' && v != null && typeof v !== 'object') return game.ent(fd.ref, v) || null;
        if (fd && fd.type === 'refs' && Array.isArray(v)) return v.map(id => game.ent(fd.ref, id)).filter(Boolean);
        return v;
      }
      if (obj.__world) {
        if (prop in obj.vars) return obj.vars[prop];
        return obj[prop];
      }
      return obj[prop];
    };

    const R = () => game.rng;
    const fns = {
      min: (...a) => Math.min(...a.map(E.expr.num)), max: (...a) => Math.max(...a.map(E.expr.num)),
      clamp: (x, lo, hi) => U.clamp(+x || 0, +lo, +hi), abs: Math.abs,
      round: (x, d) => U.round(+x || 0, d || 0), floor: Math.floor, ceil: Math.ceil,
      sqrt: (x) => Math.sqrt(Math.max(0, +x || 0)), exp: (x) => Math.exp(U.clamp(+x || 0, -50, 50)),
      log: (x) => (x > 0 ? Math.log(x) : -20), ln: (x) => (x > 0 ? Math.log(x) : -20), log10: (x) => (x > 0 ? Math.log10(x) : -20),
      pow: (a, b) => { const v = Math.pow(+a || 0, +b || 0); return Number.isFinite(v) ? v : 0; },
      lerp: (a, b, t) => a + (b - a) * U.clamp(+t || 0, 0, 1),
      sigmoid: (x) => 1 / (1 + Math.exp(-(+x || 0))), sign: Math.sign,
      safe: (x, d) => (Number.isFinite(+x) ? +x : (d || 0)),
      rand: () => R().next(), randn: (m, sd) => R().normal(m || 0, sd == null ? 1 : sd),
      randInt: (a, b) => R().int(Math.round(a), Math.round(b)), chance: (p) => R().next() < (+p || 0),
      pick: (arr) => (Array.isArray(arr) ? R().pick(arr) : arr),
      len: (a) => (a == null ? 0 : a.length || 0),
      contains: (arr, x) => Array.isArray(arr) && arr.some(y => y === x || (y && x && (y.id === x || y.id === x.id || y === x.id))),
      idOf: (x) => (x && typeof x === 'object' ? x.id : x),
      // entities
      get: (kind, id) => game.ent(kind, id && typeof id === 'object' ? id.id : id),
      all: (kind) => game.all(kind),
      owned: Object.assign(function ([kind, org], s) { const o = org == null ? (s.org || game.playerOrg()) : org; return game.owned(kind, o && typeof o === 'object' ? o.id : o); }, { scoped: true }),
      refs: Object.assign(function ([kind, field, target], s) { const t = target == null ? s.self : target; return game.refs(kind, field, t && typeof t === 'object' ? t.id : t); }, { scoped: true }),
      org: (id) => st().orgs[id && typeof id === 'object' ? id.id : id] || null,
      orgs: () => game.liveOrgs(),
      rivals: () => game.liveOrgs().filter(o => !o.isPlayer),
      distance: (a, b) => U.haversine(a, b),
      res: (id, org) => { const o = org ? (typeof org === 'object' ? org : st().orgs[org]) : game.playerOrg(); return o && o.res ? o.res[id] : undefined; },
      stake: (id) => (st().stakes[id] ? st().stakes[id].value : undefined),
      metric: (id, org) => { const o = org ? (typeof org === 'object' ? org : st().orgs[org]) : game.playerOrg(); return o && o.m ? o.m[id] : undefined; },
      memory: (a, b, key) => game.memory(a, b, key),
      rivalry: (a, b) => game.memory(a, b, 'rivalry'),
      flag: (name) => !!st().flags[name], hasFlag: (name) => !!st().flags[name],
      tier: () => st().progression.tier, tierIndex: () => game.tierIndex(st().progression.tier),
      tierAtLeast: (id) => game.tierIndex(st().progression.tier) >= game.tierIndex(id),
      policy: (id) => st().policies[id],
      est: (ent, field) => game.estimate(ent, field),
      worldVar: (id) => st().world.vars[id],
      phase: () => st().world.phase,
      ticksSince: (t) => st().tick - (+t || 0),
      // formatting (for templates)
      money: (v) => U.money(v), moneyFull: (v) => U.moneyFull(v), pct: (v) => U.pct(v), pct1: (v) => U.pct(v, 1), num: (v) => U.num(v), int: (v) => U.int(v),
      signed: (v) => U.signed(v), signedMoney: (v) => U.signed(v, U.money), signedPct: (v) => U.signedPct(v),
      name: (e) => (e && typeof e === 'object' ? e.name : (e == null ? '' : String(e))),
      upper: (s) => String(s || '').toUpperCase(), lower: (s) => String(s || '').toLowerCase(),
      plural: (n, w) => U.plural(n, w), date: (t) => game.cal.label(t == null ? st().tick : t),
      year: () => game.cal.yearOf(st().tick)
    };

    // aggregates: first arg is a kind name or an array; lambda args are (it, s, env) functions
    function src(x) { if (Array.isArray(x)) return x; if (typeof x === 'string') return game.all(x); if (x && typeof x === 'object') return [x]; return []; }
    const pass = (f, it, s) => (f ? !!f(it, s, env) : true);
    fns.count = function ([a, f], s) { let n = 0; for (const it of src(a)) if (pass(f, it, s)) n++; return n; };
    fns.sum = function ([a, ex, f], s) { let t = 0; for (const it of src(a)) if (pass(f, it, s)) { const v = +ex(it, s, env); if (Number.isFinite(v)) t += v; } return t; };
    fns.avg = function ([a, ex, f], s) { let t = 0, n = 0; for (const it of src(a)) if (pass(f, it, s)) { const v = +ex(it, s, env); if (Number.isFinite(v)) { t += v; n++; } } return n ? t / n : 0; };
    fns.maxOf = function ([a, ex, f], s) { let m = -Infinity; for (const it of src(a)) if (pass(f, it, s)) { const v = +ex(it, s, env); if (v > m) m = v; } return m === -Infinity ? 0 : m; };
    fns.minOf = function ([a, ex, f], s) { let m = Infinity; for (const it of src(a)) if (pass(f, it, s)) { const v = +ex(it, s, env); if (v < m) m = v; } return m === Infinity ? 0 : m; };
    fns.find = function ([a, f], s) { for (const it of src(a)) if (pass(f, it, s)) return it; return null; };
    fns.filter = function ([a, f], s) { return src(a).filter(it => pass(f, it, s)); };
    fns.any = function ([a, f], s) { for (const it of src(a)) if (pass(f, it, s)) return true; return false; };
    fns.all = function (args, s) {
      if (args.length === 1 && typeof args[0] === 'string') return game.all(args[0]);
      const [a, f] = args; for (const it of src(a)) if (!pass(f, it, s)) return false; return true;
    };
    fns.sortBy = function ([a, ex, desc], s) { const arr = src(a).map(it => [it, +ex(it, s, env) || 0]); arr.sort((x, y) => (desc === false ? x[1] - y[1] : y[1] - x[1])); return arr.map(x => x[0]); };
    fns.top = function ([a, ex, n], s) { return fns.sortBy([a, ex], s).slice(0, n || 1); };
    fns.bestOf = function ([a, ex], s) { return fns.sortBy([a, ex], s)[0] || null; };
    fns.map = function ([a, ex], s) { return src(a).map(it => ex(it, s, env)); };
    // 'all' is overloaded: all('kind') returns entities; all(list, filter) tests a predicate
    E.expr.LAMBDA_ARGS.all = [1];
    env.fns = fns;
    return env;
  }

  E.makeEnv = makeEnv;
})(globalThis.LGE = globalThis.LGE || {});
