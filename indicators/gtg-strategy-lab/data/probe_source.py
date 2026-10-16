"""Paced reachability probe of the Dukascopy datafeed from the current network path.

Prints one line per request: path, HTTP status, bytes, latency. No data is stored.
Usage: python probe_source.py [--n 24] [--gap 1.5]
"""
import argparse
import time
import urllib.error
import urllib.request

import dukascopy as dk


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=24)
    ap.add_argument("--gap", type=float, default=1.5)
    a = ap.parse_args()
    ok = 0
    for i in range(a.n):
        day = f"2025/{(i % 12):02d}/{(i % 27) + 1:02d}"
        side = "BID" if i % 2 == 0 else "ASK"
        url = f"{dk.BASE_URL}/XAUUSD/{day}/{side}_candles_min_1.bi5"
        t = time.monotonic()
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": dk.USER_AGENT}), timeout=30) as r:
                n = len(r.read()); code = r.status; ok += 1
        except urllib.error.HTTPError as e:
            n, code = 0, e.code
        except Exception as e:  # network-level
            n, code = 0, type(e).__name__
        print(f"{day} {side} {code} bytes={n} {1000 * (time.monotonic() - t):.0f}ms", flush=True)
        time.sleep(a.gap)
    print(f"PROBE ok={ok}/{a.n}")


if __name__ == "__main__":
    main()
