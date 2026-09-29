import Foundation
import Security

/// The bearer session the server issued from `exchangeSignInCode`. Tokens last 30 days.
nonisolated struct StoredSession: Codable, Equatable, Sendable {
  let token: String
  let expiresAt: Date

  func isExpired(now: Date = .now) -> Bool { expiresAt <= now }
}

/// Where the session token lives between launches.
nonisolated protocol TokenStore: Sendable {
  func load() -> StoredSession?
  func save(_ session: StoredSession) throws
  func clear()
}

/// The Keychain, readable only on this device after its first unlock (so a background refresh
/// still works) and never synced or backed up to another device.
nonisolated struct KeychainTokenStore: TokenStore {
  var service = "ca.noadviceneeded.app"
  var account = "session"

  struct KeychainError: Error, Equatable {
    let status: OSStatus
  }

  private var query: [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]
  }

  func load() -> StoredSession? {
    var query = query
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: AnyObject?
    guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
      let data = result as? Data
    else { return nil }
    return try? Self.decoder.decode(StoredSession.self, from: data)
  }

  func save(_ session: StoredSession) throws {
    let data = try Self.encoder.encode(session)
    let update: [String: Any] = [
      kSecValueData as String: data,
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
    ]
    var status = SecItemUpdate(query as CFDictionary, update as CFDictionary)
    if status == errSecItemNotFound {
      status = SecItemAdd(query.merging(update) { $1 } as CFDictionary, nil)
    }
    guard status == errSecSuccess else { throw KeychainError(status: status) }
  }

  func clear() {
    SecItemDelete(query as CFDictionary)
  }

  private static let encoder: JSONEncoder = {
    let e = JSONEncoder()
    e.dateEncodingStrategy = .iso8601
    return e
  }()

  private static let decoder: JSONDecoder = {
    let d = JSONDecoder()
    d.dateDecodingStrategy = .iso8601
    return d
  }()
}

/// For previews and tests.
nonisolated final class MemoryTokenStore: TokenStore, @unchecked Sendable {
  private let lock = NSLock()
  private var session: StoredSession?

  init(_ session: StoredSession? = nil) { self.session = session }

  func load() -> StoredSession? { lock.withLock { session } }
  func save(_ session: StoredSession) throws { lock.withLock { self.session = session } }
  func clear() { lock.withLock { session = nil } }
}
