"""Focused local checks; not a Pine compiler or engine parity test."""
import itertools
import json
import re
from types import SimpleNamespace
from pathlib import Path
import build_lastgtg as patch

ROOT = Path(__file__).resolve().parent

def lamp_from_pine():
    # Translate the small, pure decision function literally; fail on unsupported syntax.
    text = patch.fragment('lamp_core.pinefrag')
    section = text[text.index('gtgLampDecision('):text.index('\ngtgLampReason(')]
    header, *lines = section.splitlines()
    args = [a.strip().split()[-1] for a in header.split('(', 1)[1].split(')', 1)[0].split(',')]
    body = ['def decide(' + ','.join(args) + '):']
    for line in lines:
        if not line.strip() or line.lstrip().startswith('//'):
            continue
        line = re.sub(r'^(\s*)int ', r'\1', line).replace(':=', '=')
        line = line.replace('reason = rejR and rejS ? 35 : rejR ? 36 : 37',
                            'reason = 35 if rejR and rejS else 36 if rejR else 37')
        line = line.replace('reason = accUp ? 51 : accDn ? 52 : 50',
                            'reason = 51 if accUp else 52 if accDn else 50')
        line = line.replace('else if ', 'elif ')
        if line.strip().startswith(('if ', 'elif ')):
            line += ':'
        if line.strip() == '[lamp, reason]':
            line = '    return lamp, reason'
        if '?' in line:
            raise AssertionError('Unsupported Pine syntax')
        body.append(line)
    scope = {}
    exec('\n'.join(body), scope)
    return scope['decide']

def test_lamp():
    fn = lamp_from_pine()
    names = ['ready','chase','inside','heading','route','accUp','accDn','breaking',
             'rejR','rejS','nearTouch','aware','exhausted','lowFuel','mapped','room']
    variable = [n for n in names if n not in ('heading','route')]
    count = 0
    # Exhaustively check the green safety invariant across 147456 states.
    for bits in itertools.product((False, True), repeat=len(variable)):
        d = dict(zip(variable, bits))
        for h, r in itertools.product((-1, 0, 1), repeat=2):
            d.update(heading=h, route=r)
            lamp, reason = fn(**d)
            expected = (d['ready'] and not d['chase'] and not d['inside'] and h != 0 and h == r
                        and not (d['accUp'] and d['accDn'])
                        and not (d['accUp'] and h < 0) and not (d['accDn'] and h > 0)
                        and not (d['breaking'] and not (d['accUp'] or d['accDn']))
                        and not any(d[k] for k in ('rejR','rejS','nearTouch','aware','exhausted','lowFuel'))
                        and d['mapped'] and d['room'])
            assert (lamp == 2) == bool(expected), (d, lamp, reason)
            count += 1
    return count

def c_branch_from_pine():
    text = patch.fragment('c_breaking.pinefrag')
    lines = text.splitlines()[1:]
    body = ['def advance(lv, c, buf, bi):']
    for line in lines:
        if not line.strip() or line.lstrip().startswith('//'):
            continue
        line = line[4:]
        line = re.sub(r'^(\s*)(int|bool) ', r'\1', line).replace(':=', '=')
        line = line.replace('dir > 0 ? c > lv.hi + buf : c < lv.lo - buf',
                            '(c > lv.hi + buf if dir > 0 else c < lv.lo - buf)')
        line = line.replace('dir > 0 ? c < lv.lo : c > lv.hi',
                            '(c < lv.lo if dir > 0 else c > lv.hi)')
        line = line.replace('lv.breakFromFlip ? ST_FLIP : ST_ACTIVE',
                            '(ST_FLIP if lv.breakFromFlip else ST_ACTIVE)')
        line = line.replace('beyond ? lv.breakCloses + 1 : 0',
                            '(lv.breakCloses + 1 if beyond else 0)')
        line = line.replace('false','False').replace('math.min','min')
        line = line.replace('else if ', 'elif ')
        if line.strip().startswith(('if ', 'elif ')):
            line += ':'
        if '?' in line:
            raise AssertionError('Unsupported Pine syntax')
        body.append(line)
    def accept(lv, bi, e):
        lv.state = 4 if lv.breakFromFlip else 2
        lv.accepted = True
    scope = dict(ST_ACTIVE=0, ST_FLIP=3, BREAK_WINDOW=3, acceptBreak=accept, e=None)
    exec('\n'.join(body), scope)
    return scope['advance']

