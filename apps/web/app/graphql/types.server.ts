import type { User } from "@noadviceneeded/db";
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_LONG_NAMES,
  CONTRIBUTION_NOTES,
  HOME_CURRENCY,
  ROOM_LABELS,
  ROOM_NOTES,
  WITHDRAWAL_NOTES,
  allInOneEtfs,
  planBuys,
  planSells,
  roomTypeFor,
  sellableCents,
  suggestDeposit,
  type AllInOneEtf,
  type BuyLeg,
  type BuyPlan,
  type BuySkipReason,
  type DepositSuggestion,
  type SellLeg,
  type SellPlan,
  type SellSkipReason,
} from "@noadviceneeded/engine";

import { effectiveCountry } from "../lib/country.js";
import { searchSymbols, type SymbolView } from "../lib/fund.server.js";
import { marketClosedCopy, marketView, type MarketView } from "../lib/market.js";
import { resolvePrice, type PriceLookup } from "../lib/plan.server.js";
import {
  getOrderBatch,
  listOrderBatches,
  listRoomActivities,
  summarizePortfolio,
  type BatchWithOrders,
  type OrderWithAccount,
  type PlanAccountRow,
  type PortfolioSummary,
  type RoomActivityRow,
} from "../lib/portfolio.server.js";
import { roomByType, type RoomSummary } from "../lib/room.server.js";
import { SnapTradeReconnectRequired } from "../lib/snaptrade.server.js";
import {
  AccountTypeEnum,
  BuySkipReasonEnum,
  ConnectionStatusEnum,
  CountryEnum,
  ExchangeEnum,
  MarketClosedReasonEnum,
  OrderBatchKindEnum,
  OrderSideEnum,
  PriceSourceEnum,
  RankOrderEnum,
  RoomTypeEnum,
  SellSkipReasonEnum,
  builder,
} from "./builder.server.js";
import { isUuid, userError, type GraphQLContext } from "./context.server.js";

async function accountById(ctx: GraphQLContext, id: string): Promise<PlanAccountRow> {
  const found = (await ctx.planAccounts()).find((a) => a.id === id);
  if (!found) throw new Error(`plan account ${id} vanished mid-request`);
  return found;
}

export const AccountRef = builder.objectRef<PlanAccountRow>("Account").implement({
  description: "One brokerage account as the plans see it, with the user's choices on it.",
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    numberMasked: t.exposeString("numberMasked"),
    brokerageName: t.exposeString("brokerageName"),
    rawType: t.exposeString("rawType", {
      nullable: true,
      description: "The brokerage's own type string, before classification.",
    }),
    accountType: t.expose("accountType", { type: AccountTypeEnum }),
    typeLabel: t.string({ resolve: (a) => ACCOUNT_TYPE_LABELS[a.accountType] }),
    typeName: t.string({ resolve: (a) => ACCOUNT_TYPE_LONG_NAMES[a.accountType] }),
    roomType: t.field({
      type: RoomTypeEnum,
      nullable: true,
      description: "The limit this account's contributions count against, if any.",
      resolve: (a) => roomTypeFor(a.accountType),
    }),
    contributionNote: t.string({ resolve: (a) => CONTRIBUTION_NOTES[a.accountType] }),
    withdrawalNote: t.string({ resolve: (a) => WITHDRAWAL_NOTES[a.accountType] }),
    included: t.exposeBoolean("included", { description: "Part of the buy and sell plans." }),
    fractional: t.exposeBoolean("fractional", {
      description: "Orders here are sized as a dollar amount instead of whole units (D-016).",
    }),
    contributionRank: t.exposeInt("contributionRank"),
    withdrawalRank: t.exposeInt("withdrawalRank"),
    currency: t.exposeString("currency"),
    valueCents: t.expose("valueCents", { type: "Cents", nullable: true }),
    cashCents: t.expose("cashCents", {
      type: "Cents",
      nullable: true,
      description: "Cash in the fund's currency; null when SnapTrade sent none.",
    }),
    cashAsOf: t.expose("cashAsOf", { type: "DateTime", nullable: true }),
    positionUnits: t.exposeFloat("positionUnits", { description: "Units of the fund held here." }),
    holdingPriceCents: t.expose("holdingPriceCents", { type: "Cents", nullable: true }),
    statusRaw: t.exposeString("statusRaw", { nullable: true }),
    connectionStatus: t.expose("connectionStatus", { type: ConnectionStatusEnum }),
    connectionCanTrade: t.exposeBoolean("connectionCanTrade", {
      description: "The brokerage login allows trading, whatever the token's scope.",
    }),
    canTrade: t.exposeBoolean("canTrade", {
      description: "Open, active, trading-capable, and the token carries `trade`.",
    }),
  }),
});

