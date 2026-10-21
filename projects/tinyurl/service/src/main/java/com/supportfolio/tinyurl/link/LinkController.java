package com.supportfolio.tinyurl.link;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The authenticated half of the public API: shortening. The role check is explicit here (the
 * starter only authenticates); an authenticated caller without {@code admin}/{@code user} is
 * denied with 403 before anything is stored.
 */
@RestController
public class LinkController {

  private final LinkService service;

  public LinkController(LinkService service) {
    this.service = service;
  }

  @PostMapping("/api/links")
  ResponseEntity<LinkView> create(
      @AuthenticationPrincipal Jwt principal, @RequestBody CreateLinkRequest request) {
    String role = principal == null ? null : principal.getClaimAsString("role");
    if (!"admin".equals(role) && !"user".equals(role)) {
      throw new AccessDeniedException(
          role == null ? "anonymous shorten" : "role is outside the allowlist");
    }
    LinkView created = service.create(request.targetUrl(), principal.getSubject());
    return ResponseEntity.status(HttpStatus.CREATED).body(created);
  }
}
