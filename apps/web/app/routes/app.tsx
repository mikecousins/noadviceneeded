import { ACCOUNT_TYPE_LABELS, suggestDeposit } from "@noadviceneeded/engine";
import { Link } from "react-router";

import { SyncStatus } from "~/components/sync-status";
import { Card, LinkButton, Notice, Stat } from "~/components/ui";
import { getDb } from "~/lib/db.server";
import { money, plural, units } from "~/lib/format";
import { buildPlanAccounts } from "~/lib/portfolio.server";
import { roomByType, roomSummary } from "~/lib/room.server";
import { requireUser } from "~/lib/session.server";
import { hasTradeScope } from "~/lib/snaptrade.server";
import { syncUser } from "~/lib/sync.server";

import type { Route } from "./+types/app";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Dashboard · No Advice Needed" }];
}

async function load(user: Awaited<ReturnType<typeof requireUser>>, force = false) {
  const db = getDb();
  const sync = await syncUser(db, user, { force });
  const tradeScope = await hasTradeScope(user.id);
  const accounts = await buildPlanAccounts(db, user.id, {
    targetSymbolId: user.targetSymbolId,
    tradeScope,
  });
  const room = await roomSummary(db, user.id, accounts);
  const included = accounts.filter((a) => a.included);
  const suggestion = suggestDeposit(accounts, roomByType(room));
  const suggested = suggestion ? accounts.find((a) => a.id === suggestion.accountId) : undefined;
  const sum = (xs: (number | null)[]) =>
    xs.some((x) => x !== null) ? xs.reduce<number>((n, x) => n + (x ?? 0), 0) : null;
  return {
    sync: { status: sync.status, syncedAt: sync.syncedAt?.toISOString() ?? null },
    tradeScope,
    target: user.targetTicker ? { ticker: user.targetTicker, name: user.targetName } : null,
    accountCount: accounts.length,
    includedCount: included.length,
    totalValueCents: sum(included.map((a) => a.valueCents)),
    cashCents: sum(included.map((a) => a.cashCents)),
    unitsHeld: included.reduce((n, a) => n + a.positionUnits, 0),
    suggestion:
      suggestion && suggested
        ? {
            accountName: suggested.name,
            brokerageName: suggested.brokerageName,
            numberMasked: suggested.numberMasked,
            typeLabel: ACCOUNT_TYPE_LABELS[suggestion.accountType],
            roomCents: suggestion.roomCents,
          }
        : null,
    room: room.map((r) => ({
      typeLabel: ACCOUNT_TYPE_LABELS[r.accountType],
      remainingCents: r.remainingCents,
      accountCount: r.accountCount,
    })),
    accounts: included.map((a) => ({
      id: a.id,
      name: a.name,
      brokerageName: a.brokerageName,
      typeLabel: ACCOUNT_TYPE_LABELS[a.accountType],
      valueCents: a.valueCents,
      cashCents: a.cashCents,
      positionUnits: a.positionUnits,
      canTrade: a.canTrade,
    })),
  };
}

export async function loader({ request }: Route.LoaderArgs) {
  return load(await requireUser(request));
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();
  if (form.get("intent") === "refresh") return load(user, true);
  return load(user);
}

export default function Dashboard({ loaderData, actionData }: Route.ComponentProps) {
  const d = actionData ?? loaderData;
  return (
    <>
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl">Dashboard</h1>
          <p className="mt-2 max-w-prose text-ink-muted">
            {d.target
              ? `Every included account holds ${d.target.ticker}${d.target.name ? ` (${d.target.name})` : ""}.`
              : "Pick an all-in-one ETF and the rest is one click."}
          </p>
        </div>
        <SyncStatus sync={d.sync} />
      </div>

      {d.accountCount === 0 && (
        <Card className="mt-6">
          <h2 className="text-lg">Nothing shared yet</h2>
          <p className="mt-2 max-w-prose text-ink-muted">
            Connect a brokerage in the SnapTrade dashboard, then refresh here. Wealthsimple,
            Questrade, and most Canadian brokerages are supported.
          </p>
          <a
            href="https://dashboard.snaptrade.com"
            className="mt-4 inline-block rounded-full bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Open SnapTrade
          </a>
        </Card>
      )}

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <Stat
          label={`Total in ${plural(d.includedCount, "included account")}`}
          value={money(d.totalValueCents, { whole: true })}
        />
        <Stat
          label="Cash ready to invest"
          value={money(d.cashCents)}
          hint="Settled cash in included accounts, in your ETF's currency."
        />
        <Stat
          label={d.target ? `Units of ${d.target.ticker} held` : "Units held"}
          value={units(d.unitsHeld)}
        />
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-lg">Invest</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Turn the cash in every included account into {d.target?.ticker ?? "your ETF"}. You see
            the exact units per account before anything is placed.
          </p>
          <LinkButton to="/app/invest" className="mt-4" aria-disabled={!d.target}>
            {d.cashCents ? `Invest ${money(d.cashCents)}` : "Plan a purchase"}
          </LinkButton>
        </Card>
        <Card>
          <h2 className="text-lg">Withdraw</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Say how much you need. Units are sold from accounts in your withdrawal order, then you
            move the cash out at your brokerage.
          </p>
          <LinkButton to="/app/withdraw" variant="secondary" className="mt-4">
            Plan a withdrawal
          </LinkButton>
        </Card>
      </section>

      {d.suggestion && (
        <Notice tone="success" className="mt-6">
          <strong>Next deposit:</strong> {d.suggestion.typeLabel} {d.suggestion.numberMasked} at{" "}
          {d.suggestion.brokerageName}
          {d.suggestion.roomCents !== null
            ? `, ${money(d.suggestion.roomCents, { whole: true })} of room left.`
            : ". Enter this type's room on the Room page to track it."}{" "}
          <Link to="/app/accounts" className="underline-offset-2 hover:underline">
            Change the order
          </Link>
        </Notice>
      )}

      {d.accounts.length > 0 && (
        <Card className="mt-6">
          <h2 className="text-lg">Included accounts</h2>
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs text-ink-muted">
              <tr>
                <th className="py-1 font-medium">Account</th>
                <th className="py-1 font-medium">Type</th>
                <th className="num py-1 font-medium">Value</th>
                <th className="num py-1 font-medium">Cash</th>
                <th className="num py-1 font-medium">Units</th>
              </tr>
            </thead>
            <tbody>
              {d.accounts.map((a) => (
                <tr key={a.id} className="border-t border-line">
                  <td className="py-2">
                    {a.name}
                    <span className="block text-xs text-ink-muted">
                      {a.brokerageName}
                      {!a.canTrade && " · read-only"}
                    </span>
                  </td>
                  <td className="py-2">{a.typeLabel}</td>
                  <td className="num py-2">{money(a.valueCents, { whole: true })}</td>
                  <td className="num py-2">{money(a.cashCents)}</td>
                  <td className="num py-2">{units(a.positionUnits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card className="mt-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg">Room</h2>
          <Link to="/app/room" className="text-sm text-accent underline-offset-2 hover:underline">
            Update room
          </Link>
        </div>
        <ul className="mt-3 grid gap-2 text-sm md:grid-cols-3">
          {d.room.map((r) => (
            <li key={r.typeLabel} className="flex justify-between rounded-lg bg-canvas px-3 py-2">
              <span>
                {r.typeLabel}
                {r.accountCount === 0 && (
                  <span className="text-xs text-ink-muted"> · no account</span>
                )}
              </span>
              <span className="money">
                {r.remainingCents === null ? "not set" : money(r.remainingCents, { whole: true })}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
