import {
  accountActivities,
  accounts,
  and,
  asc,
  connections,
  contributionRoom,
  desc,
  eq,
  inArray,
  orderBatches,
  orders,
  positions,
  users,
  type Account,
  type Connection,
  type ContributionRoom,
  type Db,
  type Order,
  type OrderBatch,
  type Position,
} from "@noadviceneeded/db";
import {
  isRoomType,
  type AccountType,
  type PlanAccount,
  type RoomType,
} from "@noadviceneeded/engine";

export type AccountRow = Account & {
  brokerageName: string;
  connectionStatus: Connection["status"];
  connectionCanTrade: boolean;
};

/** Every account the user has, with its connection's name and status. */
export async function listAccounts(db: Db, userId: string): Promise<AccountRow[]> {
  const rows = await db
    .select({ account: accounts, connection: connections })
    .from(accounts)
    .innerJoin(connections, eq(connections.id, accounts.connectionId))
    .where(eq(connections.userId, userId))
    .orderBy(asc(connections.brokerageName), asc(accounts.name), asc(accounts.numberMasked));
  return rows.map((r) => ({
    ...r.account,
    brokerageName: r.connection.brokerageName,
    connectionStatus: r.connection.status,
    connectionCanTrade: r.connection.canTrade,
  }));
}

export async function listPositions(db: Db, userId: string): Promise<Position[]> {
  return db
    .select({ position: positions })
    .from(positions)
    .innerJoin(accounts, eq(accounts.id, positions.accountId))
    .innerJoin(connections, eq(connections.id, accounts.connectionId))
    .where(eq(connections.userId, userId))
    .then((rows) => rows.map((r) => r.position));
}

async function ownedAccountIds(db: Db, userId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .innerJoin(connections, eq(connections.id, accounts.connectionId))
    .where(and(eq(connections.userId, userId), inArray(accounts.id, ids)));
  return new Set(rows.map((r) => r.id));
}

export interface AccountChoice {
  accountId: string;
  included: boolean;
  fractional: boolean;
  accountType: AccountType;
}

/** The user's answers on the Accounts page. Silently ignores ids they do not own. */
export async function updateAccountChoices(
  db: Db,
  userId: string,
  choices: AccountChoice[],
  now = new Date(),
): Promise<number> {
  const owned = await ownedAccountIds(
    db,
    userId,
    choices.map((c) => c.accountId),
  );
  let updated = 0;
  for (const c of choices) {
    if (!owned.has(c.accountId)) continue;
    await db
      .update(accounts)
      .set({
        included: c.included,
        fractional: c.fractional,
        accountType: c.accountType,
        updatedAt: now,
      })
      .where(eq(accounts.id, c.accountId));
    updated += 1;
  }
  return updated;
}

export type RankOrder = "contribution" | "withdrawal";

/** Swaps an account's rank with its neighbour in one of the two orders. */
export async function moveAccount(
  db: Db,
  userId: string,
  accountId: string,
  order: RankOrder,
  direction: "up" | "down",
  now = new Date(),
): Promise<boolean> {
  const column = order === "contribution" ? accounts.contributionRank : accounts.withdrawalRank;
  const rows = await db
    .select({ id: accounts.id, rank: column })
    .from(accounts)
    .innerJoin(connections, eq(connections.id, accounts.connectionId))
    .where(eq(connections.userId, userId))
    .orderBy(asc(column), asc(accounts.name));
  const index = rows.findIndex((r) => r.id === accountId);
  if (index === -1) return false;
  const swapWith = direction === "up" ? index - 1 : index + 1;
  const a = rows[index];
  const b = rows[swapWith];
  if (!a || !b) return false;
  // Ranks may collide before the first sync assigns them; normalise to positions.
  const key = order === "contribution" ? "contributionRank" : "withdrawalRank";
  await db
    .update(accounts)
    .set({ [key]: swapWith + 1, updatedAt: now })
    .where(eq(accounts.id, a.id));
  await db
    .update(accounts)
    .set({ [key]: index + 1, updatedAt: now })
    .where(eq(accounts.id, b.id));
  return true;
}

export interface TargetEtf {
  symbolId: string;
  ticker: string;
  name: string;
  currency: string;
}

