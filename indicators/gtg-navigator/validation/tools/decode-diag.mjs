// Decodes the rolling diagnostics shown in the validation-only GTGDIAG table (Pine 18b).
// Usage:
//   node decode-diag.mjs "<pasted table text>"                 (GTGDIAG v1 … EVT= … INV=)
//   node decode-diag.mjs <EVT> <MISMATCH> <CAUSAL> <INV|na>
// Values must be exact integers; the decoder refuses fields outside their bounds.
import { decodeDiag, parseDiagTable } from '../../reference/diag.mjs';

const args = process.argv.slice(2);
let v;
if (args.length === 1) v = parseDiagTable(args[0]);
else if (args.length === 4) {
  const num = (s) => (s === 'na' ? null : Number(String(s).replace(/[\s,]/g, '')));
  v = { EVT: num(args[0]), MISMATCH: num(args[1]), CAUSAL: num(args[2]), INV: num(args[3]) };
} else { console.error('usage: decode-diag.mjs "<GTGDIAG table text>" | <EVT> <MISMATCH> <CAUSAL> <INV|na>'); process.exit(2); }
if (v.bar != null) console.log(`bar open time (ms)                 ${v.bar}  (${new Date(v.bar).toISOString()})`);
if (v.INV == null) console.log('INV = na: invariant counter outside [0, 2^26) — read raw v_invTotal / v_invCritical');
const d = decodeDiag(v);
const n = d.warmedConfirmedCount;
for (const [k, x] of Object.entries(d)) console.log(`${k.padEnd(34)} ${String(x).padStart(8)}${n && k !== 'warmedConfirmedCount' && !k.startsWith('maxInv') ? `   (${(1000 * x / n).toFixed(2)} per 1000 warmed bars)` : ''}`);
