// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI
@_spi(Execution) @_spi(Unsafe) import ApolloAPI

extension API {
  nonisolated struct ExchangeSignInCodeMutation: GraphQLMutation {
    static let operationName: String = "ExchangeSignInCode"
    static let operationDocument: ApolloAPI.OperationDocument = .init(
      definition: .init(
        #"mutation ExchangeSignInCode($code: String!, $codeVerifier: String!) { exchangeSignInCode(code: $code, codeVerifier: $codeVerifier) { __typename token expiresAt } }"#
      ))

    public var code: String
    public var codeVerifier: String

    public init(
      code: String,
      codeVerifier: String
    ) {
      self.code = code
      self.codeVerifier = codeVerifier
    }

    @_spi(Unsafe) public var __variables: Variables? { [
      "code": code,
      "codeVerifier": codeVerifier
    ] }

    nonisolated struct Data: API.SelectionSet {
      let __data: DataDict
      init(_dataDict: DataDict) { __data = _dataDict }

      static var __parentType: any ApolloAPI.ParentType { API.Objects.Mutation }
      static var __selections: [ApolloAPI.Selection] { [
        .field("exchangeSignInCode", ExchangeSignInCode.self, arguments: [
          "code": .variable("code"),
          "codeVerifier": .variable("codeVerifier")
        ]),
      ] }
      static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
        ExchangeSignInCodeMutation.Data.self
      ] }

      /// Ends the native sign-in: the `code` from noadviceneeded://auth/callback plus the PKCE verifier the app generated for /auth/snaptrade/mobile.
      var exchangeSignInCode: ExchangeSignInCode { __data["exchangeSignInCode"] }

      /// ExchangeSignInCode
      ///
      /// Parent Type: `AuthSession`
      nonisolated struct ExchangeSignInCode: API.SelectionSet {
        let __data: DataDict
        init(_dataDict: DataDict) { __data = _dataDict }

        static var __parentType: any ApolloAPI.ParentType { API.Objects.AuthSession }
        static var __selections: [ApolloAPI.Selection] { [
          .field("__typename", String.self),
          .field("token", String.self),
          .field("expiresAt", API.DateTime.self),
        ] }
        static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
          ExchangeSignInCodeMutation.Data.ExchangeSignInCode.self
        ] }

        /// Send as `Authorization: Bearer <token>`. Keep it in the Keychain.
        var token: String { __data["token"] }
        var expiresAt: API.DateTime { __data["expiresAt"] }
      }
    }
  }

}