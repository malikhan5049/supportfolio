package com.supportfolio.platform.sharedstarter;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.context.annotation.Bean;

@AutoConfiguration
public class SharedStarterAutoConfiguration {

    @Bean
    public HealthEndpointCustomizer healthEndpointCustomizer() {
        return new HealthEndpointCustomizer();
    }

    @Bean
    public CommonLoggingCustomizer commonLoggingCustomizer() {
        return new CommonLoggingCustomizer();
    }
}
