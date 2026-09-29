import SwiftUI

/// Guideline two: the one all-in-one ETF every account holds. The pick is the user's; the list is
/// not ranked and nothing is named a favourite.
struct FundView: View {
  @Environment(AppModel.self) private var app
  @Environment(\.dismiss) private var dismiss
  @State private var data: API.FundQuery.Data.Viewer?
  @State private var error: APIError?
  @State private var query = ""
  @State private var results: [API.SearchSymbolsQuery.Data.Viewer.SearchSymbol]?
  @State private var searching = false
  @State private var choosing: String?

  var body: some View {
    Screen {
      VStack(alignment: .leading, spacing: 0) {
        Text("One fund.")
        Text("Every account.").foregroundStyle(Theme.Palette.accent)
      }
      .font(Theme.Font.title)
      .tracking(-1.4)
      .foregroundStyle(Theme.Palette.ink)

      if let data {
        content(data)
      } else if let error {
        ErrorNotice(error: error)
      } else {
        LoadingView()
      }
    }
    .navigationTitle("Fund")
    .navigationBarTitleDisplayMode(.inline)
    .task(id: app.revision) { await load() }
    .refreshable { await load() }
  }

  private func load() async {
    do {
      data = try await app.viewer { try await app.api.fetch(API.FundQuery()).viewer }
    } catch {
      self.error = APIError(error)
    }
  }

  @ViewBuilder
  private func content(_ d: API.FundQuery.Data.Viewer) -> some View {
    let hasActiveAccount = d.accounts.contains { $0.connectionStatus == .case(.active) }
    let country = d.country.known ?? .ca

    if let fund = d.fund {
      Notice(
        tone: .success,
        message:
          "Every included account holds \(Format.ticker(fund.ticker))\(fund.name.map { " · \($0)" } ?? ""). Switching changes future orders only; nothing is bought or sold."
      )
    }
    if let error { ErrorNotice(error: error) }
    if !hasActiveAccount {
      Notice(
        tone: .warn,
        message:
          "Symbols are looked up through one of your connected accounts, so connect a brokerage at SnapTrade before choosing."
      )
    }

    VStack(alignment: .leading, spacing: 8) {
      Eyebrow("or search any symbol")
      HStack(spacing: 10) {
        TextField(CountryCopy.of(country).searchExample, text: $query)
          .textInputAutocapitalization(.characters)
          .autocorrectionDisabled()
          .submitLabel(.search)
          .onSubmit { Task { await search() } }
          .fieldStyle()
        Button(searching ? "…" : "Go") { Task { await search() } }
          .buttonStyle(.pill(.secondary))
          .disabled(searching || !hasActiveAccount || query.trimmingCharacters(in: .whitespaces).isEmpty)
      }
    }

    if let results {
      Card {
        Eyebrow("search results")
        if results.isEmpty {
          Text("No matches.").font(Theme.Font.small).foregroundStyle(Theme.Palette.inkMuted).padding(.top, 10)
        }
        ForEach(results, id: \.id) { r in
          Tile(padding: 14) {
            HStack(alignment: .firstTextBaseline) {
              Text(r.ticker).font(Theme.Font.heading).foregroundStyle(Theme.Palette.ink)
              Spacer()
              Eyebrow("\(r.exchange) · \(r.currency)")
            }
            Text(r.name).font(Theme.Font.small).foregroundStyle(Theme.Palette.inkMuted).padding(.top, 4)
            Button(choosing == r.id ? "Choosing…" : "Use this") { Task { await choose(symbol: r) } }
              .buttonStyle(.pill())
              .disabled(choosing != nil)
              .padding(.top, 10)
          }
          .padding(.top, 10)
        }
      }
    }

    ForEach(d.fundChoices, id: \.ticker) { etf in
      let chosen = d.fund?.ticker == etf.ticker
      Button {
        Task { await choose(ticker: etf.ticker) }
      } label: {
        Card(tone: chosen ? .accent : .plain) {
          HStack(alignment: .top) {
            Text(Format.ticker(etf.ticker))
              .font(Theme.Font.title).tracking(-1.4)
              .foregroundStyle(chosen ? Theme.Palette.accent : Theme.Palette.ink)
            Spacer()
            Badge(
              text: choosing == etf.ticker ? "choosing…" : chosen ? "in use" : "switch",
              tone: chosen ? .success : .info)
          }
          Text(etf.name).font(Theme.Font.small).foregroundStyle(Theme.Palette.inkMuted).padding(.top, 6)
          Ribbon(
            segments: [
              .init(id: "equity", weight: Double(etf.equityPercent), fill: chosen ? Theme.Palette.accent : Theme.Palette.tier3),
              .init(id: "bonds", weight: Double(100 - etf.equityPercent), fill: Theme.Palette.line),
            ],
            height: 12
          )
          .padding(.top, 16)
          Eyebrow(
            (etf.equityPercent == 100
              ? "100% stocks" : "\(etf.equityPercent)% stocks · \(100 - etf.equityPercent)% bonds")
              + " · \(etf.provider)"
          )
          .padding(.top, 10)
        }
      }
      .buttonStyle(.plain)
      .disabled(choosing != nil || !hasActiveAccount || chosen)
    }

    Text(
      "All of these are diversified and rebalanced for you, which is why one is enough. The pick is yours: this app does not rank them or name a favourite."
    )
    .font(Theme.Font.small).foregroundStyle(Theme.Palette.inkMuted)
  }

  private func search() async {
    let q = query.trimmingCharacters(in: .whitespaces)
    guard !q.isEmpty else { return }
    searching = true
    defer { searching = false }
    do {
      results = try await app.viewer { try await app.api.fetch(API.SearchSymbolsQuery(query: q)).viewer }
        .searchSymbols
      error = nil
    } catch {
      self.error = APIError(error)
    }
  }

  private func choose(ticker: String) async {
    await choosing(ticker) {
      _ = try await app.api.perform(API.ChooseFundMutation(ticker: ticker))
    }
  }

  private func choose(symbol r: API.SearchSymbolsQuery.Data.Viewer.SearchSymbol) async {
    await choosing(r.id) {
      _ = try await app.api.perform(
        API.ChooseFundSymbolMutation(
          symbol: API.FundSymbolInput(currency: r.currency, name: r.name, symbolId: r.id, ticker: r.ticker)))
    }
  }

  private func choosing(_ key: String, _ write: () async throws -> Void) async {
    choosing = key
    error = nil
    defer { choosing = nil }
    do {
      try await write()
      results = nil
      await app.changed()
    } catch {
      self.error = APIError(error)
    }
  }
}
