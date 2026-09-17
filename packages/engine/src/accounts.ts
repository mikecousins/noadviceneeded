export const COUNTRIES = ["ca", "us"] as const;
export type Country = (typeof COUNTRIES)[number];

export const COUNTRY_LABELS: Record<Country, string> = {
  ca: "Canada",
  us: "United States",
};

/** The currency the plan counts cash and room in for each country. */
export const HOME_CURRENCY: Record<Country, "CAD" | "USD"> = {
  ca: "CAD",
  us: "USD",
};

/** Who publishes the room figure the user copies in. */
export const ROOM_AUTHORITY: Record<Country, string> = {
  ca: "CRA My Account",
  us: "the IRS limits",
};

/**
 * Every type either country can hold. Canadian types come first, then the
 * US ones; `other` is shared. The Postgres enum mirrors this list, so new
 * values are appended, never reordered.
 */
export const ACCOUNT_TYPES = [
  "fhsa",
  "tfsa",
  "rrsp",
  "non_registered",
  "resp",
  "other",
  "hsa",
  "roth_ira",
  "ira",
  "taxable",
  "workplace",
  "plan_529",
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** The types offered to a user of each country, in the order the Accounts page lists them. */
export const ACCOUNT_TYPES_BY_COUNTRY: Record<Country, readonly AccountType[]> = {
  ca: ["fhsa", "tfsa", "rrsp", "non_registered", "resp", "other"],
  us: ["hsa", "roth_ira", "ira", "taxable", "workplace", "plan_529", "other"],
};

/**
 * Registered types with contribution room the app tracks. A room type is
 * the key a baseline is stored under; `roomTypeFor` maps account types onto
 * it, which is how a Traditional and a Roth IRA share the one IRA limit.
 */
export const ROOM_TYPES = ["tfsa", "rrsp", "fhsa", "hsa", "ira"] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const ROOM_TYPES_BY_COUNTRY: Record<Country, readonly RoomType[]> = {
  ca: ["tfsa", "rrsp", "fhsa"],
  us: ["hsa", "ira"],
};

/** The room an account's contributions count against, or null when the type has no limit the app tracks. */
export function roomTypeFor(type: AccountType): RoomType | null {
  switch (type) {
    case "tfsa":
    case "rrsp":
    case "fhsa":
    case "hsa":
    case "ira":
      return type;
    case "roth_ira":
      return "ira";
    default:
      return null;
  }
}

export const ROOM_LABELS: Record<RoomType, string> = {
  tfsa: "TFSA",
  rrsp: "RRSP",
  fhsa: "FHSA",
  hsa: "HSA",
  ira: "IRA",
};

/** What the room card says about each limit. */
export const ROOM_NOTES: Record<RoomType, string> = {
  fhsa: "Deductible going in, tax-free coming out for a first home. $8,000 a year of room, $40,000 lifetime.",
  tfsa: "No deduction, but growth and withdrawals are tax-free. Room comes back the January after a withdrawal.",
  rrsp: "Deductible going in, taxed coming out. Room is 18% of last year's earned income, up to the annual cap.",
  hsa: "Pre-tax going in, tax-free coming out for medical costs. The IRS sets one yearly limit, higher for family coverage.",
  ira: "Traditional and Roth IRAs share one yearly limit, so this figure covers both. Income limits decide what is deductible or allowed.",
};

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  fhsa: "FHSA",
  tfsa: "TFSA",
  rrsp: "RRSP",
  non_registered: "Non-registered",
  resp: "RESP",
  other: "Other",
  hsa: "HSA",
  roth_ira: "Roth IRA",
  ira: "Traditional IRA",
  taxable: "Taxable",
  workplace: "Workplace",
  plan_529: "529",
};

/** Long names, spelled out once per screen per the copy guide. */
export const ACCOUNT_TYPE_LONG_NAMES: Record<AccountType, string> = {
  fhsa: "First Home Savings Account",
  tfsa: "Tax-Free Savings Account",
  rrsp: "Registered Retirement Savings Plan",
  non_registered: "Non-registered (taxable) account",
  resp: "Registered Education Savings Plan",
  other: "Other account",
  hsa: "Health Savings Account",
  roth_ira: "Roth IRA",
  ira: "Traditional IRA (including rollover IRAs)",
  taxable: "Taxable brokerage account",
  workplace: "Workplace plan (401(k), 403(b), 457, TSP, SEP or SIMPLE IRA)",
  plan_529: "529 education savings plan",
};

