#!/usr/bin/env python3
"""Apply authored Pine changes to Ahmed's lastgtg; no third-party dependencies.

Usage: python build_lastgtg.py path/to/lastgtg.pine --out lastgtg_review_1_1
The input is read only. The output directory must not exist.
This is a guarded patch builder, NOT a Pine compiler or a backtest.
"""
from pathlib import Path
import argparse
import difflib
import hashlib
import json

ROOT = Path(__file__).resolve().parent
VERSION = 'lastgtg-review-1.1.0'

OLD_BREAKING = '''    else if st == ST_BREAKING
        int dir = lv.breakDir
        bool beyond = dir > 0 ? c > lv.hi + buf : c < lv.lo - buf
        bool back = dir > 0 ? c < lv.lo : c > lv.hi
        if beyond and bi > lv.stateChartBar
            lv.breakCloses := lv.breakCloses + 1
            if lv.breakCloses >= 2
                acceptBreak(lv, bi, e)
        else if back
            lv.state := lv.breakFromFlip ? ST_FLIP : ST_ACTIVE
            lv.tests := lv.tests + 1
            lv.evidence := math.min(3.0, lv.evidence + 0.5)
            lv.lastTestChartBar := bi
            lv.navArmed := false
        else if bi - lv.stateChartBar >= BREAK_WINDOW
            lv.state := lv.breakFromFlip ? ST_FLIP : ST_ACTIVE
            lv.navArmed := false
'''

OLD_STRONG = '''            bool strongBody = math.abs(c - o) >= dispBodyK * atr and (dir > 0 ? c > o : c < o)
            if strongBody
                acceptBreak(lv, bi, e)
'''

OLD_SHARE = '''    float runPx = zzDir > 0 ? zzHi : zzDir < 0 ? zzLo : na
    float span = na(runPx) or na(swLastPx) ? na : runPx - swLastPx
    bool strongMove = not na(span) and math.abs(span) >= pullMinMove * swLastAtr
    strongMove ? (runPx - px) / span : na'''

NEW_SHARE = '''    // Use the exact move that owns the drawn confirmed pullback zone.
    // Only fall back to the developing leg when no confirmed zone is active.
    float refStart = pzOn ? pzStart : swLastPx
    float refEnd = pzOn ? pzEnd : zzDir > 0 ? zzHi : zzDir < 0 ? zzLo : na
    float span = na(refStart) or na(refEnd) ? na : refEnd - refStart
    bool strongMove = pzOn or (not na(span) and not na(swLastAtr) and math.abs(span) >= pullMinMove * swLastAtr)
    strongMove and not na(span) and math.abs(span) > 0 ? (refEnd - px) / span : na'''

OLD_LAMP = '''        int lamp = 1
        string why = "أدلة مختلطة"
        if heldAccUp or heldAccDn
            why := heldAccUp ? "اختراق مؤكد" : "كسر مؤكد"
            lamp := 2
        else if noChase
            why := "لا تطارد"
            lamp := 0
        else if priceInsideObstacle
            why := obstacleRole == 1 ? "داخل مقاومة" : obstacleRole == -1 ? "داخل دعم" : "داخل منطقة"
            lamp := 0
        else if routeSign != 0 and headingSign != 0 and routeSign != headingSign
            why := "عكس المسار العام"
            lamp := 0
        else if heldBrkR or heldBrkS
            why := "كسر يحتاج تأكيد"
        else if heldRejR or heldRejS
            why := heldRejR ? "رفض من مقاومة" : "ارتداد من دعم"
        else if obstacleNear or candleTouchesObstacle
            why := obstacleRole == 1 ? "مقاومة قريبة" : obstacleRole == -1 ? "دعم قريب" : "منطقة قريبة"
        else if movingTowardResistance or movingTowardSupport
            why := movingTowardResistance ? "مقاومة أمامه" : "دعم أمامه"
        else if fuelExhaustion
            why := "الزخم يضعف"
        else if headingSign == 0
            why := "بدون اتجاه واضح"
        else if routeSign == 0
            why := "المسار العام غير واضح"
        else if fuelScore < fuelLowThreshold
            why := "الوقود ضعيف"
        else if headingSign == routeSign and obstacleAvailable and nearestObstacleAtr * atrEng < greenRoomHtfAtr * safeHtfAtr
            // Room ahead is judged on the higher timeframe's scale: a few dollars is far for a
            // 1-minute ATR but not for the market.
            why := obstacleRole == 1 ? "مقاومة أمامه" : "دعم أمامه"
        else if headingSign == routeSign
            why := "الاتجاه متوافق"
            lamp := 2
'''

NEW_LAMP = '''        int lamp = gtgLampLive
        string why = gtgLampReason(gtgReasonLive, obstacleRole)
'''

CORE_MARKER = 'if barstate.islast\n    table.clear(dash, 0, 0, 1, 10)'

