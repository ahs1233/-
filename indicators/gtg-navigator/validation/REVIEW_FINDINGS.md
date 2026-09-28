# REVIEW_FINDINGS — مراجعة Astra (R1–R7)

- **Baseline:** commit `cdf1a8ab59c07943ba7c64a81bb2a52d1aa1947e`، Pine blob `3f7dd0e1481d68ff49fbc2779084cae7fc75cc28` (انظر `baseline-manifest.json`).
- **إعادة الإنتاج:** `repro/baseline-repro.mjs` ← الناتج الخام `artifacts/baseline-repro-cdf1a8a.txt`.
- **المنفّذ:** Claude. **المراجِع:** GPT (لم يراجع بعد ما يلي من قرارات؛ الحالة تُحدَّث بعد مراجعته الفعلية).
- التصنيف: `CONFIRMED` / `ALREADY_FIXED` / `NOT_REPRODUCED` / `CONTRACT_DECISION_NEEDED`. الملاحظات قابلة للفحص وليست أوامر.

| # | الملاحظة | التصنيف عند baseline | الدليل | القرار / الحالة |
|---|---|---|---|---|
| R1 | `slotDigest` لا يثبت التكافؤ | **CONFIRMED** | ترجمة حرفية لـ`pine:1741-1742`: الحدود [100,101] و[100.13,100.93] بنفس primaryKey ⇒ نفس البصمة `999820507`. مدخلات البصمة primaryKey وlo وhi فقط؛ لا entryKeys/lastKeys ولا جودة ولا حالات مستويات ولا أحداث. | **منفَّذ (بانتظار مراجعة GPT وتشغيل Pine):** `reference/snapshot.mjs` + `capture.mjs` + `tools/compare-captures.mjs`؛ Pine: `v_hashSlots`/`v_hashLevels`/`v_eventBits` + `v_lo*/v_hi*` + التقاط `log.info`؛ أُزيلت البصمة الخطية. اختبارات S1–S11، C1–C7. |
| R2 | mintick/ATR floor مختلفان بين Pine وJS | **CONFIRMED** | fixture Astra عبر `runEpisode` في المرجع: mitigation = `0.486000` مقابل oracle يدوي لمعادلة Pine = `0.048600` (نسبة 10.000). أرضيات JS = `1e-12` في `engine.mjs:80,495,538,547`؛ أرضيات Pine = `syminfo.mintick` في `pine:532,571-572,864,1154,1162`. | **منفَّذ (بانتظار مراجعة GPT):** العقد: Pine هو المرجع الحاكم للأرضيات؛ المرجع JS يأخذ `mintick` إلزاميًا (`withSymbol`) ويطبّق نفس الأرضيات. لا تغيير في Pine. اختبارات P1–P6. فجوات مفتوحة (ties، HTF، ملفات الفريمات) في `PINE_JS_PARITY.md` §5. |
| R3 | `qStay > qEnter` يسبب ظهورًا/اختفاءً متناوبًا | **CONFIRMED** (في المرجع JS؛ نفس الشرط في `pine:1560`، تشغيل Pine: NOT_RUN) | `qEnter=55, qStay=80`، منطقة ثابتة gateQ=70 ⇒ R1.active = `true,false,true,false,true,false`. | **منفَّذ (بانتظار مراجعة GPT وتشغيل Pine):** العقد `qStay ≤ qEnter`؛ المرجع `checkParams` (في `selectSlots` و`Engine`)، وPine `runtime.error` عند `barstate.isfirst`. اختبارات Q1–Q4 وC10. أزواج العتبات الأخرى: انظر «R3 — مراجعة بقية العتبات». |
| R4 | عقد Strong Obstacle | **CONTRACT_DECISION_NEEDED** | ترجمة `pine:2169`: الجودة 60→80 عند مسافة ثابتة 0.20 ATR ⇒ لا تنبيه؛ الشرط يراقب عبور المسافة فقط. السلوك مُعاد إنتاجه، لكن كونه عيبًا يتوقف على العقد. | **منفَّذ (بانتظار مراجعة GPT وتشغيل Pine):** R4-A دخول حالة Strong+Near لعائق محدد (هوية = entryKeys لخانة dest1، latch على الشموع المؤكدة)؛ R4-B سلسلة `navArmed` لـAccepted/Flip؛ R4-C `ALERT_CONTRACT.md` للتنبيهات العشرة مع ثلاثة أسئلة عقد مفتوحة. |
| R5 | اختبار الحتمية أضيق من الادعاء | **CONFIRMED** | `engine.test.mjs` T7: المحركان A وB يتشاركان `series` و`anchorFeed` محسوبين مرة واحدة من كل الـ8000 شمعة؛ لا يوجد تاريخ مستقل أقصر/أطول ولا prepend. | اختبارات تعيد بناء المدخلات والـfeeds من تاريخين مستقلين (مرحلة لاحقة). |
| R6 | اختبارات Navigator خارج CI | **CONFIRMED** | `.github/workflows/ci.yml` يشغّل `pnpm test` ← `turbo run test` (apps/packages)؛ لا ذكر لـ`indicators/gtg-navigator`. | **منفَّذ:** `.github/workflows/gtg-navigator.yml` (Node 22/24)؛ negative control: اختبار فاشل ⇒ exit 1 محليًا. نتيجة تشغيل GitHub Actions: تُسجَّل بعد الـpush. |
| R7 | توثيق الحالة غير متسق | **CONFIRMED** (README) / نوتشن: **NOT_OBSERVABLE** | README سطر 11 يذكر «T0–T7» مع وجود T7b/T8/T9؛ سطر 9 «التحقق الخارجي معلّق» مع G1/G3 PASS في الأسطر 82–84؛ سطر 49 «تطابقها يعني نفس الخانات» (ادعاء R1). صفحة نوتشن أعادت 404 لتكامل Notion المتاح في هذه الجلسة. | تحديث README من الأدلة بعد العمل؛ نص تحديث نوتشن يُجهَّز ويُذكر أنه لم يُنشر ما لم تتوفر الصلاحية. |

