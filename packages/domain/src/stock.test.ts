import { describe, it, expect } from "vitest";
import { availableStock, canReserve, checkReservation, isReservationExpired, reservationExpiry } from "./stock";

describe("availableStock", () => {
  it("يطرح المحجوز", () => {
    expect(availableStock({ stock: 10, reservedStock: 3 })).toBe(7);
  });
  it("لا يعيد قيمة سالبة", () => {
    expect(availableStock({ stock: 2, reservedStock: 5 })).toBe(0);
  });
});

describe("canReserve / checkReservation", () => {
  it("يسمح ضمن المتاح", () => {
    expect(canReserve({ stock: 10, reservedStock: 3 }, 7)).toBe(true);
    expect(canReserve({ stock: 10, reservedStock: 3 }, 8)).toBe(false);
  });
  it("يرفض الكمية غير الصالحة", () => {
    expect(checkReservation({ stock: 10, reservedStock: 0 }, 0).ok).toBe(false);
  });
});

describe("reservation expiry", () => {
  it("ينشئ وقت انتهاء مستقبلي", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const exp = reservationExpiry(now, 1000);
    expect(exp.getTime()).toBe(now.getTime() + 1000);
  });
  it("يكتشف انتهاء الصلاحية", () => {
    const now = new Date("2026-01-01T00:10:00Z");
    expect(isReservationExpired(new Date("2026-01-01T00:00:00Z"), now)).toBe(true);
    expect(isReservationExpired(new Date("2026-01-01T00:20:00Z"), now)).toBe(false);
  });
});
