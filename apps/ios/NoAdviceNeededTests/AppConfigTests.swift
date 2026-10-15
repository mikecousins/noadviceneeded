import Foundation
import Testing

@testable import No_Advice_Needed

/// Setup lives on the web; these paths must match `apps/web/app/routes.ts`.
struct AppConfigTests {
  let config = AppConfig(baseURL: URL(string: "https://www.noadviceneeded.com")!)

  @Test func linksSetupToTheWebRoutes() {
    #expect(config.web(.accounts).absoluteString == "https://www.noadviceneeded.com/app/accounts")
    #expect(config.web(.fund).absoluteString == "https://www.noadviceneeded.com/app/etf")
    #expect(config.web(.room).absoluteString == "https://www.noadviceneeded.com/app/room")
    #expect(config.web(.country).absoluteString == "https://www.noadviceneeded.com/app/country")
  }

  @Test func talksToTheGraphQLEndpoint() {
    #expect(config.graphQLURL.absoluteString == "https://www.noadviceneeded.com/api/graphql")
  }
}
