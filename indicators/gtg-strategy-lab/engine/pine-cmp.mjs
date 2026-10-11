// Pine float comparison semantics (FAILURE_LOG F-007).
//
// TradingView compares floats with an absolute tolerance, measured on TradingView Desktop
// with two unsaved probe scripts (2026-09-29):
//   1+9e-11 <= 1 true   1+1e-10 <= 1 false   (1+1e-10 is 1.0000000001000000083 in binary64)
//   4000+5e-11 <= 4000 true   4000+2e-10 <= 4000 false   1e6+1e-6 <= 1e6 false
//   1e-6+1e-12 <= 1e-6 true   0+5e-11 <= 0 true   0+2e-10 <= 0 false   0.1+0.2 == 0.3 true
// i.e. |a − b| below 1e-10 counts as equal, whatever the magnitude (absolute, not relative).
// The exact boundary (|a − b| = 1e-10 itself) is not observable and is taken as unequal.
// Non-numbers and na (NaN) keep JavaScript semantics: every comparison with na is false.
export const PINE_EPS = 1e-10;

export const eq = (a, b) => a === b || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < PINE_EPS);
export const ne = (a, b) => !eq(a, b);
export const lt = (a, b) => a < b && !eq(a, b);
export const gt = (a, b) => a > b && !eq(a, b);
export const le = (a, b) => a <= b || eq(a, b);
export const ge = (a, b) => a >= b || eq(a, b);
