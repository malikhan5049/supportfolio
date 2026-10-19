package com.supportfolio.platform.identity.login;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Locale;

/**
 * Gates the post-login redirect target: its scheme, host, and port (normalized to lower case and to
 * an explicit port) must exactly equal one configured allowed origin. Anything that fails to parse,
 * carries no scheme or host, or uses a non-HTTP scheme is rejected.
 */
public class RedirectOriginValidator {

  /** True only when {@code url}'s origin exactly equals one of {@code allowedOrigins}. */
  public boolean isValid(String url, List<String> allowedOrigins) {
    if (url == null || url.isBlank() || allowedOrigins == null || allowedOrigins.isEmpty()) {
      return false;
    }
    String targetOrigin = originOf(url);
    if (targetOrigin == null) {
      return false;
    }
    for (String allowedOrigin : allowedOrigins) {
      if (targetOrigin.equals(originOf(allowedOrigin))) {
        return true;
      }
    }
    return false;
  }

  /** Normalized {@code scheme://host:port}, or null when the argument is not a usable origin. */
  private static String originOf(String url) {
    if (url == null || url.isBlank()) {
      return null;
    }
    URI uri;
    try {
      uri = new URI(url);
    } catch (URISyntaxException e) {
      return null;
    }
    String scheme = uri.getScheme();
    String host = uri.getHost();
    if (scheme == null || host == null) {
      return null;
    }
    scheme = scheme.toLowerCase(Locale.ROOT);
    host = host.toLowerCase(Locale.ROOT);
    int port = uri.getPort();
    if (port == -1) {
      if ("https".equals(scheme)) {
        port = 443;
      } else if ("http".equals(scheme)) {
        port = 80;
      } else {
        return null;
      }
    }
    return scheme + "://" + host + ":" + port;
  }
}
