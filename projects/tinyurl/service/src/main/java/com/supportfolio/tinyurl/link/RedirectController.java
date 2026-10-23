package com.supportfolio.tinyurl.link;

import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RedirectController {

  private final LinkService links;

  public RedirectController(LinkService links) {
    this.links = links;
  }

  @GetMapping("/go/{slug}")
  public ResponseEntity<Void> redirect(@PathVariable String slug) {
    String targetUrl = links.resolveAndRecordClick(slug);
    return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(targetUrl)).build();
  }
}
