package com.supportfolio.platform.shell.web;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

class CspPolicyTest {

  @Test
  void scriptSrcAllowsSelfAndTrustedOriginsOnly() {
    String csp =
        new CspPolicy(List.of("http://localhost:4301", "https://cdn.example.com")).headerValue();
    assertTrue(
        csp.contains("script-src 'self' http://localhost:4301 https://cdn.example.com"), csp);
    assertFalse(csp.contains("'unsafe-eval'"));
    assertTrue(
        Arrays.stream(csp.split(";"))
            .noneMatch(
                d -> d.trim().startsWith("script-src") && d.contains("'unsafe-inline'")));
    assertTrue(csp.contains("frame-ancestors 'none'"));
  }

  @Test
  void lookalikeOriginIsNotTrustedBecauseTheListIsExact() {
    String csp = new CspPolicy(List.of("https://cdn.example.com")).headerValue();
    assertFalse(csp.contains("cdn.example.com.evil.com"));
  }

  @Test
  void defaultPortIsNormalizedAndOriginsAppearInConnectSrcToo() {
    String csp = new CspPolicy(List.of("https://cdn.example.com")).headerValue();
    assertFalse(
        Arrays.stream(csp.split(";"))
            .anyMatch(d -> d.contains("cdn.example.com") && d.trim().startsWith("script-src")
                && !d.contains("https://cdn.example.com")),
        csp);
    assertTrue(csp.contains("connect-src 'self' https://cdn.example.com"), csp);
  }

  @Test
  void invalidOriginFailsFastAtConstruction() {
    org.junit.jupiter.api.Assertions.assertThrows(
        IllegalStateException.class, () -> new CspPolicy(List.of("https://cdn.example.com/x")));
  }
}
