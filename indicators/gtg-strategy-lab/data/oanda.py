"""OANDA v20 Practice API: XAU_USD M1 candles, BID and ASK (GPT message 42 — feasibility test only).

Not a research source: nothing here enters the Research Dataset. Official REST API only:
  GET /v3/instruments/XAU_USD/candles?price=BA&granularity=M1&smooth=false&from=<unix>&count=5000
Times are UNIX seconds (Accept-Datetime-Format: UNIX), UTC. Only complete candles are kept; a
minute without prices has no candle. Requests are sequential and paced far below the published
REST limit. The token is read from a file outside the repository and never logged.
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from pathlib import Path

HOST = "https://api-fxpractice.oanda.com"
INSTRUMENT = "XAU_USD"
MAX_COUNT = 5000
PACE_S = 0.5


def read_token(path: Path) -> str:
    tok = Path(path).read_text().strip()
    if not tok:
        raise ValueError(f"empty token file {path}")
    return tok


def _get(url: str, token: str, opener=urllib.request.urlopen, retries: int = 3, sleep=time.sleep) -> dict:
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}", "Accept-Datetime-Format": "UNIX"})
    for k in range(retries):
        try:
            with opener(req, timeout=30) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code != 429 and e.code < 500:
                raise
            if k == retries - 1:
                raise
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if k == retries - 1:
                raise
        sleep(2 ** (k + 1))
    raise AssertionError("unreachable")


def parse(doc: dict) -> list[dict]:
    """API candles → {t (ms, open), bo bh bl bc, ao ah al ac, v (tick count)}; complete candles only."""
    out = []
    for c in doc.get("candles", []):
        if not c.get("complete"):
            continue
        b, a = c["bid"], c["ask"]
        out.append({"t": int(round(float(c["time"]))) * 1000,
                    "bo": float(b["o"]), "bh": float(b["h"]), "bl": float(b["l"]), "bc": float(b["c"]),
                    "ao": float(a["o"]), "ah": float(a["h"]), "al": float(a["l"]), "ac": float(a["c"]),
                    "v": int(c["volume"])})
    return out


def fetch_m1(start_s: int, end_s: int, token: str, get=_get, sleep=time.sleep, log=print) -> list[dict]:
    """All complete M1 candles with start_s ≤ open < end_s (UNIX seconds), oldest first."""
    out, frm = [], start_s
    while frm < end_s:
        url = (f"{HOST}/v3/instruments/{INSTRUMENT}/candles?price=BA&granularity=M1&smooth=false"
               f"&from={frm}&count={MAX_COUNT}")
        doc = get(url, token)
        batch = parse(doc)
        raw = doc.get("candles", [])
        out += [c for c in batch if c["t"] < end_s * 1000 and (not out or c["t"] > out[-1]["t"])]
        if not raw:
            break
        last = int(round(float(raw[-1]["time"])))
        if last + 60 <= frm:
            break
        frm = last + 60
        log(f"oanda M1 through {time.strftime('%Y-%m-%d %H:%M', time.gmtime(last))} ({len(out)} candles)")
        sleep(PACE_S)
    return out
