import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, Prisma } from "@al-souq/db";
import { placeOrder, changeOrderStatus } from "../src/services/order";

/**
 * اختبار سياسات المنصّة الجديدة: عمولة الفئة (تجاوز)، والحدّ الأدنى للطلب.
 */
describe("سياسات المنصّة — عمولة الفئة والحدّ الأدنى", () => {
  let customerId: string;
  let addressId: string;
  let variantId: string;
  let productId: string;
  let categoryId: string;
  let unitPrice: number;
  let origCategoryRate: Prisma.Decimal | null;
  const createdOrders: string[] = [];

  beforeAll(async () => {
    const customer = await prisma.user.findFirstOrThrow({ where: { role: "CUSTOMER", addresses: { some: {} } } });
    customerId = customer.id;
    addressId = (await prisma.address.findFirstOrThrow({ where: { userId: customerId } })).id;
    const variant = await prisma.productVariant.findFirstOrThrow({
      where: { stock: { gte: 10 }, isActive: true, product: { status: "ACTIVE", vendor: { status: "APPROVED" } } },
      include: { product: { select: { categoryId: true, vendorId: true } } },
    });
    variantId = variant.id;
    productId = variant.productId;
    categoryId = variant.product.categoryId;
    unitPrice = Number(variant.price);
    // تأكيد عدم وجود تجاوز عمولة على البائع (لعزل أثر الفئة)
    await prisma.vendorProfile.update({ where: { id: variant.product.vendorId }, data: { commissionRate: null } });
    const cat = await prisma.category.findUniqueOrThrow({ where: { id: categoryId } });
    origCategoryRate = cat.commissionRate;
  });

  afterAll(async () => {
    for (const id of createdOrders) {
      await changeOrderStatus(prisma, { orderId: id, to: "CANCELLED", actor: "CUSTOMER", actorId: customerId }).catch(
        () => undefined,
      );
    }
    // استعادة عمولة الفئة والحدّ الأدنى
    await prisma.category.update({ where: { id: categoryId }, data: { commissionRate: origCategoryRate } });
    await prisma.platformSetting.deleteMany({ where: { key: "min_order_value" } });
  });

  it("عمولة الفئة تتجاوز عمولة المنصّة في حساب الطلب", async () => {
    await prisma.category.update({ where: { id: categoryId }, data: { commissionRate: new Prisma.Decimal(0.25) } });
    const qty = 2;
    const subtotal = unitPrice * qty;
    const placed = await placeOrder(prisma, {
      customerId,
      addressId,
      items: [{ productId, variantId, quantity: qty }],
    });
    createdOrders.push(...placed.orders.map((o) => o.id));
    const order = await prisma.order.findUniqueOrThrow({ where: { id: placed.orders[0]!.id } });
    // العمولة = ٢٥٪ من المجموع (تجاوز الفئة)
    expect(Number(order.commissionAmount)).toBe(Math.round(subtotal * 0.25));
    expect(Number(order.commissionRate)).toBeCloseTo(0.25, 4);
  });

  it("الحدّ الأدنى للطلب يمنع الطلبات الأقل منه", async () => {
    // نضبط حدّاً أدنى أعلى من قيمة عنصر واحد
    const high = unitPrice + 1_000_000;
    await prisma.platformSetting.upsert({
      where: { key: "min_order_value" },
      update: { value: high },
      create: { key: "min_order_value", value: high },
    });
    await expect(
      placeOrder(prisma, { customerId, addressId, items: [{ productId, variantId, quantity: 1 }] }),
    ).rejects.toThrow(/الحدّ الأدنى/);

    // رفع الحدّ يسمح بالطلب
    await prisma.platformSetting.update({ where: { key: "min_order_value" }, data: { value: 0 } });
    const placed = await placeOrder(prisma, { customerId, addressId, items: [{ productId, variantId, quantity: 1 }] });
    createdOrders.push(...placed.orders.map((o) => o.id));
    expect(placed.orders.length).toBe(1);
  });
});
