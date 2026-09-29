import SwiftUI

struct SignInView: View {
  @Environment(AppModel.self) private var app

  var body: some View {
    Screen(spacing: 24) {
      HStack(spacing: 12) {
        Logo()
        Text("NO ADVICE\nNEEDED")
          .font(Theme.Font.label)
          .tracking(Theme.Tracking.label)
          .foregroundStyle(Theme.Palette.ink)
      }
      .padding(.top, 24)

      VStack(alignment: .leading, spacing: 0) {
        Text("Investing,")
        Text("in one tap.").foregroundStyle(Theme.Palette.accent)
      }
      .font(Theme.Font.hero)
      .tracking(Theme.Tracking.figure)
      .foregroundStyle(Theme.Palette.ink)
      .lineLimit(1)
      .minimumScaleFactor(0.5)

      Text(
        "One confirmation buys your all-in-one ETF with the cash in each account. Tax-sheltered accounts fill first, your contribution room stays tracked, and there's nothing to research or rebalance."
      )
      .font(Theme.Font.body)
      .foregroundStyle(Theme.Palette.inkMuted)

      if let message = app.signInError {
        Notice(tone: .danger, message: message)
      }

      SignInButton(large: true)

      Text(
        "SnapTrade is the free service that links your brokerage. This app starts read-only; trading is a separate permission you grant when you are ready."
      )
      .font(Theme.Font.small)
      .foregroundStyle(Theme.Palette.inkMuted)
    }
  }
}
