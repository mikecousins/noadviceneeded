import {
  ACCOUNT_TYPE_LABELS,
  WITHDRAWAL_NOTES,
  planSells,
  type SellSkipReason,
} from "@noadviceneeded/engine";
import { Form, Link, redirect, useNavigation } from "react-router";
import { z } from "zod";

import { SyncStatus } from "~/components/sync-status";
import { Button, Card, Notice, PageTitle } from "~/components/ui";
import { getDb } from "~/lib/db.server";
import { dateTime, money, parseDollarsToCents, plural, units } from "~/lib/format";
import { resolvePrice } from "~/lib/plan.server";
import { buildPlanAccounts } from "~/lib/portfolio.server";
import { requireUser } from "~/lib/session.server";
import { getSnapTradeClient, hasTradeScope } from "~/lib/snaptrade.server";
import { syncUser } from "~/lib/sync.server";
import { executeBatch } from "~/lib/trading.server";

import type { Route } from "./+types/app.withdraw";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Withdraw · No Advice Needed" }];
}

const skipCopy: Record<SellSkipReason, string> = {
  excluded: "Not in the plan",
  not_tradable: "Read-only connection",
  no_position: "Holds no whole units",
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
  const heldCents = accounts
    .filter((a) => a.included)
    .reduce((n, a) => n + Math.floor(a.positionUnits) * (price?.priceCents ?? 0), 0);
  return {
    sync: { status: sync.status, syncedAt: sync.syncedAt?.toISOString() ?? null },
    tradeScope,
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
            };
          }),
          skipped: plan.skipped
            .filter((s) => s.reason !== "excluded" && s.reason !== "not_needed")
            .map((s) => {
              const a = byId.get(s.accountId)!;
              return { ...s, name: a.name, typeLabel: ACCOUNT_TYPE_LABELS[a.accountType] };
            }),
        }
      : null,
  };
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const params = new URL(request.url).searchParams;
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
  const navigation = useNavigation();
  const executing = navigation.state !== "idle" && navigation.formData?.get("intent") === "execute";
  const plan = d.plan;
  const canExecute = Boolean(plan && plan.legs.length > 0 && d.tradeScope && d.price);
  const typesInPlan = plan ? [...new Set(plan.legs.map((l) => l.accountType))] : [];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle
          title="Withdraw"
          lede="Say how much cash you need. Units are sold from accounts in your withdrawal order until it is covered. Moving the cash out of the brokerage is then up to you."
        />
        <SyncStatus sync={d.sync} />
      </div>

      {d.error && (
        <Notice tone="danger" className="mt-4">
          {d.error}
        </Notice>
      )}

      <Card className="mt-6">
        <Form method="get" className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span>Amount to withdraw (CAD)</span>
            <input
              type="text"
              name="amount"
              inputMode="decimal"
              placeholder="5,000"
              defaultValue={d.amountCents ? (d.amountCents / 100).toFixed(2) : ""}
              required
            />
          </label>
          {!d.price && (
            <label className="flex flex-col gap-1">
              <span>Price per unit (no quote available)</span>
              <input type="text" name="price" inputMode="decimal" placeholder="41.20" required />
            </label>
          )}
          <Button type="submit" variant="secondary">
            Plan the sale
          </Button>
          {d.heldCents !== null && (
            <span className="text-xs text-ink-muted">
              About {money(d.heldCents, { whole: true })} of {d.target.ticker} in whole units across
              included accounts
              {d.price
                ? ` at ${money(d.price.priceCents)}${d.price.source === "quote" ? " (quote)" : d.price.source === "holding" ? ` (last price${d.price.asOf ? `, ${dateTime(d.price.asOf)}` : ""})` : " (entered)"}`
                : ""}
              .
            </span>
          )}
        </Form>
      </Card>

      {plan && (
        <Card className="mt-6 overflow-x-auto">
          {plan.shortfallCents > 0 && (
            <Notice tone="warn" className="mb-4">
              Selling everything covers {money(plan.totalProceedsCents)}, which is{" "}
              {money(plan.shortfallCents)} short of {money(plan.requestedCents)}.
            </Notice>
          )}
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-muted">
              <tr>
                <th className="py-1 font-medium">Account</th>
                <th className="num py-1 font-medium">Units held</th>
                <th className="num py-1 font-medium">Units to sell</th>
                <th className="num py-1 font-medium">Est. proceeds</th>
                <th className="num py-1 font-medium">Units after</th>
              </tr>
            </thead>
            <tbody>
              {plan.legs.map((l) => (
                <tr key={l.accountId} className="border-t border-line">
                  <td className="py-2">
                    {l.typeLabel} {l.name} <span className="text-ink-muted">{l.numberMasked}</span>
                    <span className="block text-xs text-ink-muted">{l.brokerageName}</span>
                  </td>
                  <td className="num py-2">{units(l.positionUnits)}</td>
                  <td className="num py-2">{units(l.units)}</td>
                  <td className="num py-2">{money(l.estimatedProceedsCents)}</td>
                  <td className="num py-2">{units(l.unitsAfter)}</td>
                </tr>
              ))}
              {plan.legs.length === 0 && (
                <tr className="border-t border-line">
                  <td colSpan={5} className="py-3 text-ink-muted">
                    No included account holds whole units of {d.target.ticker}.
                  </td>
                </tr>
              )}
            </tbody>
            {plan.legs.length > 0 && (
              <tfoot className="border-t border-line font-medium">
                <tr>
                  <td className="py-2">Total</td>
                  <td className="num py-2"></td>
                  <td className="num py-2">{units(plan.totalUnits)}</td>
                  <td className="num py-2">{money(plan.totalProceedsCents)}</td>
                  <td className="num py-2"></td>
                </tr>
              </tfoot>
            )}
          </table>

          {typesInPlan.length > 0 && (
            <ul className="mt-4 space-y-1 text-xs text-ink-muted">
              {typesInPlan.map((t) => (
                <li key={t}>
                  <strong>{ACCOUNT_TYPE_LABELS[t]}:</strong> {WITHDRAWAL_NOTES[t]}
                </li>
              ))}
            </ul>
          )}
          {plan.skipped.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-ink-muted">
              {plan.skipped.map((s) => (
                <li key={s.accountId}>
                  {s.typeLabel} {s.name}:{" "}
                  {s.reason === "not_tradable" && !d.tradeScope
                    ? "Trading not enabled yet"
                    : skipCopy[s.reason]}
                </li>
              ))}
            </ul>
          )}

          <Form method="post" className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <input type="hidden" name="intent" value="execute" />
            <input type="hidden" name="amountCents" value={plan.requestedCents} />
            <input type="hidden" name="priceCents" value={d.price?.priceCents ?? ""} />
            <p className="text-sm text-ink-muted">
              Market orders, good for the day. Proceeds settle at your brokerage in a day or two;
              then withdraw the cash there. Track each order on the{" "}
              <Link to="/app/orders" className="underline-offset-2 hover:underline">
                Orders page
              </Link>
              .
            </p>
            <Button type="submit" variant="danger" disabled={!canExecute || executing}>
              {executing
                ? "Placing orders…"
                : plan.legs.length > 0
                  ? `Sell ${units(plan.totalUnits)} ${d.target.ticker} across ${plural(plan.legs.length, "account")}`
                  : "Nothing to sell"}
            </Button>
          </Form>
        </Card>
      )}
    </>
  );
}
