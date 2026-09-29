# GTG Strategy Lab — Frozen Operational Addendum (feed metadata)

Registered by message 24 §9. It is **not** a contract version (no v0.2.3): it changes neither GTG,
nor the hypotheses, nor any threshold. It fixes how feed metadata may be updated during the
Forward period. It applies from TRADE_CONTRACT v0.2.2 (T_freeze_v0.2.2 = 2026-09-29T20:47:26Z).

## A1. Session corrections (calendar of §2.2)
- **Historical data** (trading dates ≤ 2026-09-29) uses only the frozen session definition
  (`1700-1700`, `America/New_York`) and the frozen correction table captured from OANDA:XAUUSD
  symbolInfo at v0.2.2 (`1700-1430:20241128;1800-1445:20241129`, sha256 `da510d1…`).
- **Forward data**: a new correction is admitted only as a line of
  `data/calendar_corrections_forward.jsonl`, and only if:
  1. its source is TradingView symbolInfo for OANDA:XAUUSD (no other source);
  2. it is registered **before** the session of that trading day opens (`observed_at`);
  3. it carries the sha256 of the symbolInfo it was read from;
  4. its date is after the frozen range and not already in the frozen table;
  5. it does not depend on any GTG result.
- The file is an append-only audit log. `load_forward_corrections()` rejects late, duplicate,
  frozen-range or unsourced entries (tests `ForwardCorrections` in `data/test_calendar.py`).
- If no new correction appears, nothing changes.

## A2. Time-zone data
- The New York time-zone rule comes from the IANA database (`zoneinfo`; on Windows the official
  `tzdata` package). The calendar tests pin DST behaviour in both directions.
