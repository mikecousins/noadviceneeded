import { Form, Link, useNavigation } from "react-router";

import { Card } from "~/components/ui";
import { getOptionalUser } from "~/lib/session.server";

import type { Route } from "./+types/home";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "No Advice Needed" },
    {
      name: "description",
      content:
        "Investing is easy if you follow two guidelines: registered accounts first, one all-in-one ETF. Connect your Canadian brokerage accounts and do both with one click.",
    },
  ];
}

const signInMessages: Record<string, string> = {
  declined:
    "You didn't grant access at SnapTrade, so nothing was connected. You can try again any time.",
  expired: "That sign-in took longer than 10 minutes. Start again and it will go through.",
  mismatch: "That sign-in link didn't match the one we started. Start again from this page.",
  failed: "SnapTrade didn't complete the sign-in. Try again in a moment.",
  email: "SnapTrade didn't share an email address, which this app needs to keep your account.",
  reconnect: "Your SnapTrade access has ended. Sign in again to reconnect.",
};

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getOptionalUser(request);
  const reason = new URL(request.url).searchParams.get("signin");
  return {
    signedIn: user !== null,
    signInMessage: reason ? (signInMessages[reason] ?? signInMessages["failed"]) : null,
  };
}

const guidelines = [
  {
    title: "Registered accounts first",
    body: "New money goes to your FHSA, then TFSA, then RRSP, and only then a non-registered account. The app keeps that order for you, tracks your room, and names the account to fund next.",
  },
  {
    title: "One all-in-one ETF",
    body: "Every account holds the same all-in-one ETF. It is already diversified and already rebalanced, so there is nothing else to pick or tune.",
  },
];

const steps = [
  {
    title: "Connect",
    body: "Sign in with SnapTrade and share the accounts you want in the plan: TFSA, RRSP, FHSA, non-registered.",
  },
  {
    title: "Pick an all-in-one ETF",
    body: "Choose one from Vanguard, iShares, or BMO, or search for another your brokerage offers. Every account holds the same thing.",
  },
  {
    title: "Invest with one click",
    body: "When cash lands in an account, buy your ETF with it. The app suggests which account to fund next from your order and your room.",
  },
  {
    title: "Withdraw with one click",
    body: "Say how much you need. Units are sold in your withdrawal order and the app tells you what to move out.",
  },
];

function SignInButton({ className }: { className?: string }) {
  return (
    <Form method="post" action="/auth/snaptrade/start">
      <button
        type="submit"
        className={`rounded-full bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 ${className ?? ""}`}
      >
        Sign in with SnapTrade
      </button>
    </Form>
  );
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { signedIn, signInMessage } = loaderData;
  const navigation = useNavigation();
  const opening = navigation.state !== "idle" && navigation.location?.pathname === "/app";

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold text-accent">No Advice Needed</span>
        {signedIn ? (
          <Link
            to="/app"
            aria-busy={opening}
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 aria-busy:opacity-70"
          >
            {opening ? "Opening…" : "Open the app"}
          </Link>
        ) : (
          <SignInButton />
        )}
      </header>

      {signInMessage && (
        <p role="status" className="mt-8 rounded-card border border-warn bg-surface p-4 text-sm">
          {signInMessage}
        </p>
      )}

      <section className="mt-20 grid gap-10 md:grid-cols-2 md:items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Investing is easy. Really.</h1>
          <p className="mt-4 text-lg text-ink-muted">
            Fill your registered accounts first. Hold one all-in-one ETF. That is the whole plan. No
            Advice Needed follows it across every Canadian brokerage account you have, with one
            click.
          </p>
          {!signedIn && (
            <div className="mt-6">
              <SignInButton />
              <p className="mt-3 text-sm text-ink-muted">
                SnapTrade is the free service that links your brokerage. You sign in there, choose
                what to share, and this app starts with read access. Trading is a separate
                permission you grant when you are ready.
              </p>
            </div>
          )}
        </div>

        <Card className="shadow-sm">
          <p className="text-sm text-ink-muted">Cash ready to invest</p>
          <p className="money mt-1 text-3xl font-semibold">$3,240</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex justify-between">
              <span>TFSA · Wealthsimple</span>
              <span className="money">$2,000 → 48 VEQT</span>
            </li>
            <li className="flex justify-between">
              <span>RRSP · Questrade</span>
              <span className="money">$1,240 → 30 VEQT</span>
            </li>
          </ul>
          <p className="mt-4 rounded-full bg-accent px-4 py-2 text-center text-sm font-medium text-white">
            Buy 78 units across 2 accounts
          </p>
          <p className="mt-3 text-xs text-ink-muted">
            Next deposit: FHSA · Wealthsimple, $8,000 of room left.
          </p>
        </Card>
      </section>

      <section className="mt-20">
        <h2 className="text-sm font-medium text-accent">Two guidelines</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {guidelines.map((g, i) => (
            <Card key={g.title}>
              <p className="text-sm font-medium text-accent">{i + 1}</p>
              <h3 className="mt-1 text-lg">{g.title}</h3>
              <p className="mt-2 text-sm text-ink-muted">{g.body}</p>
            </Card>
          ))}
        </div>
        <p className="mt-4 max-w-prose text-sm text-ink-muted">
          Both are well known and need no advisor to apply. What makes them tedious is applying them
          by hand across several accounts. That is the part this app does.
        </p>
      </section>

      <section className="mt-20">
        <h2 className="text-sm font-medium text-accent">How it works</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.title}>
              <p className="text-sm font-medium text-accent">{i + 1}</p>
              <h3 className="mt-1 text-lg">{s.title}</h3>
              <p className="mt-2 text-sm text-ink-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-20 max-w-prose text-xs text-ink-muted">
        Canada only for now. The two guidelines are yours to follow; this app applies them to orders
        you confirm and does not pick funds, accounts, or amounts for you. Room figures come from
        what you enter and what your brokerage reports, so check CRA My Account before relying on
        them.
      </footer>
    </main>
  );
}
