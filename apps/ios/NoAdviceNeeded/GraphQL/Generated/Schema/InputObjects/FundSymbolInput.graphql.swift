// @generated
// This file was automatically generated and should not be edited.

@_spi(Internal) @_spi(Unsafe) import ApolloAPI

extension API {
  /// A `Symbol` from `searchSymbols`, chosen as the fund.
  nonisolated struct FundSymbolInput: InputObject {
    private(set) var __data: InputDict

    init(_ data: InputDict) {
      __data = data
    }

    init(
      currency: String,
      name: String,
      symbolId: ID,
      ticker: String
    ) {
      __data = InputDict([
        "currency": currency,
        "name": name,
        "symbolId": symbolId,
        "ticker": ticker
      ])
    }

    var currency: String {
      get { __data["currency"] }
      set { __data["currency"] = newValue }
    }

    var name: String {
      get { __data["name"] }
      set { __data["name"] = newValue }
    }

    var symbolId: ID {
      get { __data["symbolId"] }
      set { __data["symbolId"] = newValue }
    }

    var ticker: String {
      get { __data["ticker"] }
      set { __data["ticker"] = newValue }
    }
  }

}