def once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise ValueError(f'{label}: expected exactly one source match, got {count}. '
                         'Use the unmodified lastgtg pasted in this conversation; do not force the patch.')
    return text.replace(old, new, 1)

def fragment(name):
    return (ROOT / name).read_text(encoding='utf-8').rstrip() + '\n'

def build(source):
    if not source.startswith('//@version=6'):
        raise ValueError('Expected Pine v6 source starting with //@version=6')
    if 'gtgLampDecision(' in source or 'lastgtg-review-1.1.0' in source:
        raise ValueError('Already patched source; supply the original A.')
    # Validate both B/C anchors before producing anything.
    for old, name in [(OLD_BREAKING, 'BREAKING'), (OLD_STRONG, 'strong body'),
                      (OLD_SHARE, 'moveShare'), (OLD_LAMP, 'lamp')]:
        if source.count(old) != 1:
            raise ValueError(f'Source differs from supplied lastgtg: {name}')
    b = once(source, OLD_SHARE, NEW_SHARE, 'moveShare')
    b = once(b, OLD_LAMP, NEW_LAMP, 'lamp')
    block = fragment('lamp_core.pinefrag') + '\n' + fragment('lamp_adapter.pinefrag') + '\n'
    b = once(b, CORE_MARKER, block + CORE_MARKER, 'global HUD insertion')
    b = once(b, 'dirText + " • " + why, text_color = lampFg',
             'dirText + " • " + why + (barstate.isconfirmed ? "" : " • لحظي"), text_color = lampFg',
             'live HUD label')
    # Clarify missing zones in both scenario rows without changing zone selection.
    b = once(b, '(isRes ? "لا مقاومة قريبة" : "لا دعم قريب")',
             '(isRes ? "لم أجد مقاومة مؤهلة" : "لم أجد دعماً مؤهلاً")', 'missing zone wording')
    c = once(b, OLD_STRONG,
             '            // C: first close only arms BREAKING, regardless of body size.\n',
             'remove immediate acceptance')
    c = once(c, OLD_BREAKING, fragment('c_breaking.pinefrag'), 'consecutive closes')
    # Deliberately leave BROKEN -> DEAD strongBack logic unchanged in C.
    out = {}
    for label, text in [('B', b), ('C', c)]:
        title = f'lastgtg {label} 1.1 — Structural Zone Engine'
        text = once(text, '"lastgtg — Structural Zone Engine (based on GTG v0.4.7)"',
                    json.dumps(title, ensure_ascii=False), 'indicator title')
        text = once(text, 'shorttitle = "lastgtg"', f'shorttitle = "lastgtg {label}"', 'short title')
        text = once(text, 'table.cell(dash, 0, 0, "lastgtg",',
                    f'table.cell(dash, 0, 0, "lastgtg {label} 1.1",', 'full HUD title')
        note = ('// ' + VERSION + ' variant ' + label + '. Original comments below are retained for provenance.\n'
                '// B/C: safe green gates, explicit missing-map state, unified moveShare, closed-bar exports.\n'
                + ('// C: two consecutive beyond-buffer closes, no strong-body shortcut; window offsets 0..2.\n'
                   if label == 'C' else '// B: original level state machine is unchanged.\n'))
        text = once(text, '//@version=6\n', '//@version=6\n' + note, 'version banner')
        out[label] = text
    return out

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--out', type=Path, default=Path('lastgtg_review_1_1'))
    args = parser.parse_args()
    raw = args.source.read_bytes()
    source = raw.decode('utf-8-sig').replace('\r\n', '\n')
    variants = build(source)
    # Exclusive creation protects original and any earlier run.
    args.out.mkdir(parents=True, exist_ok=False)
    (args.out / 'lastgtg_A_original.pine').write_bytes(raw)
    manifest = {'patch_version': VERSION, 'source_sha256': digest(raw),
                'source_path': str(args.source.resolve()),
                'pine_compiled': False, 'backtested': False,
                'A_byte_identical': True,
                'C_only_engine_change': 'ACTIVE/FLIP -> BREAKING -> accepted break; strongBack unchanged',
                'outputs': {}}
    for label, text in variants.items():
        name = f'lastgtg_{label}_1_1.pine'
        encoded = text.encode('utf-8')
        (args.out / name).write_bytes(encoded)
        manifest['outputs'][name] = digest(encoded)
        delta = ''.join(difflib.unified_diff(source.splitlines(True), text.splitlines(True),
                                           fromfile='lastgtg_A_original.pine', tofile=name))
        (args.out / f'A_to_{label}.diff').write_text(delta, encoding='utf-8')
    manifest['patch_files'] = {p.name: digest(p.read_bytes()) for p in sorted(ROOT.glob('*.pinefrag'))}
    (args.out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Created A (unchanged), B and C in {args.out.resolve()}')
    print('Required next: Pine v6 compilation, replay, export checks; no profitability claim.')

if __name__ == '__main__':
    main()
