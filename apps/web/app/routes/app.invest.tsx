import { ACCOUNT_TYPE_LABELS, planBuys, type BuySkipReason } from "@noadviceneeded/engine";
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

import type { Route } from "./+types/app.invest";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Invest · No Advice Needed" }];
}

const skipCopy: Record<BuySkipReason, string> = {
  excluded: "Not in the plan",
  not_tradable: "Read-only connection",
  no_cash: "No cash",
  below_one_unit: "Less than one unit of cash",
};

async function load(
  user: Awaited<ReturnType<typeof requireUser>>,
  options: { force?: boolean; manualPriceCents?: number | null } = {},
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
  const plan = price ? planBuys(accounts, { priceCents: price.priceCents }) : null;
  const byId = new Map(accounts.map((a) => [a.id, a]));
  return {
    sync: { status: sync.status, syncedAt: sync.syncedAt?.toISOString() ?? null },
    tradeScope,
    target: { ticker: user.targetTicker, name: user.targetName },
    price,
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
              typeLabel: ACCOUNT_TYPE_LABELS[a.accountType],
              cashCents: a.cashCents ?? 0,
              cashAsOf: a.cashAsOf,
            };
          }),
          skipped: plan.skipped
            .filter((s) => s.reason !== "excluded")
            .map((s) => {
              const a = byId.get(s.accountId)!;
              return {
                ...s,
                name: a.name,
                typeLabel: ACCOUNT_TYPE_LABELS[a.accountType],
                cashCents: a.cashCents,
              };
            }),
        }
      : null,
  };
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const manual = parseDollarsToCents(new URL(request.url).searchParams.get("price"));
  return { ...(await load(user, { manualPriceCents: manual })), error: null as string | null };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "refresh") return { ...(await load(user, { force: true })), error: null };

  if (intent === "execute") {
    if (!user.targetSymbolId || !user.targetTicker) throw redirect("/app/etf");
    const shown = z.coerce.number().int().positive().safeParse(form.get("priceCents"));
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
    // A fresh quote if one is available, otherwise the price the user confirmed.
    const price =
      (await resolvePrice(client, user.targetSymbolId, accounts)) ??
      (shown.success ? { priceCents: shown.data, source: "manual" as const, asOf: null } : null);
    if (!price)
      return { ...(await load(user)), error: "No price is available to size the orders." };
    const plan = planBuys(accounts, { priceCents: price.priceCents });
    if (plan.legs.length === 0)
      return { ...(await load(user)), error: "There is nothing to buy right now." };
    const result = await executeBatch(db, user.id, client, {
      kind: "invest",
      side: "buy",
      priceCents: price.priceCents,
      symbolId: user.targetSymbolId,
      ticker: user.targetTicker,
      legs: plan.legs.map((l) => ({
        accountId: l.accountId,
        units: l.units,
        estimatedCents: l.estimatedCostCents,
      })),
    });
    return redirect(`/app/orders?batch=${result.batchId}`);
  }

  return { ...(await load(user)), error: null };
}

