import { describe, it, expect } from "vitest";
import { bayesianRating } from "../discovery/score";
import {
  trustFromRating,
  ratingTrustProvider,
  constantTrustProvider,
  type TrustProvider,
  type TrustRatingFacts,
} from "./provider";

describe("trustFromRating — التركيب المرجعي يطابق V1", () => {
  it("يساوي bayesian/5 مقصوصاً على [0..1]", () => {
    expect(trustFromRating({ ratingAvg: 4.6, ratingCount: 20 })).toBeCloseTo(
      bayesianRating(4.6, 20) / 5,
      6,
    );
  });
  it("لا يتجاوز 1 حتى بتقييم فوق المدى", () => {
    expect(trustFromRating({ ratingAvg: 9, ratingCount: 100 })).toBeLessThanOrEqual(1);
  });
  it("لا ينزل تحت 0", () => {
    expect(trustFromRating({ ratingAvg: -3, ratingCount: 100 })).toBeGreaterThanOrEqual(0);
  });
});

describe("ratingTrustProvider — منفذ من لقطة حقائق", () => {
  const facts = new Map<string, TrustRatingFacts>([
    ["s1", { ratingAvg: 4.8, ratingCount: 30 }],
    ["s2", { ratingAvg: 3.0, ratingCount: 2 }],
  ]);
  const provider: TrustProvider = ratingTrustProvider(facts);

  it("يُرجِع ثقة مطبّعة لكل معرّف معروف", async () => {
    const scores = await provider.trustFor(["s1", "s2"]);
    expect(scores.get("s1")).toBeCloseTo(trustFromRating(facts.get("s1")!), 6);
    expect(scores.get("s2")).toBeCloseTo(trustFromRating(facts.get("s2")!), 6);
    for (const v of scores.values()) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("يحذف المعرّف المجهول (لا يخترع ثقة)", async () => {
    const scores = await provider.trustFor(["s1", "ghost"]);
    expect(scores.has("s1")).toBe(true);
    expect(scores.has("ghost")).toBe(false);
  });
});

describe("constantTrustProvider — بديل قابل للاستبدال (ثابت #10)", () => {
  it("يعطي القيمة نفسها لكل موضوع، مقصوصة", async () => {
    const scores = await constantTrustProvider(2).trustFor(["a", "b"]); // 2 يُقصّ إلى 1
    expect(scores.get("a")).toBe(1);
    expect(scores.get("b")).toBe(1);
  });
});
