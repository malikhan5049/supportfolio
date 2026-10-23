package com.supportfolio.tinyurl;

import com.supportfolio.tinyurl.config.TinyUrlProperties;
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

  @Bean
  Clock clock() {
    return Clock.systemUTC();
  }

  @Bean
  TargetResolver targetResolver() {
    return InetAddress::getAllByName;
  }

  public static void main(String[] args) {
    SpringApplication.run(TinyUrlApplication.class, args);
  }
}
