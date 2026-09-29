// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI
@_spi(Execution) @_spi(Unsafe) import ApolloAPI

extension API {
  nonisolated struct AccountsQuery: GraphQLQuery {
    static let operationName: String = "Accounts"
    static let operationDocument: ApolloAPI.OperationDocument = .init(
      definition: .init(
        #"query Accounts { viewer { __typename id country accounts { __typename ...AccountLine rawType included fractional contributionRank withdrawalRank contributionNote withdrawalNote valueCents cashCents currency connectionStatus connectionCanTrade } } }"#,
        fragments: [AccountLine.self]
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
        AccountsQuery.Data.self
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
          .field("accounts", [Account].self),
        ] }
        static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
          AccountsQuery.Data.Viewer.self
        ] }

        var id: API.ID { __data["id"] }
        /// Where the user invests. Canada until they choose.
        var country: GraphQLEnum<API.Country> { __data["country"] }
        /// Every account. Pass `order` to list them in one of the two plan orders.
        var accounts: [Account] { __data["accounts"] }

        /// Viewer.Account
        ///
        /// Parent Type: `Account`
        nonisolated struct Account: API.SelectionSet {
          let __data: DataDict
          init(_dataDict: DataDict) { __data = _dataDict }

          static var __parentType: any ApolloAPI.ParentType { API.Objects.Account }
          static var __selections: [ApolloAPI.Selection] { [
            .field("__typename", String.self),
            .field("rawType", String?.self),
            .field("included", Bool.self),
            .field("fractional", Bool.self),
            .field("contributionRank", Int.self),
            .field("withdrawalRank", Int.self),
            .field("contributionNote", String.self),
            .field("withdrawalNote", String.self),
            .field("valueCents", API.Cents?.self),
            .field("cashCents", API.Cents?.self),
            .field("currency", String.self),
            .field("connectionStatus", GraphQLEnum<API.ConnectionStatus>.self),
            .field("connectionCanTrade", Bool.self),
            .fragment(AccountLine.self),
          ] }
          static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
            AccountsQuery.Data.Viewer.Account.self,
            AccountLine.self
          ] }

          /// The brokerage's own type string, before classification.
          var rawType: String? { __data["rawType"] }
          /// Part of the buy and sell plans.
          var included: Bool { __data["included"] }
          /// Orders here are sized as a dollar amount instead of whole units (D-016).
          var fractional: Bool { __data["fractional"] }
          var contributionRank: Int { __data["contributionRank"] }
          var withdrawalRank: Int { __data["withdrawalRank"] }
          var contributionNote: String { __data["contributionNote"] }
          var withdrawalNote: String { __data["withdrawalNote"] }
          var valueCents: API.Cents? { __data["valueCents"] }
          /// Cash in the fund's currency; null when SnapTrade sent none.
          var cashCents: API.Cents? { __data["cashCents"] }
          var currency: String { __data["currency"] }
          var connectionStatus: GraphQLEnum<API.ConnectionStatus> { __data["connectionStatus"] }
          /// The brokerage login allows trading, whatever the token's scope.
          var connectionCanTrade: Bool { __data["connectionCanTrade"] }
          var id: API.ID { __data["id"] }
          var name: String { __data["name"] }
          var numberMasked: String { __data["numberMasked"] }
          var brokerageName: String { __data["brokerageName"] }
          var accountType: GraphQLEnum<API.AccountType> { __data["accountType"] }
          var typeLabel: String { __data["typeLabel"] }

          struct Fragments: FragmentContainer {
            let __data: DataDict
            init(_dataDict: DataDict) { __data = _dataDict }

            var accountLine: AccountLine { _toFragment() }
          }
        }
      }
    }
  }

}