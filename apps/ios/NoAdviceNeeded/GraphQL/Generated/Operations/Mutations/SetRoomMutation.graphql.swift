// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI
@_spi(Execution) @_spi(Unsafe) import ApolloAPI

extension API {
  nonisolated struct SetRoomMutation: GraphQLMutation {
    static let operationName: String = "SetRoom"
    static let operationDocument: ApolloAPI.OperationDocument = .init(
      definition: .init(
        #"mutation SetRoom($roomType: RoomType!, $roomCents: Cents!, $asOf: Date!) { setRoom(roomType: $roomType, roomCents: $roomCents, asOf: $asOf) { __typename id } }"#
      ))

    public var roomType: GraphQLEnum<RoomType>
    public var roomCents: Cents
    public var asOf: Date

    public init(
      roomType: GraphQLEnum<RoomType>,
      roomCents: Cents,
      asOf: Date
    ) {
      self.roomType = roomType
      self.roomCents = roomCents
      self.asOf = asOf
    }

    @_spi(Unsafe) public var __variables: Variables? { [
      "roomType": roomType,
      "roomCents": roomCents,
      "asOf": asOf
    ] }

    nonisolated struct Data: API.SelectionSet {
      let __data: DataDict
      init(_dataDict: DataDict) { __data = _dataDict }

      static var __parentType: any ApolloAPI.ParentType { API.Objects.Mutation }
      static var __selections: [ApolloAPI.Selection] { [
        .field("setRoom", SetRoom.self, arguments: [
          "roomType": .variable("roomType"),
          "roomCents": .variable("roomCents"),
          "asOf": .variable("asOf")
        ]),
      ] }
      static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
        SetRoomMutation.Data.self
      ] }

      /// Records a limit's room as of a day. Contributions the brokerage reports after that day come off it.
      var setRoom: SetRoom { __data["setRoom"] }

      /// SetRoom
      ///
      /// Parent Type: `Viewer`
      nonisolated struct SetRoom: API.SelectionSet {
        let __data: DataDict
        init(_dataDict: DataDict) { __data = _dataDict }

        static var __parentType: any ApolloAPI.ParentType { API.Objects.Viewer }
        static var __selections: [ApolloAPI.Selection] { [
          .field("__typename", String.self),
          .field("id", API.ID.self),
        ] }
        static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
          SetRoomMutation.Data.SetRoom.self
        ] }

        var id: API.ID { __data["id"] }
      }
    }
  }

}