# RESULT — Doctrine Reference v0.1

Date: 2026-10-04  
Protocol: `PROTOCOL_DOCTRINE_REFERENCE_V01.md`  
Run: `runs/doctrine-reference-v01-001/`  
Scope: development-only historical JForex + State Engine v0.2.

## Integrity
- Historical Holdout read: **NO**
- Pristine Forward OOS decoded: **NO**
- Microstructure outcomes read: **NO**
- BID/ASK execution: **YES**
- Native spread: **YES**
- Slippage scenarios: C0=0, C1=0.5 bps, C2=1.0 bps

## Primary result — BASE / C1
| Policy | n | Mean R | Win rate | Avg risk used |
|---|---:|---:|---:|---:|
| Single | 1,837 | -0.1891 | 40.01% | 1.000 |
| Staged | 1,837 | -0.1491 | 35.98% | 0.647 |

Paired STAGED-SINGLE:
- mean difference: +0.0400R
- median difference: -0.0308R
- staged beats single: 49.05%

## Exposure-normalized diagnosis
- Single mean per used R: **-0.1891**
- Staged mean per used R: **-0.4707**
- Range staged mean per used R: **-0.4295**
- Trend staged mean per used R: **-0.6207**

The nominal staged improvement came mainly from deploying less risk, not from better entry quality.

## Direction / time stability
All main branches were negative:
- Single Long: -0.1317R
- Single Short: -0.2459R
- Staged Long: -0.0955R
- Staged Short: -0.2020R
- Early and Late blocks both negative.

The frozen context filter also failed:
- Context Single C1: -0.1969R
- Context Staged C1: -0.1793R

## Verdict
**FAIL.**

Blind range-edge probes plus generic staged additions do not provide a defensible executable edge.

The five-tranche idea remains an inventory/risk architecture, but **adding tranches must be conditioned on stronger post-break evidence**. No threshold from v0.1 is changed after seeing this result.
