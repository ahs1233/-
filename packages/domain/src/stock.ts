/**
 * منطق المخزون والحجز المؤقت للـ COD — دوال نقية.
 *
 * في الدفع عند الاستلام لا يُحجز مبلغ، لكن يجب حجز المخزون مؤقتاً عند إنشاء
 * الطلب لمنع البيع الزائد، مع انتهاء صلاحية إذا لم يُؤكَّد الطلب.
 *
 * المتاح فعلياً = stock - reservedStock.
 * التزامن (race conditions) يُعالَج في طبقة قاعدة البيانات عبر معاملة
 * + تحديث شرطي ذرّي (انظر api: reserveStock)، وهذه الدوال تحدّد القواعد فقط.
 */

export const DEFAULT_RESERVATION_TTL_MS = 30 * 60 * 1000; // 30 دقيقة

export interface VariantStock {
  stock: number;
  reservedStock: number;
}

/** الكمية المتاحة للبيع الآن. */
export function availableStock(v: VariantStock): number {
  return Math.max(0, v.stock - v.reservedStock);
}

/** هل يمكن حجز كمية معيّنة؟ */
export function canReserve(v: VariantStock, quantity: number): boolean {
  if (quantity <= 0) return false;
  return availableStock(v) >= quantity;
}

export interface ReservationCheck {
  ok: boolean;
  reason?: string;
  available: number;
}

export function checkReservation(v: VariantStock, quantity: number): ReservationCheck {
  const available = availableStock(v);
  if (quantity <= 0) return { ok: false, reason: "كمية غير صالحة", available };
  if (available < quantity) {
    return { ok: false, reason: "الكمية المطلوبة غير متوفرة", available };
  }
  return { ok: true, available };
}

/** وقت انتهاء صلاحية الحجز انطلاقاً من الآن. */
export function reservationExpiry(now: Date = new Date(), ttlMs = DEFAULT_RESERVATION_TTL_MS): Date {
  return new Date(now.getTime() + ttlMs);
}

/** هل انتهت صلاحية الحجز؟ */
export function isReservationExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}
