package com.supportfolio.tinyurl;

import com.supportfolio.tinyurl.link.TargetResolver;
import java.net.InetAddress;
import java.time.Clock;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
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
}
