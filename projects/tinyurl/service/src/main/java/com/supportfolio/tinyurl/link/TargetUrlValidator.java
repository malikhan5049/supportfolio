package com.supportfolio.tinyurl.link;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Objects;

/**
 * Creation-time validation of the target URL a user wants to shorten. Only absolute http/https to
 * a public, resolvable host without embedded credentials is acceptable: every resolved address is
 * checked so a name that maps to a mix of public and private addresses is rejected (a partial
 * private set is an SSRF surface, not a safe one). The service never fetches the target — this
 * class only decides creation — so redirects always go to the fixed stored value.
 */
public final class TargetUrlValidator {

  private final TargetResolver resolver;

  public TargetUrlValidator(TargetResolver resolver) {
    this.resolver = Objects.requireNonNull(resolver);
  }

  public URI validate(String rawTargetUrl) {
    String candidate = rawTargetUrl == null ? "" : rawTargetUrl.trim();
    URI uri;
    try {
      uri = URI.create(candidate);
    } catch (IllegalArgumentException e) {
      throw new InvalidTargetUrlException("target url is not a valid URI", e);
    }
    String scheme = uri.getScheme();
    if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
      throw new InvalidTargetUrlException("target url must be http or https");
    }
    String host = uri.getHost();
    if (host == null || host.isBlank()) {
      throw new InvalidTargetUrlException("target url has no host");
    }
    if (uri.getUserInfo() != null) {
      throw new InvalidTargetUrlException("target url must not carry embedded credentials");
    }
    for (InetAddress address : resolveAll(host)) {
      if (isForbiddenAddress(address)) {
        throw new InvalidTargetUrlException("target host must not resolve to a private range");
      }
    }
    return uri;
  }

  /**
   * Loopback, site-local, link-local (incl. cloud metadata {@code 169.254.169.254}), any-local,
   * multicast, and IPv6 unique-local {@code fc00::/7} are all forbidden at creation time.
   */
  private static boolean isForbiddenAddress(InetAddress address) {
    byte[] bytes = address.getAddress();
    boolean uniqueLocalIpv6 = bytes.length == 16 && (bytes[0] & 0xFE) == 0xFC;
    return address.isLoopbackAddress()
        || address.isSiteLocalAddress()
        || address.isLinkLocalAddress()
        || address.isAnyLocalAddress()
        || address.isMulticastAddress()
        || uniqueLocalIpv6;
  }

  private InetAddress[] resolveAll(String host) {
    String unbracketed = host.startsWith("[") && host.endsWith("]") ? host.substring(1, host.length() - 1) : host;
    try {
      return resolver.resolve(unbracketed);
    } catch (UnknownHostException e) {
      throw new InvalidTargetUrlException("target host does not resolve", e);
    }
  }
}
