// @generated
// This file was automatically generated and can be edited to
// implement advanced custom scalar functionality.
//
// Any changes to this file will not be overwritten by future
// code generation execution.

@_spi(Internal) @_spi(Execution) import ApolloAPI

extension API {
  /// Money as integer cents in the account's or fund's currency. Wider than Int: totals can pass 2^31.
  ///
  /// `Int` is 64 bits on every device the app runs on, and the server never sends more than 2^53.
  typealias Cents = Int

}
