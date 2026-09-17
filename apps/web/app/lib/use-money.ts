import { HOME_CURRENCY, type Country } from "@noadviceneeded/engine";
import { useCallback } from "react";
import { useRouteLoaderData } from "react-router";

import { money } from "./format.js";

/**
 * `money` bound to the signed-in user's home currency, read from the app
 * layout's loader so every screen under it shows "$" for home and a prefix
 * for anything else.
 */
export function useMoney() {
  const layout = useRouteLoaderData("routes/app-layout") as { country?: Country } | undefined;
  const home = HOME_CURRENCY[layout?.country ?? "ca"];
  return useCallback(
    (
      cents: number | null | undefined,
      options: { currency?: string | null; whole?: boolean } = {},
    ) => money(cents, { ...options, home }),
    [home],
  );
}
