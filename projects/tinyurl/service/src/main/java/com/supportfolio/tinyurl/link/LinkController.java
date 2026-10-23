package com.supportfolio.tinyurl.link;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/links")
public class LinkController {

  private final LinkService links;

  public LinkController(LinkService links) {
    this.links = links;
  }

  @PostMapping
  public ResponseEntity<LinkView> create(
      @AuthenticationPrincipal Jwt jwt, @RequestBody CreateLinkRequest request) {
    String role = jwt.getClaimAsString("role");
    if (!"admin".equals(role) && !"user".equals(role)) {
      throw new AccessDeniedException("Role is not allowed to create links");
    }
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(links.create(request.targetUrl(), jwt.getSubject()));
  }
}
