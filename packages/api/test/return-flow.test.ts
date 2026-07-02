import { describe, it, expect } from "vitest";
import { prisma } from "@al-souq/db";
import { changeOrderStatus } from "../src/services/order";
import { login, anonApi, uniquePhone } from "./helpers";

/**
 * تدفّق الإرجاع (RMA) كاملاً:
 * طلب COD → توصيله → المشتري يطلب إرجاعاً → البائع يقبل → الطلب RETURNED
 * ويُعاد المخزون. مع حماية: لا إرجاع قبل التسليم، ولا طلبان لنفس الطلب.
 */
describe("تدفّق الإرجاع (RMA)", () => {
  it("يطلب المشتري إرجاعاً بعد التسليم ويقبله البائع فيعود المخزون", async () => {
    const anon = await anonApi();
    const customer = await login(uniquePhone());

    // عنوان + طلب
    const govs = await anon.geo.governorates();
    const gov = govs[0]!;
    const addr = await customer.address.create({
      fullName: "مشتري الإرجاع",
      phone: uniquePhone(),
      governorateId: gov.id,
      areaId: gov.areas[0]!.id,
      line: "عنوان اختبار الإرجاع",
      isDefault: true,
    });
    const list = await anon.catalog.products({ sort: "newest", limit: 5 });
    const detail = await anon.catalog.productBySlug({ slug: list.items[0]!.slug });
    const variant = detail!.variants.find((v) => v.available > 0)!;
    const stockBefore = await prisma.productVariant.findUniqueOrThrow({
      where: { id: variant.id },
      select: { stock: true, reservedStock: true },
    });

    const placed = await customer.order.place({
      addressId: addr.id,
      items: [{ productId: detail!.id, variantId: variant.id, quantity: 1 }],
    });
    const orderId = placed.orders[0]!.id;

    // لا إرجاع قبل التسليم
    await expect(customer.order.requestReturn({ orderId, reason: "سبب اختباري كافٍ" })).rejects.toThrow();

    // توصيل الطلب (بصفة البائع) حتى DELIVERED
    for (const to of ["CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED"] as const) {
      await changeOrderStatus(prisma, { orderId, to, actor: "VENDOR", actorId: "test" });
    }

    // المشتري يطلب الإرجاع
    const rr = await customer.order.requestReturn({ orderId, reason: "المنتج مخالف للوصف" });
    expect(rr.status).toBe("REQUESTED");
    // لا يمكن تكراره
    await expect(customer.order.requestReturn({ orderId, reason: "سبب آخر إضافي" })).rejects.toThrow();
    // يظهر للمشتري في تفاصيل الطلب
    const mine = await customer.order.byId({ id: orderId });
    expect(mine.returnRequest?.status).toBe("REQUESTED");

    // البائع يقبل
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { vendor: { select: { user: { select: { phone: true } } } } },
    });
    const vendor = await login(order.vendor.user.phone);
    const decided = await vendor.vendor.reviewReturn({ id: rr.id, approve: true, note: "مقبول" });
    expect(decided.status).toBe("APPROVED");

    // الطلب صار RETURNED والمخزون عاد كما كان
    const after = await customer.order.byId({ id: orderId });
    expect(after.status).toBe("RETURNED");
    const stockAfter = await prisma.productVariant.findUniqueOrThrow({
      where: { id: variant.id },
      select: { stock: true, reservedStock: true },
    });
    expect(stockAfter.stock).toBe(stockBefore.stock);
    expect(stockAfter.reservedStock).toBe(stockBefore.reservedStock);
  });
});
