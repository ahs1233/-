"""Frozen constants shared by the data layer (source: FREEZE_RECORD.md)."""
from datetime import datetime, timezone

# T_freeze_v0.2.2 = committer timestamp of freeze commit 08757a2 (TRADE_CONTRACT v0.2.2 FROZEN).
# It replaces T_freeze_v0.2.1 (2026-09-29T14:58:45Z, e5eefac) for the Pristine OOS boundary.
T_FREEZE = datetime(2026, 9, 29, 20, 47, 26, tzinfo=timezone.utc)
T_FREEZE_MS = int(T_FREEZE.timestamp() * 1000)
FREEZE_COMMIT = "08757a278aa8c6fe788bce9ad81f222e01168e8c"