export const FundRef = builder.objectRef<User>("Fund").implement({
  description: "The one all-in-one ETF held in every account.",
  fields: (t) => ({
    symbolId: t.string({ resolve: (u) => u.targetSymbolId ?? "" }),
    ticker: t.string({ resolve: (u) => u.targetTicker ?? "" }),
    name: t.string({ nullable: true, resolve: (u) => u.targetName }),
    currency: t.exposeString("targetCurrency"),
  }),
});

export const AllInOneEtfRef = builder.objectRef<AllInOneEtf>("AllInOneEtf").implement({
  fields: (t) => ({
    ticker: t.exposeString("ticker"),
    name: t.exposeString("name"),
    provider: t.exposeString("provider"),
    equityPercent: t.exposeInt("equityPercent"),
    country: t.expose("country", { type: CountryEnum }),
  }),
});

export const SymbolRef = builder.objectRef<SymbolView>("Symbol").implement({
  description: "A SnapTrade symbol search result.",
  fields: (t) => ({
    id: t.exposeID("id", { description: "SnapTrade universal symbol id." }),
    ticker: t.exposeString("ticker"),
    name: t.exposeString("name"),
    currency: t.exposeString("currency"),
    exchange: t.exposeString("exchange"),
  }),
});

export const MarketRef = builder.objectRef<MarketView>("Market").implement({
  description: "Whether orders can be placed now (D-017).",
  fields: (t) => ({
    exchange: t.expose("exchange", { type: ExchangeEnum }),
    open: t.exposeBoolean("open"),
    reason: t.expose("reason", { type: MarketClosedReasonEnum, nullable: true }),
    holiday: t.exposeString("holiday", { nullable: true }),
    nextOpen: t.expose("nextOpen", { type: "DateTime" }),
    closedMessage: t.string({
      nullable: true,
      description: "Why orders are off and when they come back; null while open.",
      resolve: (m) => (m.open ? null : marketClosedCopy(m)),
    }),
  }),
});

const ReadyRef = builder
  .objectRef<NonNullable<PortfolioSummary["ready"]>>("ReadyToInvest")
  .implement({
    fields: (t) => ({
      units: t.exposeFloat("units"),
      legs: t.exposeInt("legs"),
    }),
  });

export const PortfolioRef = builder.objectRef<PortfolioSummary>("Portfolio").implement({
  description: "The dashboard figures across included accounts.",
  fields: (t) => ({
    accountCount: t.exposeInt("accountCount"),
    includedCount: t.exposeInt("includedCount"),
    totalValueCents: t.expose("totalValueCents", { type: "Cents", nullable: true }),
    cashCents: t.expose("cashCents", { type: "Cents", nullable: true }),
    unitsHeld: t.exposeFloat("unitsHeld"),
    priceCents: t.expose("priceCents", {
      type: "Cents",
      nullable: true,
      description: "Last price SnapTrade reported on a held position; not a live quote.",
    }),
    heldValueCents: t.expose("heldValueCents", { type: "Cents", nullable: true }),
    ready: t.expose("ready", { type: ReadyRef, nullable: true }),
  }),
});

export const DepositSuggestionRef = builder
  .objectRef<DepositSuggestion>("DepositSuggestion")
  .implement({
    description: "The account the user's own contribution order names next.",
    fields: (t) => ({
      account: t.field({ type: AccountRef, resolve: (s, _, ctx) => accountById(ctx, s.accountId) }),
      accountType: t.expose("accountType", { type: AccountTypeEnum }),
      roomCents: t.expose("roomCents", {
        type: "Cents",
        nullable: true,
        description: "Room left in its limit; null for no limit or no baseline entered.",
      }),
    }),
  });

