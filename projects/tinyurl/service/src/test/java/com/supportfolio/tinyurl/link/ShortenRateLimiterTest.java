package com.supportfolio.tinyurl.link;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.supportfolio.tinyurl.config.TinyUrlProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class ShortenRateLimiterTest {

  private final MutableClock clock = new MutableClock(Instant.parse("2026-10-23T12:00:00Z"));
  private final ShortenRateLimiter limiter =
      new ShortenRateLimiter(new TinyUrlProperties("", 20), clock);

  @Test
  void allowsExactlyTwentyPerUserInAnHour() {
    for (int i = 0; i < 20; i++) {
      assertTrue(limiter.tryAcquire("u1"));
    }
    assertFalse(limiter.tryAcquire("u1"));
  }

  @Test
  void resetsWhenTheHourChanges() {
    for (int i = 0; i < 20; i++) {
      assertTrue(limiter.tryAcquire("u1"));
    }
    assertFalse(limiter.tryAcquire("u1"));

    clock.advance(Duration.ofHours(1));

    assertTrue(limiter.tryAcquire("u1"));
  }

  @Test
  void isolatesUsers() {
    for (int i = 0; i < 20; i++) {
      assertTrue(limiter.tryAcquire("u1"));
    }

    assertTrue(limiter.tryAcquire("u2"));
  }

  @Test
  void neverThrowsUnderConcurrentCalls() throws Exception {
    ExecutorService executor = Executors.newFixedThreadPool(8);
    try {
      List<java.util.concurrent.Callable<Boolean>> calls = new ArrayList<>();
      for (int i = 0; i < 40; i++) {
        calls.add(() -> limiter.tryAcquire("u1"));
      }
      List<Future<Boolean>> results = executor.invokeAll(calls);
      int allowed = 0;
      for (Future<Boolean> result : results) {
        if (result.get()) {
          allowed++;
        }
      }
      assertTrue(allowed == 20);
    } finally {
      executor.shutdownNow();
    }
  }

  private static final class MutableClock extends Clock {

    private final AtomicReference<Instant> instant;

    private MutableClock(Instant instant) {
      this.instant = new AtomicReference<>(instant);
    }

    @Override
    public ZoneId getZone() {
      return ZoneOffset.UTC;
    }

    @Override
    public Clock withZone(ZoneId zone) {
      return this;
    }

    @Override
    public Instant instant() {
      return instant.get();
    }

    private void advance(Duration duration) {
      instant.updateAndGet(current -> current.plus(duration));
    }
  }
}
