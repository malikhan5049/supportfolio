package com.supportfolio.platform.sharedstarter.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.FilteredClassLoader;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

class IdentityResourceServerAutoConfigurationTest {
  private final ApplicationContextRunner runner =
      new ApplicationContextRunner()
          .withConfiguration(AutoConfigurations.of(IdentityResourceServerAutoConfiguration.class));

  @Test
  void inertWhenFlagIsAbsent() {
    runner.run(context -> assertThat(context).doesNotHaveBean(SecurityFilterChain.class));
  }

  @Test
  void inertWhenSecurityRuntimeAbsent() {
    runner
        .withClassLoader(new FilteredClassLoader(NimbusJwtDecoder.class, SecurityFilterChain.class))
        .withPropertyValues("supportfolio.security.resource-server.enabled=true")
        .run(context -> assertThat(context).doesNotHaveBean(SecurityFilterChain.class));
  }

  @Test
  void securesEverythingWhenEnabled() {
    runner
        .withPropertyValues(
            "supportfolio.security.resource-server.enabled=true",
            "supportfolio.security.jwk-set-uri=http://localhost:8081/oauth2/jwks",
            "supportfolio.security.issuer-uri=http://localhost:8081")
        .run(context -> assertThat(context).hasSingleBean(SecurityFilterChain.class));
  }
}
