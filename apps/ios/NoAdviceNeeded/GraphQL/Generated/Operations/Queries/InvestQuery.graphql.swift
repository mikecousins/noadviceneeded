// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI
@_spi(Execution) @_spi(Unsafe) import ApolloAPI

extension API {
  nonisolated struct InvestQuery: GraphQLQuery {
    static let operationName: String = "Invest"
    static let operationDocument: ApolloAPI.OperationDocument = .init(
      definition: .init(
        #"query Invest($manualPriceCents: Cents) { viewer { __typename id tradeScope fund { __typename ticker name } market { __typename ...MarketParts } quote(manualPriceCents: $manualPriceCents) { __typename priceCents source asOf buyPlan { __typename totalCashCents totalCostCents totalUnits legs { __typename units notionalCents estimatedCostCents account { __typename ...AccountLine cashCents } } skipped { __typename reason account { __typename ...AccountLine cashCents } } } } } }"#,
        fragments: [AccountLine.self, MarketParts.self]
      ))

    public var manualPriceCents: GraphQLNullable<Cents>

    public init(manualPriceCents: GraphQLNullable<Cents>) {
      self.manualPriceCents = manualPriceCents
    }

    @_spi(Unsafe) public var __variables: Variables? { ["manualPriceCents": manualPriceCents] }

    nonisolated struct Data: API.SelectionSet {
      let __data: DataDict
      init(_dataDict: DataDict) { __data = _dataDict }

      static var __parentType: any ApolloAPI.ParentType { API.Objects.Query }
      static var __selections: [ApolloAPI.Selection] { [
        .field("viewer", Viewer?.self),
      ] }
      static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
        InvestQuery.Data.self
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
          .field("fund", Fund?.self),
          .field("market", Market.self),
          .field("quote", Quote?.self, arguments: ["manualPriceCents": .variable("manualPriceCents")]),
        ] }
        static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
          InvestQuery.Data.Viewer.self
        ] }

        var id: API.ID { __data["id"] }
        /// The SnapTrade grant carries `trade`. Until then everything is read-only.
        var tradeScope: Bool { __data["tradeScope"] }
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
            InvestQuery.Data.Viewer.Fund.self
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
            InvestQuery.Data.Viewer.Market.self,
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
            .field("buyPlan", BuyPlan.self),
          ] }
          static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
            InvestQuery.Data.Viewer.Quote.self
          ] }

          var priceCents: API.Cents { __data["priceCents"] }
          var source: GraphQLEnum<API.PriceSource> { __data["source"] }
          var asOf: API.DateTime? { __data["asOf"] }
          var buyPlan: BuyPlan { __data["buyPlan"] }

          /// Viewer.Quote.BuyPlan
          ///
          /// Parent Type: `BuyPlan`
          nonisolated struct BuyPlan: API.SelectionSet {
            let __data: DataDict
            init(_dataDict: DataDict) { __data = _dataDict }

            static var __parentType: any ApolloAPI.ParentType { API.Objects.BuyPlan }
            static var __selections: [ApolloAPI.Selection] { [
              .field("__typename", String.self),
              .field("totalCashCents", API.Cents.self),
              .field("totalCostCents", API.Cents.self),
              .field("totalUnits", Double.self),
              .field("legs", [Leg].self),
              .field("skipped", [Skipped].self),
            ] }
            static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
              InvestQuery.Data.Viewer.Quote.BuyPlan.self
            ] }

            var totalCashCents: API.Cents { __data["totalCashCents"] }
            var totalCostCents: API.Cents { __data["totalCostCents"] }
            var totalUnits: Double { __data["totalUnits"] }
            var legs: [Leg] { __data["legs"] }
            var skipped: [Skipped] { __data["skipped"] }

            /// Viewer.Quote.BuyPlan.Leg
            ///
            /// Parent Type: `BuyLeg`
            nonisolated struct Leg: API.SelectionSet {
              let __data: DataDict
              init(_dataDict: DataDict) { __data = _dataDict }

              static var __parentType: any ApolloAPI.ParentType { API.Objects.BuyLeg }
              static var __selections: [ApolloAPI.Selection] { [
                .field("__typename", String.self),
                .field("units", Double.self),
                .field("notionalCents", API.Cents?.self),
                .field("estimatedCostCents", API.Cents.self),
                .field("account", Account.self),
              ] }
              static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
                InvestQuery.Data.Viewer.Quote.BuyPlan.Leg.self
              ] }

              /// Whole units, or an estimate when the leg is a dollar amount.
              var units: Double { __data["units"] }
              var notionalCents: API.Cents? { __data["notionalCents"] }
              var estimatedCostCents: API.Cents { __data["estimatedCostCents"] }
              var account: Account { __data["account"] }

              /// Viewer.Quote.BuyPlan.Leg.Account
              ///
              /// Parent Type: `Account`
              nonisolated struct Account: API.SelectionSet {
                let __data: DataDict
                init(_dataDict: DataDict) { __data = _dataDict }

                static var __parentType: any ApolloAPI.ParentType { API.Objects.Account }
                static var __selections: [ApolloAPI.Selection] { [
                  .field("__typename", String.self),
                  .field("cashCents", API.Cents?.self),
                  .fragment(AccountLine.self),
                ] }
                static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
                  InvestQuery.Data.Viewer.Quote.BuyPlan.Leg.Account.self,
                  AccountLine.self
                ] }

                /// Cash in the fund's currency; null when SnapTrade sent none.
                var cashCents: API.Cents? { __data["cashCents"] }
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

            /// Viewer.Quote.BuyPlan.Skipped
            ///
            /// Parent Type: `BuySkip`
            nonisolated struct Skipped: API.SelectionSet {
              let __data: DataDict
              init(_dataDict: DataDict) { __data = _dataDict }

              static var __parentType: any ApolloAPI.ParentType { API.Objects.BuySkip }
              static var __selections: [ApolloAPI.Selection] { [
                .field("__typename", String.self),
                .field("reason", GraphQLEnum<API.BuySkipReason>.self),
                .field("account", Account.self),
              ] }
              static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
                InvestQuery.Data.Viewer.Quote.BuyPlan.Skipped.self
              ] }

              var reason: GraphQLEnum<API.BuySkipReason> { __data["reason"] }
              var account: Account { __data["account"] }

              /// Viewer.Quote.BuyPlan.Skipped.Account
              ///
              /// Parent Type: `Account`
              nonisolated struct Account: API.SelectionSet {
                let __data: DataDict
                init(_dataDict: DataDict) { __data = _dataDict }

                static var __parentType: any ApolloAPI.ParentType { API.Objects.Account }
                static var __selections: [ApolloAPI.Selection] { [
                  .field("__typename", String.self),
                  .field("cashCents", API.Cents?.self),
                  .fragment(AccountLine.self),
                ] }
                static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
                  InvestQuery.Data.Viewer.Quote.BuyPlan.Skipped.Account.self,
                  AccountLine.self
                ] }

                /// Cash in the fund's currency; null when SnapTrade sent none.
                var cashCents: API.Cents? { __data["cashCents"] }
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