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

const DEFAULT_BUFFER_BPS = 100;

/** Cents held back so a market fill slightly above the plan price still clears. */
function afterBuffer(cents: number, bufferBps: number): number {
  return Math.floor((cents * (10_000 - bufferBps)) / 10_000);
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

export interface BuyLeg {
  accountId: string;
  /** Whole units, or the estimate at the plan price when the leg is sized in dollars. */
  units: number;
  /** The dollar amount sent as the order, or null when the order is sized in whole units. */
  notionalCents: number | null;
  estimatedCostCents: number;
  cashAfterCents: number;
}

export interface BuyPlan {
  priceCents: number;
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
  /**
   * Basis points of cash held back on whole-unit legs so a market fill
   * slightly above the quote is not rejected for insufficient funds. Default
   * 1%. Dollar-amount legs spend exactly what they say, so nothing is held back.
   */
  bufferBps?: number;
}

/**
 * Turns the cash sitting in each included account into an order for the
 * target ETF: whole units where the brokerage only fills those, or the cash
 * itself as a dollar amount where the user said the brokerage fills
 * fractions. Every account is bought independently: cash cannot move between
 * accounts, so there is nothing to allocate, only leftovers to explain.
 */
export function planBuys(accounts: readonly PlanAccount[], options: BuyOptions): BuyPlan {
  const { priceCents } = options;
  if (!Number.isInteger(priceCents) || priceCents <= 0) {
    throw new RangeError("priceCents must be a positive integer");
  }
  const bufferBps = options.bufferBps ?? DEFAULT_BUFFER_BPS;
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

    if (a.fractional) {
      // Every cent goes: the brokerage turns the amount into units at the fill.
      legs.push({
        accountId: a.id,
        units: estimateUnits(cash, priceCents),
        notionalCents: cash,
        estimatedCostCents: cash,
        cashAfterCents: 0,
      });
      continue;
    }

    const units = Math.floor(afterBuffer(cash, bufferBps) / priceCents);
    if (units < 1) {
      skipped.push({ accountId: a.id, reason: "below_one_unit" });
      continue;
    }
    const estimatedCostCents = units * priceCents;
    legs.push({
      accountId: a.id,
      units,
      notionalCents: null,
      estimatedCostCents,
      cashAfterCents: cash - estimatedCostCents,
    });
  }

  return {
    priceCents,
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

export interface SellLeg {
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
}

/**
 * Walks accounts in withdrawal order and sells until the requested amount is
 * covered. A whole-unit account rounds up so the user gets at least what they
 * asked for, possibly one unit more, and leaves any fraction it holds in
 * place. A fractional account sells the exact remaining dollars, up to its
 * whole position's value, so it lands the amount to the cent.
 */
export function planSells(accounts: readonly PlanAccount[], options: SellOptions): SellPlan {
  const { amountCents, priceCents } = options;
  if (!Number.isInteger(priceCents) || priceCents <= 0) {
    throw new RangeError("priceCents must be a positive integer");
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new RangeError("amountCents must be a positive integer");
  }
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
      legs.push({
        accountId: a.id,
        units,
        notionalCents: cents,
        estimatedProceedsCents: cents,
        unitsAfter: all ? 0 : Math.round((a.positionUnits - units) * 1e6) / 1e6,
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
    });
    remaining -= estimatedProceedsCents;
  }

  return {
    priceCents,
    requestedCents: amountCents,
    legs,
    skipped,
    totalUnits: sumUnits(legs),
    totalProceedsCents: legs.reduce((n, l) => n + l.estimatedProceedsCents, 0),
    shortfallCents: Math.max(0, remaining),
  };
}
