import { describe, it, expect } from "vitest";
import {
  normalizeIraqiPhone,
  isValidIraqiPhone,
  formatIraqiPhoneLocal,
} from "./phone";

describe("normalizeIraqiPhone", () => {
  it("يقبل الصيغة المحلية 07XXXXXXXXX", () => {
    expect(normalizeIraqiPhone("07701234567")).toBe("+9647701234567");
  });
  it("يقبل صيغة E.164", () => {
    expect(normalizeIraqiPhone("+9647501234567")).toBe("+9647501234567");
  });
  it("يقبل صيغة 00964", () => {
    expect(normalizeIraqiPhone("009647801234567")).toBe("+9647801234567");
  });
  it("يقبل الأرقام العربية والمسافات", () => {
    expect(normalizeIraqiPhone("٠٧٧٠ ١٢٣ ٤٥٦٧")).toBe("+9647701234567");
  });
  it("يرفض الأرقام غير الصالحة", () => {
    expect(normalizeIraqiPhone("12345")).toBeNull();
    expect(normalizeIraqiPhone("06701234567")).toBeNull();
  });
});

describe("isValidIraqiPhone", () => {
  it("يميّز الصالح من غيره", () => {
    expect(isValidIraqiPhone("07901234567")).toBe(true);
    expect(isValidIraqiPhone("0790123")).toBe(false);
  });
});

describe("formatIraqiPhoneLocal", () => {
  it("يعرض صيغة محلية مقروءة", () => {
    expect(formatIraqiPhoneLocal("+9647701234567")).toBe("0770 123 4567");
  });
});
