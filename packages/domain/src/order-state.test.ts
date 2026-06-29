import { describe, it, expect } from "vitest";
import { canTransition, isTerminal, allowedTransitions, assertTransition, OrderTransitionError } from "./order-state";

describe("canTransition", () => {
  it("يسمح للبائع بتأكيد طلب معلّق", () => {
    expect(canTransition("PENDING", "CONFIRMED", "VENDOR").ok).toBe(true);
  });
  it("يمنع المشتري من تأكيد الطلب", () => {
    expect(canTransition("PENDING", "CONFIRMED", "CUSTOMER").ok).toBe(false);
  });
  it("يسمح للمشتري بإلغاء طلب معلّق", () => {
    expect(canTransition("PENDING", "CANCELLED", "CUSTOMER").ok).toBe(true);
  });
  it("يمنع الانتقال من حالة نهائية", () => {
    expect(canTransition("COMPLETED", "SHIPPED", "ADMIN").ok).toBe(false);
    expect(canTransition("CANCELLED", "CONFIRMED", "ADMIN").ok).toBe(false);
  });
  it("يمنع القفز عبر المراحل", () => {
    expect(canTransition("PENDING", "SHIPPED", "VENDOR").ok).toBe(false);
  });
  it("الأدمن يتجاوز قيود الدور لكن لا يتجاوز صحة الانتقال", () => {
    expect(canTransition("PENDING", "CONFIRMED", "ADMIN").ok).toBe(true);
    expect(canTransition("PENDING", "COMPLETED", "ADMIN").ok).toBe(false);
  });
  it("المسار الكامل حتى الإكمال", () => {
    expect(canTransition("CONFIRMED", "PREPARING", "VENDOR").ok).toBe(true);
    expect(canTransition("PREPARING", "SHIPPED", "VENDOR").ok).toBe(true);
    expect(canTransition("SHIPPED", "DELIVERED", "VENDOR").ok).toBe(true);
    expect(canTransition("DELIVERED", "COMPLETED", "CUSTOMER").ok).toBe(true);
  });
});

describe("isTerminal", () => {
  it("يميّز الحالات النهائية", () => {
    expect(isTerminal("COMPLETED")).toBe(true);
    expect(isTerminal("CANCELLED")).toBe(true);
    expect(isTerminal("RETURNED")).toBe(true);
    expect(isTerminal("PENDING")).toBe(false);
  });
});

describe("allowedTransitions", () => {
  it("يعيد الانتقالات الممكنة", () => {
    expect(allowedTransitions("PENDING").sort()).toEqual(["CANCELLED", "CONFIRMED"]);
    expect(allowedTransitions("COMPLETED")).toEqual([]);
  });
});

describe("assertTransition", () => {
  it("يرمي خطأً للانتقال غير المسموح", () => {
    expect(() => assertTransition("PENDING", "SHIPPED", "VENDOR")).toThrow(OrderTransitionError);
  });
});
