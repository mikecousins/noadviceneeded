import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  CONTRIBUTION_NOTES,
  WITHDRAWAL_NOTES,
} from "@noadviceneeded/engine";
import { Form, useNavigation } from "react-router";
import { z } from "zod";

import { SyncStatus } from "~/components/sync-status";
import { Badge, Button, Card, Notice, PageTitle } from "~/components/ui";
import { getDb } from "~/lib/db.server";
import { money } from "~/lib/format";
import { listAccounts, moveAccount, updateAccountChoices } from "~/lib/portfolio.server";
import { requireUser } from "~/lib/session.server";
import { syncUser } from "~/lib/sync.server";

import type { Route } from "./+types/app.accounts";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Accounts · No Advice Needed" }];
}

async function load(user: Awaited<ReturnType<typeof requireUser>>, force = false) {
  const db = getDb();
  const sync = await syncUser(db, user, { force });
  const rows = await listAccounts(db, user.id);
  const accounts = rows.map((a) => ({
    id: a.id,
    name: a.name,
    numberMasked: a.numberMasked,
    brokerageName: a.brokerageName,
    rawType: a.rawType,
    accountType: a.accountType,
    included: a.included,
    contributionRank: a.contributionRank,
    withdrawalRank: a.withdrawalRank,
    valueCents: a.lastValueCents,
    cashCents: a.cashCents,
    currency: a.currency,
    statusRaw: a.statusRaw,
    connectionStatus: a.connectionStatus,
    canTrade: a.connectionCanTrade,
  }));
  return {
    sync: { status: sync.status, syncedAt: sync.syncedAt?.toISOString() ?? null },
    accounts,
  };
}

export async function loader({ request }: Route.LoaderArgs) {
  return { ...(await load(await requireUser(request))), saved: null as number | null };
}

const Type = z.enum(ACCOUNT_TYPES);
const Order = z.enum(["contribution", "withdrawal"]);
const Direction = z.enum(["up", "down"]);

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const db = getDb();
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "refresh") return { ...(await load(user, true)), saved: null };

  if (intent === "save") {
    const ids = form
      .getAll("accountId")
      .map((v) => z.guid().safeParse(v))
      .flatMap((r) => (r.success ? [r.data] : []));
    const choices = ids.flatMap((accountId) => {
      const type = Type.safeParse(form.get(`type:${accountId}`));
      if (!type.success) return [];
      return [
        { accountId, included: form.get(`included:${accountId}`) === "on", accountType: type.data },
      ];
    });
    const saved = await updateAccountChoices(db, user.id, choices);
    return { ...(await load(user)), saved };
  }

  if (intent === "move") {
    const accountId = z.guid().safeParse(form.get("accountId"));
    const order = Order.safeParse(form.get("order"));
    const direction = Direction.safeParse(form.get("direction"));
    if (accountId.success && order.success && direction.success) {
      await moveAccount(db, user.id, accountId.data, order.data, direction.data);
    }
    return { ...(await load(user)), saved: null };
  }

  return { ...(await load(user)), saved: null };
}

const connectionCopy = {
  active: null,
  disabled: "Needs attention at SnapTrade: the brokerage login stopped working.",
  removed: "No longer shared with this app.",
} as const;

