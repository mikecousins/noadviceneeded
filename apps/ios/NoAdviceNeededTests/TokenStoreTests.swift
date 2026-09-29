import Foundation
import Testing

@testable import No_Advice_Needed

/// Runs against the real Keychain under a throwaway service name so the app's own entry is never
/// touched.
@Suite(.serialized)
struct TokenStoreTests {
  let store = KeychainTokenStore(service: "ca.noadviceneeded.app.tests.\(UUID().uuidString)")
  let session = StoredSession(
    token: "0f8b7a1e-2c3d-4e5f-8a9b-0c1d2e3f4a5b.c2lnbmF0dXJl",
    expiresAt: Date(timeIntervalSince1970: 1_790_000_000)
  )

  @Test func startsEmpty() {
    #expect(store.load() == nil)
  }

  @Test func savesAndLoads() throws {
    defer { store.clear() }
    try store.save(session)
    #expect(store.load() == session)
  }

  @Test func overwritesTheSession() throws {
    defer { store.clear() }
    try store.save(session)
    let next = StoredSession(token: "next.token", expiresAt: session.expiresAt.addingTimeInterval(60))
    try store.save(next)
    #expect(store.load() == next)
  }

  @Test func clears() throws {
    try store.save(session)
    store.clear()
    #expect(store.load() == nil)
    // Clearing twice is harmless.
    store.clear()
  }

  @Test func keepsServicesApart() throws {
    let other = KeychainTokenStore(service: "\(store.service).other")
    defer {
      store.clear()
      other.clear()
    }
    try store.save(session)
    #expect(other.load() == nil)
  }

  @Test func knowsWhenATokenHasExpired() {
    #expect(session.isExpired(now: session.expiresAt))
    #expect(!session.isExpired(now: session.expiresAt.addingTimeInterval(-1)))
  }

  @Test func memoryStoreBehavesTheSame() throws {
    let memory = MemoryTokenStore()
    #expect(memory.load() == nil)
    try memory.save(session)
    #expect(memory.load() == session)
    memory.clear()
    #expect(memory.load() == nil)
  }
}
