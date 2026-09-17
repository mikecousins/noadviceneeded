import { accounts, and, connections, eq, notInArray, positions, type Db } from "@noadviceneeded/db";
import {
  DEFAULT_ORDERS,
  assignDefaultRanks,
  classifyAccountType,
  includedByDefault,
  toCents,
  typeRank,
  type Country,
} from "@noadviceneeded/engine";
import type {
  SnapTradeAccount,
  SnapTradeBalance,
  SnapTradeConnection,
  SnapTradePosition,
} from "@noadviceneeded/snaptrade";

import { effectiveCountry } from "./country.js";
import { markUserSynced } from "./portfolio.server.js";
import { syncRoomActivities } from "./room.server.js";
import {
  SnapTradeReconnectRequired,
  getGrantedScopes,
  getSnapTradeClient,
} from "./snaptrade.server.js";

/** SnapTrade's daily-freshness data does not change faster than this anyway. */
export const SYNC_COOLDOWN_MS = 15 * 60 * 1000;

export interface SnapTradeSnapshot {
  connections: SnapTradeConnection[];
  accounts: SnapTradeAccount[];
  /** Keyed by SnapTrade account id. Missing means the read failed; existing cash is kept. */
  balances: Record<string, SnapTradeBalance[]>;
  /** Keyed by SnapTrade account id. Missing means the read failed; existing positions are kept. */
  positions: Record<string, SnapTradePosition[]>;
  /** Whether the user's token carries `trade`; combined with the brokerage's own flag. */
  tradeScope: boolean;
  /** Cash is recorded in this currency only. */
  targetCurrency: string;
  /** Decides how new accounts are classified and ranked. */
  country: Country;
  now: Date;
}

export interface ApplyResult {
  connectionsUpserted: number;
  accountsUpserted: number;
  connectionsRemoved: number;
}

/**
 * Writes one SnapTrade read into the database. Pure with respect to
 * SnapTrade (the caller fetched), so it can be tested against PGlite.
 *
 * Identity columns and values are refreshed on every run; the user's choices
 * (`accountType`, `included`, ranks) are set only on insert; connections
 * SnapTrade no longer returns are marked `removed`, never deleted.
 */
export async function applySnapTradeSnapshot(
  db: Db,
  userId: string,
  snapshot: SnapTradeSnapshot,
): Promise<ApplyResult> {
  const { now } = snapshot;
  const connectionIdBySnapTradeId = new Map<string, string>();

  for (const c of snapshot.connections) {
    const brokerage = c.brokerage;
    const values = {
      userId,
      snaptradeAuthorizationId: c.id,
      brokerageSlug: brokerage.slug,
      brokerageName: brokerage.display_name ?? brokerage.name,
      status: c.disabled ? ("disabled" as const) : ("active" as const),
      canTrade: snapshot.tradeScope && c.type === "trade" && brokerage.allows_trading === true,
      lastSyncedAt: now,
      lastSyncError: null,
      updatedAt: now,
    };
    const [row] = await db
      .insert(connections)
      .values(values)
      .onConflictDoUpdate({ target: connections.snaptradeAuthorizationId, set: values })
      .returning({ id: connections.id });
    if (row) connectionIdBySnapTradeId.set(c.id, row.id);
  }

  let accountsUpserted = 0;
  for (const a of snapshot.accounts) {
    const connectionId = connectionIdBySnapTradeId.get(a.brokerage_authorization);
    if (!connectionId) continue;
    const total = a.balance?.total;
    const name = a.name ?? a.institution_name;
    const balances = snapshot.balances[a.id];
    const cashBalance = balances?.find(
      (b) => (b.currency?.code ?? "CAD").toUpperCase() === snapshot.targetCurrency.toUpperCase(),
    );
    const cashCents = balances ? (toCents(cashBalance?.cash) ?? 0) : undefined;
    const refreshed = {
      connectionId,
      name,
      numberMasked: a.number,
      rawType: a.raw_type ?? null,
      currency: total?.currency ?? "CAD",
      lastValueCents: toCents(total?.amount),
      statusRaw: a.status ?? null,
      isPaper: a.is_paper ?? false,
      updatedAt: now,
      ...(cashCents !== undefined ? { cashCents, cashAsOf: now } : {}),
    };
    const accountType = classifyAccountType(a.raw_type, name, snapshot.country);
    const [row] = await db
      .insert(accounts)
      .values({
        ...refreshed,
        snaptradeAccountId: a.id,
        accountType,
        included: includedByDefault(accountType),
      })
      .onConflictDoUpdate({ target: accounts.snaptradeAccountId, set: refreshed })
      .returning({ id: accounts.id });
    accountsUpserted += 1;
    if (!row) continue;

    const held = snapshot.positions[a.id];
    if (held) {
      await db.delete(positions).where(eq(positions.accountId, row.id));
      for (const p of held) {
        const symbol = p.symbol?.symbol;
        if (!symbol || p.units === null || p.units === undefined) continue;
        await db
          .insert(positions)
          .values({
            accountId: row.id,
            universalSymbolId: symbol.id,
            ticker: symbol.symbol,
            description: symbol.description ?? null,
            units: p.units,
            priceCents: toCents(p.price),
            currency: p.currency?.code ?? symbol.currency?.code ?? "CAD",
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [positions.accountId, positions.universalSymbolId],
            set: { units: p.units, priceCents: toCents(p.price), updatedAt: now },
          });
      }
    }
  }

  const seen = [...connectionIdBySnapTradeId.values()];
  const removed = await db
    .update(connections)
    .set({ status: "removed", updatedAt: now })
    .where(
      and(
        eq(connections.userId, userId),
        seen.length > 0 ? notInArray(connections.id, seen) : undefined,
      ),
    )
    .returning({ id: connections.id });

  await assignMissingRanks(db, userId, snapshot.country, now);

  return {
    connectionsUpserted: connectionIdBySnapTradeId.size,
    accountsUpserted,
    connectionsRemoved: removed.length,
  };
}

