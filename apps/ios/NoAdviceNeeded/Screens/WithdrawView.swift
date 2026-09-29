import ApolloAPI
import SwiftUI

/// Sells in withdrawal order until an amount is covered. The cash lands in each account; moving it
/// to the bank happens at the brokerage.
struct WithdrawView: View {
  @Environment(AppModel.self) private var app
  @Environment(\.money) private var money
  @State private var data: API.WithdrawQuery.Data.Viewer?
  @State private var error: APIError?
  @State private var amountText = ""
  @State private var amountCents: Int?
  @State private var priceText = ""
  @State private var manualPriceCents: Int?
  @State private var placing = false
  @State private var placed: String?
  @FocusState private var amountFocused: Bool

  var body: some View {
    Screen {
      SyncLine()
      if let data {
        content(data)
      } else if let error {
        ErrorNotice(error: error)
      } else {
        LoadingView()
      }
    }
    .navigationTitle("Withdraw")
    .navigationBarTitleDisplayMode(.inline)
    .navigationDestination(item: $placed) { OrderBatchView(id: $0, justPlaced: true) }
    .task(id: app.revision) { await load() }
    .refreshable { await app.refresh(force: true) }
  }

  private func load() async {
    do {
      data = try await app.viewer {
        try await app.api.fetch(
          API.WithdrawQuery(
            amountCents: amountCents ?? 0,
            manualPriceCents: manualPriceCents.map { .some($0) } ?? .none,
            planned: amountCents != nil
          )
        ).viewer
      }
      if !placing { error = nil }
    } catch {
      self.error = APIError(error)
    }
  }

  private func plan(amount cents: Int) {
    amountCents = cents
    amountText = Format.editableDollars(cents)
    amountFocused = false
    error = nil
    Task { await load() }
  }

  @ViewBuilder
  private func content(_ d: API.WithdrawQuery.Data.Viewer) -> some View {
    if let fund = d.fund {
      let ticker = Format.ticker(fund.ticker)
      amountForm(d, ticker: ticker)

      if d.tradeScope == false { TradingBanner() }
      if let error {
        ErrorNotice(error: error)
      } else if !d.market.open, let closed = d.market.closedMessage {
        Notice(tone: .warn, message: closed)
      }

      if let plan = d.quote?.sellPlan {
        planView(d, plan: plan, ticker: ticker)
      } else {
        Text(
          "Units are sold from your accounts in withdrawal order until the amount is covered (whole units, or the exact dollar amount where you turned on fractions), and each type's tax note shows on its row before you confirm."
        )
        .font(Theme.Font.small).foregroundStyle(Theme.Palette.inkMuted)
      }
    } else {
      PageTitle(title: "Withdraw")
      EmptyState(
        title: "Pick a fund first",
        bodyText: "Withdrawals sell the one all-in-one ETF your accounts hold. Choose it first."
      ) {
        NavigationLink("Choose a fund") { FundView() }.buttonStyle(.pill())
      }
    }
  }

