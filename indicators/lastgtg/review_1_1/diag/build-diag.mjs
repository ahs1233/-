// Gate 4 of ../TEST_PREREGISTRATION.md: export-only copies of A, B and C for the parity run.
//   node build-diag.mjs            writes lastgtg_{A,B,C}_diag.pine, <v>_to_diag.diff, manifest.json
// Each copy = the frozen file with (1) its indicator title and short title renamed and (2) one
// block appended at the very end. The block declares new names only (prefix dg), never assigns
// a name of the frozen file, and calls nothing but plot(..., display = display.data_window).
// For A it also repeats A's lamp chain at global scope (A computes it only inside
// barstate.islast), reading the same variables, so the lamp can be exported on every bar.
// diag.test.mjs checks all of this on the generated files.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const SOURCES = {
  A: join(here, '../../lastgtg.pine'),
  B: join(here, '../build/lastgtg_B_1_1.pine'),
  C: join(here, '../build/lastgtg_C_1_1.pine'),
};
const TITLES = {
  A: ['"lastgtg — Structural Zone Engine (based on GTG v0.4.7)"', '"lastgtg"'],
  B: ['"lastgtg B 1.1 — Structural Zone Engine"', '"lastgtg B"'],
  C: ['"lastgtg C 1.1 — Structural Zone Engine"', '"lastgtg C"'],
};
const sha = (s) => createHash('sha256').update(s).digest('hex');

// Exported columns: [title, expression]. Titles are the column names the extractor reads.
// Plot budget: TradingView counts plots and alertconditions together (limit 64). B and C hold
// 20 plots + 12 alertconditions, so the block adds at most 32 plots: the four slot codes share
// one plot and engineOn is bit 128 of m_events (RE10140 on the first B run: 71 > 64).
const SLOT = (n, v) => [
  [`m_${n}_lo`, `${v}.active ? ${v}.lo : na`],
  [`m_${n}_hi`, `${v}.active ? ${v}.hi : na`],
  [`m_${n}_q`, `${v}.active ? ${v}.quality : na`],
];
const code = (v) => `(${v}.active ? (${v}.containing ? 2 : 1) : 0)`;
export const COMMON = [
  ['m_open', 'open'], ['m_high', 'high'], ['m_low', 'low'], ['m_close', 'close'], ['m_volume', 'volume'],
  ['m_headingScore', 'headingScore'], ['m_routeScore', 'routeScore'], ['m_speedScore', 'speedScore'],
  ['m_instantSpeedScore', 'instantSpeedScore'], ['m_fuelScore', 'fuelScore'], ['m_fuelAcceleration', 'fuelAcceleration'],
  ['m_atrEng', 'atrEng'],
  ['m_htfClose', 'htfClose'], ['m_htfMA50', 'htfMA50'], ['m_htfMA200', 'htfMA200'], ['m_htfATR', 'htfATR'],
  ['m_obstacleRole', 'obstacleRole'], ['m_nearestObstacleAtr', 'nearestObstacleAtr'],
  ...SLOT('R1', 'slotR1'), ...SLOT('R2', 'slotR2'), ...SLOT('S1', 'slotS1'), ...SLOT('S2', 'slotS2'),
  ['m_slotCodes', `${code('slotR1')} + 3 * ${code('slotR2')} + 9 * ${code('slotS1')} + 27 * ${code('slotS2')}`],
  ['m_events', 'dgEvents'],
];
// Engine events of this bar as bits (the same events the lamp's held copies take on a closed bar).
const EVENTS = `int dgEvents = (breakResistance ? 1 : 0) + (breakSupport ? 2 : 0) + (breakAcceptedUp ? 4 : 0) + (breakAcceptedDn ? 8 : 0) + (rejectResistance ? 16 : 0) + (rejectSupport ? 32 : 0) + (flipConfirmedEvent ? 64 : 0) + (engineOn ? 128 : 0)`;

// A's lamp chain of §16, line for line, with a branch code instead of the text. The code → text
// table (A_REASON_TEXT) gives back A's own words, which is what the JS lampOf returns.
export const A_REASON_TEXT = {
  0: 'أدلة مختلطة', 1: 'اختراق مؤكد', 2: 'كسر مؤكد', 3: 'لا تطارد', 4: 'داخل مقاومة', 5: 'داخل دعم', 6: 'داخل منطقة',
  7: 'عكس المسار العام', 8: 'كسر يحتاج تأكيد', 9: 'رفض من مقاومة', 10: 'ارتداد من دعم',
  11: 'مقاومة قريبة', 12: 'دعم قريب', 13: 'منطقة قريبة', 14: 'مقاومة أمامه', 15: 'دعم أمامه',
  16: 'الزخم يضعف', 17: 'بدون اتجاه واضح', 18: 'المسار العام غير واضح', 19: 'الوقود ضعيف',
  20: 'مقاومة أمامه', 21: 'دعم أمامه', 22: 'الاتجاه متوافق',
};
const A_LAMP = `int dgLampA = 1
int dgCodeA = 0
if heldAccUp or heldAccDn
    dgCodeA := heldAccUp ? 1 : 2
    dgLampA := 2
else if noChase
    dgCodeA := 3
    dgLampA := 0
else if priceInsideObstacle
    dgCodeA := obstacleRole == 1 ? 4 : obstacleRole == -1 ? 5 : 6
    dgLampA := 0
else if routeSign != 0 and headingSign != 0 and routeSign != headingSign
    dgCodeA := 7
    dgLampA := 0
else if heldBrkR or heldBrkS
    dgCodeA := 8
else if heldRejR or heldRejS
    dgCodeA := heldRejR ? 9 : 10
else if obstacleNear or candleTouchesObstacle
    dgCodeA := obstacleRole == 1 ? 11 : obstacleRole == -1 ? 12 : 13
else if movingTowardResistance or movingTowardSupport
    dgCodeA := movingTowardResistance ? 14 : 15
else if fuelExhaustion
    dgCodeA := 16
else if headingSign == 0
    dgCodeA := 17
else if routeSign == 0
    dgCodeA := 18
else if fuelScore < fuelLowThreshold
    dgCodeA := 19
else if headingSign == routeSign and obstacleAvailable and nearestObstacleAtr * atrEng < greenRoomHtfAtr * safeHtfAtr
    dgCodeA := obstacleRole == 1 ? 20 : 21
else if headingSign == routeSign
    dgCodeA := 22
    dgLampA := 2
// Episode rule of the contract on A's lamp (the B/C gtgGreenStart rule; lamp 1 while the engine is off).
var int dgLampClosedA = 1
var int dgHeadingClosedA = 0
if barstate.isconfirmed
    dgLampClosedA := engineOn ? dgLampA : 1
    dgHeadingClosedA := headingSign
bool dgStartA = engineStep and dgLampClosedA == 2 and (nz(dgLampClosedA[1], 1) != 2 or dgHeadingClosedA != nz(dgHeadingClosedA[1], 0))
`;
const A_COLS = [['m_lampA', 'engineOn ? dgLampClosedA : na'], ['m_codeA', 'engineOn ? dgCodeA : na'], ['m_startA', 'dgStartA ? 1 : 0']];

