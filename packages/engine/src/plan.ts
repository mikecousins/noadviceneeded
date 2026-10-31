import type { AccountType } from "./accounts.js";

/** What the planner needs to know about one account. Cash is in the ETF's currency. */
export interface PlanAccount {
  id: string;
  name: string;
  accountType: AccountType;
  /** The user's choice on the Accounts page. */
  included: boolean;
  /** The connection can place orders and the token carries `trade`. */
  canTrade: boolean;
  /**
   * The user's choice on the Accounts page: this brokerage fills fractional
   * units of the ETF (Wealthsimple does for many). Plans then size legs as a
   * dollar amount (`notionalCents`) and let the brokerage work out the units,
   * instead of stopping at the last whole unit.
   */
  fractional: boolean;
  /** Settled cash available to buy with, or null when SnapTrade sent none. */
  cashCents: number | null;
  /** Units of the target ETF already held here. */
  positionUnits: number;
  contributionRank: number;
  withdrawalRank: number;
}

/** Estimated units a dollar amount buys, for display only; the brokerage decides the real figure. */
export function estimateUnits(cents: number, priceCents: number): number {
  return Math.round((cents / priceCents) * 1e4) / 1e4;
}

/**
 * How far past the touch a limit order may fill, in basis points: 0.5%. A
 * buy pays at most the ask plus this, a sell takes at least the bid less
 * this. Wide enough that an order fills at once in a normal market, narrow
 * enough that a large order cannot walk the book into a bad price (D-022).
 */
export const DEFAULT_COLLAR_BPS = 50;

/** Highest price a buy may pay: the ask, or the plan price without one, plus the collar, rounded up to the cent. */
export function buyLimitCents(
  priceCents: number,
  askCents: number | null = null,
  collarBps = DEFAULT_COLLAR_BPS,
): number {
  const touch = askCents && askCents > 0 ? askCents : priceCents;
  return Math.ceil((touch * (10_000 + collarBps)) / 10_000);
}

/** Lowest price a sell may take: the bid, or the plan price without one, less the collar, rounded down to the cent. */
export function sellLimitCents(
  priceCents: number,
  bidCents: number | null = null,
  collarBps = DEFAULT_COLLAR_BPS,
): number {
  const touch = bidCents && bidCents > 0 ? bidCents : priceCents;
  return Math.max(1, Math.floor((touch * (10_000 - collarBps)) / 10_000));
}

/** Units of a position the plan may sell: whole units, or all of it for a fractional account. */
export function sellableUnits(account: Pick<PlanAccount, "positionUnits" | "fractional">): number {
  return account.fractional ? account.positionUnits : Math.floor(account.positionUnits);
}

/**
 * Most cents a sell from this account can raise at `priceCents`: its whole
 * units, or the whole position's value for a fractional account, which sells
 * by dollar amount.
 */
export function sellableCents(
  account: Pick<PlanAccount, "positionUnits" | "fractional">,
  priceCents: number,
): number {
  return Math.floor(sellableUnits(account) * priceCents);
}

export type BuySkipReason = "excluded" | "not_tradable" | "no_cash" | "below_one_unit";

/**
 * How a leg reaches the brokerage: whole units as a limit order at the plan's
 * limit price, and on a fractional account the dollars left under one unit
 * as a market order, since dollar amounts cannot carry a limit (D-022).
 */
export interface LegOrders {
  /** Whole units sent as a limit order; 0 when the leg is too small for one. */
  limitUnits: number;
  /** Dollars sent as a market order by amount; null when there are none. */
  marketCents: number | null;
}

export interface BuyLeg extends LegOrders {
  accountId: string;
  /** Whole units, or the estimate at the plan price when the leg is sized in dollars. */
  units: number;
  /** The dollars the leg commits on a fractional account, or null when it is sized in whole units. */
  notionalCents: number | null;
  estimatedCostCents: number;
  cashAfterCents: number;
}

export interface BuyPlan {
  priceCents: number;
  /** Most any unit in the plan may cost. */
  limitPriceCents: number;
  legs: BuyLeg[];
  skipped: { accountId: string; reason: BuySkipReason }[];
  totalUnits: number;
  totalCostCents: number;
  /** Cash across included, tradable accounts before the plan. */
  totalCashCents: number;
}

export interface BuyOptions {
  /** Best known price per unit. */
  priceCents: number;
  /** The quote's ask, which the limit is set from when there is one. */
  askCents?: number | null;
  /** How far above the ask the limit sits. Default {@link DEFAULT_COLLAR_BPS}. */
  collarBps?: number;
}

