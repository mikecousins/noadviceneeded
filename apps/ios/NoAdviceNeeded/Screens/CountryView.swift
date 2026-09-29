import SwiftUI

/// Where the user invests. Asked once before anything else (`gate`), changeable from Plan.
struct CountryView: View {
  @Environment(AppModel.self) private var app
  @Environment(\.dismiss) private var dismiss
  var gate = false
  @State private var saving: API.Country?
  @State private var error: APIError?

  var body: some View {
    let current = gate ? nil : app.shell?.country.known
    Screen {
      PageTitle(
        title: current == nil ? "Where do you invest?" : "Where you invest",
        lede:
          "Decides which registered accounts the app knows, which limits it tracks, and which all-in-one ETFs it lists."
      )

      if current != nil {
        Notice(
          tone: .warn,
          message:
            "Switching country starts account setup over: every shared account is typed again for the new country, joins the plan by that type's default, and the two orders are reset. Your fund is cleared so the Fund screen offers the right list. Nothing is bought or sold."
        )
      }
      if let error { ErrorNotice(error: error) }

      ForEach([API.Country.ca, .us], id: \.self) { country in
        countryCard(country, chosen: current == country)
      }

      Text(
        "It works the same way in both countries: tax-sheltered accounts fill first and one all-in-one ETF goes in every account. Only the account names and the limits change."
      )
      .font(Theme.Font.small)
      .foregroundStyle(Theme.Palette.inkMuted)
    }
    .navigationTitle(gate ? "" : "Country")
    .navigationBarTitleDisplayMode(.inline)
  }

  private func countryCard(_ country: API.Country, chosen: Bool) -> some View {
    Button {
      Task { await choose(country) }
    } label: {
      Card(tone: chosen ? .accent : .plain) {
        HStack(alignment: .top) {
          Text("\(country.flag) \(country.name)")
            .font(Theme.Font.heading)
            .foregroundStyle(chosen ? Theme.Palette.accent : Theme.Palette.ink)
          Spacer()
          Badge(
            text: saving == country ? "saving…" : chosen ? "in use" : gate ? "choose" : "switch",
            tone: chosen ? .success : .info
          )
        }
        FlowRow {
          ForEach(Array(country.ladder.enumerated()), id: \.offset) { i, type in
            HStack(spacing: 6) {
              if i > 0 { Text("→").foregroundStyle(Theme.Palette.inkDim) }
              TypeTag(.case(type))
            }
          }
        }
        .padding(.top, 18)
        Divider().overlay(Theme.Palette.line).padding(.vertical, 14)
        Eyebrow("room tracked · \(country.roomLabels.joined(separator: ", "))")
        Eyebrow("cash counted in \(country.homeCurrency)").padding(.top, 6)
      }
    }
    .buttonStyle(.plain)
    .disabled(saving != nil || chosen)
  }

  private func choose(_ country: API.Country) async {
    saving = country
    error = nil
    defer { saving = nil }
    do {
      _ = try await app.api.perform(API.SetCountryMutation(country: .case(country)))
      await app.changed()
      if !gate { dismiss() }
    } catch {
      self.error = APIError(error)
    }
  }
}

/// Wraps children onto new lines, like the web's `flex-wrap`.
struct FlowRow: Layout {
  var spacing: CGFloat = 8

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    let rows = arrange(width: proposal.width ?? .infinity, subviews: subviews)
    let height = rows.reduce(0) { $0 + $1.height } + CGFloat(max(0, rows.count - 1)) * spacing
    let width = rows.map(\.width).max() ?? 0
    return CGSize(width: proposal.width ?? width, height: height)
  }

  func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
    var y = bounds.minY
    for row in arrange(width: bounds.width, subviews: subviews) {
      var x = bounds.minX
      for index in row.indices {
        let size = subviews[index].sizeThatFits(.unspecified)
        subviews[index].place(
          at: CGPoint(x: x, y: y + (row.height - size.height) / 2), proposal: ProposedViewSize(size))
        x += size.width + spacing
      }
      y += row.height + spacing
    }
  }

  private struct Row {
    var indices: [Int] = []
    var width: CGFloat = 0
    var height: CGFloat = 0
  }

  private func arrange(width: CGFloat, subviews: Subviews) -> [Row] {
    var rows: [Row] = [Row()]
    for (index, subview) in subviews.enumerated() {
      let size = subview.sizeThatFits(.unspecified)
      let extra = rows[rows.count - 1].indices.isEmpty ? size.width : size.width + spacing
      if rows[rows.count - 1].width + extra > width, !rows[rows.count - 1].indices.isEmpty {
        rows.append(Row())
      }
      let last = rows.count - 1
      rows[last].width += rows[last].indices.isEmpty ? size.width : size.width + spacing
      rows[last].height = max(rows[last].height, size.height)
      rows[last].indices.append(index)
    }
    return rows
  }
}
