import { describe, it, expect } from "vitest";
import { login, anonApi, uniquePhone } from "./helpers";

describe("المصادقة (OTP)", () => {
  it("تنشئ مستخدماً وتصدر توكناً وتحمي me", async () => {
    const phone = uniquePhone();
    const api = await login(phone);
    const me = await api.auth.me();
    expect(me.phone).toBe(phone);
    expect(me.role).toBe("CUSTOMER");

    const anon = await anonApi();
    await expect(anon.auth.me()).rejects.toThrow();
  });
});

describe("تطبيق المشتري", () => {
  it("يطلب COD ويُلغيه، مع تقييم موثّق وحماية IDOR", async () => {
    const anon = await anonApi();
    const api = await login(uniquePhone());

    const govs = await anon.geo.governorates();
    const gov = govs[0]!;
    const addr = await api.address.create({
      fullName: "اختبار",
      phone: uniquePhone(),
      governorateId: gov.id,
      areaId: gov.areas[0]!.id,
      line: "عنوان",
      isDefault: true,
    });

    const list = await anon.catalog.products({ sort: "newest", limit: 1 });
    const detail = await anon.catalog.productBySlug({ slug: list.items[0]!.slug });
    const variant = detail!.variants.find((v) => v.available > 0)!;

    const placed = await api.order.place({
      addressId: addr.id,
      items: [{ productId: detail!.id, variantId: variant.id, quantity: 1 }],
    });
    const orderId = placed.orders[0]!.id;
    expect((await api.order.byId({ id: orderId })).status).toBe("PENDING");

    // التقييم مرفوض قبل الاستلام
    await expect(api.review.upsert({ productId: detail!.id, rating: 5 })).rejects.toThrow();

    // IDOR: عميل آخر لا يرى الطلب
    const other = await login(uniquePhone());
    await expect(other.order.byId({ id: orderId })).rejects.toThrow();

    await api.order.cancel({ orderId });
    expect((await api.order.byId({ id: orderId })).status).toBe("CANCELLED");
  });
});

describe("لوحة البائع والأدمن", () => {
  it("اعتماد بائع → مراجعة منتج → ظهوره نشطاً", async () => {
    const admin = await login("+9647700000000");
    expect((await admin.auth.me()).role).toBe("ADMIN");

    // بائع جديد قيد المراجعة
    const vendorPhone = uniquePhone();
    const vendor = await login(vendorPhone);
    const govs = await admin.geo.governorates();
    await vendor.vendor.register({ storeName: "متجر اختبار التكامل", governorateId: govs[0]!.id });

    // الأدمن يعتمده
    const pending = await admin.admin.vendors({ status: "PENDING" });
    const mine = pending.find((v) => v.phone === vendorPhone)!;
    expect(mine).toBeDefined();
    await admin.admin.reviewVendor({ vendorId: mine.id, decision: "APPROVED" });

    // البائع (بعد إعادة الدخول لالتقاط الدور) ينشئ منتجاً ويرسله للمراجعة
    const vendor2 = await login(vendorPhone);
    const cats = await admin.catalog.categories();
    const leaf = cats.flatMap((c) => c.children)[0]!;
    const created = await vendor2.vendor.productCreate({
      title: "منتج تكامل",
      categoryId: leaf.id,
      basePrice: 12000,
      images: [],
      variants: [{ attributes: {}, price: 12000, stock: 3 }],
    });
    await vendor2.vendor.productSubmit({ id: created.id });

    // الأدمن ينشر المنتج
    await admin.admin.reviewProduct({ productId: created.id, decision: "ACTIVE" });
    expect((await vendor2.vendor.productById({ id: created.id })).status).toBe("ACTIVE");

    // RBAC: البائع لا يصل للوحة الأدمن
    await expect(vendor2.admin.dashboard()).rejects.toThrow();
  });
});
