// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI
@_spi(Execution) @_spi(Unsafe) import ApolloAPI

extension API {
  nonisolated struct ClearRoomMutation: GraphQLMutation {
    static let operationName: String = "ClearRoom"
    static let operationDocument: ApolloAPI.OperationDocument = .init(
      definition: .init(
        #"mutation ClearRoom($roomType: RoomType!) { clearRoom(roomType: $roomType) { __typename id } }"#
      ))

    public var roomType: GraphQLEnum<RoomType>

    public init(roomType: GraphQLEnum<RoomType>) {
      self.roomType = roomType
    }

    @_spi(Unsafe) public var __variables: Variables? { ["roomType": roomType] }

    nonisolated struct Data: API.SelectionSet {
      let __data: DataDict
      init(_dataDict: DataDict) { __data = _dataDict }

      static var __parentType: any ApolloAPI.ParentType { API.Objects.Mutation }
      static var __selections: [ApolloAPI.Selection] { [
        .field("clearRoom", ClearRoom.self, arguments: ["roomType": .variable("roomType")]),
      ] }
      static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
        ClearRoomMutation.Data.self
      ] }

      var clearRoom: ClearRoom { __data["clearRoom"] }

      /// ClearRoom
      ///
      /// Parent Type: `Viewer`
      nonisolated struct ClearRoom: API.SelectionSet {
        let __data: DataDict
        init(_dataDict: DataDict) { __data = _dataDict }

        static var __parentType: any ApolloAPI.ParentType { API.Objects.Viewer }
        static var __selections: [ApolloAPI.Selection] { [
          .field("__typename", String.self),
          .field("id", API.ID.self),
        ] }
        static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
          ClearRoomMutation.Data.ClearRoom.self
        ] }

        var id: API.ID { __data["id"] }
      }
    }
  }

}