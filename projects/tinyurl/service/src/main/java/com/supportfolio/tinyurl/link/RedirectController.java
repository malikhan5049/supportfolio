package com.supportfolio.tinyurl.link;

import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public redirect. Always 302 (never 301): browsers cache 301s, which would silently swallow later
 * click rows. The Location is the fixed value stored at creation.
 */
@RestController
public class RedirectController {

  private final LinkService service;

  public RedirectController(LinkService service) {
    this.service = service;
  }

  @GetMapping("/go/{slug}")
  ResponseEntity<Void> follow(@PathVariable String slug) {
    return ResponseEntity.status(HttpStatus.FOUND)
        .location(URI.create(service.resolveAndRecordClick(slug)))
        .build();
  }
}
