package com.supportfolio.platform.identity.login;

import static org.junit.jupiter.api.Assertions.assertThrows;

import com.supportfolio.platform.identity.IdentityProperties;
import java.util.List;
import org.junit.jupiter.api.Test;

class LoginRedirectControllerTest {

  private static IdentityProperties properties(List<String> redirectOrigins) {
    return new IdentityProperties(
        "http://localhost:8081",
        "owner-login",
        List.of("friend-login"),
        redirectOrigins,
        null,
        "https://api.github.com",
        60,
        3600);
  }

  @Test
  void constructorFailsFastWhenRedirectOriginsAreNull() {
    assertThrows(
        IllegalStateException.class,
        () -> new LoginRedirectController(new RedirectOriginValidator(), properties(null)));
  }

  @Test
  void constructorFailsFastWhenRedirectOriginsAreEmpty() {
    assertThrows(
        IllegalStateException.class,
        () -> new LoginRedirectController(new RedirectOriginValidator(), properties(List.of())));
  }
}
