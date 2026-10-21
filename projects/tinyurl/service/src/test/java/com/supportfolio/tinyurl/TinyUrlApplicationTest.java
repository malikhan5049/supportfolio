package com.supportfolio.tinyurl;

import org.junit.jupiter.api.Test;

/** Boots against the shared Testcontainers base so Flyway + Hibernate validation are exercised. */
class TinyUrlApplicationTest extends PostgresIntegrationTest {

  @Test
  void contextLoads() {}
}
