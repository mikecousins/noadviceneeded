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
        Text("Two rules.")
        Text("One fund.").foregroundStyle(Theme.Palette.accent)
      }
      .font(Theme.Font.hero)
      .tracking(Theme.Tracking.figure)
      .foregroundStyle(Theme.Palette.ink)
      .lineLimit(1)
      .minimumScaleFactor(0.5)

      Text(
        "Registered accounts first, one all-in-one ETF. This app applies both across every account you have, at every brokerage, each time cash lands."
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
