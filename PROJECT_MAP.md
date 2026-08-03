# 🗺️ PROJECT_MAP — السوگ (al-Souq)

> خريطة الذاكرة: نقطة الدخول الواحدة للمشروع. مختصرةٌ عمدًا؛ التفاصيل في الوثائق المُفهرَسة أسفله.
> آخر تحديث: 2026-08 · مزامنةٌ حيّة (بروتوكول التنفيذ) · المصدر: حقائق الريبو المُتحقّقة (لا تخمين).

**ما هو**: سوقٌ إلكترونيّ عراقيّ متعدّد البائعين، عربيّ RTL، الدفع عند الاستلام (COD). مبنيٌّ ككيانٍ حيٍّ لكلّ متجر (هويّة + أقسام داخليّة + نبض سوق). مُنشور على Vercel + Neon.

---

## 🧱 TECH_STACK

| الطبقة | التقنية | الإصدار |
|---|---|---|
| إطار العمل | Next.js (App Router) | 14.2.5 |
| اللغة | TypeScript | ^5.5 |
| الواجهة | React · TailwindCSS · lucide-react · Leaflet | 18.3 |
| الحالة | Zustand · TanStack Query | 4 · 5 |
| API | tRPC (server/client/react) · trpc-to-openapi · superjson | 11 rc |
| التحقّق | Zod | ^3.23 |
| ORM/DB | Prisma + PostgreSQL (Neon) | Prisma ^5.18 |
| المصادقة | JWT (access/refresh) + OTP هاتف | — |
| التخزين | S3/R2 (presigned) — *غير مُفعّل بعد؛ بدائل محليّة* | — |
| البنية | pnpm workspaces + Turborepo | turbo ^2 |
| النشر | Vercel (web) + Neon (db) · `setup:prod` = migrate deploy + seed | — |

**Monorepo** — `apps/web` + عشر حزم: `api · auth · config · db · domain · i18n · storage · ui · utils · validators`.

**نقاط انتباه (Tech Debt واعٍ)**: الدَّين والميزات الناقصة مُجمَّعةٌ في قسم **ORPHANS & PENDING** أدناه (مزامنةٌ حيّة).

---

## 🔄 SYSTEM_FLOW

**العقد المعماريّ**: `web (RSC/Client)` → `tRPC routers` → `services (منطق domain)` → `Prisma` → `Postgres`.
الفصل صارم: منطق الأعمال في `packages/api/services` و`packages/domain`؛ العرض لا يحوي منطقًا.

```
المشتري (RTL) ──▶ Next App Router ──▶ tRPC client ──▶ tRPC routers (14) ──▶ services ──▶ Prisma ──▶ Neon
   │                                                        │
   ├─ دخول: OTP هاتف ──▶ auth router ──▶ JWT (access+refresh cookie)
   ├─ تصفّح: catalog/discovery (خلاصة داكنة · أقسام · نبض · قريب منك GPS)
   ├─ متجر: catalog.storeBySlug (شخصيّة + أقسام داخليّة + نبض + من نفس البيئة + شارة مميّز/طبقة)
   ├─ سلّة/طلب: order service (حجز مخزون ذرّي · ترقيم مقاوم للحذف · COD)
   └─ آلة حالة الطلب: PENDING→CONFIRMED→PREPARING→SHIPPED→DELIVERED (+RETURNED/CANCELLED)

التاجر ──▶ vendor router: منتجات · أقسام · طلبات · تسوية · كشف حساب
الأدمن ──▶ admin router (RBAC + adminPerm): لوحة «المظهر» (ثيم · تخطيط · أسواق · متاجر · اشتراكات · فئات · محافظات · إعلانات · محتوى)
الدخل ──▶ محرّك التحصيل: طبقات (free/silver/gold عبر PlatformSetting) + ظهورٌ مدفوع (featuredUntil + نبضٌ sponsored) → placementScore يرتّب قوائم المتاجر
```

**الأمان**: RBAC + حماية IDOR (ملكيّة البائع/المستخدم لبياناته) + مدقّقات Zod شاملة + سجلّ تدقيق (AuditLog).

**النماذج (31)**: المحور = `VendorProfile` (+ `VendorSection`, `StoreActivity`؛ حقولٌ للدخل: plan/planExpiresAt/featuredUntil، وsponsored على النبض) · `Product` (+ variants/images) · `Order` (+ items/history/commission/payout) · `Category` · الجغرافيا (`Governorate`/`Area`/`Address`) · المنصّة (`Market`/`Ad`/`Article`/`Coupon`/`PlatformSetting`). ٢٦ هجرة.

**الحالة الميدانيّة**: النجف مبذورة (٣٣ متجرًا)؛ ٤ متاجر مرجعيّة كاملة بصورٍ حقيقيّة (أسواق شمسة · هوم سنتر · عزّوز · بوّابة السعد). محرّك الدخل جاهزٌ ويُدار من الإدارة. صفر جذبٍ حقيقيّ بعد.

---

## ⏳ ORPHANS & PENDING (ميزاتٌ غير مكتملة — مزامنةٌ حيّة)

> ليست أخطاءً، بل عملٌ مقصودٌ مؤجَّل. تُحدَّث مع كلّ تنفيذ.

**PENDING — مطلوبٌ قبل الإطلاق العام (بالأولويّة):**
1. **SMS حقيقيّ**: مزوّد عراقيّ فعليّ — حاليًّا OTP يعيد devCode (تطوير فقط). *معيار النجاح: مستخدمٌ حقيقيٌّ يسجّل دخوله برمزٍ SMS.*
2. **التحصين الأمنيّ**: fail-fast لأسرار JWT · حدّ معدّل OTP · ترويسات/CSP · تنظيف المسارات. *(خطّةٌ موثّقة، غير منفّذة.)*
3. **تخزين الصور S3/R2**: `packages/storage` جاهز (presigned) لكنّه غير مُفعّل؛ الأصول الحاليّة محليّة في `public/stores`. *يلزم لرفع التجّار الحقيقيّين.*
4. **مراقبة**: لا Sentry/تنبيهات — أخطاء الإنتاج تُبتلع.
5. **بوّابة دفع**: COD فقط؛ محرّك الدخل يعمل بتحصيلٍ يدويّ. *عند وصولها تُلحَق بحقول plan/featured الموجودة (لا إعادة بناء).*

**ORPHANS — قائمٌ لكن ناقص العمق:**
- **٢٩ متجرًا نجفيًّا** بكتالوجٍ مصغّر (٤–٦ منتجات) وبدائل صور — مقابل ٤ مرجعيّة كاملة.
- **صور أسواق شمسة للمنتجات**: على البدائل (مكتبة الدليل منخفضة الدقّة)؛ شعارها/واجهتها حقيقيّان.
- **`seed.ts` كـCMS إنتاج**: البيانات الحقيقيّة يجب أن تُدخَل عبر لوحة الإدارة (جاهزة) لا الكود.
- **بغداد/البصرة**: النموذج قابلٌ للتكرار لكن غير مبذور.

---

## 📚 الوثائق المُفهرَسة (للتعمّق)

| الملف | المحتوى |
|---|---|
| `ARCHITECTURE.md` | البنية والعقود والقرارات المعماريّة |
| `STATE_BOOK.md` | حالة الشاشات والميزات |
| `V2_NOTES.md` | قرارات وملاحظات النسخة الثانية |
| `DEPLOYMENT.md` | النشر (Vercel/Neon · `setup:prod`) |
| `DELIVERY.md` | ملخّص التسليم |
| `README.md` | البدء والتشغيل المحليّ |
