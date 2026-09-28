# ALERT_CONTRACT — التنبيهات العشرة

التنبيهات أحداث ملاحة، وليست توصيات تداول.

**حالة الأدلة:**
- كل تنبيه يُحسب فقط على شمعة مؤكدة (confirmed close).
- هذا الجدول يمثّل العقد المعتمد عند commit هذه الجولة.
- الأدلة كلها من المرجع JS ومن فحوص نصية على Pine. **تشغيل Pine في TradingView: NOT_RUN.**

**ملاحظة عن «النقل الحرفي»:** شروط المستهلك منسوخة حرفيًا من Pine في `reference/consumers.mjs`. الفحص C11 يفشل إذا تغيّر أي سطر مصدر في Pine، فيبقى النقل مطابقًا.

| # | التنبيه | الشرط المصدر (Pine) | نوع الحدث | بوابة الشمعة المؤكدة | هوية المصدر | خطر تبدّل الخانة/العضو | الحالة | الأدلة |
|---|---|---|---|---|---|---|---|---|
| 1 | Speed Burst | `speedScore >= speedExtreme and speedScore[1] < speedExtreme` | عبور عتبة (edge) | `barstate.isconfirmed` | لا توجد (مقياس) | لا يوجد | سليم | A1، A2؛ عقد R3b `speedExtreme ≥ speedFast` |
| 2 | Fuel Surge | `fuelScore >= fuelHigh and fuelScore[1] < fuelHigh` | عبور عتبة | نعم | لا توجد | لا يوجد | سليم | A1 |
| 3 | Heading Up | `headingScore > clear and headingScore[1] <= clear` | عبور عتبة | نعم | لا توجد | لا يوجد | سليم | A1، A2؛ عقد R3b |
| 4 | Heading Down | الشرط المرآة لـHeading Up بإشارة سالبة | عبور عتبة | نعم | لا توجد | لا يوجد | سليم | A1 |
| 5 | Strong Obstacle | **R4-A:** `qualifying` = `obstacleAvailable and dest1Strength >= strongQ and nearestObstacleAtr <= nearObstacleAtr`؛ الحدث يقع عندما يتحقق `qualifying` مع أحد شرطين: لم يكن هناك latch، أو العائق مختلف | دخول حالة Strong+Near لعائق محدد | نعم؛ الـlatch لا يتحرك إلا على شمعة مؤكدة | `entryKeys` لخانة dest1؛ العائق نفسه = تقاطع غير فارغ مع مفاتيح الـlatch | لا تكرار عند تبدّل الـprimary (O8) أو تبدّل التسمية R1/S1 (O9) | **أُصلح (R4-A)** | O1–O9؛ `artifacts/r4a-strong-obstacle-before-after.txt` |
| 6 | No Chase | `noChase and not noChase[1]` | دخول حالة الشرط نفسه | نعم | لا توجد، بالتصميم | إذا تغيّر العائق المنخرط وبقي `noChase` صحيحًا، لا يصدر حدث جديد | سليم حسب عقده الحالي | A3 |
| 7 | Obstacle Break | `ev.breakingUp or ev.breakingDn`: انتقال مستوى ACTIVE/FLIP إلى BREAKING، والمستوى عضو في خانة معروضة في الشمعة السابقة (`keyInPrevSlots`) | حدث مستوى في بداية السلسلة | المحرك يعمل على الشموع المؤكدة فقط | المستوى نفسه (غير مُصدَّر في رسالة التنبيه) | فحص العرض يتم في شمعة البداية فقط، وهذا مقصود | سليم؛ **هو أيضًا مصدر الـarm في R4-B** | B8، A5، A6 |
| 8 | Obstacle Rejection | `ev.rejectR or ev.rejectS`: انتهاء حلقة اختبار بـrej ≥ 0.5، والمستوى معروض في الشمعة السابقة | حدث مستوى | نعم | المستوى | فحص في كل شمعة، وهذا مقصود (الرفض يخص عائقًا معروضًا الآن) | سليم | B8 |
| 9 | Break Accepted | `ev.acceptedUp or ev.acceptedDn` | متابعة للسلسلة | نعم | المستوى، **مسلّح عند بداية الكسر (`navArmed`)** | كان يضيع إذا خرج المستوى من الخانة قبل القبول، وكان يصدر لسلسلة بدأت مخفية | **أُصلح (R4-B)** | B1، B3، B7؛ `artifacts/r4b-lifecycle-prefix-06a61a2.txt`؛ `artifacts/r4-impact-synthetic.txt` |
| 10 | Flip Confirmed | `ev.flipConfirmed`: إعادة اختبار من الجهة الجديدة بـrej ≥ 0.5 داخل `flipWindow` | متابعة للسلسلة | نعم | المستوى، مسلّح | كان يضيع بعد خروج المستوى من الخانة | **أُصلح (R4-B)** | B2، B3، B5 |

