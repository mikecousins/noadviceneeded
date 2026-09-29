import SwiftUI

/// "Acid Ledger", ported from `apps/web/app/app.css`: one dark ground, acid lime for anything that
/// buys or focuses, hot pink reserved for sells so a withdrawal never reads like a deposit, and a
/// lime-to-olive ramp (tier 1–4) that means account type wherever it appears. Build screens from
/// these tokens and the primitives in `Components.swift`, never raw colours.
nonisolated enum Theme {
  enum Palette {
    static let ink = Color(hex: 0xF4F4F0)
    static let inkMuted = Color(hex: 0x9A9AA8)
    static let inkDim = Color(hex: 0x6A6A76)
    static let canvas = Color(hex: 0x0B0B0D)
    static let surface = Color(hex: 0x14141A)
    static let raised = Color(hex: 0x1C1C24)
    static let line = Color(hex: 0x23232C)
    static let accent = Color(hex: 0xC9F24D)
    static let accentSoft = Color(hex: 0x1F2A10)
    static let sell = Color(hex: 0xFF5CC8)
    static let sellSoft = Color(hex: 0x241627)
    static let warn = Color(hex: 0xFFD84D)
    static let warnSoft = Color(hex: 0x2A2410)
    static let danger = Color(hex: 0xFF7A66)
    static let dangerSoft = Color(hex: 0x2A1512)

    /// Account-type ramp, richest shelter first. Each step clears 4.5:1 on the ground so the same
    /// token can label text and fill a bar.
    static let tier1 = Color(hex: 0xC9F24D)
    static let tier2 = Color(hex: 0xA9D64A)
    static let tier3 = Color(hex: 0x8CB840)
    static let tier4 = Color(hex: 0x6E8A46)
  }

  /// The web's font stacks end in the system faces (`ui-sans-serif`, `ui-monospace`), which is
  /// what the app uses: display and body in SF, every label and number in SF Mono.
  enum Font {
    /// The hero number: `--text-hero`, clamped to a phone.
    static let hero = SwiftUI.Font.system(size: 64, weight: .heavy)
    /// `--text-figure`.
    static let figure = SwiftUI.Font.system(size: 44, weight: .heavy)
    static let figureSmall = SwiftUI.Font.system(size: 26, weight: .heavy)
    /// `--text-mega` / `--text-3xl` page titles.
    static let title = SwiftUI.Font.system(size: 40, weight: .heavy)
    static let heading = SwiftUI.Font.system(size: 24, weight: .heavy)
    static let body = SwiftUI.Font.system(size: 15)
    static let small = SwiftUI.Font.system(size: 13)
    /// The mono eyebrow that labels every figure: 10px, 0.2em tracking, uppercase.
    static let label = SwiftUI.Font.system(size: 10, weight: .medium, design: .monospaced)
    static let labelBold = SwiftUI.Font.system(size: 11, weight: .bold, design: .monospaced)
    static let mono = SwiftUI.Font.system(size: 14, weight: .medium, design: .monospaced)
    static let monoLarge = SwiftUI.Font.system(size: 26, weight: .bold, design: .monospaced)
    static let button = SwiftUI.Font.system(size: 12, weight: .bold, design: .monospaced)
  }

  /// Letter spacing in points for the mono labels (`0.2em` at 10pt).
  enum Tracking {
    static let label: CGFloat = 2
    static let button: CGFloat = 1.6
    /// Display type runs tight: `-0.04em`.
    static let figure: CGFloat = -1.6
  }

  enum Radius {
    /// `--radius-card`: 1.5rem.
    static let card: CGFloat = 24
    /// `--radius-tile`: 1.25rem.
    static let tile: CGFloat = 20
    static let chip: CGFloat = 8
  }

  enum Space {
    static let gutter: CGFloat = 20
    static let stack: CGFloat = 16
  }
}

extension Color {
  nonisolated init(hex: UInt32) {
    self.init(
      .sRGB,
      red: Double((hex >> 16) & 0xFF) / 255,
      green: Double((hex >> 8) & 0xFF) / 255,
      blue: Double(hex & 0xFF) / 255
    )
  }
}
