/**
 * مُسقِط العرض (Offer/Product) — المرحلة A · PR1. نقيّ (بلا قاعدة/شبكة).
 * يُعيد إنتاج نقاط العرض الحالية (أوزان 0.40/0.25/0.25/0.10) للحفاظ على التوافق
 * السلوكي عند استبدال المحرّك في PR3.
 */
import { bayesianRating, ageDays, freshness } from "../score";
import { DISCOVERY_WEIGHTS as W } from "../weights";
import type { Capability, DiscoveryItem, DiscoveryReason, WeightProfile } from "../item";
import { registerProjector, type ProjectionContext, type Projector } from "../registry";

/** بطاقة العرض — معتمة على Discovery؛ ترسمها الواجهة. */
export interface OfferCard {
  id: string;
  title: string;
  slug: string;
  price: number;
  image: string | null;
  ratingAvg: number;
  ratingCount: number;
  vendor: { storeName: string; slug: string };
}

/** حقائق العرض التي يستهلكها المُسقِط (محمّلة مسبقاً — لا يعرف المُسقِط مصدرها). */
export interface OfferFacts {
  id: string;
  governorateId: string | null;
  createdAt: Date;
  vendorId: string;
  categoryId: string;
  soldCount: number;
  sales7: number; // مشترون متمايزون آخر ٧ أيام
  ratingAvg: number;
  ratingCount: number;
  available: number; // stock - reserved
  storeApproved: boolean;
  storeTrust: number; // [0..1] — من Trust (مصدره معتم على المُسقِط)
  card: OfferCard;
}

const OFFER_WEIGHTS: WeightProfile = { popularity: 0.4, quality: 0.25, freshness: 0.25, trust: 0.1 };

export const offerProjector: Projector<OfferFacts, OfferCard> = {
  type: "offer",
  weightProfile: OFFER_WEIGHTS,
  project(f, ctx: ProjectionContext): DiscoveryItem<OfferCard> {
    const pop = Math.log1p(Math.max(0, f.sales7));
    // popMax تقدير للسقف؛ عنصرٌ مفرد قد يتجاوزه، لذا نقصّ للحفاظ على الثابت #5 ([0..1]).
    const popularity = ctx.popMax > 0 ? clamp01(pop / ctx.popMax) : 0;
    const quality = bayesianRating(f.ratingAvg, f.ratingCount) / 5;
    const fresh = freshness(ageDays(f.createdAt, ctx.now));
    const trust = clamp01(f.storeTrust);

    const reasons: DiscoveryReason[] = [];
    if (ageDays(f.createdAt, ctx.now) <= W.newWindowDays) reasons.push("NEW");
    if (f.sales7 >= W.trending.minBuyers) reasons.push("TRENDING");
    if (f.ratingCount >= W.topRated.minCount && bayesianRating(f.ratingAvg, f.ratingCount) >= W.topRated.minScore)
      reasons.push("TOP_RATED");
    if (f.soldCount > 0) reasons.push("BEST_SELLER");
    if (f.available > 0) reasons.push("IN_STOCK");

    const exclusion = !f.storeApproved ? "NOT_APPROVED" : f.available <= 0 ? "OUT_OF_STOCK" : null;
    const capabilities: ReadonlySet<Capability> = new Set<Capability>(["order", "share"]);

    return {
      type: "offer",
      id: f.id,
      governorateId: f.governorateId,
      createdAt: f.createdAt,
      signals: { popularity, quality, freshness: fresh, trust },
      groupKeys: { store: f.vendorId, category: f.categoryId },
      capabilities,
      reasons,
      exclusion,
      card: f.card,
    };
  },
};

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

registerProjector(offerProjector);
