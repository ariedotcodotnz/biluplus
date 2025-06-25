import { D1Database } from '@cloudflare/workers-types';

export interface RateLimit {
  id: string;
  endpoint: string;
  count: number;
  reset_at: string;
}

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

export class RateLimitService {
  private defaultLimits: Record<string, RateLimitConfig> = {
    'comment': { windowMs: 60000, maxRequests: 5 }, // 5 comments per minute
    'vote': { windowMs: 10000, maxRequests: 10 }, // 10 votes per 10 seconds
    'reaction': { windowMs: 5000, maxRequests: 20 }, // 20 reactions per 5 seconds
    'auth': { windowMs: 300000, maxRequests: 5 }, // 5 auth attempts per 5 minutes
    'api': { windowMs: 60000, maxRequests: 100 }, // 100 API calls per minute
  };

  constructor(private db: D1Database) {}

  // Check if request is within rate limit
  async checkRateLimit(
    identifier: string, // IP address or user ID
    endpoint: string,
    customConfig?: RateLimitConfig
  ): Promise<{ allowed: boolean; remaining: number; resetTime: Date }> {
    try {
      const config = customConfig || this.defaultLimits[endpoint] || this.defaultLimits['api'];
      const now = new Date();
      const resetTime = new Date(now.getTime() + config.windowMs);
      const key = `${identifier}:${endpoint}`;

      // Clean up expired entries first
      await this.db.prepare(`
        DELETE FROM rate_limits WHERE reset_at < ?
      `).bind(now.toISOString()).run();

      // Get current count
      const current = await this.db.prepare(`
        SELECT count FROM rate_limits WHERE id = ? AND endpoint = ?
      `).bind(identifier, endpoint).first<{ count: number }>();

      if (!current) {
        // First request in window
        await this.db.prepare(`
          INSERT INTO rate_limits (id, endpoint, count, reset_at)
          VALUES (?, ?, 1, ?)
        `).bind(identifier, endpoint, resetTime.toISOString()).run();

        return {
          allowed: true,
          remaining: config.maxRequests - 1,
          resetTime
        };
      }

      if (current.count >= config.maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          resetTime
        };
      }

      // Increment count
      await this.db.prepare(`
        UPDATE rate_limits SET count = count + 1 WHERE id = ? AND endpoint = ?
      `).bind(identifier, endpoint).run();

      return {
        allowed: true,
        remaining: config.maxRequests - current.count - 1,
        resetTime
      };
    } catch (error) {
      console.error('Rate limit check error:', error);
      // Allow request on error (fail open)
      return {
        allowed: true,
        remaining: 0,
        resetTime: new Date()
      };
    }
  }

  // Reset rate limit for identifier and endpoint
  async resetRateLimit(identifier: string, endpoint: string): Promise<boolean> {
    try {
      await this.db.prepare(`
        DELETE FROM rate_limits WHERE id = ? AND endpoint = ?
      `).bind(identifier, endpoint).run();
      return true;
    } catch (error) {
      console.error('Reset rate limit error:', error);
      return false;
    }
  }

  // Get current rate limit status
  async getRateLimitStatus(
    identifier: string,
    endpoint: string
  ): Promise<{ count: number; remaining: number; resetTime: Date } | null> {
    try {
      const config = this.defaultLimits[endpoint] || this.defaultLimits['api'];
      
      const current = await this.db.prepare(`
        SELECT count, reset_at FROM rate_limits WHERE id = ? AND endpoint = ?
      `).bind(identifier, endpoint).first<{ count: number; reset_at: string }>();

      if (!current) {
        return {
          count: 0,
          remaining: config.maxRequests,
          resetTime: new Date(Date.now() + config.windowMs)
        };
      }

      return {
        count: current.count,
        remaining: Math.max(0, config.maxRequests - current.count),
        resetTime: new Date(current.reset_at)
      };
    } catch (error) {
      console.error('Get rate limit status error:', error);
      return null;
    }
  }

  // Clean up expired rate limits (call periodically)
  async cleanup(): Promise<number> {
    try {
      const result = await this.db.prepare(`
        DELETE FROM rate_limits WHERE reset_at < ?
      `).bind(new Date().toISOString()).run();

      return result.changes || 0;
    } catch (error) {
      console.error('Rate limit cleanup error:', error);
      return 0;
    }
  }
}