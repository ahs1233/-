# VALIDATION REPORT — GTG Navigator v0.4.7

- **Pine الإنتاجي:** blob `0c7cbe366668fba20c9bc128448f908ce9314041` (2620 سطرًا)، آخر تغيير Pine في `f82c846`. السكربت المحفوظ في حساب TradingView = النسخة 24 = الـblob نفسه (pine-facade).
- **الفرق عن `27f3bba`:** عرض فقط — shorttitle `"GTG v0.4.7"`، و`display = display.none` على 67 مدخلًا، وخلفية صفوف HUD بشفافية 4، و`behind_chart = false`. لا سطر محرك أو إشارة أو تنبيه تغيّر (فحص آلي: 88 زوج أسطر + سطر مضاف واحد).
- **سطح التحقق:** TradingView Desktop عبر CDP على `127.0.0.1:9222` (الـrunbook §1). جلسة Chrome لم تُلمس. layout المستخدم أُعيد كما كان بعد كل تشغيل.
- **التاريخ:** 2026-09-28 / 2026-09-29 (UTC). التفاصيل في `EVIDENCE_MATRIX.md`.

## الحكم

**FINAL RELEASE VERIFIED**

كل البوابات المطلوبة VERIFIED على الـblob الإنتاجي، والاختبارات والـCI وworkflow المرجع خضراء على الـcommits البرمجية. الملاحظة الوحيدة المتبقية ليست بلوكرًا: تشغيل تطبيق الهاتف نفسه لم يشاهده Claude (المُجمِّع الذي يستعمله الهاتف فُحص مباشرة، وخطآ الهاتف فُسّرا وأُزيلا).

## التقرير النهائي

| البند | النتيجة | الدليل |
|---|---|---|
| الاختبارات | 116/116 (+C20: shorttitle وخط الحالة وHUD وz-order ومخرَج واحد على الأقل؛ يفشل على `27f3bba`) | `node --test reference/*.test.mjs` |
| CI + reference workflow | أخضر على `7528bd3` و`f82c846` (وعلى `869d936` الذي كان قيد التشغيل سابقًا) | GitHub Actions |
| G2 أداء | median +2.0% وworst +5.7% مقابل `cdf1a8a`، أقل من تشتت التشغيلات؛ Executions 8256. تعديلات العرض لا تمس الحساب | E50 — VERIFIED |
| G5 الواجهة | الإعادة على `0c7cbe3`: 6/6 حالات PASS في A وB وC وD وE؛ F1 10/10؛ F2 NOT_OBSERVABLE | E51 — VERIFIED |
| E16 قاعدة تعادل pivot | Pine = C، والمرجع مطابق ومثبت باختبار | E16 — VERIFIED |
| E20 بصمة Pine = JS | 60/60 شمعة، `pineVsJsHashMismatch=0` (كود البصمة لم يتغير) | E20 — VERIFIED |
| Mobile Compile Gate | `SHORT_TITLE_TOO_LONG` أُصلح؛ CE10213 أُعيد إنتاجه حرفيًا بمصدر مقطوع قبل أول `plot`، والمصدر الكامل لا يعطيه؛ `0c7cbe3`: 0 أخطاء و0 تحذيرات. الـanchor من الـhotfix غير لازم ولم يُدمج | E52 — VERIFIED (المُجمِّع) |
| Desktop fresh compile | مصدر GitHub لُصق في مؤشر جديد غير محفوظ، 0 markers، Add to chart ناجح، z-order أمام الشموع؛ الحساب v24 = `0c7cbe3` | E53 — VERIFIED |
| الحتمية والمصفوفة والحراس (سابق) | E40/E41، E47/E48، E26/E28 | VERIFIED |

## الـhotfix `fix/tradingview-compile-hotfix-2026-09-29`

لم يُدمج. shorttitle فيه (`"GTGv0.4.7"`) استُبدل بـ`"GTG v0.4.7"` (10 أحرف، يطابق رأس HUD). `GTG_OUTPUT_ANCHOR` مرفوض لأن CE10213 سببه نسخة مقطوعة، والـanchor كان سيجعل النسخة المقطوعة تُترجم بصمت بلا مناطق ولا HUD ولا تنبيهات. الفرع ما زال على الـremote، ولم يُحذف.

## ملاحظات

- للهاتف: الأسلم إضافة «GTG Navigator v0.4.7» (v24) من My scripts بدل اللصق، أو التأكد أن النص الملصوق 2620 سطرًا.
- الـlayout المحفوظ للمستخدم فيه نسخة GTG قديمة (VQnUIo)؛ تحديثها إلى v24 قرار المستخدم.
- Q-C والمعايرة D قرارات منتج؛ E13 نوتشن NOT_OBSERVABLE.
