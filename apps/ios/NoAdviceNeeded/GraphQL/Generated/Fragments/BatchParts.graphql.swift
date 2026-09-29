// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI
@_spi(Execution) @_spi(Unsafe) import ApolloAPI

extension API {
  nonisolated struct BatchParts: API.SelectionSet, Fragment {
    static var fragmentDefinition: StaticString {
      #"fragment BatchParts on OrderBatch { __typename id kind ticker priceCents requestedCents createdAt orders { __typename id accountName brokerageName side units notionalCents estimatedCents status error brokerageOrderId placedAt } }"#
    }

    let __data: DataDict
    init(_dataDict: DataDict) { __data = _dataDict }

    static var __parentType: any ApolloAPI.ParentType { API.Objects.OrderBatch }
    static var __selections: [ApolloAPI.Selection] { [
      .field("__typename", String.self),
      .field("id", API.ID.self),
      .field("kind", GraphQLEnum<API.OrderBatchKind>.self),
      .field("ticker", String.self),
      .field("priceCents", API.Cents.self),
      .field("requestedCents", API.Cents?.self),
      .field("createdAt", API.DateTime.self),
      .field("orders", [Order].self),
    ] }
    static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
      BatchParts.self
    ] }

    var id: API.ID { __data["id"] }
    var kind: GraphQLEnum<API.OrderBatchKind> { __data["kind"] }
    var ticker: String { __data["ticker"] }
    var priceCents: API.Cents { __data["priceCents"] }
    var requestedCents: API.Cents? { __data["requestedCents"] }
    var createdAt: API.DateTime { __data["createdAt"] }
    var orders: [Order] { __data["orders"] }

    /// Order
    ///
    /// Parent Type: `Order`
    nonisolated struct Order: API.SelectionSet {
      let __data: DataDict
      init(_dataDict: DataDict) { __data = _dataDict }

      static var __parentType: any ApolloAPI.ParentType { API.Objects.Order }
      static var __selections: [ApolloAPI.Selection] { [
        .field("__typename", String.self),
        .field("id", API.ID.self),
        .field("accountName", String.self),
        .field("brokerageName", String.self),
        .field("side", GraphQLEnum<API.OrderSide>.self),
        .field("units", Double.self),
        .field("notionalCents", API.Cents?.self),
        .field("estimatedCents", API.Cents.self),
        .field("status", String.self),
        .field("error", String?.self),
        .field("brokerageOrderId", String?.self),
        .field("placedAt", API.DateTime?.self),
      ] }
      static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
        BatchParts.Order.self
      ] }

      var id: API.ID { __data["id"] }
      var accountName: String { __data["accountName"] }
      var brokerageName: String { __data["brokerageName"] }
      var side: GraphQLEnum<API.OrderSide> { __data["side"] }
      var units: Double { __data["units"] }
      /// The dollar amount sent; null when the order was sized in units.
      var notionalCents: API.Cents? { __data["notionalCents"] }
      var estimatedCents: API.Cents { __data["estimatedCents"] }
      /// SnapTrade's status (PENDING, EXECUTED, ...) or our own: planned, failed.
      var status: String { __data["status"] }
      var error: String? { __data["error"] }
      var brokerageOrderId: String? { __data["brokerageOrderId"] }
      var placedAt: API.DateTime? { __data["placedAt"] }
    }
  }

}