import ApolloAPI
import SwiftUI

/// Guideline one as two lists, plus the choices on every shared account.
struct AccountsView: View {
  @Environment(AppModel.self) private var app
  @Environment(\.money) private var money
  @State private var data: API.AccountsQuery.Data.Viewer?
  @State private var error: APIError?
  @State private var drafts: [String: Choice] = [:]
  @State private var saved: Int?
  @State private var busy = false

  typealias Account = API.AccountsQuery.Data.Viewer.Account

  struct Choice: Equatable {
    var accountType: API.AccountType
    var included: Bool
    var fractional: Bool
  }

  var body: some View {
    Screen {
      SyncLine()
      PageTitle(
        title: "Your order",
        lede: "Where new cash goes, and where withdrawals come from. Nudge either one; the app never argues with an override."
      )
      if let error { ErrorNotice(error: error) }
      if let saved {
        Notice(
          tone: .success,
          message: "Saved \(Format.plural(saved, "account")). New accounts join the end of both orders.")
      }
      if let data {
        content(data)
      } else if error == nil {
        LoadingView()
      }
    }
    .navigationTitle("Accounts")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Link(destination: snapTradeDashboard) { Label("Link another brokerage", systemImage: "plus") }
      }
    }
    .task(id: app.revision) { await load() }
    .refreshable { await app.refresh(force: true) }
  }

  private func load() async {
    do {
      let viewer = try await app.viewer { try await app.api.fetch(API.AccountsQuery()).viewer }
      data = viewer
      drafts = Dictionary(uniqueKeysWithValues: viewer.accounts.map { ($0.id, Self.choice(of: $0)) })
      error = nil
    } catch {
      self.error = APIError(error)
    }
  }

  private static func choice(of a: Account) -> Choice {
    Choice(accountType: a.accountType.known ?? .other, included: a.included, fractional: a.fractional)
  }

  @ViewBuilder
  private func content(_ d: API.AccountsQuery.Data.Viewer) -> some View {
    if d.accounts.isEmpty {
      EmptyState(
        title: "Nothing shared yet",
        bodyText: "Connect a brokerage in the SnapTrade dashboard, then pull to refresh."
      ) {
        Link("Open SnapTrade ↗", destination: snapTradeDashboard).buttonStyle(.pill())
      }
    } else {
      let included = d.accounts.filter(\.included)
      OrderList(
        heading: "cash goes in", tone: .accent, order: .contribution,
        accounts: included.sorted { $0.contributionRank < $1.contributionRank },
        note: \.contributionNote, busy: busy, move: move)
      OrderList(
        heading: "cash comes out", tone: .sell, order: .withdrawal,
        accounts: included.sorted { $0.withdrawalRank < $1.withdrawalRank },
        note: \.withdrawalNote, busy: busy, move: move)
      editor(d)
    }
  }

  private func move(_ account: Account, _ order: API.RankOrder, _ direction: API.Direction) {
    Task {
      busy = true
      defer { busy = false }
      do {
        _ = try await app.api.perform(
          API.MoveAccountMutation(accountId: account.id, order: .case(order), direction: .case(direction)))
        saved = nil
        await load()
      } catch {
        self.error = APIError(error)
      }
    }
  }

  private func editor(_ d: API.AccountsQuery.Data.Viewer) -> some View {
    let country = d.country.known ?? .ca
    let brokerages = Set(d.accounts.map(\.brokerageName)).count
    let dirty = d.accounts.contains { drafts[$0.id] != Self.choice(of: $0) }
    return Card {
      Text("Everything shared").font(Theme.Font.heading).foregroundStyle(Theme.Palette.ink)
      Eyebrow(
        "\(Format.plural(d.accounts.count, "account")) · \(d.accounts.filter(\.included).count) in the plan · \(Format.plural(brokerages, "brokerage"))"
      )
      .padding(.top, 4)
      Eyebrow("include what belongs in the plan · fix any wrong type · turn on fractions where your brokerage fills them")
        .padding(.top, 14)

      VStack(spacing: 8) {
        ForEach(d.accounts, id: \.id) { a in row(a, country: country) }
      }
      .padding(.top, 14)

      Text(
        "Fractions: turn it on when the brokerage lets you buy less than one unit of your ETF (\(CountryCopy.of(country).fractional)). Orders in that account are then sent as a dollar amount, so every cent is spent and a withdrawal lands to the cent; the brokerage works out the units. If the brokerage refuses, the order fails and shows under Orders."
      )
      .font(Theme.Font.small).foregroundStyle(Theme.Palette.inkMuted)
      .padding(.top, 16)

      Button(busy ? "Saving…" : "Save") { Task { await save(d.accounts) } }
        .buttonStyle(.pill())
        .disabled(busy || !dirty)
        .frame(maxWidth: .infinity, alignment: .trailing)
        .padding(.top, 16)
    }
  }

  private func row(_ a: Account, country: API.Country) -> some View {
    let removed = a.connectionStatus == .case(.removed)
    let choice = Binding(
      get: { drafts[a.id] ?? Self.choice(of: a) },
      set: { drafts[a.id] = $0; saved = nil }
    )
    // The country's own types, plus whatever the account already is, so the picker never silently
    // shows something else after a country switch.
    let offered = country.accountTypes.contains(choice.wrappedValue.accountType)
      ? country.accountTypes : country.accountTypes + [choice.wrappedValue.accountType]
    return Tile(padding: 14) {
      HStack(alignment: .top, spacing: 12) {
        Toggle("Include \(a.name)", isOn: choice.included)
          .labelsHidden()
          .disabled(removed)
        VStack(alignment: .leading, spacing: 3) {
          Text(a.name).font(Theme.Font.small.weight(.medium)).foregroundStyle(Theme.Palette.ink)
          Eyebrow("\(a.brokerageName) · \(a.numberMasked)\(a.rawType.map { " · \"\($0)\"" } ?? "")")
          switch a.connectionStatus.known {
          case .disabled:
            Text("Needs attention at SnapTrade: the brokerage login stopped working.")
              .font(Theme.Font.small).foregroundStyle(Theme.Palette.danger)
          case .removed:
            Text("No longer shared with this app.").font(Theme.Font.small).foregroundStyle(Theme.Palette.danger)
          default:
            EmptyView()
          }
        }
        Spacer(minLength: 0)
      }
      HStack(spacing: 8) {
        Eyebrow("type")
        Picker("Type", selection: choice.accountType) {
          ForEach(offered, id: \.self) { Text($0.label).tag($0) }
        }
        .pickerStyle(.menu)
        .tint(choice.wrappedValue.accountType.tint)
        Spacer(minLength: 0)
      }
      .padding(.top, 8)
      Toggle(isOn: choice.fractional) { Eyebrow("fractions") }
        .disabled(removed)
        .padding(.top, 4)
      HStack {
        Figure(label: "value", value: money(a.valueCents, currency: a.currency, whole: true))
        Spacer()
        Figure(label: "cash", value: money(a.cashCents), muted: true)
        Spacer()
        Badge(text: a.connectionCanTrade ? "Orders allowed" : "Read-only", tone: a.connectionCanTrade ? .success : .warn)
      }
      .padding(.top, 8)
    }
  }

  private func save(_ accounts: [Account]) async {
    busy = true
    defer { busy = false }
    let choices = accounts.map { a in
      let c = drafts[a.id] ?? Self.choice(of: a)
      return API.AccountChoiceInput(
        accountId: a.id, accountType: .case(c.accountType), fractional: c.fractional, included: c.included)
    }
    do {
      let changed = try await app.api.perform(API.UpdateAccountsMutation(accounts: choices)).updateAccounts.changed
      saved = changed
      await app.changed()
    } catch {
      self.error = APIError(error)
    }
  }
}

