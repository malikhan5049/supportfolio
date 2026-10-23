package com.supportfolio.tinyurl.link;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.supportfolio.tinyurl.PostgresIntegrationTest;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class LinkPersistenceTest extends PostgresIntegrationTest {

  @Autowired LinkRepository links;
  @Autowired LinkClickRepository clicks;
  @Autowired JdbcTemplate jdbc;
  @Autowired EntityManager entityManager;

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
    clicks.saveAndFlush(new LinkClickEntity(UUID.randomUUID(), link, Instant.now()));
    UUID linkId = link.getId();
    entityManager.clear();
    links.deleteById(linkId);
    links.flush();
    assertEquals(0, clicks.count());
  }
}
