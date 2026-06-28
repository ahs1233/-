import { describe, it, expect } from "vitest";
import { normalizeArabic, arabicDigitsToLatin, slugify, tokenize } from "./arabic";

describe("normalizeArabic", () => {
  it("يوحّد أشكال الألف", () => {
    expect(normalizeArabic("أحمد")).toBe(normalizeArabic("احمد"));
    expect(normalizeArabic("إيمان")).toBe(normalizeArabic("ايمان"));
    expect(normalizeArabic("آمنة")).toBe("امنه");
  });

  it("يزيل التشكيل", () => {
    expect(normalizeArabic("مُحَمَّد")).toBe("محمد");
  });

  it("يوحّد التاء المربوطة والألف المقصورة", () => {
    expect(normalizeArabic("عباية")).toBe("عبايه");
    expect(normalizeArabic("مصطفى")).toBe("مصطفي");
  });

  it("يحوّل الأرقام العربية", () => {
    expect(normalizeArabic("موديل ٢٠٢٤")).toBe("موديل 2024");
  });

  it("يقلّص المسافات", () => {
    expect(normalizeArabic("  دشداشة   رجالية  ")).toBe("دشداشه رجاليه");
  });
});

describe("arabicDigitsToLatin", () => {
  it("يحوّل الأرقام العربية والفارسية", () => {
    expect(arabicDigitsToLatin("١٢٣")).toBe("123");
    expect(arabicDigitsToLatin("۴۵۶")).toBe("456");
  });
});

describe("slugify", () => {
  it("يولّد slug صالحاً من العربية", () => {
    expect(slugify("عباية كم واسع")).toBe("عبايه-كم-واسع");
  });
});

describe("tokenize", () => {
  it("يقسّم النص المطبّع", () => {
    expect(tokenize("حذاء رياضي")).toEqual(["حذاء", "رياضي"]);
  });
});
