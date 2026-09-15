const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const cadWhole = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});
const plain = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 2 });

/** Integer cents to a display string. USD shows "US$"; other codes are prefixed. */
export function money(
  cents: number | null | undefined,
  options: { currency?: string | null; whole?: boolean } = {},
): string {
  if (cents === null || cents === undefined) return "—";
  const dollars = cents / 100;
  const currency = options.currency ?? "CAD";
  if (currency !== "CAD") {
    return `${currency === "USD" ? "US$" : `${currency} `}${plain.format(dollars)}`;
  }
  return (options.whole ? cadWhole : cad).format(dollars);
}

/** Share counts: whole numbers stay whole, fractions keep up to 4 places. */
export function units(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "1,234.56" or "1234" typed by a user to integer cents; null when not a positive amount. */
export function parseDollarsToCents(input: FormDataEntryValue | null): number | null {
  if (typeof input !== "string") return null;
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number.parseFloat(cleaned) * 100);
  return cents > 0 ? cents : null;
}

/** Today in YYYY-MM-DD, Toronto time, so "as of" dates match CRA's calendar. */
export function todayIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
