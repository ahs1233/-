# lastgtg live (JForex)

Runs the final lastgtg indicator on live Dukascopy prices and keeps a green-light ledger.

| File | Role |
|---|---|
| `jforex/gtglast.java` (JForex strategy "gtglast") | JForex strategy, read-only: writes closed BID bars (M1…W, dollar index H1/H4) to `C:/Users/alk/gtg-live/feed`. No orders. Its chart drawing does nothing in JForex 4, which gives strategies no chart (`state/draw_status.txt` reads `charts=0 all=0`). |
| `jforex/gtglastview.java` (JForex indicator "GTGLAST") | Custom indicator added to the XAU/USD chart: reads `state/draw.txt` and draws, for the chart's timeframe, the four zones and the COMPACT panel (top right). Computes nothing itself. Source kept ASCII because the JForex editor does not read it as UTF-8. |
| `zone-engine.mjs` | v0.4.7 engine (lab copy) + the three lastgtg engine changes, marked `[LASTGTG]`. |
| `measure.mjs` | lab runner, pointed at that engine. |
| `lamp.mjs` | lastgtg.pine §13 + §16: traffic light, zone rows, dollar row. Tests: `lamp.test.mjs`. |
| `runner.mjs` | reads the feed, computes M1/M5/M15/H1/H4 on each closed bar, writes state + logs + ledger. |
| `bundle/gtg-live-runner.mjs` | `runner.mjs` bundled (esbuild) into one file for the PC. |
| `LIVE_PREREGISTRATION.md` | how green lights are scored, fixed before any record. |

On the PC: `node gtg-live-runner.mjs C:/Users/alk/gtg-live` (outputs in `state/` and `log/`).
Rebuild the bundle: `esbuild indicators/lastgtg/live/runner.mjs --bundle --platform=node --format=esm --target=node18 --outfile=indicators/lastgtg/live/bundle/gtg-live-runner.mjs`.
