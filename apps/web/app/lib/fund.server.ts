import type { Db } from "@noadviceneeded/db";
import { HOME_CURRENCY, findAllInOne, type Country } from "@noadviceneeded/engine";
import type { SnapTradeUniversalSymbol } from "@noadviceneeded/snaptrade";

import { listAccounts, setTargetEtf } from "./portfolio.server.js";
import { getSnapTradeClient } from "./snaptrade.server.js";

export interface SymbolView {
  id: string;
  ticker: string;
  name: string;
  currency: string;
  exchange: string;
}

function view(s: SnapTradeUniversalSymbol): SymbolView {
  return {
    id: s.id,
    ticker: s.symbol,
    name: s.description ?? s.symbol,
    currency: s.currency?.code ?? "CAD",
    exchange: s.exchange?.code ?? s.exchange?.mic_code ?? "",
  };
}

/** Symbol ids are per SnapTrade, so searches run within any active account. Null without one. */
async function searchAccount(db: Db, userId: string) {
  const accounts = await listAccounts(db, userId);
  return accounts.find((a) => a.connectionStatus === "active")?.snaptradeAccountId ?? null;
}

/** Up to 20 symbols matching `query`, or null when no brokerage is connected to search in. */
export async function searchSymbols(
  db: Db,
  userId: string,
  query: string,
): Promise<SymbolView[] | null> {
  const accountId = await searchAccount(db, userId);
  if (!accountId) return null;
  const client = await getSnapTradeClient(userId);
  const results = await client.searchAccountSymbols(accountId, query);
  return results.slice(0, 20).map(view);
}

/**
 * The exact Yahoo-style match ("VEQT.TO", "AOA") wins; a bare raw symbol in
 * the country's home currency is the fallback.
 */
async function resolveTicker(
  db: Db,
  userId: string,
  ticker: string,
  country: Country,
): Promise<SymbolView | null> {
  const accountId = await searchAccount(db, userId);
  if (!accountId) return null;
  const client = await getSnapTradeClient(userId);
  const raw = ticker.replace(/\.TO$/i, "");
  const results = await client.searchAccountSymbols(accountId, raw);
  const exact = results.find((s) => s.symbol.toUpperCase() === ticker.toUpperCase());
  const home = results.find(
    (s) =>
      (s.raw_symbol ?? s.symbol).toUpperCase() === raw.toUpperCase() &&
      (s.currency?.code ?? "").toUpperCase() === HOME_CURRENCY[country],
  );
  const found = exact ?? home;
  return found ? view(found) : null;
}

/**
 * Makes `ticker` the user's fund, keeping the curated name for a listed
 * all-in-one. False when SnapTrade cannot find it in the user's accounts.
 */
export async function chooseFundByTicker(
  db: Db,
  userId: string,
  ticker: string,
  country: Country,
): Promise<boolean> {
  const listed = findAllInOne(ticker, country);
  const symbol = await resolveTicker(db, userId, listed?.ticker ?? ticker, country);
  if (!symbol) return false;
  await setTargetEtf(db, userId, {
    symbolId: symbol.id,
    ticker: symbol.ticker,
    name: listed?.name ?? symbol.name,
    currency: symbol.currency,
  });
  return true;
}
