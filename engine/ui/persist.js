/* Local Game Studio engine — persistence: IndexedDB save slots (fallback: localStorage, then
   memory), autosave, rename/duplicate/delete, export/import with gzip when available. Saves
   carry the game id + definition version so migration can fill new fields. */
(function (E) {
  'use strict';
  class Store {
    constructor(gameId) { this.gameId = gameId; this.dbName = 'lgs-' + gameId; this.mem = new Map(); this.mode = null; }
    async open() {
      if (this.mode) return;
      try {
        if (typeof indexedDB === 'undefined') throw new Error('no idb');
        this.db = await new Promise((res, rej) => {
          const r = indexedDB.open(this.dbName, 1);
          r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains('saves')) db.createObjectStore('saves', { keyPath: 'slot' }); };
          r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
        });
        this.mode = 'idb';
      } catch (e) {
        try { localStorage.setItem('__lgs_test', '1'); localStorage.removeItem('__lgs_test'); this.mode = 'ls'; } catch (e2) { this.mode = 'mem'; }
      }
    }
    async _tx(kind, fn) {
      return new Promise((res, rej) => { const tx = this.db.transaction('saves', kind); const st = tx.objectStore('saves'); const r = fn(st); tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error); });
    }
    async put(rec) {
      await this.open();
      rec.updated = Date.now();
      if (this.mode === 'idb') return this._tx('readwrite', st => st.put(rec));
      if (this.mode === 'ls') { localStorage.setItem(this.dbName + ':' + rec.slot, JSON.stringify(rec)); return; }
      this.mem.set(rec.slot, rec);
    }
    async get(slot) {
      await this.open();
      if (this.mode === 'idb') return new Promise((res, rej) => { const tx = this.db.transaction('saves', 'readonly'); const r = tx.objectStore('saves').get(slot); r.onsuccess = () => res(r.result || null); r.onerror = () => rej(r.error); });
      if (this.mode === 'ls') { const s = localStorage.getItem(this.dbName + ':' + slot); return s ? JSON.parse(s) : null; }
      return this.mem.get(slot) || null;
    }
    async del(slot) {
      await this.open();
      if (this.mode === 'idb') return this._tx('readwrite', st => st.delete(slot));
      if (this.mode === 'ls') { localStorage.removeItem(this.dbName + ':' + slot); return; }
      this.mem.delete(slot);
    }
    async list() {
      await this.open();
      let all = [];
      if (this.mode === 'idb') all = await new Promise((res, rej) => { const tx = this.db.transaction('saves', 'readonly'); const r = tx.objectStore('saves').getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error); });
      else if (this.mode === 'ls') { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(this.dbName + ':')) { try { all.push(JSON.parse(localStorage.getItem(k))); } catch (e) { /* skip corrupt */ } } } }
      else all = Array.from(this.mem.values());
      return all.map(r => ({ slot: r.slot, name: r.name, meta: r.meta, updated: r.updated, auto: !!r.auto })).sort((a, b) => b.updated - a.updated);
    }
  }

  async function gzip(str) {
    if (typeof CompressionStream === 'undefined') return null;
    const cs = new CompressionStream('gzip');
    const buf = await new Response(new Blob([str]).stream().pipeThrough(cs)).arrayBuffer();
    return new Uint8Array(buf);
  }
  async function gunzip(bytes) {
    const ds = new DecompressionStream('gzip');
    return new Response(new Blob([bytes]).stream().pipeThrough(ds)).text();
  }

  const Persist = {
    Store,
    meta(game) {
      const p = game.playerOrg();
      return { company: p.name, date: game.cal.label(game.state.tick), tick: game.state.tick, cash: p.cash, value: p.m.value, tier: game.state.progression.tier, gdlVersion: game.state.gdlVersion, engine: E.STATE_VERSION };
    },
    async save(store, game, slot, name, auto = false) {
      const rec = { slot, name: name || slot, auto, meta: Persist.meta(game), data: game.serialize() };
      await store.put(rec);
      return rec;
    },
    async load(store, gdl, slot, opts) {
      const rec = await store.get(slot);
      if (!rec) throw new Error('Save not found');
      return E.Game.load(gdl, rec.data, opts);
    },
    async exportBlob(game, name) {
      const payload = JSON.stringify({ format: 'lgs-save', game: game.def.meta.id || game.def.meta.title, name, meta: Persist.meta(game), data: game.serialize() });
      const gz = await gzip(payload).catch(() => null);
      return gz ? { blob: new Blob([gz], { type: 'application/gzip' }), ext: '.save.gz' } : { blob: new Blob([payload], { type: 'application/json' }), ext: '.save.json' };
    },
    async importFile(file) {
      const buf = new Uint8Array(await file.arrayBuffer());
      let text;
      if (buf[0] === 0x1f && buf[1] === 0x8b) text = await gunzip(buf); else text = new TextDecoder().decode(buf);
      const obj = JSON.parse(text);
      if (obj.format !== 'lgs-save' || !obj.data) throw new Error('This file is not a save for this game.');
      return obj;
    },
    download(blob, filename) {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }
  };
  E.persist = Persist;
})(globalThis.LGE = globalThis.LGE || {});
