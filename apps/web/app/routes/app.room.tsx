import {
  ACCOUNT_TYPE_LABELS,
  ROOM_LABELS,
  ROOM_NOTES,
  ROOM_TYPES_BY_COUNTRY,
} from "@noadviceneeded/engine";
import { Form, useNavigation } from "react-router";
import { z } from "zod";

import { SyncStatus } from "~/components/sync-status";
import { Button, Card, Label, Meter, Notice, PageTitle } from "~/components/ui";
import { COUNTRY_COPY, effectiveCountry } from "~/lib/country";
import { getDb } from "~/lib/db.server";
import { parseDollarsToCents, todayIso } from "~/lib/format";
import {
  clearRoomBaseline,
  listAccounts,
  listRoomActivities,
  setRoomBaseline,
} from "~/lib/portfolio.server";
import { roomSummary } from "~/lib/room.server";
import { requireUser } from "~/lib/session.server";
import { syncUser } from "~/lib/sync.server";
import { TYPE_FILL, TYPE_TEXT } from "~/lib/tiers";
import { useMoney } from "~/lib/use-money";

import type { Route } from "./+types/app.room";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Room · No Advice Needed" }];
}

async function load(user: Awaited<ReturnType<typeof requireUser>>, force = false) {
  const db = getDb();
  const sync = await syncUser(db, user, { force });
  const country = effectiveCountry(user);
  const accounts = await listAccounts(db, user.id);
  const [summary, activities] = await Promise.all([
    roomSummary(db, user.id, country, accounts),
    listRoomActivities(db, user.id),
  ]);
  return {
    sync: { status: sync.status, syncedAt: sync.syncedAt?.toISOString() ?? null },
    country,
    today: todayIso(),
    summary: summary.map((s) => ({
      ...s,
      label: ROOM_LABELS[s.roomType],
      note: ROOM_NOTES[s.roomType],
    })),
    activities: activities
      .slice(0, 100)
      .map((a) => ({ ...a, typeLabel: ACCOUNT_TYPE_LABELS[a.accountType] })),
  };
}

export async function loader({ request }: Route.LoaderArgs) {
  return { ...(await load(await requireUser(request))), message: null as string | null };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const db = getDb();
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "refresh") return { ...(await load(user, true)), message: null };

  const type = z.enum(ROOM_TYPES_BY_COUNTRY[effectiveCountry(user)]).safeParse(form.get("type"));
  if (!type.success) return { ...(await load(user)), message: "Unknown account type." };

  if (intent === "clear") {
    await clearRoomBaseline(db, user.id, type.data);
    return { ...(await load(user)), message: `${ROOM_LABELS[type.data]} room cleared.` };
  }

  if (intent === "save") {
    const room = form.get("room");
    const cents = room === "0" || room === "0.00" ? 0 : parseDollarsToCents(room);
    const asOf = z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .safeParse(form.get("asOf"));
    if (cents === null || !asOf.success) {
      return {
        ...(await load(user)),
        message: "Enter the room in dollars and the date it was true.",
      };
    }
    await setRoomBaseline(db, user.id, type.data, cents, asOf.data);
    // Contributions after the new date are read on the next refresh.
    await syncUser(db, { ...user, lastSyncedAt: null }, { force: true });
    return { ...(await load(user)), message: `${ROOM_LABELS[type.data]} room saved.` };
  }

  return { ...(await load(user)), message: null };
}

