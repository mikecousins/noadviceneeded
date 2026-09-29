// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI
@_spi(Execution) @_spi(Unsafe) import ApolloAPI

extension API {
  nonisolated struct AccountLine: API.SelectionSet, Fragment {
    static var fragmentDefinition: StaticString {
      #"fragment AccountLine on Account { __typename id name numberMasked brokerageName accountType typeLabel }"#
    }

    let __data: DataDict
    init(_dataDict: DataDict) { __data = _dataDict }

    static var __parentType: any ApolloAPI.ParentType { API.Objects.Account }
    static var __selections: [ApolloAPI.Selection] { [
      .field("__typename", String.self),
      .field("id", API.ID.self),
      .field("name", String.self),
      .field("numberMasked", String.self),
      .field("brokerageName", String.self),
      .field("accountType", GraphQLEnum<API.AccountType>.self),
      .field("typeLabel", String.self),
    ] }
    static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
      AccountLine.self
    ] }

    var id: API.ID { __data["id"] }
    var name: String { __data["name"] }
    var numberMasked: String { __data["numberMasked"] }
    var brokerageName: String { __data["brokerageName"] }
    var accountType: GraphQLEnum<API.AccountType> { __data["accountType"] }
    var typeLabel: String { __data["typeLabel"] }
  }

}