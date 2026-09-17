import {
  ACCOUNT_TYPE_LABELS,
  HOME_CURRENCY,
  ROOM_LABELS,
  planBuys,
  suggestDeposit,
} from "@noadviceneeded/engine";
import { Link } from "react-router";

import { SyncStatus } from "~/components/sync-status";
import {
  Card,
  EmptyState,
  Hero,
  Label,
  LinkButton,
  Meter,
  Ribbon,
  Tile,
  TypeTag,
} from "~/components/ui";
import { COUNTRY_COPY, effectiveCountry } from "~/lib/country";
import { getDb } from "~/lib/db.server";
import { plural, units } from "~/lib/format";
import { buildPlanAccounts } from "~/lib/portfolio.server";
import { roomByType, roomSummary } from "~/lib/room.server";
import { requireUser } from "~/lib/session.server";
import { hasTradeScope } from "~/lib/snaptrade.server";
import { syncUser } from "~/lib/sync.server";
import { TYPE_FILL, TYPE_TEXT } from "~/lib/tiers";
import { useMoney } from "~/lib/use-money";

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
  const country = effectiveCountry(user);
  const room = await roomSummary(db, user.id, country, accounts);
  const included = accounts.filter((a) => a.included);
  const suggestion = suggestDeposit(accounts, roomByType(room));
  const suggested = suggestion ? accounts.find((a) => a.id === suggestion.accountId) : undefined;
  const sum = (xs: (number | null)[]) =>
    xs.some((x) => x !== null) ? xs.reduce<number>((n, x) => n + (x ?? 0), 0) : null;
  // The last price SnapTrade reported on a position we hold. Good enough to
  // say how many units the idle cash covers; the Invest page re-quotes before
  // anything is placed.
  const priceCents = included.find((a) => a.holdingPriceCents !== null)?.holdingPriceCents ?? null;
  const ready = priceCents ? planBuys(accounts, { priceCents }) : null;
  return {
    sync: { status: sync.status, syncedAt: sync.syncedAt?.toISOString() ?? null },
    tradeScope,
    country,
    homeCurrency: HOME_CURRENCY[country],
    target: user.targetTicker ? { ticker: user.targetTicker, name: user.targetName } : null,
    accountCount: accounts.length,
    includedCount: included.length,
    totalValueCents: sum(included.map((a) => a.valueCents)),
    cashCents: sum(included.map((a) => a.cashCents)),
    unitsHeld: included.reduce((n, a) => n + a.positionUnits, 0),
    heldValueCents: priceCents
      ? Math.round(included.reduce((n, a) => n + a.positionUnits * priceCents, 0))
      : null,
    ready: ready ? { units: ready.totalUnits, legs: ready.legs.length } : null,
    suggestion:
      suggestion && suggested
        ? {
            accountName: suggested.name,
            brokerageName: suggested.brokerageName,
            numberMasked: suggested.numberMasked,
            accountType: suggestion.accountType,
            typeLabel: ACCOUNT_TYPE_LABELS[suggestion.accountType],
            roomCents: suggestion.roomCents,
          }
        : null,
    room: room.map((r) => ({
      roomType: r.roomType,
      typeLabel: ROOM_LABELS[r.roomType],
      remainingCents: r.remainingCents,
      baselineCents: r.baseline?.roomCents ?? null,
      accountCount: r.accountCount,
    })),
    accounts: included.map((a) => ({
      id: a.id,
      name: a.name,
      brokerageName: a.brokerageName,
      numberMasked: a.numberMasked,
      accountType: a.accountType,
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
  const money = useMoney();
  const hasCash = (d.cashCents ?? 0) > 0;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <Hero
          label={`net worth · ${d.homeCurrency.toLowerCase()}`}
          value={money(d.totalValueCents, { whole: true })}
          sub={
            d.includedCount > 0
              ? `${plural(d.includedCount, "account")} in the plan`
              : "No accounts in the plan yet"
          }
        />
        <SyncStatus sync={d.sync} />
      </div>

      {d.accountCount === 0 ? (
        <EmptyState
          title="Nothing shared yet"
          body={`Connect a brokerage in the SnapTrade dashboard, then refresh here. ${COUNTRY_COPY[d.country].brokerages}`}
          action={
            <a
              href="https://dashboard.snaptrade.com"
              className="inline-flex rounded-full bg-accent px-5 py-3 font-mono text-[11px] font-bold tracking-[0.14em] text-canvas uppercase hover:opacity-90"
            >
              Open SnapTrade
            </a>
          }
        />
      ) : (
        <>
          {d.accounts.length > 0 && (
            <section className="mt-8">
              <Ribbon
                segments={d.accounts.map((a) => ({
                  key: a.id,
                  weight: a.valueCents ?? 0,
                  fill: TYPE_FILL[a.accountType],
                }))}
              />
              <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                {d.accounts.map((a) => (
                  <li key={a.id} className="flex items-center gap-2">
                    <span className={`size-2.5 rounded-sm ${TYPE_FILL[a.accountType]}`} />
                    <Label>
                      {a.typeLabel} {money(a.valueCents, { whole: true })}
                    </Label>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.15fr]">
            <Card className="flex flex-col">
              <Label>your one fund</Label>
              {d.target ? (
                <>
                  <p className="mt-2 font-display text-5xl font-extrabold tracking-tighter sm:text-6xl">
                    {d.target.ticker.replace(/\.TO$/, "")}
                  </p>
                  {d.target.name && <p className="mt-2 text-sm text-ink-muted">{d.target.name}</p>}
                  <div className="mt-6 flex items-end justify-between gap-4 border-t border-line pt-5">
                    <div>
                      <Label>units held</Label>
                      <p className="num mt-1 font-mono text-2xl font-bold">{units(d.unitsHeld)}</p>
                    </div>
                    <div className="text-right">
                      <Label>at last price</Label>
                      <p className="num mt-1 font-mono text-2xl font-bold">
                        {money(d.heldValueCents, { whole: true })}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-2 font-display text-3xl font-extrabold">Not picked yet</p>
                  <p className="mt-2 text-sm text-ink-muted">
                    One all-in-one ETF, held in every account. That is guideline two.
                  </p>
                  <LinkButton to="/app/etf" className="mt-6 self-start">
                    Choose a fund
                  </LinkButton>
                </>
              )}
            </Card>

            <Card tone={hasCash ? "accent" : "plain"} className="flex flex-col">
              <div className="flex items-center gap-2.5">
                {hasCash && <span className="size-2.5 rounded-full bg-accent" />}
                <Label className={hasCash ? "text-accent" : ""}>
                  {d.ready && d.ready.legs > 0
                    ? `${plural(d.ready.legs, "trade")} ready`
                    : hasCash
                      ? "cash waiting"
                      : "no cash to put in"}
                </Label>
              </div>
              <p className="figure mt-3 text-figure">{money(d.cashCents)}</p>
              <p className="mt-3 text-sm text-ink-muted">
                {d.ready && d.ready.units > 0
                  ? `${units(d.ready.units)} units at the last price your brokerage reported.`
                  : "Settled cash across the accounts in your plan."}
              </p>
              <div className="mt-auto flex flex-wrap gap-3 pt-6">
                <LinkButton to="/app/invest" aria-disabled={!d.target} className="flex-1">
                  {d.ready && d.ready.units > 0
                    ? `Buy ${units(d.ready.units)} units`
                    : hasCash
                      ? `Invest ${money(d.cashCents)}`
                      : "Plan a purchase"}
                </LinkButton>
                <LinkButton to="/app/withdraw" variant="secondary">
                  Withdraw
                </LinkButton>
              </div>
            </Card>
          </section>

          {d.accounts.length > 0 && (
            <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {d.accounts.map((a) => (
                <div key={a.id} className="rounded-card border border-line bg-surface p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`font-mono text-[11px] font-bold tracking-[0.18em] uppercase ${TYPE_TEXT[a.accountType]}`}
                    >
                      {a.typeLabel}
                    </span>
                    <Label>{a.numberMasked}</Label>
                  </div>
                  <p className="figure mt-4 text-2xl">{money(a.valueCents, { whole: true })}</p>
                  <p className="mt-2 font-mono text-[10px] tracking-[0.12em] text-ink-muted uppercase">
                    {units(a.positionUnits)} units · {a.brokerageName}
                    {!a.canTrade && " · read-only"}
                  </p>
                  <p
                    className={`mt-3 inline-block rounded-full px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.1em] ${
                      (a.cashCents ?? 0) > 0
                        ? "bg-accent-soft text-accent"
                        : "bg-raised text-ink-muted"
                    }`}
                  >
                    {(a.cashCents ?? 0) > 0 ? `${money(a.cashCents)} cash` : "no cash"}
                  </p>
                </div>
              ))}
            </section>
          )}

          <section className="mt-4 grid gap-4 sm:grid-cols-3">
            {d.room.map((r) => {
              const percent =
                r.remainingCents !== null && r.baselineCents
                  ? (r.remainingCents / r.baselineCents) * 100
                  : 0;
              return (
                <Tile key={r.roomType}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span
                      className={`font-mono text-[11px] font-bold tracking-[0.18em] uppercase ${TYPE_TEXT[r.roomType]}`}
                    >
                      {r.typeLabel}
                    </span>
                    <span className="num font-mono text-lg font-bold">
                      {r.remainingCents === null
                        ? "not set"
                        : money(r.remainingCents, { whole: true })}
                    </span>
                  </div>
                  <Meter
                    percent={percent}
                    fill={TYPE_FILL[r.roomType]}
                    className="mt-3 bg-line/80"
                  />
                  <p className="mt-2 font-mono text-[10px] tracking-[0.12em] text-ink-muted uppercase">
                    {r.remainingCents === null
                      ? "room left · add yours"
                      : `room left${r.accountCount === 0 ? " · no account" : ""}`}
                  </p>
                </Tile>
              );
            })}
          </section>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            {d.suggestion ? (
              <Link
                to="/app/accounts"
                className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-2 rounded-tile border border-dashed border-accent/50 p-5 hover:border-accent"
              >
                <Label>next deposit goes to</Label>
                <TypeTag type={d.suggestion.accountType} />
                <span className="font-display text-lg font-extrabold">
                  {d.suggestion.numberMasked}
                </span>
                <Label>{d.suggestion.brokerageName}</Label>
                <span className="num ml-auto font-mono text-sm text-accent">
                  {d.suggestion.roomCents !== null
                    ? `${money(d.suggestion.roomCents, { whole: true })} room left`
                    : "room not set"}
                </span>
              </Link>
            ) : (
              <Link
                to="/app/room"
                className="flex flex-1 items-center gap-5 rounded-tile border border-dashed border-line p-5 hover:border-ink-muted"
              >
                <Label>next deposit</Label>
                <span className="text-sm text-ink-muted">{COUNTRY_COPY[d.country].roomNudge}</span>
              </Link>
            )}
          </div>
        </>
      )}
    </>
  );
}
