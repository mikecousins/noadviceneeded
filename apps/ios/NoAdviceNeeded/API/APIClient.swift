import Apollo
import ApolloAPI
import Foundation

/// The app's one connection to `/api/graphql`. Queries read the server's database, so nothing is
/// cached on the device: every fetch goes to the network and every screen shows what the server
/// has now.
final class APIClient {
  private let apollo: ApolloClient
  let tokens: any TokenStore

  /// Called when the server says the token is no longer good (UNAUTHENTICATED, or no viewer).
  var onSignedOut: (() -> Void)?

  init(config: AppConfig, tokens: any TokenStore) {
    self.tokens = tokens
    let store = ApolloStore(cache: InMemoryNormalizedCache())
    let transport = RequestChainNetworkTransport(
      urlSession: URLSession(configuration: .ephemeral),
      interceptorProvider: Interceptors(tokens: tokens),
      store: store,
      endpointURL: config.graphQLURL
    )
    apollo = ApolloClient(networkTransport: transport, store: store)
  }

  func fetch<Query: GraphQLQuery>(_ query: Query) async throws -> Query.Data
  where Query.ResponseFormat == SingleResponseFormat {
    try await run { try await self.apollo.fetch(query: query, cachePolicy: .networkOnly) }
  }

  func perform<Mutation: GraphQLMutation>(_ mutation: Mutation) async throws -> Mutation.Data
  where Mutation.ResponseFormat == SingleResponseFormat {
    try await run { try await self.apollo.perform(mutation: mutation) }
  }

  private func run<Operation: GraphQLOperation>(
    _ send: () async throws -> GraphQLResponse<Operation>
  ) async throws -> Operation.Data {
    do {
      let response = try await send()
      if let first = response.errors?.first { throw APIError(graphQL: first) }
      guard let data = response.data else { throw APIError(code: .unknown, message: APIError.fallback) }
      return data
    } catch {
      let apiError = APIError(error)
      if apiError.code == .unauthenticated { signedOut() }
      throw apiError
    }
  }

  /// Drops the token and tells the app to show sign-in.
  func signedOut() {
    tokens.clear()
    onSignedOut?()
  }
}

/// Apollo's default chain with the bearer token added to every request.
nonisolated private struct Interceptors: InterceptorProvider {
  let tokens: any TokenStore

  func httpInterceptors<Operation: GraphQLOperation>(for operation: Operation) -> [any HTTPInterceptor] {
    [BearerTokenInterceptor(tokens: tokens), ResponseCodeInterceptor()]
  }
}

/// `Authorization: Bearer <token>` from the Keychain, read per request so a new sign-in takes
/// effect at once.
nonisolated private struct BearerTokenInterceptor: HTTPInterceptor {
  let tokens: any TokenStore

  func intercept(request: URLRequest, next: NextHTTPInterceptorFunction) async throws -> HTTPResponse {
    var request = request
    if let session = tokens.load() {
      request.setValue("Bearer \(session.token)", forHTTPHeaderField: "Authorization")
    }
    return try await next(request)
  }
}
