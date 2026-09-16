import { toCents } from "@noadviceneeded/engine";
import type { SnapTradeClient } from "@noadviceneeded/snaptrade";

import type { PlanAccountRow } from "./portfolio.server.js";

export interface PriceLookup {
  priceCents: number;
  source: "manual" | "quote" | "holding";
  asOf: string | null;
}

/**
 * Best available price per unit of the target ETF, in this order: a price
 * the user typed, a brokerage quote (delayed, and disabled on some SnapTrade
 * plans), the last price SnapTrade reported on a position held in any
 * account. Null when none exists, in which case the page asks for one.
 */
export async function resolvePrice(
  client: SnapTradeClient | null,
  targetSymbolId: string,
  accounts: readonly PlanAccountRow[],
  options: { manualPriceCents?: number | null; now?: Date } = {},
): Promise<PriceLookup | null> {
  if (options.manualPriceCents && options.manualPriceCents > 0) {
    return { priceCents: options.manualPriceCents, source: "manual", asOf: null };
  }

  if (client) {
    const candidates = accounts.filter((a) => a.connectionStatus === "active");
    for (const a of candidates.slice(0, 2)) {
      try {
        const [quote] = await client.getQuotes(a.snaptradeAccountId, [targetSymbolId]);
        const last = quote?.last_trade_price;
        const mid =
          quote?.bid_price && quote?.ask_price ? (quote.bid_price + quote.ask_price) / 2 : null;
        const cents = toCents(last ?? mid);
        if (cents && cents > 0) {
          return {
            priceCents: cents,
            source: "quote",
            asOf: (options.now ?? new Date()).toISOString(),
          };
        }
      } catch {
        // Quotes are optional; fall through to the next source.
      }
    }
  }

  const held = accounts
    .filter((a) => a.holdingPriceCents && a.holdingPriceCents > 0)
    .sort((x, y) => (y.holdingPriceAsOf ?? "").localeCompare(x.holdingPriceAsOf ?? ""));
  const best = held[0];
  if (best?.holdingPriceCents) {
    return { priceCents: best.holdingPriceCents, source: "holding", asOf: best.holdingPriceAsOf };
  }
  return null;
}
