import { allInOneEtfs } from "@noadviceneeded/engine";
import { Form, redirect, useNavigation } from "react-router";
import { z } from "zod";

import { Button, Card, Label, Notice, Ribbon } from "~/components/ui";
import { COUNTRY_COPY, effectiveCountry } from "~/lib/country";
import { getDb } from "~/lib/db.server";
import { chooseFundByTicker, searchSymbols } from "~/lib/fund.server";
import { listAccounts, setTargetEtf } from "~/lib/portfolio.server";
import { requireUser } from "~/lib/session.server";
import { SnapTradeReconnectRequired } from "~/lib/snaptrade.server";

import type { Route } from "./+types/app.etf";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "ETF · No Advice Needed" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const accounts = await listAccounts(getDb(), user.id);
  return {
    country: effectiveCountry(user),
    current: user.targetTicker ? { ticker: user.targetTicker, name: user.targetName } : null,
    hasActiveAccount: accounts.some((a) => a.connectionStatus === "active"),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();
  const intent = form.get("intent");

  try {
    if (intent === "choose") {
      const ticker = z.string().trim().min(1).max(20).safeParse(form.get("ticker"));
      if (!ticker.success) return { error: "Pick an ETF from the list.", results: null };
      const chosen = await chooseFundByTicker(
        getDb(),
        user.id,
        ticker.data,
        effectiveCountry(user),
      );
      if (!chosen) {
        return {
          error:
            "SnapTrade couldn't find that ticker in your accounts. Connect a brokerage first, or search below.",
          results: null,
        };
      }
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
      const results = await searchSymbols(getDb(), user.id, q.data);
      if (!results) return { error: "Connect a brokerage before searching.", results: null };
      return { error: null, results };
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
  const { country, current, hasActiveAccount } = loaderData;
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const choosing = busy && navigation.formData?.get("intent") === "choose";
  const chosenTicker = choosing ? String(navigation.formData?.get("ticker")) : null;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-8">
        <h1 className="text-3xl sm:text-mega">
          One fund.
          <br />
          Every account.
        </h1>
        <Form method="post" className="w-full max-w-xs">
          <input type="hidden" name="intent" value="search" />
          <label htmlFor="q" className="label">
            or search any symbol
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="q"
              type="search"
              name="q"
              placeholder={COUNTRY_COPY[country].searchExample}
              className="min-w-0 flex-1"
              required
            />
            <Button type="submit" variant="secondary" disabled={busy || !hasActiveAccount}>
              Go
            </Button>
          </div>
        </Form>
      </div>

      {current && (
        <Notice tone="success" className="mt-6">
          Every included account holds <strong>{current.ticker.replace(/\.TO$/, "")}</strong>
          {current.name ? ` · ${current.name}` : ""}. Switching changes future orders only; nothing
          is bought or sold.
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

      {actionData?.results && (
        <Card className="mt-6">
          <Label>search results</Label>
          <ul className="mt-4 flex flex-col gap-2">
            {actionData.results.length === 0 && (
              <li className="text-sm text-ink-muted">No matches.</li>
            )}
            {actionData.results.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-tile bg-raised px-5 py-4"
              >
                <span className="font-display text-xl font-extrabold">{r.ticker}</span>
                <span className="text-sm text-ink-muted">{r.name}</span>
                <Label className="ml-auto">
                  {r.exchange} · {r.currency}
                </Label>
                <Form method="post">
                  <input type="hidden" name="intent" value="choose-id" />
                  <input type="hidden" name="symbolId" value={r.id} />
                  <input type="hidden" name="ticker" value={r.ticker} />
                  <input type="hidden" name="name" value={r.name} />
                  <input type="hidden" name="currency" value={r.currency} />
                  <Button type="submit" size="sm" disabled={busy}>
                    Use this
                  </Button>
                </Form>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {allInOneEtfs(country).map((e) => {
          const chosen = current?.ticker === e.ticker;
          return (
            <Form method="post" key={e.ticker}>
              <input type="hidden" name="intent" value="choose" />
              <input type="hidden" name="ticker" value={e.ticker} />
              <button
                type="submit"
                disabled={busy || !hasActiveAccount}
                className={`w-full rounded-card border-2 bg-surface p-6 text-left transition disabled:opacity-60 ${
                  chosen ? "border-accent" : "border-line hover:border-ink-muted"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`font-display text-4xl font-extrabold tracking-tighter ${
                      chosen ? "text-accent" : ""
                    }`}
                  >
                    {e.ticker.replace(/\.TO$/, "")}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.12em] uppercase ${
                      chosen ? "bg-accent text-canvas" : "bg-raised text-ink-muted"
                    }`}
                  >
                    {chosenTicker === e.ticker ? "choosing…" : chosen ? "in use" : "switch"}
                  </span>
                </div>
                <p className="mt-3 text-sm text-ink-muted">{e.name}</p>
                <Ribbon
                  className="mt-5 h-3"
                  segments={[
                    {
                      key: "equity",
                      weight: e.equityPercent,
                      fill: chosen ? "bg-accent" : "bg-tier-3",
                    },
                    { key: "bonds", weight: 100 - e.equityPercent, fill: "bg-line" },
                  ]}
                />
                <p className="mt-3 font-mono text-[10px] tracking-[0.14em] text-ink-muted uppercase">
                  {e.equityPercent === 100
                    ? "100% stocks"
                    : `${e.equityPercent}% stocks · ${100 - e.equityPercent}% bonds`}{" "}
                  · {e.provider}
                </p>
              </button>
            </Form>
          );
        })}
      </section>

      <p className="mt-8 max-w-lg text-xs text-ink-muted">
        All of these are diversified and rebalanced for you, which is why one is enough. The pick is
        yours: this app does not rank them or name a favourite.
      </p>
    </>
  );
}
