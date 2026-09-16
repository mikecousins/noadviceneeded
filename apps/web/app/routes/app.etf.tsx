import { ALL_IN_ONE_ETFS, findAllInOne } from "@noadviceneeded/engine";
import type { SnapTradeUniversalSymbol } from "@noadviceneeded/snaptrade";
import { Form, redirect, useNavigation } from "react-router";
import { z } from "zod";

import { Button, Card, Notice, PageTitle } from "~/components/ui";
import { getDb } from "~/lib/db.server";
import { listAccounts, setTargetEtf } from "~/lib/portfolio.server";
import { requireUser } from "~/lib/session.server";
import { SnapTradeReconnectRequired, getSnapTradeClient } from "~/lib/snaptrade.server";

import type { Route } from "./+types/app.etf";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "ETF · No Advice Needed" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const accounts = await listAccounts(getDb(), user.id);
  return {
    current: user.targetTicker ? { ticker: user.targetTicker, name: user.targetName } : null,
    hasActiveAccount: accounts.some((a) => a.connectionStatus === "active"),
  };
}

type SymbolView = { id: string; ticker: string; name: string; currency: string; exchange: string };

function view(s: SnapTradeUniversalSymbol): SymbolView {
  return {
    id: s.id,
    ticker: s.symbol,
    name: s.description ?? s.symbol,
    currency: s.currency?.code ?? "CAD",
    exchange: s.exchange?.code ?? s.exchange?.mic_code ?? "",
  };
}

/**
 * Symbol ids are per SnapTrade, so a ticker is resolved by searching within
 * any active account. The exact Yahoo-style match ("VEQT.TO") wins; a bare
 * raw symbol on a Canadian exchange in CAD is the fallback.
 */
async function resolveTicker(userId: string, ticker: string): Promise<SymbolView | null> {
  const db = getDb();
  const accounts = await listAccounts(db, userId);
  const account = accounts.find((a) => a.connectionStatus === "active");
  if (!account) return null;
  const client = await getSnapTradeClient(userId);
  const raw = ticker.replace(/\.TO$/i, "");
  const results = await client.searchAccountSymbols(account.snaptradeAccountId, raw);
  const exact = results.find((s) => s.symbol.toUpperCase() === ticker.toUpperCase());
  const canadian = results.find(
    (s) =>
      (s.raw_symbol ?? s.symbol).toUpperCase() === raw.toUpperCase() &&
      (s.currency?.code ?? "").toUpperCase() === "CAD",
  );
  const found = exact ?? canadian;
  return found ? view(found) : null;
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();
  const intent = form.get("intent");

  try {
    if (intent === "choose") {
      const ticker = z.string().trim().min(1).max(20).safeParse(form.get("ticker"));
      if (!ticker.success) return { error: "Pick an ETF from the list.", results: null };
      const listed = findAllInOne(ticker.data);
      const symbol = await resolveTicker(user.id, listed?.ticker ?? ticker.data);
      if (!symbol) {
        return {
          error:
            "SnapTrade couldn't find that ticker in your accounts. Connect a brokerage first, or search below.",
          results: null,
        };
      }
      await setTargetEtf(getDb(), user.id, {
        symbolId: symbol.id,
        ticker: symbol.ticker,
        name: listed?.name ?? symbol.name,
        currency: symbol.currency,
      });
      return redirect("/app");
    }

    if (intent === "choose-id") {
      const parsed = z
        .object({
          symbolId: z.string().min(1),
          ticker: z.string().min(1),
          name: z.string().min(1),
          currency: z.string().length(3),
        })
        .safeParse(Object.fromEntries(form));
      if (!parsed.success)
        return { error: "That result was incomplete. Search again.", results: null };
      await setTargetEtf(getDb(), user.id, parsed.data);
      return redirect("/app");
    }

    if (intent === "search") {
      const q = z.string().trim().min(1).max(40).safeParse(form.get("q"));
      if (!q.success) return { error: "Type a ticker or fund name to search.", results: null };
      const accounts = await listAccounts(getDb(), user.id);
      const account = accounts.find((a) => a.connectionStatus === "active");
      if (!account) return { error: "Connect a brokerage before searching.", results: null };
      const client = await getSnapTradeClient(user.id);
      const results = await client.searchAccountSymbols(account.snaptradeAccountId, q.data);
      return { error: null, results: results.slice(0, 20).map(view) };
    }
  } catch (error) {
    if (error instanceof SnapTradeReconnectRequired) {
      return {
        error: "Your SnapTrade access has ended. Sign in again to reconnect.",
        results: null,
      };
    }
    console.error("etf action failed", error instanceof Error ? error.message : error);
    return { error: "SnapTrade didn't answer. Try again in a moment.", results: null };
  }
  return { error: null, results: null };
}

