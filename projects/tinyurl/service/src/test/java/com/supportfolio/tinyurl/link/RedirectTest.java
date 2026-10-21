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
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/** The redirect: 302 to the stored target, exactly one click row per follow, typed 404 for unknown. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(RedirectTest.FixedClock.class)
class RedirectTest extends PostgresIntegrationTest {

  static final Instant CLICKED_AT = Instant.ofEpochSecond(1800000000);

  @Autowired MockMvc mockMvc;
  @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;

  @Test
  void redirectsWithFoundAndRecordsOneClickRow() throws Exception {
    UUID linkId = seed("go123456", "https://example.com/target");
    mockMvc
        .perform(get("/go/go123456"))
        .andExpect(status().isFound())
        .andExpect(header().string("Location", "https://example.com/target"));
    assertEquals(1, clickCountFor(linkId));
  }

  @Test
  void uses302Not301SoBrowsersDoNotCacheAwayClicks() throws Exception {
    seed("t302abc1", "https://example.com/known");
    mockMvc.perform(get("/go/t302abc1")).andExpect(status().isFound());
  }

  @Test
  void incrementsThePublicCountOnEveryFollow() throws Exception {
    UUID linkId = seed("cnt12345", "https://example.com/counted");
    mockMvc.perform(get("/go/cnt12345")).andExpect(status().isFound());
    mockMvc.perform(get("/go/cnt12345")).andExpect(status().isFound());
    assertEquals(2, clickCountFor(linkId));
  }

  @Test
  void returnsTyped404ForAnUnknownSlug() throws Exception {
    mockMvc
        .perform(get("/go/nope1234"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.error").value("link_not_found"));
  }

  private UUID seed(String slug, String target) {
    UUID id = UUID.randomUUID();
    jdbc.update(
        "insert into links (id, slug, target_url, created_by, created_at) values (?, ?, ?, 'seeder', now())",
        id, slug, target);
    return id;
  }

  private long clickCountFor(UUID linkId) {
    return jdbc
        .queryForObject("select count(*) from link_clicks where link_id = ?", Long.class, linkId);
  }

  @TestConfiguration
  static class FixedClock {
    @Bean
    @Primary
    Clock fixedClickClock() {
      return Clock.fixed(CLICKED_AT, ZoneOffset.UTC);
    }
  }
}
