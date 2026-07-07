import { describe, it, expect } from "vitest";
import type { CandidateBatch, CandidateSource, DiscoveryQuery } from "./source";
import { getProjector, type ProjectionContext } from "./registry";
import type { DiscoveryItem } from "./item";
import { ratingTrustProvider, type TrustRatingFacts, type TrustProvider } from "../trust/provider";
import type { OfferFacts } from "./projectors/offer";
import type { EntityFacts } from "./projectors/entity";
import "./projectors"; // تسجيل مُسقِطات المرحلة A

/**
 * مصدر مرشّحين وهميّ في الذاكرة — يُثبت أن المنفذ محايد للمصدر: لا Prisma، لا SQL.
 * يُثري ثقة العروض من TrustProvider عند التجميع (تركيب المنفذين، لا منطق ثقة داخل المصدر).
 */
function fakeSource(trust: TrustProvider): CandidateSource {
  const offers: Omit<OfferFacts, "storeTrust">[] = [
    {
      id: "o1", governorateId: "bg", createdAt: new Date("2026-06-30T00:00:00Z"),
      vendorId: "v1", categoryId: "c1", soldCount: 4, sales7: 2, ratingAvg: 4.5, ratingCount: 12,
      available: 3, storeApproved: true,
      card: { id: "o1", title: "حذاء", slug: "shoe", price: 20000, image: null, ratingAvg: 4.5, ratingCount: 12, vendor: { storeName: "متجر", slug: "store" } },
    },
  ];
  const entities: EntityFacts[] = [
    {
      id: "v1", governorateId: "bg", createdAt: new Date("2026-06-20T00:00:00Z"),
      productCount: 7, activity7: 3, ratingAvg: 4.7, ratingCount: 25, approved: true, trust: 0.9,
      card: { id: "v1", storeName: "متجر", slug: "store", logoUrl: null, ratingAvg: 4.7, ratingCount: 25, productCount: 7, newThisWeek: 2 },
    },
  ];
  return {
    async fetch(_query: DiscoveryQuery): Promise<CandidateBatch[]> {
      const scores = await trust.trustFor(offers.map((o) => o.vendorId));
      const enriched: OfferFacts[] = offers.map((o) => ({ ...o, storeTrust: scores.get(o.vendorId) ?? 0 }));
      return [
        { type: "offer", facts: enriched },
        { type: "commerce_entity", facts: entities },
      ];
    },
  };
}

const CTX: ProjectionContext = { now: new Date("2026-07-01T00:00:00Z"), popMax: Math.log1p(5) };

describe("CandidateSource — منفذ محايد للمصدر يغذّي السجلّ بلا switch(type)", () => {
  it("كل دفعة تُسقَط عبر مُسقِط نوعها فتُنتج عناصر صالحة", async () => {
    const trust = ratingTrustProvider(
      new Map<string, TrustRatingFacts>([["v1", { ratingAvg: 4.7, ratingCount: 25 }]]),
    );
    const source = fakeSource(trust);
    const batches = await source.fetch({ governorateId: "bg" });

    // إسقاط عام: بحث في السجلّ بالنوع، بلا أيّ تفرّع حسب النوع.
    const items: DiscoveryItem[] = [];
    for (const batch of batches) {
      const projector = getProjector(batch.type);
      expect(projector, `مُسقِط مفقود للنوع ${batch.type}`).toBeDefined();
      for (const fact of batch.facts) items.push(projector!.project(fact, CTX));
    }

    expect(items.map((i) => i.type).sort()).toEqual(["commerce_entity", "offer"]);
    for (const item of items) {
      expect(item.capabilities.size).toBeGreaterThan(0);
      for (const k of ["popularity", "quality", "freshness", "trust"] as const) {
        expect(item.signals[k]).toBeGreaterThanOrEqual(0);
        expect(item.signals[k]).toBeLessThanOrEqual(1);
      }
    }
  });

  it("ثقة العرض تأتي من TrustProvider (تركيب المنفذين عند التجميع)", async () => {
    const trust = ratingTrustProvider(
      new Map<string, TrustRatingFacts>([["v1", { ratingAvg: 4.7, ratingCount: 25 }]]),
    );
    const batches = await fakeSource(trust).fetch({});
    const offerBatch = batches.find((b) => b.type === "offer")!;
    const offer = getProjector(offerBatch.type)!.project(offerBatch.facts[0], CTX);
    const expected = await trust.trustFor(["v1"]);
    expect(offer.signals.trust).toBeCloseTo(expected.get("v1")!, 6);
  });
});
