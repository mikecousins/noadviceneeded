import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPES_BY_COUNTRY,
  ACCOUNT_TYPE_LABELS,
  CONTRIBUTION_NOTES,
  WITHDRAWAL_NOTES,
} from "@noadviceneeded/engine";
import { Form, useNavigation } from "react-router";
import { z } from "zod";

import { SyncStatus } from "~/components/sync-status";
import {
  AccountName,
  AnchorButton,
  Badge,
  Button,
  Disclosure,
  EmptyState,
  Label,
  Notice,
  PageTitle,
  TypeTag,
} from "~/components/ui";
import { COUNTRY_COPY, effectiveCountry } from "~/lib/country";
import { getDb } from "~/lib/db.server";
import { plural } from "~/lib/format";
import { listAccounts, moveAccount, updateAccountChoices } from "~/lib/portfolio.server";
import { requireUser } from "~/lib/session.server";
import { syncUser } from "~/lib/sync.server";
import { useMoney } from "~/lib/use-money";

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
    fractional: a.fractional,
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
    country: effectiveCountry(user),
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
        {
          accountId,
          included: form.get(`included:${accountId}`) === "on",
          fractional: form.get(`fractional:${accountId}`) === "on",
          accountType: type.data,
        },
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

/** Where the user adds or fixes a brokerage; connections live at SnapTrade, not here. */
const SNAPTRADE_DASHBOARD = "https://dashboard.snaptrade.com";

/** Lists this long start folded; the summary line still says what is inside. */
const FOLD_AT = 8;

