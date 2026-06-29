import { describe, it, expect } from "vitest";
import { calculateCommission, resolveCommissionRate } from "./commission";

describe("calculateCommission", () => {
  it("يحسب 10% على المجموع", () => {
    const r = calculateCommission(100000, 0.1);
    expect(r.commissionAmount).toBe(10000);
    expect(r.vendorNet).toBe(90000);
  });
  it("يقرّب لأقرب دينار صحيح", () => {
    const r = calculateCommission(12500, 0.1);
    expect(r.commissionAmount).toBe(1250);
  });
  it("يرفض نسبة خارج النطاق", () => {
    expect(() => calculateCommission(1000, 1.5)).toThrow();
  });
});

describe("resolveCommissionRate", () => {
  it("يستخدم تجاوز البائع إن وُجد", () => {
    expect(resolveCommissionRate(0.1, 0.07)).toBe(0.07);
  });
  it("يستخدم نسبة المنصة عند غياب التجاوز", () => {
    expect(resolveCommissionRate(0.1, null)).toBe(0.1);
    expect(resolveCommissionRate(0.1, undefined)).toBe(0.1);
  });
});