function classifyCanadian(text: string): AccountType {
  if (/\b(lira|lrsp|rrif|lif|prif|rlif|rlsp|locked)\b/.test(text)) return "other";
  if (/\bfhsa\b|celiapp|first[\s-]?home/.test(text)) return "fhsa";
  if (/\btfsa\b|\bceli\b|tax[\s-]?free/.test(text)) return "tfsa";
  if (/\bresp\b|\breee\b|education/.test(text)) return "resp";
  if (/\brrsp\b|\breer\b|\brsp\b|retirement savings|spousal/.test(text)) return "rrsp";
  if (/margin|\bcash\b|non[\s_-]?reg|personal|individual|joint|\btrading\b|investment/.test(text)) {
    return "non_registered";
  }
  return "other";
}

function classifyAmerican(text: string): AccountType {
  if (/\b(inherited|beneficiary|custodial|utma|ugma|trust|coverdell)\b/.test(text)) return "other";
  if (
    /40[13]\s?\(?[kb]\)?|\b457\b|\b(tsp|sep|simple|solo|pension|profit sharing)\b|workplace|employer/.test(
      text,
    )
  ) {
    return "workplace";
  }
  if (/\bhsa\b|health savings/.test(text)) return "hsa";
  if (/\b529\b|education|college/.test(text)) return "plan_529";
  if (/\broth\b/.test(text)) return "roth_ira";
  if (/\bira\b|rollover|traditional/.test(text)) return "ira";
  if (/margin|\bcash\b|individual|joint|\btrading\b|investment|brokerage|taxable/.test(text)) {
    return "taxable";
  }
  return "other";
}

/**
 * First guess at what an account is, from the brokerage's own type string
 * (Wealthsimple sends upper-case codes like "TFSA"; Questrade sends "TFSA",
 * "RRSP", "Margin"; US brokerages send "ROTH_IRA", "INDIVIDUAL", "401K").
 * The account name only breaks a tie when the brokerage sent no type.
 * Accounts that take no ordinary deposits (locked-in, income, inherited,
 * employer plans) are `other` or `workplace` and excluded by default. The
 * user can correct the guess on the Accounts page and sync never overwrites
 * it.
 */
export function classifyAccountType(
  rawType: string | null | undefined,
  name: string | null | undefined,
  country: Country = "ca",
): AccountType {
  const source = rawType?.trim() ? rawType : (name ?? "");
  const text = source.toLowerCase().replace(/_/g, " ");
  return country === "us" ? classifyAmerican(text) : classifyCanadian(text);
}

export interface DefaultOrders {
  /** Where new cash goes, best first. */
  contribution: readonly AccountType[];
  /** Where withdrawals come from, first first. */
  withdrawal: readonly AccountType[];
}

/**
 * Canada: FHSA money is deductible on the way in and tax-free on the way out
 * for a first home, so it leads; TFSA is tax-free growth with no strings;
 * RRSP is deductible but taxed on withdrawal; non-registered has no shelter.
 * Withdrawals: non-registered money leaves with no lost room; TFSA room
 * comes back the next January 1; an FHSA withdrawal outside a home purchase
 * is taxed and the room is gone; RRSP withdrawals are taxed at source and
 * the room is gone for good.
 *
 * United States: an HSA is deductible in and tax-free out for medical costs
 * and invests like any other account, so it leads; a Roth IRA is tax-free
 * growth; a Traditional IRA is deductible but taxed on withdrawal; taxable
 * has no shelter. Withdrawals: taxable loses no room; Roth contributions
 * come out untaxed; an HSA withdrawal outside medical costs is taxed and
 * penalised; a Traditional IRA withdrawal is taxed and penalised before 59½.
 *
 * RESP, 529, workplace and other accounts trail both lists because they are
 * never suggested by default: their purpose or funding differs.
 */
export const DEFAULT_ORDERS: Record<Country, DefaultOrders> = {
  ca: {
    contribution: ["fhsa", "tfsa", "rrsp", "non_registered", "resp", "other"],
    withdrawal: ["non_registered", "tfsa", "fhsa", "rrsp", "resp", "other"],
  },
  us: {
    contribution: ["hsa", "roth_ira", "ira", "taxable", "workplace", "plan_529", "other"],
    withdrawal: ["taxable", "roth_ira", "hsa", "ira", "workplace", "plan_529", "other"],
  },
};