/**
 * Gives every unranked account (rank 0) a place in both orders. On the first
 * sync everything is unranked and the country's default type orders decide;
 * later, new accounts are appended after the user's existing order, still
 * sorted by type among themselves, so a reordering is never undone by a sync.
 */
export async function assignMissingRanks(
  db: Db,
  userId: string,
  country: Country,
  now = new Date(),
): Promise<void> {
  const rows = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      accountType: accounts.accountType,
      contributionRank: accounts.contributionRank,
      withdrawalRank: accounts.withdrawalRank,
    })
    .from(accounts)
    .innerJoin(connections, eq(connections.id, accounts.connectionId))
    .where(eq(connections.userId, userId));

  const unranked = rows.filter((r) => r.contributionRank === 0 || r.withdrawalRank === 0);
  if (unranked.length === 0) return;

  if (unranked.length === rows.length) {
    const ranks = assignDefaultRanks(rows, country);
    for (const r of rows) {
      const rank = ranks.get(r.id);
      if (!rank) continue;
      await db
        .update(accounts)
        .set({ ...rank, updatedAt: now })
        .where(eq(accounts.id, r.id));
    }
    return;
  }

  const maxContribution = Math.max(0, ...rows.map((r) => r.contributionRank));
  const maxWithdrawal = Math.max(0, ...rows.map((r) => r.withdrawalRank));
  const byOrder = (order: readonly (typeof rows)[number]["accountType"][]) =>
    [...unranked].sort(
      (a, b) =>
        typeRank(a.accountType, order) - typeRank(b.accountType, order) ||
        a.name.localeCompare(b.name, "en-CA"),
    );
  const contribution = byOrder(DEFAULT_ORDERS[country].contribution);
  const withdrawal = byOrder(DEFAULT_ORDERS[country].withdrawal);
  for (const [i, r] of contribution.entries()) {
    if (r.contributionRank !== 0) continue;
    await db
      .update(accounts)
      .set({ contributionRank: maxContribution + i + 1, updatedAt: now })
      .where(eq(accounts.id, r.id));
  }
  for (const [i, r] of withdrawal.entries()) {
    if (r.withdrawalRank !== 0) continue;
    await db
      .update(accounts)
      .set({ withdrawalRank: maxWithdrawal + i + 1, updatedAt: now })
      .where(eq(accounts.id, r.id));
  }
}

export type SyncOutcome =
  | { status: "synced" | "fresh"; syncedAt: Date }
  | { status: "reconnect" | "error"; syncedAt: Date | null };

/**
 * Reads SnapTrade for this user unless it was read within the cooldown.
 * Never throws: the page decides how to show a stale or failed read.
 */
export async function syncUser(
  db: Db,
  user: { id: string; lastSyncedAt: Date | null; targetCurrency: string; country: Country | null },
  options: { force?: boolean; now?: Date } = {},
): Promise<SyncOutcome> {
  const now = options.now ?? new Date();
  const last = user.lastSyncedAt;
  if (!options.force && last && now.getTime() - last.getTime() < SYNC_COOLDOWN_MS) {
    return { status: "fresh", syncedAt: last };
  }
  try {
    const [client, scopes] = await Promise.all([
      getSnapTradeClient(user.id),
      getGrantedScopes(user.id),
    ]);
    const [conns, accts] = await Promise.all([client.listConnections(), client.listAccounts()]);
    const live = accts.filter(
      (a) =>
        (a.status ?? "open") === "open" && (a.account_category ?? "INVESTMENT") === "INVESTMENT",
    );
    const balances: SnapTradeSnapshot["balances"] = {};
    const held: SnapTradeSnapshot["positions"] = {};
    await Promise.all(
      live.map(async (a) => {
        try {
          balances[a.id] = await client.listBalances(a.id);
        } catch (error) {
          console.error(
            "balances read failed",
            a.id,
            error instanceof Error ? error.message : error,
          );
        }
        try {
          held[a.id] = await client.listPositions(a.id);
        } catch (error) {
          console.error(
            "positions read failed",
            a.id,
            error instanceof Error ? error.message : error,
          );
        }
      }),
    );
    await applySnapTradeSnapshot(db, user.id, {
      connections: conns,
      accounts: accts,
      balances,
      positions: held,
      tradeScope: scopes.includes("trade"),
      targetCurrency: user.targetCurrency,
      country: effectiveCountry(user),
      now,
    });
    await syncRoomActivities(db, client, user.id, now);
    await markUserSynced(db, user.id, now);
    return { status: "synced", syncedAt: now };
  } catch (error) {
    if (error instanceof SnapTradeReconnectRequired) return { status: "reconnect", syncedAt: last };
    console.error("snaptrade sync failed", error instanceof Error ? error.message : error);
    return { status: "error", syncedAt: last };
  }
}
