// Static contract checks on the Pine source. They read gtg_navigator_v0.4.7.pine as
// text; they do not compile or run Pine (compile/runtime evidence comes only from
// TradingView). Run: node --test indicators/gtg-navigator/reference/pine-contract.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { HASH_P } from './snapshot.mjs';

const dir = fileURLToPath(new URL('..', import.meta.url));
const pine = readFileSync(`${dir}/gtg_navigator_v0.4.7.pine`, 'utf8');
const gitBlob = (buf) => createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf])).digest('hex');

// Body of a top-level Pine function: lines after "name(" up to the next non-indented line.
function fnBody(name) {
  const lines = pine.split('\n');
  const i = lines.findIndex((l) => l.startsWith(`${name}(`));
  assert.ok(i >= 0, `function ${name} not found`);
  const body = [];
  for (let j = i + 1; j < lines.length && (lines[j].startsWith(' ') || lines[j] === ''); j++) body.push(lines[j]);
  return body;
}
const stepArgs = (body) => body.map((l) => l.match(/hashStep\(h0?, (.+)\)\s*$/)).filter(Boolean).map((m) => m[1]);

test('C1 hash constants match the JS reference', () => {
  assert.match(pine, new RegExp(`^HASH_P = ${HASH_P}$`, 'm'));
  assert.match(pine, /^HASH_B = 1000003$/m);
  assert.match(pine, /^HASH_K = 131071$/m);
});

test('C2 hashLevel field order equals the per-level part of encodeState (snapshot.mjs)', () => {
  // Same order as encodeState: key, source, tfRank, typ, birthTime, price ticks, state,
  // polarity, lo/hi ticks, s, mitigation, evidence, tests, ageNative, epActive, epSide,
  // epMaxDepth, breakDir, breakCloses, breakFromFlip, backCloses, sinceTest, sinceState, sinceBack.
  assert.deepEqual(stepArgs(fnBody('hashLevel')), [
    'lv.key', 'lv.source', 'lv.tfRank', 'lv.typ', 'lv.birthTime', 'toTicks(lv.price)', 'lv.state', 'lv.polarity', 'toTicks(lv.lo)', 'toTicks(lv.hi)', 'q6(lv.s)', 'q6(lv.mitigation)', 'q6(lv.evidence)',
    'lv.tests', 'lv.ageNative', 'lv.epActive ? 1 : 0', 'lv.epSide', 'q6(lv.epMaxDepth)', 'lv.breakDir', 'lv.breakCloses',
    'lv.breakFromFlip ? 1 : 0', 'lv.backCloses', 'sinceOr(lv.lastTestChartBar)', 'sinceOr(lv.stateChartBar)', 'sinceOr(lv.backStartChartBar)',
    'lv.navArmed ? 1 : 0',
  ]);
});

test('C3 hashSlot field order equals encodeSlots (snapshot.mjs)', () => {
  assert.deepEqual(stepArgs(fnBody('hashSlot')), [
    '0', '1', 'ss.containing ? 1 : 0', 'ss.side', 'toTicks(ss.lo)', 'toTicks(ss.hi)', 'ss.primaryKey',
    'math.round(ss.gateQ * 100)', 'math.round(ss.quality * 100)',
  ]);
  const body = fnBody('hashSlot').join('\n');
  assert.match(body, /hashKeyList\(h, lastK, scratch\)[\s\S]*hashKeyList\(h, entryK, scratch\)/);
});

test('C4 the linear slotDigest and cumulative checksum are gone', () => {
  assert.doesNotMatch(pine, /slotDigest|CHECKSUM_MOD|slotChecksum|hashLevels/);
});

