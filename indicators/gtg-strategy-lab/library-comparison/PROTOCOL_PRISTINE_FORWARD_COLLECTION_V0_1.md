# GTG Pristine Forward Collection v0.1 — collection only, no analysis

Registered 2026-10-03 after DC Correction -> Resumption H4 failed formal Validation.

## Status
Historical Holdout remains LOCKED.
Pristine OOS remains SEALED.

This protocol authorizes raw forward COLLECTION ONLY.
It does not authorize decoding, feature construction, state inference, backtesting, chart inspection, strategy scoring, or outcome analysis on post-freeze data.

## Why
The Train-development program exhausted multiple hand-written and learned execution hypotheses.
The first formal Validation candidate failed:
- DC Correction -> Resumption H4
- Validation C1 = -0.0542 ATR/trade
- Validation C2 = -0.1991 ATR/trade
- verdict = FAIL

Therefore no current candidate is eligible for Historical Holdout.

## Pristine boundary
From FREEZE_RECORD / TRADE_CONTRACT v0.2.3:

T_freeze:
- 2026-09-30T13:40:49Z

Pristine OOS:
- raw timestamps strictly greater than T_freeze

No post-freeze price content may be decoded or analyzed under this collection protocol.

## Collection mechanism
Use the existing frozen:
- indicators/gtg-strategy-lab/data/capture_forward.py

Behavior:
- exact official Dukascopy XAUUSD M1 BID/ASK raw files
- complete UTC days only
- 3-hour publication lag
- store raw bytes under data root raw/forward
- record URL, bytes, and SHA256 in manifest
- do NOT decode/build M1/H1 research bars
- idempotent: already captured days skipped

The freeze day itself may be captured as raw because it includes both pre/post-freeze minutes; any eventual opening protocol must censor t <= T_freeze.

## Data root
C:\Users\alk\gtg-lab-data-jforex

Forward raw storage must remain separate from canonical research M1 bars:
- raw/forward/...
- manifest kind = forward_m1

Do not create m1/YYYY/MM files from forward raw under this protocol.

## Allowed inspection
Allowed:
- filenames
- byte counts
- SHA256
- capture day
- manifest metadata
- missing-day status

Forbidden:
- OHLC values
- returns
- spread values
- indicators
- State Engine outputs
- trade outcomes
- charts
- descriptive price statistics

## Opening rule
No opening rule is registered yet because there is no surviving candidate after Validation.

A future strategy candidate must first be frozen independently of Pristine OOS.
Before ANY Pristine content is decoded, a separate protocol must commit:
- exact candidate identity
- exact features/rules/model hash
- exact execution/cost contract
- exact opening stop rule (calendar or information-based)
- exact PASS/FAIL/INCONCLUSIVE screen
- one-shot access procedure

Until then, forward data only accumulates.

## Integrity
- Historical Holdout read=false
- Pristine OOS decoded=false
- forward capture only
- no m1 derived bars from forward raw
- no strategy selection from forward metadata
- no analysis after capture

