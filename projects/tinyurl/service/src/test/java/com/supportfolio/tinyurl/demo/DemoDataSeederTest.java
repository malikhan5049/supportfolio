package com.supportfolio.tinyurl.demo;

import static org.assertj.core.api.Assertions.assertThat;

import com.supportfolio.tinyurl.PostgresIntegrationTest;
import com.supportfolio.tinyurl.link.LinkClickRepository;
import com.supportfolio.tinyurl.link.LinkRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.transaction.AfterTransaction;

@SpringBootTest(properties = "supportfolio.tinyurl.demo-seed-enabled=true")
class DemoDataSeederTest extends PostgresIntegrationTest {

  @Autowired LinkRepository links;
  @Autowired LinkClickRepository clicks;

  @Test
  void seedsFiveLinksWithClicks() {
    assertThat(links.count()).isEqualTo(5);
    assertThat(clicks.count()).isGreaterThan(0);
    assertThat(links.findAllWithClickCounts())
        .anyMatch(summary -> summary.getClickCount() > 0);
  }

  @AfterTransaction
  void tearDown() {
    links.deleteAll();
    clicks.deleteAll();
  }
}
