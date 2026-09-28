// Rolling 1000-bar validation diagnostics (review message 57, second version).
// Measurement only: not engine state, read by nothing in the engine. Pine section 18b
// computes the same four packed integers and shows them in a validation-only table
// (no plot() calls: the plot-based version hit RE10140 on TradingView):
//   GTGDIAG v1 / BAR=<bar open time ms> / EVT=<int> / MISMATCH=<int> / CAUSAL=<int> / INV=<int|na>
//
// Window: the last DIAG_WIN confirmed chart bars (validationMode on). Every count is
// taken over the *warmed* confirmed engine bars inside that window, where warmed =
// engineStep and the engine has already run more than W bars (the F1 definition).
// The open (unconfirmed) bar is never pushed into the window; the table keeps showing the
// values of the last confirmed bar (BAR= says which).
//
// Masks (the analyzer's, over v_eventBits = engineBits + alertBits·128):
//   break  engine 3  (1|2)    alert 8192   (Obstacle Break)
//   accept engine 12 (4|8)    alert 32768  (Break Accepted)
//   reject engine 48 (16|32)  alert 16384  (Obstacle Rejection)
//   flip   engine 64          alert 65536  (Flip Confirmed)
//   strong obstacle alert 2048;  v_obsState event bit 8.
export const DIAG_WIN = 1000;
export const DIAG_BASE = 1024;
// Invariant counters (tel.violations / tel.violationsCritical) are cumulative and
// monotonically non-decreasing, so their maximum over the window equals their value on
// the last confirmed bar, and a violation that happened before the window still shows.
// Packed exactly in base 2^26: the largest valid value is 2^52 − 1 (exact in a double).
// A field outside [0, 2^26) is an overflow: Pine shows INV=na (no clamp, no modulo) and the
// raw v_invTotal / v_invCritical plots remain available.
export const INV_BASE = 67108864; // 2^26
export const MASKS = Object.freeze({
  breakEngine: 3, breakAlert: 8192, acceptEngine: 12, acceptAlert: 32768,
  rejectEngine: 48, rejectAlert: 16384, flipEngine: 64, flipAlert: 65536,
  strongAlert: 2048, obsEvent: 8,
});
export const ACCEPT_LOOKBACK = 3;  // accept with no break in [i−3, i] is an orphan
export const FLIP_LOOKBACK = 60;   // flip with no accept in [i−60, i] is an orphan

// Field order of each packed plot (least significant first).
export const LAYOUT = Object.freeze({
  EVT: ['breakBars', 'acceptBars', 'rejectBars', 'flipBars', 'strongObstacleAlerts'],
  MISMATCH: ['breakAlertMismatch', 'acceptAlertMismatch', 'rejectAlertMismatch', 'flipAlertMismatch', 'obsEventMismatch'],
  CAUSAL: ['acceptWithoutBreakWithin3Bars', 'flipWithoutAcceptedWithin60Bars', 'warmedConfirmedCount'],
  INV: ['maxInvTotal1000', 'maxInvCritical1000'],
});

export function pack(fields, base = DIAG_BASE) {
  let v = 0;
  let mul = 1;
  for (const f of fields) {
    if (!Number.isInteger(f) || f < 0 || f >= base) throw new Error(`field ${f} outside [0, ${base - 1}]`);
    v += f * mul;
    mul *= base;
  }
  if (!Number.isSafeInteger(v)) throw new Error('packed value exceeds 2^53');
  return v;
}

export function unpack(value, n, base = DIAG_BASE, max = DIAG_WIN) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`not an exact non-negative integer: ${value}`);
  const out = [];
  let v = value;
  for (let i = 0; i < n; i++) { out.push(v % base); v = Math.floor(v / base); }
  if (v !== 0) throw new Error(`value ${value} has more than ${n} fields`);
  for (const f of out) if (f > max) throw new Error(`field ${f} exceeds the window (${max}): mis-read value?`);
  return out;
}

// Returns null on overflow (Pine shows na), never a clamped or wrapped value.
export function packInv(total, critical) {
  for (const f of [total, critical]) if (!Number.isInteger(f) || f < 0 || f >= INV_BASE) return null;
  return total + critical * INV_BASE;
}

