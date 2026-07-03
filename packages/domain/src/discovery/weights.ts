/**
 * أوزان وعتبات محرّك الاكتشاف — «الدستور كـ code» (مصدر واحد للحقيقة).
 * تعديلها قرار مُراجَع، وأثره مُفسَّر عبر Reason-To-Rank.
 */
export const DISCOVERY_WEIGHTS = {
  // أوزان النقاط المختلطة (المجموع = 1)
  popularity: 0.4,
  quality: 0.25,
  freshness: 0.25,
  storeTrust: 0.1,

  // تلاشي الحداثة: fresh = exp(-عمر/نصف العمر)
  freshnessHalfLifeDays: 14,

  // تقييم بايزي يمنع «مراجعة واحدة = 5.0 يتصدّر»
  bayes: { confidence: 5, priorMean: 4.0 },

  // أقسام تعريفية
  topRated: { minCount: 3, minScore: 4.5 },
  trending: { minBuyers: 2, windowDays: 7 },
  newWindowDays: 7,
  newStore: { minProducts: 5, windowDays: 14 },

  // تنوّع على مستوى السطح (Δ2)
  diversity: { perStore: 3, perCategory: 4 },
} as const;

export type DiscoveryWeights = typeof DISCOVERY_WEIGHTS;
