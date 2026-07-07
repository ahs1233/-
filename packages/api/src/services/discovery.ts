/**
 * Discovery Engine V1 — Status: Stable · Product Contract: Discovery Model V1.
 * Breaking Changes: تعديل مجموعة المرشّحين (candidate pool) أدناه يستلزم
 * Product Review (نواة منتج، لا Service عادي) — راجع weights.ts.
 *
 * DiscoveryService — طبقة بيانات محرّك الاكتشاف (V1).
 * تجلب مجموعة مرشّحين من قاعدة البيانات، تحسب مبيعات ٧ أيام بمشترين متمايزين
 * (مع استبعاد الشراء الذاتي)، ثم تشتقّ كل الأقسام عبر دوال domain النقية.
 * لا AI · لا جداول جديدة · كل الأسطح تنادي هذه الخدمة وحدها.
 */
import type { PrismaClient } from "@al-souq/db";
import {
  reasonsFor,
  bayesianRating,
  exclusionFor,
  maxPopularity,
  getProjector,
  rankItems,
  weightProfileFor,
  ZERO_PROFILE,
  ratingTrustProvider,
  DISCOVERY_WEIGHTS as W,
  type RankableProduct,
  type ReasonCode,
  type OfferFacts,
  type TrustProvider,
  type TrustScores,
  type CandidateSource,
  type ProjectionContext,
} from "@al-souq/domain";

// V1 Optimization — قرار منتجي مقصود، وليس قيداً تقنياً عشوائياً:
// مجموعة المرشّحين = أحدث ٣٠٠ منتج (استعلام واحد أدنى تُشتقّ منه كل الأقسام).
// الأثر: منتج قديم عالي المبيعات يقع خارج آخر ٣٠٠ لا يدخل المنافسة إطلاقاً
// (Discovery الحالي «Recent-first» لا «Best-ever»). مقبول لحجم V1؛ حين يلزم
// رفعه لاحقاً = مجموعات مرشّحين مستقلة لكل قسم، دون لمس منطق الترتيب النقي.
// هذا السلوك مثبَّت باختبار (test/discovery-pool.test.ts) ليبقى قراراً واعياً.
const POOL_SIZE = 300;
const SECTION_SIZE = 12;
const MIN_POOL_BEFORE_FALLBACK = 8;

export type DiscoverySectionKey =
  | "today"
  | "new"
  | "trending"
  | "top_rated"
  | "best_selling"
  | "new_stores";

export interface DiscoveryProductCard {
  id: string;
  title: string;
  slug: string;
  price: number;
  ratingAvg: number;
  ratingCount: number;
  image: string | null;
  vendor: { storeName: string; slug: string };
  reasons: ReasonCode[];
}

export interface DiscoveryStoreCard {
  id: string;
  storeName: string;
  slug: string;
  logoUrl: string | null;
  productCount: number;
  ratingAvg: number;
  ratingCount: number;
}

export type DiscoverySection =
  | { key: Exclude<DiscoverySectionKey, "new_stores">; kind: "products"; items: DiscoveryProductCard[] }
  | { key: "new_stores"; kind: "stores"; items: DiscoveryStoreCard[] };

/** حامل يجمع بيانات الترتيب (domain) مع بيانات البطاقة (UI). */
interface Candidate extends RankableProduct {
  card: Omit<DiscoveryProductCard, "reasons">;
}

async function distinctBuyerSales7(prisma: PrismaClient): Promise<Map<string, number>> {
  // مبيعات آخر ٧ أيام: مشترون متمايزون على طلبات مُسلَّمة، مع استبعاد الشراء الذاتي.
  const rows = await prisma.$queryRaw<{ productId: string; buyers: bigint }[]>`
    SELECT oi."productId" AS "productId", COUNT(DISTINCT o."customerId") AS buyers
    FROM "OrderItem" oi
    JOIN "Order" o ON o."id" = oi."orderId"
    JOIN "Product" p ON p."id" = oi."productId"
    JOIN "VendorProfile" vp ON vp."id" = p."vendorId"
    WHERE o."status" IN ('DELIVERED', 'COMPLETED')
      AND o."placedAt" > NOW() - INTERVAL '7 days'
      AND o."customerId" <> vp."userId"
    GROUP BY oi."productId"`;
  return new Map(rows.map((r) => [r.productId, Number(r.buyers)]));
}

