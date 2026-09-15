import { isRoomType, type AccountType, type RoomType } from "./accounts.js";
import type { PlanAccount } from "./plan.js";

/**
 * Room the user read from CRA My Account (or worked out themselves), valid at
 * the end of `asOf`. Contributions dated after that day reduce it.
 */
export interface RoomBaseline {
  roomCents: number;
  /** YYYY-MM-DD */
  asOf: string;
}

export interface RoomActivity {
  /** SnapTrade's category; only CONTRIBUTION counts. */
  type: string | null | undefined;
  /** Sign as SnapTrade sends it; magnitude is used. */
  amountCents: number;
  /** YYYY-MM-DD or an ISO timestamp; only the date part is compared. */
  tradeDate: string;
}

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

/** Cents contributed strictly after the baseline day. */
export function contributionsSince(asOf: string, activities: readonly RoomActivity[]): number {
  let total = 0;
  for (const a of activities) {
    if (a.type?.toUpperCase() !== "CONTRIBUTION") continue;
    if (dateOnly(a.tradeDate) <= asOf) continue;
    total += Math.abs(a.amountCents);
  }
  return total;
}

/** Room left today. Negative means the user has over-contributed since the baseline. */
export function remainingRoom(baseline: RoomBaseline, activities: readonly RoomActivity[]): number {
  return baseline.roomCents - contributionsSince(baseline.asOf, activities);
}

export interface DepositSuggestion {
  accountId: string;
  accountType: AccountType;
  /** Room left in that account's type, or null when the type has no limit or no baseline. */
  roomCents: number | null;
}

/**
 * The account the next deposit should go to: the first included account in
 * contribution order whose type still has room. A registered type with no
 * baseline is still suggested (room unknown), so the user is nudged to enter
 * it rather than silently skipped.
 */
export function suggestDeposit(
  accounts: readonly PlanAccount[],
  room: Partial<Record<RoomType, number>>,
): DepositSuggestion | null {
  const ordered = [...accounts]
    .filter((a) => a.included)
    .sort((x, y) => x.contributionRank - y.contributionRank);
  for (const a of ordered) {
    if (!isRoomType(a.accountType)) {
      return { accountId: a.id, accountType: a.accountType, roomCents: null };
    }
    const left = room[a.accountType];
    if (left === undefined) return { accountId: a.id, accountType: a.accountType, roomCents: null };
    if (left > 0) return { accountId: a.id, accountType: a.accountType, roomCents: left };
  }
  return null;
}