/// One of the two orders, with up/down controls. The note explains the type, not the account, so
/// it shows once per type: on the first account of that type in the list.
private struct OrderList: View {
  let heading: String
  let tone: CardTone
  let order: API.RankOrder
  let accounts: [AccountsView.Account]
  let note: KeyPath<AccountsView.Account, String>
  let busy: Bool
  let move: (AccountsView.Account, API.RankOrder, API.Direction) -> Void

  var body: some View {
    let color = tone == .accent ? Theme.Palette.accent : Theme.Palette.sell
    Card(tone: .plain) {
      HStack(spacing: 8) {
        Image(systemName: tone == .accent ? "arrow.down" : "arrow.up")
          .font(.system(size: 16, weight: .bold))
          .foregroundStyle(color)
        Eyebrow(heading, color: color)
        Eyebrow("· \(Format.plural(accounts.count, "account"))")
      }
      if accounts.isEmpty {
        Text("No accounts in the plan yet.").font(Theme.Font.small).foregroundStyle(Theme.Palette.inkMuted)
          .padding(.top, 12)
      } else {
        VStack(spacing: 6) {
          ForEach(Array(accounts.enumerated()), id: \.element.id) { i, a in
            let explain = !accounts[..<i].contains { $0.accountType == a.accountType }
            Tile(padding: 12) {
              HStack(spacing: 12) {
                Text("\(i + 1)").font(Theme.Font.figureSmall).foregroundStyle(color).frame(width: 24)
                VStack(alignment: .leading, spacing: 4) {
                  HStack(spacing: 8) {
                    TypeTag(a.accountType, label: a.typeLabel)
                    Text(a.name).font(Theme.Font.small.weight(.medium)).foregroundStyle(Theme.Palette.ink)
                      .lineLimit(1)
                  }
                  Eyebrow(a.brokerageName)
                  if explain {
                    Text(a[keyPath: note]).font(Theme.Font.small).foregroundStyle(Theme.Palette.inkMuted)
                  }
                }
                Spacer(minLength: 0)
                VStack(spacing: 4) {
                  moveButton(a, .up, disabled: i == 0)
                  moveButton(a, .down, disabled: i == accounts.count - 1)
                }
              }
            }
          }
        }
        .padding(.top, 12)
      }
    }
  }

  private func moveButton(_ a: AccountsView.Account, _ direction: API.Direction, disabled: Bool) -> some View {
    Button {
      move(a, order, direction)
    } label: {
      Image(systemName: direction == .up ? "chevron.up" : "chevron.down")
        .font(.system(size: 13, weight: .bold))
        .frame(width: 32, height: 28)
        .foregroundStyle(disabled || busy ? Theme.Palette.inkDim : Theme.Palette.ink)
        .background(Theme.Palette.line, in: .rect(cornerRadius: 8))
    }
    .buttonStyle(.plain)
    .disabled(disabled || busy)
    .accessibilityLabel("Move \(a.name) \(direction == .up ? "up" : "down")")
  }
}
