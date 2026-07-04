import { describe, it, expect } from "vitest";
import { login, uniquePhone } from "./helpers";

/**
 * كشف الحساب المالي للبائع: يعمل، مقيّد بالبائع، ويُصدِّر CSV صالحاً.
 */
describe("كشف حساب البائع", () => {
  it("financeSummary يعيد بنية صحيحة و exportStatementCsv يُنتج CSV برأس BOM", async () => {
    const admin = await login("+9647700000000");
    const vendorPhone = uniquePhone();
    const vendor = await login(vendorPhone);
    const govs = await admin.geo.governorates();
    await vendor.vendor.register({ storeName: "متجر كشف الحساب", governorateId: govs[0]!.id });
    const pending = await admin.admin.vendors({ status: "PENDING" });
    const mine = pending.find((v) => v.phone === vendorPhone)!;
    await admin.admin.reviewVendor({ vendorId: mine.id, decision: "APPROVED" });
    const v2 = await login(vendorPhone);

    const sum = await v2.vendor.financeSummary({ period: "30d" });
    // بائع جديد بلا مبيعات: كل القيم صفر ومتّسقة
    expect(sum.netEarnings).toBe(sum.grossSales - sum.commission);
    expect(sum.realizedOrders).toBe(0);
    expect(sum.outstandingBalance).toBe(0);

    const csv = await v2.vendor.exportStatementCsv({ period: "all" });
    expect(csv.csv.startsWith("\uFEFF")).toBe(true); // رأس BOM للعربية
    expect(csv.csv).toContain("رقم الطلب"); // صفّ العناوين
    expect(csv.filename).toMatch(/^statement-all-/);

    // RBAC: مشترٍ عادي لا يصل لكشف حساب البائع
    const buyer = await login(uniquePhone());
    await expect(buyer.vendor.financeSummary({ period: "30d" })).rejects.toThrow();
  });
});
