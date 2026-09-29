// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI
@_spi(Execution) @_spi(Unsafe) import ApolloAPI

extension API {
  nonisolated struct SetCountryMutation: GraphQLMutation {
    static let operationName: String = "SetCountry"
    static let operationDocument: ApolloAPI.OperationDocument = .init(
      definition: .init(
        #"mutation SetCountry($country: Country!) { setCountry(country: $country) { __typename id country countryChosen } }"#
      ))

    public var country: GraphQLEnum<Country>

    public init(country: GraphQLEnum<Country>) {
      self.country = country
    }

    @_spi(Unsafe) public var __variables: Variables? { ["country": country] }

    nonisolated struct Data: API.SelectionSet {
      let __data: DataDict
      init(_dataDict: DataDict) { __data = _dataDict }

      static var __parentType: any ApolloAPI.ParentType { API.Objects.Mutation }
      static var __selections: [ApolloAPI.Selection] { [
        .field("setCountry", SetCountry.self, arguments: ["country": .variable("country")]),
      ] }
      static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
        SetCountryMutation.Data.self
      ] }

      /// Confirms or switches the country. Switching re-types every account, resets both orders and clears the fund.
      var setCountry: SetCountry { __data["setCountry"] }

      /// SetCountry
      ///
      /// Parent Type: `Viewer`
      nonisolated struct SetCountry: API.SelectionSet {
        let __data: DataDict
        init(_dataDict: DataDict) { __data = _dataDict }

        static var __parentType: any ApolloAPI.ParentType { API.Objects.Viewer }
        static var __selections: [ApolloAPI.Selection] { [
          .field("__typename", String.self),
          .field("id", API.ID.self),
          .field("country", GraphQLEnum<API.Country>.self),
          .field("countryChosen", Bool.self),
        ] }
        static var __fulfilledFragments: [any ApolloAPI.SelectionSet.Type] { [
          SetCountryMutation.Data.SetCountry.self
        ] }

        var id: API.ID { __data["id"] }
        /// Where the user invests. Canada until they choose.
        var country: GraphQLEnum<API.Country> { __data["country"] }
        /// False until the user confirms a country; ask before anything else.
        var countryChosen: Bool { __data["countryChosen"] }
      }
    }
  }

}