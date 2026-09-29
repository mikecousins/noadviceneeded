// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI
@_spi(Execution) @_spi(Unsafe) import ApolloAPI

extension API {
  nonisolated struct FundQuery: GraphQLQuery {
    static let operationName: String = "Fund"
    static let operationDocument: ApolloAPI.OperationDocument = .init(
      definition: .init(
        #"query Fund { viewer { __typename id country fund { __typename ticker name } fundChoices { __typename ticker name provider equityPercent } accounts { __typename id connectionStatus } } }"#
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
        FundQuery.Data.self
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
          .field("fund", Fund?.self),
          .field("fundChoices", [FundChoice].self),
          .field("accounts", [Account].self),
        ] }
        static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
          FundQuery.Data.Viewer.self
        ] }

        var id: API.ID { __data["id"] }
        /// Where the user invests. Canada until they choose.
        var country: GraphQLEnum<API.Country> { __data["country"] }
        var fund: Fund? { __data["fund"] }
        /// The curated all-in-one ETFs for the user's country.
        var fundChoices: [FundChoice] { __data["fundChoices"] }
        /// Every account. Pass `order` to list them in one of the two plan orders.
        var accounts: [Account] { __data["accounts"] }

        /// Viewer.Fund
        ///
        /// Parent Type: `Fund`
        nonisolated struct Fund: API.SelectionSet {
          let __data: DataDict
          init(_dataDict: DataDict) { __data = _dataDict }

          static var __parentType: any ApolloAPI.ParentType { API.Objects.Fund }
          static var __selections: [ApolloAPI.Selection] { [
            .field("__typename", String.self),
            .field("ticker", String.self),
            .field("name", String?.self),
          ] }
          static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
            FundQuery.Data.Viewer.Fund.self
          ] }

          var ticker: String { __data["ticker"] }
          var name: String? { __data["name"] }
        }

        /// Viewer.FundChoice
        ///
        /// Parent Type: `AllInOneEtf`
        nonisolated struct FundChoice: API.SelectionSet {
          let __data: DataDict
          init(_dataDict: DataDict) { __data = _dataDict }

          static var __parentType: any ApolloAPI.ParentType { API.Objects.AllInOneEtf }
          static var __selections: [ApolloAPI.Selection] { [
            .field("__typename", String.self),
            .field("ticker", String.self),
            .field("name", String.self),
            .field("provider", String.self),
            .field("equityPercent", Int.self),
          ] }
          static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
            FundQuery.Data.Viewer.FundChoice.self
          ] }

          var ticker: String { __data["ticker"] }
          var name: String { __data["name"] }
          var provider: String { __data["provider"] }
          var equityPercent: Int { __data["equityPercent"] }
        }

        /// Viewer.Account
        ///
        /// Parent Type: `Account`
        nonisolated struct Account: API.SelectionSet {
          let __data: DataDict
          init(_dataDict: DataDict) { __data = _dataDict }

          static var __parentType: any ApolloAPI.ParentType { API.Objects.Account }
          static var __selections: [ApolloAPI.Selection] { [
            .field("__typename", String.self),
            .field("id", API.ID.self),
            .field("connectionStatus", GraphQLEnum<API.ConnectionStatus>.self),
          ] }
          static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
            FundQuery.Data.Viewer.Account.self
          ] }

          var id: API.ID { __data["id"] }
          var connectionStatus: GraphQLEnum<API.ConnectionStatus> { __data["connectionStatus"] }
        }
      }
    }
  }

}