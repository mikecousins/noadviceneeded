import { describe, expect, it } from "vitest";

import {
  buyLimitCents,
  legOrders,
  orderCount,
  planBuys,
  planSells,
  sellableCents,
  sellLimitCents,
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

describe("limit prices", () => {
  it("sets a buy limit at the ask plus the collar, rounded up to the cent", () => {
    // 41.25 * 1.005 = 41.45625
    expect(buyLimitCents(4_120, 4_125)).toBe(4_146);
    expect(buyLimitCents(4_120, 4_125, 0)).toBe(4_125);
  });

  it("sets a sell limit at the bid less the collar, rounded down to the cent", () => {
    // 41.18 * 0.995 = 40.9741
    expect(sellLimitCents(4_120, 4_118)).toBe(4_097);
    expect(sellLimitCents(4_120, 4_118, 0)).toBe(4_118);
  });

  it("falls back to the plan price without a bid or ask", () => {
    expect(buyLimitCents(4_120, null)).toBe(4_141);
    expect(buyLimitCents(4_120, 0)).toBe(4_141);
    expect(sellLimitCents(4_120, null)).toBe(4_099);
  });

  it("never sets a sell limit below a cent", () => {
    expect(sellLimitCents(1)).toBe(1);
  });
});

describe("planBuys", () => {
  it("buys the whole units each account can pay the limit on", () => {
    const plan = planBuys(
      [
        account({ id: "tfsa", cashCents: 100_000, contributionRank: 1 }),
        account({ id: "rrsp", cashCents: 25_000, contributionRank: 2 }),
      ],
      { priceCents: 4_120 },
    );
    // Limit 41.20 * 1.005 -> 41.41; 1000.00 / 41.41 -> 24 units, expected at 41.20 = 988.80
    expect(plan.limitPriceCents).toBe(4_141);
    expect(plan.legs).toEqual([
      {
        accountId: "tfsa",
        units: 24,
        notionalCents: null,
        estimatedCostCents: 98_880,
        cashAfterCents: 1_120,
        limitUnits: 24,
        marketCents: null,
      },
      {
        accountId: "rrsp",
        units: 6,
        notionalCents: null,
        estimatedCostCents: 24_720,
        cashAfterCents: 280,
        limitUnits: 6,
        marketCents: null,
      },
    ]);
    expect(plan.totalUnits).toBe(30);
    expect(plan.totalCostCents).toBe(123_600);
    expect(plan.totalCashCents).toBe(125_000);
    expect(plan.skipped).toEqual([]);
  });

  it("sets the limit from the ask and sizes against it", () => {
    const plan = planBuys([account({ id: "tfsa", cashCents: 100_000 })], {
      priceCents: 4_120,
      askCents: 4_200,
    });
    // Limit 42.00 * 1.005 = 42.21; 1000.00 / 42.21 -> 23 units
    expect(plan.limitPriceCents).toBe(4_221);
    expect(plan.legs[0]).toMatchObject({ units: 23, limitUnits: 23, estimatedCostCents: 94_760 });
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
      { priceCents: 1_000, collarBps: 0 },
    );
    expect(plan.legs.map((l) => l.accountId)).toEqual(["first", "second"]);
    expect(plan.legs[0]?.units).toBe(10);
  });

  it("sends cash under one unit as a dollar amount where the brokerage fills fractions", () => {
    const plan = planBuys(
      [
        account({ id: "ws", fractional: true, cashCents: 4_000, contributionRank: 1 }),
        account({ id: "qt", fractional: false, cashCents: 4_000, contributionRank: 2 }),
      ],
      { priceCents: 4_120 },
    );
    // Under one unit at the limit, so all $40.00 goes by amount. 40.00 / 41.20 ≈ 0.9709
    expect(plan.legs).toEqual([
      {
        accountId: "ws",
        units: 0.9709,
        notionalCents: 4_000,
        estimatedCostCents: 4_000,
        cashAfterCents: 0,
        limitUnits: 0,
        marketCents: 4_000,
      },
    ]);
    expect(plan.skipped).toEqual([{ accountId: "qt", reason: "below_one_unit" }]);
    expect(plan.totalUnits).toBeCloseTo(0.9709, 6);
    expect(plan.totalCostCents).toBe(4_000);
  });

  it("splits a fractional leg into whole units at the limit and the rest by amount", () => {
    const plan = planBuys([account({ id: "ws", fractional: true, cashCents: 100_000 })], {
      priceCents: 4_120,
    });
    // 24 units at the 41.41 limit reserve 993.84; the other 6.16 goes at market.
    // Expected: 24 * 41.20 + 6.16 = 994.96, leaving 5.04 if the limit fills at the plan price.
    expect(plan.legs).toEqual([
      {
        accountId: "ws",
        units: 24.1495,
        notionalCents: 100_000,
        estimatedCostCents: 99_496,
        cashAfterCents: 504,
        limitUnits: 24,
        marketCents: 616,
      },
    ]);
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
        limitUnits: 0,
        marketCents: 1,
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
      { priceCents: 3_333, collarBps: 0 },
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
        limitUnits: 8,
        marketCents: null,
      },
    ]);
    expect(plan.shortfallCents).toBe(0);
    // 41.20 * 0.995 = 40.994
    expect(plan.limitPriceCents).toBe(4_099);
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
        limitUnits: 10,
        marketCents: null,
      },
      {
        accountId: "tfsa",
        units: 39,
        notionalCents: null,
        estimatedProceedsCents: 160_680,
        unitsAfter: 11.5,
        limitUnits: 39,
        marketCents: null,
      },
    ]);
    expect(plan.totalProceedsCents).toBe(201_880);
    expect(plan.shortfallCents).toBe(0);
  });

  it("sets the limit from the bid", () => {
    const plan = planSells(accounts, { amountCents: 30_000, priceCents: 4_120, bidCents: 4_100 });
    // 41.00 * 0.995 = 40.795; the legs are still sized at the plan price.
    expect(plan.limitPriceCents).toBe(4_079);
    expect(plan.legs[0]).toMatchObject({ units: 8, limitUnits: 8 });
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
    // $300.00 to the cent; 300.00 / 41.20 ≈ 7.2816 units: 7 at the limit, the last 11.60 at market
    expect(plan.legs).toEqual([
      {
        accountId: "ws",
        units: 7.2816,
        notionalCents: 30_000,
        estimatedProceedsCents: 30_000,
        unitsAfter: 2.841856,
        limitUnits: 7,
        marketCents: 1_160,
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
        limitUnits: 10,
        marketCents: 508,
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
        limitUnits: 2,
        marketCents: null,
      },
      {
        accountId: "qt",
        units: 6,
        notionalCents: null,
        estimatedProceedsCents: 24_720,
        unitsAfter: 4,
        limitUnits: 6,
        marketCents: null,
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
      {
        accountId: "ws",
        units: 0.4,
        notionalCents: 40,
        estimatedProceedsCents: 40,
        unitsAfter: 0,
        limitUnits: 0,
        marketCents: 40,
      },
    ]);
    expect(plan.shortfallCents).toBe(960);
  });

  it("rejects a non-positive amount", () => {
    expect(() => planSells(accounts, { amountCents: 0, priceCents: 100 })).toThrow(RangeError);
  });
});

