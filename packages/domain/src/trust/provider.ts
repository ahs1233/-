/**
 * سياق الثقة (Trust) — منفذ TrustProvider · المرحلة A · PR2.
 * الثقة نظام كامل قابل للاستبدال بالكامل (دالة → ذاكرة مؤقتة → خدمة → ML) دون لمس
 * Discovery ولا الأسطح (ثابت #10). المستهلك يعرف المنفذ فقط، لا كيفية اشتقاق الثقة.
 * Trust لا يعرف واجهة المستخدم؛ يُنتج رقماً مطبّعاً [0..1] وحسب.
 */
import { bayesianRating } from "../discovery/score";

/** درجات ثقة مطبّعة [0..1] لكل معرّف موضوع (متجر/كيان). غياب المعرّف ⇒ ثقة غير معروفة. */
export type TrustScores = ReadonlyMap<string, number>;

/**
 * منفذ الثقة: يُرجِع ثقة مطبّعة [0..1] لمجموعة معرّفات مواضيع.
 * غير متزامن عمداً — ليقبل ذاكرة مؤقتة/خدمة/ML لاحقاً دون تغيير المستدعي.
 */
export interface TrustProvider {
  trustFor(subjectIds: readonly string[]): Promise<TrustScores>;
}

/** حقائق التقييم التي تشتقّ منها الثقة المرجعية (تُستبدَل لاحقاً بإشارات أغنى). */
export interface TrustRatingFacts {
  ratingAvg: number;
  ratingCount: number;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** التركيب المرجعي للثقة من التقييم — يطابق سلوك V1 (bayesian/5) بدقّة. نقيّ. */
export function trustFromRating(f: TrustRatingFacts): number {
  return clamp01(bayesianRating(f.ratingAvg, f.ratingCount) / 5);
}

/**
 * منفذ ثقة مرجعي مبنيّ على التقييم — من لقطة حقائق ثابتة (بلا قاعدة/شبكة، قابل للاختبار).
 * البنية التحتية (طبقة api) تبني الخريطة من قاعدة البيانات ثم تمرّرها هنا، أو تستبدل
 * المنفذ كلياً بخدمة/ML — Discovery لا يتغيّر في الحالتين. المعرّف المجهول يُحذَف من النتيجة.
 */
export function ratingTrustProvider(facts: ReadonlyMap<string, TrustRatingFacts>): TrustProvider {
  return {
    trustFor(subjectIds) {
      const out = new Map<string, number>();
      for (const id of subjectIds) {
        const f = facts.get(id);
        if (f) out.set(id, trustFromRating(f));
      }
      return Promise.resolve(out);
    },
  };
}

/** منفذ ثابت — ثقة موحّدة لكل موضوع (للاختبارات والحالات الحدّية/الاحتياطية). */
export function constantTrustProvider(value: number): TrustProvider {
  const v = clamp01(value);
  return { trustFor: (ids) => Promise.resolve(new Map(ids.map((id) => [id, v]))) };
}
