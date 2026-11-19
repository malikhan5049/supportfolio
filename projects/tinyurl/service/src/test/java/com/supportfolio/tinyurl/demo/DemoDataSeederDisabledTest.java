package com.supportfolio.tinyurl.demo;

import static org.assertj.core.api.Assertions.assertThat;

import com.supportfolio.tinyurl.PostgresIntegrationTest;
import com.supportfolio.tinyurl.link.LinkRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
// Override the shared base's @Transactional so cleanup commits independently of any test
// transaction. This keeps the singleton Testcontainers database tidy even if the base-class
// transaction policy ever changes.
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class DemoDataSeederDisabledTest extends PostgresIntegrationTest {

  @Autowired LinkRepository links;

  @BeforeEach
  void setUp() {
    links.deleteAll();
  }

  @Test
  void doesNotSeedWhenPropertyIsAbsent() {
    assertThat(links.count()).isEqualTo(0);
  }

  @AfterEach
  void tearDown() {
    links.deleteAll();
  }
}
