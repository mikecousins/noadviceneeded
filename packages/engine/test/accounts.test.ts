import { describe, expect, it } from "vitest";

import {
  DEFAULT_CONTRIBUTION_ORDER,
  DEFAULT_WITHDRAWAL_ORDER,
  assignDefaultRanks,
  classifyAccountType,
  includedByDefault,
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
});

describe("defaults", () => {
  it("includes the four contribution-eligible types and nothing else", () => {
    expect(includedByDefault("fhsa")).toBe(true);
    expect(includedByDefault("tfsa")).toBe(true);
    expect(includedByDefault("rrsp")).toBe(true);
    expect(includedByDefault("non_registered")).toBe(true);
    expect(includedByDefault("resp")).toBe(false);
    expect(includedByDefault("other")).toBe(false);
  });

  it("orders contributions FHSA, TFSA, RRSP, non-registered and withdrawals the reverse of shelter", () => {
    expect(DEFAULT_CONTRIBUTION_ORDER.slice(0, 4)).toEqual([
      "fhsa",
      "tfsa",
      "rrsp",
      "non_registered",
    ]);
    expect(DEFAULT_WITHDRAWAL_ORDER.slice(0, 4)).toEqual([
      "non_registered",
      "tfsa",
      "fhsa",
      "rrsp",
    ]);
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
});
