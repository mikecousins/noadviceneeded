// @generated
// This file was automatically generated and can be edited to
// implement advanced custom scalar functionality.
//
// Any changes to this file will not be overwritten by future
// code generation execution.

@_spi(Internal) @_spi(Execution) import ApolloAPI
import Foundation

extension API {
  /// A calendar day, YYYY-MM-DD.
  typealias Date = CalendarDay

}

/// A day with no time or zone, as the server's `Date` scalar sends it ("2026-09-26").
nonisolated struct CalendarDay: Hashable, Sendable, Comparable, CustomStringConvertible {
  let year: Int
  let month: Int
  let day: Int

  init?(_ string: String) {
    let parts = string.split(separator: "-", omittingEmptySubsequences: false)
    guard parts.count == 3, parts[0].count == 4, parts[1].count == 2, parts[2].count == 2,
      let year = Int(parts[0]), let month = Int(parts[1]), let day = Int(parts[2]),
      (1...12).contains(month), (1...31).contains(day)
    else { return nil }
    self.year = year
    self.month = month
    self.day = day
  }

  /// The day `date` falls on in `timeZone`. Room dates use Eastern time, like the web, so "as of"
  /// matches the CRA's and IRS's calendar.
  init(_ date: Foundation.Date, in timeZone: TimeZone = .eastern) {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    let parts = calendar.dateComponents([.year, .month, .day], from: date)
    year = parts.year!
    month = parts.month!
    day = parts.day!
  }

  static func today(now: Foundation.Date = .now) -> CalendarDay { CalendarDay(now) }

  var description: String {
    String(format: "%04d-%02d-%02d", year, month, day)
  }

  /// Noon on this day in `timeZone`, for a `DatePicker`: noon never slips a day across zones.
  func date(in timeZone: TimeZone = .eastern) -> Foundation.Date {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    return calendar.date(from: DateComponents(year: year, month: month, day: day, hour: 12))!
  }

  static func < (lhs: CalendarDay, rhs: CalendarDay) -> Bool {
    (lhs.year, lhs.month, lhs.day) < (rhs.year, rhs.month, rhs.day)
  }
}

nonisolated extension CalendarDay: CustomScalarType {
  init(_jsonValue value: JSONValue) throws {
    guard let string = value as? String, let day = CalendarDay(string) else {
      throw JSONDecodingError.couldNotConvert(value: value, to: CalendarDay.self)
    }
    self = day
  }

  var _jsonValue: JSONValue { description }
}

nonisolated extension TimeZone {
  static let eastern = TimeZone(identifier: "America/Toronto")!
}
