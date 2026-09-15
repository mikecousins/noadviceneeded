import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_LONG_NAMES,
  CONTRIBUTION_NOTES,
  ROOM_TYPES,
} from "@noadviceneeded/engine";
import { Form, useNavigation } from "react-router";
import { z } from "zod";

import { SyncStatus } from "~/components/sync-status";
import { Button, Card, Notice, PageTitle } from "~/components/ui";
import { getDb } from "~/lib/db.server";
import { money, parseDollarsToCents, todayIso } from "~/lib/format";
import {
  clearRoomBaseline,
  listAccounts,
  listRoomActivities,
  setRoomBaseline,
} from "~/lib/portfolio.server";
import { roomSummary } from "~/lib/room.server";
import { requireUser } from "~/lib/session.server";
import { syncUser } from "~/lib/sync.server";

import type { Route } from "./+types/app.room";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Room · No Advice Needed" }];
}

async function load(user: Awaited<ReturnType<typeof requireUser>>, force = false) {
  const db = getDb();
  const sync = await syncUser(db, user, { force });
  const accounts = await listAccounts(db, user.id);
  const [summary, activities] = await Promise.all([
    roomSummary(db, user.id, accounts),
    listRoomActivities(db, user.id),
  ]);
  return {
    sync: { status: sync.status, syncedAt: sync.syncedAt?.toISOString() ?? null },
    today: todayIso(),
    summary: summary.map((s) => ({
      ...s,
      label: ACCOUNT_TYPE_LABELS[s.accountType],
      longName: ACCOUNT_TYPE_LONG_NAMES[s.accountType],
      note: CONTRIBUTION_NOTES[s.accountType],
    })),
    activities: activities
      .slice(0, 100)
      .map((a) => ({ ...a, typeLabel: ACCOUNT_TYPE_LABELS[a.accountType] })),
  };
}

export async function loader({ request }: Route.LoaderArgs) {
  return { ...(await load(await requireUser(request))), message: null as string | null };
}

const RoomType = z.enum(ROOM_TYPES);

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const db = getDb();
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "refresh") return { ...(await load(user, true)), message: null };

  const type = RoomType.safeParse(form.get("type"));
  if (!type.success) return { ...(await load(user)), message: "Unknown account type." };

  if (intent === "clear") {
    await clearRoomBaseline(db, user.id, type.data);
    return { ...(await load(user)), message: `${ACCOUNT_TYPE_LABELS[type.data]} room cleared.` };
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
    return { ...(await load(user)), message: `${ACCOUNT_TYPE_LABELS[type.data]} room saved.` };
  }

  return { ...(await load(user)), message: null };
}

export default function Room({ loaderData, actionData }: Route.ComponentProps) {
  const d = actionData ?? loaderData;
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle
          title="Contribution room"
          lede="Enter the room CRA My Account shows for each registered type and the date it was true. Contributions your brokerage reports after that date are subtracted automatically."
        />
        <SyncStatus sync={d.sync} />
      </div>

      {d.message && (
        <Notice tone="success" className="mt-4">
          {d.message}
        </Notice>
      )}

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {d.summary.map((s) => (
          <Card key={s.accountType}>
            <h2 className="text-lg">
              {s.label} <span className="text-sm font-normal text-ink-muted">{s.longName}</span>
            </h2>
            <p className="money mt-2 text-2xl font-semibold">
              {s.remainingCents === null ? "—" : money(s.remainingCents, { whole: true })}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {s.baseline
                ? `${money(s.baseline.roomCents, { whole: true })} as of ${s.baseline.asOf}, less ${money(s.contributedSinceCents, { whole: true })} contributed since.`
                : "No baseline yet."}
              {s.accountCount === 0 && " No connected account of this type."}
            </p>
            {s.remainingCents !== null && s.remainingCents < 0 && (
              <p className="mt-1 text-xs text-danger">
                Over the room you entered. Check CRA My Account.
              </p>
            )}
            <p className="mt-2 text-xs text-ink-muted">{s.note}</p>
            <Form method="post" className="mt-4 flex flex-col gap-2 text-sm">
              <input type="hidden" name="type" value={s.accountType} />
              <label className="flex flex-col gap-1">
                <span className="text-xs text-ink-muted">Room (CAD)</span>
                <input
                  type="text"
                  name="room"
                  inputMode="decimal"
                  defaultValue={s.baseline ? (s.baseline.roomCents / 100).toFixed(2) : ""}
                  placeholder="7,000"
                  required
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-ink-muted">True as of</span>
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
                  <Button type="submit" name="intent" value="clear" variant="ghost" disabled={busy}>
                    Clear
                  </Button>
                )}
              </div>
            </Form>
          </Card>
        ))}
      </section>

      <Card className="mt-8 overflow-x-auto">
        <h2 className="text-lg">Cash movements in registered accounts</h2>
        <p className="mt-1 text-sm text-ink-muted">
          As your brokerage reports them through SnapTrade, from the earliest baseline date onward.
          Withdrawals are shown but do not add room back until January 1.
        </p>
        {d.activities.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">Nothing yet. Save a baseline and refresh.</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs text-ink-muted">
              <tr>
                <th className="py-1 font-medium">Date</th>
                <th className="py-1 font-medium">Account</th>
                <th className="py-1 font-medium">Type</th>
                <th className="num py-1 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {d.activities.map((a) => (
                <tr key={a.id} className="border-t border-line">
                  <td className="py-2">{a.tradeDate}</td>
                  <td className="py-2">
                    {a.typeLabel} {a.accountName}
                    {a.description && (
                      <span className="block text-xs text-ink-muted">{a.description}</span>
                    )}
                  </td>
                  <td className="py-2">{a.type}</td>
                  <td className="num py-2">{money(Math.abs(a.amountCents))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
