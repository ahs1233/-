# 🗺️ PROJECT_MAP — السوگ (al-Souq)

> خريطة الذاكرة: نقطة الدخول الواحدة للمشروع. مختصرةٌ عمدًا؛ التفاصيل في الوثائق المُفهرَسة أسفله.
> آخر تحديث: 2026-08 · المصدر: حقائق الريبو المُتحقّقة (لا تخمين).

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

**نقاط انتباه (Tech Debt واعٍ)**:
- `seed.ts` يؤدّي دور CMS ويُشغَّل في الإنتاج → البيانات الحقيقيّة تُدار عبر لوحة الإدارة لا الكود.
- SMS ودفعٌ حقيقيّان غير موصولَين (OTP يعيد devCode في التطوير).
- خطّة التحصين الأمنيّ (JWT defaults · حدّ OTP · CSP · Sentry · S3) لم تُنفَّذ كاملة قبل الإطلاق العام.

---

## 🔄 SYSTEM_FLOW

**العقد المعماريّ**: `web (RSC/Client)` → `tRPC routers` → `services (منطق domain)` → `Prisma` → `Postgres`.
الفصل صارم: منطق الأعمال في `packages/api/services` و`packages/domain`؛ العرض لا يحوي منطقًا.

```
المشتري (RTL) ──▶ Next App Router ──▶ tRPC client ──▶ tRPC routers (14) ──▶ services ──▶ Prisma ──▶ Neon
   │                                                        │
   ├─ دخول: OTP هاتف ──▶ auth router ──▶ JWT (access+refresh cookie)
   ├─ تصفّح: catalog/discovery (خلاصة داكنة · أقسام · نبض · قريب منك GPS)
   ├─ متجر: catalog.storeBySlug (شخصيّة + أقسام داخليّة + نبض + من نفس البيئة)
   ├─ سلّة/طلب: order service (حجز مخزون ذرّي · ترقيم مقاوم للحذف · COD)
   └─ آلة حالة الطلب: PENDING→CONFIRMED→PREPARING→SHIPPED→DELIVERED (+RETURNED/CANCELLED)

التاجر ──▶ vendor router: منتجات · أقسام · طلبات · تسوية · كشف حساب
الأدمن ──▶ admin router (RBAC + adminPerm): لوحة «المظهر» (ثيم · تخطيط · أسواق · متاجر · فئات · محافظات · إعلانات · محتوى)
```

**الأمان**: RBAC + حماية IDOR (ملكيّة البائع/المستخدم لبياناته) + مدقّقات Zod شاملة + سجلّ تدقيق (AuditLog).

**النماذج (31)**: المحور = `VendorProfile` (+ `VendorSection`, `StoreActivity`) · `Product` (+ variants/images) · `Order` (+ items/history/commission/payout) · `Category` · الجغرافيا (`Governorate`/`Area`/`Address`) · المنصّة (`Market`/`Ad`/`Article`/`Coupon`/`PlatformSetting`). ٢٥ هجرة.

**الحالة الميدانيّة**: النجف مبذورة (٣٣ متجرًا)؛ ٤ متاجر مرجعيّة كاملة بصورٍ حقيقيّة (أسواق شمسة · هوم سنتر · عزّوز · بوّابة السعد). صفر جذبٍ حقيقيّ بعد.

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
