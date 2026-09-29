// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI
@_spi(Execution) @_spi(Unsafe) import ApolloAPI

extension API {
  nonisolated struct UpdateAccountsMutation: GraphQLMutation {
    static let operationName: String = "UpdateAccounts"
    static let operationDocument: ApolloAPI.OperationDocument = .init(
      definition: .init(
        #"mutation UpdateAccounts($accounts: [AccountChoiceInput!]!) { updateAccounts(accounts: $accounts) { __typename changed } }"#
      ))

    public var accounts: [AccountChoiceInput]

    public init(accounts: [AccountChoiceInput]) {
      self.accounts = accounts
    }

    @_spi(Unsafe) public var __variables: Variables? { ["accounts": accounts] }

    nonisolated struct Data: API.SelectionSet {
      let __data: DataDict
      init(_dataDict: DataDict) { __data = _dataDict }

      static var __parentType: any ApolloAPI.ParentType { API.Objects.Mutation }
      static var __selections: [ApolloAPI.Selection] { [
        .field("updateAccounts", UpdateAccounts.self, arguments: ["accounts": .variable("accounts")]),
      ] }
      static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
        UpdateAccountsMutation.Data.self
      ] }

      var updateAccounts: UpdateAccounts { __data["updateAccounts"] }

      /// UpdateAccounts
      ///
      /// Parent Type: `AccountsPayload`
      nonisolated struct UpdateAccounts: API.SelectionSet {
        let __data: DataDict
        init(_dataDict: DataDict) { __data = _dataDict }

        static var __parentType: any ApolloAPI.ParentType { API.Objects.AccountsPayload }
        static var __selections: [ApolloAPI.Selection] { [
          .field("__typename", String.self),
          .field("changed", Int.self),
        ] }
        static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
          UpdateAccountsMutation.Data.UpdateAccounts.self
        ] }

        /// Accounts written; unknown ids are ignored.
        var changed: Int { __data["changed"] }
      }
    }
  }

}