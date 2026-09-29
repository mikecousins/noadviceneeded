// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI
@_spi(Execution) @_spi(Unsafe) import ApolloAPI

extension API {
  nonisolated struct PlaceWithdrawMutation: GraphQLMutation {
    static let operationName: String = "PlaceWithdraw"
    static let operationDocument: ApolloAPI.OperationDocument = .init(
      definition: .init(
        #"mutation PlaceWithdraw($amountCents: Cents!, $priceCents: Cents) { withdraw(amountCents: $amountCents, priceCents: $priceCents) { __typename ...BatchParts } }"#,
        fragments: [BatchParts.self]
      ))

    public var amountCents: Cents
    public var priceCents: GraphQLNullable<Cents>

    public init(
      amountCents: Cents,
      priceCents: GraphQLNullable<Cents>
    ) {
      self.amountCents = amountCents
      self.priceCents = priceCents
    }

    @_spi(Unsafe) public var __variables: Variables? { [
      "amountCents": amountCents,
      "priceCents": priceCents
    ] }

    nonisolated struct Data: API.SelectionSet {
      let __data: DataDict
      init(_dataDict: DataDict) { __data = _dataDict }

      static var __parentType: any ApolloAPI.ParentType { API.Objects.Mutation }
      static var __selections: [ApolloAPI.Selection] { [
        .field("withdraw", Withdraw.self, arguments: [
          "amountCents": .variable("amountCents"),
          "priceCents": .variable("priceCents")
        ]),
      ] }
      static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
        PlaceWithdrawMutation.Data.self
      ] }

      /// Places the sell plan for `amountCents`, in withdrawal order. Same refusals as `invest`.
      var withdraw: Withdraw { __data["withdraw"] }

      /// Withdraw
      ///
      /// Parent Type: `OrderBatch`
      nonisolated struct Withdraw: API.SelectionSet {
        let __data: DataDict
        init(_dataDict: DataDict) { __data = _dataDict }

        static var __parentType: any ApolloAPI.ParentType { API.Objects.OrderBatch }
        static var __selections: [ApolloAPI.Selection] { [
          .field("__typename", String.self),
          .fragment(BatchParts.self),
        ] }
        static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
          PlaceWithdrawMutation.Data.Withdraw.self,
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