import type { Country } from "./accounts.js";

/**
 * Whether the exchange the country's ETFs trade on is open at an instant.
 * Canada is the TSX, the US is NYSE Arca; both keep New York hours, 9:30 to
 * 16:00 Eastern, and each has its own holiday calendar. Holidays follow the
 * exchanges' published rules (nth-weekday, Easter, weekend observance) so no
 * yearly list needs maintaining. Unscheduled closures cannot be known here;
 * the brokerage refuses those orders and the refusal lands on the order row.
 */

export type Exchange = "tsx" | "nyse";

export const EXCHANGE_FOR_COUNTRY: Record<Country, Exchange> = {
  ca: "tsx",
  us: "nyse",
};

export type MarketClosedReason = "weekend" | "holiday" | "before_open" | "after_close";

export interface MarketSession {
  exchange: Exchange;
  open: boolean;
  /** Why the market is closed; null while open. */
  reason: MarketClosedReason | null;
  /** The holiday's name when `reason` is `holiday`. */
  holiday: string | null;
  /** When the current session ends; null while closed. */
  closesAt: Date | null;
  /** The next opening bell, including today's when the session has not started. */
  nextOpen: Date;
}

const ZONE = "America/New_York";
const OPEN = { hour: 9, minute: 30 };
const CLOSE = { hour: 16, minute: 0 };
const EARLY_CLOSE = { hour: 13, minute: 0 };

/** The session for `country` at `now`. */
export function marketSession(country: Country, now: Date): MarketSession {
  const exchange = EXCHANGE_FOR_COUNTRY[country];
  const local = eastern(now);
  const day = tradingDay(exchange, local.year, local.month, local.day);
  const minutes = local.hour * 60 + local.minute;
  const openAt = OPEN.hour * 60 + OPEN.minute;
  const close = day.earlyClose ? EARLY_CLOSE : CLOSE;
  const closeAt = close.hour * 60 + close.minute;

  const closed = (reason: MarketClosedReason, holiday: string | null = null): MarketSession => ({
    exchange,
    open: false,
    reason,
    holiday,
    closesAt: null,
    nextOpen: nextOpenAfter(exchange, local, reason === "before_open"),
  });

  if (day.holiday) return closed("holiday", day.holiday);
  if (local.weekday === 0 || local.weekday === 6) return closed("weekend");
  if (minutes < openAt) return closed("before_open");
  if (minutes >= closeAt) return closed("after_close");
  return {
    exchange,
    open: true,
    reason: null,
    holiday: null,
    closesAt: easternToUtc(local.year, local.month, local.day, close.hour, close.minute),
    nextOpen: easternToUtc(local.year, local.month, local.day, OPEN.hour, OPEN.minute),
  };
}

interface TradingDay {
  /** The holiday closing the exchange that day, if any. */
  holiday: string | null;
  /** NYSE closes at 13:00 on a few days; the TSX never does. */
  earlyClose: boolean;
}

/** Month is 1-based throughout this module. */
export function tradingDay(
  exchange: Exchange,
  year: number,
  month: number,
  day: number,
): TradingDay {
  const holidays = exchange === "tsx" ? tsxHolidays(year) : nyseHolidays(year);
  const key = dayKey(year, month, day);
  const holiday = holidays.get(key) ?? null;
  const earlyClose = exchange === "nyse" && !holiday && nyseEarlyCloses(year).has(key);
  return { holiday, earlyClose };
}

// --- holiday calendars ---

function tsxHolidays(year: number): Map<string, string> {
  const h = new Map<string, string>();
  const add = (d: Date, name: string) => h.set(dayKeyOf(d), name);
  // Weekend holidays move to the following Monday.
  add(weekdayOnOrAfter(utc(year, 1, 1)), "New Year's Day");
  add(nthWeekday(year, 2, 1, 3), "Family Day");
  add(goodFriday(year), "Good Friday");
  add(lastWeekdayBefore(utc(year, 5, 25), 1), "Victoria Day");
  add(weekdayOnOrAfter(utc(year, 7, 1)), "Canada Day");
  add(nthWeekday(year, 8, 1, 1), "Civic Holiday");
  add(nthWeekday(year, 9, 1, 1), "Labour Day");
  add(nthWeekday(year, 10, 1, 2), "Thanksgiving");
  // Christmas and Boxing Day take the first two weekdays from December 25.
  const christmas = weekdayOnOrAfter(utc(year, 12, 25));
  add(christmas, "Christmas Day");
  add(weekdayOnOrAfter(addDays(christmas, 1)), "Boxing Day");
  return h;
}

