// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI
@_spi(Execution) @_spi(Unsafe) import ApolloAPI

extension API {
  nonisolated struct ChooseFundSymbolMutation: GraphQLMutation {
    static let operationName: String = "ChooseFundSymbol"
    static let operationDocument: ApolloAPI.OperationDocument = .init(
      definition: .init(
        #"mutation ChooseFundSymbol($symbol: FundSymbolInput!) { chooseFundSymbol(symbol: $symbol) { __typename id fund { __typename ticker } } }"#
      ))

    public var symbol: FundSymbolInput

    public init(symbol: FundSymbolInput) {
      self.symbol = symbol
    }

    @_spi(Unsafe) public var __variables: Variables? { ["symbol": symbol] }

    nonisolated struct Data: API.SelectionSet {
      let __data: DataDict
      init(_dataDict: DataDict) { __data = _dataDict }

      static var __parentType: any ApolloAPI.ParentType { API.Objects.Mutation }
      static var __selections: [ApolloAPI.Selection] { [
        .field("chooseFundSymbol", ChooseFundSymbol.self, arguments: ["symbol": .variable("symbol")]),
      ] }
      static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
        ChooseFundSymbolMutation.Data.self
      ] }

      /// Chooses a `searchSymbols` result as the fund.
      var chooseFundSymbol: ChooseFundSymbol { __data["chooseFundSymbol"] }

      /// ChooseFundSymbol
      ///
      /// Parent Type: `Viewer`
      nonisolated struct ChooseFundSymbol: API.SelectionSet {
        let __data: DataDict
        init(_dataDict: DataDict) { __data = _dataDict }

        static var __parentType: any ApolloAPI.ParentType { API.Objects.Viewer }
        static var __selections: [ApolloAPI.Selection] { [
          .field("__typename", String.self),
          .field("id", API.ID.self),
          .field("fund", Fund?.self),
        ] }
        static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
          ChooseFundSymbolMutation.Data.ChooseFundSymbol.self
        ] }

        var id: API.ID { __data["id"] }
        var fund: Fund? { __data["fund"] }

        /// ChooseFundSymbol.Fund
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
            ChooseFundSymbolMutation.Data.ChooseFundSymbol.Fund.self
          ] }

          var ticker: String { __data["ticker"] }
        }
      }
    }
  }

}