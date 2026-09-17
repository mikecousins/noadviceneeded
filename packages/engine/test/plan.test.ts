import { describe, expect, it } from "vitest";

import { planBuys, planSells, sellableUnits, type PlanAccount } from "../src/index.js";

function account(over: Partial<PlanAccount> & { id: string }): PlanAccount {
  return {
    name: over.id,
    accountType: "tfsa",
    included: true,
    canTrade: true,
    fractional: false,
    cashCents: 0,
    positionUnits: 0,
    contributionRank: 1,
    withdrawalRank: 1,
    ...over,
  };
}

describe("planBuys", () => {
  it("buys whole units in every included account with cash, holding back the buffer", () => {
    const plan = planBuys(
      [
        account({ id: "tfsa", cashCents: 100_000, contributionRank: 1 }),
        account({ id: "rrsp", cashCents: 25_000, contributionRank: 2 }),
      ],
      { priceCents: 4_120 },
    );
    // 1000.00 * 0.99 = 990.00 -> 24 units at 41.20 = 988.80
    expect(plan.legs).toEqual([
      { accountId: "tfsa", units: 24, estimatedCostCents: 98_880, cashAfterCents: 1_120 },
      { accountId: "rrsp", units: 6, estimatedCostCents: 24_720, cashAfterCents: 280 },
    ]);
    expect(plan.totalUnits).toBe(30);
    expect(plan.totalCostCents).toBe(123_600);
    expect(plan.totalCashCents).toBe(125_000);
    expect(plan.skipped).toEqual([]);
  });

  it("explains every account it skips", () => {
    const plan = planBuys(
      [
        account({ id: "out", included: false, cashCents: 50_000 }),
        account({ id: "readonly", canTrade: false, cashCents: 50_000 }),
        account({ id: "empty", cashCents: 0 }),
        account({ id: "unknown", cashCents: null }),
        account({ id: "small", cashCents: 4_000 }),
      ],
      { priceCents: 4_120 },
    );
    expect(plan.legs).toEqual([]);
    expect(plan.skipped).toEqual([
      { accountId: "out", reason: "excluded" },
      { accountId: "readonly", reason: "not_tradable" },
      { accountId: "empty", reason: "no_cash" },
      { accountId: "unknown", reason: "no_cash" },
      { accountId: "small", reason: "below_one_unit" },
    ]);
    // Skipped-for-size cash still counts as cash on hand.
    expect(plan.totalCashCents).toBe(4_000);
  });

  it("orders legs by contribution rank", () => {
    const plan = planBuys(
      [
        account({ id: "second", cashCents: 10_000, contributionRank: 2 }),
        account({ id: "first", cashCents: 10_000, contributionRank: 1 }),
      ],
      { priceCents: 1_000, bufferBps: 0 },
    );
    expect(plan.legs.map((l) => l.accountId)).toEqual(["first", "second"]);
    expect(plan.legs[0]?.units).toBe(10);
  });

  it("buys fractions to four places where the brokerage fills them", () => {
    const plan = planBuys(
      [
        account({ id: "ws", fractional: true, cashCents: 4_000, contributionRank: 1 }),
        account({ id: "qt", fractional: false, cashCents: 4_000, contributionRank: 2 }),
      ],
      { priceCents: 4_120 },
    );
    // 40.00 * 0.99 = 39.60 / 41.20 = 0.96116... -> 0.9611 units = 39.60 (rounded)
    expect(plan.legs).toEqual([
      { accountId: "ws", units: 0.9611, estimatedCostCents: 3_960, cashAfterCents: 40 },
    ]);
    expect(plan.skipped).toEqual([{ accountId: "qt", reason: "below_one_unit" }]);
    expect(plan.totalUnits).toBeCloseTo(0.9611, 6);
    expect(plan.totalCostCents).toBe(3_960);
  });

  it("keeps fractional legs above the brokerage's minimum order", () => {
    const plan = planBuys(
      [
        account({ id: "dust", fractional: true, cashCents: 90 }),
        account({ id: "enough", fractional: true, cashCents: 102 }),
      ],
      { priceCents: 4_120 },
    );
    // 0.90 * 0.99 = 0.89 -> below $1; 1.02 * 0.99 -> 1.00 / 41.20 = 0.0242 units = $1.00
    expect(plan.skipped).toEqual([{ accountId: "dust", reason: "below_minimum" }]);
    expect(plan.legs).toEqual([
      { accountId: "enough", units: 0.0242, estimatedCostCents: 100, cashAfterCents: 2 },
    ]);
  });

  it("sizes a large fractional leg without float drift", () => {
    const plan = planBuys([account({ id: "ws", fractional: true, cashCents: 1_234_567 })], {
      priceCents: 3_333,
      bufferBps: 0,
    });
    // 12345.67 / 33.33 = 370.4071... -> 370.4071 units = 12345.67 (rounded down at the 4th place)
    expect(plan.legs[0]?.units).toBe(370.4071);
    expect(plan.legs[0]?.estimatedCostCents).toBe(1_234_567);
    expect(plan.legs[0]?.cashAfterCents).toBe(0);
  });

  it("rejects a non-positive price", () => {
    expect(() => planBuys([], { priceCents: 0 })).toThrow(RangeError);
  });
});

