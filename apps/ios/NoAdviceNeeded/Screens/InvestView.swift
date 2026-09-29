import ApolloAPI
import SwiftUI

/// What each included account's own cash buys, and the one button that places it. Cash never
/// moves between accounts.
struct InvestView: View {
  @Environment(AppModel.self) private var app
  @Environment(\.money) private var money
  @State private var data: API.InvestQuery.Data.Viewer?
  @State private var error: APIError?
  @State private var priceText = ""
  @State private var manualPriceCents: Int?
  @State private var placing = false
  @State private var placed: String?

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
    .navigationTitle("Invest")
    .navigationBarTitleDisplayMode(.inline)
    .navigationDestination(item: $placed) { OrderBatchView(id: $0, justPlaced: true) }
    .task(id: app.revision) { await load() }
    .refreshable { await app.refresh(force: true) }
  }

  private func load() async {
    do {
      data = try await app.viewer {
        try await app.api.fetch(API.InvestQuery(manualPriceCents: manualPriceCents.map { .some($0) } ?? .none))
          .viewer
      }
      if !placing { error = nil }
    } catch {
      self.error = APIError(error)
    }
  }

  @ViewBuilder
  private func content(_ d: API.InvestQuery.Data.Viewer) -> some View {
    if let fund = d.fund {
      let quote = d.quote
      let plan = quote?.buyPlan
      let anyNotional = plan?.legs.contains { $0.notionalCents != nil } ?? false
      // The 1% buffer only shapes whole-unit legs; dollar-amount legs spend every cent.
      let anyWholeUnit = plan?.legs.contains { $0.notionalCents == nil } ?? false
      let ticker = Format.ticker(fund.ticker)

      VStack(alignment: .leading, spacing: 10) {
        Eyebrow(anyNotional ? "buying, about" : "buying, in whole units")
        HStack(alignment: .firstTextBaseline, spacing: 14) {
          Text(Format.units(plan?.totalUnits ?? 0))
            .font(Theme.Font.hero).tracking(Theme.Tracking.figure).monospacedDigit()
            .foregroundStyle(Theme.Palette.accent)
            .lineLimit(1).minimumScaleFactor(0.5)
          Text(ticker).font(Theme.Font.title).tracking(-1.4).foregroundStyle(Theme.Palette.ink)
        }
        Text(
          "Each account buys what its own cash allows\(anyWholeUnit ? ", 1% held back so a fill above the quote still clears" : "")."
            + (anyNotional
              ? " Accounts marked for fractions spend every cent as a dollar amount; the brokerage works out the units."
              : "")
        )
        .font(Theme.Font.small).foregroundStyle(Theme.Palette.inkMuted)
      }

      if d.tradeScope == false { TradingBanner() }
      if let error {
        ErrorNotice(error: error)
      } else if !d.market.open, let closed = d.market.closedMessage {
        Notice(tone: .warn, message: closed)
      }

      priceCard(quote, anyWholeUnit: anyWholeUnit)

      if let plan {
        legs(plan, ticker: ticker, tradeScope: d.tradeScope)
        confirm(d, plan: plan, anyNotional: anyNotional)
      }
    } else {
      PageTitle(title: "Invest")
      EmptyState(
        title: "Pick a fund first",
        bodyText: "One all-in-one ETF, held in every account. Choose it and this screen shows what each account can buy."
      ) {
        NavigationLink("Choose a fund") { FundView() }.buttonStyle(.pill())
      }
    }
  }

  private func priceCard(_ quote: API.InvestQuery.Data.Viewer.Quote?, anyWholeUnit: Bool) -> some View {
    Card {
      if let quote {
        HStack(alignment: .top) {
          VStack(alignment: .leading, spacing: 6) {
            Eyebrow("price used, per unit")
            Text(money(quote.priceCents)).font(Theme.Font.monoLarge).monospacedDigit()
              .foregroundStyle(Theme.Palette.ink)
            Eyebrow(PriceSourceCopy.line(quote.source, asOf: quote.asOf))
          }
          Spacer()
          if anyWholeUnit { Badge(text: "1% held back", tone: .success) }
        }
        if quote.source != .case(.quote) {
          priceField(label: "use a different price", button: "Recalculate").padding(.top, 16)
        }
      } else {
        priceField(label: "no price available · today's price per unit", button: "Use this price")
      }
    }
  }

  private func priceField(label: String, button: String) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      Eyebrow(label)
      HStack(spacing: 10) {
        TextField("41.20", text: $priceText)
          .keyboardType(.decimalPad)
          .fieldStyle()
        Button(button) {
          guard let cents = Format.parseDollarsToCents(priceText) else {
            error = APIError(code: .badUserInput, message: "Enter a price per unit in dollars, like 41.20.")
            return
          }
          manualPriceCents = cents
          error = nil
          Task { await load() }
        }
        .buttonStyle(.pill(.secondary))
      }
    }
  }

  @ViewBuilder
  private func legs(_ plan: API.InvestQuery.Data.Viewer.Quote.BuyPlan, ticker: String, tradeScope: Bool) -> some View {
    ForEach(plan.legs, id: \.account.id) { leg in
      Tile(padding: 16) {
        AccountHeader(account: leg.account.fragments.accountLine)
        HStack {
          Figure(label: "cash", value: money(leg.account.cashCents), muted: true)
          Spacer()
          Figure(label: "units", value: leg.notionalCents != nil ? "≈\(Format.units(leg.units))" : Format.units(leg.units))
          Spacer()
          Figure(label: "est. cost", value: money(leg.estimatedCostCents), trailing: true)
        }
        .padding(.top, 12)
      }
    }

    if plan.legs.isEmpty {
      EmptyState(
        title: "Nothing to buy yet",
        bodyText:
          "No account in the plan holds enough cash for a unit of \(ticker). Deposit at your brokerage, pull to refresh, and this fills in. If your brokerage fills fractions, turn on fractions for the account under Plan › Accounts."
      )
    }

    if plan.legs.count > 1 {
      HStack {
        Figure(label: "total cash", value: money(plan.totalCashCents), muted: true)
        Spacer()
        Figure(label: "units", value: Format.units(plan.totalUnits))
        Spacer()
        Figure(label: "total", value: money(plan.totalCostCents), trailing: true)
      }
      .padding(.horizontal, 16)
    }

    let skipped = plan.skipped.filter { $0.reason != .case(.excluded) }
    if !skipped.isEmpty {
      SkippedList(title: "skipped") {
        ForEach(skipped, id: \.account.id) { s in
          HStack(spacing: 8) {
            TypeTag(s.account.accountType, label: s.account.typeLabel)
            Eyebrow(Self.skipCopy(s.reason, tradeScope: tradeScope) + belowOneUnit(s))
          }
        }
      }
    }
  }

  private func belowOneUnit(_ s: API.InvestQuery.Data.Viewer.Quote.BuyPlan.Skipped) -> String {
    guard s.reason == .case(.belowOneUnit), let cash = s.account.cashCents else { return "" }
    return " (\(money(cash)))"
  }

  static func skipCopy(_ reason: GraphQLEnum<API.BuySkipReason>, tradeScope: Bool) -> String {
    switch reason.known {
    case .excluded: "Not in the plan"
    case .notTradable: tradeScope ? "Read-only connection" : "trading not enabled"
    case .noCash: "No cash"
    case .belowOneUnit: "Less than one unit of cash"
    case nil: reason.rawValue.lowercased()
    }
  }

  @ViewBuilder
  private func confirm(
    _ d: API.InvestQuery.Data.Viewer, plan: API.InvestQuery.Data.Viewer.Quote.BuyPlan, anyNotional: Bool
  ) -> some View {
    let canPlace = !plan.legs.isEmpty && d.tradeScope && d.quote != nil && d.market.open
    VStack(alignment: .leading, spacing: 12) {
      if d.market.open {
        Button {
          Task { await place(priceCents: d.quote?.priceCents) }
        } label: {
          Text(
            placing
              ? "Placing orders…"
              : plan.legs.isEmpty
                ? "Nothing to buy"
                : "Place \(Format.plural(plan.legs.count, "market order")) · \(money(plan.totalCostCents))"
          )
        }
        .buttonStyle(.pill(large: true))
        .disabled(!canPlace || placing)
      } else if let closed = d.market.closedMessage {
        Eyebrow("market closed", color: Theme.Palette.warn)
        Text(closed).font(Theme.Font.small).foregroundStyle(Theme.Palette.ink)
      }
      Text(
        "Market orders, good for today\(anyNotional ? ", by dollar amount where marked" : ", whole units only"). Fills can differ from the estimate; each one shows up under Orders."
      )
      .font(Theme.Font.small).foregroundStyle(Theme.Palette.inkMuted)
    }
    .padding(.top, 8)
  }

  private func place(priceCents: Int?) async {
    placing = true
    error = nil
    defer { placing = false }
    do {
      let batch = try await app.api.perform(
        API.PlaceInvestMutation(priceCents: priceCents.map { .some($0) } ?? .none)
      ).invest
      placed = batch.id
      await app.changed()
    } catch {
      self.error = APIError(error)
    }
  }
}