/**
 * Turns the cash sitting in each included account into an order for the
 * target ETF: whole units at a limit price, sized so the account can pay the
 * limit on every unit, and where the user said the brokerage fills fractions,
 * the cash left under one unit as a dollar amount. Every account is bought
 * independently: cash cannot move between accounts, so there is nothing to
 * allocate, only leftovers to explain.
 */
export function planBuys(accounts: readonly PlanAccount[], options: BuyOptions): BuyPlan {
  const { priceCents } = options;
  if (!Number.isInteger(priceCents) || priceCents <= 0) {
    throw new RangeError("priceCents must be a positive integer");
  }
  const limitPriceCents = buyLimitCents(priceCents, options.askCents, options.collarBps);
  const legs: BuyLeg[] = [];
  const skipped: BuyPlan["skipped"] = [];
  let totalCashCents = 0;

  for (const a of [...accounts].sort((x, y) => x.contributionRank - y.contributionRank)) {
    if (!a.included) {
      skipped.push({ accountId: a.id, reason: "excluded" });
      continue;
    }
    if (!a.canTrade) {
      skipped.push({ accountId: a.id, reason: "not_tradable" });
      continue;
    }
    const cash = a.cashCents ?? 0;
    if (cash <= 0) {
      skipped.push({ accountId: a.id, reason: "no_cash" });
      continue;
    }
    totalCashCents += cash;

    // Whole units the account can pay the limit on, so no fill up to it is refused for funds.
    const limitUnits = Math.floor(cash / limitPriceCents);

    if (a.fractional) {
      // Every cent is committed: what the limit order cannot use goes by amount at market.
      const marketCents = cash - limitUnits * limitPriceCents;
      const estimatedCostCents = limitUnits * priceCents + marketCents;
      legs.push({
        accountId: a.id,
        units: limitUnits + estimateUnits(marketCents, priceCents),
        notionalCents: cash,
        estimatedCostCents,
        cashAfterCents: cash - estimatedCostCents,
        limitUnits,
        marketCents: marketCents > 0 ? marketCents : null,
      });
      continue;
    }

    if (limitUnits < 1) {
      skipped.push({ accountId: a.id, reason: "below_one_unit" });
      continue;
    }
    const estimatedCostCents = limitUnits * priceCents;
    legs.push({
      accountId: a.id,
      units: limitUnits,
      notionalCents: null,
      estimatedCostCents,
      cashAfterCents: cash - estimatedCostCents,
      limitUnits,
      marketCents: null,
    });
  }

  return {
    priceCents,
    limitPriceCents,
    legs,
    skipped,
    totalUnits: sumUnits(legs),
    totalCostCents: legs.reduce((n, l) => n + l.estimatedCostCents, 0),
    totalCashCents,
  };
}

/** Adds leg units at four places so whole units plus estimates never show float noise. */
function sumUnits(legs: readonly { units: number }[]): number {
  return legs.reduce((n, l) => n + Math.round(l.units * 1e4), 0) / 1e4;
}

export type SellSkipReason = "excluded" | "not_tradable" | "no_position" | "not_needed";

export interface SellLeg extends LegOrders {
  accountId: string;
  /** Whole units, or the estimate at the plan price when the leg is sized in dollars. */
  units: number;
  /** The dollar amount sent as the order, or null when the order is sized in whole units. */
  notionalCents: number | null;
  estimatedProceedsCents: number;
  /** Units left in the account; an estimate for dollar-sized legs. */
  unitsAfter: number;
}

export interface SellPlan {
  priceCents: number;
  /** Least any unit in the plan may sell for. */
  limitPriceCents: number;
  requestedCents: number;
  legs: SellLeg[];
  skipped: { accountId: string; reason: SellSkipReason }[];
  totalUnits: number;
  totalProceedsCents: number;
  /** How much of the request no account can cover. Zero when the plan is complete. */
  shortfallCents: number;
}

export interface SellOptions {
  amountCents: number;
  priceCents: number;
  /** The quote's bid, which the limit is set from when there is one. */
  bidCents?: number | null;
  /** How far below the bid the limit sits. Default {@link DEFAULT_COLLAR_BPS}. */
  collarBps?: number;
}

/**
 * Walks accounts in withdrawal order and sells until the requested amount is
 * covered. A whole-unit account rounds up so the user gets at least what they
 * asked for, possibly one unit more, and leaves any fraction it holds in
 * place. A fractional account sells the exact remaining dollars, up to its
 * whole position's value, so it lands the amount to the cent: the whole units
 * in it at the limit, the rest by amount at market. Legs are sized at the
 * plan price; the limit only bounds how far below it a fill may land.
 */
