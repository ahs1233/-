import { describe, it, expect } from "vitest";
import {
  bayesianRating,
  freshness,
  scoreProduct,
  reasonsFor,
  exclusionFor,
  diversify,
  rankMixed,
  type RankableProduct,
} from "./score";

const base: RankableProduct = {
  id: "p",
  categoryId: "c1",
  vendorId: "v1",
  createdAt: new Date(),
  soldCount: 0,
  sales7: 0,
  ratingAvg: 0,
  ratingCount: 0,
  available: 10,
  storeApproved: true,
  storeRatingAvg: 0,
  storeRatingCount: 0,
};
const P = (o: Partial<RankableProduct>): RankableProduct => ({ ...base, ...o });

describe("bayesianRating", () => {
  it("مراجعة واحدة 5.0 لا تتفوّق على تقييم راسخ 4.6", () => {
    const oneFive = bayesianRating(5.0, 1); // منتج بمراجعة واحدة
    const manyHigh = bayesianRating(4.6, 200); // منتج بتقييم راسخ
    expect(manyHigh).toBeGreaterThan(oneFive);
  });
});

describe("freshness", () => {
  it("تتلاشى مع العمر", () => {
    expect(freshness(0)).toBeCloseTo(1, 5);
    expect(freshness(14)).toBeLessThan(0.5);
    expect(freshness(60)).toBeLessThan(freshness(14));
  });
});

describe("scoreProduct", () => {
  it("النافد نقاطه صفر", () => {
    const s = scoreProduct(P({ available: 0, sales7: 50, ratingAvg: 5, ratingCount: 100 }), 5);
    expect(s.S).toBe(0);
  });
  it("المتوفّر الشعبي الحديث يتفوّق على القديم الخامل", () => {
    const now = new Date();
    const hot = scoreProduct(P({ sales7: 20, ratingAvg: 4.8, ratingCount: 50 }), Math.log1p(20), now);
    const cold = scoreProduct(
      P({ sales7: 0, ratingAvg: 3, ratingCount: 2, createdAt: new Date(now.getTime() - 120 * 86400000) }),
      Math.log1p(20),
      now,
    );
    expect(hot.S).toBeGreaterThan(cold.S);
  });
});

describe("reasonsFor / exclusionFor (Explainable)", () => {
  it("يوضّح أسباب الظهور", () => {
    const r = reasonsFor(P({ sales7: 5, ratingAvg: 4.9, ratingCount: 10, soldCount: 30 }));
    expect(r).toContain("NEW");
    expect(r).toContain("TRENDING");
    expect(r).toContain("TOP_RATED");
    expect(r).toContain("IN_STOCK");
  });
  it("يوضّح سبب الإخفاء للتاجر", () => {
    expect(exclusionFor(P({ available: 0 }))).toBe("OUT_OF_STOCK");
    expect(exclusionFor(P({ storeApproved: false }))).toBe("NOT_APPROVED");
    expect(exclusionFor(P({}))).toBeNull();
  });
});

describe("diversify (Δ2)", () => {
  it("يحترم سقف المتجر وسقف الفئة", () => {
    const items = [
      ...Array.from({ length: 10 }, (_, i) => ({ id: `a${i}`, vendorId: "vA", categoryId: "cat" })),
    ];
    const out = diversify(items, 10, { perStore: 3, perCategory: 4 });
    // نفس المتجر ونفس الفئة → السقف الأدنى (3) يحكم
    expect(out.length).toBe(3);
  });
  it("يوزّع عبر الفئات فلا تُغرق فئة واحدة الصفحة", () => {
    const items = [
      ...Array.from({ length: 8 }, (_, i) => ({ id: `ab${i}`, vendorId: `v${i}`, categoryId: "abaya" })),
      ...Array.from({ length: 8 }, (_, i) => ({ id: `ph${i}`, vendorId: `w${i}`, categoryId: "phone" })),
    ];
    const out = diversify(items, 12, { perStore: 3, perCategory: 4 });
    const abayas = out.filter((x) => x.categoryId === "abaya").length;
    expect(abayas).toBeLessThanOrEqual(4); // لا 20 عباءة
    expect(out.some((x) => x.categoryId === "phone")).toBe(true);
  });
});

describe("rankMixed", () => {
  it("يستبعد النافد ويطبّق التنوّع", () => {
    const items = [
      P({ id: "out", available: 0, sales7: 99 }),
      P({ id: "ok1", vendorId: "v1", categoryId: "c1", sales7: 5 }),
      P({ id: "ok2", vendorId: "v1", categoryId: "c1", sales7: 4 }),
    ];
    const out = rankMixed(items, 10);
    expect(out.find((x) => x.id === "out")).toBeUndefined();
    expect(out.length).toBe(2);
  });
});
