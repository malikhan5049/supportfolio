package com.supportfolio.tinyurl.demo;

import com.supportfolio.tinyurl.link.LinkClickEntity;
import com.supportfolio.tinyurl.link.LinkClickRepository;
import com.supportfolio.tinyurl.link.LinkEntity;
import com.supportfolio.tinyurl.link.LinkRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@ConditionalOnProperty(name = "supportfolio.tinyurl.demo-seed-enabled", havingValue = "true")
public class DemoDataSeeder implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);

  private final LinkRepository links;
  private final LinkClickRepository clicks;
  private final Clock clock;

  public DemoDataSeeder(LinkRepository links, LinkClickRepository clicks, Clock clock) {
    this.links = links;
    this.clicks = clicks;
    this.clock = clock;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    if (links.count() > 0) {
      log.info("Demo seed skipped: links table is not empty");
      return;
    }

    log.info("Seeding demo links");
    Instant now = clock.instant();

    List<LinkEntity> seedLinks =
        List.of(
            new LinkEntity(
                UUID.randomUUID(),
                "docs",
                "https://docs.spring.io/spring-boot",
                "demo",
                now.minus(1, ChronoUnit.DAYS)),
            new LinkEntity(
                UUID.randomUUID(),
                "spring",
                "https://spring.io",
                "demo",
                now.minus(2, ChronoUnit.DAYS)),
            new LinkEntity(
                UUID.randomUUID(),
                "angular",
                "https://angular.dev",
                "demo",
                now.minus(3, ChronoUnit.DAYS)),
            new LinkEntity(
                UUID.randomUUID(),
                "k3s-retro",
                "https://k3s.io",
                "demo",
                now.minus(5, ChronoUnit.DAYS)),
            new LinkEntity(
                UUID.randomUUID(),
                "demo",
                "https://www.supportfolio.dev",
                "demo",
                now.minus(7, ChronoUnit.DAYS)));

    List<LinkEntity> saved = links.saveAll(seedLinks);

    int[] clickCounts = {3, 0, 7, 1, 0};
    for (int i = 0; i < saved.size(); i++) {
      LinkEntity link = saved.get(i);
      for (int j = 0; j < clickCounts[i]; j++) {
        clicks.save(
            new LinkClickEntity(UUID.randomUUID(), link, now.minus(j + 1, ChronoUnit.HOURS)));
      }
    }
  }
}