export default function Room({ loaderData, actionData }: Route.ComponentProps) {
  const d = actionData ?? loaderData;
  const money = useMoney();
  const copy = COUNTRY_COPY[d.country];
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <PageTitle title="Room left" lede={copy.roomLede} />
        <SyncStatus sync={d.sync} />
      </div>

      {d.message && (
        <Notice tone="success" className="mt-6">
          {d.message}
        </Notice>
      )}

      <section className="mt-8 grid gap-4 lg:grid-cols-3">
        {d.summary.map((s) => {
          const percent =
            s.remainingCents !== null && s.baseline?.roomCents
              ? (s.remainingCents / s.baseline.roomCents) * 100
              : 0;
          const over = s.remainingCents !== null && s.remainingCents < 0;
          return (
            <Card
              key={s.roomType}
              tone={s.remainingCents === null ? "plain" : over ? "sell" : "accent"}
              className="flex flex-col"
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`font-mono text-[13px] font-bold tracking-[0.22em] uppercase ${TYPE_TEXT[s.roomType]}`}
                >
                  {s.label}
                </span>
                {s.accountCount === 0 && <Label>no account</Label>}
              </div>

              <p className="figure mt-4 text-figure">
                {s.remainingCents === null ? "—" : money(s.remainingCents, { whole: true })}
              </p>
              <Meter percent={percent} fill={TYPE_FILL[s.roomType]} className="mt-5" />
              <p className="mt-2 font-mono text-[10px] tracking-[0.14em] text-ink-muted uppercase">
                {s.baseline ? `${Math.round(percent)}% of your limit free` : "no limit entered yet"}
              </p>

              {s.baseline && (
                <div className="mt-5 flex items-baseline justify-between border-t border-line pt-4">
                  <Label>you added since {s.baseline.asOf}</Label>
                  <span className="num font-mono text-sm font-bold">
                    {money(s.contributedSinceCents, { whole: true })}
                  </span>
                </div>
              )}
              {over && (
                <p className="mt-3 text-xs text-sell">
                  Over the room you entered. Check {copy.roomSource}.
                </p>
              )}
              <p className="mt-4 text-xs text-ink-muted">{s.note}</p>

              <Form method="post" className="mt-auto flex flex-col gap-3 pt-6">
                <input type="hidden" name="type" value={s.roomType} />
                <label className="flex flex-col gap-2">
                  <Label>{copy.roomInput}</Label>
                  <input
                    type="text"
                    name="room"
                    inputMode="decimal"
                    defaultValue={s.baseline ? (s.baseline.roomCents / 100).toFixed(2) : ""}
                    placeholder="7,000"
                    required
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <Label>true as of</Label>
                  <input
                    type="date"
                    name="asOf"
                    defaultValue={s.baseline?.asOf ?? d.today}
                    max={d.today}
                    required
                  />
                </label>
                <div className="flex gap-2">
                  <Button type="submit" name="intent" value="save" disabled={busy}>
                    Save
                  </Button>
                  {s.baseline && (
                    <Button
                      type="submit"
                      name="intent"
                      value="clear"
                      variant="ghost"
                      disabled={busy}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </Form>
            </Card>
          );
        })}
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="text-xl">Cash in and out of registered accounts</h2>
          <Label>as your brokerage reports it, from your earliest limit date</Label>
        </div>
        {d.activities.length === 0 ? (
          <p className="mt-5 text-sm text-ink-muted">
            Nothing yet. Save a limit above and refresh.
          </p>
        ) : (
          <ul className="mt-5 flex flex-col gap-2">
            {d.activities.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-tile bg-raised px-5 py-4"
              >
                <Label>{a.tradeDate}</Label>
                <span
                  className={`font-mono text-[11px] font-bold tracking-[0.16em] uppercase ${TYPE_TEXT[a.accountType]}`}
                >
                  {a.typeLabel}
                </span>
                <span className="text-sm">{a.accountName}</span>
                <span className="rounded-full bg-surface px-3 py-1 font-mono text-[10px] tracking-[0.12em] text-ink-muted uppercase">
                  {a.type.toLowerCase()}
                </span>
                {a.description && <Label className="hidden lg:inline">{a.description}</Label>}
                <span className="num ml-auto font-mono text-sm font-bold">
                  {money(Math.abs(a.amountCents))}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-5 max-w-lg text-xs text-ink-muted">{copy.roomWithdrawals}</p>
      </section>
    </>
  );
}
