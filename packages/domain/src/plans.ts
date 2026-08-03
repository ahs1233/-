/**
 * طبقات اشتراك التجّار + الظهور المدفوع (محرّك تحصيل الدخل).
 *
 * القرار المعماريّ (Simplicity First):
 *  • الطبقات الثلاث بنيويّةٌ ثابتة (ذهبيّ > فضّيّ > مجّانيّ) — ترتيبُها ودفعةُ ظهورها هيكل.
 *  • القابل للتعديل من لوحة الإدارة (الاسم/السعر/المزايا) يُخزَّن في PlatformSetting
 *    ولا يمسّ هذا المنطق البنيويّ.
 *  • لا نلمس مسار العمولة: خصم عمولة «الذهبيّ» يضبطه الأدمن عبر commissionRate لكلّ تاجر.
 */

export type VendorPlan = "free" | "silver" | "gold";
export const VENDOR_PLANS: readonly VendorPlan[] = ["free", "silver", "gold"] as const;

export function isVendorPlan(v: string): v is VendorPlan {
  return v === "free" || v === "silver" || v === "gold";
}

/** رتبة الطبقة لترتيب الظهور (بنيويّة ثابتة). */
export const PLAN_RANK: Record<VendorPlan, number> = { free: 0, silver: 1, gold: 2 };

/** دفعة ظهور «المتجر المميّز» المدفوع — أعلى من أيّ طبقة، تُطبَّق ما دام featuredUntil مستقبليّاً. */
export const FEATURED_BOOST = 10;

/**
 * درجة ترتيب المتجر للظهور: المميّز أولاً، ثمّ الطبقة (ذهبيّ↑)، وإلا 0.
 * تُستخدم كمفتاح فرزٍ أوّليّ قبل التقييم في قوائم المتاجر.
 */
export function placementScore(input: { plan?: string | null; featuredUntil?: Date | null }, now: Date = new Date()): number {
  const featured = input.featuredUntil != null && input.featuredUntil.getTime() > now.getTime();
  if (featured) return FEATURED_BOOST;
  const plan = input.plan && isVendorPlan(input.plan) ? input.plan : "free";
  return PLAN_RANK[plan];
}

/** هل الاشتراك فعّال الآن؟ (المجّانيّ دائماً فعّال؛ غيره حتى planExpiresAt). */
export function isPlanActive(plan: string | null | undefined, planExpiresAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!plan || plan === "free") return true;
  return planExpiresAt == null || planExpiresAt.getTime() > now.getTime();
}

/** إعداد الطبقة القابل للتعديل من الإدارة (اسم/سعر/مزايا/شارة). */
export interface PlanConfig {
  label: string;
  priceIQD: number;
  badge: string | null; // silver | gold | null — للعرض
  benefits: string[];
}
export type VendorPlansConfig = Record<VendorPlan, PlanConfig>;

/** القيم الافتراضيّة (تُنسخ إلى PlatformSetting عند أوّل ضبط، ثمّ تُحرَّر من الإدارة). */
export const DEFAULT_PLANS_CONFIG: VendorPlansConfig = {
  free: { label: "مجّاني", priceIQD: 0, badge: null, benefits: ["إدراج المتجر", "أقسامٌ داخليّة", "عمولةٌ كاملة"] },
  silver: {
    label: "فضّي",
    priceIQD: 25000,
    badge: "silver",
    benefits: ["توثيق ✓", "تحليلاتٌ أساسيّة", "دفعةُ ظهورٍ خفيفة", "دعمٌ أسرع"],
  },
  gold: {
    label: "ذهبيّ",
    priceIQD: 75000,
    badge: "gold",
    benefits: ["تصدّرُ نتائج السوق", "عمولةٌ مخفّضة", "أقسامٌ بلا حدّ", "شارةٌ ذهبيّة", "دعمٌ مميّز"],
  },
};

/** دمج إعدادٍ محفوظٍ (قد يكون ناقصاً) مع الافتراضات — يضمن اكتمال الطبقات الثلاث. */
export function normalizePlansConfig(raw: unknown): VendorPlansConfig {
  const v = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<VendorPlan, Partial<PlanConfig>>>;
  const out = {} as VendorPlansConfig;
  for (const key of VENDOR_PLANS) {
    const d = DEFAULT_PLANS_CONFIG[key];
    const s = v[key] ?? {};
    out[key] = {
      label: typeof s.label === "string" && s.label.trim() ? s.label : d.label,
      priceIQD: typeof s.priceIQD === "number" && s.priceIQD >= 0 ? s.priceIQD : d.priceIQD,
      badge: key === "free" ? null : typeof s.badge === "string" ? s.badge : d.badge,
      benefits: Array.isArray(s.benefits) && s.benefits.length ? s.benefits.map(String) : d.benefits,
    };
  }
  return out;
}
