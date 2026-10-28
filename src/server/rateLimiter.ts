/**
 * Lodhi AI — Server-Side Rate Limiter & Abuse Protection
 * Implements a sliding window memory algorithm for rate-limiting authentication,
 * API requests, and webhook delivery endpoints.
 */

interface RateLimitRecord {
  timestamps: number[];
}

export class SlidingWindowRateLimiter {
  private records = new Map<string, RateLimitRecord>();

  /**
   * Consume a hit for a key. Returns whether the request is allowed,
   * remaining hits allowed in current window, and unix timestamp (seconds) when reset occurs.
   */
  consume(
    key: string,
    limit: number,
    windowSeconds: number
  ): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const cutoff = now - windowMs;

    let record = this.records.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.records.set(key, record);
    }

    // Filter out expired timestamps
    record.timestamps = record.timestamps.filter(ts => ts > cutoff);

    const oldest = record.timestamps[0] || now;
    const resetAt = Math.ceil((oldest + windowMs) / 1000);

    if (record.timestamps.length >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    record.timestamps.push(now);
    const remaining = Math.max(0, limit - record.timestamps.length);

    return {
      allowed: true,
      remaining,
      resetAt,
    };
  }

  /**
   * Manually reset quota for a specific key (e.g. after successful captcha)
   */
  reset(key: string): void {
    this.records.delete(key);
  }

  /**
   * Clear all rate limiter records (for tests)
   */
  clearAll(): void {
    this.records.clear();
  }
}

// Global singleton instances for API & Auth
export const authRateLimiter = new SlidingWindowRateLimiter(); // e.g. 5 attempts / 60s
export const apiRateLimiter = new SlidingWindowRateLimiter(); // e.g. 60 requests / 60s
