package com.supportfolio.tinyurl.link;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.supportfolio.tinyurl.PostgresIntegrationTest;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Objects;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Deterministic, real-DB reproduction of the lost unique-key race: a trigger raises SQLSTATE 23505
 * (unique_violation) on the first scripted slug attempt. The service must continue to a second
 * candidate in a fresh transaction — inside one transaction, PostgreSQL aborts the transaction on
 * the first violation and every later statement fails "current transaction is aborted", so this
 * only passes when each save is its own transaction, which is what lets the plan's race retry work
 * on PostgreSQL.
 */
@SpringBootTest(properties = "supportfolio.tinyurl.rate-limit-per-hour=1000")
// Overrides the shared base's @Transactional (TestContext takes the most-derived declaration):
// this test must NOT join a test transaction, otherwise the first 23505 aborts it and the
// retry path (one fresh transaction per save) can never be observed on a real database.
@org.springframework.transaction.annotation.Transactional(
    propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
class LinkSlugRaceIntegrationTest extends PostgresIntegrationTest {

  @Autowired LinkService service;
  @Autowired JdbcTemplate jdbc;

  @TestConfiguration(proxyBeanMethods = false)
  static class Scripted {
    static final Deque<String> CANDIDATES = new ArrayDeque<>();

    @Bean
    @Primary
    SlugGenerator scriptedSlugs() {
      return new SlugGenerator() {
        @Override
        public String next() {
          return Objects.requireNonNull(Scripted.CANDIDATES.poll(), "scripted slug queue drained");
        }
      };
    }
  }

  @BeforeEach
  void installTheRace() {
    jdbc.execute(
        "create or replace function raise_unique() returns trigger as $trig$ begin "
            + "raise exception 'scripted unique race' using ERRCODE = 'unique_violation'; end $trig$ "
            + "language plpgsql");
    jdbc.execute("drop trigger if exists g_race on links");
    jdbc.execute(
        "create trigger g_race before insert on links for each row when (new.slug like 'aa%') "
            + "execute function raise_unique()");
  }

  @AfterEach
  void removeTheRaceFixture() {
    jdbc.execute("drop trigger if exists g_race on links");
    jdbc.execute("delete from links where slug = 'bbbb5678'");
    jdbc.execute("drop function if exists raise_unique()");
  }

  @Test
  void aLostUniqueKeyRaceIsRetriedWithinOneCreationRequest() {
    // candidate 1 passes the existsBySlug pre-check (nothing seeded), the insert then raises
    // scripted 23505; candidate 2 must win the same request.
    Scripted.CANDIDATES.add("aaaa1234");
    Scripted.CANDIDATES.add("bbbb5678");

    LinkView view = service.create("https://example.com", "race-user-9");

    assertEquals("bbbb5678", view.slug());
  }
}
