import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@al-souq/db";
import { placeOrder, changeOrderStatus } from "../src/services/order";

describe("دورة حياة الطلب (COD) — حجز ذرّي وآثار المخزون", () => {
  let customerId: string;
  let addressId: string;
  let variantId: string;
  let productId: string;
  let before: { stock: number; reservedStock: number };

  beforeAll(async () => {
    const customer = await prisma.user.findFirstOrThrow({ where: { role: "CUSTOMER", addresses: { some: {} } } });
    customerId = customer.id;
    addressId = (await prisma.address.findFirstOrThrow({ where: { userId: customerId } })).id;
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { stock: { gte: 5 }, isActive: true } });
    variantId = variant.id;
    productId = variant.productId;
    before = { stock: variant.stock, reservedStock: variant.reservedStock };
  });

  it("الحجز يرفع reservedStock دون لمس stock (COD)", async () => {
    const placed = await placeOrder(prisma, {
      customerId,
      addressId,
      items: [{ productId, variantId, quantity: 2 }],
    });
    const v = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(v.reservedStock).toBe(before.reservedStock + 2);
    expect(v.stock).toBe(before.stock);

    // تنظيف: إلغاء الطلب يحرّر الحجز
    await changeOrderStatus(prisma, { orderId: placed.orders[0]!.id, to: "CANCELLED", actor: "CUSTOMER", actorId: customerId });
    const v2 = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(v2.reservedStock).toBe(before.reservedStock);
    expect(v2.stock).toBe(before.stock);
  });

  it("يرفض حجز كمية تتجاوز المتاح (منع البيع الزائد)", async () => {
    await expect(
      placeOrder(prisma, { customerId, addressId, items: [{ productId, variantId, quantity: 999999 }] }),
    ).rejects.toThrow();
  });

  it("التسليم يخصم من stock ويحرّر الحجز ويزيد soldCount", async () => {
    const p0 = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    const placed = await placeOrder(prisma, { customerId, addressId, items: [{ productId, variantId, quantity: 1 }] });
    const orderId = placed.orders[0]!.id;
    for (const to of ["CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED"] as const) {
      await changeOrderStatus(prisma, { orderId, to, actor: "VENDOR", actorId: "v" });
    }
    const v = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    const p1 = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    expect(v.stock).toBe(before.stock - 1);
    expect(v.reservedStock).toBe(before.reservedStock);
    expect(p1.soldCount).toBe(p0.soldCount + 1);
  });
});
