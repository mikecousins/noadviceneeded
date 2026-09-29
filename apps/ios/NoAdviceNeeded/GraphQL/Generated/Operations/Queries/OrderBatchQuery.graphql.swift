// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI
@_spi(Execution) @_spi(Unsafe) import ApolloAPI

extension API {
  nonisolated struct OrderBatchQuery: GraphQLQuery {
    static let operationName: String = "OrderBatch"
    static let operationDocument: ApolloAPI.OperationDocument = .init(
      definition: .init(
        #"query OrderBatch($id: ID!) { viewer { __typename id orderBatch(id: $id) { __typename ...BatchParts } } }"#,
        fragments: [BatchParts.self]
      ))

    public var id: ID

    public init(id: ID) {
      self.id = id
    }

    @_spi(Unsafe) public var __variables: Variables? { ["id": id] }

    nonisolated struct Data: API.SelectionSet {
      let __data: DataDict
      init(_dataDict: DataDict) { __data = _dataDict }

      static var __parentType: any ApolloAPI.ParentType { API.Objects.Query }
      static var __selections: [ApolloAPI.Selection] { [
        .field("viewer", Viewer?.self),
      ] }
      static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
        OrderBatchQuery.Data.self
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
          .field("orderBatch", OrderBatch?.self, arguments: ["id": .variable("id")]),
        ] }
        static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
          OrderBatchQuery.Data.Viewer.self
        ] }

        var id: API.ID { __data["id"] }
        var orderBatch: OrderBatch? { __data["orderBatch"] }

        /// Viewer.OrderBatch
        ///
        /// Parent Type: `OrderBatch`
        nonisolated struct OrderBatch: API.SelectionSet {
          let __data: DataDict
          init(_dataDict: DataDict) { __data = _dataDict }

          static var __parentType: any ApolloAPI.ParentType { API.Objects.OrderBatch }
          static var __selections: [ApolloAPI.Selection] { [
            .field("__typename", String.self),
            .fragment(BatchParts.self),
          ] }
          static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
            OrderBatchQuery.Data.Viewer.OrderBatch.self,
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

}