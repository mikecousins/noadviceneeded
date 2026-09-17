import { describe, expect, it } from "vitest";

import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPES_BY_COUNTRY,
  DEFAULT_ORDERS,
  ROOM_TYPES_BY_COUNTRY,
  assignDefaultRanks,
  classifyAccountType,
  includedByDefault,
  roomTypeFor,
} from "../src/index.js";

describe("classifyAccountType", () => {
  it("reads the brokerage's type string first", () => {
    expect(classifyAccountType("TFSA", "Retirement")).toBe("tfsa");
    expect(classifyAccountType("RRSP", "Fun money")).toBe("rrsp");
    expect(classifyAccountType("FHSA", "x")).toBe("fhsa");
    expect(classifyAccountType("RESP", "x")).toBe("resp");
    expect(classifyAccountType("Margin", "x")).toBe("non_registered");
    expect(classifyAccountType("NON_REGISTERED", "x")).toBe("non_registered");
    expect(classifyAccountType("CASH", "x")).toBe("non_registered");
  });

  it("falls back to the account name only when the brokerage sent no type", () => {
    expect(classifyAccountType(null, "My TFSA")).toBe("tfsa");
    expect(classifyAccountType("", "Spousal RRSP")).toBe("rrsp");
    expect(classifyAccountType(undefined, "Joint investment")).toBe("non_registered");
  });

  it("keeps locked-in and income accounts out of the plan", () => {
    expect(classifyAccountType("LIRA", "x")).toBe("other");
    expect(classifyAccountType("RRIF", "x")).toBe("other");
    expect(classifyAccountType("LIF", "x")).toBe("other");
    expect(classifyAccountType("Mystery", "x")).toBe("other");
  });

  it("understands French labels", () => {
    expect(classifyAccountType("CELI", "x")).toBe("tfsa");
    expect(classifyAccountType("REER", "x")).toBe("rrsp");
    expect(classifyAccountType("CELIAPP", "x")).toBe("fhsa");
    expect(classifyAccountType("REEE", "x")).toBe("resp");
  });

  it("reads US brokerage type strings for US users", () => {
    expect(classifyAccountType("ROTH_IRA", "x", "us")).toBe("roth_ira");
    expect(classifyAccountType("TRADITIONAL_IRA", "x", "us")).toBe("ira");
    expect(classifyAccountType("IRA", "x", "us")).toBe("ira");
    expect(classifyAccountType("ROLLOVER_IRA", "x", "us")).toBe("ira");
    expect(classifyAccountType("HSA", "x", "us")).toBe("hsa");
    expect(classifyAccountType("INDIVIDUAL", "x", "us")).toBe("taxable");
    expect(classifyAccountType("JOINT", "x", "us")).toBe("taxable");
    expect(classifyAccountType("Margin", "x", "us")).toBe("taxable");
    expect(classifyAccountType("529", "x", "us")).toBe("plan_529");
    expect(classifyAccountType(null, "Roth IRA", "us")).toBe("roth_ira");
  });

  it("keeps employer plans and inherited accounts out of the US plan", () => {
    expect(classifyAccountType("401K", "x", "us")).toBe("workplace");
    expect(classifyAccountType("ROTH_401K", "x", "us")).toBe("workplace");
    expect(classifyAccountType("403(b)", "x", "us")).toBe("workplace");
    expect(classifyAccountType("SEP_IRA", "x", "us")).toBe("workplace");
    expect(classifyAccountType("SIMPLE_IRA", "x", "us")).toBe("workplace");
    expect(classifyAccountType("INHERITED_IRA", "x", "us")).toBe("other");
    expect(classifyAccountType("UTMA", "x", "us")).toBe("other");
    expect(classifyAccountType("Mystery", "x", "us")).toBe("other");
  });

  it("never guesses a Canadian type for a US user or the reverse", () => {
    expect(classifyAccountType("TFSA", "x", "us")).toBe("other");
    expect(classifyAccountType("ROTH_IRA", "x", "ca")).toBe("other");
  });
});

