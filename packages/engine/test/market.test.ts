import { describe, expect, it } from "vitest";

import { marketSession, tradingDay } from "../src/index.js";

const at = (iso: string) => new Date(iso);

describe("marketSession", () => {
  it("is open on a weekday between 9:30 and 16:00 Eastern", () => {
    const s = marketSession("ca", at("2026-09-17T14:00:00Z")); // Thursday 10:00 EDT
    expect(s.open).toBe(true);
    expect(s.exchange).toBe("tsx");
    expect(s.reason).toBeNull();
    expect(s.closesAt?.toISOString()).toBe("2026-09-17T20:00:00.000Z");
  });

  it("closes at 16:00 and reopens the next weekday at 9:30", () => {
    const s = marketSession("ca", at("2026-09-17T20:00:00Z")); // Thursday 16:00 EDT
    expect(s.open).toBe(false);
    expect(s.reason).toBe("after_close");
    expect(s.nextOpen.toISOString()).toBe("2026-09-18T13:30:00.000Z");
  });

  it("is closed before the bell and names today's open", () => {
    const s = marketSession("us", at("2026-09-17T13:29:00Z")); // 09:29 EDT
    expect(s.reason).toBe("before_open");
    expect(s.nextOpen.toISOString()).toBe("2026-09-17T13:30:00.000Z");
    expect(marketSession("us", at("2026-09-17T13:30:00Z")).open).toBe(true);
  });

  it("is closed all weekend and reopens Monday", () => {
    const s = marketSession("ca", at("2026-09-19T15:00:00Z")); // Saturday
    expect(s.reason).toBe("weekend");
    expect(s.nextOpen.toISOString()).toBe("2026-09-21T13:30:00.000Z");
    expect(marketSession("us", at("2026-09-20T15:00:00Z")).reason).toBe("weekend");
  });

  it("keeps Eastern hours through standard time", () => {
    expect(marketSession("ca", at("2026-01-15T14:00:00Z")).reason).toBe("before_open"); // 09:00 EST
    const s = marketSession("ca", at("2026-01-15T14:30:00Z"));
    expect(s.open).toBe(true);
    expect(s.closesAt?.toISOString()).toBe("2026-01-15T21:00:00.000Z");
  });

  it("names the holiday and skips to the next trading day", () => {
    const s = marketSession("ca", at("2026-12-25T15:00:00Z")); // Friday
    expect(s.reason).toBe("holiday");
    expect(s.holiday).toBe("Christmas Day");
    // Boxing Day is Monday the 28th for the TSX.
    expect(s.nextOpen.toISOString()).toBe("2026-12-29T14:30:00.000Z");
  });

  it("honours NYSE early closes at 13:00", () => {
    const friday = "2025-11-28"; // day after US Thanksgiving
    expect(marketSession("us", at(`${friday}T17:30:00Z`)).open).toBe(true); // 12:30 EST
    expect(marketSession("us", at(`${friday}T18:00:00Z`)).reason).toBe("after_close");
    // The TSX trades a full day.
    expect(marketSession("ca", at(`${friday}T18:00:00Z`)).open).toBe(true);
  });
});

describe("tradingDay", () => {
  const tsx = (y: number, m: number, d: number) => tradingDay("tsx", y, m, d).holiday;
  const nyse = (y: number, m: number, d: number) => tradingDay("nyse", y, m, d).holiday;

  it("knows the TSX calendar for 2026", () => {
    expect(tsx(2026, 1, 1)).toBe("New Year's Day");
    expect(tsx(2026, 2, 16)).toBe("Family Day");
    expect(tsx(2026, 4, 3)).toBe("Good Friday");
    expect(tsx(2026, 5, 18)).toBe("Victoria Day");
    expect(tsx(2026, 7, 1)).toBe("Canada Day");
    expect(tsx(2026, 8, 3)).toBe("Civic Holiday");
    expect(tsx(2026, 9, 7)).toBe("Labour Day");
    expect(tsx(2026, 10, 12)).toBe("Thanksgiving");
    expect(tsx(2026, 12, 25)).toBe("Christmas Day");
    expect(tsx(2026, 12, 28)).toBe("Boxing Day");
    // Open days that are holidays elsewhere.
    expect(tsx(2026, 9, 30)).toBeNull(); // Truth and Reconciliation
    expect(tsx(2026, 11, 11)).toBeNull(); // Remembrance Day
    expect(tsx(2026, 11, 26)).toBeNull(); // US Thanksgiving
  });

  it("moves TSX weekend holidays to the Monday after", () => {
    expect(tsx(2022, 1, 3)).toBe("New Year's Day"); // Jan 1 was a Saturday
    expect(tsx(2023, 7, 3)).toBe("Canada Day"); // July 1 was a Saturday
    expect(tsx(2021, 12, 27)).toBe("Christmas Day");
    expect(tsx(2021, 12, 28)).toBe("Boxing Day");
    expect(tsx(2022, 12, 26)).toBe("Christmas Day");
    expect(tsx(2022, 12, 27)).toBe("Boxing Day");
    expect(tsx(2020, 12, 25)).toBe("Christmas Day");
    expect(tsx(2020, 12, 28)).toBe("Boxing Day");
  });

  it("knows the NYSE calendar for 2026", () => {
    expect(nyse(2026, 1, 1)).toBe("New Year's Day");
    expect(nyse(2026, 1, 19)).toBe("Martin Luther King Jr. Day");
    expect(nyse(2026, 2, 16)).toBe("Presidents' Day");
    expect(nyse(2026, 4, 3)).toBe("Good Friday");
    expect(nyse(2026, 5, 25)).toBe("Memorial Day");
    expect(nyse(2026, 6, 19)).toBe("Juneteenth");
    expect(nyse(2026, 7, 3)).toBe("Independence Day"); // the 4th is a Saturday
    expect(nyse(2026, 9, 7)).toBe("Labor Day");
    expect(nyse(2026, 11, 26)).toBe("Thanksgiving");
    expect(nyse(2026, 12, 25)).toBe("Christmas Day");
    expect(nyse(2026, 10, 12)).toBeNull(); // Columbus Day
    expect(nyse(2026, 12, 28)).toBeNull(); // no Boxing Day
  });

  it("applies NYSE weekend observance, with no Friday for a Saturday New Year", () => {
    expect(nyse(2021, 12, 31)).toBeNull();
    expect(nyse(2022, 1, 3)).toBeNull();
    expect(nyse(2023, 1, 2)).toBe("New Year's Day");
    expect(nyse(2022, 6, 20)).toBe("Juneteenth");
    expect(nyse(2021, 7, 5)).toBe("Independence Day");
    expect(nyse(2021, 12, 24)).toBe("Christmas Day");
  });

  it("marks NYSE early closes only when the eve is a weekday that is not itself a holiday", () => {
    expect(tradingDay("nyse", 2026, 11, 27).earlyClose).toBe(true);
    expect(tradingDay("nyse", 2026, 12, 24).earlyClose).toBe(true); // Thursday
    expect(tradingDay("nyse", 2025, 7, 3).earlyClose).toBe(true); // Thursday
    expect(tradingDay("nyse", 2026, 7, 3).earlyClose).toBe(false); // observed holiday
    expect(tradingDay("nyse", 2021, 12, 24).earlyClose).toBe(false); // observed holiday
    expect(tradingDay("tsx", 2026, 11, 27).earlyClose).toBe(false);
  });
});
