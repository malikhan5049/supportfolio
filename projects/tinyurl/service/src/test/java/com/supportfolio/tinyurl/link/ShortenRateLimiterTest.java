package com.supportfolio.tinyurl.link;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.supportfolio.tinyurl.config.TinyUrlProperties;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

/**
 * The in-process fixed-window limiter: 20/hour default, read from properties, hour-keyed, isolated
 * per user, and thread-safe (concurrent acquires do not overshoot the window budget).
 */
class ShortenRateLimiterTest {

  private static final Instant HOUR0 = Instant.parse("2026-10-21T14:00:00Z");

  private TinyUrlProperties properties(int perHour) {
    return new TinyUrlProperties("http://identity.example", perHour);
  }

  @Test
  void allowsExactlyTwentyPerUserInAnHour() {
    ShortenRateLimiter limiter = new ShortenRateLimiter(properties(20), fixed(HOUR0));

    for (int i = 0; i < 20; i++) assertTrue(limiter.tryAcquire("u1"));

    assertFalse(limiter.tryAcquire("u1"));
  }

  @Test
  void resetsWhenTheHourChanges() {
    Instant hour1 = Instant.parse("2026-10-21T15:00:00Z");
    MutableClock clock = new MutableClock(HOUR0);
    ShortenRateLimiter limiter = new ShortenRateLimiter(properties(20), clock);

    for (int i = 0; i < 20; i++) limiter.tryAcquire("u1");
    assertFalse(limiter.tryAcquire("u1")); // still the same hour

    clock.advance(hour1);
    assertTrue(limiter.tryAcquire("u1"));
  }

  @Test
  void isolatesUsers() {
    ShortenRateLimiter limiter = new ShortenRateLimiter(properties(20), fixed(HOUR0));

    for (int i = 0; i < 20; i++) limiter.tryAcquire("u1");

    assertTrue(limiter.tryAcquire("u2"));
  }

  @Test
  void neverThrowsUnderConcurrentCalls() throws Exception {
    ShortenRateLimiter limiter = new ShortenRateLimiter(properties(20), fixed(HOUR0));
    int callers = 40;
    var pool = Executors.newFixedThreadPool(8);
    var countedDown = new CountDownLatch(callers);
    var accepted = new AtomicInteger();

    for (int i = 0; i < callers; i++) {
      pool.submit(
          () -> {
            try {
              if (limiter.tryAcquire("contended")) {
                accepted.incrementAndGet();
              }
            } finally {
              countedDown.countDown();
            }
          });
    }
    countedDown.await(10, TimeUnit.SECONDS);
    pool.shutdownNow();

    assertEquals(20, accepted.get());
  }

  @Test
  void readsTheConfiguredCap() {
    ShortenRateLimiter limiter = new ShortenRateLimiter(properties(2), fixed(HOUR0));

    assertTrue(limiter.tryAcquire("u1"));
    assertTrue(limiter.tryAcquire("u1"));
    assertFalse(limiter.tryAcquire("u1"));
  }

  private Clock fixed(Instant now) {
    return new MutableClock(now);
  }

  /** Test scaffolding: a Clock the real app'd never see — its instant is mutable for hour tests. */
  static final class MutableClock extends Clock {

    private volatile Instant now;

    MutableClock(Instant start) {
      this.now = start;
    }

    void advance(Instant newNow) {
      this.now = newNow;
    }

    @Override
    public ZoneOffset getZone() {
      return ZoneOffset.UTC;
    }

    @Override
    public Clock withZone(java.time.ZoneId zone) {
      return this;
    }

    @Override
    public Instant instant() {
      return now;
    }
  }
}