async function loadPool(prisma: PrismaClient, governorateId?: string): Promise<Candidate[]> {
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE", vendor: { status: "APPROVED", ...(governorateId ? { governorateId } : {}) } },
    take: POOL_SIZE,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      basePrice: true,
      ratingAvg: true,
      ratingCount: true,
      soldCount: true,
      createdAt: true,
      categoryId: true,
      vendorId: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
      variants: { where: { isActive: true }, select: { stock: true, reservedStock: true } },
      vendor: { select: { storeName: true, slug: true, ratingAvg: true, ratingCount: true } },
    },
  });
  const sales7 = await distinctBuyerSales7(prisma);

  return products.map((p) => {
    const available = p.variants.reduce((s, v) => s + Math.max(0, v.stock - v.reservedStock), 0);
    return {
      id: p.id,
      categoryId: p.categoryId,
      vendorId: p.vendorId,
      createdAt: p.createdAt,
      soldCount: p.soldCount,
      sales7: sales7.get(p.id) ?? 0,
      ratingAvg: Number(p.ratingAvg),
      ratingCount: p.ratingCount,
      available,
      storeApproved: true, // مضمون بشرط الاستعلام (APPROVED)
      storeRatingAvg: Number(p.vendor.ratingAvg),
      storeRatingCount: p.vendor.ratingCount,
      card: {
        id: p.id,
        title: p.title,
        slug: p.slug,
        price: Number(p.basePrice),
        ratingAvg: Number(p.ratingAvg),
        ratingCount: p.ratingCount,
        image: p.images[0]?.url ?? null,
        vendor: { storeName: p.vendor.storeName, slug: p.vendor.slug },
      },
    };
  });
}

const toCard = (c: Candidate, now: Date): DiscoveryProductCard => ({ ...c.card, reasons: reasonsFor(c, now) });

/** يحوّل مرشّح المجموعة إلى حقائق العرض التي يستهلكها مُسقِط Discovery V2. */
function toOfferFacts(c: Candidate, trust: TrustScores): OfferFacts {
  return {
    id: c.id,
    governorateId: null, // العزل يتم في الاستعلام؛ غير مستخدم في الترتيب
    createdAt: c.createdAt,
    vendorId: c.vendorId,
    categoryId: c.categoryId,
    soldCount: c.soldCount,
    sales7: c.sales7,
    ratingAvg: c.ratingAvg,
    ratingCount: c.ratingCount,
    available: c.available,
    storeApproved: c.storeApproved,
    storeTrust: trust.get(c.vendorId) ?? 0, // ثقة مطبّعة من TrustProvider (bayesian/5)
    card: c.card,
  };
}

/**
 * منفذ CandidateSource في الذاكرة فوق المجموعة المُحمَّلة (استعلام واحد) — يُثبت أن
 * مسار الصفحة الرئيسية يستهلك المنفذ فعلياً، لا Prisma مباشرة داخل Discovery (ثابت #2).
 */
function offerSourceFromPool(pool: Candidate[], trust: TrustProvider): CandidateSource {
  return {
    async fetch() {
      const scores = await trust.trustFor(pool.map((c) => c.vendorId));
      return [{ type: "offer", facts: pool.map((c) => toOfferFacts(c, scores)) }];
    },
  };
}

async function newStores(prisma: PrismaClient, governorateId?: string): Promise<DiscoveryStoreCard[]> {
  const vendors = await prisma.vendorProfile.findMany({
    where: {
      status: "APPROVED",
      ...(governorateId ? { governorateId } : {}),
      createdAt: { gte: new Date(Date.now() - W.newStore.windowDays * 86_400_000) },
    },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      storeName: true,
      slug: true,
      logoUrl: true,
      ratingAvg: true,
      ratingCount: true,
      _count: { select: { products: { where: { status: "ACTIVE" } } } },
    },
  });
  return vendors
    .filter((v) => v._count.products >= W.newStore.minProducts)
    .map((v) => ({
      id: v.id,
      storeName: v.storeName,
      slug: v.slug,
      logoUrl: v.logoUrl,
      productCount: v._count.products,
      ratingAvg: Number(v.ratingAvg),
      ratingCount: v.ratingCount,
    }));
}

