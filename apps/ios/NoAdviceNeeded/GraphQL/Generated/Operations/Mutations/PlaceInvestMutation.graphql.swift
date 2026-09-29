// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI
@_spi(Execution) @_spi(Unsafe) import ApolloAPI

extension API {
  nonisolated struct PlaceInvestMutation: GraphQLMutation {
    static let operationName: String = "PlaceInvest"
    static let operationDocument: ApolloAPI.OperationDocument = .init(
      definition: .init(
        #"mutation PlaceInvest($priceCents: Cents) { invest(priceCents: $priceCents) { __typename ...BatchParts } }"#,
        fragments: [BatchParts.self]
      ))

    public var priceCents: GraphQLNullable<Cents>

    public init(priceCents: GraphQLNullable<Cents>) {
      self.priceCents = priceCents
    }

    @_spi(Unsafe) public var __variables: Variables? { ["priceCents": priceCents] }

    nonisolated struct Data: API.SelectionSet {
      let __data: DataDict
      init(_dataDict: DataDict) { __data = _dataDict }

      static var __parentType: any ApolloAPI.ParentType { API.Objects.Mutation }
      static var __selections: [ApolloAPI.Selection] { [
        .field("invest", Invest.self, arguments: ["priceCents": .variable("priceCents")]),
      ] }
      static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
        PlaceInvestMutation.Data.self
      ] }

      /// Places the buy plan: one market day order per included account with cash. The plan is rebuilt and re-priced on the server; `priceCents` is the price the user confirmed, used only when no fresher one exists. Refusals come back as errors coded NO_FUND, RECONNECT_REQUIRED, TRADE_SCOPE_MISSING, MARKET_CLOSED, NO_PRICE or NOTHING_TO_TRADE.
      var invest: Invest { __data["invest"] }

      /// Invest
      ///
      /// Parent Type: `OrderBatch`
      nonisolated struct Invest: API.SelectionSet {
        let __data: DataDict
        init(_dataDict: DataDict) { __data = _dataDict }

        static var __parentType: any ApolloAPI.ParentType { API.Objects.OrderBatch }
        static var __selections: [ApolloAPI.Selection] { [
          .field("__typename", String.self),
          .fragment(BatchParts.self),
        ] }
        static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
          PlaceInvestMutation.Data.Invest.self,
          BatchParts.self
        ] }

        var id: API.ID { __data["id"] }
        var kind: GraphQLEnum<API.OrderBatchKind> { __data["kind"] }
        var ticker: String { __data["ticker"] }
        var priceCents: API.Cents { __data["priceCents"] }
        var requestedCents: API.Cents? { __data["requestedCents"] }
        var createdAt: API.DateTime { __data["createdAt"] }
        var orders: [Order] { __data["orders"] }

        struct Fragments: FragmentContainer {
          let __data: DataDict
          init(_dataDict: DataDict) { __data = _dataDict }

          var batchParts: BatchParts { _toFragment() }
        }

        typealias Order = BatchParts.Order
      }
    }
  }

}