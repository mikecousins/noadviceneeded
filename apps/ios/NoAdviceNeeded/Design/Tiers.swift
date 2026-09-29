import SwiftUI

/// Account type is colour, not a word repeated on every row (`apps/web/app/lib/tiers.ts`): the
/// lime-to-olive ramp runs in contribution order for either country, so FHSA or HSA is always
/// brightest and non-registered or taxable always dimmest, while RESP, 529, workplace and other
/// sit outside the ramp in grey.
extension API.AccountType {
  var tint: Color {
    switch self {
    case .fhsa, .hsa: Theme.Palette.tier1
    case .tfsa, .rothIra: Theme.Palette.tier2
    case .rrsp, .ira: Theme.Palette.tier3
    case .nonRegistered, .taxable: Theme.Palette.tier4
    case .resp, .other, .workplace, .plan529: Theme.Palette.inkMuted
    }
  }

  /// Bars and swatches: the ramp, or the dim grey for types outside it.
  var fill: Color {
    switch self {
    case .resp, .other, .workplace, .plan529: Theme.Palette.inkDim
    default: tint
    }
  }

  /// `ACCOUNT_TYPE_LABELS` in the engine. The server sends `typeLabel` for an account's current
  /// type; this is for the type picker, which lists types no account has yet.
  var label: String {
    switch self {
    case .fhsa: "FHSA"
    case .tfsa: "TFSA"
    case .rrsp: "RRSP"
    case .nonRegistered: "Non-registered"
    case .resp: "RESP"
    case .other: "Other"
    case .hsa: "HSA"
    case .rothIra: "Roth IRA"
    case .ira: "Traditional IRA"
    case .taxable: "Taxable"
    case .workplace: "Workplace"
    case .plan529: "529"
    }
  }
}

extension API.RoomType {
  /// A limit takes the colour of the account type it is named after; the shared IRA limit takes
  /// the Traditional IRA's.
  var tint: Color {
    switch self {
    case .fhsa, .hsa: Theme.Palette.tier1
    case .tfsa: Theme.Palette.tier2
    case .rrsp, .ira: Theme.Palette.tier3
    }
  }
}

extension API.Country {
  var name: String {
    switch self {
    case .ca: "Canada"
    case .us: "United States"
    }
  }

  var flag: String {
    switch self {
    case .ca: "🇨🇦"
    case .us: "🇺🇸"
    }
  }

  var homeCurrency: String {
    switch self {
    case .ca: "CAD"
    case .us: "USD"
    }
  }

  /// `ACCOUNT_TYPES_BY_COUNTRY`, in contribution order.
  var accountTypes: [API.AccountType] {
    switch self {
    case .ca: [.fhsa, .tfsa, .rrsp, .nonRegistered, .resp, .other]
    case .us: [.hsa, .rothIra, .ira, .taxable, .workplace, .plan529, .other]
    }
  }

  /// The types in the plan by default: the two guidelines' ladder.
  var ladder: [API.AccountType] {
    switch self {
    case .ca: [.fhsa, .tfsa, .rrsp, .nonRegistered]
    case .us: [.hsa, .rothIra, .ira, .taxable]
    }
  }

  var roomLabels: [String] {
    switch self {
    case .ca: ["TFSA", "RRSP", "FHSA"]
    case .us: ["HSA", "IRA"]
    }
  }
}

extension GraphQLEnum {
  /// The known case, or nil for a value added to the schema after this build.
  var known: T? { value }
}
