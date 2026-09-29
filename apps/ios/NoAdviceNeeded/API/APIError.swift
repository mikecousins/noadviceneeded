import Apollo
import Foundation

/// A refusal or failure from the API. Coded refusals carry the server's user-facing message, which
/// is shown as-is (docs/architecture.md, "Native API").
nonisolated struct APIError: Error, LocalizedError, Equatable {
  enum Code: String, Sendable {
    case unauthenticated = "UNAUTHENTICATED"
    case reconnectRequired = "RECONNECT_REQUIRED"
    case tradeScopeMissing = "TRADE_SCOPE_MISSING"
    case marketClosed = "MARKET_CLOSED"
    case noPrice = "NO_PRICE"
    case nothingToTrade = "NOTHING_TO_TRADE"
    case noFund = "NO_FUND"
    case noBrokerage = "NO_BROKERAGE"
    case symbolNotFound = "SYMBOL_NOT_FOUND"
    case invalidCode = "INVALID_CODE"
    case badUserInput = "BAD_USER_INPUT"
    /// The server could not be reached.
    case offline
    /// Anything else: a masked server error, a bad response.
    case unknown
  }

  let code: Code
  let message: String

  var errorDescription: String? { message }

  static let signedOut = APIError(code: .unauthenticated, message: "Sign in to continue.")

  /// The first error in a GraphQL response.
  init(graphQL error: GraphQLError) {
    let raw = error.extensions?["code"] as? String
    if let raw, let code = Code(rawValue: raw) {
      self.init(code: code, message: error.message ?? APIError.fallback)
    } else {
      // Masked: the message is not meant for people.
      self.init(code: .unknown, message: APIError.fallback)
    }
  }

  init(code: Code, message: String) {
    self.code = code
    self.message = message
  }

  /// Any error thrown while talking to the API.
  init(_ error: any Error) {
    switch error {
    case let error as APIError:
      self = error
    case let error as GraphQLError:
      self.init(graphQL: error)
    case let error as URLError where error.code != .cancelled:
      self.init(code: .offline, message: "Can't reach No Advice Needed. Check your connection and try again.")
    default:
      self.init(code: .unknown, message: APIError.fallback)
    }
  }

  static let fallback = "Something went wrong on our side. Try again in a moment."
}
