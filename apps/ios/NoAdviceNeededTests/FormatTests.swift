import Foundation
import Testing

@testable import No_Advice_Needed

/// The same cases as `apps/web/app/lib/format.test.ts`, so both surfaces print the same figures.
struct FormatTests {
  @Test func homeCurrencyIsABareDollarSign() {
    #expect(Format.money(123_456) == "$1,234.56")
    #expect(Format.money(5) == "$0.05")
    #expect(Format.money(0) == "$0.00")
    #expect(Format.money(123_456, home: "USD") == "$1,234.56")
    #expect(Format.money(123_456, currency: "USD", home: "USD") == "$1,234.56")
  }

  @Test func wholeDollarsRoundHalfAwayFromZero() {
    #expect(Format.money(123_456, whole: true) == "$1,235")
    #expect(Format.money(123_449, whole: true) == "$1,234")
    #expect(Format.money(50, whole: true) == "$1")
  }

  @Test func foreignCurrencyIsPrefixed() {
    #expect(Format.money(123_456, currency: "USD") == "US$1,234.56")
    #expect(Format.money(123_450, currency: "USD") == "US$1,234.5")
    #expect(Format.money(123_400, currency: "USD") == "US$1,234")
    #expect(Format.money(123_456, currency: "CAD", home: "USD") == "C$1,234.56")
    #expect(Format.money(100, currency: "EUR") == "EUR 1")
  }

  @Test func negativesAndMissingValues() {
    #expect(Format.money(-500) == "-$5.00")
    #expect(Format.money(nil) == "—")
  }

  @Test func largeTotalsStayExact() {
    // Past 2^31 cents, which is why Cents is not a GraphQL Int.
    #expect(Format.money(9_007_199_254_740_991) == "$90,071,992,547,409.91")
    #expect(Format.money(3_000_000_000) == "$30,000,000.00")
  }

  @Test func moneyFormatBindsTheHomeCurrency() {
    let us = MoneyFormat(home: "USD")
    #expect(us(123_456) == "$1,234.56")
    #expect(us(123_456, currency: "CAD") == "C$1,234.56")
    #expect(MoneyFormat()(123_456, currency: "USD") == "US$1,234.56")
  }

  @Test func units() {
    #expect(Format.units(12) == "12")
    #expect(Format.units(0) == "0")
    #expect(Format.units(1.5) == "1.5")
    #expect(Format.units(0.123456) == "0.1235")
    #expect(Format.units(2.10000) == "2.1")
    #expect(Format.units(nil) == "—")
  }

  @Test func parsesTypedDollars() {
    #expect(Format.parseDollarsToCents("1,234.56") == 123_456)
    #expect(Format.parseDollarsToCents("$5000") == 500_000)
    #expect(Format.parseDollarsToCents(" 41.2 ") == 4_120)
    #expect(Format.parseDollarsToCents("0.29") == 29)
    #expect(Format.parseDollarsToCents("0") == nil)
    #expect(Format.parseDollarsToCents("0", allowZero: true) == 0)
    #expect(Format.parseDollarsToCents("1.234") == nil)
    #expect(Format.parseDollarsToCents("-5") == nil)
    #expect(Format.parseDollarsToCents("abc") == nil)
    #expect(Format.parseDollarsToCents("") == nil)
  }

  @Test func editableDollars() {
    #expect(Format.editableDollars(500_000) == "5000.00")
    #expect(Format.editableDollars(4_120) == "41.20")
    #expect(Format.editableDollars(5) == "0.05")
  }

  @Test func tickersDropTheTorontoSuffix() {
    #expect(Format.ticker("XEQT.TO") == "XEQT")
    #expect(Format.ticker("VT") == "VT")
  }

  @Test func plural() {
    #expect(Format.plural(1, "account") == "1 account")
    #expect(Format.plural(3, "account") == "3 accounts")
    #expect(Format.plural(2, "batch", "batches") == "2 batches")
  }

  @Test func calendarDays() {
    #expect(CalendarDay("2026-09-26")?.description == "2026-09-26")
    #expect(CalendarDay("2026-9-26") == nil)
    #expect(CalendarDay("2026-13-01") == nil)
    // 02:00 UTC on the 27th is still the 26th in Toronto.
    let lateEvening = ISO8601.parse("2026-09-27T02:00:00.000Z")!
    #expect(CalendarDay(lateEvening).description == "2026-09-26")
    #expect(CalendarDay(CalendarDay("2026-01-05")!.date()).description == "2026-01-05")
  }

  @Test func readsServerInstants() {
    let date = ISO8601.parse("2026-09-26T15:04:05.123Z")
    #expect(date != nil)
    #expect(ISO8601.parse("2026-09-26T15:04:05Z") != nil)
    #expect(ISO8601.format(date!) == "2026-09-26T15:04:05.123Z")
  }
}