/// "Last price on a position you hold · Sep 26, 2026, 11:25 a.m."
enum PriceSourceCopy {
  static func line(_ source: GraphQLEnum<API.PriceSource>, asOf: Date?) -> String {
    let when = asOf.map { " · \(Format.dateTime($0))" } ?? ""
    return switch source.known {
    case .quote: "brokerage quote\(when)"
    case .holding: "last price on a position you hold\(when)"
    case .manual: "entered by you"
    case nil: source.rawValue.lowercased()
    }
  }

  /// The short form in a sentence: "(quote)", "(last price, …)", "(entered)".
  static func short(_ source: GraphQLEnum<API.PriceSource>, asOf: Date?) -> String {
    switch source.known {
    case .quote: "(quote)"
    case .holding: "(last price\(asOf.map { ", \(Format.dateTime($0))" } ?? ""))"
    case .manual, nil: "(entered)"
    }
  }
}

/// Type chip, the account's own name, and its brokerage.
struct AccountHeader: View {
  let account: API.AccountLine

  var body: some View {
    HStack(spacing: 10) {
      TypeTag(account.accountType, label: account.typeLabel)
      VStack(alignment: .leading, spacing: 2) {
        Text(account.name).font(Theme.Font.small.weight(.medium)).foregroundStyle(Theme.Palette.ink).lineLimit(1)
        Eyebrow("\(account.brokerageName) · \(account.numberMasked)")
      }
    }
  }
}

/// A small labelled number in a row.
struct Figure: View {
  let label: String
  let value: String
  var muted = false
  var trailing = false

  var body: some View {
    VStack(alignment: trailing ? .trailing : .leading, spacing: 4) {
      Eyebrow(label)
      Text(value)
        .font(Theme.Font.mono)
        .monospacedDigit()
        .foregroundStyle(muted ? Theme.Palette.inkMuted : Theme.Palette.ink)
    }
  }
}

/// Accounts a plan leaves alone, as chips under a dashed border.
struct SkippedList<Content: View>: View {
  let title: String
  @ViewBuilder let content: Content

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      Eyebrow(title)
      content
    }
    .padding(16)
    .frame(maxWidth: .infinity, alignment: .leading)
    .overlay(
      RoundedRectangle(cornerRadius: Theme.Radius.tile)
        .strokeBorder(Theme.Palette.line, style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
    )
  }
}
