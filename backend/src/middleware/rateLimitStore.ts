// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — SQLite Rate Limit Store
// ═══════════════════════════════════════════════════════════════════
//
// Persistent rate limit storage using better-sqlite3.
// Survives server restarts unlike the default in-memory store.
//
// Compatible with express-rate-limit v8 Store interface.
//
// Table: rate_limits
//   key       TEXT PRIMARY KEY
//   count     INTEGER DEFAULT 0
//   expires   INTEGER NOT NULL  (unix timestamp ms)
//   created   INTEGER NOT NULL  (unix timestamp ms)
//
// Cleanup: expired entries are pruned on each increment (~1% chance)
// or via the explicit cleanupExpired() function.
// ═══════════════════════════════════════════════════════════════════

import type { Store, IncrementResponse, ClientRateLimitInfo, Options } from 'express-rate-limit';
import Database from 'better-sqlite3';
import { logger } from '../utils/logger';

// ─── Schema ─────────────────────────────────────────────────────

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS rate_limits (
  key       TEXT PRIMARY KEY,
  count     INTEGER NOT NULL DEFAULT 0,
  expires   INTEGER NOT NULL,
  created   INTEGER NOT NULL
);
`;

const CREATE_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires);
`;

// ─── Prepared Statements Cache ──────────────────────────────────

let preparedStatements: {
  increment: Database.Statement;
  decrement: Database.Statement;
  resetKey: Database.Statement;
  resetAll: Database.Statement;
  get: Database.Statement;
  cleanup: Database.Statement;
  count: Database.Statement;
} | null = null;

function getStatements(db: Database.Database) {
  if (preparedStatements) return preparedStatements;

  preparedStatements = {
    increment: db.prepare(`
      INSERT INTO rate_limits (key, count, expires, created)
      VALUES (?, 1, ?, ?)
      ON CONFLICT(key) DO UPDATE SET count = count + 1
    `),
    decrement: db.prepare(`
      UPDATE rate_limits SET count = MAX(0, count - 1) WHERE key = ?
    `),
    resetKey: db.prepare(`
      DELETE FROM rate_limits WHERE key = ?
    `),
    resetAll: db.prepare(`
      DELETE FROM rate_limits
    `),
    get: db.prepare(`
      SELECT count, expires FROM rate_limits WHERE key = ?
    `),
    cleanup: db.prepare(`
      DELETE FROM rate_limits WHERE expires < ?
    `),
    count: db.prepare(`
      SELECT COUNT(*) as total FROM rate_limits
    `),
  };

  return preparedStatements;
}

// ─── SQLite Store (express-rate-limit v8 compatible) ────────────

/**
 * SQLite-backed rate limit store for express-rate-limit v8.
 * Implements the Store interface: init, increment, decrement, resetKey, resetAll.
 */
export class SqliteRateLimitStore implements Store {
  db: Database.Database;
  prefix: string;
  cleanupProbability: number;
  windowMs: number = 60_000; // Default, updated by init()

  /**
   * Create a new SQLite-backed rate limit store.
   *
   * @param db - better-sqlite3 database instance
   * @param prefix - optional key prefix (e.g., 'api:', 'auth:')
   * @param cleanupProbability - probability of running cleanup on each increment (0-1, default 0.01)
   */
  constructor(db: Database.Database, prefix: string = '', cleanupProbability: number = 0.01) {
    this.db = db;
    this.prefix = prefix;
    this.cleanupProbability = cleanupProbability;

    // Ensure table exists
    this.db.exec(CREATE_TABLE_SQL);
    this.db.exec(CREATE_INDEX_SQL);
  }

  /**
   * Called once by express-rate-limit during initialization.
   * Receives the middleware options including windowMs.
   */
  init(options: Options): void {
    this.windowMs = options.windowMs || 60_000;
    const prefixDisplay = this.prefix || '(none)';
    logger.debug(`📦 SQLite rate limit store init: prefix=${prefixDisplay}, window=${this.windowMs}ms`);
  }

