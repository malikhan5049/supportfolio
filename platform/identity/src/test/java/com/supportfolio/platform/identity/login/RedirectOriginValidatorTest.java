package com.supportfolio.platform.identity.login;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

class RedirectOriginValidatorTest {

  private final RedirectOriginValidator validator = new RedirectOriginValidator();

  @Test
  void allowsExactOriginMatch() {
    assertTrue(
        validator.isValid(
            "https://shell.example.com/some/path", List.of("https://shell.example.com")));
  }

  @Test
  void rejectsLookalikeOrigin() {
    assertFalse(
        validator.isValid(
            "https://shell.example.com.evil.com/hook", List.of("https://shell.example.com")));
  }

  @Test
  void rejectsDifferentPortAndScheme() {
    assertFalse(
        validator.isValid("http://shell.example.com", List.of("https://shell.example.com")));
  }

  @Test
  void rejectsUnparsableUrl() {
    assertFalse(validator.isValid("::::not-a-url", List.of("https://shell.example.com")));
  }

  @Test
  void rejectsNullOrBlankUrl() {
    assertFalse(validator.isValid(null, List.of("https://shell.example.com")));
    assertFalse(validator.isValid("   ", List.of("https://shell.example.com")));
  }

  @Test
  void allowsExplicitDefaultPortThatMatchesTheImpliedOne() {
    assertTrue(
        validator.isValid(
            "https://shell.example.com:443/hook", List.of("https://shell.example.com")));
  }
}
