import { describe, it, expect } from "vitest";
import { login, uniquePhone } from "./helpers";
import { prisma } from "@al-souq/db";

const SUPER = "+9647700000000";

describe("صلاحيات الموظفين الإداريين", () => {
  it("المدير العام يصل للكل؛ موظف محدود الصلاحيات مقيّد", async () => {
    const admin = await login(SUPER);
    // المدير العام يرى صلاحياته كاملة ويستطيع إدارة الموظفين
    const me = await admin.admin.me();
    expect(me.isSuper).toBe(true);
    expect(me.permissions).toContain("staff");

    // ينشئ موظف «مركز اتصال» (طلبات فقط)
    const staffPhone = uniquePhone();
    await admin.admin.staffCreate({
      phone: staffPhone,
      name: "موظف مركز اتصال",
      staffTitle: "مدير مركز الاتصال",
      permissions: ["dashboard", "orders"],
    });

    const staff = await login(staffPhone);
    const sme = await staff.admin.me();
    expect(sme.isSuper).toBe(false);
    expect(sme.permissions.sort()).toEqual(["dashboard", "orders"]);

    // يصل للطلبات (له صلاحية)
    await expect(staff.admin.orders({ limit: 5 })).resolves.toBeDefined();
    // لا يصل للمالية ولا لإدارة الموظفين (بلا صلاحية) → FORBIDDEN
    await expect(staff.admin.financeSummary({ period: "all" })).rejects.toThrow();
    await expect(staff.admin.staffList()).rejects.toThrow();
    await expect(staff.admin.updateSettings({ minOrderValue: 0 })).rejects.toThrow();

    // تنظيف
    const u = await prisma.user.findUniqueOrThrow({ where: { phone: staffPhone } });
    await admin.admin.staffRevoke({ userId: u.id });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.role).toBe("CUSTOMER");
  });

  it("نطاق المحافظة يقيّد قائمة المتاجر", async () => {
    const admin = await login(SUPER);
    // محافظة بلا متاجر (نختار واحدة غير مستخدمة في البذر)
    const govs = await admin.geo.governorates();
    const vendorGovIds = new Set(
      (await prisma.vendorProfile.findMany({ select: { governorateId: true } }))
        .map((v) => v.governorateId)
        .filter(Boolean),
    );
    const emptyGov = govs.find((g) => !vendorGovIds.has(g.id));
    if (!emptyGov) return; // كل المحافظات مأهولة — نتخطّى

    const allVendors = await admin.admin.vendors();
    expect(allVendors.length).toBeGreaterThan(0);

    const staffPhone = uniquePhone();
    await admin.admin.staffCreate({
      phone: staffPhone,
      name: "مدير محافظة",
      staffTitle: `مدير محافظة ${emptyGov.nameAr}`,
      permissions: ["dashboard", "orders", "vendors"],
      scopeGovernorateId: emptyGov.id,
    });
    const staff = await login(staffPhone);
    const scoped = await staff.admin.vendors();
    expect(scoped.length).toBe(0); // لا متاجر في نطاق محافظته

    // تنظيف
    const u = await prisma.user.findUniqueOrThrow({ where: { phone: staffPhone } });
    await admin.admin.staffRevoke({ userId: u.id });
  });
});
