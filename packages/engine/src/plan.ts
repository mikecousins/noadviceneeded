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
  /** Settled cash available to buy with, or null when SnapTrade sent none. */
  cashCents: number | null;
  /** Units of the target ETF already held here. */
  positionUnits: number;
  contributionRank: number;
  withdrawalRank: number;
}

export type BuySkipReason = "excluded" | "not_tradable" | "no_cash" | "below_one_unit";

export interface BuyLeg {
  accountId: string;
  units: number;
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
   * Basis points of cash held back so a market fill slightly above the quote
   * is not rejected for insufficient funds. Default 1%.
   */
  bufferBps?: number;
}

/**
 * Turns the cash sitting in each included account into whole units of the
 * target ETF. Every account is bought independently: cash cannot move between
 * accounts, so there is nothing to allocate, only leftovers to explain.
 */
export function planBuys(accounts: readonly PlanAccount[], options: BuyOptions): BuyPlan {
  const { priceCents } = options;
  if (!Number.isInteger(priceCents) || priceCents <= 0) {
    throw new RangeError("priceCents must be a positive integer");
  }
  const bufferBps = options.bufferBps ?? 100;
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
    const spendable = Math.floor((cash * (10_000 - bufferBps)) / 10_000);
    const units = Math.floor(spendable / priceCents);
    if (units < 1) {
      skipped.push({ accountId: a.id, reason: "below_one_unit" });
      continue;
    }
    const estimatedCostCents = units * priceCents;
    legs.push({
      accountId: a.id,
      units,
      estimatedCostCents,
      cashAfterCents: cash - estimatedCostCents,
    });
  }

  return {
    priceCents,
    legs,
    skipped,
    totalUnits: legs.reduce((n, l) => n + l.units, 0),
    totalCostCents: legs.reduce((n, l) => n + l.estimatedCostCents, 0),
    totalCashCents,
  };
}

export type SellSkipReason = "excluded" | "not_tradable" | "no_position" | "not_needed";

export interface SellLeg {
  accountId: string;
  units: number;
  estimatedProceedsCents: number;
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
 * Walks accounts in withdrawal order and sells whole units until the
 * requested amount is covered. Rounds up within an account so the user gets
 * at least what they asked for; the last account may sell one unit more than
 * strictly needed. Fractional units are left in place.
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
    const held = Math.floor(a.positionUnits);
    if (held < 1) {
      skipped.push({ accountId: a.id, reason: "no_position" });
      continue;
    }
    if (remaining <= 0) {
      skipped.push({ accountId: a.id, reason: "not_needed" });
      continue;
    }
    const units = Math.min(held, Math.ceil(remaining / priceCents));
    const estimatedProceedsCents = units * priceCents;
    legs.push({
      accountId: a.id,
      units,
      estimatedProceedsCents,
      unitsAfter: a.positionUnits - units,
    });
    remaining -= estimatedProceedsCents;
  }

  return {
    priceCents,
    requestedCents: amountCents,
    legs,
    skipped,
    totalUnits: legs.reduce((n, l) => n + l.units, 0),
    totalProceedsCents: legs.reduce((n, l) => n + l.estimatedProceedsCents, 0),
    shortfallCents: Math.max(0, remaining),
  };
}
