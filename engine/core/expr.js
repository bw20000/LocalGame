/* Local Game Studio engine — safe expression language for GDL formulas.
   A small JS-like language compiled to closures (no eval/new Function), so formulas written by a
   local model can never run arbitrary code. Supports arithmetic, comparisons, logic, ternary,
   member access with automatic reference resolution, arrays, function calls, and "lambda"
   arguments for aggregate functions: count('route', it.owner == org.id) or with the filter quoted. */
(function (E) {
  'use strict';

  const LAMBDA_ARGS = {
    count: [1], sum: [1, 2], avg: [1, 2], maxOf: [1, 2], minOf: [1, 2], find: [1], filter: [1],
    any: [1], all: [1], sortBy: [1], top: [1], bestOf: [1], map: [1]
  };
  const WORD_OPS = { and: '&&', or: '||', not: '!' };

  class ExprError extends Error {
    constructor(msg, src, pos) { super(msg + (src != null ? ` in "${src}"` + (pos != null ? ` at ${pos}` : '') : '')); this.src = src; this.pos = pos; }
  }

  function tokenize(src) {
    const toks = []; let i = 0; const n = src.length;
    while (i < n) {
      const c = src[i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
      if ((c >= '0' && c <= '9') || (c === '.' && src[i + 1] >= '0' && src[i + 1] <= '9')) {
        let j = i; while (j < n && /[0-9._]/.test(src[j])) j++;
        if ((src[j] === 'e' || src[j] === 'E') && /[0-9+-]/.test(src[j + 1] || '')) { j += 2; while (j < n && /[0-9]/.test(src[j])) j++; }
        let v = parseFloat(src.slice(i, j).replace(/_/g, ''));
        const suf = src[j];
        if (suf && /[kKMB]/.test(suf) && !/[A-Za-z0-9_$]/.test(src[j + 1] || '')) { v *= suf === 'B' ? 1e9 : suf === 'M' ? 1e6 : 1e3; j++; }
        toks.push({ t: 'num', v, p: i }); i = j; continue;
      }
      if (c === '"' || c === "'") {
        let j = i + 1, s = '';
        while (j < n && src[j] !== c) { if (src[j] === '\\' && j + 1 < n) { s += src[j + 1]; j += 2; } else s += src[j++]; }
        if (j >= n) throw new ExprError('Unterminated string', src, i);
        toks.push({ t: 'str', v: s, p: i }); i = j + 1; continue;
      }
      if (/[A-Za-z_$]/.test(c)) {
        let j = i; while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++;
        const w = src.slice(i, j);
        if (WORD_OPS[w]) toks.push({ t: 'op', v: WORD_OPS[w], p: i });
        else toks.push({ t: 'id', v: w, p: i });
        i = j; continue;
      }
      const three = src.substr(i, 3), two = src.substr(i, 2);
      if (three === '===' || three === '!==') { toks.push({ t: 'op', v: three.slice(0, 2), p: i }); i += 3; continue; }
      if (['==', '!=', '<=', '>=', '&&', '||', '**', '??'].includes(two)) { toks.push({ t: 'op', v: two, p: i }); i += 2; continue; }
      if ('+-*/%<>!?:()[],.'.includes(c)) { toks.push({ t: 'op', v: c, p: i }); i++; continue; }
      throw new ExprError(`Unexpected character '${c}'`, src, i);
    }
    toks.push({ t: 'eof', p: n });
    return toks;
  }

  const BIN = { '??': 1, '||': 2, '&&': 3, '==': 4, '!=': 4, '<': 5, '<=': 5, '>': 5, '>=': 5, '+': 6, '-': 6, '*': 7, '/': 7, '%': 7, '**': 8 };

  function parse(src) {
    const toks = tokenize(src); let k = 0;
    const peek = () => toks[k];
    const next = () => toks[k++];
    const expect = (v) => { const t = next(); if (t.t !== 'op' || t.v !== v) throw new ExprError(`Expected '${v}'`, src, t.p); return t; };
    function primary() {
      const t = next();
      if (t.t === 'num') return { k: 'lit', v: t.v };
      if (t.t === 'str') return { k: 'lit', v: t.v };
      if (t.t === 'id') {
        if (t.v === 'true') return { k: 'lit', v: true };
        if (t.v === 'false') return { k: 'lit', v: false };
        if (t.v === 'null' || t.v === 'undefined') return { k: 'lit', v: null };
        return { k: 'id', v: t.v };
      }
      if (t.t === 'op' && t.v === '(') { const e = expr(0); expect(')'); return e; }
      if (t.t === 'op' && t.v === '[') {
        const items = [];
        if (!(peek().t === 'op' && peek().v === ']')) { do { items.push(expr(0)); } while (peek().t === 'op' && peek().v === ',' && next()); }
        expect(']'); return { k: 'arr', items };
      }
      if (t.t === 'op' && (t.v === '-' || t.v === '+' || t.v === '!')) return { k: 'un', op: t.v, a: unaryOperand() };
      throw new ExprError(`Unexpected ${t.t === 'eof' ? 'end of expression' : `'${t.v}'`}`, src, t.p);
    }
    function unaryOperand() { return postfix(primary()); }
    function postfix(node) {
      for (;;) {
        const t = peek();
        if (t.t === 'op' && t.v === '.') { next(); const id = next(); if (id.t !== 'id') throw new ExprError('Expected property name', src, id.p); node = { k: 'mem', o: node, p: id.v }; continue; }
        if (t.t === 'op' && t.v === '[') { next(); const ix = expr(0); expect(']'); node = { k: 'idx', o: node, i: ix }; continue; }
        if (t.t === 'op' && t.v === '(') {
          next(); const args = [];
          if (!(peek().t === 'op' && peek().v === ')')) { do { args.push(expr(0)); } while (peek().t === 'op' && peek().v === ',' && next()); }
          expect(')');
          if (node.k !== 'id') throw new ExprError('Only named functions can be called', src, t.p);
          node = { k: 'call', f: node.v, args }; continue;
        }
        return node;
      }
    }
    function expr(minPrec) {
      let left = postfix(primary());
      for (;;) {
        const t = peek();
        if (t.t !== 'op') break;
        if (t.v === '?' && minPrec <= 0) {
          next(); const a = expr(0); expect(':'); const b = expr(0);
          left = { k: 'tern', c: left, a, b }; continue;
        }
        const prec = BIN[t.v];
        if (prec == null || prec < minPrec) break;
        next();
        const right = expr(t.v === '**' ? prec : prec + 1);
        left = { k: 'bin', op: t.v, a: left, b: right };
      }
      return left;
    }
    const ast = expr(0);
    if (peek().t !== 'eof') throw new ExprError(`Unexpected '${peek().v}'`, src, peek().p);
    return ast;
  }

  function num(v) { return typeof v === 'number' ? v : (v == null || v === '' ? 0 : (typeof v === 'boolean' ? (v ? 1 : 0) : +v)); }

  function compileNode(node, src) {
    switch (node.k) {
      case 'lit': { const v = node.v; return () => v; }
      case 'id': {
        const name = node.v;
        return (s, env) => { const v = s[name]; return v !== undefined ? v : env.ident(name, s); };
      }
      case 'arr': { const fs = node.items.map(n => compileNode(n, src)); return (s, env) => fs.map(f => f(s, env)); }
      case 'mem': { const o = compileNode(node.o, src); const p = node.p; return (s, env) => env.member(o(s, env), p); }
      case 'idx': { const o = compileNode(node.o, src), i = compileNode(node.i, src); return (s, env) => env.member(o(s, env), i(s, env)); }
      case 'un': {
        const a = compileNode(node.a, src);
        if (node.op === '-') return (s, env) => -num(a(s, env));
        if (node.op === '+') return (s, env) => num(a(s, env));
        return (s, env) => !a(s, env);
      }
      case 'tern': { const c = compileNode(node.c, src), a = compileNode(node.a, src), b = compileNode(node.b, src); return (s, env) => (c(s, env) ? a(s, env) : b(s, env)); }
      case 'bin': {
        const a = compileNode(node.a, src), b = compileNode(node.b, src);
        switch (node.op) {
          case '+': return (s, env) => { const x = a(s, env), y = b(s, env); return (typeof x === 'string' || typeof y === 'string') ? String(x ?? '') + String(y ?? '') : num(x) + num(y); };
          case '-': return (s, env) => num(a(s, env)) - num(b(s, env));
          case '*': return (s, env) => num(a(s, env)) * num(b(s, env));
          case '/': return (s, env) => { const d = num(b(s, env)); return d === 0 ? 0 : num(a(s, env)) / d; };
          case '%': return (s, env) => { const d = num(b(s, env)); return d === 0 ? 0 : num(a(s, env)) % d; };
          case '**': return (s, env) => Math.pow(num(a(s, env)), num(b(s, env)));
          case '<': return (s, env) => num(a(s, env)) < num(b(s, env));
          case '<=': return (s, env) => num(a(s, env)) <= num(b(s, env));
          case '>': return (s, env) => num(a(s, env)) > num(b(s, env));
          case '>=': return (s, env) => num(a(s, env)) >= num(b(s, env));
          // eslint-disable-next-line eqeqeq
          case '==': return (s, env) => { const x = a(s, env), y = b(s, env); return x == y || (x && y && typeof x === 'object' && typeof y !== 'object' && x.id == y) || (x && y && typeof y === 'object' && typeof x !== 'object' && y.id == x); };
          // eslint-disable-next-line eqeqeq
          case '!=': return (s, env) => { const x = a(s, env), y = b(s, env); return !(x == y || (x && y && typeof x === 'object' && typeof y !== 'object' && x.id == y) || (x && y && typeof y === 'object' && typeof x !== 'object' && y.id == x)); };
          case '&&': return (s, env) => a(s, env) && b(s, env);
          case '||': return (s, env) => a(s, env) || b(s, env);
          case '??': return (s, env) => { const x = a(s, env); return x != null ? x : b(s, env); };
        }
        break;
      }
      case 'call': {
        const name = node.f;
        const lam = LAMBDA_ARGS[name];
        const args = node.args.map((n, i) => {
          if (lam && lam.includes(i)) {
            // lambda argument: string literal → compile its contents; anything else → compile as lambda body
            const body = n.k === 'lit' && typeof n.v === 'string' ? compileNode(parse(n.v), n.v) : compileNode(n, src);
            const fn = (it, s, env) => { const old = s.it; s.it = it; try { return body(s, env); } finally { s.it = old; } };
            fn.isLambda = true; return fn;
          }
          return compileNode(n, src);
        });
        return (s, env) => {
          const f = env.fns[name];
          if (!f) return env.unknownFn(name, s);
          if (lam) return f.call(env, args.map((a, i) => lam.includes(i) ? a : a(s, env)), s, env);
          const vals = new Array(args.length);
          for (let i = 0; i < args.length; i++) vals[i] = args[i](s, env);
          if (f.scoped) return f.call(env, vals, s);
          return f.apply(env, vals);
        };
      }
    }
    throw new ExprError('Bad expression node', src);
  }

  const cache = new Map();
  function compile(src) {
    if (typeof src === 'number' || typeof src === 'boolean') { const v = src; const f = () => v; f.src = String(src); return f; }
    if (src == null) { const f = () => null; f.src = 'null'; return f; }
    if (typeof src === 'function') return src;
    src = String(src);
    let f = cache.get(src);
    if (f) return f;
    const ast = parse(src.trim() === '' ? 'null' : src);
    const inner = compileNode(ast, src);
    f = (s, env) => inner(s, env);
    f.src = src; f.ast = ast;
    cache.set(src, f);
    return f;
  }

  /* Templates: "Route {self.name} earned {money(x)}" or "{x|pct}". Use {{ and }} for literal braces. */
  const tcache = new Map();
  function compileTemplate(text) {
    if (text == null) return () => '';
    text = String(text);
    let f = tcache.get(text);
    if (f) return f;
    const parts = []; let i = 0, buf = '';
    while (i < text.length) {
      const c = text[i];
      if (c === '{' && text[i + 1] === '{') { buf += '{'; i += 2; continue; }
      if (c === '}' && text[i + 1] === '}') { buf += '}'; i += 2; continue; }
      if (c === '{') {
        let depth = 1, j = i + 1;
        while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; if (depth) j++; }
        let inner = text.slice(i + 1, j); let pipe = null;
        const m = inner.match(/^(.*?)\|\s*([a-zA-Z]+)\s*$/);
        if (m && !m[1].includes('||') && !/\|\|/.test(inner)) { inner = m[1]; pipe = m[2]; }
        if (buf) parts.push(buf); buf = '';
        const ef = compile(inner);
        parts.push({ ef, pipe });
        i = j + 1; continue;
      }
      buf += c; i++;
    }
    if (buf) parts.push(buf);
    f = (s, env) => {
      let out = '';
      for (const p of parts) {
        if (typeof p === 'string') { out += p; continue; }
        let v;
        try { v = p.ef(s, env); } catch (e) { v = '?'; }
        if (p.pipe && env.fns[p.pipe]) v = env.fns[p.pipe](v);
        else if (v && typeof v === 'object') v = v.name != null ? v.name : (Array.isArray(v) ? v.length : '');
        else if (typeof v === 'number') v = env.fns.num ? env.fns.num(v) : String(v);
        out += v == null ? '' : v;
      }
      return out;
    };
    tcache.set(text, f);
    return f;
  }

  /* Collect root identifiers and function names used by an expression (validator / dependency maps). */
  function analyze(src) {
    const ast = typeof src === 'string' ? parse(src) : src;
    const ids = new Set(), fns = new Set(), paths = new Set();
    (function walk(n) {
      if (!n) return;
      switch (n.k) {
        case 'id': ids.add(n.v); break;
        case 'mem': { let p = n, chain = []; while (p.k === 'mem') { chain.unshift(p.p); p = p.o; } if (p.k === 'id') paths.add([p.v, ...chain].join('.')); walk(n.o); break; }
        case 'idx': walk(n.o); walk(n.i); break;
        case 'arr': n.items.forEach(walk); break;
        case 'un': walk(n.a); break;
        case 'tern': walk(n.c); walk(n.a); walk(n.b); break;
        case 'bin': walk(n.a); walk(n.b); break;
        case 'call': fns.add(n.f); n.args.forEach((a, i) => { if (a.k === 'lit' && typeof a.v === 'string' && LAMBDA_ARGS[n.f] && LAMBDA_ARGS[n.f].includes(i)) { try { const sub = analyze(a.v); sub.ids.forEach(x => ids.add(x)); sub.fns.forEach(x => fns.add(x)); sub.paths.forEach(x => paths.add(x)); } catch (e) { /* reported elsewhere */ } } else walk(a); }); break;
      }
    })(ast);
    return { ids, fns, paths };
  }

  E.expr = { compile, compileTemplate, parse, analyze, tokenize, ExprError, LAMBDA_ARGS, num };
})(globalThis.LGE = globalThis.LGE || {});
