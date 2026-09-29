// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI
@_spi(Execution) @_spi(Unsafe) import ApolloAPI

extension API {
  nonisolated struct SyncMutation: GraphQLMutation {
    static let operationName: String = "Sync"
    static let operationDocument: ApolloAPI.OperationDocument = .init(
      definition: .init(
        #"mutation Sync($force: Boolean!) { sync(force: $force) { __typename status syncedAt } }"#
      ))

    public var force: Bool

    public init(force: Bool) {
      self.force = force
    }

    @_spi(Unsafe) public var __variables: Variables? { ["force": force] }

    nonisolated struct Data: API.SelectionSet {
      let __data: DataDict
      init(_dataDict: DataDict) { __data = _dataDict }

      static var __parentType: any ApolloAPI.ParentType { API.Objects.Mutation }
      static var __selections: [ApolloAPI.Selection] { [
        .field("sync", Sync.self, arguments: ["force": .variable("force")]),
      ] }
      static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
        SyncMutation.Data.self
      ] }

      /// Reads SnapTrade unless it was read in the last 15 minutes; `force` skips the cooldown (pull to refresh). Queries never read SnapTrade accounts, so call this when the app opens.
      var sync: Sync { __data["sync"] }

      /// Sync
      ///
      /// Parent Type: `SyncPayload`
      nonisolated struct Sync: API.SelectionSet {
        let __data: DataDict
        init(_dataDict: DataDict) { __data = _dataDict }

        static var __parentType: any ApolloAPI.ParentType { API.Objects.SyncPayload }
        static var __selections: [ApolloAPI.Selection] { [
          .field("__typename", String.self),
          .field("status", GraphQLEnum<API.SyncStatus>.self),
          .field("syncedAt", API.DateTime?.self),
        ] }
        static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
          SyncMutation.Data.Sync.self
        ] }

        var status: GraphQLEnum<API.SyncStatus> { __data["status"] }
        var syncedAt: API.DateTime? { __data["syncedAt"] }
      }
    }
  }

}