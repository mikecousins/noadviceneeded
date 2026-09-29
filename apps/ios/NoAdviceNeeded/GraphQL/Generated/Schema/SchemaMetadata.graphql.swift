// @generated
// This file was automatically generated and should not be edited.

import ApolloAPI

nonisolated protocol API_SelectionSet: ApolloAPI.SelectionSet & ApolloAPI.RootSelectionSet
where Schema == API.SchemaMetadata {}

nonisolated protocol API_InlineFragment: ApolloAPI.SelectionSet & ApolloAPI.InlineFragment
where Schema == API.SchemaMetadata {}

nonisolated protocol API_MutableSelectionSet: ApolloAPI.MutableRootSelectionSet
where Schema == API.SchemaMetadata {}

nonisolated protocol API_MutableInlineFragment: ApolloAPI.MutableSelectionSet & ApolloAPI.InlineFragment
where Schema == API.SchemaMetadata {}

extension API {
  typealias SelectionSet = API_SelectionSet

  typealias InlineFragment = API_InlineFragment

  typealias MutableSelectionSet = API_MutableSelectionSet

  typealias MutableInlineFragment = API_MutableInlineFragment

  nonisolated enum SchemaMetadata: ApolloAPI.SchemaMetadata {
    static let configuration: any ApolloAPI.SchemaConfiguration.Type = SchemaConfiguration.self

    private static let objectTypeMap: [String: ApolloAPI.Object] = [
      "Account": API.Objects.Account,
      "AccountsPayload": API.Objects.AccountsPayload,
      "AllInOneEtf": API.Objects.AllInOneEtf,
      "AuthSession": API.Objects.AuthSession,
      "BuyLeg": API.Objects.BuyLeg,
      "BuyPlan": API.Objects.BuyPlan,
      "BuySkip": API.Objects.BuySkip,
      "DepositSuggestion": API.Objects.DepositSuggestion,
      "Fund": API.Objects.Fund,
      "Market": API.Objects.Market,
      "Mutation": API.Objects.Mutation,
      "Order": API.Objects.Order,
      "OrderBatch": API.Objects.OrderBatch,
      "Portfolio": API.Objects.Portfolio,
      "Query": API.Objects.Query,
      "Quote": API.Objects.Quote,
      "ReadyToInvest": API.Objects.ReadyToInvest,
      "RoomActivity": API.Objects.RoomActivity,
      "RoomLimit": API.Objects.RoomLimit,
      "SellLeg": API.Objects.SellLeg,
      "SellPlan": API.Objects.SellPlan,
      "SellSkip": API.Objects.SellSkip,
      "Symbol": API.Objects.Symbol,
      "SyncPayload": API.Objects.SyncPayload,
      "Viewer": API.Objects.Viewer
    ]

    static func objectType(forTypename typename: String) -> ApolloAPI.Object? {
      objectTypeMap[typename]
    }
  }

  nonisolated enum Objects {}
  nonisolated enum Interfaces {}
  nonisolated enum Unions {}

}