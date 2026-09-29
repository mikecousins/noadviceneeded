// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI
@_spi(Execution) @_spi(Unsafe) import ApolloAPI

extension API {
  nonisolated struct RoomQuery: GraphQLQuery {
    static let operationName: String = "Room"
    static let operationDocument: ApolloAPI.OperationDocument = .init(
      definition: .init(
        #"query Room { viewer { __typename id country room { __typename roomType label note asOf baselineCents contributedSinceCents remainingCents accountCount } roomActivities { __typename id tradeDate accountName accountType typeLabel type description amountCents } } }"#
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
        RoomQuery.Data.self
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
          .field("country", GraphQLEnum<API.Country>.self),
          .field("room", [Room].self),
          .field("roomActivities", [RoomActivity].self),
        ] }
        static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
          RoomQuery.Data.Viewer.self
        ] }

        var id: API.ID { __data["id"] }
        /// Where the user invests. Canada until they choose.
        var country: GraphQLEnum<API.Country> { __data["country"] }
        var room: [Room] { __data["room"] }
        /// Contributions and withdrawals in registered accounts, newest first.
        var roomActivities: [RoomActivity] { __data["roomActivities"] }

        /// Viewer.Room
        ///
        /// Parent Type: `RoomLimit`
        nonisolated struct Room: API.SelectionSet {
          let __data: DataDict
          init(_dataDict: DataDict) { __data = _dataDict }

          static var __parentType: any ApolloAPI.ParentType { API.Objects.RoomLimit }
          static var __selections: [ApolloAPI.Selection] { [
            .field("__typename", String.self),
            .field("roomType", GraphQLEnum<API.RoomType>.self),
            .field("label", String.self),
            .field("note", String.self),
            .field("asOf", API.Date?.self),
            .field("baselineCents", API.Cents?.self),
            .field("contributedSinceCents", API.Cents.self),
            .field("remainingCents", API.Cents?.self),
            .field("accountCount", Int.self),
          ] }
          static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
            RoomQuery.Data.Viewer.Room.self
          ] }

          var roomType: GraphQLEnum<API.RoomType> { __data["roomType"] }
          var label: String { __data["label"] }
          var note: String { __data["note"] }
          var asOf: API.Date? { __data["asOf"] }
          var baselineCents: API.Cents? { __data["baselineCents"] }
          var contributedSinceCents: API.Cents { __data["contributedSinceCents"] }
          var remainingCents: API.Cents? { __data["remainingCents"] }
          var accountCount: Int { __data["accountCount"] }
        }

        /// Viewer.RoomActivity
        ///
        /// Parent Type: `RoomActivity`
        nonisolated struct RoomActivity: API.SelectionSet {
          let __data: DataDict
          init(_dataDict: DataDict) { __data = _dataDict }

          static var __parentType: any ApolloAPI.ParentType { API.Objects.RoomActivity }
          static var __selections: [ApolloAPI.Selection] { [
            .field("__typename", String.self),
            .field("id", API.ID.self),
            .field("tradeDate", API.Date.self),
            .field("accountName", String.self),
            .field("accountType", GraphQLEnum<API.AccountType>.self),
            .field("typeLabel", String.self),
            .field("type", String.self),
            .field("description", String?.self),
            .field("amountCents", API.Cents.self),
          ] }
          static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
            RoomQuery.Data.Viewer.RoomActivity.self
          ] }

          var id: API.ID { __data["id"] }
          var tradeDate: API.Date { __data["tradeDate"] }
          var accountName: String { __data["accountName"] }
          var accountType: GraphQLEnum<API.AccountType> { __data["accountType"] }
          var typeLabel: String { __data["typeLabel"] }
          /// CONTRIBUTION or WITHDRAWAL.
          var type: String { __data["type"] }
          var description: String? { __data["description"] }
          var amountCents: API.Cents { __data["amountCents"] }
        }
      }
    }
  }

}