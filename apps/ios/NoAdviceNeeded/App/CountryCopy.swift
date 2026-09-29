/// Copy that differs by country, keyed once so screens stay short. Mirrors
/// `apps/web/app/lib/country.ts`; change both together.
nonisolated struct CountryCopy: Sendable {
  /// Where the room figure comes from, as a phrase after "from".
  let roomSource: String
  let roomLede: String
  let roomInput: String
  /// The tax authority, for "check with your brokerage or …".
  let authority: String
  let roomNudge: String
  let roomWithdrawals: String
  let brokerages: String
  let fractional: String
  let searchExample: String

  static func of(_ country: API.Country) -> CountryCopy {
    switch country {
    case .ca: canada
    case .us: unitedStates
    }
  }

  static let canada = CountryCopy(
    roomSource: "CRA My Account",
    roomLede:
      "Copy the figure from CRA My Account once. Contributions your brokerage reports after that date come off it.",
    roomInput: "limit from cra (cad)",
    authority: "CRA",
    roomNudge: "Add your room from CRA My Account and this names the account to fund next.",
    roomWithdrawals: "Withdrawals are listed but do not add room back until January 1.",
    brokerages: "Wealthsimple, Questrade, and most Canadian brokerages work.",
    fractional: "Wealthsimple does for many",
    searchExample: "XEQT, ZGRO, VBAL…"
  )

  static let unitedStates = CountryCopy(
    roomSource: "the IRS limit and your own records",
    roomLede:
      "Enter this year's limit less what you have put in so far. Contributions your brokerage reports after that date come off it.",
    roomInput: "room left this year (usd)",
    authority: "the IRS",
    roomNudge: "Add this year's room for each limit and this names the account to fund next.",
    roomWithdrawals: "Withdrawals are listed but never add room back.",
    brokerages: "Fidelity, Schwab, Robinhood, and most US brokerages work.",
    fractional: "Fidelity and Robinhood do for many",
    searchExample: "AOA, AOR, VT…"
  )
}
