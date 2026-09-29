// @generated
// This file was automatically generated and should not be edited.

@_spi(Internal) import ApolloAPI

extension API {
  /// SYNCED read SnapTrade now; FRESH skipped it inside the 15-minute cooldown; RECONNECT means sign in again; ERROR kept the last read.
  nonisolated enum SyncStatus: String, EnumType {
    case error = "ERROR"
    case fresh = "FRESH"
    case reconnect = "RECONNECT"
    case synced = "SYNCED"
  }

}