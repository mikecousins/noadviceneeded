// @generated
// This file was automatically generated and should not be edited.

@_spi(Internal) import ApolloAPI

extension API {
  /// A contribution limit. `IRA` is shared by a Roth and a Traditional IRA.
  nonisolated enum RoomType: String, EnumType {
    case fhsa = "FHSA"
    case hsa = "HSA"
    case ira = "IRA"
    case rrsp = "RRSP"
    case tfsa = "TFSA"
  }

}