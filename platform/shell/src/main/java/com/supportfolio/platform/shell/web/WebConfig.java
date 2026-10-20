package com.supportfolio.platform.shell.web;

import com.supportfolio.platform.shell.registry.RemoteRegistryProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

/** Registers the security headers filter ahead of every other filter in the chain. */
@Configuration
public class WebConfig {

  @Bean
  CspPolicy cspPolicy(RemoteRegistryProperties properties) {
    return new CspPolicy(properties.trustedRemoteOrigins());
  }

  @Bean
  FilterRegistrationBean<SecurityHeadersFilter> securityHeadersFilter(CspPolicy cspPolicy) {
    FilterRegistrationBean<SecurityHeadersFilter> registration =
        new FilterRegistrationBean<>(new SecurityHeadersFilter(cspPolicy));
    registration.addUrlPatterns("/*");
    registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
    return registration;
  }
}
