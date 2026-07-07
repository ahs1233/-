/**
 * اختبار التكافؤ (المرحلة A · PR3) — إثبات أن مسار Discovery V2 لقسم «اليوم»
 * (مُسقِط العرض + المُصنِّف المحايد + منفذ الثقة) يُنتج ترتيباً **مطابقاً** لمحرّك
 * V1 (rankMixed) على نفس المدخلات. هذا حارس التوافق السلوكي لقاعدة التنفيذ #2:
 * إن اختلف الترتيب، فذاك تغيير سلوك (المرحلة B) لا إعادة تنظيم (المرحلة A).
 */
import { describe, it, expect } from "vitest";
import { rankMixed, maxPopularity, exclusionFor, type RankableProduct } from "./score";
import { DISCOVERY_WEIGHTS as W } from "./weights";
import { rankItems, ZERO_PROFILE } from "./rank";
import { getProjector, weightProfileFor, type ProjectionContext } from "./registry";
import { trustFromRating, type TrustScores } from "../trust/provider";
import { offerProjector, type OfferFacts } from "./projectors/offer";
import "./projectors";

const SECTION_SIZE = 12;
const now = new Date("2026-07-05T00:00:00Z");

/** يبني مجموعة مرشّحين متنوّعة (متاجر/فئات/مبيعات/تقييمات/أعمار/مخزون مختلفة). */
function buildPool(n: number): RankableProduct[] {
  const pool: RankableProduct[] = [];
  for (let i = 0; i < n; i++) {
    pool.push({
      id: `p${i}`,
      categoryId: `c${i % 5}`,
      vendorId: `v${i % 7}`,
      createdAt: new Date(now.getTime() - (i % 30) * 86_400_000),
      soldCount: (i * 3) % 40,
      sales7: (i * 7) % 11,
      ratingAvg: 3 + ((i * 0.13) % 2),
      ratingCount: (i * 5) % 25,
      available: i % 9 === 0 ? 0 : (i % 12) + 1, // بعضها نافد المخزون (مُستبعَد)
      storeApproved: true,
      // تقييم المتجر لكل بائع (لا لكل منتج) — كما في الواقع: كل منتجات المتجر تشترك تقييمه.
      storeRatingAvg: 3.5 + (((i % 7) * 0.2) % 1.5),
      storeRatingCount: ((i % 7) * 5) % 30,
    });
  }
  return pool;
}

function toFacts(p: RankableProduct, trust: TrustScores): OfferFacts {
  return {
    id: p.id,
    governorateId: null,
    createdAt: p.createdAt,
    vendorId: p.vendorId,
    categoryId: p.categoryId,
    soldCount: p.soldCount,
    sales7: p.sales7,
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
    available: p.available,
    storeApproved: p.storeApproved,
    storeTrust: trust.get(p.vendorId) ?? 0,
    card: { id: p.id, title: p.id, slug: p.id, price: 0, image: null, ratingAvg: p.ratingAvg, ratingCount: p.ratingCount, vendor: { storeName: p.vendorId, slug: p.vendorId } },
  };
}

/** يعيد بناء مسار «اليوم» V2 كما يفعله api/services/discovery. */
function rankTodayV2(pool: RankableProduct[]): string[] {
  const trust: TrustScores = new Map(
    pool.map((p) => [p.vendorId, trustFromRating({ ratingAvg: p.storeRatingAvg, ratingCount: p.storeRatingCount })]),
  );
  const popMax = maxPopularity(pool.filter((p) => exclusionFor(p) === null));
  const ctx: ProjectionContext = { now, popMax };
  const items = pool.map((p) => offerProjector.project(toFacts(p, trust), ctx));
  const ranked = rankItems(items, (t) => weightProfileFor(t) ?? ZERO_PROFILE, SECTION_SIZE, W.diversity);
  return ranked.map((it) => it.id);
}

describe("تكافؤ «اليوم»: Discovery V2 == rankMixed (V1)", () => {
  it("نفس ترتيب المعرّفات بالضبط على مجموعة كبيرة متنوّعة", () => {
    const pool = buildPool(120);
    const legacy = rankMixed(pool, SECTION_SIZE, now).map((p) => p.id);
    expect(rankTodayV2(pool)).toEqual(legacy);
  });

  it("يبقى متطابقاً عند تغيّر التوزيع (بذرة أخرى)", () => {
    const pool = buildPool(53).map((p, i) => ({ ...p, sales7: (i * 3) % 5, ratingCount: (i * 9) % 40 }));
    const legacy = rankMixed(pool, SECTION_SIZE, now).map((p) => p.id);
    expect(rankTodayV2(pool)).toEqual(legacy);
  });

  it("مُسقِط العرض يستبعد النافد تماماً كـ exclusionFor (لا يظهر في أيّهما)", () => {
    const pool = buildPool(40);
    const out = new Set(rankTodayV2(pool));
    for (const p of pool) if (p.available <= 0) expect(out.has(p.id)).toBe(false);
  });
});