## R1 — التصميم (مستويات التكافؤ)

| المستوى | الاسم | الحقول | طريقة المقارنة |
|---|---|---|---|
| L1 | visible geometry | لكل خانة R1/R2/S1/S2: `active`، `side`، `containing`، `lo`، `hi` | `lo/hi` خام بتسامح `tol = 1e-9·|price| + 1e-6·mintick`، ثم ticks (`round(x/mintick)`) كمقارنة منفصلة؛ يُبلَّغ عن الاثنين. |
| L2 | selected identities | L1 + `primaryKey`، `lastKeys` (مرتبة تصاعديًا)، `entryKeys` (مرتبة تصاعديًا)، `gateQ`، `displayQ` | مفاتيح: مساواة أعداد صحيحة تامة. جودة: خام بتسامح `1e-9`، ثم مكمّمة `round(q·100)`. |
| L3 | engine state | كل سجلات الـpools (محلي + A1 + A2، بما فيها tombstones) مرتبة بالمفتاح: الحالة والقطبية والحدود وs وmitigation وevidence وtests وageNative وحقول الحلقة والكسر، مع الأعمار **النسبية** للشمعة الحالية بدل أي `bar_index` مطلق؛ + متتبعا السوينغ لـDOZ | نفس قواعد L1/L2 لكل حقل. |
| L4 | consumer events | أحداث المحرك السبعة (`Events`)؛ في Pine أيضًا الشروط العشرة للتنبيهات | مساواة تامة لكل bit. |

