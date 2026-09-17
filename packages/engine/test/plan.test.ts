import { describe, expect, it } from "vitest";

import {
  planBuys,
  planSells,
  sellableCents,
  sellableUnits,
  type PlanAccount,
} from "../src/index.js";

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
      {
        accountId: "tfsa",
        units: 24,
        notionalCents: null,
        estimatedCostCents: 98_880,
        cashAfterCents: 1_120,
      },
      {
        accountId: "rrsp",
        units: 6,
        notionalCents: null,
        estimatedCostCents: 24_720,
        cashAfterCents: 280,
      },
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

  it("sends all the cash as a dollar amount where the brokerage fills fractions", () => {
    const plan = planBuys(
      [
        account({ id: "ws", fractional: true, cashCents: 4_000, contributionRank: 1 }),
        account({ id: "qt", fractional: false, cashCents: 4_000, contributionRank: 2 }),
      ],
      { priceCents: 4_120 },
    );
    // Nothing held back: the brokerage turns $40.00 into units at the fill. 40.00 / 41.20 ≈ 0.9709
    expect(plan.legs).toEqual([
      {
        accountId: "ws",
        units: 0.9709,
        notionalCents: 4_000,
        estimatedCostCents: 4_000,
        cashAfterCents: 0,
      },
    ]);
    expect(plan.skipped).toEqual([{ accountId: "qt", reason: "below_one_unit" }]);
    expect(plan.totalUnits).toBeCloseTo(0.9709, 6);
    expect(plan.totalCostCents).toBe(4_000);
  });

  it("buys with a single cent in a fractional account", () => {
    const plan = planBuys(
      [
        account({ id: "penny", fractional: true, cashCents: 1 }),
        account({ id: "whole", fractional: false, cashCents: 1 }),
      ],
      { priceCents: 4_120 },
    );
    expect(plan.legs).toEqual([
      {
        accountId: "penny",
        units: 0.0002,
        notionalCents: 1,
        estimatedCostCents: 1,
        cashAfterCents: 0,
      },
    ]);
    expect(plan.skipped).toEqual([{ accountId: "whole", reason: "below_one_unit" }]);
    expect(plan.totalCashCents).toBe(2);
  });

  it("totals whole units and dollar-amount estimates without float noise", () => {
    const plan = planBuys(
      [
        account({ id: "ws", fractional: true, cashCents: 1_234_567, contributionRank: 1 }),
        account({ id: "qt", cashCents: 10_000, contributionRank: 2 }),
      ],
      { priceCents: 3_333, bufferBps: 0 },
    );
    // 12345.67 / 33.33 ≈ 370.4071; 100.00 / 33.33 -> 3 units
    expect(plan.legs.map((l) => l.units)).toEqual([370.4071, 3]);
    expect(plan.totalUnits).toBe(373.4071);
    expect(plan.totalCostCents).toBe(1_234_567 + 9_999);
  });

  it("rejects a non-positive price", () => {
    expect(() => planBuys([], { priceCents: 0 })).toThrow(RangeError);
  });
});

describe("sellableUnits", () => {
  it("is the whole part for whole-unit accounts and everything for fractional ones", () => {
    expect(sellableUnits({ positionUnits: 12.34567, fractional: false })).toBe(12);
    expect(sellableUnits({ positionUnits: 12.34567, fractional: true })).toBe(12.34567);
    expect(sellableUnits({ positionUnits: 0.4, fractional: false })).toBe(0);
    expect(sellableUnits({ positionUnits: 0.4, fractional: true })).toBe(0.4);
  });
});

describe("sellableCents", () => {
  it("values whole units, or the whole position for a fractional account", () => {
    expect(sellableCents({ positionUnits: 12.34567, fractional: false }, 4_120)).toBe(49_440);
    // 12.34567 * 41.20 = 508.64 (floored to the cent)
    expect(sellableCents({ positionUnits: 12.34567, fractional: true }, 4_120)).toBe(50_864);
    expect(sellableCents({ positionUnits: 0.4, fractional: false }, 100)).toBe(0);
    expect(sellableCents({ positionUnits: 0.4, fractional: true }, 100)).toBe(40);
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
      {
        accountId: "nonreg",
        units: 8,
        notionalCents: null,
        estimatedProceedsCents: 32_960,
        unitsAfter: 2,
      },
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
      {
        accountId: "nonreg",
        units: 10,
        notionalCents: null,
        estimatedProceedsCents: 41_200,
        unitsAfter: 0,
      },
      {
        accountId: "tfsa",
        units: 39,
        notionalCents: null,
        estimatedProceedsCents: 160_680,
        unitsAfter: 11.5,
      },
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

  it("sells the exact remaining dollars from a fractional account and can empty it", () => {
    const plan = planSells(
      [
        account({ id: "ws", fractional: true, positionUnits: 10.123456, withdrawalRank: 1 }),
        account({ id: "qt", fractional: false, positionUnits: 5.5, withdrawalRank: 2 }),
      ],
      { amountCents: 30_000, priceCents: 4_120 },
    );
    // $300.00 to the cent; 300.00 / 41.20 ≈ 7.2816 units
    expect(plan.legs).toEqual([
      {
        accountId: "ws",
        units: 7.2816,
        notionalCents: 30_000,
        estimatedProceedsCents: 30_000,
        unitsAfter: 2.841856,
      },
    ]);
    expect(plan.shortfallCents).toBe(0);

    const all = planSells([account({ id: "ws", fractional: true, positionUnits: 10.123456 })], {
      amountCents: 1_000_000,
      priceCents: 4_120,
    });
    // The whole position's value: 10.123456 * 41.20 = 417.08 (floored to the cent)
    expect(all.legs).toEqual([
      {
        accountId: "ws",
        units: 10.123456,
        notionalCents: 41_708,
        estimatedProceedsCents: 41_708,
        unitsAfter: 0,
      },
    ]);
    expect(all.shortfallCents).toBe(1_000_000 - 41_708);
  });

  it("spills from a fractional account into a whole-unit one, rounding up only there", () => {
    const plan = planSells(
      [
        account({ id: "ws", fractional: true, positionUnits: 2, withdrawalRank: 1 }),
        account({ id: "qt", positionUnits: 10, withdrawalRank: 2 }),
      ],
      { amountCents: 30_000, priceCents: 4_120 },
    );
    // ws: all $82.40; remaining 217.60 / 41.20 = 5.28 -> 6 units from qt
    expect(plan.legs).toEqual([
      {
        accountId: "ws",
        units: 2,
        notionalCents: 8_240,
        estimatedProceedsCents: 8_240,
        unitsAfter: 0,
      },
      {
        accountId: "qt",
        units: 6,
        notionalCents: null,
        estimatedProceedsCents: 24_720,
        unitsAfter: 4,
      },
    ]);
    expect(plan.totalUnits).toBe(8);
    expect(plan.shortfallCents).toBe(0);
  });

  it("treats a small fractional position as sellable", () => {
    const plan = planSells([account({ id: "ws", fractional: true, positionUnits: 0.4 })], {
      amountCents: 1_000,
      priceCents: 100,
    });
    expect(plan.legs).toEqual([
      { accountId: "ws", units: 0.4, notionalCents: 40, estimatedProceedsCents: 40, unitsAfter: 0 },
    ]);
    expect(plan.shortfallCents).toBe(960);
  });

  it("rejects a non-positive amount", () => {
    expect(() => planSells(accounts, { amountCents: 0, priceCents: 100 })).toThrow(RangeError);
  });
});
