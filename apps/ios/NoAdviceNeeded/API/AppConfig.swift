import Foundation

/// Per-build settings. `API_BASE_URL` comes from `Config/Debug.xcconfig` (local `pnpm dev`) or
/// `Config/Release.xcconfig` (production), overridable in `Config/Local.xcconfig`.
nonisolated struct AppConfig: Sendable {
  let baseURL: URL

  var graphQLURL: URL { baseURL.appending(path: "api/graphql") }

  /// Setup lives on the web for now; the app links to the page that does it.
  func web(_ page: WebPage) -> URL { baseURL.appending(path: page.rawValue) }

  static let current: AppConfig = {
    let raw = Bundle.main.object(forInfoDictionaryKey: "APIBaseURL") as? String ?? ""
    guard let url = URL(string: raw), url.scheme != nil else {
      fatalError("APIBaseURL is missing from Info.plist; set API_BASE_URL in Config/*.xcconfig.")
    }
    return AppConfig(baseURL: url)
  }()
}

/// The web routes that own setup (`apps/web/app/routes.ts`).
nonisolated enum WebPage: String, Sendable, CaseIterable {
  case accounts = "app/accounts"
  case fund = "app/etf"
  case room = "app/room"
  case country = "app/country"
}
