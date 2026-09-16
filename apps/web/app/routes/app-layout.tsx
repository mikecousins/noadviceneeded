import { Form, Link, NavLink, Outlet, useLocation } from "react-router";

import { Button } from "~/components/ui";
import { requireUser } from "~/lib/session.server";
import { hasTradeScope } from "~/lib/snaptrade.server";

import type { Route } from "./+types/app-layout";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return {
    email: user.email,
    tradeScope: await hasTradeScope(user.id),
    targetTicker: user.targetTicker,
  };
}

const tabs = [
  { to: "/app", label: "Dashboard", end: true },
  { to: "/app/invest", label: "Invest", end: false },
  { to: "/app/withdraw", label: "Withdraw", end: false },
  { to: "/app/accounts", label: "Accounts", end: false },
  { to: "/app/etf", label: "ETF", end: false },
  { to: "/app/room", label: "Room", end: false },
  { to: "/app/orders", label: "Orders", end: false },
];

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const { email, tradeScope, targetTicker } = loaderData;
  const location = useLocation();
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div className="flex flex-wrap items-center gap-6">
          <Link to="/" className="text-lg font-semibold text-accent">
            No Advice Needed
          </Link>
          <nav aria-label="App" className="flex flex-wrap gap-1 text-sm">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1 ${isActive ? "bg-accent-soft font-medium text-accent" : "text-ink-muted hover:text-ink"}`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm text-ink-muted">
          <span>{email}</span>
          <Form method="post" action="/auth/sign-out">
            <button type="submit" className="underline-offset-2 hover:underline">
              Sign out
            </button>
          </Form>
        </div>
      </header>

      {!tradeScope && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-card border border-warn bg-warn-soft p-4 text-sm">
          <p className="max-w-prose">
            This app can read your accounts but not place orders yet. Enabling trading sends you to
            SnapTrade once more to add that permission. Nothing is bought or sold without your
            confirmation on the Invest or Withdraw page.
          </p>
          <Form method="post" action="/auth/snaptrade/start">
            <input type="hidden" name="scope" value="trade" />
            <input type="hidden" name="returnTo" value={location.pathname} />
            <Button type="submit">Enable trading at SnapTrade</Button>
          </Form>
        </div>
      )}

      {!targetTicker && location.pathname !== "/app/etf" && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-surface p-4 text-sm">
          <p>Choose the one all-in-one ETF every account will hold before investing.</p>
          <Link
            to="/app/etf"
            className="font-medium text-accent underline-offset-2 hover:underline"
          >
            Choose an ETF
          </Link>
        </div>
      )}

      <main>
        <Outlet />
      </main>

      <footer className="mt-12 max-w-prose text-xs text-ink-muted">
        Balances and positions as SnapTrade last read them, usually once a day. Orders are market
        orders for the day, placed only when you confirm. Nothing here is advice; check with your
        brokerage or CRA before acting on room figures.
      </footer>
    </div>
  );
}
