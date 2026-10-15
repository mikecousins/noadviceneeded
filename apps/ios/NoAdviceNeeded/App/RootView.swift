import SwiftUI

/// Sign-in, then setup on the web until a country is picked, then the app.
struct RootView: View {
  @Environment(AppModel.self) private var app
  @Environment(\.scenePhase) private var scenePhase
  @State private var wasInBackground = false

  var body: some View {
    ZStack {
      Theme.Palette.canvas.ignoresSafeArea()
      switch app.phase {
      case .launching:
        Logo(size: 64)
      case .signedOut:
        SignInView()
      case .signedIn:
        if let shell = app.shell {
          if shell.countryChosen {
            MainTabs()
          } else {
            // The country decides account types, room and the fund list, so nothing else shows
            // until it is picked on the web.
            NavigationStack { FinishSetupView() }
          }
        } else {
          VStack(spacing: 20) {
            Logo(size: 64)
            if !app.syncing {
              Button("Try again") { Task { await app.reloadShell() } }
                .buttonStyle(.pill(.secondary))
            }
          }
        }
      }
    }
    .onChange(of: scenePhase) { _, phase in
      // Setup happens in Safari, so coming back to the foreground reloads what it may have changed.
      switch phase {
      case .background:
        wasInBackground = true
      case .active where wasInBackground:
        wasInBackground = false
        if app.phase == .signedIn { Task { await app.changed() } }
      default:
        break
      }
    }
    .onOpenURL { _ in
      // The sign-in callback is delivered to the web authentication session; a stray
      // `noadviceneeded://` link opened from elsewhere does nothing.
    }
  }
}

struct MainTabs: View {
  @Environment(AppModel.self) private var app

  var body: some View {
    @Bindable var app = app
    TabView(selection: $app.tab) {
      NavigationStack { HomeView() }
        .tabItem { Label("Home", systemImage: "square.grid.2x2") }
        .tag(AppModel.Tab.home)
      NavigationStack { InvestView() }
        .tabItem { Label("Invest", systemImage: "arrow.down.to.line") }
        .tag(AppModel.Tab.invest)
      NavigationStack { WithdrawView() }
        .tabItem { Label("Withdraw", systemImage: "arrow.up.to.line") }
        .tag(AppModel.Tab.withdraw)
      NavigationStack { OrdersView() }
        .tabItem { Label("Orders", systemImage: "list.bullet.rectangle") }
        .tag(AppModel.Tab.orders)
      NavigationStack { SetupView() }
        .tabItem { Label("Setup", systemImage: "slider.horizontal.3") }
        .tag(AppModel.Tab.setup)
    }
    #if DEBUG
      // Local development only: open a tab at launch with `SIMCTL_CHILD_NAN_SCREEN=invest`, for
      // screenshots without tapping through (README.md).
      .onAppear {
        switch ProcessInfo.processInfo.environment["NAN_SCREEN"] ?? "" {
        case "invest": app.tab = .invest
        case "withdraw": app.tab = .withdraw
        case "orders": app.tab = .orders
        case "setup": app.tab = .setup
        default: break
        }
      }
    #endif
  }
}
