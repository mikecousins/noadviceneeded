// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI
@_spi(Execution) @_spi(Unsafe) import ApolloAPI

extension API {
  nonisolated struct HomeQuery: GraphQLQuery {
    static let operationName: String = "Home"
    static let operationDocument: ApolloAPI.OperationDocument = .init(
      definition: .init(
        #"query Home { viewer { __typename id country homeCurrency lastSyncedAt fund { __typename ticker name } portfolio { __typename accountCount includedCount totalValueCents cashCents heldValueCents unitsHeld ready { __typename legs units } } accounts(order: CONTRIBUTION) { __typename ...AccountLine included canTrade valueCents cashCents positionUnits } nextDeposit { __typename accountType roomCents account { __typename ...AccountLine roomType } } room { __typename roomType label remainingCents baselineCents accountCount } } }"#,
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
        HomeQuery.Data.self
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
          .field("homeCurrency", String.self),
          .field("lastSyncedAt", API.DateTime?.self),
          .field("fund", Fund?.self),
          .field("portfolio", Portfolio.self),
          .field("accounts", [Account].self, arguments: ["order": "CONTRIBUTION"]),
          .field("nextDeposit", NextDeposit?.self),
          .field("room", [Room].self),
        ] }
        static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
          HomeQuery.Data.Viewer.self
        ] }

        var id: API.ID { __data["id"] }
        /// Where the user invests. Canada until they choose.
        var country: GraphQLEnum<API.Country> { __data["country"] }
        var homeCurrency: String { __data["homeCurrency"] }
        var lastSyncedAt: API.DateTime? { __data["lastSyncedAt"] }
        var fund: Fund? { __data["fund"] }
        var portfolio: Portfolio { __data["portfolio"] }
        /// Every account. Pass `order` to list them in one of the two plan orders.
        var accounts: [Account] { __data["accounts"] }
        /// The first included account in contribution order whose limit has room.
        var nextDeposit: NextDeposit? { __data["nextDeposit"] }
        var room: [Room] { __data["room"] }

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
            HomeQuery.Data.Viewer.Fund.self
          ] }

          var ticker: String { __data["ticker"] }
          var name: String? { __data["name"] }
        }

        /// Viewer.Portfolio
        ///
        /// Parent Type: `Portfolio`
        nonisolated struct Portfolio: API.SelectionSet {
          let __data: DataDict
          init(_dataDict: DataDict) { __data = _dataDict }

          static var __parentType: any ApolloAPI.ParentType { API.Objects.Portfolio }
          static var __selections: [ApolloAPI.Selection] { [
            .field("__typename", String.self),
            .field("accountCount", Int.self),
            .field("includedCount", Int.self),
            .field("totalValueCents", API.Cents?.self),
            .field("cashCents", API.Cents?.self),
            .field("heldValueCents", API.Cents?.self),
            .field("unitsHeld", Double.self),
            .field("ready", Ready?.self),
          ] }
          static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
            HomeQuery.Data.Viewer.Portfolio.self
          ] }

          var accountCount: Int { __data["accountCount"] }
          var includedCount: Int { __data["includedCount"] }
          var totalValueCents: API.Cents? { __data["totalValueCents"] }
          var cashCents: API.Cents? { __data["cashCents"] }
          var heldValueCents: API.Cents? { __data["heldValueCents"] }
          var unitsHeld: Double { __data["unitsHeld"] }
          var ready: Ready? { __data["ready"] }

          /// Viewer.Portfolio.Ready
          ///
          /// Parent Type: `ReadyToInvest`
          nonisolated struct Ready: API.SelectionSet {
            let __data: DataDict
            init(_dataDict: DataDict) { __data = _dataDict }

            static var __parentType: any ApolloAPI.ParentType { API.Objects.ReadyToInvest }
            static var __selections: [ApolloAPI.Selection] { [
              .field("__typename", String.self),
              .field("legs", Int.self),
              .field("units", Double.self),
            ] }
            static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
              HomeQuery.Data.Viewer.Portfolio.Ready.self
            ] }

            var legs: Int { __data["legs"] }
            var units: Double { __data["units"] }
          }
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
            .field("included", Bool.self),
            .field("canTrade", Bool.self),
            .field("valueCents", API.Cents?.self),
            .field("cashCents", API.Cents?.self),
            .field("positionUnits", Double.self),
            .fragment(AccountLine.self),
          ] }
          static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
            HomeQuery.Data.Viewer.Account.self,
            AccountLine.self
          ] }

          /// Part of the buy and sell plans.
          var included: Bool { __data["included"] }
          /// Open, active, trading-capable, and the token carries `trade`.
          var canTrade: Bool { __data["canTrade"] }
          var valueCents: API.Cents? { __data["valueCents"] }
          /// Cash in the fund's currency; null when SnapTrade sent none.
          var cashCents: API.Cents? { __data["cashCents"] }
          /// Units of the fund held here.
          var positionUnits: Double { __data["positionUnits"] }
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

        /// Viewer.NextDeposit
        ///
        /// Parent Type: `DepositSuggestion`
        nonisolated struct NextDeposit: API.SelectionSet {
          let __data: DataDict
          init(_dataDict: DataDict) { __data = _dataDict }

          static var __parentType: any ApolloAPI.ParentType { API.Objects.DepositSuggestion }
          static var __selections: [ApolloAPI.Selection] { [
            .field("__typename", String.self),
            .field("accountType", GraphQLEnum<API.AccountType>.self),
            .field("roomCents", API.Cents?.self),
            .field("account", Account.self),
          ] }
          static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
            HomeQuery.Data.Viewer.NextDeposit.self
          ] }

          var accountType: GraphQLEnum<API.AccountType> { __data["accountType"] }
          /// Room left in its limit; null for no limit or no baseline entered.
          var roomCents: API.Cents? { __data["roomCents"] }
          var account: Account { __data["account"] }

          /// Viewer.NextDeposit.Account
          ///
          /// Parent Type: `Account`
          nonisolated struct Account: API.SelectionSet {
            let __data: DataDict
            init(_dataDict: DataDict) { __data = _dataDict }

            static var __parentType: any ApolloAPI.ParentType { API.Objects.Account }
            static var __selections: [ApolloAPI.Selection] { [
              .field("__typename", String.self),
              .field("roomType", GraphQLEnum<API.RoomType>?.self),
              .fragment(AccountLine.self),
            ] }
            static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
              HomeQuery.Data.Viewer.NextDeposit.Account.self,
              AccountLine.self
            ] }

            /// The limit this account's contributions count against, if any.
            var roomType: GraphQLEnum<API.RoomType>? { __data["roomType"] }
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
            .field("remainingCents", API.Cents?.self),
            .field("baselineCents", API.Cents?.self),
            .field("accountCount", Int.self),
          ] }
          static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
            HomeQuery.Data.Viewer.Room.self
          ] }

          var roomType: GraphQLEnum<API.RoomType> { __data["roomType"] }
          var label: String { __data["label"] }
          var remainingCents: API.Cents? { __data["remainingCents"] }
          var baselineCents: API.Cents? { __data["baselineCents"] }
          var accountCount: Int { __data["accountCount"] }
        }
      }
    }
  }

}