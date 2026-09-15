import { accountActivities, accounts, connections, eq, type Db } from "@noadviceneeded/db";
import {
  ROOM_TYPES,
  contributionsSince,
  isRoomType,
  remainingRoom,
  toCents,
  type RoomType,
} from "@noadviceneeded/engine";
import type { SnapTradeClient } from "@noadviceneeded/snaptrade";

import { todayIso } from "./format.js";
import { getRoomBaselines, listRoomActivities } from "./portfolio.server.js";

const PAGE = 500;

/**
 * Pulls CONTRIBUTION and WITHDRAWAL activities for every registered account
 * since the earliest baseline the user entered. Nothing to fetch until a
 * baseline exists. Rows are keyed on SnapTrade's activity id so re-runs are
 * idempotent. Never throws: a failed page just leaves room slightly stale.
 */
export async function syncRoomActivities(
  db: Db,
  client: SnapTradeClient,
  userId: string,
  now = new Date(),
): Promise<number> {
  const baselines = await getRoomBaselines(db, userId);
  if (baselines.length === 0) return 0;
  const startDate = baselines.map((b) => b.asOf).sort()[0]!;
  const endDate = todayIso(now);
  const rows = await db
    .select({
      id: accounts.id,
      snaptradeAccountId: accounts.snaptradeAccountId,
      type: accounts.accountType,
    })
    .from(accounts)
    .innerJoin(connections, eq(connections.id, accounts.connectionId))
    .where(eq(connections.userId, userId));
  let inserted = 0;
  for (const a of rows) {
    if (!isRoomType(a.type)) continue;
    let offset = 0;
    for (;;) {
      let page;
      try {
        page = await client.listActivities(a.snaptradeAccountId, {
          startDate,
          endDate,
          type: "CONTRIBUTION,WITHDRAWAL",
          offset,
          limit: PAGE,
        });
      } catch (error) {
        console.error("activity sync failed", a.id, error instanceof Error ? error.message : error);
        break;
      }
      for (const act of page.data) {
        const amountCents = toCents(act.amount);
        const tradeDate = act.trade_date?.slice(0, 10);
        if (amountCents === null || !tradeDate || !act.type) continue;
        const result = await db
          .insert(accountActivities)
          .values({
            accountId: a.id,
            snaptradeActivityId: act.id,
            type: act.type.toUpperCase(),
            amountCents,
            currency: act.currency?.code ?? "CAD",
            tradeDate,
            description: act.description ?? null,
          })
          .onConflictDoNothing({ target: accountActivities.snaptradeActivityId })
          .returning({ id: accountActivities.id });
        inserted += result.length;
      }
      const total = page.pagination?.total;
      offset += page.data.length;
      if (page.data.length < PAGE || (total !== undefined && offset >= total)) break;
    }
  }
  return inserted;
}

export interface RoomSummary {
  accountType: RoomType;
  baseline: { roomCents: number; asOf: string } | null;
  contributedSinceCents: number;
  remainingCents: number | null;
  accountCount: number;
}

/** Room per registered type from the baseline and the synced contributions. */
export async function roomSummary(
  db: Db,
  userId: string,
  accountTypes: readonly { accountType: string }[],
): Promise<RoomSummary[]> {
  const [baselines, activities] = await Promise.all([
    getRoomBaselines(db, userId),
    listRoomActivities(db, userId),
  ]);
  return ROOM_TYPES.map((type) => {
    const baseline = baselines.find((b) => b.accountType === type);
    const own = activities.filter((a) => a.accountType === type);
    const accountCount = accountTypes.filter((a) => a.accountType === type).length;
    if (!baseline) {
      return {
        accountType: type,
        baseline: null,
        contributedSinceCents: 0,
        remainingCents: null,
        accountCount,
      };
    }
    const b = { roomCents: baseline.roomCents, asOf: baseline.asOf };
    return {
      accountType: type,
      baseline: b,
      contributedSinceCents: contributionsSince(b.asOf, own),
      remainingCents: remainingRoom(b, own),
      accountCount,
    };
  });
}

/** The shape `suggestDeposit` wants: only types with a baseline. */
export function roomByType(summary: RoomSummary[]): Partial<Record<RoomType, number>> {
  const out: Partial<Record<RoomType, number>> = {};
  for (const s of summary) if (s.remainingCents !== null) out[s.accountType] = s.remainingCents;
  return out;
}
