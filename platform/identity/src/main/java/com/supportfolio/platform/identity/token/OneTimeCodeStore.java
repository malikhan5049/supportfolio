package com.supportfolio.platform.identity.token;

import com.supportfolio.platform.identity.IdentityProperties;
import com.supportfolio.platform.identity.principal.InternalPrincipal;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Holds one-time login codes between the login redirect (Task 6) and the token exchange (Task 7).
 * Codes are single-use and expire after {@code supportfolio.identity.code-ttl-seconds}. Expired
 * entries are not swept in the background; each {@link #consume} removes the entry it looks up, so
 * an expired code is purged at the moment it is rejected, and codes that are never consumed linger
 * until the store is discarded.
 */
public class OneTimeCodeStore {

  /** 32 random bytes render as 43 URL-safe base64 characters, well above the 32-char minimum. */
  private static final int CODE_RANDOM_BYTES = 32;

  private final SecureRandom random = new SecureRandom();
  private final long codeTtlMillis;
  private final ConcurrentHashMap<String, Entry> entriesByCode = new ConcurrentHashMap<>();

  public OneTimeCodeStore(IdentityProperties identityProperties) {
    this.codeTtlMillis = identityProperties.codeTtlSeconds() * 1000L;
  }

  /** Mint a fresh, single-use code that {@link #consume} will exchange for {@code principal}. */
  public String create(InternalPrincipal principal) {
    byte[] bytes = new byte[CODE_RANDOM_BYTES];
    random.nextBytes(bytes);
    String code = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    // Overwriting is impossible in practice: reusing a live 192-bit-random code would take the
    // attacker's own oracle to observe, and a plain put keeps create() lock-free.
    entriesByCode.put(code, new Entry(principal, System.currentTimeMillis() + codeTtlMillis));
    return code;
  }

  /** Return empty unless {@code code} is a live, unconsumed code, in which case consume it. */
  public Optional<InternalPrincipal> consume(String code) {
    if (code == null || code.isBlank()) {
      return Optional.empty();
    }
    // Atomic take: among concurrent consumes only one receives the entry, making replay empty.
    Entry entry = entriesByCode.remove(code);
    if (entry == null) {
      return Optional.empty();
    }
    if (System.currentTimeMillis() >= entry.expiresAtMillis()) {
      // Lazy expiry: the entry is already removed, and an expired code is indistinguishable
      // from an unknown one. With a zero TTL the expiry equals the creation instant.
      return Optional.empty();
    }
    return Optional.of(entry.principal());
  }

  private record Entry(InternalPrincipal principal, long expiresAtMillis) {}
}
