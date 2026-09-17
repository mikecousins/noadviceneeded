import {
  ACCOUNT_TYPES_BY_COUNTRY,
  ACCOUNT_TYPE_LABELS,
  COUNTRIES,
  COUNTRY_LABELS,
  HOME_CURRENCY,
  ROOM_LABELS,
  ROOM_TYPES_BY_COUNTRY,
  includedByDefault,
} from "@noadviceneeded/engine";
import { Form, redirect, useNavigation } from "react-router";
import { z } from "zod";

import { Label, Notice, PageTitle } from "~/components/ui";
import { setCountry } from "~/lib/country.server";
import { getDb } from "~/lib/db.server";
import { requireUser } from "~/lib/session.server";
import { TYPE_TEXT } from "~/lib/tiers";

import type { Route } from "./+types/app.country";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Country · No Advice Needed" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { current: user.country };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();
  const country = z.enum(COUNTRIES).safeParse(form.get("country"));
  if (!country.success) return { current: user.country };
  await setCountry(getDb(), user, country.data);
  return redirect("/app");
}

const flags = { ca: "🇨🇦", us: "🇺🇸" } as const;

export default function Country({ loaderData }: Route.ComponentProps) {
  const { current } = loaderData;
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const choosing = busy ? String(navigation.formData?.get("country")) : null;

  return (
    <>
      <PageTitle
        title={current ? "Where you invest" : "Where do you invest?"}
        lede="Decides which registered accounts the app knows, which limits it tracks, and which all-in-one ETFs it lists."
      />

      {current && (
        <Notice tone="warn" className="mt-6 max-w-2xl">
          Switching country starts account setup over: every shared account is typed again for the
          new country, joins the plan by that type's default, and the two orders are reset. Your
          fund is cleared so the ETF page offers the right list. Nothing is bought or sold.
        </Notice>
      )}

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        {COUNTRIES.map((c) => {
          const chosen = current === c;
          const types = ACCOUNT_TYPES_BY_COUNTRY[c].filter(includedByDefault);
          return (
            <Form method="post" key={c}>
              <input type="hidden" name="country" value={c} />
              <button
                type="submit"
                disabled={busy}
                aria-pressed={chosen}
                className={`w-full rounded-card border-2 bg-surface p-6 text-left transition disabled:opacity-60 ${
                  chosen ? "border-accent" : "border-line hover:border-ink-muted"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`font-display text-4xl font-extrabold tracking-tighter sm:text-5xl ${
                      chosen ? "text-accent" : ""
                    }`}
                  >
                    <span aria-hidden="true" className="mr-3">
                      {flags[c]}
                    </span>
                    {COUNTRY_LABELS[c]}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.12em] uppercase ${
                      chosen ? "bg-accent text-canvas" : "bg-raised text-ink-muted"
                    }`}
                  >
                    {choosing === c ? "saving…" : chosen ? "in use" : current ? "switch" : "choose"}
                  </span>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-2">
                  {types.map((t, i) => (
                    <span key={t} className="flex items-center gap-2">
                      {i > 0 && <span className="text-ink-dim">→</span>}
                      <span
                        className={`rounded-lg bg-raised px-2.5 py-1.5 font-mono text-[10px] font-bold tracking-[0.14em] uppercase ${TYPE_TEXT[t]}`}
                      >
                        {ACCOUNT_TYPE_LABELS[t]}
                      </span>
                    </span>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-line pt-4">
                  <Label>
                    room tracked · {ROOM_TYPES_BY_COUNTRY[c].map((r) => ROOM_LABELS[r]).join(", ")}
                  </Label>
                  <Label>cash counted in {HOME_CURRENCY[c]}</Label>
                </div>
              </button>
            </Form>
          );
        })}
      </section>

      <p className="mt-8 max-w-lg text-xs text-ink-muted">
        The two guidelines are the same in both countries: registered accounts first, one all-in-one
        ETF. Only the names of the accounts and the limits change.
      </p>
    </>
  );
}
