// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Cache Service (AsyncStorage)
// TTL-based caching with automatic invalidation
// ═══════════════════════════════════════════════════════════════════

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ──────────────────────────────────────────────────────
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheOptions {
  ttl?: number;        // Time to live in milliseconds
  prefix?: string;     // Key prefix
}

// ─── Default TTLs ───────────────────────────────────────────────
export const CACHE_TTL = {
  PORTFOLIO: 30 * 1000,        // 30 seconds (real-time data)
  BALANCE: 30 * 1000,          // 30 seconds
  TRADES: 60 * 1000,           // 1 minute
  EXECUTIONS: 60 * 1000,       // 1 minute
  KLINES: 5 * 60 * 1000,       // 5 minutes (chart data)
  BOT_STATUS: 10 * 1000,       // 10 seconds
  NOTIFICATIONS: 2 * 60 * 1000, // 2 minutes
  USER: 30 * 60 * 1000,        // 30 minutes (rarely changes)
} as const;

const CACHE_PREFIX = '@el_oraculo_cache_';

// ─── Cache Service ──────────────────────────────────────────────
class CacheService {
  /**
   * Get cached data
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = CACHE_PREFIX + key;
      const raw = await AsyncStorage.getItem(fullKey);

      if (!raw) return null;

      const entry: CacheEntry<T> = JSON.parse(raw);
      const now = Date.now();

      // Check if expired
      if (now - entry.timestamp > entry.ttl) {
        // Remove expired entry
        await AsyncStorage.removeItem(fullKey);
        return null;
      }

      return entry.data;
    } catch {
      return null;
    }
  }

  /**
   * Set cached data
   */
  async set<T>(key: string, data: T, ttl: number = 60000): Promise<void> {
    try {
      const fullKey = CACHE_PREFIX + key;
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
      };

      await AsyncStorage.setItem(fullKey, JSON.stringify(entry));
    } catch {
      // Silently fail — cache is optional
    }
  }

  /**
   * Remove cached data
   */
  async remove(key: string): Promise<void> {
    try {
      const fullKey = CACHE_PREFIX + key;
      await AsyncStorage.removeItem(fullKey);
    } catch {
      // Silently fail
    }
  }

  /**
   * Clear all cache entries
   */
  async clearAll(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch {
      // Silently fail
    }
  }

  /**
   * Clear expired entries
   */
  async cleanup(): Promise<number> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
      const now = Date.now();
      let removed = 0;

      for (const key of cacheKeys) {
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          const entry: CacheEntry<any> = JSON.parse(raw);
          if (now - entry.timestamp > entry.ttl) {
            await AsyncStorage.removeItem(key);
            removed++;
          }
        }
      }

      return removed;
    } catch {
      return 0;
    }
  }

  /**
   * Get cache stats
   */
  async getStats(): Promise<{
    totalEntries: number;
    totalSize: number;
  }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));

      let totalSize = 0;
      for (const key of cacheKeys) {
        const raw = await AsyncStorage.getItem(key);
        if (raw) totalSize += raw.length;
      }

      return {
        totalEntries: cacheKeys.length,
        totalSize,
      };
    } catch {
      return { totalEntries: 0, totalSize: 0 };
    }
  }

  /**
   * Fetch with cache (cache-first strategy)
   */
  async fetchWithCache<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = 60000
  ): Promise<{ data: T; fromCache: boolean }> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return { data: cached, fromCache: true };
    }

    // Fetch fresh data
    const data = await fetchFn();

    // Cache the result
    await this.set(key, data, ttl);

    return { data, fromCache: false };
  }

  /**
   * Fetch with cache fallback (try network, fallback to cache)
   */
  async fetchWithFallback<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = 60000
  ): Promise<{ data: T; fromCache: boolean }> {
    try {
      // Try network first
      const data = await fetchFn();
      await this.set(key, data, ttl);
      return { data, fromCache: false };
    } catch {
      // Fallback to cache
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return { data: cached, fromCache: true };
      }
      throw new Error('No cached data and network unavailable');
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────
export const cache = new CacheService();

// ─── Cache Keys ─────────────────────────────────────────────────
export const CACHE_KEYS = {
  PORTFOLIO: 'portfolio',
  BALANCE: 'balance',
  TRADES: (coin?: string) => coin ? `trades:${coin}` : 'trades:all',
  EXECUTIONS: 'executions',
  KLINES: (coin: string, interval: string) => `klines:${coin}:${interval}`,
  BOT_STATUS: 'bot_status',
  NOTIFICATIONS: 'notifications',
  USER: 'user',
} as const;
