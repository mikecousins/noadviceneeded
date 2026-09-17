import { ACCOUNT_TYPE_LABELS, planBuys, type BuySkipReason } from "@noadviceneeded/engine";
import { Form, Link, redirect, useNavigation } from "react-router";
import { z } from "zod";

import { SyncStatus } from "~/components/sync-status";
import {
  AccountName,
  Badge,
  Button,
  Card,
  EmptyState,
  Label,
  Notice,
  TypeTag,
} from "~/components/ui";
import { getDb } from "~/lib/db.server";
import { dateTime, parseDollarsToCents, plural, units } from "~/lib/format";
import { resolvePrice } from "~/lib/plan.server";
import { buildPlanAccounts } from "~/lib/portfolio.server";
import { requireUser } from "~/lib/session.server";
import { getSnapTradeClient, hasTradeScope } from "~/lib/snaptrade.server";
import { syncUser } from "~/lib/sync.server";
import { executeBatch } from "~/lib/trading.server";

import { useMoney } from "~/lib/use-money";
import type { Route } from "./+types/app.invest";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Invest · No Advice Needed" }];
}

const skipCopy: Record<BuySkipReason, string> = {
  excluded: "Not in the plan",
  not_tradable: "Read-only connection",
  no_cash: "No cash",
  below_one_unit: "Less than one unit of cash",
  too_little_cash: "Too little cash to size an order",
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
              accountType: a.accountType,
              typeLabel: ACCOUNT_TYPE_LABELS[a.accountType],
              cashCents: a.cashCents ?? 0,
              cashAsOf: a.cashAsOf,
              fractional: a.fractional,
            };
          }),
          skipped: plan.skipped
            .filter((s) => s.reason !== "excluded")
            .map((s) => {
              const a = byId.get(s.accountId)!;
              return {
                ...s,
                name: a.name,
                accountType: a.accountType,
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
  const money = useMoney();
  const navigation = useNavigation();
  const executing = navigation.state !== "idle" && navigation.formData?.get("intent") === "execute";
  const plan = d.plan;
  const canExecute = Boolean(plan && plan.legs.length > 0 && d.tradeScope && d.price);
  const ticker = d.target.ticker.replace(/\.TO$/, "");
  const anyFractional = plan?.legs.some((l) => l.fractional) ?? false;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <Label>{anyFractional ? "buying, in units" : "buying, in whole units"}</Label>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <span className="figure text-hero text-accent">{units(plan?.totalUnits ?? 0)}</span>
            <span className="font-display text-3xl font-extrabold tracking-tighter sm:text-4xl">
              {ticker}
            </span>
          </div>
          <p className="mt-4 max-w-md text-sm text-ink-muted">
            Each account buys what its own cash allows, 1% held back so a fill above the quote still
            clears.{anyFractional ? " Accounts marked for fractions buy to four places." : ""}
          </p>
        </div>
        <SyncStatus sync={d.sync} />
      </div>

      {d.error && (
        <Notice tone="danger" className="mt-6">
          {d.error}
        </Notice>
      )}

      <Card className="mt-6">
        {d.price ? (
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <Label>price used, per unit</Label>
              <p className="num mt-2 font-mono text-3xl font-bold">{money(d.price.priceCents)}</p>
              <p className="mt-2 font-mono text-[10px] tracking-[0.12em] text-ink-muted uppercase">
                {d.price.source === "quote" &&
                  `brokerage quote${d.price.asOf ? ` · ${dateTime(d.price.asOf)}` : ""}`}
                {d.price.source === "holding" &&
                  `last price on a position you hold${d.price.asOf ? ` · ${dateTime(d.price.asOf)}` : ""}`}
                {d.price.source === "manual" && "entered by you"}
              </p>
            </div>
            <Badge tone="success">1% held back</Badge>
            {d.price.source !== "quote" && (
              <Form method="get" className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-2">
                  <Label>use a different price</Label>
                  <input type="text" name="price" inputMode="decimal" placeholder="41.20" />
                </label>
                <Button type="submit" variant="secondary">
                  Recalculate
                </Button>
              </Form>
            )}
          </div>
        ) : (
          <Form method="get" className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-2">
              <Label>no price available · today's price per unit</Label>
              <input type="text" name="price" inputMode="decimal" placeholder="41.20" required />
            </label>
            <Button type="submit" variant="secondary">
              Use this price
            </Button>
          </Form>
        )}
      </Card>

      {plan && (
        <>
          <section className="mt-4 flex flex-col gap-2">
            <div className="hidden gap-4 px-6 sm:grid sm:grid-cols-[1.6fr_1fr_0.8fr_1fr_1fr]">
              <Label>account</Label>
              <Label className="text-right">cash</Label>
              <Label className="text-right">units</Label>
              <Label className="text-right">est. cost</Label>
              <Label className="text-right">left over</Label>
            </div>

            {plan.legs.map((l) => (
              <div
                key={l.accountId}
                className="grid items-center gap-4 rounded-tile border border-line bg-surface px-6 py-5 sm:grid-cols-[1.6fr_1fr_0.8fr_1fr_1fr]"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <TypeTag type={l.accountType} />
                  <AccountName
                    name={l.name}
                    numberMasked={l.numberMasked}
                    className="text-sm font-medium"
                  />
                  <Label>{l.brokerageName}</Label>
                </div>
                <span className="num font-mono text-sm text-ink-muted sm:text-right">
                  {money(l.cashCents)}
                </span>
                <span className="figure text-2xl sm:text-right">
                  {units(l.units)}
                  {l.fractional && (
                    <span className="ml-2 font-mono text-[10px] tracking-[0.12em] text-ink-muted uppercase">
                      fractional
                    </span>
                  )}
                </span>
                <span className="num font-mono text-sm font-medium sm:text-right">
                  {money(l.estimatedCostCents)}
                </span>
                <span className="num font-mono text-sm text-ink-muted sm:text-right">
                  {money(l.cashAfterCents)}
                </span>
              </div>
            ))}

            {plan.legs.length === 0 && (
              <EmptyState
                title="Nothing to buy yet"
                body={`No account in the plan holds enough cash for a unit of ${ticker}. Deposit at your brokerage, refresh, and this fills in. If your brokerage fills fractions, tick "fractions" for the account on the Accounts page.`}
              />
            )}

            {plan.legs.length > 1 && (
              <div className="grid items-center gap-4 px-6 py-3 sm:grid-cols-[1.6fr_1fr_0.8fr_1fr_1fr]">
                <Label>total</Label>
                <span className="num font-mono text-sm text-ink-muted sm:text-right">
                  {money(plan.totalCashCents)}
                </span>
                <span className="num font-mono text-sm font-bold sm:text-right">
                  {units(plan.totalUnits)}
                </span>
                <span className="num font-mono text-sm font-bold sm:text-right">
                  {money(plan.totalCostCents)}
                </span>
                <span className="num font-mono text-sm text-ink-muted sm:text-right">
                  {money(plan.totalCashCents - plan.totalCostCents)}
                </span>
              </div>
            )}

            {plan.skipped.length > 0 && (
              <ul className="flex flex-wrap items-center gap-3 rounded-tile border border-dashed border-line px-6 py-4">
                <Label>skipped</Label>
                {plan.skipped.map((s) => (
                  <li key={s.accountId} className="flex items-center gap-2">
                    <TypeTag type={s.accountType} />
                    <Label>
                      {s.reason === "not_tradable" && !d.tradeScope
                        ? "trading not enabled"
                        : skipCopy[s.reason]}
                      {(s.reason === "below_one_unit" || s.reason === "too_little_cash") &&
                      s.cashCents !== null
                        ? ` (${money(s.cashCents)})`
                        : ""}
                    </Label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Form method="post" className="mt-6 flex flex-wrap items-center gap-6">
            <input type="hidden" name="intent" value="execute" />
            <input type="hidden" name="priceCents" value={d.price?.priceCents ?? ""} />
            <div className="min-w-[280px] flex-1">
              <Button type="submit" size="lg" disabled={!canExecute || executing}>
                {executing
                  ? "Placing orders…"
                  : plan.legs.length > 0
                    ? `Place ${plural(plan.legs.length, "market order")} · ${money(plan.totalCostCents)}`
                    : "Nothing to buy"}
              </Button>
            </div>
            <p className="max-w-xs text-xs text-ink-muted">
              Market orders, good for today
              {anyFractional ? ", fractional where marked" : ", whole units only"}. Fills can differ
              from the estimate; each one shows up on the{" "}
              <Link to="/app/orders" className="text-accent underline-offset-4 hover:underline">
                Orders page
              </Link>
              .
            </p>
          </Form>
        </>
      )}
    </>
  );
}
