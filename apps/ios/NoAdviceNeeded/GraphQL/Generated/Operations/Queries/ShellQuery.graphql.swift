// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI
@_spi(Execution) @_spi(Unsafe) import ApolloAPI

extension API {
  nonisolated struct ShellQuery: GraphQLQuery {
    static let operationName: String = "Shell"
    static let operationDocument: ApolloAPI.OperationDocument = .init(
      definition: .init(
        #"query Shell { viewer { __typename id email country countryChosen homeCurrency tradeScope fund { __typename ticker } } }"#
      ))

    public init() {}

    nonisolated struct Data: API.SelectionSet {
      let __data: DataDict
      init(_dataDict: DataDict) { __data = _dataDict }

      static var __parentType: any ApolloAPI.ParentType { API.Objects.Query }
      static var __selections: [ApolloAPI.Selection] { [
        .field("viewer", Viewer?.self),
      ] }
      static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
        ShellQuery.Data.self
      ] }

      /// The signed-in user, or null. Reads the database only; call `sync` to refresh.
      var viewer: Viewer? { __data["viewer"] }

      /// Viewer
      ///
      /// Parent Type: `Viewer`
      nonisolated struct Viewer: API.SelectionSet {
        let __data: DataDict
        init(_dataDict: DataDict) { __data = _dataDict }

        static var __parentType: any ApolloAPI.ParentType { API.Objects.Viewer }
        static var __selections: [ApolloAPI.Selection] { [
          .field("__typename", String.self),
          .field("id", API.ID.self),
          .field("email", String.self),
          .field("country", GraphQLEnum<API.Country>.self),
          .field("countryChosen", Bool.self),
          .field("homeCurrency", String.self),
          .field("tradeScope", Bool.self),
          .field("fund", Fund?.self),
        ] }
        static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
          ShellQuery.Data.Viewer.self
        ] }

        var id: API.ID { __data["id"] }
        var email: String { __data["email"] }
        /// Where the user invests. Canada until they choose.
        var country: GraphQLEnum<API.Country> { __data["country"] }
        /// False until the user confirms a country; ask before anything else.
        var countryChosen: Bool { __data["countryChosen"] }
        var homeCurrency: String { __data["homeCurrency"] }
        /// The SnapTrade grant carries `trade`. Until then everything is read-only.
        var tradeScope: Bool { __data["tradeScope"] }
        var fund: Fund? { __data["fund"] }

        /// Viewer.Fund
        ///
        /// Parent Type: `Fund`
        nonisolated struct Fund: API.SelectionSet {
          let __data: DataDict
          init(_dataDict: DataDict) { __data = _dataDict }

          static var __parentType: any ApolloAPI.ParentType { API.Objects.Fund }
          static var __selections: [ApolloAPI.Selection] { [
            .field("__typename", String.self),
            .field("ticker", String.self),
          ] }
          static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
            ShellQuery.Data.Viewer.Fund.self
          ] }

          var ticker: String { __data["ticker"] }
        }
      }
    }
  }

}