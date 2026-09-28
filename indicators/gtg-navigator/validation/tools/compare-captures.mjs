// Compares Pine log captures (GTGSNAP v1) bar by bar at the requested equivalence
// levels, and checks the hashes Pine printed against the hashes the JS reference
// computes from the same captured raw fields (a check of the Pine hash code).
//
// Usage:
//   node compare-captures.mjs A.txt [B.txt] [--levels geometry|identity|state|events,...]
// With one file: completeness + Pine↔JS hash check only.
// With two files: the same for each, then a field-by-field comparison at every time
// present in both (times present in only one file are listed, not compared).
import { readFileSync } from 'node:fs';
import { parseCapture } from '../../reference/capture.mjs';
import { compareSnapshots, hashSlots, hashLevels } from '../../reference/snapshot.mjs';

const args = process.argv.slice(2);
const li = args.indexOf('--levels');
const levels = li >= 0 ? args[li + 1].split(',') : ['state', 'events'];
const files = args.filter((a, i) => !a.startsWith('--') && (li < 0 || i !== li + 1));
if (files.length < 1 || files.length > 2) { console.error('usage: compare-captures.mjs A.txt [B.txt] [--levels ...]'); process.exit(2); }

let failures = 0;
const caps = files.map((f) => {
  const cap = parseCapture(readFileSync(f, 'utf8'));
  let incomplete = 0, hashMismatch = 0;
  for (const [t, r] of cap) {
    if (!r.complete) { incomplete++; console.log(`${f} ${t} INCOMPLETE: ${r.problems.join('; ')}`); continue; }
    const hs = hashSlots(r.snapshot), hl = hashLevels(r.snapshot);
    if (hs !== r.declared.hashSlots || hl !== r.declared.hashLevels) {
      hashMismatch++;
      console.log(`${f} ${t} HASH pine=(${r.declared.hashSlots},${r.declared.hashLevels}) js=(${hs},${hl})`);
    }
  }
  console.log(`${f}: bars=${cap.size} incomplete=${incomplete} pineVsJsHashMismatch=${hashMismatch}`);
  failures += incomplete + hashMismatch;
  return cap;
});

if (caps.length === 2) {
  const [A, B] = caps;
  const common = [...A.keys()].filter((t) => B.has(t)).sort((x, y) => x - y);
  const onlyA = [...A.keys()].filter((t) => !B.has(t));
  const onlyB = [...B.keys()].filter((t) => !A.has(t));
  let differing = 0;
  for (const t of common) {
    const d = compareSnapshots(A.get(t).snapshot, B.get(t).snapshot, levels);
    const alertDiff = levels.includes('events') && A.get(t).alertBits !== B.get(t).alertBits;
    if (d.length || alertDiff) {
      differing++;
      console.log(`DIFF ${t}: ${d.slice(0, 8).map((x) => `${x.path}[${x.kind}] ${x.a} ≠ ${x.b}`).join(' | ')}${alertDiff ? ` | alertBits ${A.get(t).alertBits} ≠ ${B.get(t).alertBits}` : ''}`);
    }
  }
  console.log(`levels=${levels.join(',')} common=${common.length} differing=${differing} onlyA=${onlyA.length} onlyB=${onlyB.length}`);
  failures += differing;
}
process.exit(failures ? 1 : 0);
