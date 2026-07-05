import { describe, it, expect } from "vitest";
import { login } from "./helpers";
import { prisma } from "@al-souq/db";

const ADMIN = "+9647700000000";

describe("تحسينات لوحة الأدمن", () => {
  it("حذف فئة رئيسية مع أقسامها الفرعية + نقل المنتجات إلى وجهة", async () => {
    const admin = await login(ADMIN);
    // فئة رئيسية + فرعية تحتها + وجهة مستقلّة
    const parent = await admin.admin.createCategory({ nameAr: "قسم-اختبار-حذف " + Date.now() });
    const child = await admin.admin.createCategory({ nameAr: "فرعي-اختبار " + Date.now(), parentId: parent.id });
    const dest = await admin.admin.createCategory({ nameAr: "وجهة-اختبار " + Date.now() });

    // ننشئ منتجاً في الفئة الفرعية مباشرةً في القاعدة (لاختبار النقل)
    const vendor = await prisma.vendorProfile.findFirstOrThrow({ where: { status: "APPROVED" } });
    const product = await prisma.product.create({
      data: {
        vendorId: vendor.id,
        categoryId: child.id,
        title: "منتج اختبار حذف الفئة",
        titleNorm: "منتج اختبار حذف الفئة",
        slug: "test-catdel-" + Date.now(),
        basePrice: 10000,
        status: "DRAFT",
      },
    });

    // حذف بلا وجهة يُرفض (توجد منتجات)
    await expect(admin.admin.removeCategory({ id: parent.id })).rejects.toThrow();

    // حذف مع وجهة: يُنقل المنتج وتُحذف الفئتان
    const res = await admin.admin.removeCategory({ id: parent.id, reassignToId: dest.id });
    expect(res.deletedCount).toBe(2); // الأصل + الفرعية
    expect(res.movedProducts).toBe(1);

    const moved = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(moved.categoryId).toBe(dest.id);
    expect(await prisma.category.findUnique({ where: { id: parent.id } })).toBeNull();
    expect(await prisma.category.findUnique({ where: { id: child.id } })).toBeNull();

    // تنظيف
    await prisma.product.delete({ where: { id: product.id } });
    await admin.admin.removeCategory({ id: dest.id });
  });

  it("طلبات المتجر (حالية/سابقة) وتقرير مالي بفترة", async () => {
    const admin = await login(ADMIN);
    const vendor = await prisma.vendorProfile.findFirstOrThrow({ where: { status: "APPROVED" } });

    const current = await admin.admin.vendorOrders({ vendorId: vendor.id, scope: "current" });
    const past = await admin.admin.vendorOrders({ vendorId: vendor.id, scope: "past" });
    // الحالية حالات قيد التنفيذ فقط؛ السابقة حالات منتهية فقط
    const CUR = ["PENDING", "CONFIRMED", "PREPARING", "SHIPPED"];
    const PAST = ["DELIVERED", "COMPLETED", "CANCELLED", "RETURNED"];
    expect(current.every((o) => CUR.includes(o.status))).toBe(true);
    expect(past.every((o) => PAST.includes(o.status))).toBe(true);

    const fin = await admin.admin.vendorFinance({ vendorId: vendor.id, period: "all" });
    expect(fin.netToVendor).toBe(fin.grossSales - fin.commission);
    expect(fin.realizedOrders).toBeGreaterThanOrEqual(0);

    // RBAC: مشترٍ لا يصل
    const buyer = await login("+9647708888888");
    await expect(buyer.admin.vendorFinance({ vendorId: vendor.id, period: "all" })).rejects.toThrow();
  });
});