  @ViewBuilder
  private func amountForm(_ d: API.WithdrawQuery.Data.Viewer, ticker: String) -> some View {
    let sellable = d.quote?.sellableCents
    let presets = [100_000, 500_000, 1_000_000].filter { sellable == nil || $0 <= sellable! }
    VStack(alignment: .leading, spacing: 12) {
      Eyebrow("you need · \(d.homeCurrency.lowercased())")
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Text("$").font(Theme.Font.figure).foregroundStyle(Theme.Palette.inkDim)
        TextField("5,000", text: $amountText)
          .keyboardType(.decimalPad)
          .focused($amountFocused)
          .font(Theme.Font.figure)
          .tracking(Theme.Tracking.figure)
          .monospacedDigit()
          .foregroundStyle(Theme.Palette.ink)
      }
      .padding(.bottom, 6)
      .overlay(alignment: .bottom) { Rectangle().fill(Theme.Palette.line).frame(height: 2) }

      if d.quote == nil {
        VStack(alignment: .leading, spacing: 8) {
          Eyebrow("no price available · price per unit")
          TextField("41.20", text: $priceText).keyboardType(.decimalPad).fieldStyle()
        }
      }

      FlowRow {
        Button("Plan the sale") { submit(needsPrice: d.quote == nil) }
          .buttonStyle(.pill(.secondary))
        ForEach(presets, id: \.self) { cents in
          Button(money(cents, whole: true)) { plan(amount: cents) }
            .buttonStyle(PresetStyle())
        }
        if let sellable, sellable > 0 {
          Button("everything") { plan(amount: sellable) }
            .buttonStyle(PresetStyle())
        }
      }

      if let quote = d.quote {
        Text(
          "About \(money(quote.sellableCents, whole: true)) of \(ticker) sellable across your included accounts, at \(money(quote.priceCents)) \(PriceSourceCopy.short(quote.source, asOf: quote.asOf))."
        )
        .font(Theme.Font.small).foregroundStyle(Theme.Palette.inkMuted)
      }
    }
  }

  private func submit(needsPrice: Bool) {
    guard let cents = Format.parseDollarsToCents(amountText) else {
      error = APIError(code: .badUserInput, message: "Enter an amount to withdraw.")
      return
    }
    if needsPrice {
      guard let price = Format.parseDollarsToCents(priceText) else {
        error = APIError(code: .badUserInput, message: "Enter a price per unit in dollars, like 41.20.")
        return
      }
      manualPriceCents = price
    }
    plan(amount: cents)
  }

  @ViewBuilder
  private func planView(
    _ d: API.WithdrawQuery.Data.Viewer, plan: API.WithdrawQuery.Data.Viewer.Quote.SellPlan, ticker: String
  ) -> some View {
    let anyNotional = plan.legs.contains { $0.notionalCents != nil }
    Card(tone: .sell) {
      Eyebrow("selling")
      HStack(alignment: .firstTextBaseline, spacing: 10) {
        Text(anyNotional ? "≈\(Format.units(plan.totalUnits))" : Format.units(plan.totalUnits))
          .font(Theme.Font.figure).tracking(Theme.Tracking.figure).monospacedDigit()
          .foregroundStyle(Theme.Palette.sell)
        Text("units of \(ticker)").font(Theme.Font.heading).foregroundStyle(Theme.Palette.ink)
      }
      .padding(.top, 6)
      Divider().overlay(Theme.Palette.line).padding(.vertical, 14)
      Eyebrow("lands as cash")
      Text(money(plan.totalProceedsCents)).font(Theme.Font.monoLarge).monospacedDigit()
        .foregroundStyle(Theme.Palette.ink)
        .padding(.top, 4)
      Eyebrow("across \(Format.plural(plan.legs.count, "account"))").padding(.top, 6)
    }

    if plan.shortfallCents > 0 {
      Notice(
        tone: .warn,
        message:
          "Selling everything covers \(money(plan.totalProceedsCents)), which is \(money(plan.shortfallCents)) short of \(money(plan.requestedCents))."
      )
    }

    ForEach(plan.legs, id: \.account.id) { leg in
      Tile(padding: 16) {
        AccountHeader(account: leg.account.fragments.accountLine)
        Text(leg.account.withdrawalNote.uppercased())
          .font(Theme.Font.label).tracking(1)
          .foregroundStyle(Theme.Palette.sell)
          .padding(.horizontal, 12).padding(.vertical, 6)
          .background(Theme.Palette.sellSoft, in: .rect(cornerRadius: 12))
          .padding(.top, 10)
        HStack(alignment: .firstTextBaseline) {
          Eyebrow("sell")
          Text(leg.notionalCents != nil ? "≈\(Format.units(leg.units))" : Format.units(leg.units))
            .font(Theme.Font.figureSmall).monospacedDigit().foregroundStyle(Theme.Palette.ink)
          if leg.notionalCents != nil { Eyebrow("by amount") }
          Spacer()
          Text(money(leg.estimatedProceedsCents)).font(Theme.Font.mono).monospacedDigit()
            .foregroundStyle(Theme.Palette.ink)
        }
        .padding(.top, 10)
      }
    }

    if plan.legs.isEmpty {
      EmptyState(title: "Nothing to sell", bodyText: "No account in your plan holds units of \(ticker) yet.")
    }

    let skipped = plan.skipped.filter { $0.reason != .case(.excluded) && $0.reason != .case(.notNeeded) }
    if !skipped.isEmpty {
      SkippedList(title: "untouched") {
        ForEach(skipped, id: \.account.id) { s in
          HStack(spacing: 8) {
            TypeTag(s.account.accountType, label: s.account.typeLabel)
            Eyebrow(Self.skipCopy(s.reason, tradeScope: d.tradeScope))
          }
        }
      }
    }

    let canPlace = !plan.legs.isEmpty && d.tradeScope && d.market.open
    VStack(alignment: .leading, spacing: 12) {
      if d.market.open {
        Button {
          Task { await place(amountCents: plan.requestedCents, priceCents: d.quote?.priceCents) }
        } label: {
          Text(
            placing
              ? "Placing orders…"
              : plan.legs.isEmpty
                ? "Nothing to sell"
                : "Place \(Format.plural(plan.legs.count, "sell order")) · \(money(plan.totalProceedsCents))"
          )
        }
        .buttonStyle(.pill(.danger, large: true))
        .disabled(!canPlace || placing)
      } else if let closed = d.market.closedMessage {
        Eyebrow("market closed", color: Theme.Palette.warn)
        Text(closed).font(Theme.Font.small).foregroundStyle(Theme.Palette.ink)
      }
      Text(
        "Market orders, good for today\(anyNotional ? ", by dollar amount where marked" : ", whole units only"). The cash lands in each account and settles in a day or two. Moving it to your bank happens at the brokerage. Track each order under Orders."
      )
      .font(Theme.Font.small).foregroundStyle(Theme.Palette.inkMuted)
    }
    .padding(.top, 8)
  }

  static func skipCopy(_ reason: GraphQLEnum<API.SellSkipReason>, tradeScope: Bool) -> String {
    switch reason.known {
    case .excluded: "Not in the plan"
    case .notTradable: tradeScope ? "Read-only connection" : "trading not enabled"
    case .noPosition: "Holds nothing to sell"
    case .notNeeded: "Not needed for this amount"
    case nil: reason.rawValue.lowercased()
    }
  }

  private func place(amountCents: Int, priceCents: Int?) async {
    placing = true
    error = nil
    defer { placing = false }
    do {
      let batch = try await app.api.perform(
        API.PlaceWithdrawMutation(amountCents: amountCents, priceCents: priceCents.map { .some($0) } ?? .none)
      ).withdraw
      placed = batch.id
      self.amountCents = nil
      amountText = ""
      await app.changed()
    } catch {
      let error = APIError(error)
      // Keep the amount on screen only when it still makes sense to try again.
      if error.code != .marketClosed && error.code != .nothingToTrade {
        self.amountCents = nil
        amountText = ""
        await load()
      }
      self.error = error
    }
  }
}

/// The amount shortcuts: outlined chips that turn pink, the sell colour, when pressed.
private struct PresetStyle: ButtonStyle {
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(Theme.Font.label.weight(.bold))
      .tracking(1.2)
      .textCase(.uppercase)
      .foregroundStyle(configuration.isPressed ? Theme.Palette.sell : Theme.Palette.inkMuted)
      .padding(.horizontal, 16)
      .padding(.vertical, 12)
      .overlay(
        Capsule().strokeBorder(configuration.isPressed ? Theme.Palette.sell : Theme.Palette.line, lineWidth: 1)
      )
  }
}
