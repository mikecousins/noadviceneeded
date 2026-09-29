import AuthenticationServices
import SwiftUI

/// Starts the SnapTrade sign-in, or with `trade` the "Enable trading" consent.
struct SignInButton: View {
  @Environment(AppModel.self) private var app
  @Environment(\.webAuthenticationSession) private var session
  var title = "Sign in with SnapTrade"
  var trade = false
  var variant: ButtonVariant = .primary
  var large = false

  var body: some View {
    Button {
      Task { await app.signIn(trade: trade, using: session) }
    } label: {
      Text(app.signingIn ? "Waiting for SnapTrade…" : title)
    }
    .buttonStyle(.pill(variant, large: large))
    .disabled(app.signingIn)
  }
}

/// "Synced …" and what the last SnapTrade read said. Pull down on any screen to read again.
struct SyncLine: View {
  @Environment(AppModel.self) private var app

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(spacing: 8) {
        if app.syncing {
          ProgressView().controlSize(.mini).tint(Theme.Palette.inkMuted)
          Eyebrow("reading snaptrade…")
        } else if let at = app.sync?.at {
          Eyebrow("synced \(Format.dateTime(at))")
        } else {
          Eyebrow("not read yet · pull to refresh")
        }
      }
      switch app.sync?.status {
      case .reconnect:
        Notice(tone: .danger, message: "Your SnapTrade access has ended. Sign in again to reconnect.") {
          SignInButton(title: "Sign in again")
        }
      case .error:
        Notice(tone: .danger, message: "SnapTrade didn't answer just now. Figures below are from the last successful read.")
      default:
        EmptyView()
      }
    }
  }
}

/// The read-only banner: shown until the SnapTrade grant carries `trade`.
struct TradingBanner: View {
  var body: some View {
    Notice(
      tone: .warn,
      message: "This app can read your accounts but not place orders yet. Nothing is bought or sold without your confirmation on the Invest or Withdraw screen."
    ) {
      VStack(alignment: .leading, spacing: 12) {
        Eyebrow("read-only", color: Theme.Palette.warn)
        SignInButton(title: "Enable trading", trade: true)
      }
    }
  }
}

/// An API refusal, shown as the server wrote it, with the one action that answers it.
struct ErrorNotice: View {
  @Environment(AppModel.self) private var app
  let error: APIError

  var body: some View {
    Notice(tone: error.code == .marketClosed ? .warn : .danger, message: error.message) {
      switch error.code {
      case .tradeScopeMissing:
        SignInButton(title: "Enable trading", trade: true)
      case .reconnectRequired:
        SignInButton(title: "Sign in again")
      case .noFund:
        NavigationLink("Choose a fund") { FundView() }
          .buttonStyle(.pill(.secondary))
      default:
        EmptyView()
      }
    }
  }
}

/// Where accounts are added or fixed: SnapTrade's own dashboard, not this app.
let snapTradeDashboard = URL(string: "https://dashboard.snaptrade.com")!
