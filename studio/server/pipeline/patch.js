/* Targeted edits to a game definition. Paths use dots and id selectors:
     "actions[openRoute].cost.cash", "events[fareWar].choices[0].effects", "ui.screens.fleet.sections[0]"
   Ops: set (replace), merge (shallow-merge object), append (push to array), remove (delete key or array item),
        insert (array insert at index). Every patch is applied to a copy; callers validate before saving. */
'use strict';
function parsePath(p) {
  const out = [];
  String(p).replace(/\[([^\]]+)\]|([^.[\]]+)/g, (m, sel, key) => { if (key) out.push({ key }); else if (/^\d+$/.test(sel)) out.push({ index: +sel }); else out.push({ id: sel.replace(/^id=/, '') }); return m; });
  return out;
}
function step(obj, s, create) {
  if (obj == null) return undefined;
  if (s.key != null) { if (obj[s.key] === undefined && create) obj[s.key] = {}; return obj[s.key]; }
  if (s.index != null) return Array.isArray(obj) ? obj[s.index] : undefined;
  if (s.id != null) return Array.isArray(obj) ? obj.find(x => x && (x.id === s.id || x.value === s.id)) : (obj[s.id]);
}
function get(root, p) { let o = root; for (const s of parsePath(p)) { o = step(o, s, false); if (o === undefined) return undefined; } return o; }
function parentOf(root, p, create) {
  const parts = parsePath(p); const last = parts.pop();
  let o = root;
  for (const s of parts) { const n = step(o, s, create); if (n === undefined) throw new Error(`Path not found: ${p}`); o = n; }
  return { parent: o, last };
}
function applyOne(root, op) {
  const kind = op.op || 'set';
  if (!op.path) throw new Error('Patch needs a path');
  const { parent, last } = parentOf(root, op.path, kind === 'set' || kind === 'merge' || kind === 'append');
  const resolveIndex = () => {
    if (last.index != null) return last.index;
    if (last.id != null && Array.isArray(parent)) return parent.findIndex(x => x && (x.id === last.id || x.value === last.id));
    return -1;
  };
  switch (kind) {
    case 'set': {
      if (last.key != null) parent[last.key] = op.value;
      else { const i = resolveIndex(); if (i < 0) { if (Array.isArray(parent)) parent.push(op.value); else throw new Error('Not found: ' + op.path); } else parent[i] = op.value; }
      return;
    }
    case 'merge': {
      let tgt = last.key != null ? parent[last.key] : parent[resolveIndex()];
      if (tgt == null) { tgt = {}; if (last.key != null) parent[last.key] = tgt; else throw new Error('Not found: ' + op.path); }
      Object.assign(tgt, op.value); return;
    }
    case 'append': {
      let arr = last.key != null ? parent[last.key] : parent[resolveIndex()];
      if (arr == null && last.key != null) arr = parent[last.key] = [];
      if (!Array.isArray(arr)) throw new Error('Not an array: ' + op.path);
      for (const v of [].concat(op.value)) {
        const i = v && v.id != null ? arr.findIndex(x => x && x.id === v.id) : -1;
        if (i >= 0) arr[i] = v; else arr.push(v);
      }
      return;
    }
    case 'insert': {
      const arr = last.key != null ? parent[last.key] : null;
      if (!Array.isArray(arr)) throw new Error('Not an array: ' + op.path);
      arr.splice(op.index != null ? op.index : arr.length, 0, op.value); return;
    }
    case 'remove': {
      if (last.key != null) delete parent[last.key];
      else { const i = resolveIndex(); if (i >= 0) parent.splice(i, 1); }
      return;
    }
    default: throw new Error('Unknown patch op ' + kind);
  }
}
function apply(gdl, ops) {
  const copy = JSON.parse(JSON.stringify(gdl));
  const applied = [], failed = [];
  for (const op of ops || []) { try { applyOne(copy, op); applied.push(op); } catch (e) { failed.push({ op, error: e.message }); } }
  return { gdl: copy, applied, failed };
}
/* Human-readable summary of a patch for the changelog. */
function describe(ops) {
  return (ops || []).map(o => `${o.op || 'set'} ${o.path}${o.why ? ' — ' + o.why : ''}`);
}
module.exports = { apply, applyOne, get, parsePath, describe };
