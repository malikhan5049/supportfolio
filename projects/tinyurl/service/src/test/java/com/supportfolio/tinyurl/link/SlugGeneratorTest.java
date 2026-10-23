package com.supportfolio.tinyurl.link;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

class SlugGeneratorTest {

  private final SlugGenerator generator = new SlugGenerator();

  @Test
  void generatesEightCharacterAlphanumericSlugs() {
    assertThat(generator.next()).matches("[0-9A-Za-z]{8}");
  }

  @Test
  void doesNotRepeatAcrossOneThousandSlugs() {
    Set<String> seen = new HashSet<>();
    for (int i = 0; i < 1000; i++) {
      assertThat(seen.add(generator.next())).isTrue();
    }
  }
}
