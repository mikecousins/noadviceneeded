import Foundation

/// Per-build settings. `API_BASE_URL` comes from `Config/Debug.xcconfig` (local `pnpm dev`) or
/// `Config/Release.xcconfig` (production), overridable in `Config/Local.xcconfig`.
nonisolated struct AppConfig: Sendable {
  let baseURL: URL

  var graphQLURL: URL { baseURL.appending(path: "api/graphql") }

  static let current: AppConfig = {
    let raw = Bundle.main.object(forInfoDictionaryKey: "APIBaseURL") as? String ?? ""
    guard let url = URL(string: raw), url.scheme != nil else {
      fatalError("APIBaseURL is missing from Info.plist; set API_BASE_URL in Config/*.xcconfig.")
    }
    return AppConfig(baseURL: url)
  }()
}
