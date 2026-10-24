package com.supportfolio.tinyurl.link;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.supportfolio.tinyurl.PostgresIntegrationTest;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

/** Public browse: anonymous GET with click counts, creator field absent, empty list is 200. */
@SpringBootTest
@AutoConfigureMockMvc
class LinkBrowseTest extends PostgresIntegrationTest {

  @Autowired MockMvc mockMvc;
  @Autowired LinkRepository links;
  @Autowired LinkClickRepository clicks;
  @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;

  @Test
  void listsLinksPubliclyWithoutACreatorField() throws Exception {
    seed("aaaa0001", "https://example.com/one", Instant.parse("2026-01-01T00:00:00Z"));
    mockMvc
        .perform(get("/api/links"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.links[0].slug").exists())
        .andExpect(jsonPath("$.links[0].targetUrl").exists())
        .andExpect(jsonPath("$.links[0].clickCount").exists())
        .andExpect(jsonPath("$.links[0].createdAt").exists())
        .andExpect(jsonPath("$.links[0].createdBy").doesNotExist());
  }

  @Test
  void countsClicksPerLinkAndOrdersNewestFirst() throws Exception {
    UUID older = seed("oldb0001", "https://example.com/old", Instant.parse("2026-01-01T00:00:00Z"));
    UUID newer = seed("newb0002", "https://example.com/new", Instant.parse("2026-02-01T00:00:00Z"));
    insertClick(older);
    insertClick(older);
    insertClick(older);

    mockMvc
        .perform(get("/api/links"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.links[0].slug").value("newb0002"))
        .andExpect(jsonPath("$.links[0].clickCount").value(0))
        .andExpect(jsonPath("$.links[1].slug").value("oldb0001"))
        .andExpect(jsonPath("$.links[1].clickCount").value(3));
  }

  @Test
  void returnsAnEmptyListRatherThan404() throws Exception {
    mockMvc
        .perform(get("/api/links"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.links").isArray())
        .andExpect(jsonPath("$.links").isEmpty());
  }

  private UUID seed(String slug, String target, Instant createdAt) {
    UUID id = UUID.randomUUID();
    jdbc.update(
        "insert into links (id, slug, target_url, created_by, created_at) values (?, ?, ?, 'seeder', ?)",
        id,
        slug,
        target,
        java.sql.Timestamp.from(createdAt));
    return id;
  }

  private void insertClick(UUID linkId) {
    jdbc.update(
        "insert into link_clicks (id, link_id, clicked_at) values (?, ?, ?)",
        UUID.randomUUID(),
        linkId,
        java.sql.Timestamp.from(Instant.now()));
  }
}
