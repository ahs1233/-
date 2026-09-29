"""Frozen constants shared by the data layer (source: FREEZE_RECORD.md)."""
from datetime import datetime, timezone

# T_freeze = committer timestamp of freeze commit e4ceb8e (TRADE_CONTRACT v0.2 FROZEN).
T_FREEZE = datetime(2026, 9, 29, 13, 31, 51, tzinfo=timezone.utc)
T_FREEZE_MS = int(T_FREEZE.timestamp() * 1000)
FREEZE_COMMIT = "e4ceb8e1adbd49885c49ab032f676a1f71c2f418"