test('C8 hashState folds trackers then the OHLC ring (age order), as encodeState does', () => {
  const block = pine.slice(pine.indexOf('hl := hashTracker(hl, lastSwingHighPx'), pine.indexOf('tel.hashState := hl'));
  const order = ['hashTracker(hl, lastSwingHighPx', 'hashTracker(hl, lastSwingLowPx', 'hashStep(hl, nRing)',
    'toTicks(array.get(ringO, k))', 'toTicks(array.get(ringH, k))', 'toTicks(array.get(ringL, k))', 'toTicks(array.get(ringC, k))'];
  let at = -1;
  for (const s of order) { const i = block.indexOf(s); assert.ok(i > at, `${s} missing or out of order`); at = i; }
});

test('C9 capture prints GTGSNAP v3 with the identity fields, RING, OBS and navArmed', () => {
  assert.match(pine, /"GTGSNAP\|v3\|"/);
  assert.match(pine, /sinceText\(lv\.backStartChartBar\) \+ "\|" \+ \(lv\.navArmed \? "1" : "0"\)/);
  assert.match(pine, /log\.info\(pre \+ "OBS\|" \+/);
  assert.match(pine, /"LVL\|" \+ fi\(lv\.key\) \+ "\|" \+ fi\(lv\.source\) \+ "\|" \+ fi\(lv\.tfRank\) \+ "\|" \+ fi\(lv\.typ\) \+ "\|" \+ fi\(lv\.birthTime\) \+ "\|" \+ f10\(lv\.price\)/);
  assert.match(pine, /^RING_CHUNK = 16$/m);
});

test('C5 source plot-type calls ≤ 64 and export names (a call count, not the actual TradingView plot count)', () => {
  const plots = pine.match(/^\s*(plot|plotshape|plotchar|plotarrow|plotcandle|plotbar|bgcolor|barcolor|fill|hline)\(/gm) || [];
  assert.ok(plots.length <= 64, `plot-type outputs: ${plots.length}`);
  for (const name of ['v_hashSlots', 'v_hashState', 'v_eventBits', 'v_obsState', 'v_loR1', 'v_hiR1', 'v_loR2', 'v_hiR2', 'v_loS1', 'v_hiS1', 'v_loS2', 'v_hiS2']) {
    assert.ok(pine.includes(`"${name}"`), `missing export ${name}`);
  }
});

test('C6 R2 anchors: Pine floors that the reference mirrors are still present', () => {
  assert.match(pine, /float width = math\.max\(lv\.hi - lv\.lo, syminfo\.mintick\)/);
  assert.match(pine, /atrEng = math\.max\(nz\(ta\.sma\(ta\.tr\(true\), ATR_ENG_LEN\), ta\.tr\(true\)\), syminfo\.mintick\)/);
  assert.match(pine, /float atrA1 = na\(a1AtrRaw\) \? na : math\.max\(a1AtrRaw, syminfo\.mintick\)/);
});

test('C7 legacy v0.4.6 file is unchanged', () => {
  const legacy = readFileSync(`${dir}/gtg_navigator_v0.4.6.pine`);
  assert.equal(gitBlob(legacy), '3dab279af76fc0dbf65fb2bcc1498b32f613c117');
});

test('C10 R3 guard: Pine refuses Q_stay > Q_enter on the first bar with runtime.error', () => {
  assert.match(pine, /^if barstate\.isfirst and qStay > qEnter\n    runtime\.error\("GTG Navigator: Q_stay/m);
  // The inputs themselves keep their ranges: the contract is the relation, not a clamp.
  assert.match(pine, /^qStay = input\.float\(45\.0, /m);
  assert.match(pine, /^qEnter = input\.float\(55\.0, /m);
});

test('C11 consumers.mjs transcribes these Pine lines verbatim (fails if Pine changes them)', () => {
  assert.equal((pine.match(/^alertcondition\(/gm) || []).length, 10);
  const lines = [
    'string speedClass = speedScore < speedSlowThreshold ? "بطيئة" : speedScore < speedFastThreshold ? "طبيعية" : speedScore < speedExtremeThreshold ? "سريعة" : "استثنائية"',
    'color speedColor = speedScore >= speedExtremeThreshold ? color.orange : speedScore >= speedFastThreshold ? color.yellow : color.white',
    'speedBurst = barstate.isconfirmed and speedScore >= speedExtremeThreshold and speedScore[1] < speedExtremeThreshold',
    'int headingSign = headingScore > headingClearThreshold ? 1 : headingScore < -headingClearThreshold ? -1 : 0',
    'string headingText = headingScore >= headingStrongThreshold ? "↑ صاعد بقوة" :\n     headingScore > headingClearThreshold ? "↗ صاعد" :\n     headingScore <= -headingStrongThreshold ? "↓ هابط بقوة" :\n     headingScore < -headingClearThreshold ? "↘ هابط" :\n     headingStrength <= headingDeadZone ? "→ غير حاسم" :\n     headingScore > 0 ? "↗ ميل صاعد ضعيف" : "↘ ميل هابط ضعيف"',
    'headingStrength = math.abs(headingScore)',
    'int routeSign = routeScore > routeClearThreshold ? 1 : routeScore < -routeClearThreshold ? -1 : 0',
    'string routeText = routeScore >= routeStrongThreshold ? "↑ صاعد بقوة" :\n     routeScore > routeClearThreshold ? "↗ صاعد" :\n     routeScore <= -routeStrongThreshold ? "↓ هابط بقوة" :\n     routeScore < -routeClearThreshold ? "↘ هابط" : "→ غير حاسم"',
    'fuelSurge = barstate.isconfirmed and fuelScore >= fuelHighThreshold and fuelScore[1] < fuelHighThreshold',
    'headingUp = barstate.isconfirmed and headingScore > headingClearThreshold and headingScore[1] <= headingClearThreshold',
    'headingDown = barstate.isconfirmed and headingScore < -headingClearThreshold and headingScore[1] >= -headingClearThreshold',
    'noChaseEvent = barstate.isconfirmed and noChase and not noChase[1]',
    'obstacleBreakEvent = breakResistance or breakSupport',
    'obstacleRejectEvent = rejectResistance or rejectSupport',
    'breakAcceptedEvent = breakAcceptedUp or breakAcceptedDn',
    'bool rejectResistance = ev.rejectR', 'bool rejectSupport = ev.rejectS', 'bool breakResistance = ev.breakingUp', 'bool breakSupport = ev.breakingDn',
    'bool breakAcceptedUp = ev.acceptedUp', 'bool breakAcceptedDn = ev.acceptedDn', 'bool flipConfirmedEvent = ev.flipConfirmed',
  ];
  for (const l of lines) assert.ok(pine.includes(l), `Pine line changed or missing: ${l.slice(0, 60)}…`);
});

test('C12 R3b guards: Pine refuses the three inverted pairs on the first bar with runtime.error', () => {
  assert.match(pine, /^if barstate\.isfirst and headingStrongThreshold <= headingClearThreshold\n    runtime\.error\(/m);
  assert.match(pine, /^if barstate\.isfirst and routeStrongThreshold <= routeClearThreshold\n    runtime\.error\(/m);
  assert.match(pine, /^if barstate\.isfirst and speedExtremeThreshold < speedFastThreshold\n    runtime\.error\(/m);
  // No clamp: the inputs keep their declared defaults.
  for (const d of ['speedFastThreshold = input.float(70.0,', 'speedExtremeThreshold = input.float(90.0,', 'headingClearThreshold = input.float(20.0,', 'headingStrongThreshold = input.float(60.0,', 'routeClearThreshold = input.float(22.0,', 'routeStrongThreshold = input.float(62.0,']) assert.ok(pine.includes(d), d);
});

test('C13 R4-A Strong Obstacle: latch on confirmed bars, entry-key identity, no distance-crossing rule', () => {
  assert.doesNotMatch(pine, /nearestObstacleAtr\[1\]/);
  assert.match(pine, /^array<int> dest1EntryKeys = primaryUp \? keysEntryR1 : keysEntryS1$/m);
  assert.match(pine, /^bool strongObsNow = obstacleAvailable and nearestObstacleStrong and not na\(nearestObstacleAtr\) and nearestObstacleAtr <= nearObstacleAtr$/m);
  assert.match(pine, /^nearStrongObstacle = barstate\.isconfirmed and strongObsNow and \(not strongObsLatch or not strongObsSame\)$/m);
  assert.match(pine, /^if barstate\.isconfirmed\n    strongObsLatch := strongObsNow\n    if strongObsNow\n        replaceKeys\(strongObsKeys, dest1EntryKeys\)\n    else\n        array\.clear\(strongObsKeys\)$/m);
  assert.match(pine, /^nearestObstacleStrong = not na\(dest1Strength\) and dest1Strength >= strongQ$/m);
  // The latch is folded into hashState after the engine part (same order as encodeState).
  assert.match(pine, /int hsObs = hashStep\(tel\.hashState, strongObsLatch \? 1 : 0\)\n    hsObs := hashKeyList\(hsObs, strongObsKeys, hashScratch\)/);
});

test('C14 R4-B lifecycle: arm at break start, Accepted/Flip follow the arm, every exit clears it', () => {
  const body = (name) => fnBody(name).join('\n');
  const acc = body('acceptBreak');
  assert.match(pine, /^acceptBreak\(Level lv, int bi, Events e\) =>$/m);
  assert.match(acc, /if lv\.navArmed\n        if lv\.breakDir > 0/);
  assert.match(acc, /lv\.state := ST_DEAD\n        lv\.navArmed := false/);
  const up = body('updateLevel');
  assert.match(up, /lv\.state := ST_BREAKING\n            lv\.navArmed := inSlot/);
  assert.match(up, /if lv\.navArmed\n                    e\.flipConfirmed := true\n                lv\.navArmed := false/);
  assert.match(up, /if lv\.navArmed and bi - lv\.stateChartBar > flipWindow\n            lv\.navArmed := false/);
  assert.equal((up.match(/lv\.navArmed := false/g) || []).length, 6); // back, window, flipWindow, back-death, flip, mitigation
  assert.doesNotMatch(up, /acceptBreak\(lv, bi, e, inSlot\)/);
  assert.match(up, /markRejection\(lv, rej, e, inSlot\)/); // Rejection keeps the per-bar rule
  assert.match(pine, /if age > maxAgeOf\(lv\.tfRank\)\n                        lv\.state := ST_DEAD\n                        lv\.navArmed := false/);
});

test('C15 Q-A: Break Accepted message is neutral (a FLIP whose break is accepted dies, it is not a potential flip)', () => {
  assert.match(pine, /^alertcondition\(breakAcceptedEvent, "GTG — Break Accepted", "GTG Navigator: الكسر أصبح مقبولًا وفق محرك المناطق\."\)$/m);
  assert.doesNotMatch(pine, /المستوى الآن Flip محتمل/);
  assert.equal((pine.match(/^alertcondition\(/gm) || []).length, 10); // count unchanged
});

test('C16 roadStatus for accepted breaks is neutral; "Flip محتمل" stays only on the BROKEN navTag', () => {
  assert.match(pine, /^if breakAcceptedUp\n    roadStatus := "اختراق مقبول"\nelse if breakAcceptedDn\n    roadStatus := "كسر مقبول"$/m);
  const uses = pine.split('\n').filter((l) => l.includes('Flip محتمل'));
  assert.equal(uses.length, 1, uses.join('\n'));
  assert.match(uses[0], /ss\.navTag := zn\.hasFlip \? "Flip مؤكد" : prim\.state == ST_BROKEN \? "Flip محتمل"/);
});

test('C17 rolling diagnostics (18b): no plot counts, window 1000, analyzer masks, field order, validation-only table', async () => {
  const { LAYOUT, DIAG_WIN, INV_BASE } = await import('./diag.mjs');
  assert.equal(DIAG_WIN, 1000);
  assert.match(pine, /^DIAG_WIN = 1000$/m);
  assert.match(pine, /^DIAG_N = 13$/m);
  // No diagnostic plot: the plot-based version hit RE10140 on TradingView.
  assert.doesNotMatch(pine, /^\s*plot\([^\n]*(diag|v_diag)/m);
  assert.match(pine, /^int diagEvBits = engineEventBits \+ alertBits \* 128$/m);
  assert.match(pine, /^bool diagBrkE = engineStep and \(diagBit\(diagEvBits, 1\) or diagBit\(diagEvBits, 2\)\)$/m);
  assert.match(pine, /^bool diagAccE = engineStep and \(diagBit\(diagEvBits, 4\) or diagBit\(diagEvBits, 8\)\)$/m);
  assert.match(pine, /^bool diagRejE = engineStep and \(diagBit\(diagEvBits, 16\) or diagBit\(diagEvBits, 32\)\)$/m);
  assert.match(pine, /^bool diagFlpE = engineStep and diagBit\(diagEvBits, 64\)$/m);
  assert.match(pine, /^bool diagObsAlert = engineStep and diagBit\(diagEvBits, 2048\)$/m);
  for (const [flag, mask] of [['diagBrkE', 8192], ['diagAccE', 32768], ['diagRejE', 16384], ['diagFlpE', 65536]]) {
    assert.ok(pine.includes(`w and ${flag} != diagBit(diagEvBits, ${mask}) ? 1 : 0`), `${flag} vs alert ${mask}`);
  }
  assert.ok(pine.includes('w and diagBit(diagObs, 8) != diagObsAlert ? 1 : 0'));
  assert.ok(pine.includes('w and diagAccE and (na(diagSinceBrk) or diagSinceBrk > 3) ? 1 : 0'));
  assert.ok(pine.includes('w and diagFlpE and (na(diagSinceAcc) or diagSinceAcc > 60) ? 1 : 0'));
  assert.match(pine, /^if validationMode and barstate\.isconfirmed\n    bool w = engineStep and tel\.engineBars > engineWindow$/m);
  // Field order of each packed value = LAYOUT (ring sums 0..12 in order), base 1024, stored on confirmed bars.
  const order = { EVT: ['diagEvtV', [0, 1, 2, 3, 4]], MISMATCH: ['diagMismatchV', [5, 6, 7, 8, 9]], CAUSAL: ['diagCausalV', [10, 11, 12]] };
  const mul = [1, 1024, 1048576, 1073741824, 1099511627776];
  for (const [key, [v, idx]] of Object.entries(order)) {
    assert.equal(LAYOUT[key].length, idx.length);
    const expr = idx.map((k, i) => (i === 0 ? `dS(${k})` : `dS(${k}) * ${mul[i]}`)).join(' + ');
    assert.ok(pine.includes(`    ${v} := ${expr}\n`), key);
  }
  // INV: cumulative max = current counters, base 2^26, overflow → na (no clamp, no modulo).
  assert.equal(INV_BASE, 2 ** 26);
  assert.match(pine, new RegExp(`^INV_BASE = ${INV_BASE}$`, 'm'));
  assert.ok(pine.includes('bool diagInvOk = tel.violations >= 0 and tel.violations < INV_BASE and tel.violationsCritical >= 0 and tel.violationsCritical < INV_BASE'));
  assert.ok(pine.includes('diagInvV := diagInvOk ? tel.violations + tel.violationsCritical * INV_BASE : na'));
  assert.deepEqual(LAYOUT.INV, ['maxInvTotal1000', 'maxInvCritical1000']);
  // Validation-only table at bottom-left; the production HUD stays alone at top-right.
  assert.match(pine, /^var table diagTable = table\.new\(position\.bottom_left, 1, 1, /m);
  assert.equal((pine.match(/table\.new\(/g) || []).length, 2);
  assert.match(pine, /^var table dash = table\.new\(\n     position\.top_right,/m);
  assert.match(pine, /^if barstate\.islast\n    table\.clear\(diagTable, 0, 0, 0, 0\)\n    if validationMode\n        table\.cell\(diagTable, 0, 0, "GTGDIAG v1\\nBAR=" \+ diagText\(diagBarTime\) \+ "\\nEVT=" \+ diagText\(diagEvtV\) \+ "\\nMISMATCH=" \+ diagText\(diagMismatchV\) \+ "\\nCAUSAL=" \+ diagText\(diagCausalV\) \+ "\\nINV=" \+ diagText\(diagInvV\)/m);
  assert.doesNotMatch(pine, /diagPrevTot|diagPrevCrit|v_diagInv1000/);
});


// Top-level statement that owns line i (its nearest non-indented, non-comment line above).
function ownerOf(lines, i) {
  for (let j = i; j >= 0; j--) if (lines[j] !== '' && !lines[j].startsWith(' ') && !lines[j].startsWith('//')) return lines[j];
  return '';
}

test('C18 G2 cost gate: the state-level hash and snapshot collection run only for validationMode or the capture', () => {
  const lines = pine.split('\n');
  assert.match(pine, /^bool hashStateOn = engineStep and \(validationMode or captureOn\)$/m);
  const capDefs = lines.map((l, i) => (l.startsWith('bool captureOn = ') ? i : -1)).filter((i) => i >= 0);
  assert.equal(capDefs.length, 1, 'captureOn defined once');
  assert.equal(lines[capDefs[0]], 'bool captureOn = engineStep and captureFrom > 0 and time >= captureFrom and time <= captureTo');
  assert.ok(capDefs[0] < lines.indexOf('bool hashStateOn = engineStep and (validationMode or captureOn)'), 'captureOn before hashStateOn');
  // Heavy work (per pool record and per ring bar) sits only under "if hashStateOn".
  const heavy = [/\bhashLevel\(hl,/, /hashStep\(hl, toTicks\(array\.get\(ringO, k\)\)\)/, /array\.push\(snapLevels, lv\)/, /array\.sort_indices\(snapKeys/, /^\s+tel\.hashState := /, /hashKeyList\(hsObs, strongObsKeys/];
  for (const re of heavy) {
    const at = lines.map((l, i) => (re.test(l) ? i : -1)).filter((i) => i >= 0);
    assert.ok(at.length > 0, `${re} not found`);
    for (const i of at) assert.equal(ownerOf(lines, i), 'if hashStateOn', `${re} at line ${i + 1} is outside "if hashStateOn"`);
  }
  // The slot level stays on every engine step (cheap; v_hashSlots and DEBUG "hs").
  const hsAt = lines.findIndex((l) => /^\s+tel\.hashSlots := hs$/.test(l));
  assert.equal(ownerOf(lines, hsAt), 'if engineStep');
  assert.match(pine, /^plot\(hashStateOn \? tel\.hashState : na, "v_hashState"/m);
  assert.match(pine, /^plot\(engineStep \? tel\.hashSlots : na, "v_hashSlots"/m);
  // Write-only telemetry: nothing before section 12a reads the hashes or the snapshot scratch.
  const sec12a = lines.findIndex((l) => l.startsWith('// 12a. VALIDATION TELEMETRY'));
  assert.ok(sec12a > 0);
  lines.forEach((l, i) => {
    if (i < sec12a && !l.trimStart().startsWith('//')) assert.doesNotMatch(l, /tel\.hash(State|Slots)|snapLevels|snapOrd|hashStateOn/, `line ${i + 1} reads telemetry before 12a`);
  });
});

test('C19 E41 R5 fingerprint: capture-window only, warmed rule, fold order, table field order, no plot', async () => {
  const { R5_FIELDS } = await import('./diag.mjs');
  assert.deepEqual([...R5_FIELDS], ['n', 'cold', 'from', 'to', 'hSlots', 'hState', 'hEvents']);
  const lines = pine.split('\n');
  const blockStart = lines.findIndex((l, i) => l === 'if captureOn' && lines[i + 1] === '    if tel.engineBars > engineWindow');
  assert.ok(blockStart > 0, 'R5 block "if captureOn / if tel.engineBars > engineWindow" not found');
  assert.deepEqual(lines.slice(blockStart, blockStart + 11), [
    'if captureOn',
    '    if tel.engineBars > engineWindow',
    '        r5N += 1',
    '        r5HSlots := hashStep(r5HSlots, tel.hashSlots)',
    '        r5HState := hashStep(r5HState, tel.hashState)',
    '        r5HEvents := hashStep(r5HEvents, engineEventBits + alertBits * 128)',
    '        if na(r5From)',
    '            r5From := time',
    '        r5To := time',
    '    else',
    '        r5Cold += 1',
  ]);
  for (const v of ['r5N = 0', 'r5Cold = 0', 'r5From = na', 'r5To = na', 'r5HSlots = 0', 'r5HState = 0', 'r5HEvents = 0']) assert.match(pine, new RegExp(`^var int ${v}$`, 'm'));
  // Every write to an r5 variable is inside that block; the only read outside it is the table cell.
  lines.forEach((l, i) => {
    if (/\br5[A-Z]\w* (:=|\+=)/.test(l)) assert.ok(i > blockStart && i < blockStart + 11, `r5 write outside the block at line ${i + 1}`);
    if (/\br5[A-Z]/.test(l) && !l.startsWith('var int r5') && !(i >= blockStart && i < blockStart + 11)) assert.match(l, /table\.cell\(diagTable, 0, 0, "GTGDIAG v1/, `r5 read at line ${i + 1}`);
  });
  assert.doesNotMatch(pine, /^\s*plot\([^\n]*r5/m);
  assert.match(pine, /\+ "\\nINV=" \+ diagText\(diagInvV\) \+ "\\nR5=" \+ \(captureFrom > 0 \? diagText\(r5N\) \+ "," \+ diagText\(r5Cold\) \+ "," \+ diagText\(r5From\) \+ "," \+ diagText\(r5To\) \+ "," \+ diagText\(r5HSlots\) \+ "," \+ diagText\(r5HState\) \+ "," \+ diagText\(r5HEvents\) : "na"\)/);
});

test('C20 release presentation and compile gate: shorttitle, status line, HUD opacity and z-order, output call', () => {
  const lines = pine.split('\n');
  // Mobile/Desktop compiler: SHORT_TITLE_TOO_LONG above 10 characters.
  const st = pine.match(/shorttitle\s*=\s*"([^"]*)"/);
  assert.ok(st, 'shorttitle missing');
  assert.ok([...st[1]].length <= 10, `shorttitle "${st[1]}" is ${[...st[1]].length} characters`);
  // G5 F-G5-1: no input value in the status line (the list crossed the HUD).
  const inputs = lines.filter((l) => /input\.[a-z]+\(/.test(l));
  assert.equal(inputs.length, 67);
  const shown = inputs.filter((l) => !/display = display\.none\)\s*$/.test(l));
  assert.deepEqual(shown, []);
  // G5 F-G5-2: HUD rows as opaque as the header (section 16).
  const s = lines.findIndex((l) => l.startsWith('// 16. COMPACT ARABIC HUD'));
  const e = lines.findIndex((l) => l.startsWith('// 17. NAVIGATION ALERTS'));
  const hud = lines.slice(s, e).join('\n');
  assert.equal((hud.match(/color\.new\(color\.black, 18\)/g) || []).length, 0);
  assert.ok((hud.match(/color\.new\(color\.black, 4\)/g) || []).length >= 22);
  // G5 F-G5-2 root cause: v6 overlay scripts draw behind the candles by default (behind_chart = true),
  // so candles crossed the HUD on H1. The HUD must be drawn in front of the chart.
  const decl = pine.slice(0, pine.indexOf('\n)\n') + 3);
  assert.match(decl, /behind_chart = false/);
  // CE10213: at least one top-level output call (a source cut before it fails to add).
  assert.ok(lines.some((l) => /^(plot|plotshape|plotchar|bgcolor|barcolor|fill|hline)\(/.test(l)), 'no top-level output call');
});
