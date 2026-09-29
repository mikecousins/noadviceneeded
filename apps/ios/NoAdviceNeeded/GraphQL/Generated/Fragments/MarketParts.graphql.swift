// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI
@_spi(Execution) @_spi(Unsafe) import ApolloAPI

extension API {
  nonisolated struct MarketParts: API.SelectionSet, Fragment {
    static var fragmentDefinition: StaticString {
      #"fragment MarketParts on Market { __typename open closedMessage nextOpen }"#
    }

    let __data: DataDict
    init(_dataDict: DataDict) { __data = _dataDict }

    static var __parentType: any ApolloAPI.ParentType { API.Objects.Market }
    static var __selections: [ApolloAPI.Selection] { [
      .field("__typename", String.self),
      .field("open", Bool.self),
      .field("closedMessage", String?.self),
      .field("nextOpen", API.DateTime.self),
    ] }
    static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
      MarketParts.self
    ] }

    var open: Bool { __data["open"] }
    /// Why orders are off and when they come back; null while open.
    var closedMessage: String? { __data["closedMessage"] }
    var nextOpen: API.DateTime { __data["nextOpen"] }
  }

}