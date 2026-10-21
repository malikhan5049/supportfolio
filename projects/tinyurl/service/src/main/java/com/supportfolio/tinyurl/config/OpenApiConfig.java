package com.supportfolio.tinyurl.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Metadata for the published OpenAPI document. */
@Configuration
public class OpenApiConfig {

  @Bean
  OpenAPI tinyUrlOpenApi() {
    return new OpenAPI().info(new Info().title("TinyURL API").version("1.0.0"));
  }
}
