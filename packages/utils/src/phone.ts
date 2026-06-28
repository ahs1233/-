/**
 * التعامل مع أرقام الهاتف العراقية وتطبيعها إلى صيغة E.164 (+964...).
 * شبكات الموبايل العراقية تبدأ بـ 07 محلياً (مثل 0770/0750/0780/0790/0771...).
 */

const IRAQ_CC = "964";

/**
 * يطبّع رقماً عراقياً إلى E.164.
 * يقبل: 07XXXXXXXXX | 7XXXXXXXXX | +9647XXXXXXXXX | 009647XXXXXXXXX
 * يُعيد null إذا كان غير صالح.
 */
export function normalizeIraqiPhone(input: string): string | null {
  if (!input) return null;
  // تحويل الأرقام العربية ثم إزالة كل ما عدا الأرقام والـ +
  let s = input
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[^\d+]/g, "");

  s = s.replace(/^\+/, "").replace(/^00/, "");

  if (s.startsWith(IRAQ_CC)) {
    s = s.slice(IRAQ_CC.length);
  } else if (s.startsWith("0")) {
    s = s.slice(1);
  }

  // بعد التقشير يجب أن يكون: 7 ثم 9 أرقام = 10 أرقام تبدأ بـ 7
  if (!/^7\d{9}$/.test(s)) return null;

  return `+${IRAQ_CC}${s}`;
}

/** يتحقق من صلاحية رقم عراقي. */
export function isValidIraqiPhone(input: string): boolean {
  return normalizeIraqiPhone(input) !== null;
}

/** يعرض الرقم بصيغة محلية مقروءة: 0770 123 4567 */
export function formatIraqiPhoneLocal(e164: string): string {
  const norm = normalizeIraqiPhone(e164);
  if (!norm) return e164;
  const local = "0" + norm.slice(`+${IRAQ_CC}`.length); // 07XXXXXXXXX
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}
