/**
 * تجريد مزوّد الرسائل النصية (OTP).
 * واجهة واحدة تسمح بتبديل المزوّد عبر البيئة دون تغيير منطق الأعمال:
 *  - console: للتطوير، يطبع الرمز في السجل (غير آمن في الإنتاج — تحذير).
 *  - twilio: عبر REST API (بلا SDK) — للاستخدام العالمي.
 *  - http:   بوابة HTTP/JSON عامة قابلة للضبط — تغطّي معظم مزوّدي العراق.
 *
 * الاختيار عبر SMS_PROVIDER. في الإنتاج يبقى console يعمل مع تحذير (غير كاسر)،
 * ويصبح آمناً تلقائياً بمجرد ضبط مزوّد حقيقي (twilio|http). لمنع console صراحةً
 * في الإنتاج بعد تجهيز مزوّد: SMS_ALLOW_CONSOLE=false.
 */
import { authEnv } from "./env";

export interface SmsMessage {
  to: string; // E.164
  body: string;
}

export interface SmsProvider {
  readonly name: string;
  send(msg: SmsMessage): Promise<void>;
}

/** مزوّد التطوير: يطبع الرسالة بدل إرسالها فعلياً. */
class ConsoleSmsProvider implements SmsProvider {
  readonly name = "console";
  async send(msg: SmsMessage): Promise<void> {
    // eslint-disable-next-line no-console
    console.info(`📲 [SMS:console] → ${msg.to}\n${msg.body}`);
  }
}

/** Twilio عبر REST API مباشرةً (fetch)، بلا اعتماد على حزمة SDK. */
class TwilioSmsProvider implements SmsProvider {
  readonly name = "twilio";
  constructor(
    private readonly sid: string,
    private readonly token: string,
    private readonly from: string,
  ) {}
  async send(msg: SmsMessage): Promise<void> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.sid}/Messages.json`;
    const auth = Buffer.from(`${this.sid}:${this.token}`).toString("base64");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: msg.to, From: this.from, Body: msg.body }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`فشل إرسال SMS عبر Twilio (${res.status}): ${detail.slice(0, 200)}`);
    }
  }
}

/**
 * بوابة HTTP/JSON عامة. تُرسل POST بجسم JSON بحقول قابلة للتسمية،
 * مع دمج حقول إضافية (مفتاح API/المُرسِل) وترويسة مصادقة اختيارية.
 * أمثلة المتغيّرات:
 *   SMS_HTTP_URL=https://api.provider.iq/send
 *   SMS_HTTP_TO_FIELD=to   SMS_HTTP_TEXT_FIELD=message
 *   SMS_HTTP_EXTRA={"api_key":"xxx","sender":"AlSouq"}
 *   SMS_HTTP_AUTH=Bearer xxx
 */
class HttpSmsProvider implements SmsProvider {
  readonly name = "http";
  constructor(
    private readonly cfg: {
      url: string;
      toField: string;
      textField: string;
      extra: Record<string, unknown>;
      auth?: string;
    },
  ) {}
  async send(msg: SmsMessage): Promise<void> {
    const payload = { [this.cfg.toField]: msg.to, [this.cfg.textField]: msg.body, ...this.cfg.extra };
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.cfg.auth) headers.Authorization = this.cfg.auth;
    const res = await fetch(this.cfg.url, { method: "POST", headers, body: JSON.stringify(payload) });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`فشل إرسال SMS عبر بوابة HTTP (${res.status}): ${detail.slice(0, 200)}`);
    }
  }
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`متغير البيئة المطلوب لمزوّد SMS مفقود: ${name}`);
  return v;
}

let cached: SmsProvider | null = null;

/** يعيد المزوّد المُعدّ في البيئة (مع تخزين مؤقت). */
export function getSmsProvider(): SmsProvider {
  if (cached) return cached;
  const isProd = process.env.NODE_ENV === "production";

  switch (authEnv.smsProvider) {
    case "twilio":
      cached = new TwilioSmsProvider(
        required("TWILIO_ACCOUNT_SID"),
        required("TWILIO_AUTH_TOKEN"),
        required("TWILIO_FROM"),
      );
      break;
    case "http":
      cached = new HttpSmsProvider({
        url: required("SMS_HTTP_URL"),
        toField: process.env.SMS_HTTP_TO_FIELD || "to",
        textField: process.env.SMS_HTTP_TEXT_FIELD || "message",
        extra: JSON.parse(process.env.SMS_HTTP_EXTRA || "{}"),
        auth: process.env.SMS_HTTP_AUTH || undefined,
      });
      break;
    case "console":
    default:
      if (isProd && process.env.SMS_ALLOW_CONSOLE === "false") {
        throw new Error(
          "SMS_PROVIDER=console ممنوع في الإنتاج (SMS_ALLOW_CONSOLE=false). اضبط مزوّداً حقيقياً (twilio أو http).",
        );
      }
      if (isProd) {
        // eslint-disable-next-line no-console
        console.warn(
          "⚠️ SMS في وضع console داخل الإنتاج — رمز OTP يُعرض للعميل (مؤقت وغير آمن). اضبط مزوّداً حقيقياً.",
        );
      }
      cached = new ConsoleSmsProvider();
  }
  return cached;
}

/** هل الوضع الحالي يُظهر الرمز للعميل (console)؟ */
export function isDevCodeExposed(): boolean {
  return authEnv.smsProvider === "console";
}

/** نص رسالة OTP بالعربية. */
export function otpMessage(code: string): string {
  return `رمز الدخول إلى السوگ: ${code}\nلا تشاركه مع أحد. صالح لدقائق معدودة.`;
}
