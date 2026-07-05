/**
 * تهيئة قاعدة البيانات في الإنتاج (يُستدعى أثناء بناء Vercel).
 * يشتقّ اتصالاً مباشراً (non-pooled) من DATABASE_URL لأن هجرات Prisma لا تعمل
 * عبر اتصال Neon المُجمّع (pgbouncer). ثم يطبّق الهجرات ويبذر البيانات.
 *
 * معالجة ذاتية لـ P3009: إن سبق لهجرة أن فشلت (مثلاً بسبب انقطاع عابر أثناء
 * أوّل نشر) فإن Prisma يسجّلها كـ«فاشلة» ويرفض كلّ «migrate deploy» لاحق للأبد.
 * هنا نكتشف هذه الحالة، نعلّم الهجرة الفاشلة كـ«rolled back» (لأن هجراتنا تعمل
 * ضمن معاملة واحدة فلا تُخلّف أثراً عند فشلها)، ثم نعيد المحاولة — بدل أن يبقى
 * النشر معطّلاً بلا نهاية.
 */
import { execSync } from "node:child_process";

const raw = process.env.DATABASE_URL || "";
if (!raw) {
  console.error("[setup-prod] DATABASE_URL غير مضبوط — تخطّي تهيئة القاعدة.");
  process.exit(0);
}

// اتصال مباشر: إزالة -pooler و channel_binding (غير مدعوم في بعض المحرّكات)
const direct = raw
  .replace("-pooler", "")
  .replace(/[?&]channel_binding=require/, "");

const env = { ...process.env, DATABASE_URL: direct, DIRECT_URL: direct };

function deploy() {
  execSync("prisma migrate deploy", { stdio: "inherit", env });
}

/**
 * يرفع حظر P3009: يعلّم أي هجرة بدأت ولم تكتمل (فاشلة) كـ«rolled back»، فيعاملها
 * Prisma كأنها لم تُطبَّق ويعيد تطبيقها في المحاولة التالية. آمن لأن هجراتنا
 * معامَلاتية (تُتراجَع بالكامل عند الفشل فلا تترك فهرساً أو امتداداً نصفيّاً).
 */
function clearFailedMigrations() {
  const sql =
    'UPDATE "_prisma_migrations" SET rolled_back_at = now() ' +
    "WHERE finished_at IS NULL AND rolled_back_at IS NULL;";
  execSync("prisma db execute --schema prisma/schema.prisma --stdin", {
    input: sql,
    stdio: ["pipe", "inherit", "inherit"],
    env,
  });
}

/**
 * شبكة أمان: تضمن وجود المخطّط الذي يعتمده التطبيق حتى لو انحرف سجلّ الهجرات في
 * الإنتاج (مثلاً هجرة سُجِّلت «مطبَّقة» بينما لم تُنفَّذ فعلياً — فيتخطّاها
 * `migrate deploy` للأبد). كل الجُمل idempotent (IF NOT EXISTS) فهي لا-عمليّة إن
 * كان المخطّط سليماً، وتُصلحه إن كان ناقصاً. تُغطّي ميزات: الكوبونات، الخصم على
 * الطلب، وعمولة الفئة.
 */
function reconcileSchema() {
  const sql = `
    ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "discount" DECIMAL(12,2) NOT NULL DEFAULT 0;
    ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "couponCode" TEXT;
    ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "commissionRate" DECIMAL(5,4);
    CREATE TABLE IF NOT EXISTS "Coupon" (
      "id" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "value" DECIMAL(12,2) NOT NULL,
      "minSubtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
      "maxDiscount" DECIMAL(12,2),
      "usageLimit" INTEGER,
      "usedCount" INTEGER NOT NULL DEFAULT 0,
      "expiresAt" TIMESTAMP(3),
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_code_key" ON "Coupon"("code");
    CREATE INDEX IF NOT EXISTS "Coupon_isActive_expiresAt_idx" ON "Coupon"("isActive", "expiresAt");
  `;
  execSync("prisma db execute --schema prisma/schema.prisma --stdin", {
    input: sql,
    stdio: ["pipe", "inherit", "inherit"],
    env,
  });
}

console.log("[setup-prod] تطبيق الهجرات (اتصال مباشر)…");
try {
  deploy();
} catch (e) {
  console.error(
    "[setup-prod] فشل migrate deploy — معالجة الهجرات الفاشلة (P3009) وإعادة المحاولة…",
  );
  try {
    clearFailedMigrations();
    deploy();
    console.log("[setup-prod] نجحت إعادة المحاولة بعد المعالجة الذاتية.");
  } catch (e2) {
    // فشل حقيقي (وليس مجرّد سجلّ فاشل قديم) — أوقف البناء بدل نشر مخطّط غير متوافق.
    console.error("[setup-prod] تعذّر إصلاح الهجرات تلقائياً.");
    throw e2;
  }
}

// شبكة أمان بعد الهجرات: تضمن توافق المخطّط مع التطبيق (idempotent) حتى لو انحرف
// سجلّ الهجرات. غير حرجة — نُسجّل الفشل دون إيقاف البناء.
try {
  console.log("[setup-prod] تسوية المخطّط (شبكة أمان idempotent)…");
  reconcileSchema();
} catch (e) {
  console.error("[setup-prod] تعذّرت تسوية المخطّط:", e?.message ?? e);
}

try {
  console.log("[setup-prod] بذر البيانات…");
  execSync("tsx prisma/seed.ts", { stdio: "inherit", env });
} catch (e) {
  // البذر غير حرج — الجداول أُنشئت على أي حال
  console.error("[setup-prod] تم تخطّي البذر:", e?.message ?? e);
}