export const RoomLimitRef = builder.objectRef<RoomSummary>("RoomLimit").implement({
  fields: (t) => ({
    roomType: t.expose("roomType", { type: RoomTypeEnum }),
    label: t.string({ resolve: (r) => ROOM_LABELS[r.roomType] }),
    note: t.string({ resolve: (r) => ROOM_NOTES[r.roomType] }),
    baselineCents: t.field({
      type: "Cents",
      nullable: true,
      resolve: (r) => r.baseline?.roomCents ?? null,
    }),
    asOf: t.field({ type: "Date", nullable: true, resolve: (r) => r.baseline?.asOf ?? null }),
    contributedSinceCents: t.expose("contributedSinceCents", { type: "Cents" }),
    remainingCents: t.expose("remainingCents", { type: "Cents", nullable: true }),
    accountCount: t.exposeInt("accountCount"),
  }),
});

export const RoomActivityRef = builder.objectRef<RoomActivityRow>("RoomActivity").implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    accountType: t.expose("accountType", { type: AccountTypeEnum }),
    typeLabel: t.string({ resolve: (a) => ACCOUNT_TYPE_LABELS[a.accountType] }),
    roomType: t.expose("roomType", { type: RoomTypeEnum }),
    accountName: t.exposeString("accountName"),
    type: t.exposeString("type", { description: "CONTRIBUTION or WITHDRAWAL." }),
    amountCents: t.expose("amountCents", { type: "Cents" }),
    tradeDate: t.expose("tradeDate", { type: "Date" }),
    description: t.exposeString("description", { nullable: true }),
  }),
});

export const OrderRef = builder.objectRef<OrderWithAccount>("Order").implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    accountId: t.exposeID("accountId"),
    accountName: t.exposeString("accountName"),
    brokerageName: t.exposeString("brokerageName"),
    side: t.expose("side", { type: OrderSideEnum }),
    ticker: t.exposeString("ticker"),
    units: t.exposeFloat("units"),
    notionalCents: t.expose("notionalCents", {
      type: "Cents",
      nullable: true,
      description: "The dollar amount sent; null when the order was sized in units.",
    }),
    estimatedCents: t.expose("estimatedCents", { type: "Cents" }),
    status: t.exposeString("status", {
      description: "SnapTrade's status (PENDING, EXECUTED, ...) or our own: planned, failed.",
    }),
    error: t.exposeString("error", { nullable: true }),
    brokerageOrderId: t.exposeString("brokerageOrderId", { nullable: true }),
    placedAt: t.expose("placedAt", { type: "DateTime", nullable: true }),
  }),
});

