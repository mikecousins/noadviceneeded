import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  CONTRIBUTION_NOTES,
  WITHDRAWAL_NOTES,
} from "@noadviceneeded/engine";
import { Form, useNavigation } from "react-router";
import { z } from "zod";

import { SyncStatus } from "~/components/sync-status";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Label,
  Notice,
  PageTitle,
  TypeTag,
} from "~/components/ui";
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
      <div className="flex flex-wrap items-start justify-between gap-6">
        <PageTitle
          title="Your order"
          lede="Guideline one, as two lists. Nudge either one; the app never argues with an override."
        />
        <SyncStatus sync={d.sync} />
      </div>

      {d.saved !== null && (
        <Notice tone="success" className="mt-6">
          Saved {d.saved === 1 ? "1 account" : `${d.saved} accounts`}. New accounts join the end of
          both orders.
        </Notice>
      )}

      {d.accounts.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Nothing shared yet"
            body="Connect a brokerage in the SnapTrade dashboard, then refresh here."
            action={
              <a
                href="https://dashboard.snaptrade.com"
                className="inline-flex rounded-full bg-accent px-5 py-3 font-mono text-[11px] font-bold tracking-[0.14em] text-canvas uppercase hover:opacity-90"
              >
                Open SnapTrade
              </a>
            }
          />
        </div>
      ) : (
        <>
          <section className="mt-8 grid gap-4 lg:grid-cols-2">
            <OrderList
              heading="cash goes in"
              tone="accent"
              order="contribution"
              accounts={byContribution}
              notes={CONTRIBUTION_NOTES}
              busy={busy}
            />
            <OrderList
              heading="cash comes out"
              tone="sell"
              order="withdrawal"
              accounts={byWithdrawal}
              notes={WITHDRAWAL_NOTES}
              busy={busy}
            />
          </section>

          <Form method="post" className="mt-4">
            <input type="hidden" name="intent" value="save" />
            <Card>
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <h2 className="text-xl">Everything shared</h2>
                <Label>tick what belongs in the plan · fix any wrong type</Label>
              </div>

              <ul className="mt-5 flex flex-col gap-2">
                {d.accounts.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-tile bg-raised px-5 py-4"
                  >
                    <input type="hidden" name="accountId" value={a.id} />
                    <input
                      type="checkbox"
                      name={`included:${a.id}`}
                      defaultChecked={a.included}
                      aria-label={`Include ${a.name}`}
                      disabled={a.connectionStatus === "removed"}
                    />
                    <div className="min-w-48">
                      <p className="text-sm font-medium">
                        {a.name} <span className="text-ink-muted">{a.numberMasked}</span>
                      </p>
                      <Label>
                        {a.brokerageName}
                        {a.rawType ? ` · reported as "${a.rawType}"` : ""}
                      </Label>
                      {connectionCopy[a.connectionStatus] && (
                        <p className="mt-1 text-xs text-danger">
                          {connectionCopy[a.connectionStatus]}
                        </p>
                      )}
                    </div>
                    <select name={`type:${a.id}`} defaultValue={a.accountType} aria-label="Type">
                      {ACCOUNT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {ACCOUNT_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                    <span className="num ml-auto font-mono text-sm font-bold">
                      {money(a.valueCents, { currency: a.currency, whole: true })}
                    </span>
                    <span className="num w-28 text-right font-mono text-sm text-ink-muted">
                      {money(a.cashCents)}
                    </span>
                    {a.canTrade ? (
                      <Badge tone="success">Orders allowed</Badge>
                    ) : (
                      <Badge tone="warn">Read-only</Badge>
                    )}
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex justify-end">
                <Button type="submit" disabled={busy}>
                  {busy && navigation.formData?.get("intent") === "save" ? "Saving…" : "Save"}
                </Button>
              </div>
            </Card>
          </Form>
        </>
      )}
    </>
  );
}

function Chevron({ direction }: { direction: "up" | "down" }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={direction === "up" ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} />
    </svg>
  );
}

function OrderList({
  heading,
  tone,
  order,
  accounts,
  notes,
  busy,
}: {
  heading: string;
  tone: "accent" | "sell";
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
  const arrow = tone === "accent" ? "m6 13 6 6 6-6" : "m6 11 6-6 6 6";
  return (
    <Card>
      <div className="flex items-center gap-3">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={tone === "accent" ? "text-accent" : "text-sell"}
        >
          <path d={tone === "accent" ? "M12 5v14" : "M12 19V5"} />
          <path d={arrow} />
        </svg>
        <Label className={tone === "accent" ? "text-accent" : "text-sell"}>{heading}</Label>
      </div>

      {accounts.length === 0 ? (
        <p className="mt-5 text-sm text-ink-muted">No accounts in the plan yet.</p>
      ) : (
        <ol className="mt-5 flex flex-col gap-2">
          {accounts.map((a, i) => (
            <li key={a.id} className="flex items-center gap-4 rounded-tile bg-raised px-4 py-3">
              <span
                className={`figure w-7 text-2xl ${tone === "accent" ? "text-accent" : "text-sell"}`}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <TypeTag type={a.accountType} />
                  <span className="font-mono text-xs tracking-[0.1em]">{a.numberMasked}</span>
                  <Label>{a.brokerageName}</Label>
                </div>
                <p className="mt-2 text-xs text-ink-muted">{notes[a.accountType]}</p>
              </div>
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
                  className="flex size-11 items-center justify-center rounded-xl bg-line text-ink transition hover:text-accent disabled:text-ink-dim"
                >
                  <Chevron direction="up" />
                </button>
                <button
                  type="submit"
                  name="direction"
                  value="down"
                  disabled={busy || i === accounts.length - 1}
                  aria-label={`Move ${a.name} down`}
                  className="flex size-11 items-center justify-center rounded-xl bg-line text-ink transition hover:text-accent disabled:text-ink-dim"
                >
                  <Chevron direction="down" />
                </button>
              </Form>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
