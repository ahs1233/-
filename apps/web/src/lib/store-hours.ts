// حالة نشاط المتجر (مفتوح الآن / يغلق قريباً / مغلق) — بتوقيت العراق (UTC+3، بلا توقيت صيفيّ).
export interface OpenState {
  open: boolean;
  soon: boolean; // يغلق خلال ساعة
  label: string;
}

function toMin(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** يحسب حالة الفتح من ساعتَي الفتح/الإغلاق ("HH:MM") بتوقيت بغداد. */
export function storeOpenState(opensAt: string | null, closesAt: string | null, now: Date = new Date()): OpenState | null {
  if (!opensAt || !closesAt) return null;
  const openMin = toMin(opensAt);
  const closeMin0 = toMin(closesAt);
  if (openMin == null || closeMin0 == null) return null;

  // بغداد = UTC+3 ثابتاً.
  const iraq = new Date(now.getTime() + 3 * 3600 * 1000);
  const nowMin = iraq.getUTCHours() * 60 + iraq.getUTCMinutes();

  const overnight = closeMin0 <= openMin; // يمتدّ بعد منتصف الليل
  const open = overnight ? nowMin >= openMin || nowMin < closeMin0 : nowMin >= openMin && nowMin < closeMin0;

  let untilClose = closeMin0 - nowMin;
  if (untilClose < 0) untilClose += 1440;

  if (open) {
    if (untilClose <= 60) return { open: true, soon: true, label: `يغلق بعد ${untilClose} دقيقة` };
    return { open: true, soon: false, label: "مفتوح الآن" };
  }
  return { open: false, soon: false, label: `مغلق — يفتح ${opensAt}` };
}

/** «منذ ٣٠ دقيقة / منذ ساعتين / منذ ٣ أيّام» من تاريخٍ ISO. */
export function timeAgoAr(iso: string, now: Date = new Date()): string {
  const diffMin = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (diffMin < 1) return "الآن";
  if (diffMin < 60) return `قبل ${diffMin} دقيقة`;
  const hours = Math.round(diffMin / 60);
  if (hours < 24) return `قبل ${hours} ساعة`;
  const days = Math.round(hours / 24);
  return `قبل ${days} يوم`;
}
