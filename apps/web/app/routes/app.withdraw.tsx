import {
  ACCOUNT_TYPE_LABELS,
  HOME_CURRENCY,
  WITHDRAWAL_NOTES,
  planSells,
  sellableUnits,
  type SellSkipReason,
} from "@noadviceneeded/engine";
import { Form, Link, redirect, useNavigation } from "react-router";
import { z } from "zod";

import { SyncStatus } from "~/components/sync-status";
import { AccountName, Button, Card, EmptyState, Label, Notice, TypeTag } from "~/components/ui";
import { effectiveCountry } from "~/lib/country";
import { getDb } from "~/lib/db.server";
import { dateTime, parseDollarsToCents, plural, units } from "~/lib/format";
import { resolvePrice } from "~/lib/plan.server";
import { buildPlanAccounts } from "~/lib/portfolio.server";
import { requireUser } from "~/lib/session.server";
import { getSnapTradeClient, hasTradeScope } from "~/lib/snaptrade.server";
import { syncUser } from "~/lib/sync.server";
import { executeBatch } from "~/lib/trading.server";

import { useMoney } from "~/lib/use-money";
import type { Route } from "./+types/app.withdraw";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Withdraw · No Advice Needed" }];
}

const skipCopy: Record<SellSkipReason, string> = {
  excluded: "Not in the plan",
  not_tradable: "Read-only connection",
  no_position: "Holds nothing to sell",
  not_needed: "Not needed for this amount",
};

async function load(
  user: Awaited<ReturnType<typeof requireUser>>,
  options: { force?: boolean; amountCents?: number | null; manualPriceCents?: number | null } = {},
) {
  if (!user.targetSymbolId || !user.targetTicker) throw redirect("/app/etf");
  const db = getDb();
  const sync = await syncUser(db, user, { force: options.force });
  const tradeScope = await hasTradeScope(user.id);
  const accounts = await buildPlanAccounts(db, user.id, {
    targetSymbolId: user.targetSymbolId,
    tradeScope,
  });
  const client = await getSnapTradeClient(user.id).catch(() => null);
  const price = await resolvePrice(client, user.targetSymbolId, accounts, {
    manualPriceCents: options.manualPriceCents,
  });
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const amountCents = options.amountCents ?? null;
  const plan =
    price && amountCents
      ? planSells(accounts, { amountCents, priceCents: price.priceCents })
      : null;
  const heldCents = Math.round(
    accounts
      .filter((a) => a.included)
      .reduce((n, a) => n + sellableUnits(a) * (price?.priceCents ?? 0), 0),
  );
  return {
    sync: { status: sync.status, syncedAt: sync.syncedAt?.toISOString() ?? null },
    tradeScope,
    homeCurrency: HOME_CURRENCY[effectiveCountry(user)],
    target: { ticker: user.targetTicker, name: user.targetName },
    price,
    amountCents,
    heldCents: price ? heldCents : null,
    plan: plan
      ? {
          ...plan,
          legs: plan.legs.map((l) => {
            const a = byId.get(l.accountId)!;
            return {
              ...l,
              name: a.name,
              numberMasked: a.numberMasked,
              brokerageName: a.brokerageName,
              accountType: a.accountType,
              typeLabel: ACCOUNT_TYPE_LABELS[a.accountType],
              positionUnits: a.positionUnits,
              fractional: a.fractional,
            };
          }),
          skipped: plan.skipped
            .filter((s) => s.reason !== "excluded" && s.reason !== "not_needed")
            .map((s) => {
              const a = byId.get(s.accountId)!;
              return {
                ...s,
                name: a.name,
                accountType: a.accountType,
                typeLabel: ACCOUNT_TYPE_LABELS[a.accountType],
              };
            }),
        }
      : null,
  };
}

