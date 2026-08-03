/** بادئة أرقام الطلب لشهرٍ بعينه: SQ-YYMM- (SQ = السوگ). */
export function orderNumberPrefix(now: Date = new Date()): string {
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `SQ-${yy}${mm}-`;
}

/**
 * توليد رقم طلب مقروء: SQ-YYMM-XXXX
 * (SQ = السوگ). الجزء المتسلسل يُمرَّر من طبقة البيانات لضمان التفرّد.
 */
export function buildOrderNumber(sequence: number, now: Date = new Date()): string {
  const seq = String(sequence).padStart(4, "0");
  return `${orderNumberPrefix(now)}${seq}`;
}

/**
 * استخراج الجزء المتسلسل من رقم طلبٍ (SQ-YYMM-XXXX → XXXX). يعيد 0 إن تعذّر.
 * تُستخدم لاشتقاق التسلسل التالي من أعلى رقمٍ قائمٍ — أسلوبٌ مُقاومٌ للحذف
 * (بخلاف العدّ الكلّي الذي قد يُعيد توليد رقمٍ محذوفٍ فيتضارب مع الفريد).
 */
export function parseOrderSequence(orderNumber: string): number {
  const m = /-(\d+)$/.exec(orderNumber);
  return m ? Number.parseInt(m[1]!, 10) : 0;
}
