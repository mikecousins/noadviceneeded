import ApolloAPI
import AuthenticationServices
import Foundation
import Observation
import SwiftUI

/// Who is signed in, what SnapTrade last said, and which tab is showing. Screens own their own
/// data and reload whenever `revision` changes (after a sync or a write that affects them all).
@Observable
final class AppModel {
  enum Phase: Equatable {
    case launching
    case signedOut
    case signedIn
  }

  enum Tab: Hashable {
    case home, invest, withdraw, orders, plan
  }

  private(set) var phase: Phase = .launching
  /// The signed-in user's header facts: country, currency, trade scope, fund.
  private(set) var shell: API.ShellQuery.Data.Viewer?
  private(set) var sync: (status: API.SyncStatus, at: Date?)?
  private(set) var syncing = false
  /// Bumped after anything that changes what every screen shows.
  private(set) var revision = 0
  var signInError: String?
  private(set) var signingIn = false
  var tab: Tab = .home

  let api: APIClient
  let config: AppConfig

  var money: MoneyFormat { MoneyFormat(home: shell?.homeCurrency ?? "CAD") }
  var country: API.Country { shell?.country.known ?? .ca }

  init(config: AppConfig = .current, tokens: any TokenStore = KeychainTokenStore()) {
    self.config = config
    api = APIClient(config: config, tokens: tokens)
    api.onSignedOut = { [weak self] in self?.didSignOut() }
  }

  // MARK: Launch

  /// Reads the stored session and, if there is one, signs in and asks SnapTrade for fresh figures.
  func start() async {
    guard phase == .launching else { return }
    #if DEBUG
      // Local development only: a session minted against a seeded `pnpm dev` database, passed
      // with `SIMCTL_CHILD_NAN_SESSION_TOKEN=…` (README.md). Release builds never read it.
      if let token = ProcessInfo.processInfo.environment["NAN_SESSION_TOKEN"], !token.isEmpty {
        try? api.tokens.save(StoredSession(token: token, expiresAt: .now.addingTimeInterval(86_400)))
      }
    #endif
    guard let stored = api.tokens.load(), !stored.isExpired() else {
      api.tokens.clear()
      phase = .signedOut
      return
    }
    phase = .signedIn
    await enter()
  }

  /// Loads the header, then syncs. The sync bumps `revision`, so screens that rendered from the
  /// database meanwhile reload with SnapTrade's figures.
  private func enter() async {
    await reloadShell()
    guard phase == .signedIn else { return }
    await refresh(force: false)
  }

  func reloadShell() async {
    do {
      guard let viewer = try await api.fetch(API.ShellQuery()).viewer else {
        api.signedOut()
        return
      }
      shell = viewer
    } catch {
      // The header keeps its last value; the screen that needs it shows the error.
    }
  }

  // MARK: Sync

  /// `sync(force:)`: on launch without force, on pull to refresh with it.
  func refresh(force: Bool) async {
    guard phase == .signedIn, !syncing else { return }
    syncing = true
    defer { syncing = false }
    do {
      let payload = try await api.perform(API.SyncMutation(force: force)).sync
      sync = (payload.status.known ?? .error, payload.syncedAt)
    } catch let error as APIError where error.code == .unauthenticated {
      return
    } catch {
      sync = (.error, sync?.at)
    }
    await reloadShell()
    revision += 1
  }

  /// After a write whose effect shows on other screens (country, accounts, fund, room, orders).
  func changed() async {
    await reloadShell()
    revision += 1
  }

  // MARK: Sign in and out

  /// The native sign-in: PKCE, `/auth/snaptrade/mobile` in a web authentication session, then
  /// `exchangeSignInCode` within two minutes. `trade` asks SnapTrade for the trading scope too.
  func signIn(trade: Bool, using session: WebAuthenticationSession) async {
    guard !signingIn else { return }
    signingIn = true
    signInError = nil
    defer { signingIn = false }

    let pkce = PKCE.generate()
    let url = SignInFlow.startURL(base: config.baseURL, challenge: pkce.challenge, trade: trade)
    let callback: URL
    do {
      callback = try await session.authenticate(
        using: url,
        callbackURLScheme: SignInFlow.callbackScheme,
        preferredBrowserSession: .shared
      )
    } catch let error as ASWebAuthenticationSessionError where error.code == .canceledLogin {
      return
    } catch {
      signInError = SignInFlow.Reason.failed.message
      return
    }

    switch SignInFlow.parseCallback(callback) {
    case .code(let code):
      do {
        let issued = try await api.perform(
          API.ExchangeSignInCodeMutation(code: code, codeVerifier: pkce.verifier)
        ).exchangeSignInCode
        try api.tokens.save(StoredSession(token: issued.token, expiresAt: issued.expiresAt))
      } catch {
        signInError = APIError(error).message
        return
      }
      if phase == .signedIn {
        // Trading consent on an existing session: the new token carries the scope.
        await refresh(force: true)
      } else {
        phase = .signedIn
        await enter()
      }
    case .failed(let reason):
      signInError = reason.message
    case nil:
      signInError = SignInFlow.Reason.failed.message
    }
  }

  func signOut() async {
    // Revoke the session on the server; the SnapTrade grant stays so signing back in is one tap.
    _ = try? await api.perform(API.SignOutMutation())
    api.signedOut()
  }

  private func didSignOut() {
    phase = .signedOut
    shell = nil
    sync = nil
    tab = .home
  }
}
