package com.supportfolio.platform.identity.token;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.supportfolio.platform.identity.IdentityProperties;
import com.supportfolio.platform.identity.principal.IdentityRole;
import com.supportfolio.platform.identity.principal.InternalPrincipal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OneTimeCodeStoreTest {

  private static final long CODE_TTL_SECONDS = 60;

  private OneTimeCodeStore store;
  private InternalPrincipal alice;
  private InternalPrincipal bob;

  @BeforeEach
  void setUp() {
    store = new OneTimeCodeStore(properties(CODE_TTL_SECONDS));
    alice = new InternalPrincipal("1", "alice", "alice@x.com", "Alice", IdentityRole.USER);
    bob = new InternalPrincipal("2", "bob", "bob@x.com", "Bob", IdentityRole.ADMIN);
  }

  @Test
  void consumeReturnsPrincipalExactlyOnce() {
    String code = store.create(alice);

    assertTrue(code.length() >= 32, "code must be at least 32 chars but was " + code.length());
    assertTrue(code.matches("[A-Za-z0-9_-]+"), "code must be URL-safe base64 but was: " + code);
    assertEquals(Optional.of(alice), store.consume(code));
    assertEquals(Optional.empty(), store.consume(code)); // replay rejected
  }

  @Test
  void unknownCodeIsEmpty() {
    assertEquals(Optional.empty(), store.consume("nope"));
    assertEquals(Optional.empty(), store.consume(""));
    assertEquals(Optional.empty(), store.consume("   "));
    assertEquals(Optional.empty(), store.consume(null));
  }

  @Test
  void codeIsSingleUseBeforeExpiry() {
    String codeForAlice = store.create(alice);
    String codeForBob = store.create(bob);
    assertNotEquals(codeForAlice, codeForBob);

    // Each code maps to its own principal while both are still inside the TTL.
    assertEquals(Optional.of(alice), store.consume(codeForAlice));
    assertEquals(Optional.of(bob), store.consume(codeForBob));
    // And each is single-use even though neither had expired yet.
    assertEquals(Optional.empty(), store.consume(codeForAlice));
    assertEquals(Optional.empty(), store.consume(codeForBob));
  }

  @Test
  void expiredCodeIsEmpty() {
    OneTimeCodeStore storeWithZeroTtl = new OneTimeCodeStore(properties(0));

    String code = storeWithZeroTtl.create(alice);

    assertEquals(Optional.empty(), storeWithZeroTtl.consume(code));
  }

  private static IdentityProperties properties(long codeTtlSeconds) {
    return new IdentityProperties(
        "http://localhost:8081",
        "owner-login",
        List.of("friend-login"),
        List.of("http://localhost:4200"),
        /* jwtPrivateKeyPem= */ null,
        "https://api.github.com",
        codeTtlSeconds,
        3600);
  }
}
