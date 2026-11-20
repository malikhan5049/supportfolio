package com.supportfolio.tinyurl;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Shared base for tests that need the real PostgreSQL schema, using the singleton container
 * pattern: the container starts once for the whole test JVM (a static initializer, not JUnit
 * lifecycle), because Spring caches one application context across the subclass test classes and
 * the cached datasource points at a fixed port. The image tag is verified against the official
 * image page (postgresql 18 is the current stable major line). Tests that must kill their database
 * on purpose (HealthProbeTest) declare their own container instead of extending this base.
 *
 * <p>{@code management.server.port=0} lives here (an inherited {@code @TestPropertySource}, which
 * merges with each subclass's own {@code @SpringBootTest} properties) so that every integrated test
 * context starts its management server on an anonymous port instead of hard-binding the production
 * default 9093. Without it the suite only stays green while a single cached context is in use.
 */
@SpringBootTest
@TestPropertySource(properties = "management.server.port=0")
@Transactional
public class PostgresIntegrationTest {

  @ServiceConnection
  static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18-alpine");

  static {
    POSTGRES.start();
  }
}
