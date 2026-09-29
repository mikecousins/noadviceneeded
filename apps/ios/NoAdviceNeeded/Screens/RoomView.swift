import ApolloAPI
import SwiftUI

/// Room left in each limit: a figure the user copies in once, less contributions the brokerage
/// reports after that day.
struct RoomView: View {
  @Environment(AppModel.self) private var app
  @Environment(\.money) private var money
  @State private var data: API.RoomQuery.Data.Viewer?
  @State private var error: APIError?
  @State private var message: String?

  var body: some View {
    Screen {
      SyncLine()
      if let data {
        let copy = CountryCopy.of(data.country.known ?? .ca)
        PageTitle(title: "Room left", lede: copy.roomLede)
        if let error { ErrorNotice(error: error) }
        if let message { Notice(tone: .success, message: message) }
        ForEach(data.room, id: \.roomType) { limit in
          RoomCard(limit: limit, copy: copy, onSaved: saved)
        }
        activities(data, copy: copy)
      } else if let error {
        ErrorNotice(error: error)
      } else {
        LoadingView()
      }
    }
    .navigationTitle("Room")
    .navigationBarTitleDisplayMode(.inline)
    .task(id: app.revision) { await load() }
    .refreshable { await app.refresh(force: true) }
  }

  private func load() async {
    do {
      data = try await app.viewer { try await app.api.fetch(API.RoomQuery()).viewer }
    } catch {
      self.error = APIError(error)
    }
  }

  private func saved(_ result: Result<String, APIError>) {
    switch result {
    case .success(let text):
      message = text
      error = nil
      Task { await app.changed() }
    case .failure(let failure):
      message = nil
      error = failure
    }
  }

  @ViewBuilder
  private func activities(_ d: API.RoomQuery.Data.Viewer, copy: CountryCopy) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      Text("Cash in and out of registered accounts").font(Theme.Font.heading).foregroundStyle(Theme.Palette.ink)
      Eyebrow("as your brokerage reports it, from your earliest limit date")
    }
    .padding(.top, 12)
    if d.roomActivities.isEmpty {
      Text("Nothing yet. Save a limit above and pull to refresh.")
        .font(Theme.Font.small).foregroundStyle(Theme.Palette.inkMuted)
    } else {
      ForEach(d.roomActivities, id: \.id) { a in
        Tile(padding: 14) {
          HStack {
            Eyebrow(a.tradeDate.description)
            Spacer()
            Text(money(abs(a.amountCents))).font(Theme.Font.mono.weight(.bold)).monospacedDigit()
              .foregroundStyle(Theme.Palette.ink)
          }
          HStack(spacing: 8) {
            Text(a.typeLabel.uppercased())
              .font(Theme.Font.labelBold).tracking(1.6)
              .foregroundStyle(a.accountType.known?.tint ?? Theme.Palette.inkMuted)
            Text(a.accountName).font(Theme.Font.small).foregroundStyle(Theme.Palette.ink).lineLimit(1)
            Spacer()
            Badge(text: a.type.lowercased())
          }
          .padding(.top, 8)
          if let description = a.description {
            Eyebrow(description).lineLimit(2).padding(.top, 6)
          }
        }
      }
    }
    Text(copy.roomWithdrawals).font(Theme.Font.small).foregroundStyle(Theme.Palette.inkMuted)
  }
}

/// One limit: what is left, how full, and the form to set it.
private struct RoomCard: View {
  @Environment(AppModel.self) private var app
  @Environment(\.money) private var money
  let limit: API.RoomQuery.Data.Viewer.Room
  let copy: CountryCopy
  let onSaved: (Result<String, APIError>) -> Void
  @State private var amount = ""
  @State private var asOf = Date.now
  @State private var busy = false

  var body: some View {
    let percent =
      if let remaining = limit.remainingCents, let baseline = limit.baselineCents, baseline > 0 {
        Double(remaining) / Double(baseline) * 100
      } else { 0.0 }
    let over = (limit.remainingCents ?? 0) < 0
    let tint = limit.roomType.known?.tint ?? Theme.Palette.inkMuted
    Card(tone: limit.remainingCents == nil ? .plain : over ? .sell : .accent) {
      HStack {
        Text(limit.label.uppercased()).font(Theme.Font.labelBold).tracking(2.4).foregroundStyle(tint)
        Spacer()
        if limit.accountCount == 0 { Eyebrow("no account") }
      }
      Text(limit.remainingCents.map { money($0, whole: true) } ?? "—")
        .font(Theme.Font.figure).tracking(Theme.Tracking.figure).monospacedDigit()
        .foregroundStyle(Theme.Palette.ink)
        .padding(.top, 10)
      Meter(percent: percent, fill: tint).padding(.top, 14)
      Eyebrow(limit.baselineCents != nil ? "\(Int(percent.rounded()))% of your limit free" : "no limit entered yet")
        .padding(.top, 8)

      if let since = limit.asOf {
        Divider().overlay(Theme.Palette.line).padding(.vertical, 12)
        HStack {
          Eyebrow("you added since \(since.description)")
          Spacer()
          Text(money(limit.contributedSinceCents, whole: true)).font(Theme.Font.mono.weight(.bold)).monospacedDigit()
            .foregroundStyle(Theme.Palette.ink)
        }
      }
      if over {
        Text("Over the room you entered. Check \(copy.roomSource).")
          .font(Theme.Font.small).foregroundStyle(Theme.Palette.sell).padding(.top, 10)
      }
      Text(limit.note).font(Theme.Font.small).foregroundStyle(Theme.Palette.inkMuted).padding(.top, 12)

      VStack(alignment: .leading, spacing: 8) {
        Eyebrow(copy.roomInput)
        TextField("7,000", text: $amount).keyboardType(.decimalPad).fieldStyle()
        Eyebrow("true as of").padding(.top, 4)
        DatePicker("True as of", selection: $asOf, in: ...CalendarDay.today().date(), displayedComponents: .date)
          .labelsHidden()
          .datePickerStyle(.compact)
          .environment(\.timeZone, .eastern)
        HStack(spacing: 10) {
          Button("Save") { Task { await save() } }
            .buttonStyle(.pill())
            .disabled(busy)
          if limit.baselineCents != nil {
            Button("Clear") { Task { await clear() } }
              .buttonStyle(.pill(.ghost))
              .disabled(busy)
          }
        }
        .padding(.top, 6)
      }
      .padding(.top, 18)
    }
    .onAppear(perform: reset)
    .onChange(of: limit.baselineCents) { reset() }
  }

  private func reset() {
    amount = limit.baselineCents.map(Format.editableDollars) ?? ""
    asOf = (limit.asOf ?? CalendarDay.today()).date()
  }

  private func save() async {
    guard let cents = Format.parseDollarsToCents(amount, allowZero: true) else {
      onSaved(.failure(APIError(code: .badUserInput, message: "Enter the room in dollars and the date it was true.")))
      return
    }
    busy = true
    defer { busy = false }
    do {
      _ = try await app.api.perform(
        API.SetRoomMutation(roomType: limit.roomType, roomCents: cents, asOf: CalendarDay(asOf)))
      onSaved(.success("\(limit.label) room saved."))
    } catch {
      onSaved(.failure(APIError(error)))
    }
  }

  private func clear() async {
    busy = true
    defer { busy = false }
    do {
      _ = try await app.api.perform(API.ClearRoomMutation(roomType: limit.roomType))
      onSaved(.success("\(limit.label) room cleared."))
    } catch {
      onSaved(.failure(APIError(error)))
    }
  }
}