describe("sellableUnits", () => {
  it("is the whole part for whole-unit accounts and four places for fractional ones", () => {
    expect(sellableUnits({ positionUnits: 12.34567, fractional: false })).toBe(12);
    expect(sellableUnits({ positionUnits: 12.34567, fractional: true })).toBe(12.3456);
    expect(sellableUnits({ positionUnits: 0.4, fractional: false })).toBe(0);
    expect(sellableUnits({ positionUnits: 0.4, fractional: true })).toBe(0.4);
  });
});

describe("planSells", () => {
  const accounts = [
    account({ id: "nonreg", accountType: "non_registered", positionUnits: 10, withdrawalRank: 1 }),
    account({ id: "tfsa", accountType: "tfsa", positionUnits: 50.5, withdrawalRank: 2 }),
    account({ id: "rrsp", accountType: "rrsp", positionUnits: 100, withdrawalRank: 3 }),
  ];

  it("sells from the first account until the amount is covered, rounding up", () => {
    const plan = planSells(accounts, { amountCents: 30_000, priceCents: 4_120 });
    // 300.00 / 41.20 = 7.28 -> 8 units from nonreg, 329.60
    expect(plan.legs).toEqual([
      { accountId: "nonreg", units: 8, estimatedProceedsCents: 32_960, unitsAfter: 2 },
    ]);
    expect(plan.shortfallCents).toBe(0);
    expect(plan.skipped).toEqual([
      { accountId: "tfsa", reason: "not_needed" },
      { accountId: "rrsp", reason: "not_needed" },
    ]);
  });

  it("spills into the next account in withdrawal order and leaves fractions alone", () => {
    const plan = planSells(accounts, { amountCents: 200_000, priceCents: 4_120 });
    // nonreg: all 10 = 412.00; remaining 1588.00 / 41.20 = 38.54 -> 39 from tfsa
    expect(plan.legs).toEqual([
      { accountId: "nonreg", units: 10, estimatedProceedsCents: 41_200, unitsAfter: 0 },
      { accountId: "tfsa", units: 39, estimatedProceedsCents: 160_680, unitsAfter: 11.5 },
    ]);
    expect(plan.totalProceedsCents).toBe(201_880);
    expect(plan.shortfallCents).toBe(0);
  });

  it("reports the shortfall when every account is exhausted", () => {
    const plan = planSells(accounts, { amountCents: 1_000_000, priceCents: 4_120 });
    expect(plan.legs.map((l) => l.units)).toEqual([10, 50, 100]);
    expect(plan.totalProceedsCents).toBe(659_200);
    expect(plan.shortfallCents).toBe(340_800);
  });

  it("skips excluded, read-only, and empty accounts with a reason", () => {
    const plan = planSells(
      [
        account({ id: "out", included: false, positionUnits: 10 }),
        account({ id: "ro", canTrade: false, positionUnits: 10 }),
        account({ id: "empty", positionUnits: 0.4 }),
      ],
      { amountCents: 1_000, priceCents: 100 },
    );
    expect(plan.legs).toEqual([]);
    expect(plan.skipped).toEqual([
      { accountId: "out", reason: "excluded" },
      { accountId: "ro", reason: "not_tradable" },
      { accountId: "empty", reason: "no_position" },
    ]);
    expect(plan.shortfallCents).toBe(1_000);
  });

  it("sells an exact fraction from a fractional account and can empty it", () => {
    const plan = planSells(
      [
        account({ id: "ws", fractional: true, positionUnits: 10.123456, withdrawalRank: 1 }),
        account({ id: "qt", fractional: false, positionUnits: 5.5, withdrawalRank: 2 }),
      ],
      { amountCents: 30_000, priceCents: 4_120 },
    );
    // 300.00 / 41.20 = 7.28155... -> 7.2816 units = 300.00
    expect(plan.legs).toEqual([
      { accountId: "ws", units: 7.2816, estimatedProceedsCents: 30_000, unitsAfter: 2.841856 },
    ]);
    expect(plan.shortfallCents).toBe(0);

    const all = planSells([account({ id: "ws", fractional: true, positionUnits: 10.123456 })], {
      amountCents: 1_000_000,
      priceCents: 4_120,
    });
    // Everything to four places; the sixth-place dust stays behind.
    expect(all.legs).toEqual([
      { accountId: "ws", units: 10.1234, estimatedProceedsCents: 41_708, unitsAfter: 0.000056 },
    ]);
    expect(all.shortfallCents).toBe(1_000_000 - 41_708);
  });

  it("treats a small fractional position as sellable", () => {
    const plan = planSells([account({ id: "ws", fractional: true, positionUnits: 0.4 })], {
      amountCents: 1_000,
      priceCents: 100,
    });
    expect(plan.legs).toEqual([
      { accountId: "ws", units: 0.4, estimatedProceedsCents: 40, unitsAfter: 0 },
    ]);
    expect(plan.shortfallCents).toBe(960);
  });

  it("rejects a non-positive amount", () => {
    expect(() => planSells(accounts, { amountCents: 0, priceCents: 100 })).toThrow(RangeError);
  });
});
