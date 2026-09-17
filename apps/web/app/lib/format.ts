const plain = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 2 });

/** Home currencies format as a bare "$" in their own locale; anything else is prefixed. */
const locales: Record<string, string> = { CAD: "en-CA", USD: "en-US" };
const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, whole: boolean): Intl.NumberFormat {
  const key = `${currency}:${whole ? "whole" : "cents"}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locales[currency] ?? "en-CA", {
      style: "currency",
      currency,
      ...(whole ? { maximumFractionDigits: 0 } : {}),
    });
    formatters.set(key, f);
  }
  return f;
}

const prefixes: Record<string, string> = { USD: "US$", CAD: "C$" };

/**
 * Integer cents to a display string. The user's home currency (`home`, CAD
 * unless told otherwise) shows as a plain "$"; a foreign one is prefixed
 * ("US$", "C$", or the code), so a Canadian sees US$ and an American sees C$.
 */
export function money(
  cents: number | null | undefined,
  options: { currency?: string | null; whole?: boolean; home?: string } = {},
): string {
  if (cents === null || cents === undefined) return "—";
  const dollars = cents / 100;
  const home = options.home ?? "CAD";
  const currency = options.currency ?? home;
  if (currency !== home) {
    return `${prefixes[currency] ?? `${currency} `}${plain.format(dollars)}`;
  }
  return formatter(currency, options.whole ?? false).format(dollars);
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

/** Today in YYYY-MM-DD, Eastern time, so "as of" dates match the CRA's and IRS's calendar. */
export function todayIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
