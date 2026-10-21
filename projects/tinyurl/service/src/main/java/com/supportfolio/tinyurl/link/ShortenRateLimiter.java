package com.supportfolio.tinyurl.link;

import com.supportfolio.tinyurl.config.TinyUrlProperties;
import java.time.Clock;
import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * In-process fixed hourly window for the shorten cap. LIMITATION BY DESIGN: each instance counts
 * its own window — with more than one replica the effective cap is limit × replicas. Replace with a
 * shared store (e.g. Redis or the database) only when a second replica of this service exists.
 */
public class ShortenRateLimiter {

  private static final long WINDOW_SECONDS = Duration.ofHours(1).toSeconds();

  private final int limitPerHour;
  private final Clock clock;
  private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

  /**
   * One user's budget holder — the epoch hour this window belongs to and how many accepted acquires
   * have consumed it. {@link AtomicInteger} so parallel acquires cannot overshoot.
   */
  private record Window(long hour, AtomicInteger count) {}

  public ShortenRateLimiter(TinyUrlProperties properties, Clock clock) {
    this.limitPerHour = properties.rateLimitPerHour();
    this.clock = clock;
  }

  public boolean tryAcquire(String userId) {
    long hour = clock.instant().getEpochSecond() / WINDOW_SECONDS;
    var window =
        windows.compute(
            userId,
            (user, existing) -> {
              if (existing != null && existing.hour() == hour) {
                return existing;
              }
              return new Window(hour, new AtomicInteger(0));
            });
    var count = window.count();
    while (true) {
      int seen = count.get();
      if (seen >= limitPerHour) {
        return false;
      }
      if (count.compareAndSet(seen, seen + 1)) {
        return true;
      }
    }
  }
}
