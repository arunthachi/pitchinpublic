/**
 * Rate Limiting Utility
 * Prevents brute force attacks on auth and sensitive endpoints
 *
 * Supports two modes:
 * 1. In-memory (default, works everywhere)
 * 2. Upstash Redis (production recommended, requires UPSTASH_REDIS_REST_URL env var)
 */

interface RateLimitConfig {
  key: string; // Unique identifier (e.g., IP address, user ID)
  limit: number; // Max requests allowed
  window: number; // Time window in seconds
}

interface RateLimitResult {
  success: boolean; // Whether request is allowed
  limit: number; // Max requests
  remaining: number; // Remaining requests in window
  reset: number; // Unix timestamp when window resets
  retryAfter?: number; // Seconds to wait before retrying
}

// In-memory store: { key -> [timestamp, timestamp, ...] }
const memoryStore = new Map<string, number[]>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of memoryStore.entries()) {
    // Keep only timestamps from last hour (3600 seconds)
    const recentTimestamps = timestamps.filter(ts => now - ts < 3600000);
    if (recentTimestamps.length === 0) {
      memoryStore.delete(key);
    } else {
      memoryStore.set(key, recentTimestamps);
    }
  }
}, 300000); // Every 5 minutes

/**
 * In-memory rate limiter
 * Fast, no dependencies, good for development
 */
async function memoryRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = config.window * 1000;

  // Get or create request timestamps for this key
  let timestamps = memoryStore.get(config.key) || [];

  // Remove requests outside the current window
  timestamps = timestamps.filter(ts => now - ts < windowMs);

  const remaining = Math.max(0, config.limit - timestamps.length);
  const success = remaining > 0;

  if (success) {
    // Add this request's timestamp
    timestamps.push(now);
    memoryStore.set(config.key, timestamps);
  }

  // Calculate reset time (when oldest request expires)
  const resetTime = timestamps.length > 0
    ? timestamps[0] + windowMs
    : now + windowMs;

  return {
    success,
    limit: config.limit,
    remaining,
    reset: Math.floor(resetTime / 1000),
    retryAfter: success ? undefined : Math.ceil((resetTime - now) / 1000),
  };
}

/**
 * Upstash Redis rate limiter
 * For production with distributed rate limiting across multiple servers
 * Requires: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars
 */
async function upstashRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn('Upstash credentials not found, falling back to in-memory rate limiting');
    return memoryRateLimit(config);
  }

  try {
    const key = `ratelimit:${config.key}`;
    const now = Date.now();
    const windowMs = config.window * 1000;

    // Use Upstash REST API for atomic operations
    // This is a simplified implementation
    const response = await fetch(`${url}/incr/${key}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Fallback to in-memory if Upstash fails
      console.error('Upstash rate limit failed, using in-memory');
      return memoryRateLimit(config);
    }

    const data = (await response.json()) as { result: number };
    const count = data.result;

    // Set expiration on first request
    if (count === 1) {
      await fetch(`${url}/expire/${key}/${config.window}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    }

    const remaining = Math.max(0, config.limit - count);
    const success = count <= config.limit;
    const resetTime = now + windowMs;

    return {
      success,
      limit: config.limit,
      remaining,
      reset: Math.floor(resetTime / 1000),
      retryAfter: success ? undefined : config.window,
    };
  } catch (error) {
    console.error('Upstash error, falling back to in-memory:', error);
    return memoryRateLimit(config);
  }
}

/**
 * Main rate limit function
 * Uses Upstash if configured, otherwise uses in-memory
 */
export async function rateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  // Try Upstash first if credentials exist
  if (process.env.UPSTASH_REDIS_REST_URL) {
    return upstashRateLimit(config);
  }
  // Fall back to in-memory
  return memoryRateLimit(config);
}

/**
 * Helper to get client IP from request
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const clientIp = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  if (clientIp) {
    return clientIp;
  }

  // Fallback - not ideal but works
  return 'unknown';
}

/**
 * Rate limit strategies for different endpoints
 */
export const RATE_LIMITS = {
  // Auth endpoints - stricter limits
  OTP_SEND: {
    limit: 5, // 5 requests
    window: 60, // per minute
  },
  // Video upload - moderate limits
  UPLOAD: {
    limit: 10, // 10 requests
    window: 3600, // per hour
  },
  // General API - looser limits
  API: {
    limit: 100, // 100 requests
    window: 3600, // per hour
  },
} as const;

/**
 * Format rate limit response headers
 */
export function formatRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.reset),
  };

  if (result.retryAfter) {
    headers['Retry-After'] = String(result.retryAfter);
  }

  return headers;
}

/**
 * Example usage in API route:
 *
 * export async function POST(request: NextRequest) {
 *   const ip = getClientIp(request);
 *   const result = await rateLimit({
 *     key: ip,
 *     limit: RATE_LIMITS.OTP_SEND.limit,
 *     window: RATE_LIMITS.OTP_SEND.window,
 *   });
 *
 *   if (!result.success) {
 *     return NextResponse.json(
 *       { error: 'Too many requests. Please try again later.' },
 *       {
 *         status: 429,
 *         headers: formatRateLimitHeaders(result),
 *       }
 *     );
 *   }
 *
 *   // Process request...
 * }
 */
