/**
 * منطق ترتيب الاكتشاف — دوال نقية (بلا AI، بلا قاعدة بيانات) قابلة للاختبار.
 * تُجسّد Discovery Model V1: النقاط، التقييم البايزي، الحداثة، الأسباب،
 * الإخفاء المُفسَّر (Explainable)، وتنوّع الفئات/المتاجر.
 */
import { DISCOVERY_WEIGHTS as W } from "./weights";

export type SectionType =
  | "today" // اليوم في محافظتك — مختلط ومتنوّع
  | "new" // جديد هذا الأسبوع
  | "trending" // الترند
  | "top_rated" // الأعلى تقييماً
  | "best_selling"; // الأكثر مبيعاً

export interface RankableProduct {
  id: string;
  categoryId: string;
  vendorId: string;
  createdAt: Date;
  soldCount: number; // إجمالي (الأكثر مبيعاً)
  sales7: number; // مشترون متمايزون آخر 7 أيام (الترند/الشعبية)
  ratingAvg: number;
  ratingCount: number;
  available: number; // stock - reserved
  storeApproved: boolean;
  storeRatingAvg: number;
  storeRatingCount: number;
}

export type ReasonCode =
  | "NEW"
  | "TRENDING"
  | "TOP_RATED"
  | "BEST_SELLER"
  | "IN_STOCK"
  | "TRUSTED_STORE";

export type ExclusionCode = "NOT_APPROVED" | "OUT_OF_STOCK" | "DIVERSITY_STORE_CAP" | "DIVERSITY_CATEGORY_CAP";

export interface ScoreParts {
  pop: number;
  popN: number;
  quality: number;
  fresh: number;
  trust: number;
  S: number;
}

/** تقييم بايزي: يقترب من المتوسط العام حين تقلّ المراجعات. */
export function bayesianRating(avg: number, count: number): number {
  const { confidence: C, priorMean: m } = W.bayes;
  return (C * m + avg * count) / (C + count);
}

export function ageDays(createdAt: Date, now: Date = new Date()): number {
  return (now.getTime() - createdAt.getTime()) / 86_400_000;
}

export function freshness(days: number): number {
  return Math.exp(-Math.max(0, days) / W.freshnessHalfLifeDays);
}

/** النقاط المختلطة `S` لعنصر واحد. `popMax` = أعلى شعبية في مجموعة المرشّحين (للتطبيع). */
export function scoreProduct(p: RankableProduct, popMax: number, now: Date = new Date()): ScoreParts {
  const pop = Math.log1p(Math.max(0, p.sales7));
  const popN = popMax > 0 ? pop / popMax : 0;
  const quality = bayesianRating(p.ratingAvg, p.ratingCount) / 5;
  const fresh = freshness(ageDays(p.createdAt, now));
  const trust = bayesianRating(p.storeRatingAvg, p.storeRatingCount) / 5;
  const avail = p.available > 0 ? 1 : 0;
  const S = avail * (W.popularity * popN + W.quality * quality + W.freshness * fresh + W.storeTrust * trust);
  return { pop, popN, quality, fresh, trust, S };
}

/** أعلى شعبية خام في المجموعة (لتطبيع popN). */
export function maxPopularity(items: RankableProduct[]): number {
  return items.reduce((mx, p) => Math.max(mx, Math.log1p(Math.max(0, p.sales7))), 0);
}

/** أسباب ظهور عنصر (Δ3) — تُعرض للمستخدم/الأدمن. */
export function reasonsFor(p: RankableProduct, now: Date = new Date()): ReasonCode[] {
  const r: ReasonCode[] = [];
  if (ageDays(p.createdAt, now) <= W.newWindowDays) r.push("NEW");
  if (p.sales7 >= W.trending.minBuyers) r.push("TRENDING");
  if (p.ratingCount >= W.topRated.minCount && bayesianRating(p.ratingAvg, p.ratingCount) >= W.topRated.minScore)
    r.push("TOP_RATED");
  if (p.soldCount > 0) r.push("BEST_SELLER");
  if (p.available > 0) r.push("IN_STOCK");
  if (p.storeRatingCount >= W.topRated.minCount && bayesianRating(p.storeRatingAvg, p.storeRatingCount) >= W.topRated.minScore)
    r.push("TRUSTED_STORE");
  return r;
}

/** Δ5 — إخفاء مُفسَّر: لماذا لا يظهر منتج (للتاجر). null = مؤهّل. */
export function exclusionFor(p: RankableProduct): ExclusionCode | null {
  if (!p.storeApproved) return "NOT_APPROVED";
  if (p.available <= 0) return "OUT_OF_STOCK";
  return null;
}

/**
 * تنوّع السطح (Δ2): جشِع فوق قائمة مرتّبة بالنقاط مع سقف لكل متجر ولكل فئة.
 * يضمن ألا يُغرق متجرٌ أو فئةٌ واحدة الصفحة. ما يتجاوز السقف يُستبعَد من هذا السطح.
 */
export function diversify<T extends { vendorId: string; categoryId: string }>(
  ranked: T[],
  limit: number,
  opts: { perStore: number; perCategory: number } = W.diversity,
): T[] {
  const out: T[] = [];
  const perStore = new Map<string, number>();
  const perCat = new Map<string, number>();
  for (const it of ranked) {
    if (out.length >= limit) break;
    if ((perStore.get(it.vendorId) ?? 0) >= opts.perStore) continue;
    if ((perCat.get(it.categoryId) ?? 0) >= opts.perCategory) continue;
    out.push(it);
    perStore.set(it.vendorId, (perStore.get(it.vendorId) ?? 0) + 1);
    perCat.set(it.categoryId, (perCat.get(it.categoryId) ?? 0) + 1);
  }
  return out;
}

/** فرز قسم «اليوم» المختلط: نقاط ثم تنوّع. */
export function rankMixed(items: RankableProduct[], limit: number, now: Date = new Date()): RankableProduct[] {
  const eligible = items.filter((p) => exclusionFor(p) === null);
  const popMax = maxPopularity(eligible);
  const scored = eligible
    .map((p) => ({ p, S: scoreProduct(p, popMax, now).S }))
    .sort((a, b) => b.S - a.S)
    .map((x) => x.p);
  return diversify(scored, limit);
}