- المقارنة الكاملة = الحقول الخام، وليست الـhash. الـhash (`hashSlots` لـL2، `hashState` لـL3) مساعد: **اختلافه يثبت الاختلاف؛ تساويه لا يثبت التساوي.**
- Pine لا يستطيع تصدير كل L2/L3 عبر plots (حد 64). التغطية في Pine:
  - `Export chart data`: L1 كاملًا (حدود خام + أعلام) + primaryKey + `hashSlots`/`hashState` + bits أحداث L4.
  - diagnostic capture محدود عبر `log.info` لمدى زمني يحدده المستخدم: يطبع snapshot كاملًا (L1–L4) بصيغة سطرية قابلة للتحليل، لعدد محدود من الشموع (حدود Pine Logs مذكورة في `PINE_JS_PARITY.md`).

## R3 — مراجعة بقية العتبات (لا حراس جديدة؛ قرار مطلوب)

الحارس أُضيف فقط حيث يوجد invariant وظيفي يسبب سلوكًا ديناميكيًا خاطئًا (التناوب). بقية الأزواج:

| الزوج | نطاقات المدخلات | أثر العكس | الحكم |
|---|---|---|---|
| `mediumQ` / `strongQ` | 20–80 / 40–95 (متداخلة) | نطاق «متوسط» في `strengthText` (pine:161) يصبح غير قابل للوصول | ترتيب تسميات فقط؛ لا تناقض ديناميكي. **موثّق فقط، بلا حارس** (قرار GPT، الرسالة 49). |
| `speedSlow` / `speedFast` / `speedExtreme` | 5–45 / 50–90 / 75–99 | slow<fast دائمًا؛ extreme<fast: اللون البرتقالي وتنبيه Speed Burst (عند ≥ extreme) بينما `speedClass` ما زالت «طبيعية» (< fast) | **R3b منفَّذ:** `speedExtreme ≥ speedFast` (المساواة مسموحة: تطوي «سريعة» فقط بلا تعارض). |
| `fuelLow` / `fuelHigh` / `fuelExtreme` | 5–50 / 50–90 / 75–99 | low=high=50 يُفرغ «طبيعي»؛ high>extreme يُفرغ «مرتفع» (pine:456) | ترتيب تسميات فقط. **موثّق فقط، بلا حارس** (قرار GPT، الرسالة 49). |
| `headingClear` / `headingStrong` | 5–45 / 40–90 (متداخلة) | إذا clear > strong: درجة بينهما تُعرض «↑ صاعد بقوة» (pine:378) بينما `headingSign = 0` (pine:374) | **R3b منفَّذ:** `headingStrong > headingClear` (صارم: النص يستخدم ≥ strong والإشارة > clear، فالمساواة تُبقي التناقض عند الحد). |
| `routeClear` / `routeStrong` | 5–45 / 40–90 (متداخلة) | نفس التناقض: «صاعد بقوة» (pine:415) مع `routeSign = 0` (pine:413) | **R3b منفَّذ:** `routeStrong > routeClear` (صارم، للسبب نفسه). |
| `normalLowPct` / `normalHighPct` | 5–45 / 55–95 | لا يمكن عكسهما | مضمون بالنطاقات. |
| `noChaseAtr` / `nearObstacleAtr` / `awarenessObstacleAtr` | 0.05–1.00 / 0.05–1.50 / 0.30–2.50 | مسافات لأغراض مختلفة؛ لا علاقة ترتيب مفروضة في الكود | بلا invariant واضح. بلا حارس. |

## سجل المراجعة