  /**
   * Increment the counter for a key. Creates entry if it doesn't exist.
   * Returns the current hit count and reset time.
   */
  increment(key: string): IncrementResponse {
    try {
      const fullKey = this.prefix + key;
      const now = Date.now();
      const stmts = getStatements(this.db);

      // Get existing entry to check expiry
      const existing = stmts.get.get(fullKey) as { count: number; expires: number } | undefined;

      if (existing && existing.expires <= now) {
        // Entry expired — reset it
        stmts.resetKey.run(fullKey);
      }

      // Insert or increment
      const expires = now + this.windowMs;
      stmts.increment.run(fullKey, expires, now);

      // Get the new count
      const result = stmts.get.get(fullKey) as { count: number; expires: number } | undefined;
      const totalHits = result?.count || 1;
      const resetTime = new Date(expires);

      // Occasional cleanup of expired entries
      if (Math.random() < this.cleanupProbability) {
        this.cleanupExpired();
      }

      return { totalHits, resetTime };
    } catch (error) {
      logger.error('Rate limit store increment error:', error);
      // Fail open: allow the request
      return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
    }
  }

  /**
   * Decrement the counter for a key.
   */
  decrement(key: string): void {
    try {
      const fullKey = this.prefix + key;
      const stmts = getStatements(this.db);
      stmts.decrement.run(fullKey);
    } catch (error) {
      logger.error('Rate limit store decrement error:', error);
    }
  }

  /**
   * Reset the counter for a specific key.
   */
  resetKey(key: string): void {
    try {
      const fullKey = this.prefix + key;
      const stmts = getStatements(this.db);
      stmts.resetKey.run(fullKey);
    } catch (error) {
      logger.error('Rate limit store resetKey error:', error);
    }
  }

  /**
   * Reset all counters.
   */
  resetAll(): void {
    try {
      const stmts = getStatements(this.db);
      stmts.resetAll.run();
    } catch (error) {
      logger.error('Rate limit store resetAll error:', error);
    }
  }

  /**
   * Get the current hit count and reset time for a key.
   */
  get(key: string): ClientRateLimitInfo | undefined {
    try {
      const fullKey = this.prefix + key;
      const stmts = getStatements(this.db);
      const result = stmts.get.get(fullKey) as { count: number; expires: number } | undefined;

      if (!result || result.expires <= Date.now()) {
        return undefined;
      }

      return {
        totalHits: result.count,
        resetTime: new Date(result.expires),
      };
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Remove expired entries from the database.
   */
  cleanupExpired(): number {
    try {
      const stmts = getStatements(this.db);
      const result = stmts.cleanup.run(Date.now());
      return result.changes;
    } catch (error) {
      logger.error('Rate limit store cleanup error:', error);
      return 0;
    }
  }

  /**
   * Get total number of tracked keys.
   */
  getKeyCount(): number {
    try {
      const stmts = getStatements(this.db);
      const result = stmts.count.get() as { total: number };
      return result?.total || 0;
    } catch (error) {
      return 0;
    }
  }
}

// ─── Factory ────────────────────────────────────────────────────

let globalStore: SqliteRateLimitStore | null = null;

/**
 * Initialize the global SQLite rate limit store.
 * Call once at startup before creating rate limiters.
 */
export function initRateLimitStore(db: Database.Database): SqliteRateLimitStore {
  if (globalStore) {
    logger.warn('Rate limit store already initialized');
    return globalStore;
  }

  globalStore = new SqliteRateLimitStore(db);
  logger.info('📦 Rate limit store initialized (SQLite persistent)');
  return globalStore;
}

/**
 * Get the global SQLite rate limit store.
 * Returns null if not initialized.
 */
export function getRateLimitStore(): SqliteRateLimitStore | null {
  return globalStore;
}

/**
 * Create a prefixed store for a specific limiter.
 * All limiters share the same database but have different key prefixes.
 */
export function createPrefixedStore(prefix: string): SqliteRateLimitStore | null {
  if (!globalStore) {
    logger.warn('Rate limit store not initialized — using in-memory fallback');
    return null;
  }

  // Access the underlying db from the global store
  const db = (globalStore as any).db as Database.Database;
  return new SqliteRateLimitStore(db, prefix);
}

/**
 * Cleanup all expired entries (call periodically).
 */
export function cleanupAllRateLimits(): number {
  if (!globalStore) return 0;
  return globalStore.cleanupExpired();
}
