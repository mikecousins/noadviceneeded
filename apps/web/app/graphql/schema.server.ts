import { ROOM_TYPES_BY_COUNTRY, allInOneEtfs } from "@noadviceneeded/engine";
import { and, eq, isNull, users } from "@noadviceneeded/db";

import { effectiveCountry } from "../lib/country.js";
import { setCountry } from "../lib/country.server.js";
import { getEnv } from "../lib/env.server.js";
import { placeInvestBatch, placeWithdrawBatch, type PlaceOutcome } from "../lib/execute.server.js";
import { chooseFundByTicker } from "../lib/fund.server.js";
import {
  clearRoomBaseline,
  getOrderBatch,
  moveAccount,
  setRoomBaseline,
  setTargetEtf,
  updateAccountChoices,
} from "../lib/portfolio.server.js";
import { createBearerSession, revokeSession } from "../lib/session.server.js";
import { SnapTradeReconnectRequired } from "../lib/snaptrade.server.js";
import { syncUser } from "../lib/sync.server.js";
import { redeemHandoffCode } from "../lib/tokens.server.js";
import {
  AccountTypeEnum,
  CountryEnum,
  DirectionEnum,
  RankOrderEnum,
  RoomTypeEnum,
  SyncStatusEnum,
  builder,
} from "./builder.server.js";
import { isUuid, userError, viewerOf, type GraphQLContext } from "./context.server.js";
import { AllInOneEtfRef, OrderBatchRef, ViewerRef } from "./types.server.js";

builder.queryType({
  fields: (t) => ({
    viewer: t.field({
      type: ViewerRef,
      nullable: true,
      description: "The signed-in user, or null. Reads the database only; call `sync` to refresh.",
      resolve: (_, __, ctx) => ctx.user,
    }),
    allInOneEtfs: t.field({
      type: [AllInOneEtfRef],
      description: "The curated fund list for a country, readable before sign-in.",
      args: { country: t.arg({ type: CountryEnum, required: true }) },
      resolve: (_, { country }) => [...allInOneEtfs(country)],
    }),
  }),
});

const AuthSessionRef = builder
  .objectRef<{ token: string; expiresAt: Date }>("AuthSession")
  .implement({
    fields: (t) => ({
      token: t.exposeString("token", {
        description: "Send as `Authorization: Bearer <token>`. Keep it in the Keychain.",
      }),
      expiresAt: t.expose("expiresAt", { type: "DateTime" }),
    }),
  });

const SyncPayloadRef = builder
  .objectRef<{ status: "synced" | "fresh" | "reconnect" | "error"; syncedAt: Date | null }>(
    "SyncPayload",
  )
  .implement({
    fields: (t) => ({
      status: t.expose("status", { type: SyncStatusEnum }),
      syncedAt: t.expose("syncedAt", { type: "DateTime", nullable: true }),
      viewer: t.field({ type: ViewerRef, resolve: (_, __, ctx) => viewerOf(ctx) }),
    }),
  });

const AccountsPayloadRef = builder.objectRef<{ changed: number }>("AccountsPayload").implement({
  fields: (t) => ({
    changed: t.exposeInt("changed", { description: "Accounts written; unknown ids are ignored." }),
    viewer: t.field({ type: ViewerRef, resolve: (_, __, ctx) => viewerOf(ctx) }),
  }),
});

const AccountChoiceInput = builder.inputType("AccountChoiceInput", {
  description: "The user's answers for one account on the Accounts screen.",
  fields: (t) => ({
    accountId: t.id({ required: true }),
    accountType: t.field({ type: AccountTypeEnum, required: true }),
    included: t.boolean({ required: true }),
    fractional: t.boolean({ required: true }),
  }),
});

const FundSymbolInput = builder.inputType("FundSymbolInput", {
  description: "A `Symbol` from `searchSymbols`, chosen as the fund.",
  fields: (t) => ({
    symbolId: t.id({ required: true }),
    ticker: t.string({ required: true }),
    name: t.string({ required: true }),
    currency: t.string({ required: true }),
  }),
});

/** Writes happened; re-read the user and drop the request's cached reads. */
async function fresh(ctx: GraphQLContext) {
  await ctx.refresh();
  return viewerOf(ctx);
}

