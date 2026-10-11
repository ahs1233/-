// Pine v6 series semantics over whole arrays (TRADE_CONTRACT §1.2).
//
// na is NaN. JS NaN matches Pine na in the ways the GTG sensors rely on: arithmetic
// propagates it, every comparison with it is false, and Math.max/Math.min return it.
// Every function is causal: output[i] depends on inputs[0..i] only.
//
// Parity points, DECIDED by the Parity Gate on TradingView (OANDA:XAUUSD M5, 5,976 bars,
// 2026-09-29, parity/captures/report_M5*.txt):
//   EMA_SEED   ta.ema is seeded with the SMA of the first `len` values (na before): the
//              'sma' hypothesis matched every field; the documented `na(sum[1]) ? src` form
//              ('first') produced 6,603 mismatches. 'first' is kept only as a negative control.
//   PERCENTRANK na until `len` previous bars exist; na neighbours are not counted; divisor
//              `len`. Confirmed by exact Speed/Fuel score parity from the first bar.

export const na = NaN;
export const isNa = (x) => x === null || x === undefined || Number.isNaN(x);
export const nz = (x, y = 0) => (isNa(x) ? y : x);
export const clamp100 = (v) => Math.max(0, Math.min(100, v));
export const clampSigned = (v) => Math.max(-1, Math.min(1, v));

// x[k] with Pine history semantics (na before the first bar).
export const hist = (arr, i, k) => (i - k >= 0 ? arr[i - k] : NaN);

export function sma(src, len) {
  const n = src.length, out = new Array(n).fill(NaN);
  for (let i = len - 1; i < n; i++) {
    let s = 0, bad = false;
    for (let k = i - len + 1; k <= i; k++) { if (isNa(src[k])) { bad = true; break; } s += src[k]; }
    out[i] = bad ? NaN : s / len;
  }
  return out;
}

export function ema(src, len, seed = 'sma') {
  const n = src.length, out = new Array(n).fill(NaN);
  const a = 2 / (len + 1);
  const seedSma = seed === 'sma' ? sma(src, len) : null;
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? out[i - 1] : NaN;
    if (isNa(prev)) out[i] = seed === 'sma' ? seedSma[i] : src[i];
    else out[i] = a * src[i] + (1 - a) * nz(prev);
  }
  return out;
}

// ta.rma: seeded with ta.sma(src, len) (Pine documents this seed for rma).
export function rma(src, len) {
  const n = src.length, out = new Array(n).fill(NaN);
  const a = 1 / len;
  const s = sma(src, len);
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? out[i - 1] : NaN;
    out[i] = isNa(prev) ? s[i] : a * src[i] + (1 - a) * nz(prev);
  }
  return out;
}

export function wma(src, len) {
  const n = src.length, out = new Array(n).fill(NaN);
  const norm = (len * (len + 1)) / 2;
  for (let i = len - 1; i < n; i++) {
    let s = 0, bad = false;
    for (let k = 0; k < len; k++) { const v = src[i - k]; if (isNa(v)) { bad = true; break; } s += v * (len - k); }
    out[i] = bad ? NaN : s / norm;
  }
  return out;
}

// ta.tr(true): on the first bar (no previous close) high − low.
export function trTrue(bars) {
  return bars.map((b, i) => (i === 0 ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - bars[i - 1].c), Math.abs(b.l - bars[i - 1].c))));
}

export const atr = (bars, len) => rma(trTrue(bars), len);

export function percentrank(src, len) {
  const n = src.length, out = new Array(n).fill(NaN);
  for (let i = len; i < n; i++) {
    const cur = src[i];
    if (isNa(cur)) continue;
    let c = 0;
    for (let k = 1; k <= len; k++) if (src[i - k] <= cur) c++;
    out[i] = (c / len) * 100;
  }
  return out;
}

export function maOf(type, src, len, seed) {
  if (type === 'EMA') return ema(src, len, seed);
  if (type === 'SMA') return sma(src, len);
  return wma(src, len);
}
