package com.supportfolio.tinyurl.link;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.net.InetAddress;
import java.net.UnknownHostException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class TargetUrlValidatorTest {

  @Test
  void acceptsPublicHttpAndHttpsTargets() {
    TargetUrlValidator validator = new TargetUrlValidator(this::resolvePublicExample);

    assertEquals(
        "https://example.com/path?q=1",
        validator.validate(" https://example.com/path?q=1 ").toString());
    assertEquals(
        "http://example.com/path", validator.validate("http://example.com/path").toString());
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
    assertThrows(
        InvalidTargetUrlException.class,
        () -> new TargetUrlValidator(this::resolveAddress).validate(raw));
  }

  @Test
  void rejectsWhenAnyResolvedAddressIsPrivate() {
    TargetUrlValidator validator =
        new TargetUrlValidator(
            host -> new InetAddress[] {address("93.184.216.34"), address("10.0.0.5")});

    assertThrows(
        InvalidTargetUrlException.class, () -> validator.validate("https://example.com/path"));
  }

  @Test
  void rejectsWhenDnsResolutionFails() {
    TargetUrlValidator validator =
        new TargetUrlValidator(
            host -> {
              throw new UnknownHostException(host);
            });

    assertThrows(
        InvalidTargetUrlException.class, () -> validator.validate("https://missing.example/path"));
  }

  private InetAddress[] resolvePublicExample(String host) throws UnknownHostException {
    return new InetAddress[] {address("93.184.216.34")};
  }

  private InetAddress[] resolveAddress(String host) throws UnknownHostException {
    String unbracketedHost = host.replace("[", "").replace("]", "");
    if (unbracketedHost.equals("example.com")) {
      return new InetAddress[] {address("93.184.216.34")};
    }
    return new InetAddress[] {InetAddress.getByName(unbracketedHost)};
  }

  private static InetAddress address(String address) {
    try {
      return InetAddress.getByName(address);
    } catch (UnknownHostException exception) {
      throw new AssertionError(exception);
    }
  }
}