| الرسالة | البند | قرار GPT | ما تغيّر |
|---|---|---|---|
| 45 | R6 | ACCEPTED لهذه المرحلة (تحقق مستقل من run 36391388838: Node 22 و24 نجحا) | — |
| 45 | R2 | ACCEPTED على مستوى المرجع JS/العقد الحسابي؛ parity تشغيل Pine وpivot probe: NOT_RUN | — |
| 45 | R1 | CHANGES REQUIRED. وصلت نسختان من الرسالة 45 بملاحظات مختلفة؛ عولجت ملاحظاتهما معًا | (أ) multiplicity: المقارنة تجمع السجلات حسب المفتاح وتبلّغ عن الطول والتكرار (S12). (ب) ring الأسعار ضمن مستوى state وضمن `hashState` (S13، مع oracle سلوكي: ring مختلف يغيّر R1/S1 للمنطقة المحتوية). (ج) الهوية المصدرية source/tfRank/typ/birthTime/price صريحة في snapshot وPine وhash (S15). (د) `compare-captures` صارم: شمعة ناقصة كليًا تُفشل المقارنة الثنائية افتراضيًا، و`--expect-*` للملف الواحد، وتمييز MISSING عن INCOMPLETE (S14). (هـ) الصيغة `GTGSNAP v2`. |
| 47 | R1 | ACCEPTED على مستوى reference/source/static validation؛ Pine runtime parity وG1/E20 والأداء: NOT_RUN | — |
| 47 | R3 | فُتح (حارس `qStay ≤ qEnter` فقط) | منفّذ؛ بانتظار المراجعة. |
| 49 | R3 | ACCEPTED على مستوى reference/source/static validation؛ E26 (Pine runtime) NOT_RUN | — |
| 49 | R3b | فُتح: `headingStrong > headingClear`، `routeStrong > routeClear`، `speedExtreme ≥ speedFast`؛ لا حارس لـmediumQ/strongQ أو fuel أو المسافات | منفّذ؛ بانتظار المراجعة. |
| 51 | R3b | ACCEPTED على مستوى source/reference/static validation؛ Pine runtime: NOT_RUN | — |
| 51 | R4 | وصلت نسختان من الرسالة 51: (1) الهوية تبدأ بـprimaryKey مع اختبار churn، وتدقيق التنبيهات بلا تغيير semantics؛ (2) الهوية = primaryKey، وR4-B (سلسلة navArmed) مطلوب تنفيذه. نُفّذت (2) الأحدث لـR4-B/R4-C. **الهوية حسمها الدليل:** O8 يثبت churn الـprimaryKey داخل نفس المنطقة في المحرك الفعلي (primaryKey ⇒ 11، entryKeys ⇒ 10)، فاستُخدمت entryKeys | منفّذ؛ بانتظار المراجعة؛ **الانحراف عن النص الحرفي لـ(2) معروض للقرار** |
| 53 | R4-A | ACCEPTED على مستوى source/reference/static؛ الهوية entryKeys معتمدة (O8)؛ مطلوب I13 | I13 منفّذ (5 اختبارات + negative control) |
| 53 | R4-B | ACCEPTED مبدئيًا؛ NOT FINAL حتى قياس XAU حقيقي في TradingView (GPT) | لا تغيير |
| 53 | Q-A / Q-B | Q-A: نص Break Accepted محايد؛ Q-B: DESIGN_DECISION | النص صُحّح (C15)؛ Q-B موثّق |
| 57 (نسخة ثانية) | أداة قياس | طلب 4 plots تشخيصية لأن Table View لم يعد يكشف الأعمدة خارج الشاشة | منفّذ؛ `v_diagInv1000` بدل `v_diagInvMax1000` (السبب في PINE_JS_PARITY §8)؛ بانتظار المراجعة |
| 59 | أداة القياس | وصلت نسختان: (1) INV غير صحيح (counterexample: مخالفة قبل النافذة ⇒ 0) ⇒ أقصى عدّاد تراكمي بقاعدة 2^26؛ (2) RE10140 على TradingView ⇒ احذف الـplots واعرض القيم في جدول للتحقق فقط. نُفّذ الاتحاد | منفّذ؛ ادعاء «52→56 آمن» سُحب؛ بانتظار المراجعة |
| 61 | أداة القياس / TradingView | خلية OANDA:XAUUSD M1 على `680fb20`: بلا RE10140 ولا runtime error؛ mismatch/causal/INV = 0 (E39). لا يغلق المصفوفة الكاملة ولا G2 | E39 أُضيف؛ فتح R5 |
