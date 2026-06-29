/**
 * حساب العمولة — منطق نقي.
 * العمولة تُحسب على مجموع المنتجات (subtotal) دون رسوم التوصيل،
 * لأن التوصيل ليس إيراد بيع للبائع. نعمل بأعداد صحيحة (IQD بلا كسور).
 */

export interface CommissionResult {
  rate: number; // النسبة المطبّقة (مثل 0.10)
  commissionAmount: number; // عمولة المنصة (IQD)
  vendorNet: number; // صافي مستحق البائع من قيمة المنتجات
}

/**
 * @param subtotal مجموع المنتجات بالدينار (عدد صحيح)
 * @param rate نسبة العمولة (0..1). تُؤخذ من البائع إن وُجد تجاوز، وإلا من المنصة.
 */
export function calculateCommission(subtotal: number, rate: number): CommissionResult {
  if (subtotal < 0) throw new Error("subtotal لا يمكن أن يكون سالباً");
  if (rate < 0 || rate > 1) throw new Error("نسبة العمولة يجب أن تكون بين 0 و 1");
  const commissionAmount = Math.round(subtotal * rate);
  return {
    rate,
    commissionAmount,
    vendorNet: subtotal - commissionAmount,
  };
}

/** يحسم نسبة العمولة الفعلية: تجاوز البائع إن وُجد، وإلا نسبة المنصة. */
export function resolveCommissionRate(
  platformRate: number,
  vendorOverride?: number | null,
): number {
  if (vendorOverride !== null && vendorOverride !== undefined) {
    return vendorOverride;
  }
  return platformRate;
}
