package com.supportfolio.tinyurl.link;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

class LinkServiceTest {

  private final LinkRepository links = mock(LinkRepository.class);
  private final SlugGenerator slugs = mock(SlugGenerator.class);
  private final TargetUrlValidator validator = mock(TargetUrlValidator.class);
  private final Clock clock = Clock.fixed(Instant.parse("2026-10-22T12:00:00Z"), ZoneOffset.UTC);
  private final LinkService service = new LinkService(links, slugs, validator, clock);

  @Test
  void retriesAnExistingSlugBeforeSaving() {
    when(validator.validate("https://example.com/a"))
        .thenReturn(URI.create("https://example.com/a"));
    when(slugs.next()).thenReturn("taken001", "free0001");
    when(links.existsBySlug("taken001")).thenReturn(true);
    when(links.existsBySlug("free0001")).thenReturn(false);
    when(links.saveAndFlush(any(LinkEntity.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    LinkView created = service.create("https://example.com/a", "admin-1");

    assertEquals("free0001", created.slug());
    assertEquals(0, created.clickCount());
    assertEquals(Instant.parse("2026-10-22T12:00:00Z"), created.createdAt());
    verify(links, times(1)).saveAndFlush(any(LinkEntity.class));
  }

  @Test
  void retriesWhenSavingHitsAUniqueSlugRace() {
    when(validator.validate("https://example.com/a"))
        .thenReturn(URI.create("https://example.com/a"));
    when(slugs.next()).thenReturn("race0001", "safe0001");
    when(links.existsBySlug("race0001")).thenReturn(false);
    when(links.existsBySlug("safe0001")).thenReturn(false);
    when(links.saveAndFlush(any(LinkEntity.class)))
        .thenThrow(new DataIntegrityViolationException("slug race"))
        .thenAnswer(invocation -> invocation.getArgument(0));

    LinkView created = service.create("https://example.com/a", "admin-1");

    assertEquals("safe0001", created.slug());
    verify(links, times(2)).saveAndFlush(any(LinkEntity.class));
  }
}
