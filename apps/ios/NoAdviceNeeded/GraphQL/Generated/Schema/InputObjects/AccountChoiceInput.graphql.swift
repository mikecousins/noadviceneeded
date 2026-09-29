// @generated
// This file was automatically generated and should not be edited.

@_spi(Internal) @_spi(Unsafe) import ApolloAPI

extension API {
  /// The user's answers for one account on the Accounts screen.
  nonisolated struct AccountChoiceInput: InputObject {
    private(set) var __data: InputDict

    init(_ data: InputDict) {
      __data = data
    }

    init(
      accountId: ID,
      accountType: GraphQLEnum<AccountType>,
      fractional: Bool,
      included: Bool
    ) {
      __data = InputDict([
        "accountId": accountId,
        "accountType": accountType,
        "fractional": fractional,
        "included": included
      ])
    }

    var accountId: ID {
      get { __data["accountId"] }
      set { __data["accountId"] = newValue }
    }

    var accountType: GraphQLEnum<AccountType> {
      get { __data["accountType"] }
      set { __data["accountType"] = newValue }
    }

    var fractional: Bool {
      get { __data["fractional"] }
      set { __data["fractional"] = newValue }
    }

    var included: Bool {
      get { __data["included"] }
      set { __data["included"] = newValue }
    }
  }

}