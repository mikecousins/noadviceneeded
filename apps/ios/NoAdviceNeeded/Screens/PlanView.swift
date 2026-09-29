import SwiftUI

/// The setup screens the web keeps in its header: accounts, fund, room, country, and signing out.
struct PlanView: View {
  @Environment(AppModel.self) private var app

  var body: some View {
    Screen {
      PageTitle(
        title: "Your plan",
        lede: "Registered accounts first, one all-in-one ETF. Set both up here; the app applies them every time cash lands."
      )
      VStack(spacing: 10) {
        row("Accounts", detail: "the two orders · types · fractions", to: .accounts)
        row("Fund", detail: app.shell?.fund.map { Format.ticker($0.ticker) } ?? "not picked yet", to: .fund)
        row("Room", detail: "limits and contributions", to: .room)
        row("Country", detail: app.country.name, to: .country)
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
        "Balances and positions as SnapTrade last read them. Orders are market orders for the day, placed only when you confirm. Nothing here is advice; check with your brokerage or \(CountryCopy.of(app.country).authority) before acting on room figures."
      )
      .font(Theme.Font.small).foregroundStyle(Theme.Palette.inkMuted)
    }
    .navigationTitle("Plan")
    .navigationBarTitleDisplayMode(.inline)
  }

  private func row(_ title: String, detail: String, to screen: MainTabs.PlanScreen) -> some View {
    NavigationLink(value: screen) {
      HStack {
        VStack(alignment: .leading, spacing: 4) {
          Text(title).font(Theme.Font.heading).foregroundStyle(Theme.Palette.ink)
          Eyebrow(detail)
        }
        Spacer()
        Image(systemName: "chevron.right").foregroundStyle(Theme.Palette.inkMuted)
      }
      .padding(18)
      .background(Theme.Palette.surface, in: .rect(cornerRadius: Theme.Radius.tile))
      .overlay(RoundedRectangle(cornerRadius: Theme.Radius.tile).strokeBorder(Theme.Palette.line, lineWidth: 1))
    }
    .buttonStyle(.plain)
  }
}