export default function Etf({ loaderData, actionData }: Route.ComponentProps) {
  const { current, hasActiveAccount } = loaderData;
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const choosing = busy && navigation.formData?.get("intent") === "choose";
  const chosenTicker = choosing ? String(navigation.formData?.get("ticker")) : null;

  return (
    <>
      <PageTitle
        title="Your one ETF"
        lede="Guideline two: every included account holds the same all-in-one ETF. Pick from the common Canadian ones, or search for another symbol your brokerage offers."
      />

      {current && (
        <Notice className="mt-4">
          Current choice: <strong>{current.ticker}</strong>
          {current.name ? ` · ${current.name}` : ""}. Choosing another only changes future orders;
          nothing is sold.
        </Notice>
      )}
      {actionData?.error && (
        <Notice tone="danger" className="mt-4">
          {actionData.error}
        </Notice>
      )}
      {!hasActiveAccount && (
        <Notice tone="warn" className="mt-4">
          Symbols are looked up through one of your connected accounts, so connect a brokerage at
          SnapTrade before choosing.
        </Notice>
      )}

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {ALL_IN_ONE_ETFS.map((e) => (
          <Card key={e.ticker} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-medium">
                {e.ticker.replace(/\.TO$/, "")}{" "}
                <span className="text-xs text-ink-muted">{e.provider}</span>
              </p>
              <p className="text-sm text-ink-muted">{e.name}</p>
              <p className="text-xs text-ink-muted">{e.equityPercent}% equities</p>
            </div>
            <Form method="post">
              <input type="hidden" name="intent" value="choose" />
              <input type="hidden" name="ticker" value={e.ticker} />
              <Button
                type="submit"
                variant={current?.ticker === e.ticker ? "secondary" : "primary"}
                disabled={busy || !hasActiveAccount}
              >
                {chosenTicker === e.ticker
                  ? "Choosing…"
                  : current?.ticker === e.ticker
                    ? "Chosen"
                    : "Choose"}
              </Button>
            </Form>
          </Card>
        ))}
      </section>

      <Card className="mt-8">
        <h2 className="text-lg">Search another symbol</h2>
        <Form method="post" className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="intent" value="search" />
          <input type="search" name="q" placeholder="Ticker or name" className="flex-1" required />
          <Button type="submit" variant="secondary" disabled={busy || !hasActiveAccount}>
            Search
          </Button>
        </Form>
        {actionData?.results && (
          <ul className="mt-4 divide-y divide-line text-sm">
            {actionData.results.length === 0 && (
              <li className="py-2 text-ink-muted">No matches.</li>
            )}
            {actionData.results.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 py-2">
                <span>
                  <strong>{r.ticker}</strong> {r.name}
                  <span className="block text-xs text-ink-muted">
                    {r.exchange} · {r.currency}
                  </span>
                </span>
                <Form method="post">
                  <input type="hidden" name="intent" value="choose-id" />
                  <input type="hidden" name="symbolId" value={r.id} />
                  <input type="hidden" name="ticker" value={r.ticker} />
                  <input type="hidden" name="name" value={r.name} />
                  <input type="hidden" name="currency" value={r.currency} />
                  <Button type="submit" variant="secondary" disabled={busy}>
                    Choose
                  </Button>
                </Form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
