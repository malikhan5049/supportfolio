package com.supportfolio.tinyurl.link;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Pins creation-time target validation: public http(s) only, SSRF ranges, credentials, DNS failure. */
class TargetUrlValidatorTest {

  @Test
  void acceptsPublicHttpAndHttpsTargets() {
    URI parsed = validator(REGULAR_HOSTS).validate("https://example.com/path?q=1");
    assertEquals("https", parsed.getScheme());
    assertEquals("example.com", parsed.getHost());
    assertEquals("/path", parsed.getRawPath());
    assertEquals("q=1", parsed.getRawQuery());
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "ftp://example.com/x",
        "http://user:pass@example.com/x",
        "http:///missing-host",
        "not a url",
        "http://localhost:8080/x",
        "http://127.0.0.1/x",
        "http://10.0.0.5/x",
        "http://192.168.1.10/x",
        "http://169.254.169.254/latest/meta-data",
        "http://[::1]/x",
        "http://[fc00::1]/x"
      })
  void rejectsUnsafeTargets(String raw) {
    assertThrows(InvalidTargetUrlException.class, () -> validator(REGULAR_HOSTS).validate(raw));
  }

  @Test
  void rejectsWhenAnyResolvedAddressIsPrivate() {
    // example.com resolves to a mix: one public, one private -> reject (a partial private set is
    // an SSRF surface, not a safe one).
    assertThrows(
        InvalidTargetUrlException.class,
        () -> validator(MIXED_HOSTS).validate("http://example.com/x"));
  }

  @Test
  void rejectsWhenDnsResolutionFails() {
    TargetResolver resolver =
        host -> {
          throw new UnknownHostException(host);
        };
    assertThrows(
        InvalidTargetUrlException.class, () -> new TargetUrlValidator(resolver).validate("http://example.com/x"));
  }

  // --- deterministic resolver fixtures -------------------------------------------

  private static final Map<String, InetAddress[]> REGULAR_HOSTS = publicHost("93.184.216.34");

  private static final Map<String, InetAddress[]> MIXED_HOSTS =
      Map.of("example.com", mixedAddresses());

  /** Literal-IP hosts map to themselves; every other host resolves publicly. */
  private static Map<String, InetAddress[]> publicHost(String publicIp) {
    try {
      Map<String, InetAddress> forbidden =
          Map.of(
              "localhost", InetAddress.getByName("127.0.0.1"),
              "127.0.0.1", InetAddress.getByName("127.0.0.1"),
              "10.0.0.5", InetAddress.getByName("10.0.0.5"),
              "192.168.1.10", InetAddress.getByName("192.168.1.10"),
              "169.254.169.254", InetAddress.getByName("169.254.169.254"),
              "::1", InetAddress.getByName("::1"),
              "fc00::1", InetAddress.getByName("fc00::1"));
      Map<String, InetAddress[]> resolved = new java.util.HashMap<>();
      forbidden.forEach((host, address) -> resolved.put(host, new InetAddress[] {address}));
      resolved.put("example.com", new InetAddress[] {InetAddress.getByName(publicIp)});
      return Map.copyOf(resolved);
    } catch (UnknownHostException e) {
      throw new IllegalStateException(e);
    }
  }

  private static InetAddress[] mixedAddresses() {
    try {
      return new InetAddress[] {
        InetAddress.getByName("93.184.216.34"), InetAddress.getByName("10.0.0.5")
      };
    } catch (UnknownHostException e) {
      throw new IllegalStateException(e);
    }
  }

  /** A resolver over the map; unmapped hosts throw UnknownHostException (unresolvable). */
  private static TargetUrlValidator validator(Map<String, InetAddress[]> addresses) {
    return new TargetUrlValidator(
        host -> {
          InetAddress[] found = addresses.get(host);
          if (found == null) {
            throw new UnknownHostException(host);
          }
          return found;
        });
  }
}
