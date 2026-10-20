package com.supportfolio.platform.shell.registry;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * The shell's own configuration: where Identity lives, which file holds the remote registry, and
 * which origins may be loaded as remotes. Trusted origins are configuration, never derived from
 * registry data, so a compromised registry file cannot widen the CSP.
 */
@ConfigurationProperties("supportfolio.shell")
public record RemoteRegistryProperties(
    String identityUri, String remoteRegistryFile, List<String> trustedRemoteOrigins) {}
