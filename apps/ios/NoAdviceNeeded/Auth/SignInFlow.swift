import Foundation

/// The URLs and callback of the native sign-in (docs/architecture.md, "Native API"): open
/// `/auth/snaptrade/mobile` in an `ASWebAuthenticationSession`, which ends at
/// `noadviceneeded://auth/callback?code=…` or `?error=<reason>`.
nonisolated enum SignInFlow {
  static let callbackScheme = "noadviceneeded"

  /// `/auth/snaptrade/mobile?code_challenge=…`, plus `&scope=trade` for "Enable trading".
  static func startURL(base: URL, challenge: String, trade: Bool) -> URL {
    var components = URLComponents(
      url: base.appending(path: "auth/snaptrade/mobile"), resolvingAgainstBaseURL: false)!
    components.queryItems =
      [URLQueryItem(name: "code_challenge", value: challenge)]
      + (trade ? [URLQueryItem(name: "scope", value: "trade")] : [])
    return components.url!
  }

  enum Outcome: Equatable {
    case code(String)
    case failed(Reason)
  }

  /// The `error` values the server sends, and anything it adds later.
  enum Reason: Equatable {
    case declined, failed, mismatch, email, expired, invalidRequest
    case other(String)

    init(_ raw: String) {
      switch raw {
      case "declined": self = .declined
      case "failed": self = .failed
      case "mismatch": self = .mismatch
      case "email": self = .email
      case "expired": self = .expired
      case "invalid_request": self = .invalidRequest
      default: self = .other(raw)
      }
    }

    /// The web home page's copy for the same reasons.
    var message: String {
      switch self {
      case .declined:
        "You didn't grant access at SnapTrade, so nothing was connected. You can try again any time."
      case .expired: "That sign-in took longer than 10 minutes. Start again and it will go through."
      case .mismatch: "That sign-in link didn't match the one we started. Start again."
      case .failed, .other: "SnapTrade didn't complete the sign-in. Try again in a moment."
      case .email: "SnapTrade didn't share an email address, which this app needs to keep your account."
      case .invalidRequest: "The sign-in request was malformed. Update the app and try again."
      }
    }
  }

  /// Reads `noadviceneeded://auth/callback?…`. Nil when the URL is not the sign-in callback.
  static func parseCallback(_ url: URL) -> Outcome? {
    guard url.scheme == callbackScheme, url.host() == "auth", url.path() == "/callback" else { return nil }
    let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
    if let code = items.first(where: { $0.name == "code" })?.value, !code.isEmpty {
      return .code(code)
    }
    return .failed(Reason(items.first(where: { $0.name == "error" })?.value ?? "failed"))
  }
}