export async function setTargetEtf(db: Db, userId: string, target: TargetEtf): Promise<void> {
  await db
    .update(users)
    .set({
      targetSymbolId: target.symbolId,
      targetTicker: target.ticker,
      targetName: target.name,
      targetCurrency: target.currency,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function markUserSynced(db: Db, userId: string, at: Date): Promise<void> {
  await db.update(users).set({ lastSyncedAt: at, updatedAt: at }).where(eq(users.id, userId));
}

/** Forces the next page load to read SnapTrade again, e.g. after orders change cash. */
export async function invalidateSync(db: Db, userId: string): Promise<void> {
  await db.update(users).set({ lastSyncedAt: null }).where(eq(users.id, userId));
}

export async function getRoomBaselines(db: Db, userId: string): Promise<ContributionRoom[]> {
  return db.select().from(contributionRoom).where(eq(contributionRoom.userId, userId));
}

export async function setRoomBaseline(
  db: Db,
  userId: string,
  accountType: RoomType,
  roomCents: number,
  asOf: string,
  now = new Date(),
): Promise<void> {
  const values = { userId, accountType, roomCents, asOf, updatedAt: now };
  await db
    .insert(contributionRoom)
    .values(values)
    .onConflictDoUpdate({
      target: [contributionRoom.userId, contributionRoom.accountType],
      set: { roomCents, asOf, updatedAt: now },
    });
}

export async function clearRoomBaseline(db: Db, userId: string, accountType: RoomType) {
  await db
    .delete(contributionRoom)
    .where(and(eq(contributionRoom.userId, userId), eq(contributionRoom.accountType, accountType)));
}

export interface RoomActivityRow {
  id: string;
  accountType: RoomType;
  accountName: string;
  type: string;
  amountCents: number;
  tradeDate: string;
  description: string | null;
}

/** Cash movements in the user's registered accounts, newest first. */
export async function listRoomActivities(db: Db, userId: string): Promise<RoomActivityRow[]> {
  const rows = await db
    .select({ activity: accountActivities, account: accounts })
    .from(accountActivities)
    .innerJoin(accounts, eq(accounts.id, accountActivities.accountId))
    .innerJoin(connections, eq(connections.id, accounts.connectionId))
    .where(eq(connections.userId, userId))
    .orderBy(desc(accountActivities.tradeDate));
  return rows.flatMap((r) => {
    if (!isRoomType(r.account.accountType)) return [];
    return [
      {
        id: r.activity.id,
        accountType: r.account.accountType,
        accountName: r.account.name,
        type: r.activity.type,
        amountCents: r.activity.amountCents,
        tradeDate: r.activity.tradeDate,
        description: r.activity.description,
      },
    ];
  });
}

export type OrderWithAccount = Order & { accountName: string; brokerageName: string };
export type BatchWithOrders = OrderBatch & { orders: OrderWithAccount[] };

export async function listOrderBatches(
  db: Db,
  userId: string,
  limit = 50,
): Promise<BatchWithOrders[]> {
  const batches = await db
    .select()
    .from(orderBatches)
    .where(eq(orderBatches.userId, userId))
    .orderBy(desc(orderBatches.createdAt))
    .limit(limit);
  if (batches.length === 0) return [];
  const rows = await db
    .select({ order: orders, account: accounts, connection: connections })
    .from(orders)
    .innerJoin(accounts, eq(accounts.id, orders.accountId))
    .innerJoin(connections, eq(connections.id, accounts.connectionId))
    .where(
      inArray(
        orders.batchId,
        batches.map((b) => b.id),
      ),
    )
    .orderBy(asc(orders.createdAt));
  return batches.map((b) => ({
    ...b,
    orders: rows
      .filter((r) => r.order.batchId === b.id)
      .map((r) => ({
        ...r.order,
        accountName: r.account.name,
        brokerageName: r.connection.brokerageName,
      })),
  }));
}

/** What the planner sees, plus what the pages need to render each account. */
export type PlanAccountRow = PlanAccount & {
  snaptradeAccountId: string;
  brokerageName: string;
  numberMasked: string;
  connectionStatus: Connection["status"];
  cashAsOf: string | null;
  /** Latest total value of the account from SnapTrade. */
  valueCents: number | null;
  /** Last price SnapTrade reported for the target ETF held here, if held. */
  holdingPriceCents: number | null;
  holdingPriceAsOf: string | null;
};

export async function buildPlanAccounts(
  db: Db,
  userId: string,
  options: { targetSymbolId: string | null; tradeScope: boolean },
): Promise<PlanAccountRow[]> {
  const [rows, held] = await Promise.all([listAccounts(db, userId), listPositions(db, userId)]);
  const target = new Map<string, Position>();
  for (const p of held) {
    if (options.targetSymbolId && p.universalSymbolId === options.targetSymbolId) {
      target.set(p.accountId, p);
    }
  }
  return rows.map((a) => {
    const p = target.get(a.id);
    const open = (a.statusRaw ?? "open") === "open" && a.connectionStatus === "active";
    return {
      id: a.id,
      name: a.name,
      accountType: a.accountType,
      included: a.included,
      canTrade: open && a.connectionCanTrade && options.tradeScope,
      fractional: a.fractional,
      cashCents: a.cashCents,
      positionUnits: p?.units ?? 0,
      contributionRank: a.contributionRank,
      withdrawalRank: a.withdrawalRank,
      snaptradeAccountId: a.snaptradeAccountId,
      brokerageName: a.brokerageName,
      numberMasked: a.numberMasked,
      connectionStatus: a.connectionStatus,
      cashAsOf: a.cashAsOf?.toISOString() ?? null,
      valueCents: a.lastValueCents,
      holdingPriceCents: p?.priceCents ?? null,
      holdingPriceAsOf: p?.updatedAt.toISOString() ?? null,
    };
  });
}
