import { describe, it, expect } from "vitest";
import { ACTIVE_ITEM_TYPES, type DiscoveryItemType } from "./item";
import { getProjector, weightProfileFor, registeredTypes, type ProjectionContext } from "./registry";
import "./projectors"; // استيراد البرميل يسجّل كل مُسقِطات المرحلة A

const CTX: ProjectionContext = { now: new Date(), popMax: 1 };

/** حقائق نموذجية بحدّها الأدنى لكل نوع مُفعَّل — لإثبات أن المُسقِط يُنتج عنصراً صالحاً. */
function sampleFacts(type: DiscoveryItemType): unknown {
  const base = { id: "x", governorateId: null, createdAt: new Date(), ratingAvg: 4, ratingCount: 10 };
  if (type === "offer")
    return { ...base, vendorId: "v", categoryId: "c", soldCount: 1, sales7: 1, available: 5, storeApproved: true, storeTrust: 0.7, card: {} };
  if (type === "commerce_entity")
    return { ...base, productCount: 6, activity7: 2, approved: true, trust: 0.7, card: {} };
  return base;
}

describe("registry — تغطية: كل نوع مُفعَّل له Projector + WeightProfile + Capabilities", () => {
  it("كل الأنواع المُفعَّلة مُسجَّلة", () => {
    for (const t of ACTIVE_ITEM_TYPES) {
      expect(getProjector(t), `مُسقِط مفقود للنوع ${t}`).toBeDefined();
    }
  });

  it("كل نوع مُسجَّل يملك مِلَفّ أوزان مجموعه ≈ 1", () => {
    for (const t of registeredTypes()) {
      const w = weightProfileFor(t);
      expect(w, `أوزان مفقودة للنوع ${t}`).toBeDefined();
      const sum = w!.popularity + w!.quality + w!.freshness + w!.trust;
      expect(sum, `مجموع أوزان ${t} ليس 1`).toBeCloseTo(1, 6);
    }
  });

  it("مُسقِط كل نوع مُفعَّل يُنتج عنصراً بنوعٍ صحيح وقدرات غير فارغة", () => {
    for (const t of ACTIVE_ITEM_TYPES) {
      const p = getProjector(t)!;
      const item = p.project(sampleFacts(t), CTX);
      expect(item.type).toBe(t);
      expect(item.capabilities.size, `قدرات فارغة للنوع ${t}`).toBeGreaterThan(0);
      // كل الإشارات في [0..1]
      for (const k of ["popularity", "quality", "freshness", "trust"] as const) {
        expect(item.signals[k]).toBeGreaterThanOrEqual(0);
        expect(item.signals[k]).toBeLessThanOrEqual(1);
      }
    }
  });
});
