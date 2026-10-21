package com.supportfolio.tinyurl.link;

import java.security.SecureRandom;
import org.springframework.stereotype.Component;

/**
 * Generates collision-resistant slugs: exactly 8 characters from the 62-character alphanumeric
 * alphabet, {@link SecureRandom}-backed. The space (62^8) keeps collision probability negligible
 * for this project's scale; retry-on-race still exists in the service as the second line.
 */
@Component
public class SlugGenerator {

  private static final String ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  private static final int LENGTH = 8;
  private static final SecureRandom RANDOM = new SecureRandom();

  /** Default constructor; Spring wires it as a bean, tests instantiate it directly. */
  public SlugGenerator() {}

  public String next() {
    char[] slug = new char[LENGTH];
    for (int i = 0; i < LENGTH; i++) {
      slug[i] = ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length()));
    }
    return new String(slug);
  }
}
