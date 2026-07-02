/** قراءة إعدادات Auth من البيئة مع قيم افتراضية آمنة للتطوير. */

const isProd = process.env.NODE_ENV === "production";

function int(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v) return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`متغير البيئة المطلوب مفقود: ${name}`);
}

/**
 * سرّ حسّاس: في الإنتاج يجب أن يأتي من البيئة وبطول كافٍ، وإلا نفشل بصوت عالٍ
 * بدل التوقيع بسرّ تطوير معروف علنياً (ثغرة انتحال هوية).
 */
function secret(name: string, devFallback: string): string {
  const v = process.env[name];
  if (v && v.length >= 16) return v;
  if (isProd) {
    throw new Error(
      `سرّ مطلوب مفقود أو ضعيف في الإنتاج: ${name} (اضبطه في متغيّرات البيئة بطول ٣٢ محرفاً فأكثر)`,
    );
  }
  return devFallback;
}

export const authEnv = {
  get accessSecret() {
    return secret("JWT_ACCESS_SECRET", "dev-access-secret-change-me-please-32+chars");
  },
  get refreshSecret() {
    return secret("JWT_REFRESH_SECRET", "dev-refresh-secret-change-me-please-32+chars");
  },
  get accessTtl() {
    return int("JWT_ACCESS_TTL", 900);
  },
  get refreshTtl() {
    return int("JWT_REFRESH_TTL", 2592000);
  },
  get otpTtl() {
    return int("OTP_TTL_SECONDS", 300);
  },
  get otpMaxAttempts() {
    return int("OTP_MAX_ATTEMPTS", 5);
  },
  get otpLength() {
    return int("OTP_LENGTH", 6);
  },
  get smsProvider() {
    return str("SMS_PROVIDER", "console");
  },
};
