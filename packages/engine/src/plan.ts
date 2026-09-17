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
   * units of the ETF (Wealthsimple does for many). Plans then size legs to
   * `UNIT_DECIMALS` places instead of whole units.
   */
  fractional: boolean;
  /** Settled cash available to buy with, or null when SnapTrade sent none. */
  cashCents: number | null;
  /** Units of the target ETF already held here. */
  positionUnits: number;
  contributionRank: number;
  withdrawalRank: number;
}

/** Fractional legs are sized to this many decimal places. */
export const UNIT_DECIMALS = 4;
const UNIT_SCALE = 10 ** UNIT_DECIMALS;

/** Units rounded down to `UNIT_DECIMALS` places. Whole-unit accounts round down to an integer. */
export function floorUnits(units: number, fractional: boolean): number {
  if (!fractional) return Math.floor(units);
  return Math.floor(units * UNIT_SCALE + 1e-9) / UNIT_SCALE;
}

function ceilUnits(units: number, fractional: boolean): number {
  if (!fractional) return Math.ceil(units);
  return Math.ceil(units * UNIT_SCALE - 1e-9) / UNIT_SCALE;
}

/** `units * priceCents` as integer cents, computed on scaled integers so floats cannot drift. */
function unitsToCents(units: number, priceCents: number): number {
  return Math.round((Math.round(units * UNIT_SCALE) * priceCents) / UNIT_SCALE);
}

/** Adds leg units on the scaled integer grid so a total of fractions never shows float noise. */
function sumUnits(legs: readonly { units: number }[]): number {
  return legs.reduce((n, l) => n + Math.round(l.units * UNIT_SCALE), 0) / UNIT_SCALE;
}

/** Units of a position the plan may sell: whole units, or all of it to `UNIT_DECIMALS` places. */
export function sellableUnits(account: Pick<PlanAccount, "positionUnits" | "fractional">): number {
  return floorUnits(account.positionUnits, account.fractional);
}

export type BuySkipReason =
  "excluded" | "not_tradable" | "no_cash" | "below_one_unit" | "below_minimum";

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
  /**
   * Smallest fractional leg worth sending, in cents. Brokerages that fill
   * fractions still refuse tiny orders (Wealthsimple's floor is $1). Default $1.
   */
  minFractionalCents?: number;
}

/**
 * Turns the cash sitting in each included account into units of the target
 * ETF: whole units, or fractions to `UNIT_DECIMALS` places where the user
 * said the brokerage fills them. Every account is bought independently: cash
 * cannot move between accounts, so there is nothing to allocate, only
 * leftovers to explain.
 */
export function planBuys(accounts: readonly PlanAccount[], options: BuyOptions): BuyPlan {
  const { priceCents } = options;
  if (!Number.isInteger(priceCents) || priceCents <= 0) {
    throw new RangeError("priceCents must be a positive integer");
  }
  const bufferBps = options.bufferBps ?? 100;
  const minFractionalCents = options.minFractionalCents ?? 100;
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
    const units = floorUnits(spendable / priceCents, a.fractional);
    const estimatedCostCents = unitsToCents(units, priceCents);
    if (!a.fractional && units < 1) {
      skipped.push({ accountId: a.id, reason: "below_one_unit" });
      continue;
    }
    if (a.fractional && (units <= 0 || estimatedCostCents < minFractionalCents)) {
      skipped.push({ accountId: a.id, reason: "below_minimum" });
      continue;
    }
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
    totalUnits: sumUnits(legs),
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
 * Walks accounts in withdrawal order and sells units until the requested
 * amount is covered. Rounds up within an account so the user gets at least
 * what they asked for; a whole-unit account may sell one unit more than
 * strictly needed and leaves any fraction it holds in place, while a
 * fractional account sells to `UNIT_DECIMALS` places and can be emptied.
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
    const held = sellableUnits(a);
    if (held <= 0) {
      skipped.push({ accountId: a.id, reason: "no_position" });
      continue;
    }
    if (remaining <= 0) {
      skipped.push({ accountId: a.id, reason: "not_needed" });
      continue;
    }
    const units = Math.min(held, ceilUnits(remaining / priceCents, a.fractional));
    const estimatedProceedsCents = unitsToCents(units, priceCents);
    legs.push({
      accountId: a.id,
      units,
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