export default function Invest({ loaderData, actionData }: Route.ComponentProps) {
  const d = actionData ?? loaderData;
  const navigation = useNavigation();
  const executing = navigation.state !== "idle" && navigation.formData?.get("intent") === "execute";
  const plan = d.plan;
  const canExecute = Boolean(plan && plan.legs.length > 0 && d.tradeScope && d.price);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle
          title={`Invest in ${d.target.ticker}`}
          lede="Each included account buys as many whole units as its own cash allows, keeping 1% back so a market fill above the quote still clears."
        />
        <SyncStatus sync={d.sync} />
      </div>

      {d.error && (
        <Notice tone="danger" className="mt-4">
          {d.error}
        </Notice>
      )}

      <Card className="mt-6">
        {d.price ? (
          <p className="text-sm">
            Price used: <strong className="money">{money(d.price.priceCents)}</strong> per unit
            <span className="text-ink-muted">
              {d.price.source === "quote" &&
                ` · brokerage quote${d.price.asOf ? ` at ${dateTime(d.price.asOf)}` : ""}`}
              {d.price.source === "holding" &&
                ` · last price on a position you hold${d.price.asOf ? `, ${dateTime(d.price.asOf)}` : ""}`}
              {d.price.source === "manual" && " · entered by you"}
            </span>
          </p>
        ) : (
          <Form method="get" className="flex flex-wrap items-end gap-3 text-sm">
            <label className="flex flex-col gap-1">
              <span>
                No price is available yet. Enter today's price per unit to size the orders.
              </span>
              <input type="text" name="price" inputMode="decimal" placeholder="41.20" required />
            </label>
            <Button type="submit" variant="secondary">
              Use this price
            </Button>
          </Form>
        )}
        {d.price && d.price.source !== "quote" && (
          <Form method="get" className="mt-3 flex flex-wrap items-end gap-3 text-xs text-ink-muted">
            <label className="flex items-center gap-2">
              Use a different price
              <input type="text" name="price" inputMode="decimal" placeholder="41.20" />
            </label>
            <Button type="submit" variant="ghost">
              Recalculate
            </Button>
          </Form>
        )}
      </Card>

      {plan && (
        <Card className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-muted">
              <tr>
                <th className="py-1 font-medium">Account</th>
                <th className="num py-1 font-medium">Cash</th>
                <th className="num py-1 font-medium">Units to buy</th>
                <th className="num py-1 font-medium">Est. cost</th>
                <th className="num py-1 font-medium">Left over</th>
              </tr>
            </thead>
            <tbody>
              {plan.legs.map((l) => (
                <tr key={l.accountId} className="border-t border-line">
                  <td className="py-2">
                    {l.typeLabel} {l.name} <span className="text-ink-muted">{l.numberMasked}</span>
                    <span className="block text-xs text-ink-muted">
                      {l.brokerageName}
                      {l.cashAsOf ? ` · cash as of ${dateTime(l.cashAsOf)}` : ""}
                    </span>
                  </td>
                  <td className="num py-2">{money(l.cashCents)}</td>
                  <td className="num py-2">{units(l.units)}</td>
                  <td className="num py-2">{money(l.estimatedCostCents)}</td>
                  <td className="num py-2">{money(l.cashAfterCents)}</td>
                </tr>
              ))}
              {plan.legs.length === 0 && (
                <tr className="border-t border-line">
                  <td colSpan={5} className="py-3 text-ink-muted">
                    No included account has enough cash for a whole unit.
                  </td>
                </tr>
              )}
            </tbody>
            {plan.legs.length > 0 && (
              <tfoot className="border-t border-line font-medium">
                <tr>
                  <td className="py-2">Total</td>
                  <td className="num py-2">{money(plan.totalCashCents)}</td>
                  <td className="num py-2">{units(plan.totalUnits)}</td>
                  <td className="num py-2">{money(plan.totalCostCents)}</td>
                  <td className="num py-2">{money(plan.totalCashCents - plan.totalCostCents)}</td>
                </tr>
              </tfoot>
            )}
          </table>

          {plan.skipped.length > 0 && (
            <ul className="mt-4 space-y-1 text-xs text-ink-muted">
              {plan.skipped.map((s) => (
                <li key={s.accountId}>
                  {s.typeLabel} {s.name}:{" "}
                  {s.reason === "not_tradable" && !d.tradeScope
                    ? "Trading not enabled yet"
                    : skipCopy[s.reason]}
                  {s.reason === "below_one_unit" && s.cashCents !== null
                    ? ` (${money(s.cashCents)})`
                    : ""}
                </li>
              ))}
            </ul>
          )}

          <Form method="post" className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <input type="hidden" name="intent" value="execute" />
            <input type="hidden" name="priceCents" value={d.price?.priceCents ?? ""} />
            <p className="text-sm text-ink-muted">
              Market orders, good for the day. Fills can differ from the estimate. You'll see each
              order's status on the{" "}
              <Link to="/app/orders" className="underline-offset-2 hover:underline">
                Orders page
              </Link>
              .
            </p>
            <Button type="submit" disabled={!canExecute || executing}>
              {executing
                ? "Placing orders…"
                : plan.legs.length > 0
                  ? `Buy ${units(plan.totalUnits)} ${d.target.ticker} across ${plural(plan.legs.length, "account")}`
                  : "Nothing to buy"}
            </Button>
          </Form>
        </Card>
      )}
    </>
  );
}
