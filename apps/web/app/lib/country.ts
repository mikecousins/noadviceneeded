import type { Country } from "@noadviceneeded/engine";

/**
 * The country the app plans for. Rows created before the choice existed are
 * null and are read as Canada, which is what every account was classified
 * as until then; the layout still asks the user to confirm.
 */
export function effectiveCountry(user: { country: Country | null }): Country {
  return user.country ?? "ca";
}

/** Copy that differs by country, keyed once so screens stay short. */
export const COUNTRY_COPY: Record<
  Country,
  {
    /** Where the room figure comes from, as a phrase after "from". */
    roomSource: string;
    /** The room page lede. */
    roomLede: string;
    /** The label over the room input. */
    roomInput: string;
    /** The tax authority, for "check with your brokerage or …". */
    authority: string;
    /** The dashboard nudge when no room is entered. */
    roomNudge: string;
    /** Footnote under the activity list on the Room page. */
    roomWithdrawals: string;
    /** Brokerages named in the empty state. */
    brokerages: string;
    /** Brokerages named in the fractional-units hint. */
    fractional: string;
    /** Placeholder in the symbol search box. */
    searchExample: string;
  }
> = {
  ca: {
    roomSource: "CRA My Account",
    roomLede:
      "Copy the figure from CRA My Account once. Contributions your brokerage reports after that date come off it.",
    roomInput: "limit from cra (cad)",
    authority: "CRA",
    roomNudge: "Add your room from CRA My Account and this names the account to fund next.",
    roomWithdrawals: "Withdrawals are listed but do not add room back until January 1.",
    brokerages: "Wealthsimple, Questrade, and most Canadian brokerages work.",
    fractional: "Wealthsimple does for many",
    searchExample: "XEQT, ZGRO, VBAL…",
  },
  us: {
    roomSource: "the IRS limit and your own records",
    roomLede:
      "Enter this year's limit less what you have put in so far. Contributions your brokerage reports after that date come off it.",
    roomInput: "room left this year (usd)",
    authority: "the IRS",
    roomNudge: "Add this year's room for each limit and this names the account to fund next.",
    roomWithdrawals: "Withdrawals are listed but never add room back.",
    brokerages: "Fidelity, Schwab, Robinhood, and most US brokerages work.",
    fractional: "Fidelity and Robinhood do for many",
    searchExample: "AOA, AOR, VT…",
  },
};
