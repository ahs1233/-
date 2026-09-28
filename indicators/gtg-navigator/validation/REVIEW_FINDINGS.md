# REVIEW_FINDINGS — مراجعة Astra (R1–R7)

- **Baseline:** commit `cdf1a8ab59c07943ba7c64a81bb2a52d1aa1947e`، Pine blob `3f7dd0e1481d68ff49fbc2779084cae7fc75cc28` (انظر `baseline-manifest.json`).
- **إعادة الإنتاج:** `repro/baseline-repro.mjs` ← الناتج الخام `artifacts/baseline-repro-cdf1a8a.txt`.
- **المنفّذ:** Claude. **المراجِع:** GPT (لم يراجع بعد ما يلي من قرارات؛ الحالة تُحدَّث بعد مراجعته الفعلية).
- التصنيف: `CONFIRMED` / `ALREADY_FIXED` / `NOT_REPRODUCED` / `CONTRACT_DECISION_NEEDED`. الملاحظات قابلة للفحص وليست أوامر.

| # | الملاحظة | التصنيف عند baseline | الدليل | القرار / الحالة |
|---|---|---|---|---|
| R1 | `slotDigest` لا يثبت التكافؤ | **CONFIRMED** | ترجمة حرفية لـ`pine:1741-1742`: الحدود [100,101] و[100.13,100.93] بنفس primaryKey ⇒ نفس البصمة `999820507`. مدخلات البصمة primaryKey وlo وhi فقط؛ لا entryKeys/lastKeys ولا جودة ولا حالات مستويات ولا أحداث. | snapshot canonical بأربعة مستويات تكافؤ + مقارنة حقول خام بتسامح معلن + hash مساعد فقط. انظر «R1 — التصميم» أدناه. |
| R2 | mintick/ATR floor مختلفان بين Pine وJS | **CONFIRMED** | fixture Astra عبر `runEpisode` في المرجع: mitigation = `0.486000` مقابل oracle يدوي لمعادلة Pine = `0.048600` (نسبة 10.000). أرضيات JS = `1e-12` في `engine.mjs:80,495,538,547`؛ أرضيات Pine = `syminfo.mintick` في `pine:532,571-572,864,1154,1162`. | العقد: Pine هو المرجع الحاكم للأرضيات؛ المرجع JS يأخذ symbol metadata (`mintick`) إلزاميًا ويطبّق نفس الأرضيات. لا تغيير في Pine. انظر `PINE_JS_PARITY.md`. |
| R3 | `qStay > qEnter` يسبب ظهورًا/اختفاءً متناوبًا | **CONFIRMED** (في المرجع JS؛ نفس الشرط في `pine:1560`، تشغيل Pine: NOT_RUN) | `qEnter=55, qStay=80`، منطقة ثابتة gateQ=70 ⇒ R1.active = `true,false,true,false,true,false`. | حارس مدخلات (بعد R1/R2، بحسب ترتيب الرسالة 43). |
| R4 | عقد Strong Obstacle | **CONTRACT_DECISION_NEEDED** | ترجمة `pine:2169`: الجودة 60→80 عند مسافة ثابتة 0.20 ATR ⇒ لا تنبيه؛ الشرط يراقب عبور المسافة فقط. السلوك مُعاد إنتاجه، لكن كونه عيبًا يتوقف على العقد. | يُعرض عقد مقترح قبل أي تغيير في semantics المستهلك. |
| R5 | اختبار الحتمية أضيق من الادعاء | **CONFIRMED** | `engine.test.mjs` T7: المحركان A وB يتشاركان `series` و`anchorFeed` محسوبين مرة واحدة من كل الـ8000 شمعة؛ لا يوجد تاريخ مستقل أقصر/أطول ولا prepend. | اختبارات تعيد بناء المدخلات والـfeeds من تاريخين مستقلين (مرحلة لاحقة). |
| R6 | اختبارات Navigator خارج CI | **CONFIRMED** | `.github/workflows/ci.yml` يشغّل `pnpm test` ← `turbo run test` (apps/packages)؛ لا ذكر لـ`indicators/gtg-navigator`. | job مستقل خفيف `.github/workflows/gtg-navigator.yml`. |
| R7 | توثيق الحالة غير متسق | **CONFIRMED** (README) / نوتشن: **NOT_OBSERVABLE** | README سطر 11 يذكر «T0–T7» مع وجود T7b/T8/T9؛ سطر 9 «التحقق الخارجي معلّق» مع G1/G3 PASS في الأسطر 82–84؛ سطر 49 «تطابقها يعني نفس الخانات» (ادعاء R1). صفحة نوتشن أعادت 404 لتكامل Notion المتاح في هذه الجلسة. | تحديث README من الأدلة بعد العمل؛ نص تحديث نوتشن يُجهَّز ويُذكر أنه لم يُنشر ما لم تتوفر الصلاحية. |

## R1 — التصميم (مستويات التكافؤ)

| المستوى | الاسم | الحقول | طريقة المقارنة |
|---|---|---|---|
| L1 | visible geometry | لكل خانة R1/R2/S1/S2: `active`، `side`، `containing`، `lo`، `hi` | `lo/hi` خام بتسامح `tol = 1e-9·|price| + 1e-6·mintick`، ثم ticks (`round(x/mintick)`) كمقارنة منفصلة؛ يُبلَّغ عن الاثنين. |
| L2 | selected identities | L1 + `primaryKey`، `lastKeys` (مرتبة تصاعديًا)، `entryKeys` (مرتبة تصاعديًا)، `gateQ`، `displayQ` | مفاتيح: مساواة أعداد صحيحة تامة. جودة: خام بتسامح `1e-9`، ثم مكمّمة `round(q·100)`. |
| L3 | engine state | كل سجلات الـpools (محلي + A1 + A2، بما فيها tombstones) مرتبة بالمفتاح: الحالة والقطبية والحدود وs وmitigation وevidence وtests وageNative وحقول الحلقة والكسر، مع الأعمار **النسبية** للشمعة الحالية بدل أي `bar_index` مطلق؛ + متتبعا السوينغ لـDOZ | نفس قواعد L1/L2 لكل حقل. |
| L4 | consumer events | أحداث المحرك السبعة (`Events`)؛ في Pine أيضًا الشروط العشرة للتنبيهات | مساواة تامة لكل bit. |

- المقارنة الكاملة = الحقول الخام، وليست الـhash. الـhash (`hashSlots` لـL2، `hashLevels` لـL3) مساعد: **اختلافه يثبت الاختلاف؛ تساويه لا يثبت التساوي.**
- Pine لا يستطيع تصدير كل L2/L3 عبر plots (حد 64). التغطية في Pine:
  - `Export chart data`: L1 كاملًا (حدود خام + أعلام) + primaryKey + `hashSlots`/`hashLevels` + bits أحداث L4.
  - diagnostic capture محدود عبر `log.info` لمدى زمني يحدده المستخدم: يطبع snapshot كاملًا (L1–L4) بصيغة سطرية قابلة للتحليل، لعدد محدود من الشموع (حدود Pine Logs مذكورة في `PINE_JS_PARITY.md`).
