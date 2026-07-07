/**
 * مُسقِط الكيان التجاري (CommerceEntity) — المرحلة A · PR1. نقيّ.
 * الكيان يرجّح الثقة (0.40) — لأن العراقي يشتري الثقة قبل المنتج.
 * القدرات مبدئية (المرحلة A لا تملك بعد حقول التوثيق/النوع/النشاط — المرحلة C).
 */
import { bayesianRating, ageDays, freshness } from "../score";
import { DISCOVERY_WEIGHTS as W } from "../weights";
import type { Capability, DiscoveryItem, DiscoveryReason, WeightProfile } from "../item";
import { registerProjector, type ProjectionContext, type Projector } from "../registry";

/** بطاقة الهوية التجارية — معتمة على Discovery؛ ترسمها الواجهة. */
export interface EntityCard {
  id: string;
  storeName: string;
  slug: string;
  logoUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  productCount: number;
  newThisWeek: number;
}

/** حقائق الكيان التي يستهلكها المُسقِط. `trust` مطبّعة [0..1] (مصدرها معتم). */
export interface EntityFacts {
  id: string;
  governorateId: string | null;
  createdAt: Date;
  productCount: number;
  activity7: number; // نشاط آخر ٧ أيام (طلبات/تفاعل) — لتطبيع الشعبية
  ratingAvg: number;
  ratingCount: number;
  approved: boolean;
  trust: number; // [0..1]
  verified?: boolean; // محجوز للمرحلة C
  sellsOnline?: boolean; // هل يقبل الطلب أونلاين؟ (يحدّد قدرة order)
  card: EntityCard;
}

const ENTITY_WEIGHTS: WeightProfile = { trust: 0.4, quality: 0.25, popularity: 0.2, freshness: 0.15 };

export const entityProjector: Projector<EntityFacts, EntityCard> = {
  type: "commerce_entity",
  weightProfile: ENTITY_WEIGHTS,
  project(f, ctx: ProjectionContext): DiscoveryItem<EntityCard> {
    const pop = Math.log1p(Math.max(0, f.activity7));
    // popMax تقدير للسقف؛ عنصرٌ مفرد قد يتجاوزه، لذا نقصّ للحفاظ على الثابت #5 ([0..1]).
    const popularity = ctx.popMax > 0 ? clamp01(pop / ctx.popMax) : 0;
    const quality = bayesianRating(f.ratingAvg, f.ratingCount) / 5;
    const fresh = freshness(ageDays(f.createdAt, ctx.now));
    const trust = clamp01(f.trust);

    const reasons: DiscoveryReason[] = [];
    if (ageDays(f.createdAt, ctx.now) <= W.newStore.windowDays && f.productCount >= W.newStore.minProducts)
      reasons.push("NEW_STORE");
    if (f.ratingCount >= W.topRated.minCount && bayesianRating(f.ratingAvg, f.ratingCount) >= W.topRated.minScore)
      reasons.push("TOP_RATED");
    if (trust >= 0.8) reasons.push("TRUSTED");
    if (f.verified) reasons.push("VERIFIED");

    const capabilities = new Set<Capability>(["follow", "share", "navigate"]);
    if (f.sellsOnline) capabilities.add("order");

    return {
      type: "commerce_entity",
      id: f.id,
      governorateId: f.governorateId,
      createdAt: f.createdAt,
      signals: { popularity, quality, freshness: fresh, trust },
      groupKeys: { store: f.id },
      capabilities,
      reasons,
      exclusion: f.approved ? null : "NOT_APPROVED",
      card: f.card,
    };
  },
};

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

registerProjector(entityProjector);
