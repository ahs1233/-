import { describe, it, expect } from "vitest";
import { hasRole, assertRole, ForbiddenError } from "./rbac";

describe("hasRole", () => {
  it("الأدمن يصل لكل شيء", () => {
    expect(hasRole("ADMIN", "VENDOR")).toBe(true);
    expect(hasRole("ADMIN", "CUSTOMER")).toBe(true);
  });
  it("البائع يصل لصلاحيات البائع فقط", () => {
    expect(hasRole("VENDOR", "VENDOR")).toBe(true);
    expect(hasRole("VENDOR", "ADMIN")).toBe(false);
  });
  it("يدعم قائمة أدوار", () => {
    expect(hasRole("CUSTOMER", ["CUSTOMER", "VENDOR"])).toBe(true);
  });
});

describe("assertRole", () => {
  it("يرمي ForbiddenError عند عدم الصلاحية", () => {
    expect(() => assertRole("CUSTOMER", "ADMIN")).toThrow(ForbiddenError);
  });
});
