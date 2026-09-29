// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI
@_spi(Execution) @_spi(Unsafe) import ApolloAPI

extension API {
  nonisolated struct ChooseFundMutation: GraphQLMutation {
    static let operationName: String = "ChooseFund"
    static let operationDocument: ApolloAPI.OperationDocument = .init(
      definition: .init(
        #"mutation ChooseFund($ticker: String!) { chooseFund(ticker: $ticker) { __typename id fund { __typename ticker } } }"#
      ))

    public var ticker: String

    public init(ticker: String) {
      self.ticker = ticker
    }

    @_spi(Unsafe) public var __variables: Variables? { ["ticker": ticker] }

    nonisolated struct Data: API.SelectionSet {
      let __data: DataDict
      init(_dataDict: DataDict) { __data = _dataDict }

      static var __parentType: any ApolloAPI.ParentType { API.Objects.Mutation }
      static var __selections: [ApolloAPI.Selection] { [
        .field("chooseFund", ChooseFund.self, arguments: ["ticker": .variable("ticker")]),
      ] }
      static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
        ChooseFundMutation.Data.self
      ] }

      /// Chooses the fund by ticker (a curated `AllInOneEtf.ticker`, or any other).
      var chooseFund: ChooseFund { __data["chooseFund"] }

      /// ChooseFund
      ///
      /// Parent Type: `Viewer`
      nonisolated struct ChooseFund: API.SelectionSet {
        let __data: DataDict
        init(_dataDict: DataDict) { __data = _dataDict }

        static var __parentType: any ApolloAPI.ParentType { API.Objects.Viewer }
        static var __selections: [ApolloAPI.Selection] { [
          .field("__typename", String.self),
          .field("id", API.ID.self),
          .field("fund", Fund?.self),
        ] }
        static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
          ChooseFundMutation.Data.ChooseFund.self
        ] }

        var id: API.ID { __data["id"] }
        var fund: Fund? { __data["fund"] }

        /// ChooseFund.Fund
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
            ChooseFundMutation.Data.ChooseFund.Fund.self
          ] }

          var ticker: String { __data["ticker"] }
        }
      }
    }
  }

}