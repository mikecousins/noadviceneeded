import SwiftUI

/// Every batch this app placed, newest first.
struct OrdersView: View {
  @Environment(AppModel.self) private var app
  @State private var batches: [API.BatchParts]?
  @State private var error: APIError?

  var body: some View {
    Screen {
      if let batches {
        let orders = batches.flatMap(\.orders)
        let placed = orders.filter { $0.status != "failed" }.count
        Hero(label: "orders placed", value: "\(placed)", sub: batches.isEmpty ? nil : "\(Format.plural(batches.count, "batch", "batches")) · \(Format.plural(orders.count, "order"))")
        if batches.isEmpty {
          EmptyState(
            title: "No orders yet",
            bodyText: "Buy or sell from the Invest or Withdraw screen and every batch lands here, with what each account did."
          )
        } else {
          ForEach(batches, id: \.id) { batch in
            NavigationLink { OrderBatchView(id: batch.id) } label: { BatchSummary(batch: batch) }
              .buttonStyle(.plain)
          }
        }
        Text(
          "Every order here was a market order for the day, placed when you confirmed a batch. Statuses are what the brokerage reported at the time; check your brokerage for fills."
        )
        .font(Theme.Font.small).foregroundStyle(Theme.Palette.inkMuted)
      } else if let error {
        ErrorNotice(error: error)
      } else {
        LoadingView()
      }
    }
    .navigationTitle("Orders")
    .navigationBarTitleDisplayMode(.inline)
    .task(id: app.revision) { await load() }
    .refreshable { await load() }
  }

  private func load() async {
    do {
      batches = try await app.viewer { try await app.api.fetch(API.OrdersQuery()).viewer }
        .orderBatches.map(\.fragments.batchParts)
      error = nil
    } catch {
      self.error = APIError(error)
    }
  }
}

/// One batch as a card: bought or sold, units, total, and whether every order went through.
struct BatchSummary: View {
  @Environment(\.money) private var money
  let batch: API.BatchParts
  var highlight = false

  var body: some View {
    let buy = batch.kind == .case(.invest)
    let totalUnits = batch.orders.reduce(0) { $0 + $1.units }
    let anyNotional = batch.orders.contains { $0.notionalCents != nil }
    let total = batch.orders.reduce(0) { $0 + $1.estimatedCents }
    let bad = batch.orders.filter { $0.status == "failed" }.count
    let color = bad == 0 ? (buy ? Theme.Palette.accent : Theme.Palette.sell) : Theme.Palette.warn
    Card(tone: highlight ? (buy ? .accent : .sell) : .plain) {
      HStack(alignment: .top) {
        Text(buy ? "BOUGHT" : "SOLD")
          .font(Theme.Font.labelBold).tracking(1.8)
          .foregroundStyle(Theme.Palette.canvas)
          .padding(.horizontal, 10).padding(.vertical, 7)
          .background(buy ? Theme.Palette.accent : Theme.Palette.sell, in: .rect(cornerRadius: Theme.Radius.chip))
        Spacer()
        Text(money(total)).font(Theme.Font.mono.weight(.bold)).monospacedDigit().foregroundStyle(Theme.Palette.ink)
      }
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Text(anyNotional ? "≈\(Format.units(totalUnits))" : Format.units(totalUnits))
          .font(Theme.Font.figureSmall).monospacedDigit()
        Text(Format.ticker(batch.ticker)).font(Theme.Font.body.weight(.heavy))
      }
      .foregroundStyle(Theme.Palette.ink)
      .padding(.top, 12)
      Eyebrow(
        "\(Format.dateTime(batch.createdAt)) · planned at \(money(batch.priceCents))"
          + (batch.requestedCents.map { " · asked for \(money($0))" } ?? "")
      )
      .padding(.top, 6)
      HStack(spacing: 6) {
        Circle().fill(color).frame(width: 8, height: 8)
        Eyebrow(bad == 0 ? "all accepted" : "\(Format.plural(bad, "order")) failed", color: color)
      }
      .padding(.top, 10)
    }
  }
}

/// One batch with every order in it. Opened right after Invest or Withdraw places one.
struct OrderBatchView: View {
  @Environment(AppModel.self) private var app
  @Environment(\.money) private var money
  let id: String
  var justPlaced = false
  @State private var batch: API.BatchParts?
  @State private var missing = false
  @State private var error: APIError?

  var body: some View {
    Screen {
      if let batch {
        let failed = batch.orders.filter { $0.status == "failed" }.count
        if justPlaced {
          Notice(
            tone: failed == 0 ? .success : failed == batch.orders.count ? .danger : .warn,
            message: failed == 0
              ? "Placed \(Format.plural(batch.orders.count, "order")). Cash and units update after SnapTrade's next read."
              : "\(batch.orders.count - failed) of \(batch.orders.count) orders were placed. See the errors below."
          )
        }
        BatchSummary(batch: batch, highlight: justPlaced)
        ForEach(batch.orders, id: \.id) { order in orderRow(order) }
      } else if missing {
        EmptyState(title: "Not found", bodyText: "This batch is not in your orders.")
      } else if let error {
        ErrorNotice(error: error)
      } else {
        LoadingView()
      }
    }
    .navigationTitle(justPlaced ? "Placed" : "Batch")
    .navigationBarTitleDisplayMode(.inline)
    .task { await load() }
    .refreshable { await load() }
  }

  private func load() async {
    do {
      let viewer = try await app.viewer { try await app.api.fetch(API.OrderBatchQuery(id: id)).viewer }
      batch = viewer.orderBatch?.fragments.batchParts
      missing = batch == nil
      error = nil
    } catch {
      self.error = APIError(error)
    }
  }

  private func orderRow(_ o: API.BatchParts.Order) -> some View {
    Tile(padding: 16) {
      HStack(alignment: .top) {
        VStack(alignment: .leading, spacing: 4) {
          Text(o.accountName).font(Theme.Font.small.weight(.medium)).foregroundStyle(Theme.Palette.ink)
          Eyebrow(o.brokerageName)
        }
        Spacer()
        Badge(text: o.status, tone: Self.tone(o.status))
      }
      Eyebrow(
        "\(o.side.rawValue.lowercased()) · market · day · "
          + (o.notionalCents.map { "\(money($0)) by amount · ≈\(Format.units(o.units)) units" }
            ?? "\(Format.units(o.units)) units")
      )
      .padding(.top, 10)
      HStack {
        if let ref = o.brokerageOrderId { Eyebrow("#\(ref)") }
        Spacer()
        Text(money(o.estimatedCents)).font(Theme.Font.mono).monospacedDigit().foregroundStyle(Theme.Palette.ink)
      }
      .padding(.top, 8)
      if let message = o.error {
        Text(message).font(Theme.Font.small).foregroundStyle(Theme.Palette.danger).padding(.top, 8)
      }
    }
  }

  /// SnapTrade's statuses and our own (planned, failed), coloured the web's way.
  static func tone(_ status: String) -> Tone {
    switch status.uppercased() {
    case "EXECUTED", "ACCEPTED": .success
    case "FAILED", "REJECTED", "CANCELED", "EXPIRED": .danger
    case "PENDING", "QUEUED", "PARTIAL", "CHECKED": .warn
    default: .info
    }
  }
}
