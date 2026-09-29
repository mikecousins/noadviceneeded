import CryptoKit
import Foundation
import Security

/// RFC 7636 PKCE for the native sign-in. The app keeps the verifier and sends only the S256
/// challenge to `/auth/snaptrade/mobile`, so an app that intercepts the `noadviceneeded://`
/// redirect cannot redeem the code without it.
nonisolated struct PKCE: Sendable, Equatable {
  let verifier: String
  let challenge: String

  /// A fresh pair: 32 random bytes as a 43-character base64url verifier.
  static func generate() -> PKCE {
    var bytes = [UInt8](repeating: 0, count: 32)
    let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
    precondition(status == errSecSuccess, "SecRandomCopyBytes failed")
    return PKCE(verifier: base64URL(Data(bytes)))
  }

  init(verifier: String) {
    self.verifier = verifier
    self.challenge = PKCE.challenge(for: verifier)
  }

  /// `BASE64URL(SHA256(ASCII(verifier)))`, unpadded: 43 characters.
  static func challenge(for verifier: String) -> String {
    base64URL(Data(SHA256.hash(data: Data(verifier.utf8))))
  }

  static func base64URL(_ data: Data) -> String {
    data.base64EncodedString()
      .replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_")
      .replacingOccurrences(of: "=", with: "")
  }
}
