import { Badge, Card, Notice, PageTitle } from "~/components/ui";
import { getDb } from "~/lib/db.server";
import { dateTime, money, units } from "~/lib/format";
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

  return (
    <>
      <PageTitle
        title="Orders"
        lede="Every order this app placed, newest first. Statuses are what the brokerage reported when the order was placed; check your brokerage for fills."
      />

      {latest && (
        <Notice
          tone={
            failed.length === 0
              ? "success"
              : failed.length === latest.orders.length
                ? "danger"
                : "warn"
          }
          className="mt-4"
        >
          {failed.length === 0
            ? `Placed ${latest.orders.length} ${latest.orders.length === 1 ? "order" : "orders"}. Cash and units update after SnapTrade's next read of your accounts.`
            : `${latest.orders.length - failed.length} of ${latest.orders.length} orders were placed. See the errors below.`}
        </Notice>
      )}

      {batches.length === 0 ? (
        <Card className="mt-6">
          <p className="text-sm text-ink-muted">No orders yet.</p>
        </Card>
      ) : (
        batches.map((b) => (
          <Card
            key={b.id}
            className={`mt-6 overflow-x-auto ${b.id === highlight ? "border-accent" : ""}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg">
                {b.kind === "invest" ? "Invest" : "Withdraw"} · {b.ticker}
              </h2>
              <p className="text-xs text-ink-muted">
                {dateTime(b.createdAt)} · planned at {money(b.priceCents)} per unit
                {b.requestedCents ? ` · asked for ${money(b.requestedCents)}` : ""}
              </p>
            </div>
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-xs text-ink-muted">
                <tr>
                  <th className="py-1 font-medium">Account</th>
                  <th className="py-1 font-medium">Side</th>
                  <th className="num py-1 font-medium">Units</th>
                  <th className="num py-1 font-medium">Estimate</th>
                  <th className="py-1 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {b.orders.map((o) => (
                  <tr key={o.id} className="border-t border-line align-top">
                    <td className="py-2">
                      {o.accountName}
                      <span className="block text-xs text-ink-muted">{o.brokerageName}</span>
                    </td>
                    <td className="py-2 uppercase">{o.side}</td>
                    <td className="num py-2">{units(o.units)}</td>
                    <td className="num py-2">{money(o.estimatedCents)}</td>
                    <td className="py-2">
                      <Badge tone={tone(o.status)}>{o.status}</Badge>
                      {o.brokerageOrderId && (
                        <span className="block text-xs text-ink-muted">#{o.brokerageOrderId}</span>
                      )}
                      {o.error && <span className="block text-xs text-danger">{o.error}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))
      )}
    </>
  );
}
