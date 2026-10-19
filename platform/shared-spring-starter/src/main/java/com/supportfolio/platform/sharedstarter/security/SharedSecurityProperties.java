package com.supportfolio.platform.sharedstarter.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Connection details for validating JWTs issued by the supportfolio Identity service. The starter
 * itself only knows the shape of the contract: a JWK Set URI to fetch verification keys from and
 * the issuer URI every token must carry.
 */
@ConfigurationProperties("supportfolio.security")
public record SharedSecurityProperties(String jwkSetUri, String issuerUri) {}