export default function Accounts({ loaderData, actionData }: Route.ComponentProps) {
  const d = actionData ?? loaderData;
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const included = d.accounts.filter((a) => a.included);
  const byContribution = [...included].sort((a, b) => a.contributionRank - b.contributionRank);
  const byWithdrawal = [...included].sort((a, b) => a.withdrawalRank - b.withdrawalRank);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle
          title="Accounts"
          lede="Everything SnapTrade shares with this app. Confirm each account's type, tick the ones in the plan, then set the two orders."
        />
        <SyncStatus sync={d.sync} />
      </div>

      {d.saved !== null && (
        <Notice tone="success" className="mt-4">
          Saved {d.saved === 1 ? "1 account" : `${d.saved} accounts`}. New accounts join the end of
          both orders; move them below.
        </Notice>
      )}

      {d.accounts.length === 0 ? (
        <Card className="mt-6">
          <h2 className="text-lg">Nothing shared yet</h2>
          <p className="mt-2 max-w-prose text-ink-muted">
            Connect a brokerage in the SnapTrade dashboard, then refresh here.
          </p>
          <a
            href="https://dashboard.snaptrade.com"
            className="mt-4 inline-block rounded-full bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Open SnapTrade
          </a>
        </Card>
      ) : (
        <>
          <Form method="post">
            <input type="hidden" name="intent" value="save" />
            <Card className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-ink-muted">
                  <tr>
                    <th className="py-1 font-medium">In plan</th>
                    <th className="py-1 font-medium">Account</th>
                    <th className="py-1 font-medium">Type</th>
                    <th className="num py-1 font-medium">Value</th>
                    <th className="num py-1 font-medium">Cash</th>
                    <th className="py-1 font-medium">Trading</th>
                  </tr>
                </thead>
                <tbody>
                  {d.accounts.map((a) => (
                    <tr key={a.id} className="border-t border-line align-top">
                      <td className="py-3">
                        <input type="hidden" name="accountId" value={a.id} />
                        <input
                          type="checkbox"
                          name={`included:${a.id}`}
                          defaultChecked={a.included}
                          aria-label={`Include ${a.name}`}
                          disabled={a.connectionStatus === "removed"}
                        />
                      </td>
                      <td className="py-3">
                        {a.name} <span className="text-ink-muted">{a.numberMasked}</span>
                        <span className="block text-xs text-ink-muted">
                          {a.brokerageName}
                          {a.rawType ? ` · reported as "${a.rawType}"` : ""}
                        </span>
                        {connectionCopy[a.connectionStatus] && (
                          <span className="block text-xs text-danger">
                            {connectionCopy[a.connectionStatus]}
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        <select
                          name={`type:${a.id}`}
                          defaultValue={a.accountType}
                          aria-label="Type"
                        >
                          {ACCOUNT_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {ACCOUNT_TYPE_LABELS[t]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="num py-3">
                        {money(a.valueCents, { currency: a.currency, whole: true })}
                      </td>
                      <td className="num py-3">{money(a.cashCents)}</td>
                      <td className="py-3">
                        {a.canTrade ? (
                          <Badge tone="success">Orders allowed</Badge>
                        ) : (
                          <Badge tone="warn">Read-only</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex justify-end">
                <Button type="submit" disabled={busy}>
                  {busy && navigation.formData?.get("intent") === "save"
                    ? "Saving…"
                    : "Save accounts"}
                </Button>
              </div>
            </Card>
          </Form>

          <section className="mt-8 grid gap-6 md:grid-cols-2">
            <OrderList
              title="Where new cash goes"
              lede="The first account with room is suggested for your next deposit."
              order="contribution"
              accounts={byContribution}
              notes={CONTRIBUTION_NOTES}
              busy={busy}
            />
            <OrderList
              title="Where withdrawals come from"
              lede="Units are sold from the top down until the amount is covered."
              order="withdrawal"
              accounts={byWithdrawal}
              notes={WITHDRAWAL_NOTES}
              busy={busy}
            />
          </section>
        </>
      )}
    </>
  );
}

function OrderList({
  title,
  lede,
  order,
  accounts,
  notes,
  busy,
}: {
  title: string;
  lede: string;
  order: "contribution" | "withdrawal";
  accounts: {
    id: string;
    name: string;
    numberMasked: string;
    brokerageName: string;
    accountType: keyof typeof ACCOUNT_TYPE_LABELS;
  }[];
  notes: Record<keyof typeof ACCOUNT_TYPE_LABELS, string>;
  busy: boolean;
}) {
  return (
    <Card>
      <h2 className="text-lg">{title}</h2>
      <p className="mt-1 text-sm text-ink-muted">{lede}</p>
      {accounts.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">No accounts in the plan yet.</p>
      ) : (
        <ol className="mt-4 space-y-2">
          {accounts.map((a, i) => (
            <li
              key={a.id}
              className="flex items-center gap-3 rounded-lg bg-canvas px-3 py-2 text-sm"
            >
              <span className="w-5 text-ink-muted">{i + 1}</span>
              <span className="flex-1">
                <span className="font-medium">{ACCOUNT_TYPE_LABELS[a.accountType]}</span> {a.name}{" "}
                <span className="text-ink-muted">
                  {a.numberMasked} · {a.brokerageName}
                </span>
                <span className="block text-xs text-ink-muted">{notes[a.accountType]}</span>
              </span>
              <Form method="post" className="flex gap-1">
                <input type="hidden" name="intent" value="move" />
                <input type="hidden" name="order" value={order} />
                <input type="hidden" name="accountId" value={a.id} />
                <button
                  type="submit"
                  name="direction"
                  value="up"
                  disabled={busy || i === 0}
                  aria-label={`Move ${a.name} up`}
                  className="rounded px-2 text-ink-muted hover:bg-accent-soft hover:text-accent disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="submit"
                  name="direction"
                  value="down"
                  disabled={busy || i === accounts.length - 1}
                  aria-label={`Move ${a.name} down`}
                  className="rounded px-2 text-ink-muted hover:bg-accent-soft hover:text-accent disabled:opacity-30"
                >
                  ▼
                </button>
              </Form>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