export function decodeDiag(plots) {
  const res = {};
  for (const [name, fields] of Object.entries(LAYOUT)) {
    if (plots[name] == null) continue;
    const inv = name === 'INV';
    const vals = inv ? unpack(plots[name], 2, INV_BASE, INV_BASE - 1) : unpack(plots[name], fields.length, DIAG_BASE);
    fields.forEach((f, i) => { res[f] = vals[i]; });
  }
  return res;
}

const has = (x, mask) => (x & mask) !== 0;

// Reference model of Pine 18b. rows: one per chart bar, oldest first:
// { confirmed, engineStep, warmed, eventBits, obsState, violationsTotal, violationsCritical }
// (violations* are the engine's cumulative counters; INV packs their values on this row).
// Returns, per row, the four packed values (null on unconfirmed rows: nothing new is pushed).
export function diagSeries(rows, W = DIAG_WIN) {
  let sinceBreak = null, sinceAccept = null; // ta.barssince over engine events, every bar
  const ring = [];
  const sums = new Array(13).fill(0);
  const out = [];
  for (const r of rows) {
    const ev = r.engineStep ? r.eventBits : 0;
    const brkE = r.engineStep && has(ev, MASKS.breakEngine);
    const accE = r.engineStep && has(ev, MASKS.acceptEngine);
    sinceBreak = brkE ? 0 : sinceBreak == null ? null : sinceBreak + 1;
    sinceAccept = accE ? 0 : sinceAccept == null ? null : sinceAccept + 1;
    if (!r.confirmed) { out.push(null); continue; }
    const w = !!r.warmed;
    const flipE = has(ev, MASKS.flipEngine), rejE = has(ev, MASKS.rejectEngine);
    const f = [
      w && brkE, w && accE, w && rejE, w && flipE, w && has(ev, MASKS.strongAlert),
      w && brkE !== has(ev, MASKS.breakAlert), w && accE !== has(ev, MASKS.acceptAlert),
      w && rejE !== has(ev, MASKS.rejectAlert), w && flipE !== has(ev, MASKS.flipAlert),
      w && has(r.obsState, MASKS.obsEvent) !== has(ev, MASKS.strongAlert),
      w && accE && (sinceBreak == null || sinceBreak > ACCEPT_LOOKBACK),
      w && flipE && (sinceAccept == null || sinceAccept > FLIP_LOOKBACK),
      w,
    ].map((b) => (b ? 1 : 0));
    ring.push(f);
    f.forEach((x, k) => { sums[k] += x; });
    if (ring.length > W) { const old = ring.shift(); old.forEach((x, k) => { sums[k] -= x; }); }
    out.push({
      EVT: pack(sums.slice(0, 5)),
      MISMATCH: pack(sums.slice(5, 10)),
      CAUSAL: pack([sums[10], sums[11], sums[12]]),
      INV: packInv(r.violationsTotal, r.violationsCritical),
    });
  }
  return out;
}

// Table text (the Pine diagnostic cell) → { bar, EVT, MISMATCH, CAUSAL, INV }. Accepts the
// cell pasted with newlines or spaces; INV may be "na" (overflow). Refuses anything else.
export function parseDiagTable(text) {
  const t = String(text).trim();
  if (!t.startsWith('GTGDIAG v1')) throw new Error('not a GTGDIAG v1 table');
  const out = {};
  for (const m of t.matchAll(/\b(BAR|EVT|MISMATCH|CAUSAL|INV)=([0-9]+|na)\b/g)) out[m[1]] = m[2] === 'na' ? null : Number(m[2]);
  for (const k of ['BAR', 'EVT', 'MISMATCH', 'CAUSAL', 'INV']) if (!(k in out)) throw new Error(`missing ${k}=`);
  return { bar: out.BAR, EVT: out.EVT, MISMATCH: out.MISMATCH, CAUSAL: out.CAUSAL, INV: out.INV };
}

export function formatDiagTable(barTime, v) {
  const f = (x) => (x == null ? 'na' : String(x));
  return `GTGDIAG v1\nBAR=${f(barTime)}\nEVT=${f(v.EVT)}\nMISMATCH=${f(v.MISMATCH)}\nCAUSAL=${f(v.CAUSAL)}\nINV=${f(v.INV)}`;
}