export const CONTRIBUTION_NOTES: Record<AccountType, string> = {
  fhsa: "Deductible going in, tax-free coming out for a first home. $8,000 a year of room, $40,000 lifetime.",
  tfsa: "No deduction, but growth and withdrawals are tax-free. Room comes back the January after a withdrawal.",
  rrsp: "Deductible going in, taxed coming out. Room is 18% of last year's earned income, up to the annual cap.",
  non_registered: "No limit and no shelter: dividends and realized gains are taxed each year.",
  resp: "Grants depend on the child and the year. Not part of this plan unless you include it.",
  other:
    "Locked-in, income, or unrecognized accounts. Not part of this plan unless you include it.",
  hsa: "Pre-tax going in, tax-free coming out for medical costs, and it invests like any other account. Needs a high-deductible health plan.",
  roth_ira:
    "No deduction, but growth and retirement withdrawals are tax-free. Shares one yearly limit with a Traditional IRA.",
  ira: "Deductible going in when income allows, taxed coming out. Shares one yearly limit with a Roth IRA.",
  taxable: "No limit and no shelter: dividends and realized gains are taxed each year.",
  workplace:
    "Funded through payroll, not deposits, and usually limited to plan funds. Not part of this plan unless you include it.",
  plan_529:
    "Education savings with its own rules and limits. Not part of this plan unless you include it.",
};

export const WITHDRAWAL_NOTES: Record<AccountType, string> = {
  non_registered: "Selling realizes capital gains or losses for this tax year. No room is lost.",
  tfsa: "Tax-free. The amount withdrawn is added back to your room on January 1.",
  fhsa: "Taxable unless it is a qualifying first-home withdrawal. Room does not come back.",
  rrsp: "Taxed as income with withholding at source. Room does not come back.",
  resp: "Withdrawal rules depend on the beneficiary's enrolment. Check with the brokerage.",
  other: "Locked-in and income accounts have their own withdrawal rules.",
  taxable: "Selling realizes capital gains or losses for this tax year. No room is lost.",
  roth_ira:
    "Contributions come out tax-free any time; earnings are taxed and penalised before 59½. Room does not come back.",
  hsa: "Tax-free for qualified medical costs; otherwise taxed, plus a penalty before 65. Room does not come back.",
  ira: "Taxed as income, plus a 10% penalty before 59½. Room does not come back.",
  workplace: "Plan rules decide; many plans limit withdrawals while you are still employed.",
  plan_529: "Tax-free for qualified education costs; otherwise earnings are taxed and penalised.",
};

export function includedByDefault(type: AccountType): boolean {
  switch (type) {
    case "fhsa":
    case "tfsa":
    case "rrsp":
    case "non_registered":
    case "hsa":
    case "roth_ira":
    case "ira":
    case "taxable":
      return true;
    default:
      return false;
  }
}

export function typeRank(type: AccountType, order: readonly AccountType[]): number {
  const i = order.indexOf(type);
  return i === -1 ? order.length : i;
}

export interface RankableAccount {
  id: string;
  name: string;
  accountType: AccountType;
}

export interface DefaultRanks {
  contributionRank: number;
  withdrawalRank: number;
}

/**
 * 1-based ranks for both orders from the country's default type orders,
 * ties broken by name so the result is stable across syncs.
 */
export function assignDefaultRanks(
  accounts: readonly RankableAccount[],
  country: Country = "ca",
): Map<string, DefaultRanks> {
  const byOrder = (order: readonly AccountType[]) =>
    [...accounts].sort(
      (a, b) =>
        typeRank(a.accountType, order) - typeRank(b.accountType, order) ||
        a.name.localeCompare(b.name, "en-CA"),
    );
  const contribution = byOrder(DEFAULT_ORDERS[country].contribution);
  const withdrawal = byOrder(DEFAULT_ORDERS[country].withdrawal);
  const result = new Map<string, DefaultRanks>();
  contribution.forEach((a, i) => {
    result.set(a.id, { contributionRank: i + 1, withdrawalRank: 0 });
  });
  withdrawal.forEach((a, i) => {
    const r = result.get(a.id);
    if (r) r.withdrawalRank = i + 1;
  });
  return result;
}
