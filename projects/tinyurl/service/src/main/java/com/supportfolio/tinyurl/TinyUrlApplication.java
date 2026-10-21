package com.supportfolio.tinyurl;

import com.supportfolio.tinyurl.config.TinyUrlProperties;
import com.supportfolio.tinyurl.link.ShortenRateLimiter;
import com.supportfolio.tinyurl.link.TargetResolver;
import java.net.InetAddress;
import java.time.Clock;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
@EnableConfigurationProperties(TinyUrlProperties.class)
public class TinyUrlApplication {

  public static void main(String[] args) {
    SpringApplication.run(TinyUrlApplication.class, args);
  }

  /** UTC clock so time-window logic (rate limits) and click timestamps are deterministic. */
  @Bean
  Clock clock() {
    return Clock.systemUTC();
  }

  /** Default resolver uses real DNS; tests override this bean with a deterministic one. */
  @Bean
  TargetResolver targetResolver() {
    return host -> InetAddress.getAllByName(host);
  }

  /** In-process hourly cap for the shortening endpoint (see the class's scaling limitation). */
  @Bean
  ShortenRateLimiter shortenRateLimiter(TinyUrlProperties properties, Clock clock) {
    return new ShortenRateLimiter(properties, clock);
  }
}
