/**
 * Discovery Model V2 — المُصنِّف المحايد للنوع (المرحلة A · PR1).
 * دوال نقية حتمية بلا آثار جانبية (ثابت #4). تعمل على `DiscoveryItem` — لا تعرف
 * أي نوع محتوى، ولا تفرّع على `type` (ثابت #3). التمييز عبر `WeightProfile` (بيانات).
 */
import type { DiscoveryItem, GroupKeys, WeightProfile } from "./item";

/** نقاط عنصرٍ واحد: مجموع موزون لإشاراته المطبّعة. المُستبعَد = 0. */
export function scoreItem(item: DiscoveryItem, profile: WeightProfile): number {
  if (item.exclusion) return 0;
  const s = item.signals;
  return (
    profile.popularity * s.popularity +
    profile.quality * s.quality +
    profile.freshness * s.freshness +
    profile.trust * s.trust
  );
}

/** ملف أوزان صفري — يُستخدم كاحتياط لنوع غير مُعرَّف (فيصبح نقاطه 0 بلا تفريع). */
export const ZERO_PROFILE: WeightProfile = { popularity: 0, quality: 0, freshness: 0, trust: 0 };

/**
 * تنوّع السطح: جشِعٌ فوق قائمة مرتّبة بالنقاط مع سقف لكل متجر ولكل فئة عبر `groupKeys`.
 * ما يتجاوز السقف يُستبعَد من هذا السطح (بلا كتابة، دالة نقية).
 */
export function diversifyItems<T extends { groupKeys: GroupKeys }>(
  ranked: readonly T[],
  limit: number,
  caps: { perStore: number; perCategory: number },
): T[] {
  const out: T[] = [];
  const perStore = new Map<string, number>();
  const perCat = new Map<string, number>();
  for (const it of ranked) {
    if (out.length >= limit) break;
    const store = it.groupKeys.store;
    const cat = it.groupKeys.category;
    if (store && (perStore.get(store) ?? 0) >= caps.perStore) continue;
    if (cat && (perCat.get(cat) ?? 0) >= caps.perCategory) continue;
    out.push(it);
    if (store) perStore.set(store, (perStore.get(store) ?? 0) + 1);
    if (cat) perCat.set(cat, (perCat.get(cat) ?? 0) + 1);
  }
  return out;
}

/**
 * يرتّب عناصر (قد تكون مختلطة الأنواع) بالنقاط ثم يطبّق التنوّع.
 * `resolveProfile` يُمرَّر من الخارج (Registry) فيبقى هذا المنطق نقياً بلا اعتماد عليه.
 * المُستبعَدون (`exclusion != null`) يُصفَّون قبل الترتيب.
 */
export function rankItems<TCard>(
  items: readonly DiscoveryItem<TCard>[],
  resolveProfile: (type: DiscoveryItem["type"]) => WeightProfile,
  limit: number,
  diversity: { perStore: number; perCategory: number },
): DiscoveryItem<TCard>[] {
  const eligible = items.filter((it) => it.exclusion === null);
  const scored = eligible
    .map((it) => ({ it, s: scoreItem(it, resolveProfile(it.type)) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.it);
  return diversifyItems(scored, limit, diversity);
}