export const CALC_BARS = 3000;
export const MARK = '// ==== GATE 4 DIAGNOSTIC EXPORTS (export only; added by review_1_1/diag/build-diag.mjs) ====';

export function blockFor(v) {
  const cols = v === 'A' ? [...COMMON, ...A_COLS] : COMMON;
  const lines = ['', '', MARK, '// Nothing below is read by the indicator. New names only; plots go to the Data Window.', EVENTS];
  if (v === 'A') lines.push(A_LAMP.trimEnd());
  for (const [t, e] of cols) lines.push(`plot(${e}, "${t}", display = display.data_window)`);
  return { text: lines.join('\n') + '\n', cols: cols.map((c) => c[0]) };
}

export function build(v) {
  const src = readFileSync(SOURCES[v], 'utf8').replace(/\r\n/g, '\n');
  const [title, short] = TITLES[v];
  const t1 = `     ${title},\n     shorttitle = ${short},`;
  if (src.split(t1).length !== 2) throw new Error(`${v}: title lines not found exactly once`);
  // calc_bars_count: a run setting, not logic. TradingView keeps only the last ~3,032 study rows
  // in the chart; without it the study had computed on older bars it never sent (warm values and
  // live zones on the first exported row, 2026-10-15 run 1), so no replay could start where Pine
  // started. With it Pine computes on exactly the bars that are exported.
  const renamed = src.replace(t1, `     "lastgtg ${v} diag gate4 — export only",\n     shorttitle = "lastgtg ${v} diag",\n     calc_bars_count = ${CALC_BARS},`);
  const { text, cols } = blockFor(v);
  const body = renamed.endsWith('\n') ? renamed : renamed + '\n';
  return { src, out: body + text, cols };
}

// The same copy without calc_bars_count, for the 3000-bar check (TradingView's own history):
// frozen file + renamed title + the same export block. Used for A, whose frozen file exports no lamp.
export function buildFull(v) {
  const { src, out } = build(v);
  const line = `     calc_bars_count = ${CALC_BARS},\n`;
  if (out.split(line).length !== 2) throw new Error('calc line not found once');
  return { src, out: out.replace(line, '').replace(`"lastgtg ${v} diag gate4 — export only"`, `"lastgtg ${v} diag full — export only"`).replace(`shorttitle = "lastgtg ${v} diag"`, `shorttitle = "lastgtg ${v} full"`) };
}

if (process.argv[1] && process.argv[1].endsWith('build-diag.mjs')) {
  const manifest = { built: new Date().toISOString().slice(0, 10), files: {} };
  for (const v of ['A', 'B', 'C']) {
    const { src, out, cols } = build(v);
    const name = `lastgtg_${v}_diag.pine`;
    writeFileSync(join(here, name), out);
    let diff = '';
    try { execFileSync('diff', ['-u', '--label', `frozen_${v}`, '--label', name, SOURCES[v], join(here, name)]); } catch (e) { diff = e.stdout.toString(); }
    writeFileSync(join(here, `${v}_to_diag.diff`), diff);
    const plots = (out.match(/^plot\(/gm) || []).length + (out.match(/^alertcondition\(/gm) || []).length;
    manifest.files[v] = { frozen: SOURCES[v].replace(join(here, '../..') + '/', ''), frozenSha256: sha(src), diag: name, diagSha256: sha(out), exportColumns: cols, plotsTotal: plots };
    console.log(v, name, sha(out).slice(0, 12), 'plots', plots, 'cols', cols.length);
  }
  const full = buildFull('A');
  writeFileSync(join(here, 'lastgtg_A_diag_full.pine'), full.out);
  let fdiff = '';
  try { execFileSync('diff', ['-u', '--label', 'frozen_A', '--label', 'lastgtg_A_diag_full.pine', SOURCES.A, join(here, 'lastgtg_A_diag_full.pine')]); } catch (e) { fdiff = e.stdout.toString(); }
  writeFileSync(join(here, 'A_to_diag_full.diff'), fdiff);
  manifest.files.A_full = { frozen: manifest.files.A.frozen, frozenSha256: manifest.files.A.frozenSha256, diag: 'lastgtg_A_diag_full.pine', diagSha256: sha(full.out), note: 'no calc_bars_count; for the 3000-bar check' };
  console.log('A_full', sha(full.out).slice(0, 12));
  writeFileSync(join(here, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
}
