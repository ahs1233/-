/**
 * منطق الكوبونات — مشترك بين معاينة الخصم (coupon.validate) وتطبيقه (placeOrder).
 *
 * الخصم يُحسب على «المجموع الجزئي» فقط (لا يشمل التوصيل). في سلة متعدّدة البائعين
 * يُوزَّع الخصم لاحقاً بالتناسب على طلبات البائعين (في خدمة الطلب).
 */
import { TRPCError } from "@trpc/server";
import type { Prisma, PrismaClient } from "@al-souq/db";

type Tx = Prisma.TransactionClient;

export interface CouponRecord {
  id: string;
  code: string;
  type: string; // "PERCENT" | "FIXED"
  value: number;
  minSubtotal: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  usedCount: number;
  expiresAt: Date | null;
  isActive: boolean;
}

/**
 * يجلب الكوبون بالرمز ويتحقّق من صلاحيته (فعّال، غير منتهٍ، لم يبلغ حدّ الاستخدام).
 * يرمي TRPCError عند الفشل. الرمز يُطبَّع مسبقاً إلى حروف كبيرة عبر المخطّط.
 */
export async function resolveCoupon(db: Tx | PrismaClient, code: string): Promise<CouponRecord> {
  const c = await db.coupon.findUnique({ where: { code } });
  if (!c || !c.isActive) {
    throw new TRPCError({ code: "NOT_FOUND", message: "الكوبون غير موجود أو غير مفعّل" });
  }
  if (c.expiresAt && c.expiresAt.getTime() < Date.now()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "انتهت صلاحية الكوبون" });
  }
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "بلغ الكوبون حدّ الاستخدام" });
  }
  return {
    id: c.id,
    code: c.code,
    type: c.type,
    value: Number(c.value),
    minSubtotal: Number(c.minSubtotal),
    maxDiscount: c.maxDiscount === null ? null : Number(c.maxDiscount),
    usageLimit: c.usageLimit,
    usedCount: c.usedCount,
    expiresAt: c.expiresAt,
    isActive: c.isActive,
  };
}

/**
 * يحسب مبلغ الخصم لكوبون على مجموع جزئي معيّن (بالدينار، عدد صحيح).
 * يتحقّق من الحدّ الأدنى، ويطبّق سقف الخصم، ولا يتجاوز المجموع الجزئي.
 * يرمي TRPCError إن لم يبلغ المجموع الحدّ الأدنى.
 */
export function computeDiscount(coupon: CouponRecord, subtotal: number): number {
  if (subtotal < coupon.minSubtotal) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `الكوبون يتطلّب مجموعاً لا يقلّ عن ${coupon.minSubtotal.toLocaleString("en-US")} د.ع`,
    });
  }
  let discount = coupon.type === "PERCENT" ? (subtotal * coupon.value) / 100 : coupon.value;
  if (coupon.maxDiscount !== null) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.min(discount, subtotal); // لا يتجاوز الخصم قيمة السلة
  return Math.round(discount);
}
