import { describe, it, expect } from "vitest";
import { formatIQD, parseIQD } from "./currency";

describe("formatIQD", () => {
  it("ينسّق بفاصل آلاف ورمز", () => {
    const out = formatIQD(12500);
    expect(out).toContain("د.ع");
  });
  it("يدعم الأرقام اللاتينية", () => {
    expect(formatIQD(12500, { latinDigits: true })).toBe("12,500 د.ع");
  });
  it("يدعم بلا رمز", () => {
    expect(formatIQD(1000, { withSymbol: false, latinDigits: true })).toBe(
      "1,000",
    );
  });
  it("يقرّب الكسور", () => {
    expect(formatIQD(999.6, { latinDigits: true })).toBe("1,000 د.ع");
  });
});

describe("parseIQD", () => {
  it("يحلّل النص مع فواصل وأرقام عربية", () => {
    expect(parseIQD("12,500 د.ع")).toBe(12500);
    expect(parseIQD("١٢٥٠٠")).toBe(12500);
  });
});
