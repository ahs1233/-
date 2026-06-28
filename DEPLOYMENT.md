# دليل النشر — السوگ

نشر المنصة برابط عام. المسار الموصى به: **Vercel (الويب) + Neon (PostgreSQL)**،
مع خيارات اختيارية للصور (Cloudflare R2/S3) والإشعارات (VAPID).

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
