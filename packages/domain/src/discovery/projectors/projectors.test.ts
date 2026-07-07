import { describe, it, expect } from "vitest";
import type { ProjectionContext } from "../registry";
import { offerProjector, type OfferFacts } from "./offer";
import { entityProjector, type EntityFacts } from "./entity";

const now = new Date("2026-07-01T00:00:00Z");
const ctx: ProjectionContext = { now, popMax: Math.log1p(10) };

describe("offerProjector", () => {
  const base: OfferFacts = {
    id: "o1",
    governorateId: "bg",
    createdAt: new Date("2026-06-29T00:00:00Z"), // منذ يومين
    vendorId: "v1",
    categoryId: "c1",
    soldCount: 5,
    sales7: 3,
    ratingAvg: 4.6,
    ratingCount: 8,
    available: 4,
    storeApproved: true,
    storeTrust: 0.9,
    card: { id: "o1", title: "قميص", slug: "shirt", price: 15000, image: null, ratingAvg: 4.6, ratingCount: 8, vendor: { storeName: "متجر", slug: "store" } },
  };

  it("يُطبّع الإشارات ويحمل القدرات ومفاتيح التجميع", () => {
    const it = offerProjector.project(base, ctx);
    expect(it.type).toBe("offer");
    expect(it.signals.popularity).toBeCloseTo(Math.log1p(3) / Math.log1p(10), 6);
    expect(it.signals.trust).toBe(0.9);
    expect(it.groupKeys).toEqual({ store: "v1", category: "c1" });
    expect([...it.capabilities].sort()).toEqual(["order", "share"]);
    expect(it.reasons).toContain("NEW");
    expect(it.reasons).toContain("TRENDING");
    expect(it.reasons).toContain("IN_STOCK");
    expect(it.exclusion).toBeNull();
    expect(it.card).toBe(base.card); // معتمة، تمرّ كما هي
  });

  it("نفاد المخزون يُنتج استبعاداً", () => {
    expect(offerProjector.project({ ...base, available: 0 }, ctx).exclusion).toBe("OUT_OF_STOCK");
  });
  it("متجر غير معتمد يُنتج استبعاداً", () => {
    expect(offerProjector.project({ ...base, storeApproved: false }, ctx).exclusion).toBe("NOT_APPROVED");
  });
});

describe("entityProjector", () => {
  const base: EntityFacts = {
    id: "e1",
    governorateId: "bg",
    createdAt: new Date("2026-06-25T00:00:00Z"),
    productCount: 8,
    activity7: 4,
    ratingAvg: 4.8,
    ratingCount: 20,
    approved: true,
    trust: 0.85,
    card: { id: "e1", storeName: "متجر النور", slug: "noor", logoUrl: null, ratingAvg: 4.8, ratingCount: 20, productCount: 8, newThisWeek: 3 },
  };

  it("الكيان يرجّح الثقة ويحمل قدرات المتجر", () => {
    const it = entityProjector.project(base, ctx);
    expect(it.type).toBe("commerce_entity");
    expect(it.signals.trust).toBe(0.85);
    expect(it.groupKeys).toEqual({ store: "e1" });
    expect(it.capabilities.has("follow")).toBe(true);
    expect(it.capabilities.has("order")).toBe(false); // sellsOnline غير مضبوط
    expect(it.reasons).toContain("NEW_STORE"); // منذ ٦ أيام و8 منتجات
    expect(it.reasons).toContain("TRUSTED"); // trust ≥ 0.8
    expect(it.exclusion).toBeNull();
  });

  it("sellsOnline يضيف قدرة order؛ verified يضيف سبب VERIFIED", () => {
    const it = entityProjector.project({ ...base, sellsOnline: true, verified: true }, ctx);
    expect(it.capabilities.has("order")).toBe(true);
    expect(it.reasons).toContain("VERIFIED");
  });
});
