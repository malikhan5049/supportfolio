package com.supportfolio.tinyurl.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * TinyURL-specific settings. {@code identityUri} is the Identity service base the gateway proxy
 * routes the four browser endpoints to. {@code rateLimitPerHour} is the shorten cap per user per
 * fixed hourly window (Task 8's limiter).
 */
@ConfigurationProperties("supportfolio.tinyurl")
public record TinyUrlProperties(
    String identityUri, @DefaultValue("20") int rateLimitPerHour) {}
