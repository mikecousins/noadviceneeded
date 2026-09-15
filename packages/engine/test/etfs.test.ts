import { describe, expect, it } from "vitest";

import { ALL_IN_ONE_ETFS, findAllInOne } from "../src/index.js";

describe("ALL_IN_ONE_ETFS", () => {
  it("lists TSX tickers only, each once", () => {
    const tickers = ALL_IN_ONE_ETFS.map((e) => e.ticker);
    expect(new Set(tickers).size).toBe(tickers.length);
    for (const t of tickers) expect(t).toMatch(/^[A-Z]{4}\.TO$/);
  });

  it("finds by bare or suffixed ticker, case-insensitively", () => {
    expect(findAllInOne("veqt")?.name).toBe("Vanguard All-Equity ETF Portfolio");
    expect(findAllInOne("XEQT.TO")?.equityPercent).toBe(100);
    expect(findAllInOne("SPY")).toBeUndefined();
  });
});