export function planSells(accounts: readonly PlanAccount[], options: SellOptions): SellPlan {
  const { amountCents, priceCents } = options;
  if (!Number.isInteger(priceCents) || priceCents <= 0) {
    throw new RangeError("priceCents must be a positive integer");
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new RangeError("amountCents must be a positive integer");
  }
  const limitPriceCents = sellLimitCents(priceCents, options.bidCents, options.collarBps);
  const legs: SellLeg[] = [];
  const skipped: SellPlan["skipped"] = [];
  let remaining = amountCents;

  for (const a of [...accounts].sort((x, y) => x.withdrawalRank - y.withdrawalRank)) {
    if (!a.included) {
      skipped.push({ accountId: a.id, reason: "excluded" });
      continue;
    }
    if (!a.canTrade) {
      skipped.push({ accountId: a.id, reason: "not_tradable" });
      continue;
    }
    const canRaise = sellableCents(a, priceCents);
    if (canRaise <= 0) {
      skipped.push({ accountId: a.id, reason: "no_position" });
      continue;
    }
    if (remaining <= 0) {
      skipped.push({ accountId: a.id, reason: "not_needed" });
      continue;
    }

    if (a.fractional) {
      const cents = Math.min(remaining, canRaise);
      // Selling the whole position: report it as such, not the cent-floored estimate.
      const all = cents === canRaise;
      const units = all ? a.positionUnits : estimateUnits(cents, priceCents);
      const limitUnits = Math.min(Math.floor(a.positionUnits), Math.floor(cents / priceCents));
      const marketCents = cents - limitUnits * priceCents;
      legs.push({
        accountId: a.id,
        units,
        notionalCents: cents,
        estimatedProceedsCents: cents,
        unitsAfter: all ? 0 : Math.round((a.positionUnits - units) * 1e6) / 1e6,
        limitUnits,
        marketCents: marketCents > 0 ? marketCents : null,
      });
      remaining -= cents;
      continue;
    }

    const units = Math.min(Math.floor(a.positionUnits), Math.ceil(remaining / priceCents));
    const estimatedProceedsCents = units * priceCents;
    legs.push({
      accountId: a.id,
      units,
      notionalCents: null,
      estimatedProceedsCents,
      unitsAfter: Math.round((a.positionUnits - units) * 1e6) / 1e6,
      limitUnits: units,
      marketCents: null,
    });
    remaining -= estimatedProceedsCents;
  }

  return {
    priceCents,
    limitPriceCents,
    requestedCents: amountCents,
    legs,
    skipped,
    totalUnits: sumUnits(legs),
    totalProceedsCents: legs.reduce((n, l) => n + l.estimatedProceedsCents, 0),
    shortfallCents: Math.max(0, remaining),
  };
}

/** One order the brokerage receives for a leg. */
export interface LegOrder {
  accountId: string;
  /** Whole units for a limit order, or the estimate for a dollar amount. */
  units: number;
  /** The dollar amount for a market order by amount; null for a limit order. */
  notionalCents: number | null;
  /** The limit price per unit; null for a market order. */
  limitCents: number | null;
  estimatedCents: number;
}

/** How many orders the brokerage receives for these legs. */
export function orderCount(legs: readonly LegOrders[]): number {
  return legs.reduce(
    (n, l) =>
      n + (l.limitUnits > 0 ? 1 : 0) + (l.marketCents !== null && l.marketCents > 0 ? 1 : 0),
    0,
  );
}

/** The orders a leg goes out as: its whole units at the limit, then any dollars at market. */
export function legOrders(
  leg: LegOrders & { accountId: string },
  plan: { priceCents: number; limitPriceCents: number },
): LegOrder[] {
  const out: LegOrder[] = [];
  if (leg.limitUnits > 0) {
    out.push({
      accountId: leg.accountId,
      units: leg.limitUnits,
      notionalCents: null,
      limitCents: plan.limitPriceCents,
      estimatedCents: leg.limitUnits * plan.priceCents,
    });
  }
  if (leg.marketCents !== null && leg.marketCents > 0) {
    out.push({
      accountId: leg.accountId,
      units: estimateUnits(leg.marketCents, plan.priceCents),
      notionalCents: leg.marketCents,
      limitCents: null,
      estimatedCents: leg.marketCents,
    });
  }
  return out;
}
