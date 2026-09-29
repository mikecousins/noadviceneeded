import Foundation
import Testing

@testable import No_Advice_Needed

struct PKCETests {
  @Test func matchesTheRFC7636Vector() {
    // RFC 7636, Appendix B.
    let pkce = PKCE(verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")
    #expect(pkce.challenge == "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")
  }

  @Test func generatesAVerifierAndChallengeTheServerAccepts() {
    let pkce = PKCE.generate()
    // The server wants 43–128 characters of verifier and exactly 43 of challenge, base64url.
    #expect(pkce.verifier.count == 43)
    #expect(pkce.challenge.count == 43)
    let alphabet = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")
    #expect(pkce.verifier.unicodeScalars.allSatisfy(alphabet.contains))
    #expect(pkce.challenge.unicodeScalars.allSatisfy(alphabet.contains))
    #expect(pkce.challenge == PKCE.challenge(for: pkce.verifier))
  }

  @Test func neverRepeatsAVerifier() {
    let verifiers = Set((0..<50).map { _ in PKCE.generate().verifier })
    #expect(verifiers.count == 50)
  }

  @Test func buildsTheMobileStartURL() {
    let base = URL(string: "http://localhost:5173")!
    let challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    #expect(
      SignInFlow.startURL(base: base, challenge: challenge, trade: false).absoluteString
        == "http://localhost:5173/auth/snaptrade/mobile?code_challenge=\(challenge)")
    #expect(
      SignInFlow.startURL(base: base, challenge: challenge, trade: true).absoluteString
        == "http://localhost:5173/auth/snaptrade/mobile?code_challenge=\(challenge)&scope=trade")
  }

  @Test func readsTheCallback() {
    #expect(SignInFlow.parseCallback(URL(string: "noadviceneeded://auth/callback?code=abc.def")!) == .code("abc.def"))
    #expect(SignInFlow.parseCallback(URL(string: "noadviceneeded://auth/callback?error=declined")!) == .failed(.declined))
    #expect(
      SignInFlow.parseCallback(URL(string: "noadviceneeded://auth/callback?error=invalid_request")!)
        == .failed(.invalidRequest))
    #expect(SignInFlow.parseCallback(URL(string: "noadviceneeded://auth/callback")!) == .failed(.failed))
    #expect(SignInFlow.parseCallback(URL(string: "noadviceneeded://elsewhere?code=abc")!) == nil)
    #expect(SignInFlow.parseCallback(URL(string: "https://auth/callback?code=abc")!) == nil)
  }
}
