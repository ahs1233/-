import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * اختبار اختيار مزوّد SMS وحارس الإنتاج.
 * getSmsProvider يخزّن النتيجة مؤقتاً على مستوى الوحدة، لذا نعيد ضبط الوحدات
 * ونضبط البيئة قبل كل استيراد.
 */
async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const k of Object.keys(env)) {
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
  return import("./sms");
}

const BASE = {
  SMS_PROVIDER: undefined,
  SMS_ALLOW_CONSOLE: undefined,
  SMS_HTTP_URL: undefined,
  TWILIO_ACCOUNT_SID: undefined,
  TWILIO_AUTH_TOKEN: undefined,
  TWILIO_FROM: undefined,
} as Record<string, string | undefined>;

describe("getSmsProvider", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
  });

  it("dev + console → مزوّد console ويكشف الرمز", async () => {
    const { getSmsProvider, isDevCodeExposed } = await load({ ...BASE, NODE_ENV: "development", SMS_PROVIDER: "console" });
    expect(getSmsProvider().name).toBe("console");
    expect(isDevCodeExposed()).toBe(true);
  });

  it("production + console (افتراضي) → يعمل مع تحذير (غير كاسر)", async () => {
    const { getSmsProvider } = await load({ ...BASE, NODE_ENV: "production", SMS_PROVIDER: "console" });
    expect(getSmsProvider().name).toBe("console");
  });

  it("production + console + SMS_ALLOW_CONSOLE=false → يفشل (وضع صارم)", async () => {
    const { getSmsProvider } = await load({
      ...BASE,
      NODE_ENV: "production",
      SMS_PROVIDER: "console",
      SMS_ALLOW_CONSOLE: "false",
    });
    expect(() => getSmsProvider()).toThrow(/ممنوع/);
  });

  it("http + URL مضبوط → مزوّد http ولا يكشف الرمز", async () => {
    const { getSmsProvider, isDevCodeExposed } = await load({
      ...BASE,
      NODE_ENV: "production",
      SMS_PROVIDER: "http",
      SMS_HTTP_URL: "https://sms.example.iq/send",
    });
    expect(getSmsProvider().name).toBe("http");
    expect(isDevCodeExposed()).toBe(false);
  });

  it("twilio بلا بيانات اعتماد → يفشل بوضوح", async () => {
    const { getSmsProvider } = await load({ ...BASE, NODE_ENV: "production", SMS_PROVIDER: "twilio" });
    expect(() => getSmsProvider()).toThrow(/TWILIO/);
  });
});