export default function Accounts({ loaderData, actionData }: Route.ComponentProps) {
  const d = actionData ?? loaderData;
  const money = useMoney();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const included = d.accounts.filter((a) => a.included);
  const brokerages = new Set(d.accounts.map((a) => a.brokerageName)).size;
  // The country's own types, plus whatever an account already is so the
  // select never silently shows something else after a country switch.
  const typeOptions = (current: (typeof d.accounts)[number]["accountType"]) => {
    const offered = ACCOUNT_TYPES_BY_COUNTRY[d.country];
    return offered.includes(current) ? offered : [...offered, current];
  };
  const byContribution = [...included].sort((a, b) => a.contributionRank - b.contributionRank);
  const byWithdrawal = [...included].sort((a, b) => a.withdrawalRank - b.withdrawalRank);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <PageTitle
          title="Your order"
          lede="Guideline one, as two lists. Nudge either one; the app never argues with an override."
        />
        <div className="flex flex-wrap items-start gap-3">
          <SyncStatus sync={d.sync} />
          <AnchorButton
            href={SNAPTRADE_DASHBOARD}
            target="_blank"
            rel="noreferrer"
            variant="secondary"
            size="sm"
          >
            Link another brokerage ↗
          </AnchorButton>
        </div>
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
              <AnchorButton href={SNAPTRADE_DASHBOARD} target="_blank" rel="noreferrer">
                Open SnapTrade ↗
              </AnchorButton>
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
            <Disclosure
              open={d.accounts.length <= FOLD_AT}
              summary={
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <h2 className="text-xl">Everything shared</h2>
                  <Label>
                    {plural(d.accounts.length, "account")} · {included.length} in the plan ·{" "}
                    {plural(brokerages, "brokerage")}
                  </Label>
                </div>
              }
            >
              <Label>
                tick what belongs in the plan · fix any wrong type · tick fractions where your
                brokerage fills them
              </Label>

              <ul className="mt-4 flex flex-col gap-1.5">
                {d.accounts.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-tile bg-raised px-4 py-2.5"
                  >
                    <input type="hidden" name="accountId" value={a.id} />
                    <input
                      type="checkbox"
                      name={`included:${a.id}`}
                      defaultChecked={a.included}
                      aria-label={`Include ${a.name}`}
                      disabled={a.connectionStatus === "removed"}
                    />
                    <div className="min-w-44 flex-1">
                      <p className="text-sm font-medium">
                        <AccountName name={a.name} numberMasked={a.numberMasked} />
                      </p>
                      <Label>
                        {a.brokerageName}
                        {a.rawType ? ` · "${a.rawType}"` : ""}
                      </Label>
                      {connectionCopy[a.connectionStatus] && (
                        <p className="mt-1 text-xs text-danger">
                          {connectionCopy[a.connectionStatus]}
                        </p>
                      )}
                    </div>
                    <select
                      name={`type:${a.id}`}
                      defaultValue={a.accountType}
                      aria-label="Type"
                      className="py-1.5 text-xs"
                    >
                      {typeOptions(a.accountType).map((t) => (
                        <option key={t} value={t}>
                          {ACCOUNT_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name={`fractional:${a.id}`}
                        defaultChecked={a.fractional}
                        disabled={a.connectionStatus === "removed"}
                      />
                      <Label>fractions</Label>
                    </label>
                    <span className="num w-24 text-right font-mono text-sm font-bold">
                      {money(a.valueCents, { currency: a.currency, whole: true })}
                    </span>
                    <span className="num w-24 text-right font-mono text-xs text-ink-muted">
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

              <p className="mt-5 max-w-lg text-xs text-ink-muted">
                Fractions: tick it when the brokerage lets you buy less than one unit of your ETF (
                {COUNTRY_COPY[d.country].fractional}). Orders in that account are then sent as a
                dollar amount, so every cent is spent and a withdrawal lands to the cent; the
                brokerage works out the units. If the brokerage refuses, the order fails before
                anything is placed and shows on the Orders page.
              </p>
              <div className="mt-6 flex justify-end">
                <Button type="submit" disabled={busy}>
                  {busy && navigation.formData?.get("intent") === "save" ? "Saving…" : "Save"}
                </Button>
              </div>
            </Disclosure>
          </Form>
        </>
      )}
    </>
  );
}

function Chevron({ direction }: { direction: "up" | "down" }) {
  return (
    <svg
      width="16"
      height="16"
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
  const color = tone === "accent" ? "text-accent" : "text-sell";
  const arrow = tone === "accent" ? "m6 13 6 6 6-6" : "m6 11 6-6 6 6";
  const move =
    "flex size-8 items-center justify-center rounded-lg bg-line text-ink transition hover:text-accent disabled:text-ink-dim";
  // The note explains the type, not the account, so it appears once per type:
  // on the first account of that type in the list.
  const explained = new Set<string>();

  return (
    <Disclosure
      open={accounts.length <= FOLD_AT}
      summary={
        <div className="flex flex-wrap items-center gap-3">
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
            className={color}
          >
            <path d={tone === "accent" ? "M12 5v14" : "M12 19V5"} />
            <path d={arrow} />
          </svg>
          <Label className={color}>{heading}</Label>
          <Label>· {plural(accounts.length, "account")}</Label>
        </div>
      }
      preview={
        accounts.length > 0 && (
          <ol className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {accounts.slice(0, 3).map((a, i) => (
              <li key={a.id} className="flex items-center gap-2">
                <span className={`figure text-base ${color}`}>{i + 1}</span>
                <TypeTag type={a.accountType} />
                <span className="text-sm">{a.name}</span>
              </li>
            ))}
            {accounts.length > 3 && <Label>+{accounts.length - 3} more</Label>}
          </ol>
        )
      }
    >
      {accounts.length === 0 ? (
        <p className="text-sm text-ink-muted">No accounts in the plan yet.</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {accounts.map((a, i) => {
            const explain = !explained.has(a.accountType);
            explained.add(a.accountType);
            return (
              <li key={a.id} className="flex items-center gap-3 rounded-tile bg-raised px-3 py-2">
                <span className={`figure w-6 text-lg ${color}`}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <TypeTag type={a.accountType} />
                    <AccountName
                      name={a.name}
                      numberMasked={a.numberMasked}
                      className="text-sm font-medium"
                    />
                    <Label>{a.brokerageName}</Label>
                  </div>
                  {explain && <p className="mt-1 text-xs text-ink-muted">{notes[a.accountType]}</p>}
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
                    className={move}
                  >
                    <Chevron direction="up" />
                  </button>
                  <button
                    type="submit"
                    name="direction"
                    value="down"
                    disabled={busy || i === accounts.length - 1}
                    aria-label={`Move ${a.name} down`}
                    className={move}
                  >
                    <Chevron direction="down" />
                  </button>
                </Form>
              </li>
            );
          })}
        </ol>
      )}
    </Disclosure>
  );
}
