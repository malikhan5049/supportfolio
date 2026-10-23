package com.supportfolio.tinyurl.link;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.supportfolio.tinyurl.PostgresIntegrationTest;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@AutoConfigureMockMvc
@Transactional
class LinkBrowseTest extends PostgresIntegrationTest {

  @Autowired MockMvc mockMvc;
  @Autowired LinkRepository links;
  @Autowired LinkClickRepository clicks;

  @Test
  void listsLinksPubliclyWithoutACreatorField() throws Exception {
    links.saveAndFlush(
        new LinkEntity(
            UUID.randomUUID(),
            "list1234",
            "https://example.com/a",
            "private-creator",
            Instant.parse("2026-10-22T10:00:00Z")));

    mockMvc
        .perform(get("/api/links"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.links[0].slug").value("list1234"))
        .andExpect(jsonPath("$.links[0].targetUrl").value("https://example.com/a"))
        .andExpect(jsonPath("$.links[0].clickCount").value(0))
        .andExpect(jsonPath("$.links[0].createdAt").exists())
        .andExpect(jsonPath("$.links[0].createdBy").doesNotExist());
  }

  @Test
  void countsClicksPerLinkAndOrdersNewestFirst() throws Exception {
    LinkEntity older =
        links.saveAndFlush(
            new LinkEntity(
                UUID.randomUUID(),
                "older123",
                "https://example.com/old",
                "creator-1",
                Instant.parse("2026-10-21T10:00:00Z")));
    links.saveAndFlush(
        new LinkEntity(
            UUID.randomUUID(),
            "newer123",
            "https://example.com/new",
            "creator-2",
            Instant.parse("2026-10-22T10:00:00Z")));
    for (int i = 0; i < 3; i++) {
      clicks.saveAndFlush(new LinkClickEntity(UUID.randomUUID(), older, Instant.now()));
    }

    mockMvc
        .perform(get("/api/links"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.links[0].slug").value("newer123"))
        .andExpect(jsonPath("$.links[0].clickCount").value(0))
        .andExpect(jsonPath("$.links[1].slug").value("older123"))
        .andExpect(jsonPath("$.links[1].clickCount").value(3));
    assertEquals(3, clicks.countByLink(older));
  }

  @Test
  void returnsAnEmptyListRatherThan404() throws Exception {
    mockMvc
        .perform(get("/api/links"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.links").isArray())
        .andExpect(jsonPath("$.links").isEmpty());
  }
}
