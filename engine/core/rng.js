/* Local Game Studio engine — seeded RNG (sfc32) with independent child streams.
   Deterministic: the same seed + same actions reproduce the same game (Balance Lab, bug repro). */
(function (E) {
  'use strict';
  function hashSeed(str) {
    let h1 = 1779033703 ^ str.length, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
    for (let i = 0; i < str.length; i++) {
      const k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067); h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213); h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067); h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213); h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
  }

  class RNG {
    constructor(seed) {
      this.s = Array.isArray(seed) ? seed.slice(0, 4) : hashSeed(String(seed));
      this.spare = null;
      for (let i = 0; i < 12; i++) this.next();
    }
    next() {
      let [a, b, c, d] = this.s;
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      const t = (a + b | 0) + d | 0;
      d = d + 1 | 0; a = b ^ b >>> 9; b = c + (c << 3) | 0; c = (c << 21 | c >>> 11); c = c + t | 0;
      this.s = [a, b, c, d];
      return (t >>> 0) / 4294967296;
    }
    float(lo = 0, hi = 1) { return lo + (hi - lo) * this.next(); }
    int(lo, hi) { return lo + Math.floor(this.next() * (hi - lo + 1)); }
    chance(p) { return this.next() < p; }
    normal(mean = 0, sd = 1) {
      if (this.spare != null) { const v = this.spare; this.spare = null; return mean + sd * v; }
      let u, v, s;
      do { u = this.next() * 2 - 1; v = this.next() * 2 - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
      const m = Math.sqrt(-2 * Math.log(s) / s);
      this.spare = v * m; return mean + sd * u * m;
    }
    pick(arr) { return arr.length ? arr[Math.floor(this.next() * arr.length)] : undefined; }
    weighted(items, weights) {
      let tot = 0; for (const w of weights) tot += Math.max(0, w || 0);
      if (tot <= 0) return this.pick(items);
      let r = this.next() * tot;
      for (let i = 0; i < items.length; i++) { r -= Math.max(0, weights[i] || 0); if (r <= 0) return items[i]; }
      return items[items.length - 1];
    }
    shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
    sample(arr, n) { return this.shuffle(arr.slice()).slice(0, n); }
    child(label) { return new RNG(hashSeed(this.s.join(',') + '|' + label)); }
    getState() { return this.s.slice(); }
    setState(s) { this.s = s.slice(); this.spare = null; }
  }
  E.RNG = RNG;
  E.hashSeed = hashSeed;
})(globalThis.LGE = globalThis.LGE || {});