/** يبني كل أقسام الصفحة الرئيسية من مجموعة مرشّحين واحدة (استعلام أدنى). */
export async function getHomeSections(prisma: PrismaClient, governorateId?: string): Promise<DiscoverySection[]> {
  let pool = await loadPool(prisma, governorateId);
  // احتياط كل-العراق عند شحّ عرض المحافظة (يحافظ على العزل أولاً).
  if (pool.length < MIN_POOL_BEFORE_FALLBACK && governorateId) {
    pool = await loadPool(prisma, undefined);
  }
  const now = new Date();
  const inStock = pool.filter((p) => p.available > 0);

  const sections: DiscoverySection[] = [];
  const push = (key: Exclude<DiscoverySectionKey, "new_stores">, items: Candidate[]) => {
    if (items.length) sections.push({ key, kind: "products", items: items.map((c) => toCard(c, now)) });
  };

  // اليوم — يمرّ الآن عبر مكدّس Discovery V2: منفذ CandidateSource → مُسقِط العرض →
  // المُصنِّف المحايد للنوع + منفذ الثقة. المخرجات مطابقة لـ rankMixed بايتاً ببايت
  // (يُثبته اختبار التكافؤ في domain): نفس الأوزان والتطبيع والتنوّع، والبطاقات تُبنى
  // من نفس toCard القديم (أسباب متطابقة، بما فيها TRUSTED_STORE).
  const trust = ratingTrustProvider(
    new Map(pool.map((c) => [c.vendorId, { ratingAvg: c.storeRatingAvg, ratingCount: c.storeRatingCount }])),
  );
  const source = offerSourceFromPool(pool, trust);
  const batches = await source.fetch({ governorateId });
  const popMax = maxPopularity(pool.filter((c) => exclusionFor(c) === null));
  const ctx: ProjectionContext = { now, popMax };
  const todayItems = batches.flatMap((b) => {
    const projector = getProjector(b.type); // بحث في السجلّ بالنوع — بلا switch(type)
    return projector ? b.facts.map((f) => projector.project(f, ctx)) : [];
  });
  const rankedToday = rankItems(todayItems, (t) => weightProfileFor(t) ?? ZERO_PROFILE, SECTION_SIZE, W.diversity);
  const byId = new Map(pool.map((c) => [c.id, c]));
  push("today", rankedToday.map((it) => byId.get(it.id)!));
  // الترند: مبيعات ٧ أيام (≥ حد المشترين)
  push(
    "trending",
    inStock.filter((p) => p.sales7 >= W.trending.minBuyers).sort((a, b) => b.sales7 - a.sales7).slice(0, SECTION_SIZE),
  );
  // جديد هذا الأسبوع
  push(
    "new",
    inStock
      .filter((p) => (now.getTime() - p.createdAt.getTime()) / 86_400_000 <= W.newWindowDays)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, SECTION_SIZE),
  );
  // الأعلى تقييماً (تقييم بايزي + حد أدنى للمراجعات)
  push(
    "top_rated",
    inStock
      .filter((p) => p.ratingCount >= W.topRated.minCount)
      .sort((a, b) => bayesianRating(b.ratingAvg, b.ratingCount) - bayesianRating(a.ratingAvg, a.ratingCount))
      .slice(0, SECTION_SIZE),
  );
  // الأكثر مبيعاً
  push(
    "best_selling",
    inStock.filter((p) => p.soldCount > 0).sort((a, b) => b.soldCount - a.soldCount).slice(0, SECTION_SIZE),
  );

  // متاجر جديدة
  const stores = await newStores(prisma, governorateId);
  if (stores.length) sections.push({ key: "new_stores", kind: "stores", items: stores });

  return sections;
}