/** A placed batch, or the refusal as a coded error the app shows as-is. */
async function batchOrRefusal(ctx: GraphQLContext, outcome: PlaceOutcome) {
  if (!outcome.ok) throw userError(outcome.code, outcome.message);
  await ctx.refresh();
  const batch = await getOrderBatch(ctx.db, viewerOf(ctx).id, outcome.batchId);
  if (!batch) throw new Error("placed batch not found");
  return batch;
}

const reconnect = () =>
  userError("RECONNECT_REQUIRED", "Your SnapTrade access has ended. Sign in again to reconnect.");

builder.mutationType({
  fields: (t) => ({
    exchangeSignInCode: t.field({
      type: AuthSessionRef,
      description:
        "Ends the native sign-in: the `code` from noadviceneeded://auth/callback plus the PKCE verifier the app generated for /auth/snaptrade/mobile.",
      args: {
        code: t.arg.string({ required: true }),
        codeVerifier: t.arg.string({ required: true }),
      },
      resolve: async (_, { code, codeVerifier }, ctx) => {
        const userId = await redeemHandoffCode(code, codeVerifier, getEnv().SESSION_SECRET);
        const [user] = userId
          ? await ctx.db
              .select({ id: users.id })
              .from(users)
              .where(and(eq(users.id, userId), isNull(users.deletedAt)))
              .limit(1)
          : [];
        if (!user) throw userError("INVALID_CODE", "That sign-in expired. Try again.");
        return createBearerSession(user.id);
      },
    }),

    signOut: t.boolean({
      description: "Ends this session. The SnapTrade grant stays so signing back in is one tap.",
      resolve: async (_, __, ctx) => {
        if (ctx.sessionId) await revokeSession(ctx.sessionId);
        return true;
      },
    }),

    sync: t.field({
      type: SyncPayloadRef,
      description:
        "Reads SnapTrade unless it was read in the last 15 minutes; `force` skips the cooldown (pull to refresh). Queries never read SnapTrade accounts, so call this when the app opens.",
      args: { force: t.arg.boolean({ defaultValue: false }) },
      resolve: async (_, { force }, ctx) => {
        const outcome = await syncUser(ctx.db, viewerOf(ctx), { force: force ?? false });
        await ctx.refresh();
        return outcome;
      },
    }),

    setCountry: t.field({
      type: ViewerRef,
      description:
        "Confirms or switches the country. Switching re-types every account, resets both orders and clears the fund.",
      args: { country: t.arg({ type: CountryEnum, required: true }) },
      resolve: async (_, { country }, ctx) => {
        await setCountry(ctx.db, viewerOf(ctx), country);
        return fresh(ctx);
      },
    }),

    updateAccounts: t.field({
      type: AccountsPayloadRef,
      args: { accounts: t.arg({ type: [AccountChoiceInput], required: true }) },
      resolve: async (_, { accounts }, ctx) => {
        const changed = await updateAccountChoices(
          ctx.db,
          viewerOf(ctx).id,
          accounts
            .map((a) => ({ ...a, accountId: String(a.accountId) }))
            .filter((a) => isUuid(a.accountId)),
        );
        await ctx.refresh();
        return { changed };
      },
    }),

    moveAccount: t.field({
      type: ViewerRef,
      description: "Swaps an account with its neighbour in one of the two orders.",
      args: {
        accountId: t.arg.id({ required: true }),
        order: t.arg({ type: RankOrderEnum, required: true }),
        direction: t.arg({ type: DirectionEnum, required: true }),
      },
      resolve: async (_, { accountId, order, direction }, ctx) => {
        await moveAccount(ctx.db, viewerOf(ctx).id, String(accountId), order, direction);
        return fresh(ctx);
      },
    }),

    chooseFund: t.field({
      type: ViewerRef,
      description: "Chooses the fund by ticker (a curated `AllInOneEtf.ticker`, or any other).",
      args: { ticker: t.arg.string({ required: true }) },
      resolve: async (_, { ticker }, ctx) => {
        const user = viewerOf(ctx);
        const trimmed = ticker.trim();
        if (trimmed.length === 0 || trimmed.length > 20) {
          throw userError("BAD_USER_INPUT", "Pick an ETF from the list.");
        }
        let chosen;
        try {
          chosen = await chooseFundByTicker(ctx.db, user.id, trimmed, effectiveCountry(user));
        } catch (error) {
          if (error instanceof SnapTradeReconnectRequired) throw reconnect();
          throw error;
        }
        if (!chosen) {
          throw userError(
            "SYMBOL_NOT_FOUND",
            "SnapTrade couldn't find that ticker in your accounts. Connect a brokerage first, or search.",
          );
        }
        return fresh(ctx);
      },
    }),

    chooseFundSymbol: t.field({
      type: ViewerRef,
      description: "Chooses a `searchSymbols` result as the fund.",
      args: { symbol: t.arg({ type: FundSymbolInput, required: true }) },
      resolve: async (_, { symbol }, ctx) => {
        const currency = symbol.currency.trim().toUpperCase();
        if (!/^[A-Z]{3}$/.test(currency) || !symbol.ticker.trim() || !symbol.name.trim()) {
          throw userError("BAD_USER_INPUT", "That result was incomplete. Search again.");
        }
        await setTargetEtf(ctx.db, viewerOf(ctx).id, {
          symbolId: String(symbol.symbolId),
          ticker: symbol.ticker.trim(),
          name: symbol.name.trim(),
          currency,
        });
        return fresh(ctx);
      },
    }),

    setRoom: t.field({
      type: ViewerRef,
      description:
        "Records a limit's room as of a day. Contributions the brokerage reports after that day come off it.",
      args: {
        roomType: t.arg({ type: RoomTypeEnum, required: true }),
        roomCents: t.arg({ type: "Cents", required: true }),
        asOf: t.arg({ type: "Date", required: true }),
      },
      resolve: async (_, { roomType, roomCents, asOf }, ctx) => {
        const user = viewerOf(ctx);
        if (!ROOM_TYPES_BY_COUNTRY[effectiveCountry(user)].includes(roomType)) {
          throw userError("BAD_USER_INPUT", "Unknown account type.");
        }
        if (roomCents < 0) {
          throw userError("BAD_USER_INPUT", "Enter the room in dollars and the date it was true.");
        }
        await setRoomBaseline(ctx.db, user.id, roomType, roomCents, asOf);
        // Contributions after the new date are read now, as on the web.
        await syncUser(ctx.db, { ...user, lastSyncedAt: null }, { force: true });
        return fresh(ctx);
      },
    }),

    clearRoom: t.field({
      type: ViewerRef,
      args: { roomType: t.arg({ type: RoomTypeEnum, required: true }) },
      resolve: async (_, { roomType }, ctx) => {
        await clearRoomBaseline(ctx.db, viewerOf(ctx).id, roomType);
        return fresh(ctx);
      },
    }),

    invest: t.field({
      type: OrderBatchRef,
      description:
        "Places the buy plan: one market day order per included account with cash. The plan is rebuilt and re-priced on the server; `priceCents` is the price the user confirmed, used only when no fresher one exists. Refusals come back as errors coded NO_FUND, RECONNECT_REQUIRED, TRADE_SCOPE_MISSING, MARKET_CLOSED, NO_PRICE or NOTHING_TO_TRADE.",
      args: { priceCents: t.arg({ type: "Cents" }) },
      resolve: async (_, { priceCents }, ctx) =>
        batchOrRefusal(
          ctx,
          await placeInvestBatch(ctx.db, viewerOf(ctx), {
            shownPriceCents: priceCents ?? null,
            now: ctx.now,
          }),
        ),
    }),

    withdraw: t.field({
      type: OrderBatchRef,
      description:
        "Places the sell plan for `amountCents`, in withdrawal order. Same refusals as `invest`.",
      args: {
        amountCents: t.arg({ type: "Cents", required: true }),
        priceCents: t.arg({ type: "Cents" }),
      },
      resolve: async (_, { amountCents, priceCents }, ctx) => {
        if (amountCents <= 0) throw userError("BAD_USER_INPUT", "Enter an amount to withdraw.");
        return batchOrRefusal(
          ctx,
          await placeWithdrawBatch(ctx.db, viewerOf(ctx), {
            amountCents,
            shownPriceCents: priceCents ?? null,
            now: ctx.now,
          }),
        );
      },
    }),
  }),
});

export const schema = builder.toSchema({ sortSchema: true });
