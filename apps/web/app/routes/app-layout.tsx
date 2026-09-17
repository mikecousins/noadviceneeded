import { COUNTRY_LABELS } from "@noadviceneeded/engine";
import { Form, Link, NavLink, Outlet, redirect, useLocation } from "react-router";

import { Button, Label, Logo, TooltipProvider } from "~/components/ui";
import { COUNTRY_COPY, effectiveCountry } from "~/lib/country";
import { requireUser } from "~/lib/session.server";
import { hasTradeScope } from "~/lib/snaptrade.server";

import type { Route } from "./+types/app-layout";

const COUNTRY_PATH = "/app/country";

export async function loader({ request, url }: Route.LoaderArgs) {
  const user = await requireUser(request);
  // The country decides account types, room and the fund list, so it is the
  // first thing asked and nothing else renders until it is answered.
  if (user.country === null && url.pathname !== COUNTRY_PATH) {
    throw redirect(COUNTRY_PATH);
  }
  return {
    email: user.email,
    country: effectiveCountry(user),
    countryChosen: user.country !== null,
    tradeScope: await hasTradeScope(user.id),
    targetTicker: user.targetTicker,
  };
}

const tabs = [
  { to: "/app", label: "Home", end: true },
  { to: "/app/invest", label: "Invest", end: false },
  { to: "/app/withdraw", label: "Withdraw", end: false },
  { to: "/app/accounts", label: "Accounts", end: false },
  { to: "/app/etf", label: "Fund", end: false },
  { to: "/app/room", label: "Room", end: false },
  { to: "/app/orders", label: "Orders", end: false },
];

const tab =
  "rounded-full border px-4 py-3.5 font-mono text-[10px] tracking-[0.16em] uppercase transition";

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const { email, country, countryChosen, tradeScope, targetTicker } = loaderData;
  const location = useLocation();
  const onCountryPage = location.pathname === COUNTRY_PATH;
  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-4 border-b-2 border-line py-5">
        <Link to="/" className="flex items-center gap-3">
          <Logo />
          <span className="font-mono text-[10px] leading-relaxed tracking-[0.2em] uppercase">
            no advice
            <br />
            needed
          </span>
        </Link>

        <nav aria-label="App" className="flex flex-wrap gap-1">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                isActive
                  ? `${tab} border-accent bg-accent font-bold text-canvas`
                  : `${tab} border-line text-ink-muted hover:border-ink-muted hover:text-ink`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <Link
            to={COUNTRY_PATH}
            aria-label={`Country: ${COUNTRY_LABELS[country]}`}
            className={`${tab} ${
              onCountryPage
                ? "border-accent text-accent"
                : "border-line text-ink-muted hover:border-ink-muted hover:text-ink"
            }`}
          >
            {country}
          </Link>
          <Label className="hidden sm:inline">{email}</Label>
          <Form method="post" action="/auth/sign-out">
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </Form>
        </div>
      </header>

      {countryChosen && !tradeScope && (
        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-card border-2 border-warn bg-warn-soft p-5">
          <p className="max-w-lg flex-1 text-sm">
            <span className="font-mono text-[10px] tracking-[0.2em] text-warn uppercase">
              read-only
            </span>
            <br />
            This app can read your accounts but not place orders yet. Nothing is bought or sold
            without your confirmation on the Invest or Withdraw page.
          </p>
          <Form method="post" action="/auth/snaptrade/start">
            <input type="hidden" name="scope" value="trade" />
            <input type="hidden" name="returnTo" value={location.pathname} />
            <Button type="submit">Enable trading</Button>
          </Form>
        </div>
      )}

      {countryChosen && !targetTicker && location.pathname !== "/app/etf" && (
        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-card border-2 border-line bg-surface p-5">
          <p className="flex-1 text-sm">Pick the one all-in-one ETF every account will hold.</p>
          <Link
            to="/app/etf"
            className="font-mono text-[11px] tracking-[0.14em] text-accent uppercase underline-offset-4 hover:underline"
          >
            Choose a fund
          </Link>
        </div>
      )}

      <main className="pt-8">
        <TooltipProvider>
          <Outlet />
        </TooltipProvider>
      </main>

      <footer className="mt-16 border-t border-line pt-6 text-xs text-ink-muted">
        Balances and positions as SnapTrade last read them. Orders are market orders for the day,
        placed only when you confirm. Nothing here is advice; check with your brokerage or{" "}
        {COUNTRY_COPY[country].authority} before acting on room figures.
      </footer>
    </div>
  );
}
