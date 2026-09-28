// Decodes the four rolling diagnostics read from the Data Window on the last closed bar.
// Usage: node decode-diag.mjs <v_diagEvt1000> <v_diagMismatch1000> <v_diagCausal1000> <v_diagInv1000>
// Values must be copied as exact integers (no separators, no abbreviations such as 1.1T);
// the decoder refuses a value whose fields exceed the 1000-bar window.
import { decodeDiag } from '../../reference/diag.mjs';

const names = ['v_diagEvt1000', 'v_diagMismatch1000', 'v_diagCausal1000', 'v_diagInv1000'];
const vals = process.argv.slice(2).map((s) => Number(String(s).replace(/[\s,]/g, '')));
if (vals.length !== 4 || vals.some((v) => !Number.isFinite(v))) { console.error('usage: decode-diag.mjs <evt> <mismatch> <causal> <inv>'); process.exit(2); }
const d = decodeDiag(Object.fromEntries(names.map((n, i) => [n, vals[i]])));
const n = d.warmedConfirmedCount;
for (const [k, v] of Object.entries(d)) console.log(`${k.padEnd(34)} ${String(v).padStart(5)}${n && !['warmedConfirmedCount'].includes(k) ? `   (${(1000 * v / n).toFixed(2)} per 1000 warmed bars)` : ''}`);
