package com.supportfolio.platform.identity.principal;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.supportfolio.platform.identity.IdentityProperties;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class RoleResolverTest {
  private final IdentityProperties props =
      new IdentityProperties(
          "http://localhost:8081",
          "owner-login",
          List.of("friend-login"),
          List.of("http://localhost:4200"),
          null,
          "https://api.github.com",
          60,
          3600);
  private final RoleResolver resolver = new RoleResolver(props);

  @Test
  void repoOwnerGetsAdminRole() {
    assertEquals(Optional.of(IdentityRole.ADMIN), resolver.resolve("owner-login"));
  }

  @Test
  void allowlistedUserGetsUserRole() {
    assertEquals(Optional.of(IdentityRole.USER), resolver.resolve("friend-login"));
  }

  @Test
  void unknownLoginGetsNoRole() {
    assertEquals(Optional.empty(), resolver.resolve("stranger"));
  }

  @Test
  void adminLoginMatchesCaseInsensitively() {
    assertEquals(Optional.of(IdentityRole.ADMIN), resolver.resolve("OWNER-LOGIN"));
  }

  @Test
  void adminWinsOverAllowlist() {
    IdentityProperties props =
        new IdentityProperties(
            "http://localhost:8081",
            "owner-login",
            List.of("owner-login", "friend-login"),
            List.of("http://localhost:4200"),
            null,
            "https://api.github.com",
            60,
            3600);
    assertEquals(Optional.of(IdentityRole.ADMIN), new RoleResolver(props).resolve("owner-login"));
  }

  @Test
  void nullLoginGetsNoRole() {
    assertEquals(Optional.empty(), resolver.resolve(null));
  }
}