export async function loader({ request, url }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const params = url.searchParams;
  return {
    ...(await load(user, {
      amountCents: parseDollarsToCents(params.get("amount")),
      manualPriceCents: parseDollarsToCents(params.get("price")),
    })),
    error: null as string | null,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "refresh") return { ...(await load(user, { force: true })), error: null };

  if (intent === "execute") {
    if (!user.targetSymbolId || !user.targetTicker) throw redirect("/app/etf");
    const amount = z.coerce.number().int().positive().safeParse(form.get("amountCents"));
    const shown = z.coerce.number().int().positive().safeParse(form.get("priceCents"));
    if (!amount.success) return { ...(await load(user)), error: "Enter an amount to withdraw." };
    const db = getDb();
    let client;
    try {
      client = await getSnapTradeClient(user.id);
    } catch {
      return {
        ...(await load(user)),
        error: "Your SnapTrade access has ended. Sign in again to reconnect.",
      };
    }
    const tradeScope = await hasTradeScope(user.id);
    if (!tradeScope) {
      return {
        ...(await load(user)),
        error: "Enable trading at SnapTrade first (see the banner above).",
      };
    }
    const accounts = await buildPlanAccounts(db, user.id, {
      targetSymbolId: user.targetSymbolId,
      tradeScope,
    });
    const price =
      (await resolvePrice(client, user.targetSymbolId, accounts)) ??
      (shown.success ? { priceCents: shown.data, source: "manual" as const, asOf: null } : null);
    if (!price)
      return { ...(await load(user)), error: "No price is available to size the orders." };
    const plan = planSells(accounts, { amountCents: amount.data, priceCents: price.priceCents });
    if (plan.legs.length === 0) {
      return {
        ...(await load(user, { amountCents: amount.data })),
        error: "No included account holds units to sell.",
      };
    }
    const result = await executeBatch(db, user.id, client, {
      kind: "withdraw",
      side: "sell",
      priceCents: price.priceCents,
      requestedCents: amount.data,
      symbolId: user.targetSymbolId,
      ticker: user.targetTicker,
      legs: plan.legs.map((l) => ({
        accountId: l.accountId,
        units: l.units,
        estimatedCents: l.estimatedProceedsCents,
      })),
    });
    return redirect(`/app/orders?batch=${result.batchId}`);
  }

  return { ...(await load(user)), error: null };
}

