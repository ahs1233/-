/**
 * Discovery Model V2 — عقد `DiscoveryItem` العام (المرحلة A · PR1).
 * Status: Stable Contract · Product Contract: Discovery Model V2.
 *
 * الفكرة الحاملة: Discovery لا يعرف «الكيانات»، يعرف **إشارات مطبّعة** فقط.
 * كل نوع يُسقِط نفسه إلى نفس المتجه عبر Projector، ويرتّبها مُصنِّفٌ محايد للنوع،
 * وبطاقة العرض (`card`) تمرّ **معتمة**. (راجع docs/phase-a-technical-design.md)
 *
 * ثوابت مطبّقة هنا: لا Prisma/SQL · لا آثار جانبية · دوال بيانات نقية فقط.
 */

/** أنواع عناصر الاكتشاف. المرحلة A تُفعّل نوعين؛ الباقي خانات محجوزة. */
export type DiscoveryItemType =
  | "commerce_entity"
  | "offer"
  // ── محجوزة (خانات نوع فقط — تُفعَّل بمُسقِط + مِلَفّ أوزان لاحقاً) ──
  | "marketplace"
  | "question"
  | "review"
  | "video";

/** الأنواع المُفعَّلة في المرحلة A (مرجع اختبار التغطية). */
export const ACTIVE_ITEM_TYPES: readonly DiscoveryItemType[] = ["commerce_entity", "offer"] as const;

/**
 * متجه الإشارات — كلها مطبّعة [0..1] ومقارَنة عبر كل الأنواع. هذا كل ما يقرأه المُصنِّف.
 * ملاحظة: `popularity` نسبية — يُطبّعها المُسقِط مقابل أعلى شعبية في مجموعة المرشّحين
 * (تُمرَّر عبر `ProjectionContext.popMax`)، فتصل هنا [0..1] مثل بقيّة الإشارات (ثابت #5).
 */
export interface RankingSignals {
  popularity: number;
  quality: number;
  freshness: number;
  trust: number;
}

/** مفاتيح تجميع للتنوّع فقط — ليست تفاصيل كيان. */
export interface GroupKeys {
  store?: string;
  category?: string;
  market?: string;
}

/**
 * القدرات — مفردات مغلقة تصف *ما يمكن فعله* بالعنصر. الواجهة ترسم الأزرار منها،
 * لا من النوع (ثابت #6: لا `if(type===…)`). يملؤها المُسقِط من إعداد المصدر.
 */
export type Capability =
  | "order"
  | "book"
  | "reserve"
  | "follow"
  | "review"
  | "question"
  | "call"
  | "navigate"
  | "share";
export type Capabilities = ReadonlySet<Capability>;

/** أسباب الظهور (مجموعة عليا تغطّي الكيانات والعروض). تُعرض للمستخدم/الأدمن. */
export type DiscoveryReason =
  | "NEW"
  | "TRENDING"
  | "TOP_RATED"
  | "BEST_SELLER"
  | "IN_STOCK"
  | "TRUSTED"
  | "VERIFIED"
  | "NEW_STORE"
  | "RECOMMENDED";

/** أسباب الإخفاء المُفسَّرة (للتاجر/الأدمن). null = مؤهّل. */
export type DiscoveryExclusion =
  | "NOT_APPROVED"
  | "OUT_OF_STOCK"
  | "INACTIVE"
  | "DIVERSITY_STORE_CAP"
  | "DIVERSITY_CATEGORY_CAP";

/** أوزان النقاط لكل نوع (مجموعها ≈ 1). جزء من «الدستور» — تغييره قرار مُراجَع. */
export type WeightProfile = Record<keyof RankingSignals, number>;

/**
 * العنصر العام. `card` نوعها `unknown` في المحرّك فلا يستطيع فيزيائياً قراءة تفاصيلها.
 * المُصنِّف يقرأ `signals` فقط؛ التنوّع يقرأ `groupKeys`؛ الواجهة تقرأ `capabilities` و`card`.
 */
export interface DiscoveryItem<TCard = unknown> {
  type: DiscoveryItemType;
  id: string;
  governorateId: string | null;
  createdAt: Date;
  signals: RankingSignals;
  groupKeys: GroupKeys;
  capabilities: Capabilities;
  reasons: DiscoveryReason[];
  exclusion: DiscoveryExclusion | null;
  card: TCard;
}
