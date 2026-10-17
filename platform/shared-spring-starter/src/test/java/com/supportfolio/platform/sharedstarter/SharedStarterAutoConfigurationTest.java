package com.supportfolio.platform.sharedstarter;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class SharedStarterAutoConfigurationTest {
  private final ApplicationContextRunner contextRunner =
      new ApplicationContextRunner()
          .withConfiguration(AutoConfigurations.of(SharedStarterAutoConfiguration.class));

  @Test
  void registersHealthAndLoggingCustomizers() {
    contextRunner.run(
        context -> {
          assertThat(context).hasSingleBean(HealthEndpointCustomizer.class);
          assertThat(context).hasSingleBean(CommonLoggingCustomizer.class);
        });
  }
}