export default function Withdraw({ loaderData, actionData }: Route.ComponentProps) {
  const d = actionData ?? loaderData;
  const money = useMoney();
  const navigation = useNavigation();
  const executing = navigation.state !== "idle" && navigation.formData?.get("intent") === "execute";
  const plan = d.plan;
  const canExecute = Boolean(plan && plan.legs.length > 0 && d.tradeScope && d.price);
  const ticker = d.target.ticker.replace(/\.TO$/, "");
  const anyFractional = plan?.legs.some((l) => l.fractional) ?? false;
  const presets = [100000, 500000, 1000000].filter((c) => d.heldCents === null || c <= d.heldCents);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <Form method="get" className="flex-1">
          <label htmlFor="amount" className="label">
            you need · {d.homeCurrency.toLowerCase()}
          </label>
          <div className="mt-2 flex max-w-lg items-baseline gap-3 border-b-2 border-line pb-2">
            <span className="font-display text-4xl font-extrabold text-ink-dim sm:text-5xl">$</span>
            <input
              id="amount"
              type="text"
              name="amount"
              inputMode="decimal"
              placeholder="5,000"
              defaultValue={d.amountCents ? (d.amountCents / 100).toFixed(2) : ""}
              required
              className="figure min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 py-1 text-figure focus-visible:outline-none"
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!d.price && (
              <label className="flex items-center gap-2">
                <Label>price per unit</Label>
                <input type="text" name="price" inputMode="decimal" placeholder="41.20" required />
              </label>
            )}
            <Button type="submit" variant="secondary">
              Plan the sale
            </Button>
            {presets.map((cents) => (
              <Link
                key={cents}
                to={`?amount=${cents / 100}`}
                className="rounded-full border border-line px-4 py-3 font-mono text-[10px] font-bold tracking-[0.12em] text-ink-muted uppercase hover:border-sell hover:text-sell"
              >
                {money(cents, { whole: true })}
              </Link>
            ))}
            {d.heldCents !== null && d.heldCents > 0 && (
              <Link
                to={`?amount=${(d.heldCents / 100).toFixed(2)}`}
                className="rounded-full border border-line px-4 py-3 font-mono text-[10px] font-bold tracking-[0.12em] text-ink-muted uppercase hover:border-sell hover:text-sell"
              >
                everything
              </Link>
            )}
          </div>
          {d.heldCents !== null && (
            <p className="mt-4 max-w-md text-xs text-ink-muted">
              About {money(d.heldCents, { whole: true })} of {ticker} sellable across your included
              accounts
              {d.price
                ? `, at ${money(d.price.priceCents)} ${
                    d.price.source === "quote"
                      ? "(quote)"
                      : d.price.source === "holding"
                        ? `(last price${d.price.asOf ? `, ${dateTime(d.price.asOf)}` : ""})`
                        : "(entered)"
                  }`
                : ""}
              .
            </p>
          )}
        </Form>
        <SyncStatus sync={d.sync} />
      </div>

      {d.error && (
        <Notice tone="danger" className="mt-6">
          {d.error}
        </Notice>
      )}

      {plan && (
        <>
          <Card tone="sell" className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <div>
              <Label>selling</Label>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-4">
                <span className="figure text-figure text-sell">{units(plan.totalUnits)}</span>
                <span className="font-display text-xl font-extrabold">units of {ticker}</span>
              </div>
            </div>
            <div className="sm:text-right">
              <Label>lands as cash</Label>
              <p className="num mt-2 font-mono text-3xl font-bold">
                {money(plan.totalProceedsCents)}
              </p>
              <p className="mt-2 font-mono text-[10px] tracking-[0.12em] text-ink-muted uppercase">
                across {plural(plan.legs.length, "account")}
              </p>
            </div>
          </Card>

          {plan.shortfallCents > 0 && (
            <Notice tone="warn" className="mt-4">
              Selling everything covers {money(plan.totalProceedsCents)}, which is{" "}
              {money(plan.shortfallCents)} short of {money(plan.requestedCents)}.
            </Notice>
          )}

          <section className="mt-4 flex flex-col gap-2">
            {plan.legs.map((l) => (
              <div
                key={l.accountId}
                className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-tile border border-line bg-surface px-6 py-5"
              >
                <TypeTag type={l.accountType} />
                <AccountName
                  name={l.name}
                  numberMasked={l.numberMasked}
                  className="text-sm font-medium"
                />
                <Label>{l.brokerageName}</Label>
                <span className="rounded-full bg-sell-soft px-3 py-1.5 font-mono text-[10px] tracking-[0.1em] text-sell uppercase">
                  {WITHDRAWAL_NOTES[l.accountType]}
                </span>
                <span className="ml-auto flex items-baseline gap-4">
                  <Label>sell</Label>
                  <span className="figure text-2xl">{units(l.units)}</span>
                  {l.fractional && (
                    <span className="font-mono text-[10px] tracking-[0.12em] text-ink-muted uppercase">
                      fractional
                    </span>
                  )}
                  <span className="num w-32 text-right font-mono text-sm font-medium">
                    {money(l.estimatedProceedsCents)}
                  </span>
                </span>
              </div>
            ))}

            {plan.legs.length === 0 && (
              <EmptyState
                title="Nothing to sell"
                body={`No account in your plan holds units of ${ticker} yet.`}
              />
            )}

            {plan.skipped.length > 0 && (
              <ul className="flex flex-wrap items-center gap-3 rounded-tile border border-dashed border-line px-6 py-4">
                <Label>untouched</Label>
                {plan.skipped.map((s) => (
                  <li key={s.accountId} className="flex items-center gap-2">
                    <TypeTag type={s.accountType} />
                    <Label>
                      {s.reason === "not_tradable" && !d.tradeScope
                        ? "trading not enabled"
                        : skipCopy[s.reason]}
                    </Label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Form method="post" className="mt-6 flex flex-wrap items-center gap-6">
            <input type="hidden" name="intent" value="execute" />
            <input type="hidden" name="amountCents" value={plan.requestedCents} />
            <input type="hidden" name="priceCents" value={d.price?.priceCents ?? ""} />
            <div className="min-w-[280px] flex-1">
              <Button type="submit" variant="danger" size="lg" disabled={!canExecute || executing}>
                {executing
                  ? "Placing orders…"
                  : plan.legs.length > 0
                    ? `Place ${plural(plan.legs.length, "sell order")} · ${money(plan.totalProceedsCents)}`
                    : "Nothing to sell"}
              </Button>
            </div>
            <p className="max-w-xs text-xs text-ink-muted">
              Market orders, good for today
              {anyFractional ? ", fractional where marked" : ", whole units only"}. The cash lands
              in each account and settles in a day or two. Moving it to your bank happens at the
              brokerage. Track each order on the{" "}
              <Link to="/app/orders" className="text-accent underline-offset-4 hover:underline">
                Orders page
              </Link>
              .
            </p>
          </Form>
        </>
      )}

      {!plan && (
        <p className="mt-8 max-w-md text-sm text-ink-muted">
          Units are sold from your accounts in withdrawal order until the amount is covered (whole
          units, or fractions where you ticked them), and each type's tax note shows on its row
          before you confirm.
        </p>
      )}
    </>
  );
}
