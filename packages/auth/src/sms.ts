/**
 * تجريد مزوّد الرسائل النصية (OTP).
 * واجهة واحدة تسمح بتبديل المزوّد دون تغيير منطق الأعمال:
 *  - console: للتطوير، يطبع الرمز في السجل.
 *  - (لاحقاً) twilio / مزوّد محلي عراقي: تنفيذ نفس الواجهة.
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

let cached: SmsProvider | null = null;

/** يعيد المزوّد المُعدّ في البيئة (مع تخزين مؤقت). */
export function getSmsProvider(): SmsProvider {
  if (cached) return cached;
  switch (authEnv.smsProvider) {
    case "console":
      cached = new ConsoleSmsProvider();
      break;
    // case "twilio": cached = new TwilioSmsProvider(); break;
    default:
      // fail-safe: لا نُسقط النظام، نسجّل فقط في التطوير
      cached = new ConsoleSmsProvider();
  }
  return cached;
}

/** نص رسالة OTP بالعربية. */
export function otpMessage(code: string): string {
  return `رمز الدخول إلى السوگ: ${code}\nلا تشاركه مع أحد. صالح لدقائق معدودة.`;
}
