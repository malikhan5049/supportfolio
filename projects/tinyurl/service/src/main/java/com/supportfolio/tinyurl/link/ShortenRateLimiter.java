package com.supportfolio.tinyurl.link;

import com.supportfolio.tinyurl.config.TinyUrlProperties;
import java.time.Clock;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.stereotype.Component;

/**
 * Enforces an instance-local fixed hourly window. Each replica has its own window; replace this
 * limiter with a shared store before running more than one replica.
 */
@Component
public class ShortenRateLimiter {

  private static final long SECONDS_PER_HOUR = 60 * 60;

  private final TinyUrlProperties properties;
  private final Clock clock;
  private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

  public ShortenRateLimiter(TinyUrlProperties properties, Clock clock) {
    this.properties = properties;
    this.clock = clock;
  }

  public boolean tryAcquire(String userId) {
    long currentHour = Math.floorDiv(clock.instant().getEpochSecond(), SECONDS_PER_HOUR);
    AtomicBoolean acquired = new AtomicBoolean();
    windows.compute(
        userId,
        (key, current) -> {
          Window window =
              current == null || current.hour != currentHour ? new Window(currentHour) : current;
          acquired.set(window.count.incrementAndGet() <= properties.rateLimitPerHour());
          return window;
        });
    return acquired.get();
  }

  private static final class Window {

    private final long hour;
    private final AtomicInteger count = new AtomicInteger();

    private Window(long hour) {
      this.hour = hour;
    }
  }
}
