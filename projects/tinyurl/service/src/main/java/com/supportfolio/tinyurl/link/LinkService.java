package com.supportfolio.tinyurl.link;

import java.net.URI;
import java.time.Clock;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

@Service
public class LinkService {

  private static final int MAX_SLUG_ATTEMPTS = 5;

  private final LinkRepository links;
  private final SlugGenerator slugs;
  private final TargetUrlValidator validator;
  private final Clock clock;

  public LinkService(
      LinkRepository links, SlugGenerator slugs, TargetUrlValidator validator, Clock clock) {
    this.links = links;
    this.slugs = slugs;
    this.validator = validator;
    this.clock = clock;
  }

  public LinkView create(String rawTargetUrl, String createdBy) {
    URI target = validator.validate(rawTargetUrl);
    for (int attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      String slug = slugs.next();
      if (links.existsBySlug(slug)) {
        continue;
      }

      LinkEntity link =
          new LinkEntity(UUID.randomUUID(), slug, target.toString(), createdBy, clock.instant());
      try {
        LinkEntity saved = links.saveAndFlush(link);
        return new LinkView(saved.getSlug(), saved.getTargetUrl(), 0, saved.getCreatedAt());
      } catch (DataIntegrityViolationException exception) {
        if (attempt == MAX_SLUG_ATTEMPTS - 1) {
          throw exception;
        }
      }
    }
    throw new IllegalStateException("Unable to generate a unique short link");
  }
}
