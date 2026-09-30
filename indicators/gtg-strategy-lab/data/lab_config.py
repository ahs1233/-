"""Frozen constants shared by the data layer (source: FREEZE_RECORD.md)."""
from datetime import datetime, timezone

# T_freeze_v0.2.3 = committer timestamp of freeze commit c47b719 (TRADE_CONTRACT v0.2.3 FROZEN,
# Data Source Amendment). It replaces T_freeze_v0.2.2 (2026-09-29T20:47:26Z, 08757a2) for the
# Pristine OOS boundary and ends the retrospective history.
T_FREEZE = datetime(2026, 9, 30, 13, 40, 49, tzinfo=timezone.utc)
T_FREEZE_MS = int(T_FREEZE.timestamp() * 1000)
FREEZE_COMMIT = "c47b71997d0b4e87d48f653184bbcff641db1259"
# canonical price window (v0.2.3 §2.2): one source, JForex IHistory, from this day to T_freeze
HISTORY_START = "2018-03-01"
