import { Notice } from "./ui";
import { marketClosedCopy, type MarketView } from "~/lib/market";

/** Shown on the Invest and Withdraw pages whenever orders cannot be placed. */
export function MarketNotice({
  market,
  className = "",
}: {
  market: MarketView;
  className?: string;
}) {
  if (market.open) return null;
  return (
    <Notice tone="warn" className={className}>
      {marketClosedCopy(market)}
    </Notice>
  );
}
