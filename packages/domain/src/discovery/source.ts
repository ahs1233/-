/**
 * منفذ مصدر المرشّحين (CandidateSource) — المرحلة A · PR2.
 * الحدّ الذي يجعل Discovery لا يعرف Prisma/SQL (ثابت #2): Discovery يعتمد هذا المنفذ
 * فقط، والبنية التحتية (طبقة api) تنفّذه فوق Prisma. الحقائق معتمة (`unknown`) — مُسقِط
 * النوع في السجلّ وحده يعرف شكلها، فلا `switch(type)` هنا (ثابت #3). إضافة نوع جديد =
 * دفعة جديدة من المصدر + مُسقِط، دون لمس نواة Discovery (ثابت #7).
 */
import type { DiscoveryItemType } from "./item";

/** استعلام اكتشاف محايد للمصدر. عزل المحافظة جزء من العقد (ثابت #11). */
export interface DiscoveryQuery {
  /** المحافظة (سياق كامل لا فلتر) — `null`/غياب = كل العراق. */
  governorateId?: string | null;
  /** سقف اختياري للمرشّحين لكل دفعة (تحسين مصدر، لا منطق ترتيب). */
  limit?: number;
}

/** دفعة مرشّحين من نوعٍ واحد: حقائق معتمة يفهمها مُسقِط `type` وحده. */
export interface CandidateBatch<TFacts = unknown> {
  type: DiscoveryItemType;
  facts: readonly TFacts[];
}

/**
 * منفذ المصدر: يُرجِع دفعات مرشّحين لاستعلام. غير متزامن (قاعدة/خدمة).
 * لا يعرف الترتيب ولا الإسقاط — يجلب الحقائق فقط.
 */
export interface CandidateSource {
  fetch(query: DiscoveryQuery): Promise<CandidateBatch[]>;
}
