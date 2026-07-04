import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, Prisma } from "@al-souq/db";
import { placeOrder, changeOrderStatus } from "../src/services/order";
import { resolveCoupon, computeDiscount } from "../src/services/coupon";

/**
 * اختبار تكامل الكوبونات: حساب الخصم، تطبيقه على الطلب، استهلاك الاستخدام،
 * والتوزيع النسبي على طلبات بائعين متعدّدين.
 */
describe("الكوبونات — الخصم والتوزيع والاستهلاك", () => {
  let customerId: string;
  let addressId: string;
  let variantId: string;
  let productId: string;
  let unitPrice: number;
  const createdCoupons: string[] = [];
  const createdOrders: string[] = [];

  beforeAll(async () => {
    const customer = await prisma.user.findFirstOrThrow({ where: { role: "CUSTOMER", addresses: { some: {} } } });
    customerId = customer.id;
    addressId = (await prisma.address.findFirstOrThrow({ where: { userId: customerId } })).id;
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { stock: { gte: 20 }, isActive: true } });
    variantId = variant.id;
    productId = variant.productId;
    unitPrice = Number(variant.price);
  });

  afterAll(async () => {
    // إلغاء الطلبات لتحرير المخزون، ثم حذف الكوبونات
    for (const id of createdOrders) {
      await changeOrderStatus(prisma, { orderId: id, to: "CANCELLED", actor: "CUSTOMER", actorId: customerId }).catch(
        () => undefined,
      );
    }
    if (createdCoupons.length) await prisma.coupon.deleteMany({ where: { id: { in: createdCoupons } } });
  });

  async function mkCoupon(data: Partial<Prisma.CouponCreateInput> & { code: string }) {
    const c = await prisma.coupon.create({
      data: { type: "PERCENT", value: new Prisma.Decimal(10), ...data },
    });
    createdCoupons.push(c.id);
    return c;
  }

  it("computeDiscount: نسبة مع سقف، وحدّ أدنى", async () => {
    const c = await mkCoupon({
      code: "T_PCT_" + Date.now(),
      type: "PERCENT",
      value: new Prisma.Decimal(20),
      minSubtotal: new Prisma.Decimal(10000),
      maxDiscount: new Prisma.Decimal(5000),
    });
    const rec = await resolveCoupon(prisma, c.code);
    expect(computeDiscount(rec, 10000)).toBe(2000); // 20٪
    expect(computeDiscount(rec, 100000)).toBe(5000); // مقيّد بالسقف
    expect(() => computeDiscount(rec, 9999)).toThrow(); // تحت الحدّ الأدنى
  });

  it("مبلغ ثابت لا يتجاوز قيمة السلة", async () => {
    const c = await mkCoupon({ code: "T_FIX_" + Date.now(), type: "FIXED", value: new Prisma.Decimal(3000) });
    const rec = await resolveCoupon(prisma, c.code);
    expect(computeDiscount(rec, 10000)).toBe(3000);
    expect(computeDiscount(rec, 2000)).toBe(2000); // لا يتجاوز السلة
  });

  it("placeOrder يطبّق الخصم ويستهلك الاستخدام", async () => {
    const c = await mkCoupon({
      code: "T_ORD_" + Date.now(),
      type: "FIXED",
      value: new Prisma.Decimal(1000),
      usageLimit: 1,
    });
    const qty = 3;
    const expectedSubtotal = unitPrice * qty;
    const placed = await placeOrder(prisma, {
      customerId,
      addressId,
      items: [{ productId, variantId, quantity: qty }],
      couponCode: c.code,
    });
    createdOrders.push(...placed.orders.map((o) => o.id));

    const order = await prisma.order.findUniqueOrThrow({ where: { id: placed.orders[0]!.id } });
    expect(Number(order.subtotal)).toBe(expectedSubtotal);
    expect(Number(order.discount)).toBe(1000);
    expect(order.couponCode).toBe(c.code);
    expect(Number(order.total)).toBe(expectedSubtotal - 1000 + Number(order.deliveryFee));

    // استُهلك الاستخدام
    const after = await prisma.coupon.findUniqueOrThrow({ where: { id: c.id } });
    expect(after.usedCount).toBe(1);

    // ثاني استخدام يُرفض (بلغ الحدّ)
    await expect(
      placeOrder(prisma, {
        customerId,
        addressId,
        items: [{ productId, variantId, quantity: 1 }],
        couponCode: c.code,
      }),
    ).rejects.toThrow();
  });

  it("كوبون منتهٍ يُرفض", async () => {
    const c = await mkCoupon({ code: "T_EXP_" + Date.now(), expiresAt: new Date(Date.now() - 1000) });
    await expect(resolveCoupon(prisma, c.code)).rejects.toThrow();
  });

  it("سلة بائعين: يُوزَّع الخصم بالتناسب ومجموعه = الخصم الكلّي", async () => {
    // متغيّران من بائعين مختلفين، كلاهما متاح وبمخزون كافٍ.
    const variants = await prisma.productVariant.findMany({
      where: { stock: { gte: 5 }, isActive: true, product: { status: "ACTIVE", vendor: { status: "APPROVED" } } },
      include: { product: { select: { vendorId: true } } },
    });
    const byVendor = new Map<string, (typeof variants)[number]>();
    for (const v of variants) if (!byVendor.has(v.product.vendorId)) byVendor.set(v.product.vendorId, v);
    const two = [...byVendor.values()].slice(0, 2);
    if (two.length < 2) return; // البيانات لا تكفي — نتخطّى بأمان

    const items = two.map((v) => ({ productId: v.productId, variantId: v.id, quantity: 2 }));
    const cartSubtotal = two.reduce((s, v) => s + Number(v.price) * 2, 0);

    const c = await mkCoupon({ code: "T_MULTI_" + Date.now(), type: "PERCENT", value: new Prisma.Decimal(15) });
    const expectedDiscount = Math.round((cartSubtotal * 15) / 100);

    const placed = await placeOrder(prisma, { customerId, addressId, items, couponCode: c.code });
    createdOrders.push(...placed.orders.map((o) => o.id));
    expect(placed.orders.length).toBe(2);

    const orders = await prisma.order.findMany({ where: { id: { in: placed.orders.map((o) => o.id) } } });
    const sumDiscount = orders.reduce((s, o) => s + Number(o.discount), 0);
    expect(sumDiscount).toBe(expectedDiscount); // المجموع = الخصم الكلّي (لا فقد بالتقريب)
    // كل طلب: الإجمالي = المجموع − الخصم + التوصيل، وخصمه ≤ مجموعه
    for (const o of orders) {
      expect(Number(o.discount)).toBeLessThanOrEqual(Number(o.subtotal));
      expect(Number(o.total)).toBe(Number(o.subtotal) - Number(o.discount) + Number(o.deliveryFee));
    }
  });
});
