import { describe, it, expect } from "vitest";
import type { DiscoveryItem, WeightProfile } from "./item";
import { scoreItem, diversifyItems, rankItems } from "./rank";

const OFFER_W: WeightProfile = { popularity: 0.4, quality: 0.25, freshness: 0.25, trust: 0.1 };

function item(over: Partial<DiscoveryItem> & { id: string }): DiscoveryItem {
  return {
    type: "offer",
    governorateId: null,
    createdAt: new Date(),
    signals: { popularity: 0, quality: 0, freshness: 0, trust: 0 },
    groupKeys: {},
    capabilities: new Set(),
    reasons: [],
    exclusion: null,
    card: {},
    ...over,
  };
}

describe("rank — مُصنِّف محايد للنوع", () => {
  it("scoreItem مجموع موزون للإشارات المطبّعة", () => {
    const it0 = item({ id: "a", signals: { popularity: 1, quality: 1, freshness: 1, trust: 1 } });
    expect(scoreItem(it0, OFFER_W)).toBeCloseTo(1.0, 6); // مجموع الأوزان = 1
    const half = item({ id: "b", signals: { popularity: 0.5, quality: 0, freshness: 0, trust: 0 } });
    expect(scoreItem(half, OFFER_W)).toBeCloseTo(0.2, 6); // 0.4 * 0.5
  });

  it("المُستبعَد نقاطه صفر", () => {
    const ex = item({ id: "x", signals: { popularity: 1, quality: 1, freshness: 1, trust: 1 }, exclusion: "OUT_OF_STOCK" });
    expect(scoreItem(ex, OFFER_W)).toBe(0);
  });

  it("diversifyItems يفرض سقف المتجر", () => {
    const items = [
      item({ id: "1", groupKeys: { store: "s1" } }),
      item({ id: "2", groupKeys: { store: "s1" } }),
      item({ id: "3", groupKeys: { store: "s1" } }),
      item({ id: "4", groupKeys: { store: "s2" } }),
    ];
    const out = diversifyItems(items, 10, { perStore: 2, perCategory: 99 });
    expect(out.map((i) => i.id)).toEqual(["1", "2", "4"]); // s1 مُقيّد بـ2
  });

  it("rankItems يرتّب بالنقاط ويصفّي المُستبعَد ويطبّق التنوّع", () => {
    const items = [
      item({ id: "low", signals: { popularity: 0.1, quality: 0, freshness: 0, trust: 0 } }),
      item({ id: "high", signals: { popularity: 0.9, quality: 0, freshness: 0, trust: 0 } }),
      item({ id: "gone", signals: { popularity: 1, quality: 1, freshness: 1, trust: 1 }, exclusion: "NOT_APPROVED" }),
    ];
    const ranked = rankItems(items, () => OFFER_W, 10, { perStore: 99, perCategory: 99 });
    expect(ranked.map((i) => i.id)).toEqual(["high", "low"]); // gone مُصفّى
  });
});
