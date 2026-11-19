package com.supportfolio.tinyurl.demo;

import static org.assertj.core.api.Assertions.assertThat;

import com.supportfolio.tinyurl.PostgresIntegrationTest;
import com.supportfolio.tinyurl.link.LinkRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
// Override the shared base's @Transactional so the assertions read committed state (what the
// ApplicationRunner wrote at context startup), not a test-managed transaction snapshot.
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class DemoDataSeederDisabledTest extends PostgresIntegrationTest {

  @Autowired ApplicationContext context;
  @Autowired LinkRepository links;

  // No @BeforeEach deleteAll on purpose: cleanup here would wipe rows the seeder might have
  // written at startup, making the "no links" assertion vacuously true. This class never
  // inserts, and the only other non-transactional test class (DemoDataSeederTest) deletes its
  // rows in @AfterEach, so an empty table is a real observation rather than bookkeeping.
  @Test
  void doesNotSeedWhenPropertyIsAbsent() {
    assertThat(context.getBeansOfType(DemoDataSeeder.class)).isEmpty();
    assertThat(links.count()).isEqualTo(0);
  }
}
