export const ACCOUNT_TYPES = ["fhsa", "tfsa", "rrsp", "non_registered", "resp", "other"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Registered types with contribution room the app tracks. */
export const ROOM_TYPES = ["tfsa", "rrsp", "fhsa"] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export function isRoomType(type: AccountType): type is RoomType {
  return (ROOM_TYPES as readonly string[]).includes(type);
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  fhsa: "FHSA",
  tfsa: "TFSA",
  rrsp: "RRSP",
  non_registered: "Non-registered",
  resp: "RESP",
  other: "Other",
};

/** Long names, spelled out once per screen per the copy guide. */
export const ACCOUNT_TYPE_LONG_NAMES: Record<AccountType, string> = {
  fhsa: "First Home Savings Account",
  tfsa: "Tax-Free Savings Account",
  rrsp: "Registered Retirement Savings Plan",
  non_registered: "Non-registered (taxable) account",
  resp: "Registered Education Savings Plan",
  other: "Other account",
};

/**
 * First guess at what an account is, from the brokerage's own type string
 * (Wealthsimple sends upper-case codes like "TFSA"; Questrade sends "TFSA",
 * "RRSP", "Margin"). The account name only breaks a tie when the brokerage
 * sent no type. Locked-in and income accounts (LIRA, LIF, RRIF) take no
 * contributions, so they are "other" and excluded by default. The user can
 * correct the guess on the Accounts page and sync never overwrites it.
 */
export function classifyAccountType(
  rawType: string | null | undefined,
  name: string | null | undefined,
): AccountType {
  const source = rawType?.trim() ? rawType : (name ?? "");
  const text = source.toLowerCase();
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

/**
 * Where new cash goes, best first. FHSA money is deductible on the way in and
 * tax-free on the way out for a first home, so it leads; TFSA is tax-free
 * growth with no strings; RRSP is deductible but taxed on withdrawal;
 * non-registered has no shelter. RESP and other accounts are never suggested
 * by default because their purpose or rules differ.
 */
export const DEFAULT_CONTRIBUTION_ORDER: readonly AccountType[] = [
  "fhsa",
  "tfsa",
  "rrsp",
  "non_registered",
  "resp",
  "other",
];

/**
 * Where withdrawals come from, first first. Non-registered money leaves with
 * no lost room; TFSA room comes back the next January 1; an FHSA withdrawal
 * outside a home purchase is taxed and the room is gone; RRSP withdrawals are
 * taxed at source and the room is gone for good.
 */
export const DEFAULT_WITHDRAWAL_ORDER: readonly AccountType[] = [
  "non_registered",
  "tfsa",
  "fhsa",
  "rrsp",
  "resp",
  "other",
];

export const CONTRIBUTION_NOTES: Record<AccountType, string> = {
  fhsa: "Deductible going in, tax-free coming out for a first home. $8,000 a year of room, $40,000 lifetime.",
  tfsa: "No deduction, but growth and withdrawals are tax-free. Room comes back the January after a withdrawal.",
  rrsp: "Deductible going in, taxed coming out. Room is 18% of last year's earned income, up to the annual cap.",
  non_registered: "No limit and no shelter: dividends and realized gains are taxed each year.",
  resp: "Grants depend on the child and the year. Not part of this plan unless you include it.",
  other:
    "Locked-in, income, or unrecognized accounts. Not part of this plan unless you include it.",
};

export const WITHDRAWAL_NOTES: Record<AccountType, string> = {
  non_registered: "Selling realizes capital gains or losses for this tax year. No room is lost.",
  tfsa: "Tax-free. The amount withdrawn is added back to your room on January 1.",
  fhsa: "Taxable unless it is a qualifying first-home withdrawal. Room does not come back.",
  rrsp: "Taxed as income with withholding at source. Room does not come back.",
  resp: "Withdrawal rules depend on the beneficiary's enrolment. Check with the brokerage.",
  other: "Locked-in and income accounts have their own withdrawal rules.",
};

export function includedByDefault(type: AccountType): boolean {
  return type === "fhsa" || type === "tfsa" || type === "rrsp" || type === "non_registered";
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
 * 1-based ranks for both orders from the default type orders, ties broken by
 * name so the result is stable across syncs.
 */
export function assignDefaultRanks(
  accounts: readonly RankableAccount[],
): Map<string, DefaultRanks> {
  const byOrder = (order: readonly AccountType[]) =>
    [...accounts].sort(
      (a, b) =>
        typeRank(a.accountType, order) - typeRank(b.accountType, order) ||
        a.name.localeCompare(b.name, "en-CA"),
    );
  const contribution = byOrder(DEFAULT_CONTRIBUTION_ORDER);
  const withdrawal = byOrder(DEFAULT_WITHDRAWAL_ORDER);
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
