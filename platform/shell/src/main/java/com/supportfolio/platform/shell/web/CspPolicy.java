package com.supportfolio.platform.shell.web;

import java.net.URI;
import java.util.List;
import java.util.Locale;

/**
 * Emits the CSP header value from the trusted-origin allowlist (configuration — never registry
 * data). Origins are normalized to scheme+host+port; lookalike hosts never match because the
 * comparison is exact.
 */
public class CspPolicy {

  private final List<String> trustedOrigins;

  public CspPolicy(List<String> trustedOrigins) {
    if (trustedOrigins == null) {
      this.trustedOrigins = List.of();
      return;
    }
    this.trustedOrigins =
        trustedOrigins.stream().map(CspPolicy::normalizedOrigin).toList();
  }

  public String headerValue() {
    String origins = String.join(" ", trustedOrigins);
    return "default-src 'self'"
        + "; script-src 'self'"
        + (origins.isEmpty() ? "" : " " + origins)
        + "; style-src 'self' 'unsafe-inline'"
        + "; img-src 'self' data:; font-src 'self'"
        + "; connect-src 'self'"
        + (origins.isEmpty() ? "" : " " + origins)
        + "; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'";
  }

  private static String normalizedOrigin(String value) {
    URI uri;
    try {
      uri = URI.create(value);
    } catch (RuntimeException e) {
      throw new IllegalStateException("Not a valid trusted origin: " + value, e);
    }
    if (uri.getScheme() == null
        || uri.getHost() == null
        || uri.getPath() != null && !uri.getPath().isBlank() && !uri.getPath().equals("/")
        || uri.getQuery() != null
        || uri.getFragment() != null
        || (!uri.getScheme().equalsIgnoreCase("http")
            && !uri.getScheme().equalsIgnoreCase("https"))) {
      throw new IllegalStateException("Not a valid trusted origin: " + value);
    }
    String scheme = uri.getScheme().toLowerCase(Locale.ROOT);
    String host = uri.getHost().toLowerCase(Locale.ROOT);
    int port = uri.getPort() == -1 ? (scheme.equals("https") ? 443 : 80) : uri.getPort();
    if ((scheme.equals("http") && port == 80) || (scheme.equals("https") && port == 443)) {
      return scheme + "://" + host;
    }
    return scheme + "://" + host + ":" + port;
  }
}
