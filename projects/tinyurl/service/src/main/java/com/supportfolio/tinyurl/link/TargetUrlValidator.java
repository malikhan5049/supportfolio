package com.supportfolio.tinyurl.link;

import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Objects;
import org.springframework.stereotype.Component;

@Component
public class TargetUrlValidator {

  private final TargetResolver resolver;

  public TargetUrlValidator(TargetResolver resolver) {
    this.resolver = Objects.requireNonNull(resolver);
  }

  public URI validate(String rawTargetUrl) throws InvalidTargetUrlException {
    if (rawTargetUrl == null) {
      throw new InvalidTargetUrlException("Target URL is required");
    }

    URI target;
    try {
      target = URI.create(rawTargetUrl.trim());
    } catch (IllegalArgumentException exception) {
      throw new InvalidTargetUrlException("Target URL is malformed", exception);
    }

    String scheme = target.getScheme();
    if (!target.isAbsolute()
        || scheme == null
        || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))) {
      throw new InvalidTargetUrlException("Target URL must use HTTP or HTTPS");
    }
    if (target.getHost() == null || target.getHost().isBlank()) {
      throw new InvalidTargetUrlException("Target URL must include a host");
    }
    if (target.getUserInfo() != null) {
      throw new InvalidTargetUrlException("Target URL must not include credentials");
    }

    String host = unbracketIpv6(target.getHost());
    InetAddress[] addresses;
    try {
      addresses = resolver.resolve(host);
    } catch (UnknownHostException exception) {
      throw new InvalidTargetUrlException("Target URL host could not be resolved", exception);
    }
    if (addresses == null || addresses.length == 0) {
      throw new InvalidTargetUrlException("Target URL host has no resolved addresses");
    }
    for (InetAddress address : addresses) {
      if (address == null || isUnsafeAddress(address)) {
        throw new InvalidTargetUrlException("Target URL must resolve only to public addresses");
      }
    }

    return target.normalize();
  }

  private static String unbracketIpv6(String host) {
    if (host.startsWith("[") && host.endsWith("]")) {
      return host.substring(1, host.length() - 1);
    }
    return host;
  }

  private static boolean isUnsafeAddress(InetAddress address) {
    if (address.isAnyLocalAddress()
        || address.isLoopbackAddress()
        || address.isLinkLocalAddress()
        || address.isSiteLocalAddress()
        || address.isMulticastAddress()) {
      return true;
    }
    if (address instanceof Inet6Address) {
      byte[] bytes = address.getAddress();
      return (bytes[0] & 0xfe) == 0xfc;
    }
    return false;
  }
}
