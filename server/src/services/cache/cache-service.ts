/**
 * Cache Service
 *
 * Server-side caching with in-memory and optional Redis support.
 */

interface CacheEntry<T> {
  data: T;
  expires: number;
  tags: string[];
} // 5 minutes

// In-memory cache
const memoryCache = new Map<string, CacheEntry<unknown>>();

// Cache statistics
let cacheHits = 0;
let cacheMisses = 0;

/**
 * Invalidate cache by tag
 */
export async function cacheInvalidateByTag(tag: string): Promise<number> {
  let count = 0;

  for (const [key, entry] of memoryCache.entries()) {
    if (entry.tags.includes(tag)) {
      memoryCache.delete(key);
      count++;
    }
  }

  return count;
}

/**
 * Invalidate cache by key pattern (glob-like)
 */
export async function cacheInvalidateByPattern(
  pattern: string,
): Promise<number> {
  const regex = new RegExp(
    "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
  );

  let count = 0;

  for (const key of memoryCache.keys()) {
    if (regex.test(key)) {
      memoryCache.delete(key);
      count++;
    }
  }

  return count;
}

/**
 * Clear entire cache
 */
export async function cacheClear(): Promise<void> {
  memoryCache.clear();
  cacheHits = 0;
  cacheMisses = 0;
}

/**
 * Get cache statistics
 */
export function cacheStats(): {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
} {
  const total = cacheHits + cacheMisses;
  return {
    size: memoryCache.size,
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: total > 0 ? cacheHits / total : 0,
  };
}

/**
 * Cleanup expired entries (call periodically)
 */
function cacheCleanup(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of memoryCache.entries()) {
    if (now > entry.expires) {
      memoryCache.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

// Run cleanup every 5 minutes
setInterval(cacheCleanup, 5 * 60 * 1000);
