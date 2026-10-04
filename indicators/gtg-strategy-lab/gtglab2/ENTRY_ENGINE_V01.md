# GTGLab2 — Entry Engine Hypothesis V0.1 — DRAFT

**STATUS: DISCUSSION DRAFT — NOT FROZEN, NOT APPROVED FOR TESTING.**

Captured from trader domain knowledge on 2026-10-04. The user explicitly asked to continue the discussion before freezing the execution model.

## Core idea

Do not treat entry as one exact price.

Treat entry as a managed sequence:

**Probe → Scale → Validate/Invalidate → Continue or Flip**

The goal is to reduce the risk of a single wrong entry and adapt quickly when the market state changes.

---

## 1. Total risk is fixed before the first entry

Example:
- intended total position: 0.10 lot
- split into 5 tranches
- nominal tranche size: 0.02 lot each

Important:
This is **not** permission to increase total risk after the trade starts.

The five entries together must remain inside one predefined total risk budget.

This prevents the mechanism from becoming uncontrolled averaging-down or martingale.

---

## 2. Range-long scenario

Assumption:
- market state = RANGE
- price approaches lower range boundary

Initial action:
- open a small long probe near the lower range area, not full size.

If price dips below the range:
- do not immediately classify it as a true breakdown,
- evaluate whether the move is a false liquidity sweep / false break,
- if evidence still supports RANGE and rejection appears, scale additional tranches at better prices.

Objective:
- improve average entry price,
- participate in the return toward the range,
- avoid committing full risk at one price.

---

## 3. False-break continuation vs true regime break

This is the critical decision.

### False break hypothesis
Evidence may include:
- quick rejection below range,
- inability to continue lower,
- reclaimed range boundary,
- improving order-flow / microstructure confirmation,
- lack of sustained downside acceptance.

Action:
- maintain/complete long scale-in within fixed risk budget,
- ride mean reversion back inside the range.

### True breakdown hypothesis
Evidence may include:
- sustained acceptance below range,
- continued lower highs/lows,
- downside follow-through,
- failed reclaim of former range boundary,
- persistent bearish flow / cross-source agreement.

Action:
- close long inventory quickly,
- accept the planned loss,
- do not continue averaging down.

---

## 4. Bias flip after confirmed breakdown

After a true breakdown:
- old RANGE-long hypothesis is dead,
- state candidate becomes TRANSITION → TREND_DOWN.

Do not short immediately at the worst price.

Wait for a better short location such as:
- pullback,
- retest of broken support as resistance,
- failed reclaim,
- resumed bearish flow.

Then enter short in the direction of the new trend.

---

## 5. Symmetric logic for the upper range boundary

The same logic is mirrored:
- near range high → small short probe,
- false break above → scale short if rejection confirms,
- true breakout → close shorts fast,
- wait for a better long entry on retest/pullback,
- continue with TREND_UP.

---

## 6. Why this matters for GTGLab2

This reframes the unsolved timing problem.

Instead of asking:

> What is the single perfect entry price?

GTGLab2 should ask:

> What is the best managed entry sequence under a current state hypothesis, and what evidence invalidates that hypothesis fast enough to protect capital?

This creates two distinct tasks:

1. **Entry location / inventory construction**
2. **Regime invalidation detection**

The second task may be more important than finding the exact first entry.

---

## 7. Proposed architecture

State Engine
→ identifies RANGE / TRANSITION / TREND_UP / TREND_DOWN

Entry Engine
→ chooses probe area and tranche schedule

Validation Engine
→ decides:
- false break / rejection,
- true break / acceptance,
- continue,
- exit,
- flip bias

Execution Engine
→ controls:
- tranche size,
- maximum total risk,
- stop/invalidation,
- average price,
- exit,
- re-entry,
- trend-following flip.

---

## 8. Key research hypothesis

**H-ENTRY-001**

A fixed-risk multi-tranche entry policy combined with fast regime invalidation can produce better execution expectancy than a single-entry policy using the same State Engine and the same total risk budget.

This must be tested against:
- identical market states,
- identical total risk,
- identical cost assumptions,
- identical exit horizon.

Success is not measured by win rate alone.

Primary metrics:
- expectancy after costs,
- max adverse excursion,
- realized loss on failed hypotheses,
- average entry improvement,
- drawdown,
- profit factor,
- regime-specific performance,
- time-to-invalidation,
- performance after bias flip.

---

## 9. Safety constraint

Scale-in is allowed only while the original state hypothesis remains valid.

Once invalidated:
- no new averaging entries,
- inventory must be reduced/closed according to the execution contract.

This is the hard boundary between controlled scaling and martingale behavior.

---

## 10. Open parameters to freeze before testing

Do not optimize these after seeing outcomes:

- number of tranches (initial proposal: 5)
- tranche sizing scheme (initial proposal: equal 20% of planned size)
- first-entry distance from range boundary
- spacing between tranches
- maximum permitted excursion outside range
- false-break confirmation rule
- true-break acceptance rule
- maximum time allowed for reclaim
- full-position risk cap
- stop mechanics
- criteria for short/long flip
- pullback/retest entry rule after flip

These parameters should be preregistered before the first outcome-linked test.
