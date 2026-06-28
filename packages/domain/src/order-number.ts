/**
 * توليد رقم طلب مقروء: SQ-YYMM-XXXX
 * (SQ = السوگ). الجزء المتسلسل يُمرَّر من طبقة البيانات لضمان التفرّد.
 */
export function buildOrderNumber(sequence: number, now: Date = new Date()): string {
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const seq = String(sequence).padStart(4, "0");
  return `SQ-${yy}${mm}-${seq}`;
}
