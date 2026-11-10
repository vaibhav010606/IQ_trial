// Shared helpers for the synthetic question generator.

/** Seeded PRNG (mulberry32) so a run is reproducible. */
function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    shuffle: (arr) => {
      const a2 = [...arr];
      for (let i = a2.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a2[i], a2[j]] = [a2[j], a2[i]];
      }
      return a2;
    },
  };
}

/** A tidy number: integers as-is, otherwise up to 3 significant decimals. */
function fmt(x) {
  if (!Number.isFinite(x)) return String(x);
  if (Number.isInteger(x)) return String(x);
  const abs = Math.abs(x);
  const digits = abs >= 100 ? 1 : abs >= 1 ? 2 : 3;
  return String(Number(x.toFixed(digits)));
}

const isInt = (x) => Number.isFinite(x) && Math.abs(x - Math.round(x)) < 1e-9;

module.exports = { rng, fmt, isInt };
