// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI
@_spi(Execution) @_spi(Unsafe) import ApolloAPI

extension API {
  nonisolated struct MoveAccountMutation: GraphQLMutation {
    static let operationName: String = "MoveAccount"
    static let operationDocument: ApolloAPI.OperationDocument = .init(
      definition: .init(
        #"mutation MoveAccount($accountId: ID!, $order: RankOrder!, $direction: Direction!) { moveAccount(accountId: $accountId, order: $order, direction: $direction) { __typename id } }"#
      ))

    public var accountId: ID
    public var order: GraphQLEnum<RankOrder>
    public var direction: GraphQLEnum<Direction>

    public init(
      accountId: ID,
      order: GraphQLEnum<RankOrder>,
      direction: GraphQLEnum<Direction>
    ) {
      self.accountId = accountId
      self.order = order
      self.direction = direction
    }

    @_spi(Unsafe) public var __variables: Variables? { [
      "accountId": accountId,
      "order": order,
      "direction": direction
    ] }

    nonisolated struct Data: API.SelectionSet {
      let __data: DataDict
      init(_dataDict: DataDict) { __data = _dataDict }

      static var __parentType: any ApolloAPI.ParentType { API.Objects.Mutation }
      static var __selections: [ApolloAPI.Selection] { [
        .field("moveAccount", MoveAccount.self, arguments: [
          "accountId": .variable("accountId"),
          "order": .variable("order"),
          "direction": .variable("direction")
        ]),
      ] }
      static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
        MoveAccountMutation.Data.self
      ] }

      /// Swaps an account with its neighbour in one of the two orders.
      var moveAccount: MoveAccount { __data["moveAccount"] }

      /// MoveAccount
      ///
      /// Parent Type: `Viewer`
      nonisolated struct MoveAccount: API.SelectionSet {
        let __data: DataDict
        init(_dataDict: DataDict) { __data = _dataDict }

        static var __parentType: any ApolloAPI.ParentType { API.Objects.Viewer }
        static var __selections: [ApolloAPI.Selection] { [
          .field("__typename", String.self),
          .field("id", API.ID.self),
        ] }
        static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
          MoveAccountMutation.Data.MoveAccount.self
        ] }

        var id: API.ID { __data["id"] }
      }
    }
  }

}