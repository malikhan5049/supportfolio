package com.supportfolio.tinyurl.link;

import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The creation-specific part of the business: validate the target, allocate a slug, persist. The
 * write retries on a lost unique-key race up to five candidates; row writes never happen for
 * rejected requests (validation happens before any candidate is generated).
 */
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

  @Transactional
  public LinkView create(String rawTargetUrl, String createdBy) {
    URI validated = validator.validate(rawTargetUrl);
    for (int attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      String candidate = slugs.next();
      if (links.existsBySlug(candidate)) {
        continue;
      }
      try {
        LinkEntity saved =
            links.saveAndFlush(
                new LinkEntity(
                    UUID.randomUUID(),
                    candidate,
                    validated.toString(),
                    createdBy,
                    Instant.now(clock)));
        return new LinkView(saved.getSlug(), saved.getTargetUrl(), 0, saved.getCreatedAt());
      } catch (DataIntegrityViolationException race) {
        // another writer took the slug between the existence check and the insert
      }
    }
    throw new IllegalStateException("could not allocate a unique slug after five attempts");
  }
}