## R4-B — دورة حياة الـarm (`Level.navArmed`)

**متى يُسلَّح:**
- عند الانتقال من ACTIVE أو FLIP إلى BREAKING، تكون القيمة `navArmed := inSlot`، أي هل كان المستوى عضوًا في خانة معروضة في الشمعة السابقة.

**متى يصدر حدث:**
- Break Accepted يصدر إذا كان المستوى مسلّحًا.
- Flip Confirmed يصدر إذا كان مسلّحًا وضمن `flipWindow`.

**متى يُمسح الـarm:**
- العودة من BREAKING إلى ACTIVE أو FLIP، بإغلاق عكسي أو بانتهاء `BREAK_WINDOW`.
- وقوع Flip.
- موت المستوى، بأي طريق: إغلاق عكسي، أو mitigation، أو العمر، أو قبول كسر من FLIP.
- انتهاء `flipWindow` وهو في حالة BROKEN.

**حالة خاصة:**
- كسر مقبول من حالة FLIP يؤدي إلى DEAD. Accepted يصدر إن كان المستوى مسلّحًا، ثم يُمسح الـarm.

**قيود على النطاق:**
- Breaking وRejection لم يتغيرا: كلاهما يُفحص في كل شمعة.
- هندسة المناطق والخانات لم تتغير. عدد الشموع التي تختلف فيها خريطة الخانات = 0 على الـseeds 21 و7 و5.

**الأثر** (synthetic، الـseed 21):
- Breaking وRejection: صفر فروق.
- على مستوى المستويات:
  - Accepted: 162 انتقالًا مستعادًا (كانت مسلّحة لكن غير معروضة)، و31 انتقالًا أُزيل (سلسلة بدأت مخفية).
  - Flip: 98 مستعادًا، و16 أُزيلت.
- على مستوى الشموع: عدد شموع Flip ارتفع من 104 إلى 182، ومجموع أعلام Accepted (صاعد + هابط) من 559 إلى 657.

## أسئلة عقد مفتوحة (CONTRACT_DECISION_NEEDED — لم يتغير شيء)

| # | السؤال | الدليل |
|---|---|---|
| Q-A | نص رسالة Break Accepted يقول «المستوى الآن Flip محتمل». لكن كسرًا مقبولًا لمستوى في حالة FLIP ينتهي بـDEAD، وليس بـFlip محتمل. هل نغيّر نص الرسالة، أم نفصل حدثًا خاصًا لموت الـFlip؟ | B7 (`state = DEAD` مع `acceptedUp = true`) |
| Q-B | No Chase لا يعرف هوية العائق. إذا تغيّر العائق المنخرط وبقي `noChase` صحيحًا، لا يصدر تنبيه جديد. هل هذا هو المقصود؟ | A3 |
| Q-C | الارتفاع الكبير في عدد أحداث Flip/Accepted بعد R4-B على بيانات synthetic. هل يلزم قياس المعدل على بيانات حقيقية (S2) قبل اعتماد العقد نهائيًا؟ | `artifacts/r4-impact-synthetic.txt` |
