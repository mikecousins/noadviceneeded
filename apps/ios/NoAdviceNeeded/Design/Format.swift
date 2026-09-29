import Foundation
import SwiftUI

/// Display formatting, ported from `apps/web/app/lib/format.ts` so the app and the web print the
/// same figures. Money is integer cents; the user's home currency shows as a bare "$" and any
/// other is prefixed ("US$", "C$", or the code), so a Canadian sees US$ and an American sees C$.
nonisolated enum Format {
  private static let locales = ["CAD": "en_CA", "USD": "en_US"]
  private static let prefixes = ["USD": "US$", "CAD": "C$"]
  private static let plainLocale = Locale(identifier: "en_CA")

  static func money(_ cents: Int?, currency: String? = nil, whole: Bool = false, home: String = "CAD")
    -> String
  {
    guard let cents else { return "—" }
    let dollars = Decimal(cents) / 100
    let currency = currency ?? home
    if currency != home {
      let plain = dollars.formatted(
        .number.locale(plainLocale).precision(.fractionLength(0...2)).rounded(rule: .toNearestOrAwayFromZero)
      )
      return "\(prefixes[currency] ?? "\(currency) ")\(plain)"
    }
    let locale = Locale(identifier: locales[currency] ?? "en_CA")
    let style = Decimal.FormatStyle.Currency(code: currency, locale: locale)
      .rounded(rule: .toNearestOrAwayFromZero)
    return dollars.formatted(whole ? style.precision(.fractionLength(0)) : style.precision(.fractionLength(2)))
  }

  /// Share counts: whole numbers stay whole, fractions keep up to 4 places.
  static func units(_ n: Double?) -> String {
    guard let n else { return "—" }
    if n.rounded() == n, abs(n) < 1e15 { return String(Int(n)) }
    var text = String(format: "%.4f", n)
    while text.hasSuffix("0") { text.removeLast() }
    if text.hasSuffix(".") { text.removeLast() }
    return text
  }

  /// "Sep 26, 2026, 11:25 a.m.": the web's `dateStyle: medium, timeStyle: short` in en-CA.
  static func dateTime(_ date: Date?) -> String {
    guard let date else { return "—" }
    return date.formatted(
      Date.FormatStyle(date: .abbreviated, time: .shortened).locale(Locale(identifier: "en_CA"))
    )
  }

  static func plural(_ n: Int, _ one: String, _ many: String? = nil) -> String {
    "\(n) \(n == 1 ? one : (many ?? "\(one)s"))"
  }

  /// "1,234.56" or "$1234" typed by a user to integer cents; nil unless a positive amount with at
  /// most two decimals. `allowZero` accepts "0" for a limit that is used up.
  static func parseDollarsToCents(_ input: String, allowZero: Bool = false) -> Int? {
    let cleaned = input.filter { !"$, \t\n".contains($0) }
    guard cleaned.wholeMatch(of: /\d+(\.\d{1,2})?/) != nil, let value = Decimal(string: cleaned) else {
      return nil
    }
    var scaled = value * 100
    var rounded = Decimal()
    NSDecimalRound(&rounded, &scaled, 0, .plain)
    guard let cents = Int(exactly: NSDecimalNumber(decimal: rounded).int64Value) else { return nil }
    return cents > 0 || (allowZero && cents == 0) ? cents : nil
  }

  /// A ticker without the Toronto suffix, as every screen shows it ("XEQT", not "XEQT.TO").
  static func ticker(_ ticker: String) -> String {
    ticker.hasSuffix(".TO") ? String(ticker.dropLast(3)) : ticker
  }

  /// Cents as a plain decimal for an editable field: "5000.00".
  static func editableDollars(_ cents: Int) -> String {
    String(format: "%d.%02d", cents / 100, abs(cents % 100))
  }
}

/// `Format.money` bound to the signed-in user's home currency (the web's `useMoney`). Screens read
/// it from the environment so every figure shows "$" for home and a prefix for anything else.
nonisolated struct MoneyFormat: Sendable {
  var home: String = "CAD"

  func callAsFunction(_ cents: Int?, currency: String? = nil, whole: Bool = false) -> String {
    Format.money(cents, currency: currency, whole: whole, home: home)
  }
}

extension EnvironmentValues {
  @Entry var money = MoneyFormat()
}
