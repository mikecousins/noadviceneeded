import SwiftUI

/// Sign-in, then the country question, then the app.
struct RootView: View {
  @Environment(AppModel.self) private var app

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
            // The country decides account types, room and the fund list, so it is asked first
            // and nothing else shows until it is answered.
            NavigationStack { CountryView(gate: true) }
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
    .onOpenURL { _ in
      // The sign-in callback is delivered to the web authentication session; a stray
      // `noadviceneeded://` link opened from elsewhere does nothing.
    }
  }
}

struct MainTabs: View {
  @Environment(AppModel.self) private var app
  @State private var planPath: [PlanScreen] = []

  enum PlanScreen: String, Hashable {
    case accounts, fund, room, country
  }

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
      NavigationStack(path: $planPath) {
        PlanView()
          .navigationDestination(for: PlanScreen.self) { screen in
            switch screen {
            case .accounts: AccountsView()
            case .fund: FundView()
            case .room: RoomView()
            case .country: CountryView()
            }
          }
      }
        .tabItem { Label("Plan", systemImage: "slider.horizontal.3") }
        .tag(AppModel.Tab.plan)
    }
    #if DEBUG
      // Local development only: open a screen at launch with `SIMCTL_CHILD_NAN_SCREEN=room`, for
      // screenshots without tapping through (README.md).
      .onAppear {
        switch ProcessInfo.processInfo.environment["NAN_SCREEN"] ?? "" {
        case "invest": app.tab = .invest
        case "withdraw": app.tab = .withdraw
        case "orders": app.tab = .orders
        case "plan": app.tab = .plan
        case let name:
          if let screen = PlanScreen(rawValue: name) {
            app.tab = .plan
            planPath = [screen]
          }
        }
      }
    #endif
  }
}
