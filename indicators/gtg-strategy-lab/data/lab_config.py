"""Frozen constants shared by the data layer (source: FREEZE_RECORD.md)."""
from datetime import datetime, timezone

# T_freeze_v0.2.1 = committer timestamp of freeze commit e5eefac (TRADE_CONTRACT v0.2.1 FROZEN).
T_FREEZE = datetime(2026, 9, 29, 14, 58, 45, tzinfo=timezone.utc)
T_FREEZE_MS = int(T_FREEZE.timestamp() * 1000)
FREEZE_COMMIT = "e5eefacfdf54625ac3b968b5e24460822d3f8758"
