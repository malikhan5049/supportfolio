package com.supportfolio.platform.identity.login;

import com.supportfolio.platform.identity.IdentityProperties;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Login entry point: the requested redirect target must pass the origin allowlist before the GitHub
 * dance starts, so an attacker-chosen destination is rejected up front. Only the validated target
 * is stored, and neither it nor any identity data is logged.
 */
@RestController
public class LoginRedirectController {

  /** Session attribute holding the validated post-login redirect target. */
  static final String REDIRECT_ATTRIBUTE = "post-login-redirect";

  private static final String GITHUB_AUTHORIZATION_ENTRY = "/oauth2/authorization/github";

  private final RedirectOriginValidator redirectOriginValidator;
  private final IdentityProperties identityProperties;

  public LoginRedirectController(
      RedirectOriginValidator redirectOriginValidator, IdentityProperties identityProperties) {
    if (identityProperties.redirectOrigins() == null
        || identityProperties.redirectOrigins().isEmpty()) {
      throw new IllegalStateException("supportfolio.identity.redirect-origins is not configured");
    }
    this.redirectOriginValidator = redirectOriginValidator;
    this.identityProperties = identityProperties;
  }

  @GetMapping("/auth/login")
  ResponseEntity<Void> login(
      @RequestParam("redirect") String redirect, HttpServletRequest request) {
    if (!redirectOriginValidator.isValid(redirect, identityProperties.redirectOrigins())) {
      return ResponseEntity.badRequest().build();
    }
    request.getSession().setAttribute(REDIRECT_ATTRIBUTE, redirect);
    return ResponseEntity.status(HttpStatus.FOUND)
        .location(URI.create(GITHUB_AUTHORIZATION_ENTRY))
        .build();
  }
}
