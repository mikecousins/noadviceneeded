/// Copy that differs by country, keyed once so screens stay short. Mirrors the matching keys in
/// `apps/web/app/lib/country.ts`; change both together.
nonisolated struct CountryCopy: Sendable {
  /// The tax authority, for "check with your brokerage or …".
  let authority: String
  let roomNudge: String
  let brokerages: String

  static func of(_ country: API.Country) -> CountryCopy {
    switch country {
    case .ca: canada
    case .us: unitedStates
    }
  }

  static let canada = CountryCopy(
    authority: "CRA",
    roomNudge: "Add your room from CRA My Account and this names the account to fund next.",
    brokerages: "Wealthsimple, Questrade, and most Canadian brokerages work."
  )

  static let unitedStates = CountryCopy(
    authority: "the IRS",
    roomNudge: "Add this year's room for each limit and this names the account to fund next.",
    brokerages: "Fidelity, Schwab, Robinhood, and most US brokerages work."
  )
}
