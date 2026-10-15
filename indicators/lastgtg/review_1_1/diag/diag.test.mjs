// node --test indicators/lastgtg/review_1_1/diag/diag.test.mjs
// Gate 4: the diagnostic copies add exports only (../TEST_PREREGISTRATION.md, gate 4).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES, MARK, CALC_BARS, build } from './build-diag.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const sha = (s) => createHash('sha256').update(s).digest('hex');
const manifest = JSON.parse(readFileSync(join(here, 'manifest.json'), 'utf8'));

for (const v of ['A', 'B', 'C']) {
  test(`${v}: copy = frozen file, renamed, plus one appended block; files as in the manifest`, () => {
    const out = readFileSync(join(here, `lastgtg_${v}_diag.pine`), 'utf8');
    const src = readFileSync(SOURCES[v], 'utf8').replace(/\r\n/g, '\n');
    assert.equal(sha(src), manifest.files[v].frozenSha256, 'frozen file changed');
    assert.equal(sha(out), manifest.files[v].diagSha256);
    assert.equal(out, build(v).out);
    const k = out.indexOf('\n\n\n' + MARK);
    assert.ok(k > 0);
    const head = out.slice(0, k + 1).split('\n'), orig = src.split('\n');
    // One inserted declaration line (calc_bars_count), right after the short title.
    const ins = head.findIndex((l) => l === `     calc_bars_count = ${CALC_BARS},`);
    assert.ok(ins > 0 && /^ {5}shorttitle = /.test(head[ins - 1]));
    head.splice(ins, 1);
    assert.equal(head.length, orig.length);
    const changed = head.map((l, i) => (l === orig[i] ? null : i)).filter((i) => i !== null);
    assert.equal(changed.length, 2, 'only the title and short title lines differ');
    for (const i of changed) assert.match(orig[i], /^ {5}("lastgtg|shorttitle = ")/);
  });

  test(`${v}: the block declares new names only and calls only Data Window plots`, () => {
    const out = readFileSync(join(here, `lastgtg_${v}_diag.pine`), 'utf8');
    const block = out.slice(out.indexOf(MARK)).split('\n').filter((l) => l.trim() && !l.trim().startsWith('//'));
    for (const l of block) {
      const s = l.trim();
      const asg = s.match(/^([A-Za-z_]\w*)\s*:=/);
      if (asg) { assert.match(asg[1], /^dg/, l); continue; }
      const decl = s.match(/^(?:var\s+)?(?:int|bool|float)\s+([A-Za-z_]\w*)\s*=/);
      if (decl) { assert.match(decl[1], /^dg/, l); continue; }
      if (/^(if|else if|else)\b/.test(s)) continue;
      assert.match(s, /^plot\(.*, "m_\w+", display = display\.data_window\)$/, l);
    }
    const src = readFileSync(SOURCES[v], 'utf8');
    assert.ok(!/\bdg[A-Z]\w*/.test(src), 'frozen file uses no dg names');
    // TradingView counts plots and alertconditions together; the limit is 64 (RE10140).
    const budget = (out.match(/^plot\(/gm) || []).length + (out.match(/^alertcondition\(/gm) || []).length;
    assert.ok(budget <= 64, `plot budget ${budget} > 64`);
  });
}

test('A: the copied lamp chain has the conditions of A §16 in the same order', () => {
  const a = readFileSync(SOURCES.A, 'utf8').split('\n');
  const from = a.findIndex((l) => l.trim() === 'int lamp = 1');
  const to = a.findIndex((l, i) => i > from && l.trim().startsWith('string dirText'));
  const conds = (lines) => lines.map((l) => l.trim()).filter((s) => /^(if|else if)\b/.test(s));
  const orig = conds(a.slice(from, to));
  const out = readFileSync(join(here, 'lastgtg_A_diag.pine'), 'utf8').split('\n');
  const f2 = out.findIndex((l) => l.trim() === 'int dgLampA = 1');
  const t2 = out.findIndex((l, i) => i > f2 && l.startsWith('// Episode rule'));
  assert.deepEqual(conds(out.slice(f2, t2)), orig);
  assert.equal(orig.length, 14);
  // Lamp values per branch: A sets 2 on the first and last branch, 0 on branches 2–4, 1 elsewhere.
  const lampsOf = (lines, name) => { const r = []; let cur = null; for (const l of lines) { const s = l.trim(); if (/^(if|else if)\b/.test(s)) { if (cur) r.push(cur); cur = '1'; } const m = s.match(new RegExp(`^${name} := (\\d)`)); if (m) cur = m[1]; } r.push(cur); return r; };
  assert.deepEqual(lampsOf(out.slice(f2, t2), 'dgLampA'), lampsOf(a.slice(from, to), 'lamp'));
});
