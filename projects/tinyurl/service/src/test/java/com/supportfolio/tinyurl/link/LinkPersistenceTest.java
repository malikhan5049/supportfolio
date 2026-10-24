package com.supportfolio.tinyurl.link;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.supportfolio.tinyurl.PostgresIntegrationTest;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Pins the initial migration: two tables, unique slugs, cascade of clicks on link delete. The
 * entities/repositories these tests exercise do not exist until this task's implementation step.
 */
class LinkPersistenceTest extends PostgresIntegrationTest {

  @Autowired com.supportfolio.tinyurl.link.LinkRepository links;
  @Autowired com.supportfolio.tinyurl.link.LinkClickRepository clicks;
  @Autowired JdbcTemplate jdbc;

  @Test
  void flywayAppliesTheInitialMigration() {
    assertEquals(
        1,
        jdbc.queryForObject(
            "select count(*) from flyway_schema_history where success", Integer.class));
    assertEquals(
        2,
        jdbc.queryForObject(
            "select count(*) from information_schema.tables where table_name in ('links','link_clicks')",
            Integer.class));
  }

  @Test
  void slugIsUnique() {
    links.saveAndFlush(
        new LinkEntity(UUID.randomUUID(), "abc12345", "https://example.com", "u1", Instant.now()));
    assertThrows(
        DataIntegrityViolationException.class,
        () ->
            links.saveAndFlush(
                new LinkEntity(
                    UUID.randomUUID(), "abc12345", "https://example.org", "u2", Instant.now())));
  }

  @Test
  void deletingALinkCascadesItsClicks() {
    LinkEntity link =
        links.saveAndFlush(
            new LinkEntity(
                UUID.randomUUID(), "cas12345", "https://example.com", "u1", Instant.now()));
    jdbc.update(
        "insert into link_clicks (id, link_id, clicked_at) values (?, ?, ?)",
        UUID.randomUUID(),
        link.getId(),
        java.sql.Timestamp.from(Instant.now()));
    assertEquals(1, jdbc.queryForObject("select count(*) from link_clicks", Integer.class));
    links.delete(link);
    links.flush();
    assertEquals(0, jdbc.queryForObject("select count(*) from link_clicks", Integer.class));
  }
}
