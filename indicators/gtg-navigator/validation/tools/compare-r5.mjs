// E41: compares the R5 fingerprint of two or more loads.
// Each argument is a file holding the pasted GTGDIAG cell, or the cell text itself.
// Usage: node compare-r5.mjs A.txt B.txt C.txt
// Exit 0 only if every tuple is identical, cold = 0 and n > 0.
import { existsSync, readFileSync } from 'node:fs';
import { parseR5, formatR5, r5Verdict } from '../../reference/diag.mjs';

const args = process.argv.slice(2);
if (args.length < 2) { console.error('usage: compare-r5.mjs A.txt B.txt [C.txt …]'); process.exit(2); }
const fps = args.map((a, i) => {
  const fp = parseR5(existsSync(a) ? readFileSync(a, 'utf8') : a);
  console.log(`reading ${i + 1} (${existsSync(a) ? a : 'text'}): ${formatR5(fp)}`);
  return fp;
});
const v = r5Verdict(fps);
for (const p of v.problems) console.log(`PROBLEM ${p}`);
console.log(v.pass ? 'RESULT OK' : `RESULT FAIL (${v.problems.length})`);
process.exit(v.pass ? 0 : 1);