def test_break():
    fn = c_branch_from_pine()
    tested = 0
    for direction in (1,-1):
        for flip in (False,True):
            def level():
                return SimpleNamespace(breakDir=direction,lo=100,hi=101,stateChartBar=10,
                                       state=1,breakCloses=1,breakFromFlip=flip,tests=0,
                                       evidence=0,lastTestChartBar=0,navArmed=True,accepted=False)
            beyond = 102 if direction == 1 else 99
            back = 99 if direction == 1 else 102
            a=level(); fn(a,beyond,0.1,11)
            assert a.accepted and a.state == (4 if flip else 2)
            b=level(); fn(b,100.5,0.1,11); fn(b,beyond,0.1,12)
            assert not b.accepted and b.breakCloses == 1
            fn(b,beyond,0.1,13)
            assert not b.accepted and b.state == (3 if flip else 0)
            c=level(); fn(c,beyond,0.1,13)
            assert not c.accepted and not c.navArmed
            d=level(); fn(d,back,0.1,11)
            assert not d.accepted and d.tests == 1 and not d.navArmed
            e=level(); fn(e,beyond,0.1,10)
            assert not e.accepted
            tested += 5
    return tested

def test_builder():
    # Source excerpt fixture, not the full original indicator and not compilable.
    source = ('//@version=6\n'
              '"lastgtg — Structural Zone Engine (based on GTG v0.4.7)"\n'
              'shorttitle = "lastgtg"\n' + patch.OLD_BREAKING + patch.OLD_STRONG
              + patch.OLD_SHARE + '\n' + patch.CORE_MARKER + '\n' + patch.OLD_LAMP
              + 'dirText + " • " + why, text_color = lampFg\n'
              + '(isRes ? "لا مقاومة قريبة" : "لا دعم قريب")\n'
              + 'table.cell(dash, 0, 0, "lastgtg",\n')
    variants = patch.build(source)
    assert patch.OLD_BREAKING in variants['B'] and patch.OLD_STRONG in variants['B']
    assert patch.OLD_BREAKING not in variants['C'] and patch.OLD_STRONG not in variants['C']
    assert variants['B'].count('gtgLampDecision(bool') == 1
    assert 'if heldAccUp or heldAccDn\n            why' not in variants['B']
    assert variants['B'].index('bool gtgGreenStart') < variants['B'].index(patch.CORE_MARKER)
    assert variants['B'].count('plot(') == 12
    for bad in (variants['B'], source + patch.OLD_LAMP, source.replace('int lamp = 1','int lamp = 0')):
        try:
            patch.build(bad)
        except ValueError:
            pass
        else:
            raise AssertionError('Must reject modified/duplicate anchors')
    return 9

def test_share_and_episode():
    # Explicit semantics, not a translation of Pine.
    # Confirmed up move 100->120: price 108 is 60% retracement,
    # even when a following leg has already reached 110.
    share=lambda start,end,px: (end-px)/(end-start)
    assert abs(share(100,120,108)-0.6)<1e-12
    assert abs(share(120,100,112)-0.6)<1e-12
    states=[(1,0),(2,1),(2,1),(2,-1),(1,-1),(2,-1)]
    starts=[]
    prev=(1,0)
    for i,cur in enumerate(states):
        if cur[0]==2 and (prev[0]!=2 or cur[1]!=prev[1]):
            starts.append(i)
        prev=cur
    assert starts == [1,3,5]
    return 3

if __name__ == '__main__':
    results = {'lamp_truth_table_cases':test_lamp(),'C_break_cases':test_break(),
               'patch_fixture_assertions':test_builder(),'semantic_examples':test_share_and_episode(),
               'pine_compiled':False,'full_original_file_patch_run':False,
               'market_backtest':False,
               'scope':'Pure decision and C branch translated from authored Pine; patch tested on source excerpts only.'}
    (ROOT/'local_checks.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
    print(json.dumps(results,indent=2))