export const OrderBatchRef = builder.objectRef<BatchWithOrders>("OrderBatch").implement({
  description: "One confirmed Invest or Withdraw.",
  fields: (t) => ({
    id: t.exposeID("id"),
    kind: t.expose("kind", { type: OrderBatchKindEnum }),
    ticker: t.exposeString("ticker"),
    priceCents: t.expose("priceCents", { type: "Cents" }),
    requestedCents: t.expose("requestedCents", { type: "Cents", nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    orders: t.expose("orders", { type: [OrderRef] }),
  }),
});

const BuyLegRef = builder.objectRef<BuyLeg>("BuyLeg").implement({
  fields: (t) => ({
    account: t.field({ type: AccountRef, resolve: (l, _, ctx) => accountById(ctx, l.accountId) }),
    units: t.exposeFloat("units", {
      description: "Whole units, or an estimate when the leg is a dollar amount.",
    }),
    notionalCents: t.expose("notionalCents", { type: "Cents", nullable: true }),
    estimatedCostCents: t.expose("estimatedCostCents", { type: "Cents" }),
    cashAfterCents: t.expose("cashAfterCents", { type: "Cents" }),
  }),
});

const BuySkipRef = builder
  .objectRef<{ accountId: string; reason: BuySkipReason }>("BuySkip")
  .implement({
    fields: (t) => ({
      account: t.field({ type: AccountRef, resolve: (s, _, ctx) => accountById(ctx, s.accountId) }),
      reason: t.expose("reason", { type: BuySkipReasonEnum }),
    }),
  });

export const BuyPlanRef = builder.objectRef<BuyPlan>("BuyPlan").implement({
  description: "What each included account's own cash buys. Cash never moves between accounts.",
  fields: (t) => ({
    priceCents: t.expose("priceCents", { type: "Cents" }),
    legs: t.expose("legs", { type: [BuyLegRef] }),
    skipped: t.expose("skipped", { type: [BuySkipRef] }),
    totalUnits: t.exposeFloat("totalUnits"),
    totalCostCents: t.expose("totalCostCents", { type: "Cents" }),
    totalCashCents: t.expose("totalCashCents", { type: "Cents" }),
  }),
});

const SellLegRef = builder.objectRef<SellLeg>("SellLeg").implement({
  fields: (t) => ({
    account: t.field({ type: AccountRef, resolve: (l, _, ctx) => accountById(ctx, l.accountId) }),
    units: t.exposeFloat("units"),
    notionalCents: t.expose("notionalCents", { type: "Cents", nullable: true }),
    estimatedProceedsCents: t.expose("estimatedProceedsCents", { type: "Cents" }),
    unitsAfter: t.exposeFloat("unitsAfter"),
  }),
});

const SellSkipRef = builder
  .objectRef<{ accountId: string; reason: SellSkipReason }>("SellSkip")
  .implement({
    fields: (t) => ({
      account: t.field({ type: AccountRef, resolve: (s, _, ctx) => accountById(ctx, s.accountId) }),
      reason: t.expose("reason", { type: SellSkipReasonEnum }),
    }),
  });

export const SellPlanRef = builder.objectRef<SellPlan>("SellPlan").implement({
  description: "Sells in withdrawal order until the amount is covered.",
  fields: (t) => ({
    priceCents: t.expose("priceCents", { type: "Cents" }),
    requestedCents: t.expose("requestedCents", { type: "Cents" }),
    legs: t.expose("legs", { type: [SellLegRef] }),
    skipped: t.expose("skipped", { type: [SellSkipRef] }),
    totalUnits: t.exposeFloat("totalUnits"),
    totalProceedsCents: t.expose("totalProceedsCents", { type: "Cents" }),
    shortfallCents: t.expose("shortfallCents", {
      type: "Cents",
      description: "How much of the request no account can cover.",
    }),
  }),
});

export const QuoteRef = builder.objectRef<PriceLookup>("Quote").implement({
  description:
    "The price plans are sized at: a typed price, a brokerage quote, or the last held-position price, in that order.",
  fields: (t) => ({
    priceCents: t.expose("priceCents", { type: "Cents" }),
    source: t.expose("source", { type: PriceSourceEnum }),
    asOf: t.expose("asOf", { type: "DateTime", nullable: true }),
    buyPlan: t.field({
      type: BuyPlanRef,
      resolve: async (q, _, ctx) =>
        planBuys(await ctx.planAccounts(), { priceCents: q.priceCents }),
    }),
    sellPlan: t.field({
      type: SellPlanRef,
      args: { amountCents: t.arg({ type: "Cents", required: true }) },
      resolve: async (q, { amountCents }, ctx) => {
        if (amountCents <= 0) throw userError("BAD_USER_INPUT", "Enter an amount to withdraw.");
        return planSells(await ctx.planAccounts(), { amountCents, priceCents: q.priceCents });
      },
    }),
    sellableCents: t.field({
      type: "Cents",
      description: "The most a withdrawal could raise across included accounts at this price.",
      resolve: async (q, _, ctx) =>
        (await ctx.planAccounts())
          .filter((a) => a.included)
          .reduce((n, a) => n + sellableCents(a, q.priceCents), 0),
    }),
  }),
});

export const ViewerRef = builder.objectRef<User>("Viewer").implement({
  description: "The signed-in user and everything the app shows them.",
  fields: (t) => ({
    id: t.exposeID("id"),
    email: t.exposeString("email"),
    displayName: t.exposeString("displayName", { nullable: true }),
    country: t.field({
      type: CountryEnum,
      description: "Where the user invests. Canada until they choose.",
      resolve: (u) => effectiveCountry(u),
    }),
    countryChosen: t.boolean({
      description: "False until the user confirms a country; ask before anything else.",
      resolve: (u) => u.country !== null,
    }),
    homeCurrency: t.string({ resolve: (u) => HOME_CURRENCY[effectiveCountry(u)] }),
    tradeScope: t.boolean({
      description: "The SnapTrade grant carries `trade`. Until then everything is read-only.",
      resolve: (_, __, ctx) => ctx.tradeScope(),
    }),
    lastSyncedAt: t.expose("lastSyncedAt", { type: "DateTime", nullable: true }),
    fund: t.field({
      type: FundRef,
      nullable: true,
      resolve: (u) => (u.targetSymbolId && u.targetTicker ? u : null),
    }),
    fundChoices: t.field({
      type: [AllInOneEtfRef],
      description: "The curated all-in-one ETFs for the user's country.",
      resolve: (u) => [...allInOneEtfs(effectiveCountry(u))],
    }),
    searchSymbols: t.field({
      type: [SymbolRef],
      description: "Symbol search within a connected account. Reads SnapTrade.",
      args: { query: t.arg.string({ required: true }) },
      resolve: async (u, { query }, ctx) => {
        const q = query.trim();
        if (q.length === 0 || q.length > 40) {
          throw userError("BAD_USER_INPUT", "Type a ticker or fund name to search.");
        }
        try {
          const results = await searchSymbols(ctx.db, u.id, q);
          if (!results) throw userError("NO_BROKERAGE", "Connect a brokerage before searching.");
          return results;
        } catch (error) {
          if (error instanceof SnapTradeReconnectRequired) {
            throw userError(
              "RECONNECT_REQUIRED",
              "Your SnapTrade access has ended. Sign in again to reconnect.",
            );
          }
          throw error;
        }
      },
    }),
    market: t.field({
      type: MarketRef,
      resolve: (u, _, ctx) => marketView(effectiveCountry(u), ctx.now),
    }),
    accounts: t.field({
      type: [AccountRef],
      description: "Every account. Pass `order` to list them in one of the two plan orders.",
      args: { order: t.arg({ type: RankOrderEnum }) },
      resolve: async (_, { order }, ctx) => {
        const rows = await ctx.planAccounts();
        if (!order) return rows;
        const rank = (a: PlanAccountRow) =>
          order === "contribution" ? a.contributionRank : a.withdrawalRank;
        return [...rows].sort((x, y) => rank(x) - rank(y) || x.name.localeCompare(y.name));
      },
    }),
    account: t.field({
      type: AccountRef,
      nullable: true,
      args: { id: t.arg.id({ required: true }) },
      resolve: async (_, { id }, ctx) =>
        (await ctx.planAccounts()).find((a) => a.id === String(id)) ?? null,
    }),
    portfolio: t.field({
      type: PortfolioRef,
      resolve: async (_, __, ctx) => summarizePortfolio(await ctx.planAccounts()),
    }),
    nextDeposit: t.field({
      type: DepositSuggestionRef,
      nullable: true,
      description: "The first included account in contribution order whose limit has room.",
      resolve: async (_, __, ctx) =>
        suggestDeposit(await ctx.planAccounts(), roomByType(await ctx.roomSummary())),
    }),
    room: t.field({ type: [RoomLimitRef], resolve: (_, __, ctx) => ctx.roomSummary() }),
    roomActivities: t.field({
      type: [RoomActivityRef],
      description: "Contributions and withdrawals in registered accounts, newest first.",
      args: { limit: t.arg.int({ defaultValue: 100 }) },
      resolve: async (u, { limit }, ctx) =>
        (await listRoomActivities(ctx.db, u.id)).slice(0, clamp(limit, 1, 500)),
    }),
    orderBatches: t.field({
      type: [OrderBatchRef],
      description: "Newest first.",
      args: { limit: t.arg.int({ defaultValue: 50 }) },
      resolve: (u, { limit }, ctx) => listOrderBatches(ctx.db, u.id, clamp(limit, 1, 200)),
    }),
    orderBatch: t.field({
      type: OrderBatchRef,
      nullable: true,
      args: { id: t.arg.id({ required: true }) },
      resolve: (u, { id }, ctx) => {
        const batchId = String(id);
        return isUuid(batchId) ? getOrderBatch(ctx.db, u.id, batchId) : null;
      },
    }),
    quote: t.field({
      type: QuoteRef,
      nullable: true,
      description:
        "The price to size plans at. Null with no fund chosen or no price anywhere; then ask for `manualPriceCents`. May read a brokerage quote.",
      args: { manualPriceCents: t.arg({ type: "Cents" }) },
      resolve: async (u, { manualPriceCents }, ctx) => {
        if (!u.targetSymbolId) return null;
        return resolvePrice(await ctx.snaptrade(), u.targetSymbolId, await ctx.planAccounts(), {
          manualPriceCents: manualPriceCents ?? null,
          now: ctx.now,
        });
      },
    }),
  }),
});

function clamp(n: number | null | undefined, min: number, max: number): number {
  return Math.min(max, Math.max(min, n ?? max));
}
