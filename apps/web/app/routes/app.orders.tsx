import { Badge, Card, EmptyState, Label, Notice, PageTitle } from "~/components/ui";
import { getDb } from "~/lib/db.server";
import { dateTime, money, plural, units } from "~/lib/format";
import { listOrderBatches } from "~/lib/portfolio.server";
import { requireUser } from "~/lib/session.server";

import type { Route } from "./+types/app.orders";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Orders · No Advice Needed" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const highlight = new URL(request.url).searchParams.get("batch");
  const batches = await listOrderBatches(getDb(), user.id);
  return {
    highlight,
    batches: batches.map((b) => ({
      id: b.id,
      kind: b.kind,
      ticker: b.ticker,
      priceCents: b.priceCents,
      requestedCents: b.requestedCents,
      createdAt: b.createdAt.toISOString(),
      orders: b.orders.map((o) => ({
        id: o.id,
        accountName: o.accountName,
        brokerageName: o.brokerageName,
        side: o.side,
        units: o.units,
        estimatedCents: o.estimatedCents,
        status: o.status,
        error: o.error,
        brokerageOrderId: o.brokerageOrderId,
        placedAt: o.placedAt?.toISOString() ?? null,
      })),
    })),
  };
}

function tone(status: string): "success" | "warn" | "danger" | "info" {
  const s = status.toUpperCase();
  if (s === "EXECUTED" || s === "ACCEPTED") return "success";
  if (s === "FAILED" || s === "REJECTED" || s === "CANCELED" || s === "EXPIRED") return "danger";
  if (s === "PENDING" || s === "QUEUED" || s === "PARTIAL" || s === "CHECKED") return "warn";
  return "info";
}

export default function Orders({ loaderData }: Route.ComponentProps) {
  const { batches, highlight } = loaderData;
  const latest = batches.find((b) => b.id === highlight);
  const failed = latest?.orders.filter((o) => o.status === "failed") ?? [];
  const allOrders = batches.flatMap((b) => b.orders);
  const placed = allOrders.filter((o) => o.status !== "failed").length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <PageTitle
          title="Receipts"
          lede="Every order this app placed, newest first. Statuses are what the brokerage reported at the time."
        />
        {batches.length > 0 && (
          <div className="flex gap-3">
            <div className="rounded-tile border border-line bg-surface px-5 py-3">
              <Label>batches</Label>
              <p className="figure mt-1 text-2xl">{batches.length}</p>
            </div>
            <div className="rounded-tile border border-line bg-surface px-5 py-3">
              <Label>orders</Label>
              <p className="figure mt-1 text-2xl">{allOrders.length}</p>
            </div>
            <div className="rounded-tile border border-accent bg-accent-soft px-5 py-3">
              <Label>placed</Label>
              <p className="figure mt-1 text-2xl text-accent">{placed}</p>
            </div>
          </div>
        )}
      </div>

      {latest && (
        <Notice
          tone={
            failed.length === 0
              ? "success"
              : failed.length === latest.orders.length
                ? "danger"
                : "warn"
          }
          className="mt-6"
        >
          {failed.length === 0
            ? `Placed ${plural(latest.orders.length, "order")}. Cash and units update after SnapTrade's next read.`
            : `${latest.orders.length - failed.length} of ${latest.orders.length} orders were placed. See the errors below.`}
        </Notice>
      )}

      {batches.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No orders yet"
            body="Buy or sell from the Invest or Withdraw page and every batch lands here, with what each account did."
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {batches.map((b) => {
            const buy = b.kind === "invest";
            const totalUnits = b.orders.reduce((n, o) => n + o.units, 0);
            const totalCents = b.orders.reduce((n, o) => n + o.estimatedCents, 0);
            const bad = b.orders.filter((o) => o.status === "failed").length;
            return (
              <Card
                key={b.id}
                tone={b.id === highlight ? (buy ? "accent" : "sell") : "plain"}
                className="p-0"
              >
                <div className="flex flex-wrap items-center gap-x-6 gap-y-4 p-6">
                  <span
                    className={`rounded-lg px-3 py-2 font-mono text-[11px] font-bold tracking-[0.16em] uppercase ${
                      buy ? "bg-accent text-canvas" : "bg-sell text-canvas"
                    }`}
                  >
                    {buy ? "bought" : "sold"}
                  </span>
                  <div>
                    <div className="flex items-baseline gap-3">
                      <span className="figure text-3xl">{units(totalUnits)}</span>
                      <span className="font-display text-lg font-extrabold">
                        {b.ticker.replace(/\.TO$/, "")}
                      </span>
                    </div>
                    <Label className="mt-2 block">
                      {dateTime(b.createdAt)} · planned at {money(b.priceCents)}
                      {b.requestedCents ? ` · asked for ${money(b.requestedCents)}` : ""}
                    </Label>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="num font-mono text-2xl font-bold">{money(totalCents)}</p>
                    <span className="mt-2 inline-flex items-center gap-2">
                      <span
                        className={`size-2 rounded-full ${
                          bad === 0 ? (buy ? "bg-accent" : "bg-sell") : "bg-warn"
                        }`}
                      />
                      <Label
                        className={bad === 0 ? (buy ? "text-accent" : "text-sell") : "text-warn"}
                      >
                        {bad === 0 ? "all accepted" : `${plural(bad, "order")} failed`}
                      </Label>
                    </span>
                  </div>
                </div>

                <ul className="border-t border-line px-6 pb-2">
                  {b.orders.map((o) => (
                    <li
                      key={o.id}
                      className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line/60 py-4 last:border-0"
                    >
                      <span className="text-sm font-medium">{o.accountName}</span>
                      <Label>{o.brokerageName}</Label>
                      <Label>
                        {o.side} · market · day · {units(o.units)} units
                      </Label>
                      <span className="num ml-auto font-mono text-sm font-medium">
                        {money(o.estimatedCents)}
                      </span>
                      <Badge tone={tone(o.status)}>{o.status}</Badge>
                      {o.brokerageOrderId && <Label>#{o.brokerageOrderId}</Label>}
                      {o.error && <p className="w-full text-xs text-danger">{o.error}</p>}
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-8 max-w-lg text-xs text-ink-muted">
        Every order here was a market order for the day, in whole units, placed when you confirmed a
        batch. Check your brokerage for fills.
      </p>
    </>
  );
}
