// Compares Pine log captures (GTGSNAP v3) bar by bar at the requested equivalence
// levels, checks coverage, and checks the hashes Pine printed against the hashes the
// JS reference computes from the same captured raw fields (a check of the Pine hash
// code on real data).
//
// Usage:
//   node compare-captures.mjs A.txt [B.txt] [--levels geometry|identity|state|events,...]
//        [--expect-times times.txt | --expect-from <ms> --expect-to <ms> --step-ms <ms>]
//        [--intersection-ok]
//
// Failure (exit 1) when any of:
//   - a captured bar is INCOMPLETE (a line of the bar is missing or duplicated);
//   - a Pine hash differs from the JS hash of the same captured fields;
//   - with an expectation: an expected bar is MISSING entirely, or an unexpected bar is present;
//   - with two files: a bar present in only one file (unless --intersection-ok), or any
//     field-by-field difference at the requested levels, or different alert bits.
// --expect-times: one bar-open time in ms per line (use it for sessions with gaps).
// --expect-from/--expect-to/--step-ms: a continuous window (24/7 symbols only).
// GTGSNAP is a short-window diagnostic (Pine Logs keeps at most 10,000 historical
// messages per script; one bar costs 9 + nLevels + ceil(ring/16) messages). It is not a
// substitute for the long-range CSV export.
import { readFileSync } from 'node:fs';
import { parseCapture } from '../../reference/capture.mjs';
import { compareSnapshots, hashSlots, hashState } from '../../reference/snapshot.mjs';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const flag = (name) => args.includes(name);
const valued = new Set(['--levels', '--expect-times', '--expect-from', '--expect-to', '--step-ms']);
const files = args.filter((a, i) => !a.startsWith('--') && !valued.has(args[i - 1]));
const levels = (opt('--levels') ?? 'state,events').split(',');
if (files.length < 1 || files.length > 2) { console.error('usage: compare-captures.mjs A.txt [B.txt] [options]'); process.exit(2); }

let expected = null;
if (opt('--expect-times')) {
  expected = readFileSync(opt('--expect-times'), 'utf8').split(/\s+/).filter(Boolean).map(Number);
} else if (opt('--expect-from') || opt('--expect-to') || opt('--step-ms')) {
  const from = Number(opt('--expect-from')), to = Number(opt('--expect-to')), step = Number(opt('--step-ms'));
  if (!(from > 0 && to >= from && step > 0)) { console.error('--expect-from, --expect-to and --step-ms must all be given'); process.exit(2); }
  expected = [];
  for (let t = from; t <= to; t += step) expected.push(t);
}

let failures = 0;
const caps = files.map((f) => {
  const cap = parseCapture(readFileSync(f, 'utf8'));
  let incomplete = 0, hashMismatch = 0, missing = 0, unexpected = 0;
  for (const [t, r] of cap) {
    if (!r.complete) { incomplete++; console.log(`${f} ${t} INCOMPLETE BAR: ${r.problems.join('; ')}`); continue; }
    const hs = hashSlots(r.snapshot), hst = hashState(r.snapshot);
    if (hs !== r.declared.hashSlots || hst !== r.declared.hashState) {
      hashMismatch++;
      console.log(`${f} ${t} HASH pine=(${r.declared.hashSlots},${r.declared.hashState}) js=(${hs},${hst})`);
    }
  }
  if (expected) {
    const want = new Set(expected);
    for (const t of expected) if (!cap.has(t)) { missing++; console.log(`${f} ${t} MISSING BAR (expected, no line at all)`); }
    for (const t of cap.keys()) if (!want.has(t)) { unexpected++; console.log(`${f} ${t} UNEXPECTED BAR`); }
  }
  console.log(`${f}: bars=${cap.size} incomplete=${incomplete} missing=${expected ? missing : 'not checked'} unexpected=${expected ? unexpected : 'not checked'} pineVsJsHashMismatch=${hashMismatch}`);
  failures += incomplete + hashMismatch + missing + unexpected;
  return cap;
});

if (caps.length === 2) {
  const [A, B] = caps;
  const common = [...A.keys()].filter((t) => B.has(t)).sort((x, y) => x - y);
  const onlyA = [...A.keys()].filter((t) => !B.has(t)).sort((x, y) => x - y);
  const onlyB = [...B.keys()].filter((t) => !A.has(t)).sort((x, y) => x - y);
  for (const t of onlyA) console.log(`ONLY_A ${t} (bar missing from ${files[1]})`);
  for (const t of onlyB) console.log(`ONLY_B ${t} (bar missing from ${files[0]})`);
  let differing = 0;
  for (const t of common) {
    const d = compareSnapshots(A.get(t).snapshot, B.get(t).snapshot, levels);
    const alertDiff = levels.includes('events') && A.get(t).alertBits !== B.get(t).alertBits;
    if (d.length || alertDiff) {
      differing++;
      console.log(`DIFF ${t}: ${d.slice(0, 8).map((x) => `${x.path}[${x.kind}] ${x.a} ≠ ${x.b}`).join(' | ')}${alertDiff ? ` | alertBits ${A.get(t).alertBits} ≠ ${B.get(t).alertBits}` : ''}`);
    }
  }
  const intersectionOk = flag('--intersection-ok');
  console.log(`levels=${levels.join(',')} common=${common.length} differing=${differing} onlyA=${onlyA.length} onlyB=${onlyB.length}${intersectionOk ? ' (intersection-ok: onlyA/onlyB not counted)' : ''}`);
  failures += differing + (intersectionOk ? 0 : onlyA.length + onlyB.length);
}
console.log(failures ? `RESULT FAIL (${failures})` : 'RESULT OK');
process.exit(failures ? 1 : 0);
