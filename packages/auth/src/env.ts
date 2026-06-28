/** قراءة إعدادات Auth من البيئة مع قيم افتراضية آمنة للتطوير. */

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

export const authEnv = {
  get accessSecret() {
    return str("JWT_ACCESS_SECRET", "dev-access-secret-change-me-please-32+chars");
  },
  get refreshSecret() {
    return str("JWT_REFRESH_SECRET", "dev-refresh-secret-change-me-please-32+chars");
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
