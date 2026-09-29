import SwiftUI

extension AppModel {
  /// A screen's viewer, or sign-in when the server no longer knows the token.
  func viewer<V>(_ load: () async throws -> V?) async throws -> V {
    guard let viewer = try await load() else {
      api.signedOut()
      throw APIError.signedOut
    }
    return viewer
  }
}

/// The dashboard: net worth, the fund, the cash waiting, room, and the next deposit.
struct HomeView: View {
  @Environment(AppModel.self) private var app
  @Environment(\.money) private var money
  @State private var data: API.HomeQuery.Data.Viewer?
  @State private var error: APIError?

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
    .toolbar {
      ToolbarItem(placement: .topBarLeading) { Logo(size: 28) }
    }
    .task(id: app.revision) { await load() }
    .refreshable { await app.refresh(force: true) }
  }

  private func load() async {
    do {
      data = try await app.viewer { try await app.api.fetch(API.HomeQuery()).viewer }
      error = nil
    } catch {
      self.error = APIError(error)
    }
  }

  @ViewBuilder
  private func content(_ d: API.HomeQuery.Data.Viewer) -> some View {
    let p = d.portfolio
    let included = d.accounts.filter(\.included)
    Hero(
      label: "net worth · \(d.homeCurrency.lowercased())",
      value: money(p.totalValueCents, whole: true),
      sub: p.includedCount > 0
        ? "\(Format.plural(p.includedCount, "account")) in the plan" : "No accounts in the plan yet"
    )

    if app.shell?.tradeScope == false { TradingBanner() }

    if p.accountCount == 0 {
      EmptyState(
        title: "Nothing shared yet",
        bodyText:
          "Connect a brokerage in the SnapTrade dashboard, then pull to refresh. \(CountryCopy.of(d.country.known ?? .ca).brokerages)"
      ) {
        Link("Open SnapTrade ↗", destination: snapTradeDashboard).buttonStyle(.pill())
      }
    } else {
      if !included.isEmpty {
        VStack(alignment: .leading, spacing: 12) {
          Ribbon(
            segments: included.map {
              .init(id: $0.id, weight: Double($0.valueCents ?? 0), fill: $0.accountType.known?.fill ?? Theme.Palette.inkDim)
            })
          FlowRow(spacing: 14) {
            ForEach(included, id: \.id) { a in
              HStack(spacing: 6) {
                RoundedRectangle(cornerRadius: 2)
                  .fill(a.accountType.known?.fill ?? Theme.Palette.inkDim)
                  .frame(width: 10, height: 10)
                Eyebrow("\(a.typeLabel) \(money(a.valueCents, whole: true))")
              }
            }
          }
        }
        .padding(.top, 8)
      }

      fundCard(d)
      cashCard(p, hasFund: d.fund != nil)

      ForEach(included, id: \.id) { a in accountCard(a) }

      if !d.room.isEmpty {
        HStack(spacing: 10) {
          ForEach(d.room, id: \.roomType) { r in roomTile(r) }
        }
      }

      nextDeposit(d)
    }
  }

  private func fundCard(_ d: API.HomeQuery.Data.Viewer) -> some View {
    Card {
      Eyebrow("your one fund")
      if let fund = d.fund {
        Text(Format.ticker(fund.ticker))
          .font(Theme.Font.title)
          .tracking(-1.6)
          .foregroundStyle(Theme.Palette.ink)
          .padding(.top, 6)
        if let name = fund.name {
          Text(name).font(Theme.Font.small).foregroundStyle(Theme.Palette.inkMuted).padding(.top, 4)
        }
        Divider().overlay(Theme.Palette.line).padding(.vertical, 16)
        HStack(alignment: .bottom) {
          VStack(alignment: .leading, spacing: 4) {
            Eyebrow("units held")
            Text(Format.units(d.portfolio.unitsHeld)).font(Theme.Font.monoLarge).monospacedDigit()
          }
          Spacer()
          VStack(alignment: .trailing, spacing: 4) {
            Eyebrow("at last price")
            Text(money(d.portfolio.heldValueCents, whole: true)).font(Theme.Font.monoLarge).monospacedDigit()
          }
        }
        .foregroundStyle(Theme.Palette.ink)
      } else {
        Text("Not picked yet").font(Theme.Font.heading).foregroundStyle(Theme.Palette.ink).padding(.top, 6)
        Text("One all-in-one ETF, held in every account. That is guideline two.")
          .font(Theme.Font.small).foregroundStyle(Theme.Palette.inkMuted).padding(.top, 6)
        NavigationLink("Choose a fund") { FundView() }
          .buttonStyle(.pill())
          .padding(.top, 16)
      }
    }
  }

  private func cashCard(_ p: API.HomeQuery.Data.Viewer.Portfolio, hasFund: Bool) -> some View {
    let hasCash = (p.cashCents ?? 0) > 0
    // Every dollar in the plan is in the fund: the state the whole app works towards, so the
    // card celebrates it instead of nagging.
    let allIn = p.cashCents != nil && !hasCash && p.unitsHeld > 0
    let readyUnits = p.ready.map { $0.units } ?? 0
    return Card(tone: hasCash ? .accent : .plain) {
      if allIn {
        HStack(spacing: 8) {
          Text("✦").foregroundStyle(Theme.Palette.accent)
          Eyebrow("every dollar invested", color: Theme.Palette.accent)
        }
        Text("All in").font(Theme.Font.figure).tracking(Theme.Tracking.figure).padding(.top, 8)
        Text("No cash sitting idle in your plan. Nothing to do until the next deposit lands.")
          .font(Theme.Font.small).foregroundStyle(Theme.Palette.inkMuted).padding(.top, 8)
      } else {
        HStack(spacing: 8) {
          if hasCash { Circle().fill(Theme.Palette.accent).frame(width: 10, height: 10) }
          Eyebrow(
            (p.ready?.legs ?? 0) > 0
              ? "\(Format.plural(p.ready!.legs, "trade")) ready" : hasCash ? "cash waiting" : "no cash to put in",
            color: hasCash ? Theme.Palette.accent : Theme.Palette.inkMuted
          )
        }
        Text(money(p.cashCents))
          .font(Theme.Font.figure).tracking(Theme.Tracking.figure).monospacedDigit()
          .lineLimit(1).minimumScaleFactor(0.5)
          .padding(.top, 8)
        Text(
          readyUnits > 0
            ? "\(Format.units(readyUnits)) units at the last price your brokerage reported."
            : "Settled cash across the accounts in your plan."
        )
        .font(Theme.Font.small).foregroundStyle(Theme.Palette.inkMuted).padding(.top, 8)
      }
      HStack(spacing: 10) {
        Button(
          readyUnits > 0 ? "Buy \(Format.units(readyUnits)) units" : hasCash ? "Invest \(money(p.cashCents))" : "Nothing to invest"
        ) { app.tab = .invest }
        .buttonStyle(.pill())
        .disabled(!hasFund || !hasCash)
        Button("Withdraw") { app.tab = .withdraw }
          .buttonStyle(.pill(.secondary))
      }
      .padding(.top, 20)
    }
    .foregroundStyle(Theme.Palette.ink)
  }

  private func accountCard(_ a: API.HomeQuery.Data.Viewer.Account) -> some View {
    let cash = a.cashCents ?? 0
    return Card(tone: .plain, padding: 18) {
      HStack {
        Text(a.typeLabel.uppercased())
          .font(Theme.Font.labelBold).tracking(1.8)
          .foregroundStyle(a.accountType.known?.tint ?? Theme.Palette.inkMuted)
        Spacer()
        Text(a.name).font(Theme.Font.small.weight(.medium)).lineLimit(1)
      }
      Text(money(a.valueCents, whole: true))
        .font(Theme.Font.figureSmall).tracking(-1).monospacedDigit()
        .padding(.top, 12)
      Eyebrow("\(Format.units(a.positionUnits)) units · \(a.brokerageName)\(a.canTrade ? "" : " · read-only")")
        .padding(.top, 6)
      Badge(text: cash > 0 ? "\(money(a.cashCents)) cash" : "no cash", tone: cash > 0 ? .success : .info)
        .padding(.top, 10)
    }
    .foregroundStyle(Theme.Palette.ink)
  }

  private func roomTile(_ r: API.HomeQuery.Data.Viewer.Room) -> some View {
    let percent =
      if let remaining = r.remainingCents, let baseline = r.baselineCents, baseline > 0 {
        Double(remaining) / Double(baseline) * 100
      } else { 0.0 }
    return NavigationLink { RoomView() } label: {
      Tile {
        Text(r.label.uppercased())
          .font(Theme.Font.labelBold).tracking(1.8)
          .foregroundStyle(r.roomType.known?.tint ?? Theme.Palette.inkMuted)
        Text(r.remainingCents.map { money($0, whole: true) } ?? "not set")
          .font(Theme.Font.mono.weight(.bold)).monospacedDigit()
          .foregroundStyle(Theme.Palette.ink)
          .lineLimit(1).minimumScaleFactor(0.6)
          .padding(.top, 8)
        Meter(percent: percent, fill: r.roomType.known?.tint ?? Theme.Palette.inkDim).padding(.top, 10)
        Eyebrow(r.remainingCents == nil ? "add yours" : r.accountCount == 0 ? "no account" : "room left")
          .padding(.top, 8)
      }
    }
    .buttonStyle(.plain)
  }

  @ViewBuilder
  private func nextDeposit(_ d: API.HomeQuery.Data.Viewer) -> some View {
    if let s = d.nextDeposit {
      NavigationLink { AccountsView() } label: {
        VStack(alignment: .leading, spacing: 10) {
          Eyebrow("next deposit goes to")
          HStack(spacing: 10) {
            TypeTag(s.accountType)
            Text(s.account.name).font(Theme.Font.heading.weight(.heavy)).lineLimit(1).minimumScaleFactor(0.6)
          }
          HStack {
            Eyebrow(s.account.brokerageName)
            Spacer()
            Text(
              s.account.roomType == nil
                ? "∞ room" : s.roomCents.map { "\(money($0, whole: true)) room left" } ?? "room not set"
            )
            .font(Theme.Font.mono).monospacedDigit()
            .foregroundStyle(Theme.Palette.accent)
          }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .foregroundStyle(Theme.Palette.ink)
        .overlay(
          RoundedRectangle(cornerRadius: Theme.Radius.tile)
            .strokeBorder(Theme.Palette.accent.opacity(0.5), style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
        )
      }
      .buttonStyle(.plain)
    } else {
      NavigationLink { RoomView() } label: {
        VStack(alignment: .leading, spacing: 8) {
          Eyebrow("next deposit")
          Text(CountryCopy.of(d.country.known ?? .ca).roomNudge)
            .font(Theme.Font.small).foregroundStyle(Theme.Palette.inkMuted)
            .multilineTextAlignment(.leading)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(
          RoundedRectangle(cornerRadius: Theme.Radius.tile)
            .strokeBorder(Theme.Palette.line, style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
        )
      }
      .buttonStyle(.plain)
    }
  }
}
