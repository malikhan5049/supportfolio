package com.supportfolio.tinyurl.link;

import java.net.URI;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LinkService {

  private static final int MAX_SLUG_ATTEMPTS = 5;

  private final LinkRepository links;
  private final LinkClickRepository clicks;
  private final SlugGenerator slugs;
  private final TargetUrlValidator validator;
  private final Clock clock;
  private final ShortenRateLimiter rateLimiter;

  public LinkService(
      LinkRepository links,
      LinkClickRepository clicks,
      SlugGenerator slugs,
      TargetUrlValidator validator,
      Clock clock,
      ShortenRateLimiter rateLimiter) {
    this.links = links;
    this.clicks = clicks;
    this.slugs = slugs;
    this.validator = validator;
    this.clock = clock;
    this.rateLimiter = rateLimiter;
  }

  public List<LinkView> list() {
    return links.findAllWithClickCounts().stream()
        .map(
            summary ->
                new LinkView(
                    summary.getSlug(),
                    summary.getTargetUrl(),
                    summary.getClickCount(),
                    summary.getCreatedAt()))
        .toList();
  }

  public LinkView create(String rawTargetUrl, String createdBy) {
    if (!rateLimiter.tryAcquire(createdBy)) {
      throw new RateLimitedException();
    }
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

  @Transactional
  public String resolveAndRecordClick(String slug) {
    LinkEntity link = links.findBySlug(slug).orElseThrow(() -> new LinkNotFoundException(slug));
    clicks.save(new LinkClickEntity(UUID.randomUUID(), link, clock.instant()));
    return link.getTargetUrl();
  }
}
