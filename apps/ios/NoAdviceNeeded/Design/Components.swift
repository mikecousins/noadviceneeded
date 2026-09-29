import SwiftUI

// Shared primitives, ported from `apps/web/app/components/ui.tsx`. Lead with one big figure per
// screen, mono uppercase labels, and as little prose as the screen can carry.

/// The mono eyebrow that labels every figure in this design.
struct Eyebrow: View {
  let text: String
  var color: Color = Theme.Palette.inkMuted

  init(_ text: String, color: Color = Theme.Palette.inkMuted) {
    self.text = text
    self.color = color
  }

  var body: some View {
    Text(text.uppercased())
      .font(Theme.Font.label)
      .tracking(Theme.Tracking.label)
      .foregroundStyle(color)
  }
}

/// The one big number a screen is about.
struct Hero: View {
  let label: String
  let value: String
  var sub: String? = nil
  var color: Color = Theme.Palette.ink

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      Eyebrow(label)
      Text(value)
        .font(Theme.Font.hero)
        .tracking(Theme.Tracking.figure)
        .monospacedDigit()
        .foregroundStyle(color)
        .lineLimit(1)
        .minimumScaleFactor(0.4)
      if let sub {
        Text(sub).font(Theme.Font.small).foregroundStyle(Theme.Palette.inkMuted)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

struct PageTitle: View {
  let title: String
  var lede: String? = nil

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text(title)
        .font(Theme.Font.title)
        .tracking(-1.4)
        .foregroundStyle(Theme.Palette.ink)
      if let lede {
        Text(lede).font(Theme.Font.small).foregroundStyle(Theme.Palette.inkMuted)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

enum CardTone {
  case plain, accent, sell

  var border: Color {
    switch self {
    case .plain: Theme.Palette.line
    case .accent: Theme.Palette.accent
    case .sell: Theme.Palette.sell
    }
  }
}

struct Card<Content: View>: View {
  var tone: CardTone = .plain
  var padding: CGFloat = 20
  @ViewBuilder let content: Content

  var body: some View {
    VStack(alignment: .leading, spacing: 0) { content }
      .padding(padding)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(Theme.Palette.surface, in: .rect(cornerRadius: Theme.Radius.card))
      .overlay(
        RoundedRectangle(cornerRadius: Theme.Radius.card).strokeBorder(tone.border, lineWidth: 2)
      )
  }
}

/// A quieter block inside a card: rows, chips, nested lists.
struct Tile<Content: View>: View {
  var padding: CGFloat = 14
  @ViewBuilder let content: Content

  var body: some View {
    VStack(alignment: .leading, spacing: 0) { content }
      .padding(padding)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(Theme.Palette.raised, in: .rect(cornerRadius: Theme.Radius.tile))
  }
}

enum Tone {
  case info, success, warn, danger

  var border: Color {
    switch self {
    case .info: Theme.Palette.line
    case .success: Theme.Palette.accent
    case .warn: Theme.Palette.warn
    case .danger: Theme.Palette.danger
    }
  }

  var fill: Color {
    switch self {
    case .info: Theme.Palette.surface
    case .success: Theme.Palette.accentSoft
    case .warn: Theme.Palette.warnSoft
    case .danger: Theme.Palette.dangerSoft
    }
  }

  var text: Color {
    switch self {
    case .info: Theme.Palette.inkMuted
    case .success: Theme.Palette.accent
    case .warn: Theme.Palette.warn
    case .danger: Theme.Palette.danger
    }
  }
}

struct Notice<Actions: View>: View {
  var tone: Tone = .info
  let message: String
  @ViewBuilder var actions: Actions

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text(message)
        .font(Theme.Font.small)
        .foregroundStyle(Theme.Palette.ink)
        .fixedSize(horizontal: false, vertical: true)
      actions
    }
    .padding(16)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(tone.fill, in: .rect(cornerRadius: Theme.Radius.tile))
    .overlay(RoundedRectangle(cornerRadius: Theme.Radius.tile).strokeBorder(tone.border, lineWidth: 1))
    .accessibilityElement(children: .combine)
  }
}

extension Notice where Actions == EmptyView {
  init(tone: Tone = .info, message: String) {
    self.init(tone: tone, message: message) { EmptyView() }
  }
}

struct Badge: View {
  let text: String
  var tone: Tone = .info

  var body: some View {
    Text(text.uppercased())
      .font(Theme.Font.label.weight(.bold))
      .tracking(1.2)
      .foregroundStyle(tone == .info ? Theme.Palette.inkMuted : tone.text)
      .padding(.horizontal, 10)
      .padding(.vertical, 4)
      .background(tone == .info ? Theme.Palette.raised : tone.fill, in: .capsule)
  }
}

/// Account type as a colour chip: the ramp carries the meaning, not more prose.
struct TypeTag: View {
  let type: API.AccountType?
  let label: String

  init(_ type: GraphQLEnum<API.AccountType>, label: String? = nil) {
    self.type = type.known
    self.label = label ?? type.known?.label ?? type.rawValue
  }

  var body: some View {
    Text(label.uppercased())
      .font(Theme.Font.label.weight(.bold))
      .tracking(1.4)
      .foregroundStyle(type?.tint ?? Theme.Palette.inkMuted)
      .padding(.horizontal, 10)
      .padding(.vertical, 6)
      .background(Theme.Palette.raised, in: .rect(cornerRadius: Theme.Radius.chip))
  }
}

/// A filled bar. `percent` is clamped, so an over-contribution still draws.
struct Meter: View {
  let percent: Double
  var fill: Color = Theme.Palette.accent

  var body: some View {
    GeometryReader { geo in
      ZStack(alignment: .leading) {
        Capsule().fill(Theme.Palette.line)
        Capsule().fill(fill).frame(width: geo.size.width * max(0, min(100, percent)) / 100)
      }
    }
    .frame(height: 8)
    .accessibilityLabel("\(Int(percent.rounded())) percent")
  }
}

/// Proportions of a whole, one bar: net worth by account, stocks against bonds.
struct Ribbon: View {
  struct Segment: Identifiable {
    let id: String
    let weight: Double
    let fill: Color
  }

  let segments: [Segment]
  var height: CGFloat = 16

  var body: some View {
    let shown = segments.filter { $0.weight > 0 }
    let total = shown.reduce(0) { $0 + $1.weight }
    if total > 0 {
      GeometryReader { geo in
        let gaps = CGFloat(max(0, shown.count - 1)) * 4
        HStack(spacing: 4) {
          ForEach(shown) { s in
            RoundedRectangle(cornerRadius: 3)
              .fill(s.fill)
              .frame(width: max(2, (geo.size.width - gaps) * s.weight / total))
          }
        }
      }
      .frame(height: height)
    }
  }
}

struct EmptyState<Action: View>: View {
  let title: String
  let bodyText: String
  @ViewBuilder var action: Action

  var body: some View {
    VStack(spacing: 12) {
      Text(title).font(Theme.Font.heading).foregroundStyle(Theme.Palette.ink)
      Text(bodyText)
        .font(Theme.Font.small)
        .foregroundStyle(Theme.Palette.inkMuted)
        .multilineTextAlignment(.center)
      action.padding(.top, 8)
    }
    .padding(28)
    .frame(maxWidth: .infinity)
    .overlay(
      RoundedRectangle(cornerRadius: Theme.Radius.card)
        .strokeBorder(Theme.Palette.line, style: StrokeStyle(lineWidth: 2, dash: [6, 5]))
    )
  }
}

extension EmptyState where Action == EmptyView {
  init(title: String, bodyText: String) {
    self.init(title: title, bodyText: bodyText) { EmptyView() }
  }
}

/// The brand mark: an acid tile carrying the N, the web favicon's geometry.
struct Logo: View {
  var size: CGFloat = 36

  var body: some View {
    Canvas { context, canvasSize in
      let s = canvasSize.width / 64
      context.fill(
        Path(roundedRect: CGRect(origin: .zero, size: canvasSize), cornerRadius: 16 * s),
        with: .color(Theme.Palette.accent)
      )
      var n = Path()
      let points: [(CGFloat, CGFloat)] = [
        (16, 47), (16, 17), (24, 17), (40, 35), (40, 17), (48, 17), (48, 47), (40, 47), (24, 29), (24, 47),
      ]
      n.addLines(points.map { CGPoint(x: $0.0 * s, y: $0.1 * s) })
      n.closeSubpath()
      context.fill(n, with: .color(Theme.Palette.canvas))
    }
    .frame(width: size, height: size)
    .accessibilityHidden(true)
  }
}

// MARK: - Buttons

enum ButtonVariant {
  case primary, secondary, ghost, danger
}

/// Pill buttons in mono caps. Lime is buy or focus; pink (`danger`) is sell.
struct PillButtonStyle: ButtonStyle {
  var variant: ButtonVariant = .primary
  var large = false
  @Environment(\.isEnabled) private var isEnabled

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(large ? Theme.Font.button.leading(.tight) : Theme.Font.button)
      .tracking(Theme.Tracking.button)
      .textCase(.uppercase)
      .multilineTextAlignment(.center)
      .foregroundStyle(foreground)
      .padding(.horizontal, large ? 24 : 18)
      .padding(.vertical, large ? 20 : 12)
      .frame(maxWidth: large ? .infinity : nil)
      .background(background, in: .capsule)
      .overlay(Capsule().strokeBorder(variant == .secondary ? Theme.Palette.line : .clear, lineWidth: 1))
      .opacity(isEnabled ? (configuration.isPressed ? 0.8 : 1) : 0.4)
      .contentShape(.capsule)
  }

  private var foreground: Color {
    switch variant {
    case .primary, .danger: Theme.Palette.canvas
    case .secondary: Theme.Palette.ink
    case .ghost: Theme.Palette.inkMuted
    }
  }

  private var background: Color {
    switch variant {
    case .primary: Theme.Palette.accent
    case .danger: Theme.Palette.sell
    case .secondary: Theme.Palette.surface
    case .ghost: .clear
    }
  }
}

extension ButtonStyle where Self == PillButtonStyle {
  static func pill(_ variant: ButtonVariant = .primary, large: Bool = false) -> PillButtonStyle {
    PillButtonStyle(variant: variant, large: large)
  }
}

// MARK: - Fields

/// The web's mono inputs on the raised ground.
struct FieldStyle: ViewModifier {
  func body(content: Content) -> some View {
    content
      .font(Theme.Font.mono)
      .foregroundStyle(Theme.Palette.ink)
      .padding(.horizontal, 12)
      .padding(.vertical, 11)
      .background(Theme.Palette.raised, in: .rect(cornerRadius: 12))
      .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Theme.Palette.line, lineWidth: 1))
  }
}

extension View {
  func fieldStyle() -> some View { modifier(FieldStyle()) }
}

// MARK: - Screen scaffold

/// A scrolling screen on the canvas ground with the standard gutter.
struct Screen<Content: View>: View {
  var spacing: CGFloat = Theme.Space.stack
  @ViewBuilder let content: Content

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: spacing) { content }
        .padding(.horizontal, Theme.Space.gutter)
        .padding(.top, 8)
        .padding(.bottom, 40)
    }
    .scrollDismissesKeyboard(.interactively)
    .background(Theme.Palette.canvas.ignoresSafeArea())
    .toolbarBackground(Theme.Palette.canvas, for: .navigationBar)
  }
}

/// Shown while a screen's first load is in flight.
struct LoadingView: View {
  var body: some View {
    ProgressView()
      .tint(Theme.Palette.accent)
      .frame(maxWidth: .infinity, minHeight: 240)
  }
}
