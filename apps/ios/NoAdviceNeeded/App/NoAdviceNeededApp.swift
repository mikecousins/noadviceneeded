import SwiftUI

@main
struct NoAdviceNeededApp: App {
  @State private var app = AppModel()

  var body: some Scene {
    WindowGroup {
      RootView()
        .environment(app)
        .environment(\.money, app.money)
        .preferredColorScheme(.dark)
        .tint(Theme.Palette.accent)
        .task { await app.start() }
    }
  }
}
