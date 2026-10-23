package com.supportfolio.tinyurl.link;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.supportfolio.tinyurl.PostgresIntegrationTest;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@AutoConfigureMockMvc
@Import(RedirectTest.ClockConfiguration.class)
@Transactional
class RedirectTest extends PostgresIntegrationTest {

  private static final Instant CLICKED_AT = Instant.parse("2026-10-23T12:00:00Z");

  @Autowired MockMvc mockMvc;
  @Autowired LinkRepository links;
  @Autowired LinkClickRepository clicks;

  @Test
  void redirectsWithFoundAndRecordsOneClickRow() throws Exception {
    LinkEntity link = seedLink("go123456", "https://example.com/target");

    mockMvc
        .perform(get("/go/go123456"))
        .andExpect(status().isFound())
        .andExpect(header().string("Location", "https://example.com/target"));

    assertEquals(1, clicks.countByLink(link));
    assertEquals(CLICKED_AT, clicks.findAll().get(0).getClickedAt());
  }

  @Test
  void uses302Not301SoBrowsersDoNotCacheAwayClicks() throws Exception {
    seedLink("redir123", "https://example.com/target");

    mockMvc.perform(get("/go/redir123")).andExpect(status().isFound());
  }

  @Test
  void incrementsThePublicCountOnEveryFollow() throws Exception {
    LinkEntity link = seedLink("count123", "https://example.com/target");

    mockMvc.perform(get("/go/count123")).andExpect(status().isFound());
    mockMvc.perform(get("/go/count123")).andExpect(status().isFound());

    assertEquals(2, clicks.countByLink(link));
  }

  @Test
  void returnsTyped404ForAnUnknownSlug() throws Exception {
    mockMvc
        .perform(get("/go/nope1234"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.error").value("link_not_found"));
  }

  private LinkEntity seedLink(String slug, String targetUrl) {
    return links.saveAndFlush(
        new LinkEntity(
            UUID.randomUUID(), slug, targetUrl, "creator", Instant.parse("2026-10-22T00:00:00Z")));
  }

  @TestConfiguration
  static class ClockConfiguration {

    @Bean
    @Primary
    Clock fixedClock() {
      return Clock.fixed(CLICKED_AT, ZoneOffset.UTC);
    }
  }
}
