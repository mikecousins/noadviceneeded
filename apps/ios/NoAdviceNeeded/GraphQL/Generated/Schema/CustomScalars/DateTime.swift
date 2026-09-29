// @generated
// This file was automatically generated and can be edited to
// implement advanced custom scalar functionality.
//
// Any changes to this file will not be overwritten by future
// code generation execution.

@_spi(Internal) @_spi(Execution) import ApolloAPI
import Foundation

extension API {
  /// An instant as an ISO 8601 string in UTC.
  typealias DateTime = Foundation.Date

}

/// The server sends `Date.toISOString()`: always UTC, always with milliseconds. Plain seconds are
/// accepted too so a hand-written value still parses.
nonisolated extension Foundation.Date: @retroactive CustomScalarType {
  @_spi(Internal)
  public init(_jsonValue value: JSONValue) throws {
    guard let string = value as? String, let date = ISO8601.parse(string) else {
      throw JSONDecodingError.couldNotConvert(value: value, to: Foundation.Date.self)
    }
    self = date
  }

  @_spi(Internal)
  public var _jsonValue: JSONValue {
    ISO8601.format(self)
  }
}

nonisolated enum ISO8601 {
  static func parse(_ string: String) -> Foundation.Date? {
    if let date = try? Foundation.Date(string, strategy: withFraction) { return date }
    return try? Foundation.Date(string, strategy: .iso8601)
  }

  static func format(_ date: Foundation.Date) -> String {
    date.formatted(withFraction)
  }

  private static let withFraction = Foundation.Date.ISO8601FormatStyle(includingFractionalSeconds: true)
}
