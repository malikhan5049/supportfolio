package com.supportfolio.tinyurl.demo;

import static org.assertj.core.api.Assertions.assertThat;

import com.supportfolio.tinyurl.PostgresIntegrationTest;
import com.supportfolio.tinyurl.link.LinkRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.transaction.AfterTransaction;

@SpringBootTest
class DemoDataSeederDisabledTest extends PostgresIntegrationTest {

  @Autowired LinkRepository links;

  @Test
  void doesNotSeedWhenPropertyIsAbsent() {
    assertThat(links.count()).isEqualTo(0);
  }

  @AfterTransaction
  void tearDown() {
    links.deleteAll();
  }
}