describe("countries", () => {
  it("offers each country its own types, sharing only `other`", () => {
    const ca = new Set(ACCOUNT_TYPES_BY_COUNTRY.ca);
    const us = new Set(ACCOUNT_TYPES_BY_COUNTRY.us);
    expect([...ca].filter((t) => us.has(t))).toEqual(["other"]);
    expect(new Set([...ca, ...us])).toEqual(new Set(ACCOUNT_TYPES));
  });

  it("maps Traditional and Roth IRAs onto the one IRA limit", () => {
    expect(roomTypeFor("roth_ira")).toBe("ira");
    expect(roomTypeFor("ira")).toBe("ira");
    expect(roomTypeFor("hsa")).toBe("hsa");
    expect(roomTypeFor("tfsa")).toBe("tfsa");
    expect(roomTypeFor("taxable")).toBeNull();
    expect(roomTypeFor("non_registered")).toBeNull();
    expect(roomTypeFor("workplace")).toBeNull();
    expect(roomTypeFor("other")).toBeNull();
  });

  it("tracks room only for types the country offers", () => {
    for (const country of ["ca", "us"] as const) {
      const offered = new Set(ACCOUNT_TYPES_BY_COUNTRY[country]);
      for (const room of ROOM_TYPES_BY_COUNTRY[country]) expect(offered.has(room)).toBe(true);
    }
  });
});

describe("defaults", () => {
  it("includes the contribution-eligible types and nothing else", () => {
    expect(includedByDefault("fhsa")).toBe(true);
    expect(includedByDefault("tfsa")).toBe(true);
    expect(includedByDefault("rrsp")).toBe(true);
    expect(includedByDefault("non_registered")).toBe(true);
    expect(includedByDefault("resp")).toBe(false);
    expect(includedByDefault("other")).toBe(false);
    expect(includedByDefault("hsa")).toBe(true);
    expect(includedByDefault("roth_ira")).toBe(true);
    expect(includedByDefault("ira")).toBe(true);
    expect(includedByDefault("taxable")).toBe(true);
    expect(includedByDefault("workplace")).toBe(false);
    expect(includedByDefault("plan_529")).toBe(false);
  });

  it("orders contributions FHSA, TFSA, RRSP, non-registered and withdrawals the reverse of shelter", () => {
    expect(DEFAULT_ORDERS.ca.contribution.slice(0, 4)).toEqual([
      "fhsa",
      "tfsa",
      "rrsp",
      "non_registered",
    ]);
    expect(DEFAULT_ORDERS.ca.withdrawal.slice(0, 4)).toEqual([
      "non_registered",
      "tfsa",
      "fhsa",
      "rrsp",
    ]);
  });

  it("orders US contributions HSA, Roth, Traditional, taxable and withdrawals taxable first, IRA last", () => {
    expect(DEFAULT_ORDERS.us.contribution.slice(0, 4)).toEqual([
      "hsa",
      "roth_ira",
      "ira",
      "taxable",
    ]);
    expect(DEFAULT_ORDERS.us.withdrawal.slice(0, 4)).toEqual(["taxable", "roth_ira", "hsa", "ira"]);
  });

  it("lists every type of a country in both of its orders", () => {
    for (const country of ["ca", "us"] as const) {
      const types = [...ACCOUNT_TYPES_BY_COUNTRY[country]].sort();
      expect([...DEFAULT_ORDERS[country].contribution].sort()).toEqual(types);
      expect([...DEFAULT_ORDERS[country].withdrawal].sort()).toEqual(types);
    }
  });

  it("assigns stable 1-based ranks for both orders", () => {
    const ranks = assignDefaultRanks([
      { id: "r", name: "RRSP", accountType: "rrsp" },
      { id: "n", name: "Margin", accountType: "non_registered" },
      { id: "t2", name: "TFSA B", accountType: "tfsa" },
      { id: "t1", name: "TFSA A", accountType: "tfsa" },
    ]);
    expect(ranks.get("t1")).toEqual({ contributionRank: 1, withdrawalRank: 2 });
    expect(ranks.get("t2")).toEqual({ contributionRank: 2, withdrawalRank: 3 });
    expect(ranks.get("r")).toEqual({ contributionRank: 3, withdrawalRank: 4 });
    expect(ranks.get("n")).toEqual({ contributionRank: 4, withdrawalRank: 1 });
  });

  it("ranks US accounts by the US orders", () => {
    const ranks = assignDefaultRanks(
      [
        { id: "t", name: "Individual", accountType: "taxable" },
        { id: "i", name: "Rollover IRA", accountType: "ira" },
        { id: "r", name: "Roth IRA", accountType: "roth_ira" },
        { id: "h", name: "HSA", accountType: "hsa" },
      ],
      "us",
    );
    expect(ranks.get("h")).toEqual({ contributionRank: 1, withdrawalRank: 3 });
    expect(ranks.get("r")).toEqual({ contributionRank: 2, withdrawalRank: 2 });
    expect(ranks.get("i")).toEqual({ contributionRank: 3, withdrawalRank: 4 });
    expect(ranks.get("t")).toEqual({ contributionRank: 4, withdrawalRank: 1 });
  });
});
