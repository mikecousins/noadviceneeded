import { describe, expect, it } from "vitest";

import {
  contributionsSince,
  remainingRoom,
  suggestDeposit,
  type PlanAccount,
} from "../src/index.js";

function account(over: Partial<PlanAccount> & { id: string }): PlanAccount {
  return {
    name: over.id,
    accountType: "tfsa",
    included: true,
    canTrade: true,
    cashCents: 0,
    positionUnits: 0,
    contributionRank: 1,
    withdrawalRank: 1,
    ...over,
  };
}

describe("room", () => {
  const activities = [
    { type: "CONTRIBUTION", amountCents: 100_000, tradeDate: "2026-03-01" },
    { type: "CONTRIBUTION", amountCents: 50_000, tradeDate: "2026-06-15T13:00:00Z" },
    { type: "WITHDRAWAL", amountCents: -20_000, tradeDate: "2026-07-01" },
    { type: "DIVIDEND", amountCents: 1_000, tradeDate: "2026-08-01" },
    { type: "contribution", amountCents: -25_000, tradeDate: "2026-09-01" },
  ];

  it("sums contributions strictly after the baseline day, ignoring sign and other types", () => {
    expect(contributionsSince("2026-01-01", activities)).toBe(175_000);
    expect(contributionsSince("2026-03-01", activities)).toBe(75_000);
    expect(contributionsSince("2026-12-31", activities)).toBe(0);
  });

  it("subtracts them from the baseline and can go negative", () => {
    expect(remainingRoom({ roomCents: 700_000, asOf: "2026-01-01" }, activities)).toBe(525_000);
    expect(remainingRoom({ roomCents: 100_000, asOf: "2026-01-01" }, activities)).toBe(-75_000);
  });
});

describe("suggestDeposit", () => {
  const accounts = [
    account({ id: "fhsa", accountType: "fhsa", contributionRank: 1 }),
    account({ id: "tfsa", accountType: "tfsa", contributionRank: 2 }),
    account({ id: "rrsp", accountType: "rrsp", contributionRank: 3 }),
    account({ id: "nonreg", accountType: "non_registered", contributionRank: 4 }),
  ];

  it("picks the first account in order whose type has room", () => {
    expect(suggestDeposit(accounts, { fhsa: 800_000, tfsa: 0 })).toEqual({
      accountId: "fhsa",
      accountType: "fhsa",
      roomCents: 800_000,
    });
    expect(suggestDeposit(accounts, { fhsa: 0, tfsa: 0, rrsp: 12_000 })).toEqual({
      accountId: "rrsp",
      accountType: "rrsp",
      roomCents: 12_000,
    });
  });

  it("still suggests a registered account whose room is unknown", () => {
    expect(suggestDeposit(accounts, { fhsa: 0 })).toEqual({
      accountId: "tfsa",
      accountType: "tfsa",
      roomCents: null,
    });
  });

  it("falls through to non-registered when every registered type is full", () => {
    expect(suggestDeposit(accounts, { fhsa: 0, tfsa: -5, rrsp: 0 })).toEqual({
      accountId: "nonreg",
      accountType: "non_registered",
      roomCents: null,
    });
  });

  it("skips excluded accounts and returns null when nothing qualifies", () => {
    expect(
      suggestDeposit(
        [account({ id: "x", included: false }), account({ id: "t", accountType: "tfsa" })],
        { tfsa: 0 },
      ),
    ).toBeNull();
  });
});
