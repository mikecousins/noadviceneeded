import SwiftUI

/// The setup the web keeps in its header: accounts, fund, room and country. The app links to each
/// page rather than editing them, and keeps signing out.
struct SetupView: View {
  @Environment(AppModel.self) private var app

  var body: some View {
    Screen {
      PageTitle(
        title: "Setup",
        lede: "Accounts, fund, room and country are set up on the web. Changes show here when you come back."
      )
      VStack(spacing: 10) {
        row("Accounts", detail: "the two orders · types · fractions", page: .accounts)
        row("Fund", detail: app.shell?.fund.map { Format.ticker($0.ticker) } ?? "not picked yet", page: .fund)
        row("Room", detail: "limits and contributions", page: .room)
        row("Country", detail: app.country.name, page: .country)
      }
      if app.shell?.tradeScope == false { TradingBanner() }
      Card {
        Eyebrow("signed in")
        Text(app.shell?.email ?? "").font(Theme.Font.mono).foregroundStyle(Theme.Palette.ink).padding(.top, 6)
        HStack {
          Link("Manage connections ↗", destination: snapTradeDashboard).buttonStyle(.pill(.secondary))
          Button("Sign out") { Task { await app.signOut() } }.buttonStyle(.pill(.ghost))
        }
        .padding(.top, 14)
      }
      Text(
        "Balances and positions as SnapTrade last read them. Orders are day orders, limit-priced for whole units, placed only when you confirm. Nothing here is advice; check with your brokerage or \(CountryCopy.of(app.country).authority) before acting on room figures."
      )
      .font(Theme.Font.small).foregroundStyle(Theme.Palette.inkMuted)
    }
    .navigationTitle("Setup")
    .navigationBarTitleDisplayMode(.inline)
  }

  private func row(_ title: String, detail: String, page: WebPage) -> some View {
    Link(destination: app.config.web(page)) {
      HStack {
        VStack(alignment: .leading, spacing: 4) {
          Text(title).font(Theme.Font.heading).foregroundStyle(Theme.Palette.ink)
          Eyebrow(detail)
        }
        Spacer()
        Image(systemName: "arrow.up.right").foregroundStyle(Theme.Palette.inkMuted)
      }
      .padding(18)
      .background(Theme.Palette.surface, in: .rect(cornerRadius: Theme.Radius.tile))
      .overlay(RoundedRectangle(cornerRadius: Theme.Radius.tile).strokeBorder(Theme.Palette.line, lineWidth: 1))
    }
    .buttonStyle(.plain)
  }
}

/// Shown until the user has picked a country, which decides account types, room and the fund
/// list. Picking it happens on the web; the app checks again when it comes back.
struct FinishSetupView: View {
  @Environment(AppModel.self) private var app
  @State private var checking = false

  var body: some View {
    Screen(spacing: 24) {
      Logo(size: 48).padding(.top, 24)
      PageTitle(
        title: "Finish setup on the web",
        lede:
          "Pick your country, then your fund and accounts, at \(app.config.baseURL.host() ?? "the web app"). Sign in there with the same SnapTrade login. This app picks it all up when you come back."
      )
      VStack(alignment: .leading, spacing: 12) {
        WebLink(title: "Open setup", page: .country)
        Button(checking ? "Checking…" : "I've finished") {
          Task {
            checking = true
            await app.changed()
            checking = false
          }
        }
        .buttonStyle(.pill(.secondary))
        .disabled(checking)
      }
      Button("Sign out") { Task { await app.signOut() } }.buttonStyle(.pill(.ghost))
    }
  }
}
