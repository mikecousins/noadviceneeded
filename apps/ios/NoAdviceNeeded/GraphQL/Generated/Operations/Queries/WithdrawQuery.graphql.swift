// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI
@_spi(Execution) @_spi(Unsafe) import ApolloAPI

extension API {
  nonisolated struct WithdrawQuery: GraphQLQuery {
    static let operationName: String = "Withdraw"
    static let operationDocument: ApolloAPI.OperationDocument = .init(
      definition: .init(
        #"query Withdraw($amountCents: Cents!, $manualPriceCents: Cents, $planned: Boolean!) { viewer { __typename id tradeScope homeCurrency fund { __typename ticker name } market { __typename ...MarketParts } quote(manualPriceCents: $manualPriceCents) { __typename priceCents source asOf sellableCents sellPlan(amountCents: $amountCents) @include(if: $planned) { __typename requestedCents shortfallCents totalProceedsCents totalUnits legs { __typename units notionalCents estimatedProceedsCents account { __typename ...AccountLine withdrawalNote } } skipped { __typename reason account { __typename ...AccountLine } } } } } }"#,
        fragments: [AccountLine.self, MarketParts.self]
      ))

    public var amountCents: Cents
    public var manualPriceCents: GraphQLNullable<Cents>
    public var planned: Bool

    public init(
      amountCents: Cents,
      manualPriceCents: GraphQLNullable<Cents>,
      planned: Bool
    ) {
      self.amountCents = amountCents
      self.manualPriceCents = manualPriceCents
      self.planned = planned
    }

    @_spi(Unsafe) public var __variables: Variables? { [
      "amountCents": amountCents,
      "manualPriceCents": manualPriceCents,
      "planned": planned
    ] }

    nonisolated struct Data: API.SelectionSet {
      let __data: DataDict
      init(_dataDict: DataDict) { __data = _dataDict }

      static var __parentType: any ApolloAPI.ParentType { API.Objects.Query }
      static var __selections: [ApolloAPI.Selection] { [
        .field("viewer", Viewer?.self),
      ] }
      static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
        WithdrawQuery.Data.self
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
          .field("tradeScope", Bool.self),
          .field("homeCurrency", String.self),
          .field("fund", Fund?.self),
          .field("market", Market.self),
          .field("quote", Quote?.self, arguments: ["manualPriceCents": .variable("manualPriceCents")]),
        ] }
        static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
          WithdrawQuery.Data.Viewer.self
        ] }

        var id: API.ID { __data["id"] }
        /// The SnapTrade grant carries `trade`. Until then everything is read-only.
        var tradeScope: Bool { __data["tradeScope"] }
        var homeCurrency: String { __data["homeCurrency"] }
        var fund: Fund? { __data["fund"] }
        var market: Market { __data["market"] }
        /// The price to size plans at. Null with no fund chosen or no price anywhere; then ask for `manualPriceCents`. May read a brokerage quote.
        var quote: Quote? { __data["quote"] }

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
            WithdrawQuery.Data.Viewer.Fund.self
          ] }

          var ticker: String { __data["ticker"] }
          var name: String? { __data["name"] }
        }

        /// Viewer.Market
        ///
        /// Parent Type: `Market`
        nonisolated struct Market: API.SelectionSet {
          let __data: DataDict
          init(_dataDict: DataDict) { __data = _dataDict }

          static var __parentType: any ApolloAPI.ParentType { API.Objects.Market }
          static var __selections: [ApolloAPI.Selection] { [
            .field("__typename", String.self),
            .fragment(MarketParts.self),
          ] }
          static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
            WithdrawQuery.Data.Viewer.Market.self,
            MarketParts.self
          ] }

          var open: Bool { __data["open"] }
          /// Why orders are off and when they come back; null while open.
          var closedMessage: String? { __data["closedMessage"] }
          var nextOpen: API.DateTime { __data["nextOpen"] }

          struct Fragments: FragmentContainer {
            let __data: DataDict
            init(_dataDict: DataDict) { __data = _dataDict }

            var marketParts: MarketParts { _toFragment() }
          }
        }

        /// Viewer.Quote
        ///
        /// Parent Type: `Quote`
        nonisolated struct Quote: API.SelectionSet {
          let __data: DataDict
          init(_dataDict: DataDict) { __data = _dataDict }

          static var __parentType: any ApolloAPI.ParentType { API.Objects.Quote }
          static var __selections: [ApolloAPI.Selection] { [
            .field("__typename", String.self),
            .field("priceCents", API.Cents.self),
            .field("source", GraphQLEnum<API.PriceSource>.self),
            .field("asOf", API.DateTime?.self),
            .field("sellableCents", API.Cents.self),
            .include(if: "planned", .field("sellPlan", SellPlan.self, arguments: ["amountCents": .variable("amountCents")])),
          ] }
          static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
            WithdrawQuery.Data.Viewer.Quote.self
          ] }

          var priceCents: API.Cents { __data["priceCents"] }
          var source: GraphQLEnum<API.PriceSource> { __data["source"] }
          var asOf: API.DateTime? { __data["asOf"] }
          /// The most a withdrawal could raise across included accounts at this price.
          var sellableCents: API.Cents { __data["sellableCents"] }
          var sellPlan: SellPlan? { __data["sellPlan"] }

          /// Viewer.Quote.SellPlan
          ///
          /// Parent Type: `SellPlan`
          nonisolated struct SellPlan: API.SelectionSet {
            let __data: DataDict
            init(_dataDict: DataDict) { __data = _dataDict }

            static var __parentType: any ApolloAPI.ParentType { API.Objects.SellPlan }
            static var __selections: [ApolloAPI.Selection] { [
              .field("__typename", String.self),
              .field("requestedCents", API.Cents.self),
              .field("shortfallCents", API.Cents.self),
              .field("totalProceedsCents", API.Cents.self),
              .field("totalUnits", Double.self),
              .field("legs", [Leg].self),
              .field("skipped", [Skipped].self),
            ] }
            static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
              WithdrawQuery.Data.Viewer.Quote.SellPlan.self
            ] }

            var requestedCents: API.Cents { __data["requestedCents"] }
            /// How much of the request no account can cover.
            var shortfallCents: API.Cents { __data["shortfallCents"] }
            var totalProceedsCents: API.Cents { __data["totalProceedsCents"] }
            var totalUnits: Double { __data["totalUnits"] }
            var legs: [Leg] { __data["legs"] }
            var skipped: [Skipped] { __data["skipped"] }

            /// Viewer.Quote.SellPlan.Leg
            ///
            /// Parent Type: `SellLeg`
            nonisolated struct Leg: API.SelectionSet {
              let __data: DataDict
              init(_dataDict: DataDict) { __data = _dataDict }

              static var __parentType: any ApolloAPI.ParentType { API.Objects.SellLeg }
              static var __selections: [ApolloAPI.Selection] { [
                .field("__typename", String.self),
                .field("units", Double.self),
                .field("notionalCents", API.Cents?.self),
                .field("estimatedProceedsCents", API.Cents.self),
                .field("account", Account.self),
              ] }
              static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
                WithdrawQuery.Data.Viewer.Quote.SellPlan.Leg.self
              ] }

              var units: Double { __data["units"] }
              var notionalCents: API.Cents? { __data["notionalCents"] }
              var estimatedProceedsCents: API.Cents { __data["estimatedProceedsCents"] }
              var account: Account { __data["account"] }

              /// Viewer.Quote.SellPlan.Leg.Account
              ///
              /// Parent Type: `Account`
              nonisolated struct Account: API.SelectionSet {
                let __data: DataDict
                init(_dataDict: DataDict) { __data = _dataDict }

                static var __parentType: any ApolloAPI.ParentType { API.Objects.Account }
                static var __selections: [ApolloAPI.Selection] { [
                  .field("__typename", String.self),
                  .field("withdrawalNote", String.self),
                  .fragment(AccountLine.self),
                ] }
                static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
                  WithdrawQuery.Data.Viewer.Quote.SellPlan.Leg.Account.self,
                  AccountLine.self
                ] }

                var withdrawalNote: String { __data["withdrawalNote"] }
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

            /// Viewer.Quote.SellPlan.Skipped
            ///
            /// Parent Type: `SellSkip`
            nonisolated struct Skipped: API.SelectionSet {
              let __data: DataDict
              init(_dataDict: DataDict) { __data = _dataDict }

              static var __parentType: any ApolloAPI.ParentType { API.Objects.SellSkip }
              static var __selections: [ApolloAPI.Selection] { [
                .field("__typename", String.self),
                .field("reason", GraphQLEnum<API.SellSkipReason>.self),
                .field("account", Account.self),
              ] }
              static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
                WithdrawQuery.Data.Viewer.Quote.SellPlan.Skipped.self
              ] }

              var reason: GraphQLEnum<API.SellSkipReason> { __data["reason"] }
              var account: Account { __data["account"] }

              /// Viewer.Quote.SellPlan.Skipped.Account
              ///
              /// Parent Type: `Account`
              nonisolated struct Account: API.SelectionSet {
                let __data: DataDict
                init(_dataDict: DataDict) { __data = _dataDict }

                static var __parentType: any ApolloAPI.ParentType { API.Objects.Account }
                static var __selections: [ApolloAPI.Selection] { [
                  .field("__typename", String.self),
                  .fragment(AccountLine.self),
                ] }
                static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
                  WithdrawQuery.Data.Viewer.Quote.SellPlan.Skipped.Account.self,
                  AccountLine.self
                ] }

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
    }
  }

}