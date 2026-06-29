/**
 * تهيئة قاعدة البيانات في الإنتاج (يُستدعى أثناء بناء Vercel).
 * يشتقّ اتصالاً مباشراً (non-pooled) من DATABASE_URL لأن هجرات Prisma لا تعمل
 * عبر اتصال Neon المُجمّع (pgbouncer). ثم يطبّق الهجرات ويبذر البيانات.
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

console.log("[setup-prod] تطبيق الهجرات (اتصال مباشر)…");
execSync("prisma migrate deploy", { stdio: "inherit", env });

try {
  console.log("[setup-prod] بذر البيانات…");
  execSync("tsx prisma/seed.ts", { stdio: "inherit", env });
} catch (e) {
  // البذر غير حرج — الجداول أُنشئت على أي حال
  console.error("[setup-prod] تم تخطّي البذر:", e?.message ?? e);
}
