import { marketSession, type Country, type MarketSession } from "@noadviceneeded/engine";

/** `marketSession` with the dates as ISO strings, so it survives the loader. */
export interface MarketView {
  exchange: MarketSession["exchange"];
  open: boolean;
  reason: MarketSession["reason"];
  holiday: string | null;
  nextOpen: string;
}

export function marketView(country: Country, now = new Date()): MarketView {
  const s = marketSession(country, now);
  return {
    exchange: s.exchange,
    open: s.open,
    reason: s.reason,
    holiday: s.holiday,
    nextOpen: s.nextOpen.toISOString(),
  };
}

const EXCHANGE_NAMES: Record<MarketView["exchange"], string> = {
  tsx: "The TSX",
  nyse: "The NYSE",
};

const eastern = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** One sentence on why orders are off and when they come back, in Eastern time. */
export function marketClosedCopy(market: MarketView): string {
  const when = `${eastern.format(new Date(market.nextOpen))} ET`;
  const name = EXCHANGE_NAMES[market.exchange];
  switch (market.reason) {
    case "holiday":
      return `${name} is closed for ${market.holiday}. Orders open again ${when}.`;
    case "weekend":
      return `${name} is closed for the weekend. Orders open again ${when}.`;
    case "before_open":
      return `${name} has not opened yet. Orders open ${when}.`;
    case "after_close":
      return `${name} has closed for the day. Orders open again ${when}.`;
    default:
      return `${name} is open.`;
  }
}
