import { describe, expect, it } from "vitest";

import { ALL_IN_ONE_ETFS, allInOneEtfs, findAllInOne } from "../src/index.js";

describe("ALL_IN_ONE_ETFS", () => {
  it("lists each ticker once, TSX-suffixed for Canada and bare for the US", () => {
    const tickers = ALL_IN_ONE_ETFS.map((e) => e.ticker);
    expect(new Set(tickers).size).toBe(tickers.length);
    for (const e of allInOneEtfs("ca")) expect(e.ticker).toMatch(/^[A-Z]{4}\.TO$/);
    for (const e of allInOneEtfs("us")) expect(e.ticker).toMatch(/^[A-Z]{2,4}$/);
    expect(allInOneEtfs("ca").length + allInOneEtfs("us").length).toBe(tickers.length);
  });

  it("finds by bare or suffixed ticker, case-insensitively", () => {
    expect(findAllInOne("veqt")?.name).toBe("Vanguard All-Equity ETF Portfolio");
    expect(findAllInOne("XEQT.TO")?.equityPercent).toBe(100);
    expect(findAllInOne("aoa")?.equityPercent).toBe(80);
    expect(findAllInOne("SPY")).toBeUndefined();
  });

  it("stays within the country's list when asked", () => {
    expect(findAllInOne("VEQT", "us")).toBeUndefined();
    expect(findAllInOne("AOR", "ca")).toBeUndefined();
    expect(findAllInOne("AOR", "us")?.provider).toBe("iShares");
  });
});
