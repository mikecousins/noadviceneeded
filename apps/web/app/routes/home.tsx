import { Form, useNavigation } from "react-router";

import { Button, Card, Label, LinkButton, Logo, Notice } from "~/components/ui";
import { isConfigured } from "~/lib/env.server";
import { getOptionalUser } from "~/lib/session.server";

import type { Route } from "./+types/home";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "No Advice Needed" },
    {
      name: "description",
      content:
        "Investing is easy if you follow two guidelines: registered accounts first, one all-in-one ETF. Connect your Canadian or US brokerage accounts and do both with one click.",
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

export async function loader({ request, url }: Route.LoaderArgs) {
  const user = await getOptionalUser(request);
  const reason = url.searchParams.get("signin");
  return {
    signedIn: user !== null,
    // A deploy without its secrets still renders; it just cannot start sign-in.
    configured: isConfigured(),
    signInMessage: reason ? (signInMessages[reason] ?? signInMessages["failed"]) : null,
  };
}

const steps = [
  { title: "Connect", body: "Sign in with SnapTrade and share the accounts you choose." },
  {
    title: "Pick one fund",
    body: "One all-in-one ETF from Vanguard, iShares, BMO, or any symbol.",
  },
  {
    title: "Buy in one tap",
    body: "Cash in every account turns into units you confirm, fractions where your brokerage fills them.",
  },
  { title: "Sell in one tap", body: "Name an amount; units are sold in your withdrawal order." },
];

function SignInButton({ configured, size = "md" }: { configured: boolean; size?: "md" | "lg" }) {
  if (!configured) {
    return <p className="text-sm text-ink-muted">Sign-in is not set up on this deploy yet.</p>;
  }
  return (
    <Form method="post" action="/auth/snaptrade/start">
      <Button type="submit" size={size}>
        Sign in with SnapTrade
      </Button>
    </Form>
  );
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { signedIn, configured, signInMessage } = loaderData;
  const navigation = useNavigation();
  const opening = navigation.state !== "idle" && navigation.location?.pathname === "/app";

  return (
    <main className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
      <header className="flex flex-wrap items-center gap-4 py-6">
        <Logo />
        <span className="font-mono text-[11px] tracking-[0.24em] uppercase">no advice needed</span>
        <Label className="ml-auto hidden sm:inline">canada · united states</Label>
        {signedIn ? (
          <LinkButton to="/app" aria-busy={opening}>
            {opening ? "Opening…" : "Open the app"}
          </LinkButton>
        ) : (
          <SignInButton configured={configured} />
        )}
      </header>

      {signInMessage && (
        <Notice tone="warn" className="mt-4">
          {signInMessage}
        </Notice>
      )}

      <section className="mt-12 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2.5 rounded-full border border-accent/40 px-4 py-2">
            <span className="size-2 rounded-full bg-accent" />
            <Label className="text-accent">investing is easy</Label>
          </span>
          <h1 className="mt-6 text-hero">
            Two rules.
            <br />
            One fund.
            <br />
            <span className="text-accent">One tap.</span>
          </h1>
          <p className="mt-7 max-w-lg text-lg text-ink-muted">
            Registered accounts first, one all-in-one ETF. This app applies both across every
            account you have, at every brokerage, each time cash lands.
          </p>
          {!signedIn && (
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <SignInButton configured={configured} />
              <p className="max-w-xs text-xs text-ink-muted">
                SnapTrade is the free service that links your brokerage. This app starts read-only;
                trading is a separate permission you grant when you are ready.
              </p>
            </div>
          )}
        </div>

        <Card>
          <Label>what one tap does · an example</Label>
          <ul className="mt-5 flex flex-col gap-2">
            {[
              { type: "FHSA", cash: "$1,240.00 cash", units: "29", tone: "text-tier-1" },
              { type: "TFSA", cash: "$2,860.55 cash", units: "68", tone: "text-tier-2" },
              { type: "RRSP", cash: "$312.40 cash", units: "7", tone: "text-tier-3" },
            ].map((row) => (
              <li
                key={row.type}
                className="flex items-center gap-4 rounded-tile bg-raised px-4 py-3.5"
              >
                <span
                  className={`w-16 font-mono text-[11px] font-bold tracking-[0.14em] ${row.tone}`}
                >
                  {row.type}
                </span>
                <span className="num flex-1 font-mono text-xs text-ink-muted">{row.cash}</span>
                <span className="figure text-xl">{row.units}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-center justify-between border-t border-line pt-5">
            <Label>104 whole units, one confirmation</Label>
            <span className="num font-mono text-lg font-bold">$4,284.80</span>
          </div>
        </Card>
      </section>

      <section className="mt-20 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-baseline gap-4">
            <span className="figure text-3xl text-accent">01</span>
            <h2 className="text-xl">Registered first</h2>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {["FHSA", "TFSA", "RRSP", "Non-reg"].map((t, i) => (
              <span key={t} className="flex items-center gap-2">
                {i > 0 && <span className="text-ink-dim">→</span>}
                <span
                  className={`rounded-lg px-3 py-2 font-mono text-[11px] font-bold tracking-[0.14em] uppercase ${
                    i === 0 ? "bg-accent-soft text-accent" : "bg-raised text-ink"
                  }`}
                >
                  {t}
                </span>
              </span>
            ))}
          </div>
          <p className="mt-6 text-sm text-ink-muted">
            In the US that reads HSA, Roth IRA, Traditional IRA, taxable. Room is tracked from the
            figure you enter, so the app can name the account to fund next. Reorder it whenever you
            like.
          </p>
        </Card>

        <Card>
          <div className="flex items-baseline gap-4">
            <span className="figure text-3xl text-accent">02</span>
            <h2 className="text-xl">One all-in-one ETF</h2>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {["VGRO", "VEQT", "XGRO", "XEQT", "ZGRO"].map((t) => (
              <span
                key={t}
                className="rounded-lg border border-line px-3 py-2 font-mono text-[11px] font-bold tracking-[0.14em] text-ink-muted"
              >
                {t}
              </span>
            ))}
            <span className="rounded-lg border border-dashed border-line px-3 py-2 font-mono text-[11px] tracking-[0.14em] text-ink-muted">
              or any symbol
            </span>
          </div>
          <p className="mt-6 text-sm text-ink-muted">
            Already diversified, already rebalanced, so one is enough. You pick it and the same one
            goes in every account; this app never picks the fund, the amount, or the timing.
          </p>
        </Card>
      </section>

      <section className="mt-20">
        <Label>how it goes</Label>
        <ol className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="border-t-2 border-line pt-5">
              <span className="figure text-2xl text-accent">0{i + 1}</span>
              <h3 className="mt-3 text-lg">{s.title}</h3>
              <p className="mt-2 text-sm text-ink-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Label>read-only until you enable trading</Label>
        <span className="size-1.5 rounded-full bg-line" />
        <Label>every batch confirmed by you</Label>
        <span className="size-1.5 rounded-full bg-line" />
        <Label>nothing automated</Label>
        <span className="size-1.5 rounded-full bg-line" />
        <Label>no fund picked for you</Label>
      </section>

      <footer className="mt-16 max-w-2xl border-t border-line pt-6 text-xs text-ink-muted">
        Canada and the United States. The two guidelines are yours to follow; this app applies them
        to orders you confirm. Room figures come from what you enter and what your brokerage
        reports, so check CRA My Account or the IRS limits before relying on them. The example above
        is an illustration, not a projection.
      </footer>
    </main>
  );
}
