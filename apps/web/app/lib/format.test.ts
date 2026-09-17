import { describe, expect, it } from "vitest";

import { money, parseDollarsToCents, units } from "./format.js";

describe("format", () => {
  it("formats cents as CAD with US$ for USD", () => {
    expect(money(123_456)).toBe("$1,234.56");
    expect(money(123_456, { whole: true })).toBe("$1,235");
    expect(money(5_000, { currency: "USD" })).toBe("US$50");
    expect(money(null)).toBe("—");
  });

  it("shows a US user's dollars bare and Canadian ones prefixed", () => {
    expect(money(123_456, { home: "USD" })).toBe("$1,234.56");
    expect(money(123_456, { home: "USD", whole: true })).toBe("$1,235");
    expect(money(5_000, { home: "USD", currency: "CAD" })).toBe("C$50");
    expect(money(5_000, { home: "USD", currency: "USD" })).toBe("$50.00");
  });

  it("trims fractional units", () => {
    expect(units(12)).toBe("12");
    expect(units(12.5)).toBe("12.5");
    expect(units(0.123456)).toBe("0.1235");
  });

  it("parses typed dollar amounts to cents", () => {
    expect(parseDollarsToCents("1,234.56")).toBe(123_456);
    expect(parseDollarsToCents("$500")).toBe(50_000);
    expect(parseDollarsToCents("0")).toBeNull();
    expect(parseDollarsToCents("abc")).toBeNull();
    expect(parseDollarsToCents("1.234")).toBeNull();
    expect(parseDollarsToCents(null)).toBeNull();
  });
});
