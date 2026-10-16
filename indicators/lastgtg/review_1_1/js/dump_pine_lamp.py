"""Prints lamp,reason for every case of handoff/test_patch.py, using its own translation of the
Pine fragment, in the order bc.test.mjs enumerates them (one line per case)."""
import itertools
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "handoff"))
import test_patch  # noqa: E402

NAMES = ['ready', 'chase', 'inside', 'heading', 'route', 'accUp', 'accDn', 'breaking',
         'rejR', 'rejS', 'nearTouch', 'aware', 'exhausted', 'lowFuel', 'mapped', 'room']
VARIABLE = [n for n in NAMES if n not in ('heading', 'route')]

fn = test_patch.lamp_from_pine()
out = []
for bits in itertools.product((False, True), repeat=len(VARIABLE)):
    d = dict(zip(VARIABLE, bits))
    for h, r in itertools.product((-1, 0, 1), repeat=2):
        d.update(heading=h, route=r)
        lamp, reason = fn(**d)
        out.append(f"{lamp},{reason}")
sys.stdout.write("\n".join(out) + "\n")
