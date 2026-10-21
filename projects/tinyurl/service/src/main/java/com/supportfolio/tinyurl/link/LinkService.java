package com.supportfolio.tinyurl.link;

import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
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
  private final LinkClickRepository clicks;
  private final SlugGenerator slugs;
  private final TargetUrlValidator validator;
  private final Clock clock;
  private final ShortenRateLimiter limiter;

  public LinkService(
      LinkRepository links,
      LinkClickRepository clicks,
      SlugGenerator slugs,
      TargetUrlValidator validator,
      Clock clock,
      ShortenRateLimiter limiter) {
    this.links = links;
    this.clicks = clicks;
    this.slugs = slugs;
    this.validator = validator;
    this.clock = clock;
    this.limiter = limiter;
  }

  /** Browse rows mapped to the public view; creator identity never leaves the repository layer. */
  public List<LinkView> list() {
    return links.findAllWithClickCounts().stream()
        .map(
            row ->
                new LinkView(
                    row.getSlug(), row.getTargetUrl(), row.getClickCount(), row.getCreatedAt()))
        .toList();
  }

  /** Anonymous follow of a short link: one click row first, then the stored target out. */
  @Transactional
  public String resolveAndRecordClick(String slug) {
    LinkEntity link = links.findBySlug(slug).orElseThrow(() -> new LinkNotFoundException(slug));
    clicks.saveAndFlush(new LinkClickEntity(UUID.randomUUID(), link, Instant.now(clock)));
    return link.getTargetUrl();
  }

  /** Creation-specific part of the business (rate limiting lands with its task). */
  @Transactional
  public LinkView create(String rawTargetUrl, String createdBy) {
    // Acquire BEFORE validation: an over-cap user gets 429 without spending any validation work,
    // and nothing at all is stored on a rejected request.
    if (!limiter.tryAcquire(createdBy)) {
      throw new RateLimitedException();
    }
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
