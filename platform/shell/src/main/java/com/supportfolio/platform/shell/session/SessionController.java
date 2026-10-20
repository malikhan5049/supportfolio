package com.supportfolio.platform.shell.session;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The shell's only protected endpoint: a read-only projection of the JWT claims the Identity
 * service issued. No project business logic, no persistence.
 */
@RestController
public class SessionController {

  @GetMapping("/api/session/me")
  SessionView me(@AuthenticationPrincipal Jwt jwt) {
    return new SessionView(
        jwt.getSubject(), jwt.getClaimAsString("preferred_username"), jwt.getClaimAsString("role"));
  }

  record SessionView(String id, String login, String role) {}
}
