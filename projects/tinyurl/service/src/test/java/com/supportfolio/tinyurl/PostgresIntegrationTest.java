package com.supportfolio.tinyurl;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.annotation.DirtiesContext;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@SpringBootTest
@Testcontainers
public abstract class PostgresIntegrationTest {

  @Container @ServiceConnection
  static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18.6-bookworm");
}