describe("legOrders", () => {
  const plan = { priceCents: 4_120, limitPriceCents: 4_141 };

  it("sends whole units as one limit order", () => {
    expect(legOrders({ accountId: "a", limitUnits: 24, marketCents: null }, plan)).toEqual([
      { accountId: "a", units: 24, notionalCents: null, limitCents: 4_141, estimatedCents: 98_880 },
    ]);
  });

  it("follows the limit order with the dollars under one unit at market", () => {
    expect(legOrders({ accountId: "a", limitUnits: 24, marketCents: 616 }, plan)).toEqual([
      { accountId: "a", units: 24, notionalCents: null, limitCents: 4_141, estimatedCents: 98_880 },
      { accountId: "a", units: 0.1495, notionalCents: 616, limitCents: null, estimatedCents: 616 },
    ]);
  });

  it("counts the orders a set of legs goes out as", () => {
    expect(
      orderCount([
        { limitUnits: 24, marketCents: 616 },
        { limitUnits: 3, marketCents: null },
        { limitUnits: 0, marketCents: 40 },
      ]),
    ).toBe(4);
  });

  it("sends only the dollar amount when the leg is under one unit", () => {
    expect(legOrders({ accountId: "a", limitUnits: 0, marketCents: 4_000 }, plan)).toEqual([
      {
        accountId: "a",
        units: 0.9709,
        notionalCents: 4_000,
        limitCents: null,
        estimatedCents: 4_000,
      },
    ]);
  });
});
