package com.supportfolio.tinyurl.link;

import static org.assertj.core.api.Assertions.assertThat;
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
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataIntegrityViolationException;

/**
 * Slug allocation is retried in-process when a generated slug already exists or the write loses a
 * unique-key race: the first candidate that sticks wins.
 */
class LinkServiceTest {

  private static final Instant NOW = Instant.ofEpochSecond(1700000000);

  private LinkRepository links;
  private SlugGenerator slugs;
  private TargetUrlValidator validator;
  private LinkService service;

  @BeforeEach
  void setUp() {
    links = mock(LinkRepository.class);
    slugs = mock(SlugGenerator.class);
    validator = mock(TargetUrlValidator.class);
    service = new LinkService(links, mock(LinkClickRepository.class), slugs, validator, Clock.fixed(NOW, ZoneOffset.UTC), new ShortenRateLimiter(new com.supportfolio.tinyurl.config.TinyUrlProperties("http://identity.example", 20), Clock.fixed(NOW, ZoneOffset.UTC)));
  }

  @Test
  void retriesWhenTheGeneratedSlugAlreadyExists() {
    when(validator.validate("https://example.com")).thenReturn(URI.create("https://example.com"));
    when(slugs.next()).thenReturn("existsA1", "fresh234");
    when(links.existsBySlug("existsA1")).thenReturn(true);
    when(links.existsBySlug("fresh234")).thenReturn(false);
    when(links.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));

    LinkView view = service.create("https://example.com", "user-9");

    assertEquals("fresh234", view.slug());
    verify(slugs, times(2)).next();
  }

  @Test
  void retriesWhenTheWriteRacesOnTheUniqueKey() {
    when(validator.validate("https://example.com")).thenReturn(URI.create("https://example.com"));
    when(slugs.next()).thenReturn("raced123", "raced456");
    when(links.existsBySlug(any(String.class))).thenReturn(false);
    when(links.saveAndFlush(any(LinkEntity.class)))
        .thenThrow(new DataIntegrityViolationException("unique race"))
        .thenAnswer(invocation -> invocation.getArgument(0));

    LinkView view = service.create("https://example.com", "user-9");

    assertEquals("raced456", view.slug());
  }

  @Test
  void reportsZeroClicksOnCreation() {
    when(validator.validate("https://example.com")).thenReturn(URI.create("https://example.com"));
    when(slugs.next()).thenReturn("okslug1");
    when(links.existsBySlug("okslug1")).thenReturn(false);
    when(links.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));

    LinkView view = service.create("https://example.com", "user-9");

    assertThat(view.clickCount()).isZero();
  }

  @Test
  void createdAtUsesTheInjectedClock() {
    when(validator.validate("https://example.com")).thenReturn(URI.create("https://example.com"));
    when(slugs.next()).thenReturn("okslug1");
    when(links.existsBySlug("okslug1")).thenReturn(false);
    when(links.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));

    LinkView view = service.create("https://example.com", "user-9");

    assertThat(view.createdAt()).isEqualTo(NOW);
  }

  @Test
  void theSavedEntityCarriesTheStoringUser() {
    when(validator.validate("https://example.com")).thenReturn(URI.create("https://example.com"));
    when(slugs.next()).thenReturn("okslug1");
    when(links.existsBySlug("okslug1")).thenReturn(false);
    when(links.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));

    service.create("https://example.com", "sub-from-jwt");

    ArgumentCaptor<LinkEntity> saved = ArgumentCaptor.forClass(LinkEntity.class);
    verify(links).saveAndFlush(saved.capture());
    assertEquals("okslug1", saved.getValue().getSlug());
    assertEquals("sub-from-jwt", saved.getValue().getCreatedBy());
    assertEquals(NOW, saved.getValue().getCreatedAt());
  }
}
