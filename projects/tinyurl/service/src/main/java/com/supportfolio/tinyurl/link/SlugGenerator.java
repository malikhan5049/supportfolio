package com.supportfolio.tinyurl.link;

import java.security.SecureRandom;
import org.springframework.stereotype.Component;

@Component
public class SlugGenerator {

  private static final String ALPHABET =
      "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  private static final int SLUG_LENGTH = 8;

  private final SecureRandom random = new SecureRandom();

  public String next() {
    StringBuilder slug = new StringBuilder(SLUG_LENGTH);
    for (int i = 0; i < SLUG_LENGTH; i++) {
      slug.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
    }
    return slug.toString();
  }
}
