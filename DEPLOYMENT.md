# دليل النشر — السوگ

نشر المنصة برابط عام تفتحه من هاتفك.

---

## ✅ الأسهل (بلا بطاقة، كله من المتصفّح/الآيباد): Vercel + Neon

> Render صار يطلب بطاقة ائتمان. هذا الطريق **مجاني تماماً بلا بطاقة**، وكل خطواته
> من المتصفّح — لا تحتاج حاسوباً. قاعدة البيانات والمنتجات تُنشأ **تلقائياً** أثناء البناء.

### الجزء 1 — قاعدة البيانات على Neon (دقيقتان، بلا بطاقة)

1. افتح <https://neon.tech> → **Sign up with GitHub**.
2. **Create project**: الاسم `al-souq`، المنطقة اختر **Frankfurt** (الأقرب للعراق).
3. بعد الإنشاء تظهر صفحة **Connection string**. تحتاج نسختين:
   - مع زرّ **Connection pooling مُفعّل** → انسخ الرابط (يحوي `-pooler`) = **DATABASE_URL**
   - أطفئ **Connection pooling** → انسخ الرابط (بلا `-pooler`) = **DIRECT_URL**
   - احتفظ بالرابطين (الصقهما في ملاحظة مؤقتة).

### الجزء 2 — النشر على Vercel (٣ دقائق، بلا بطاقة)

1. افتح <https://vercel.com> → **Continue with GitHub**.
2. **Add New… → Project** → اختر مستودعك `-` → **Import**.
3. اترك كل الإعدادات كما هي (Vercel يقرأها من `vercel.json`).
4. وسّع **Environment Variables** وأضف هذه الخمسة:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | رابط Neon المُجمّع (pooler) |
   | `DIRECT_URL` | رابط Neon المباشر |
   | `JWT_ACCESS_SECRET` | المفتاح الأول الذي أعطيتك إياه في المحادثة |
   | `JWT_REFRESH_SECRET` | المفتاح الثاني |
   | `SMS_PROVIDER` | `console` |

5. اضغط **Deploy** وانتظر (≈٣ دقائق). ستحصل على رابط مثل `https://al-souq-xxxx.vercel.app`.

> أثناء البناء، Vercel يُنشئ كل الجداول ويملأ المنتجات العراقية تلقائياً
> (`db:deploy` + `db:seed` مضبوطان في `vercel.json`).

### جرّبه من هاتفك
- افتح الرابط → تصفّح → أضف للسلة → أتمم طلباً (دفع عند الاستلام).
- **تسجيل الدخول**: أدخل أي رقم → **رمز الدخول يظهر على نفس الصفحة** → اكتبه.
- **لوحة الإدارة**: `/admin` بالرقم `07700000000`.
- **لوحة بائع**: `/vendor` بالرقم `07701111111`.

> ⚠️ `SMS_PROVIDER=console` يُظهر رمز الدخول على الشاشة — ممتاز للتجربة الشخصية،
> وغير مناسب لإطلاق عام (أضف مزوّد SMS لاحقاً — انظر آخر الملف).

---

## بديل: نشر بنقرة على Render (يتطلّب بطاقة للتحقّق)

ملف `render.yaml` جاهز: **New + → Blueprint → اختر المستودع → Apply**. يُنشئ القاعدة
والموقع معاً تلقائياً. لكن Render يطلب بطاقة ائتمان للتحقّق (لا يخصم منها فعلياً).

---

## متغيّرات البيئة المطلوبة

| المتغيّر | مطلوب | الوصف |
|---|---|---|
| `DATABASE_URL` | ✅ | رابط Neon المُجمّع (pooled) |
| `DIRECT_URL` | ✅ | رابط Neon المباشر (للهجرات) |
| `JWT_ACCESS_SECRET` | ✅ | سرّ عشوائي ≥32 حرف (`openssl rand -base64 48`) |
| `JWT_REFRESH_SECRET` | ✅ | سرّ عشوائي آخر |
| `NEXT_PUBLIC_APP_URL` | ✅ | رابط النشر، مثل `https://al-souq.vercel.app` |
| `SMS_PROVIDER` | ✅ | `console` مبدئياً (انظر ملاحظة الدخول) |
| `S3_*` | ⛶ | تخزين الصور (اختياري — انظر أدناه) |
| `VAPID_*`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | ⛶ | إشعارات Push (اختياري) |

ولّد الأسرار:
```bash
openssl rand -base64 48   # لكل من JWT_ACCESS_SECRET و JWT_REFRESH_SECRET
```

---

## رابعاً (اختياري): صور المنتجات — Cloudflare R2

بدونها يعمل كل شيء، لكن رفع الصور يتحوّل إلى «لصق رابط». لتفعيل الرفع:

1. أنشئ Bucket على R2 (أو أي S3-compatible) واجعله عاماً للقراءة.
2. أضف:
```
S3_ENDPOINT="https://<account>.r2.cloudflarestorage.com"
S3_REGION="auto"
S3_BUCKET="al-souq-media"
S3_ACCESS_KEY="…"
S3_SECRET_KEY="…"
S3_PUBLIC_URL="https://media.yourdomain.com"   # نطاق عام للـ Bucket
```

## خامساً (اختياري): إشعارات Push

```bash
pnpm vapid     # يطبع Public/Private
```
أضف `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
و`NEXT_PUBLIC_VAPID_PUBLIC_KEY` (= نفس العام).

---

## بديل: استضافة ذاتية بـ Docker

```bash
docker build -t al-souq-web .
docker run -p 3000:3000 \
  -e DATABASE_URL=… -e DIRECT_URL=… \
  -e JWT_ACCESS_SECRET=… -e JWT_REFRESH_SECRET=… \
  -e NEXT_PUBLIC_APP_URL=https://yourdomain \
  al-souq-web
```
طبّق الهجرات والبذور مرة واحدة كما في الخطوة الثانية.

---

## بعد النشر

- **حساب الأدمن**: الهاتف `07700000000` (من البذور). لوحة الإدارة على `/admin`.
- **حسابات البائعين التجريبية**: `07701111111` … `07704444444`.
- **⚠️ تسجيل الدخول في الإنتاج**: مزوّد SMS الحالي هو `console` — أي أن رمز OTP
  يُطبع في **سجلّات الخادم** (Vercel → Functions Logs) ولا يصل برسالة فعلية.
  للدخول الآن: افتح السجلّات واقرأ الرمز. لإطلاق حقيقي للمستخدمين، أضف مزوّد SMS
  عراقي بتنفيذ واجهة `SmsProvider` في `packages/auth/src/sms.ts` (نقطة تمديد جاهزة).
- بدّل هاتف الأدمن الافتراضي بعد أول دخول.
