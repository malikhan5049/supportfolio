package com.supportfolio.tinyurl.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties("supportfolio.tinyurl")
public record TinyUrlProperties(String identityUri, @DefaultValue("20") int rateLimitPerHour) {}
