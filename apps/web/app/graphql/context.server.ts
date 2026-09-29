import { eq, isNull, and, users, type Db, type User } from "@noadviceneeded/db";
import type { SnapTradeClient } from "@noadviceneeded/snaptrade";
import { GraphQLError } from "graphql";

import { effectiveCountry } from "../lib/country.js";
import { getDb } from "../lib/db.server.js";
import { buildPlanAccounts, type PlanAccountRow } from "../lib/portfolio.server.js";
import { roomSummary, type RoomSummary } from "../lib/room.server.js";
import { getOptionalSession } from "../lib/session.server.js";
import { getSnapTradeClient, hasTradeScope } from "../lib/snaptrade.server.js";

/**
 * Per-request state for resolvers. The reads every screen shares (trade
 * scope, the plan accounts, room) are memoised so one query that asks for
 * the portfolio, the plan and the suggestion reads the database once.
 * Mutations call `refresh()` after writing so the payload's `viewer`
 * reflects the write.
 *
 * Yoga copies this object's properties onto its own context, so resolvers
 * never see this object itself. Nothing here may be a property that changes
 * after construction: the user is read through `viewer()`, which closes over
 * the state `refresh()` writes.
 */
export interface GraphQLContext {
  db: Db;
  now: Date;
  /** The signed-in user as last read: at sign-in, or by the latest `refresh()`. */
  viewer(): User | null;
  sessionId: string | null;
  refresh(): Promise<void>;
  tradeScope(): Promise<boolean>;
  planAccounts(): Promise<PlanAccountRow[]>;
  roomSummary(): Promise<RoomSummary[]>;
  /** A live SnapTrade client, or null when the grant has ended. */
  snaptrade(): Promise<SnapTradeClient | null>;
}

export function buildContext(input: {
  db: Db;
  user: User | null;
  sessionId: string | null;
  now?: Date;
}): GraphQLContext {
  let user = input.user;
  const memo = new Map<string, Promise<unknown>>();
  function once<T>(key: string, load: () => Promise<T>): Promise<T> {
    let hit = memo.get(key) as Promise<T> | undefined;
    if (!hit) {
      hit = load();
      memo.set(key, hit);
    }
    return hit;
  }

  const ctx: GraphQLContext = {
    db: input.db,
    now: input.now ?? new Date(),
    sessionId: input.sessionId,
    viewer: () => user,
    async refresh() {
      memo.clear();
      if (!user) return;
      const [row] = await input.db
        .select()
        .from(users)
        .where(and(eq(users.id, user.id), isNull(users.deletedAt)))
        .limit(1);
      user = row ?? null;
    },
    tradeScope() {
      const user = viewerOf(ctx);
      return once("tradeScope", () => hasTradeScope(user.id));
    },
    planAccounts() {
      const user = viewerOf(ctx);
      return once("planAccounts", async () =>
        buildPlanAccounts(ctx.db, user.id, {
          targetSymbolId: user.targetSymbolId,
          tradeScope: await ctx.tradeScope(),
        }),
      );
    },
    roomSummary() {
      const user = viewerOf(ctx);
      return once("roomSummary", async () =>
        roomSummary(ctx.db, user.id, effectiveCountry(user), await ctx.planAccounts()),
      );
    },
    snaptrade() {
      const user = viewerOf(ctx);
      return once("snaptrade", () => getSnapTradeClient(user.id).catch(() => null));
    },
  };
  return ctx;
}

/**
 * The context for one HTTP request. The native app authenticates with a
 * bearer token. A browser session cookie also works (for GraphiQL), but only
 * on JSON requests: a cross-site page cannot send `application/json` without
 * a CORS preflight, which this endpoint never answers, so the cookie can
 * never place orders from someone else's form.
 */
export async function createContext(request: Request): Promise<GraphQLContext> {
  const session = await getOptionalSession(request);
  const usable = session && (session.source === "bearer" || isJsonRequest(request));
  return buildContext({
    db: getDb(),
    user: usable ? session.user : null,
    sessionId: usable ? session.sessionId : null,
  });
}

function isJsonRequest(request: Request): boolean {
  if (request.method === "GET") return true;
  const type = request.headers.get("Content-Type") ?? "";
  return /^application\/(graphql-response\+)?json\b/i.test(type);
}

/** The signed-in user, or an UNAUTHENTICATED error the app answers by signing in again. */
export function viewerOf(ctx: GraphQLContext): User {
  const user = ctx.viewer();
  if (!user) {
    throw new GraphQLError("Sign in to continue.", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  return user;
}

/** A refusal the app shows as-is, with a machine-readable code. */
export function userError(code: string, message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids are Postgres uuids; anything else would be a database error rather than "not found". */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}
