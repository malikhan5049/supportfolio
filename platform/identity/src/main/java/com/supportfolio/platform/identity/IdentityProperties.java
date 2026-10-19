package com.supportfolio.platform.identity;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties("supportfolio.identity")
public record IdentityProperties(
    String issuer,
    String adminLogin,
    List<String> allowlist,
    List<String> redirectOrigins,
    String jwtPrivateKeyPem,
    @DefaultValue("https://api.github.com") String githubApiBaseUrl,
    @DefaultValue("60") long codeTtlSeconds,
    @DefaultValue("3600") long accessTokenTtlSeconds) {}
