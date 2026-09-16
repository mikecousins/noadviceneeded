/**
 * Canadian all-in-one (asset allocation) ETFs offered on the ETF page. All
 * trade on the TSX in CAD. Equity share is the fund's stated target. The
 * ticker is in SnapTrade's Yahoo-style form so a symbol search matches.
 */
export interface AllInOneEtf {
  ticker: string;
  name: string;
  provider: "Vanguard" | "iShares" | "BMO";
  equityPercent: number;
}

export const ALL_IN_ONE_ETFS: readonly AllInOneEtf[] = [
  {
    ticker: "VEQT.TO",
    name: "Vanguard All-Equity ETF Portfolio",
    provider: "Vanguard",
    equityPercent: 100,
  },
  {
    ticker: "VGRO.TO",
    name: "Vanguard Growth ETF Portfolio",
    provider: "Vanguard",
    equityPercent: 80,
  },
  {
    ticker: "VBAL.TO",
    name: "Vanguard Balanced ETF Portfolio",
    provider: "Vanguard",
    equityPercent: 60,
  },
  {
    ticker: "VCNS.TO",
    name: "Vanguard Conservative ETF Portfolio",
    provider: "Vanguard",
    equityPercent: 40,
  },
  {
    ticker: "VCIP.TO",
    name: "Vanguard Conservative Income ETF Portfolio",
    provider: "Vanguard",
    equityPercent: 20,
  },
  {
    ticker: "XEQT.TO",
    name: "iShares Core Equity ETF Portfolio",
    provider: "iShares",
    equityPercent: 100,
  },
  {
    ticker: "XGRO.TO",
    name: "iShares Core Growth ETF Portfolio",
    provider: "iShares",
    equityPercent: 80,
  },
  {
    ticker: "XBAL.TO",
    name: "iShares Core Balanced ETF Portfolio",
    provider: "iShares",
    equityPercent: 60,
  },
  {
    ticker: "XCNS.TO",
    name: "iShares Core Conservative Balanced ETF Portfolio",
    provider: "iShares",
    equityPercent: 40,
  },
  {
    ticker: "XINC.TO",
    name: "iShares Core Income Balanced ETF Portfolio",
    provider: "iShares",
    equityPercent: 20,
  },
  { ticker: "ZEQT.TO", name: "BMO All-Equity ETF", provider: "BMO", equityPercent: 100 },
  { ticker: "ZGRO.TO", name: "BMO Growth ETF", provider: "BMO", equityPercent: 80 },
  { ticker: "ZBAL.TO", name: "BMO Balanced ETF", provider: "BMO", equityPercent: 60 },
  { ticker: "ZCON.TO", name: "BMO Conservative ETF", provider: "BMO", equityPercent: 40 },
];

export function findAllInOne(ticker: string): AllInOneEtf | undefined {
  const t = ticker.toUpperCase();
  return ALL_IN_ONE_ETFS.find((e) => e.ticker === t || e.ticker === `${t}.TO`);
}
