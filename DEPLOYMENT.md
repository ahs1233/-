# دليل النشر — السوگ

نشر المنصة برابط عام تفتحه من هاتفك.

---

## 🚀 الأسهل: نشر بنقرة على Render (قاعدة بيانات + تطبيق معاً)

هذا المسار يُنشئ كل شيء تلقائياً (قاعدة البيانات + الهجرات + البيانات + الموقع)،
ويعرض **رمز الدخول على الشاشة** فتسجّل الدخول مباشرةً من هاتفك دون إعداد SMS.

**الخطوات (≈5 دقائق، تحتاج فقط حساب Render مجاني):**

1. أنشئ حساباً على <https://render.com> (سجّل بحساب GitHub).
2. اضغط **New +** → **Blueprint**.
3. اختر مستودعك `ahs1233/-` والفرع `claude/al-souq-ecommerce-build-ym3pze`.
   - Render يقرأ `render.yaml` تلقائياً ويُظهر: قاعدة بيانات + خدمة ويب.
4. اضغط **Apply**. انتظر اكتمال البناء (بضع دقائق) → ستحصل على رابط مثل
   `https://al-souq.onrender.com`.

**جرّبه:**
- افتح الرابط → تصفّح المنتجات → أضف للسلة → أتمم طلباً بالدفع عند الاستلام.
- **لوحة الأدمن**: افتح `/admin` وسجّل الدخول بالهاتف `07700000000`.
  أدخل الرقم → سيظهر **رمز الدخول على نفس الصفحة** → أدخله.
- **لوحة بائع**: `/vendor` بالهاتف `07701111111`.

> ملاحظة: الخطة المجانية على Render «تنام» بعد فترة خمول، فقد يتأخّر أول فتح
> بضع ثوانٍ. كافٍ للتجربة والعرض. للاستخدام الجادّ ارفعها لخطة مدفوعة بسيطة.

> ⚠️ `SMS_PROVIDER=console` يعني أن رمز OTP يظهر للجميع على الشاشة — مناسب
> للتجربة الشخصية فقط. لإطلاق للعموم أضف مزوّد SMS حقيقياً (انظر آخر الملف).

---

## بديل: Vercel (الويب) + Neon (PostgreSQL)

مناسب لأداء أعلى لكنه يتطلّب خطوات يدوية أكثر (قاعدة بيانات منفصلة + تطبيق الهجرات
من جهازك).

---

## أولاً: قاعدة البيانات (Neon — مجاني للبداية)

1. أنشئ مشروعاً على <https://neon.tech> واختر منطقة قريبة.
2. من **Connection Details** انسخ رابطين:
   - **Pooled** (يحوي `-pooler`) → سيكون `DATABASE_URL`
   - **Direct** (بلا `-pooler`) → سيكون `DIRECT_URL`
   - أضف `?sslmode=require` إن لم يكن موجوداً.

مثال:
```
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/al_souq?sslmode=require"
DIRECT_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/al_souq?sslmode=require"
```

## ثانياً: طبّق الهجرات والبذور (مرة واحدة، من جهازك)

```bash
git checkout claude/al-souq-ecommerce-build-ym3pze
pnpm install

# صدّر رابطي Neon
export DATABASE_URL="…pooler…"
export DIRECT_URL="…direct…"

pnpm db:generate
pnpm db:deploy     # يطبّق prisma/migrations على Neon
pnpm db:seed       # محافظات + فئات + بائعون ومنتجات + حساب أدمن
```

## ثالثاً: انشر الويب على Vercel

1. <https://vercel.com> → **Add New Project** → اربط المستودع.
2. **Root Directory**: اتركه على جذر المستودع (`.`). الإعدادات تأتي من `vercel.json`.
3. أضف **Environment Variables** (انظر الجدول أدناه) لبيئة Production.
4. **Deploy**. سيُنشئ Vercel رابطاً عاماً مثل `https://al-souq.vercel.app`.

> `vercel.json` يضبط: التثبيت بـ pnpm، البناء = `db:generate` ثم بناء الويب،
> ومخرجات `apps/web/.next`. هدف Prisma `rhel-openssl-3.0.x` مضبوط مسبقاً لبيئة Vercel.

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
