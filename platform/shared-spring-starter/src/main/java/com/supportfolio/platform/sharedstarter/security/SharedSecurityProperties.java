package com.supportfolio.platform.sharedstarter.security;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Connection details for validating JWTs issued by the supportfolio Identity service. The starter
 * itself only knows the shape of the contract: a JWK Set URI to fetch verification keys from and
 * the issuer URI every token must carry. {@code permitPaths} and {@code csrfIgnorePaths} default to
 * empty so a plain Plan 2 consumer sees exactly the authenticate-everything chain.
 */
@ConfigurationProperties("supportfolio.security")
public record SharedSecurityProperties(
    String jwkSetUri,
    String issuerUri,
    @DefaultValue List<String> permitPaths,
    @DefaultValue List<String> csrfIgnorePaths) {}
