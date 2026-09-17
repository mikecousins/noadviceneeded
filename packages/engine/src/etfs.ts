import type { Country } from "./accounts.js";

/**
 * All-in-one (asset allocation) ETFs offered on the ETF page. Canadian ones
 * trade on the TSX in CAD, US ones on NYSE Arca in USD. Equity share is the
 * fund's stated target. The ticker is in SnapTrade's Yahoo-style form so a
 * symbol search matches.
 */
export interface AllInOneEtf {
  ticker: string;
  name: string;
  provider: "Vanguard" | "iShares" | "BMO";
  equityPercent: number;
  country: Country;
}

export const ALL_IN_ONE_ETFS: readonly AllInOneEtf[] = [
  {
    ticker: "VEQT.TO",
    name: "Vanguard All-Equity ETF Portfolio",
    provider: "Vanguard",
    equityPercent: 100,
    country: "ca",
  },
  {
    ticker: "VGRO.TO",
    name: "Vanguard Growth ETF Portfolio",
    provider: "Vanguard",
    equityPercent: 80,
    country: "ca",
  },
  {
    ticker: "VBAL.TO",
    name: "Vanguard Balanced ETF Portfolio",
    provider: "Vanguard",
    equityPercent: 60,
    country: "ca",
  },
  {
    ticker: "VCNS.TO",
    name: "Vanguard Conservative ETF Portfolio",
    provider: "Vanguard",
    equityPercent: 40,
    country: "ca",
  },
  {
    ticker: "VCIP.TO",
    name: "Vanguard Conservative Income ETF Portfolio",
    provider: "Vanguard",
    equityPercent: 20,
    country: "ca",
  },
  {
    ticker: "XEQT.TO",
    name: "iShares Core Equity ETF Portfolio",
    provider: "iShares",
    equityPercent: 100,
    country: "ca",
  },
  {
    ticker: "XGRO.TO",
    name: "iShares Core Growth ETF Portfolio",
    provider: "iShares",
    equityPercent: 80,
    country: "ca",
  },
  {
    ticker: "XBAL.TO",
    name: "iShares Core Balanced ETF Portfolio",
    provider: "iShares",
    equityPercent: 60,
    country: "ca",
  },
  {
    ticker: "XCNS.TO",
    name: "iShares Core Conservative Balanced ETF Portfolio",
    provider: "iShares",
    equityPercent: 40,
    country: "ca",
  },
  {
    ticker: "XINC.TO",
    name: "iShares Core Income Balanced ETF Portfolio",
    provider: "iShares",
    equityPercent: 20,
    country: "ca",
  },
  {
    ticker: "ZEQT.TO",
    name: "BMO All-Equity ETF",
    provider: "BMO",
    equityPercent: 100,
    country: "ca",
  },
  { ticker: "ZGRO.TO", name: "BMO Growth ETF", provider: "BMO", equityPercent: 80, country: "ca" },
  {
    ticker: "ZBAL.TO",
    name: "BMO Balanced ETF",
    provider: "BMO",
    equityPercent: 60,
    country: "ca",
  },
  {
    ticker: "ZCON.TO",
    name: "BMO Conservative ETF",
    provider: "BMO",
    equityPercent: 40,
    country: "ca",
  },
  {
    ticker: "VT",
    name: "Vanguard Total World Stock ETF",
    provider: "Vanguard",
    equityPercent: 100,
    country: "us",
  },
  {
    ticker: "AOA",
    name: "iShares Core Aggressive Allocation ETF",
    provider: "iShares",
    equityPercent: 80,
    country: "us",
  },
  {
    ticker: "AOR",
    name: "iShares Core Growth Allocation ETF",
    provider: "iShares",
    equityPercent: 60,
    country: "us",
  },
  {
    ticker: "AOM",
    name: "iShares Core Moderate Allocation ETF",
    provider: "iShares",
    equityPercent: 40,
    country: "us",
  },
  {
    ticker: "AOK",
    name: "iShares Core Conservative Allocation ETF",
    provider: "iShares",
    equityPercent: 30,
    country: "us",
  },
];

/** The curated list for one country, in the order the ETF page shows it. */
export function allInOneEtfs(country: Country): readonly AllInOneEtf[] {
  return ALL_IN_ONE_ETFS.filter((e) => e.country === country);
}

export function findAllInOne(ticker: string, country?: Country): AllInOneEtf | undefined {
  const t = ticker.toUpperCase();
  const pool = country ? allInOneEtfs(country) : ALL_IN_ONE_ETFS;
  return pool.find((e) => e.ticker === t || e.ticker === `${t}.TO`);
}
