// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI
@_spi(Execution) @_spi(Unsafe) import ApolloAPI

extension API {
  nonisolated struct SearchSymbolsQuery: GraphQLQuery {
    static let operationName: String = "SearchSymbols"
    static let operationDocument: ApolloAPI.OperationDocument = .init(
      definition: .init(
        #"query SearchSymbols($query: String!) { viewer { __typename id searchSymbols(query: $query) { __typename id ticker name exchange currency } } }"#
      ))

    public var query: String

    public init(query: String) {
      self.query = query
    }

    @_spi(Unsafe) public var __variables: Variables? { ["query": query] }

    nonisolated struct Data: API.SelectionSet {
      let __data: DataDict
      init(_dataDict: DataDict) { __data = _dataDict }

      static var __parentType: any ApolloAPI.ParentType { API.Objects.Query }
      static var __selections: [ApolloAPI.Selection] { [
        .field("viewer", Viewer?.self),
      ] }
      static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
        SearchSymbolsQuery.Data.self
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
          .field("searchSymbols", [SearchSymbol].self, arguments: ["query": .variable("query")]),
        ] }
        static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
          SearchSymbolsQuery.Data.Viewer.self
        ] }

        var id: API.ID { __data["id"] }
        /// Symbol search within a connected account. Reads SnapTrade.
        var searchSymbols: [SearchSymbol] { __data["searchSymbols"] }

        /// Viewer.SearchSymbol
        ///
        /// Parent Type: `Symbol`
        nonisolated struct SearchSymbol: API.SelectionSet {
          let __data: DataDict
          init(_dataDict: DataDict) { __data = _dataDict }

          static var __parentType: any ApolloAPI.ParentType { API.Objects.Symbol }
          static var __selections: [ApolloAPI.Selection] { [
            .field("__typename", String.self),
            .field("id", API.ID.self),
            .field("ticker", String.self),
            .field("name", String.self),
            .field("exchange", String.self),
            .field("currency", String.self),
          ] }
          static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
            SearchSymbolsQuery.Data.Viewer.SearchSymbol.self
          ] }

          /// SnapTrade universal symbol id.
          var id: API.ID { __data["id"] }
          var ticker: String { __data["ticker"] }
          var name: String { __data["name"] }
          var exchange: String { __data["exchange"] }
          var currency: String { __data["currency"] }
        }
      }
    }
  }

}