function nyseHolidays(year: number): Map<string, string> {
  const h = new Map<string, string>();
  const add = (d: Date | null, name: string) => {
    if (d) h.set(dayKeyOf(d), name);
  };
  // Saturday holidays move to Friday and Sunday ones to Monday, except New
  // Year's Day, which the NYSE does not observe when it falls on a Saturday.
  const newYear = utc(year, 1, 1);
  add(newYear.getUTCDay() === 6 ? null : observed(newYear), "New Year's Day");
  add(nthWeekday(year, 1, 1, 3), "Martin Luther King Jr. Day");
  add(nthWeekday(year, 2, 1, 3), "Presidents' Day");
  add(goodFriday(year), "Good Friday");
  add(lastWeekdayOfMonth(year, 5, 1), "Memorial Day");
  add(observed(utc(year, 6, 19)), "Juneteenth");
  add(observed(utc(year, 7, 4)), "Independence Day");
  add(nthWeekday(year, 9, 1, 1), "Labor Day");
  add(nthWeekday(year, 11, 4, 4), "Thanksgiving");
  add(observed(utc(year, 12, 25)), "Christmas Day");
  return h;
}

/** Days the NYSE closes at 13:00 Eastern. */
function nyseEarlyCloses(year: number): Set<string> {
  const s = new Set<string>();
  s.add(dayKeyOf(addDays(nthWeekday(year, 11, 4, 4), 1)));
  // July 3 and December 24 close early when they are a weekday and not
  // themselves the observed holiday (Friday July 3 when the 4th is a Saturday).
  for (const eve of [utc(year, 7, 3), utc(year, 12, 24)]) {
    const wd = eve.getUTCDay();
    if (wd >= 1 && wd <= 4) s.add(dayKeyOf(eve));
  }
  return s;
}

// --- date arithmetic, on UTC-midnight dates so no zone ever leaks in ---

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

/** The nth `weekday` (0 = Sunday) of the month. */
function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = utc(year, month, 1);
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return addDays(first, offset + (n - 1) * 7);
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  return lastWeekdayBefore(utc(year, month + 1, 1), weekday);
}

/** The last `weekday` strictly before `d`. */
function lastWeekdayBefore(d: Date, weekday: number): Date {
  const back = ((d.getUTCDay() - weekday + 6) % 7) + 1;
  return addDays(d, -back);
}

/** `d` itself on a weekday, otherwise the Monday after. */
function weekdayOnOrAfter(d: Date): Date {
  const wd = d.getUTCDay();
  return wd === 6 ? addDays(d, 2) : wd === 0 ? addDays(d, 1) : d;
}

/** US observance: Saturday moves to Friday, Sunday to Monday. */
function observed(d: Date): Date {
  const wd = d.getUTCDay();
  return wd === 6 ? addDays(d, -1) : wd === 0 ? addDays(d, 1) : d;
}

/** Easter Sunday by the anonymous Gregorian algorithm. */
function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month, day);
}

function goodFriday(year: number): Date {
  return addDays(easter(year), -2);
}

function dayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dayKeyOf(d: Date): string {
  return dayKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

// --- Eastern time ---

interface Eastern {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = Sunday. */
  weekday: number;
}

const parts = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
});

/** The wall clock in New York at `instant`. */
function eastern(instant: Date): Eastern {
  const p: Record<string, number> = {};
  for (const { type, value } of parts.formatToParts(instant)) {
    if (type !== "literal") p[type] = Number(value);
  }
  const year = p.year!;
  const month = p.month!;
  const day = p.day!;
  return {
    year,
    month,
    day,
    hour: p.hour!,
    minute: p.minute!,
    weekday: utc(year, month, day).getUTCDay(),
  };
}

/** The instant at which New York's wall clock reads the given time. */
function easternToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  // Guess the same wall time in UTC, see what New York reads then, and shift
  // by the difference. Neither bell falls inside a DST change, so one pass is exact.
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const read = eastern(new Date(guess));
  const readAsUtc = Date.UTC(read.year, read.month - 1, read.day, read.hour, read.minute);
  return new Date(guess - (readAsUtc - guess));
}

function nextOpenAfter(exchange: Exchange, local: Eastern, todayStillOpens: boolean): Date {
  let d = utc(local.year, local.month, local.day);
  if (!todayStillOpens) d = addDays(d, 1);
  for (let i = 0; i < 14; i += 1) {
    const wd = d.getUTCDay();
    const isTradingDay =
      wd !== 0 &&
      wd !== 6 &&
      !tradingDay(exchange, d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()).holiday;
    if (isTradingDay) {
      return easternToUtc(
        d.getUTCFullYear(),
        d.getUTCMonth() + 1,
        d.getUTCDate(),
        OPEN.hour,
        OPEN.minute,
      );
    }
    d = addDays(d, 1);
  }
  throw new Error("no trading day within two weeks");
}
