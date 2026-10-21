package com.supportfolio.tinyurl;

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
}
