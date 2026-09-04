// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — SQLite Rate Limit Store Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { SqliteRateLimitStore } from '../src/middleware/rateLimitStore';

describe('SqliteRateLimitStore', () => {
  let db: Database.Database;
  let store: SqliteRateLimitStore;

  before(() => {
    // Create in-memory SQLite database for testing
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    store = new SqliteRateLimitStore(db, 'test:');
  });

  after(() => {
    db.close();
  });

  describe('Initialization', () => {
    it('should create rate_limits table', () => {
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='rate_limits'"
      ).get();
      assert.ok(tables, 'rate_limits table should exist');
    });

    it('should create index on expires', () => {
      const indexes = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_rate_limits_expires'"
      ).get();
      assert.ok(indexes, 'expires index should exist');
    });

    it('should set prefix correctly', () => {
      assert.strictEqual(store.prefix, 'test:');
    });

    it('should set cleanupProbability', () => {
      assert.strictEqual(store.cleanupProbability, 0.01);
    });
  });

  describe('init()', () => {
    it('should update windowMs from options', () => {
      store.init({ windowMs: 120_000 } as any);
      assert.strictEqual(store.windowMs, 120_000);
    });

    it('should default to 60s if windowMs not provided', () => {
      store.init({} as any);
      assert.strictEqual(store.windowMs, 60_000);
    });
  });

  describe('increment()', () => {
    it('should return totalHits=1 for first request', () => {
      store.resetKey('new-key');
      const result = store.increment('new-key');
      assert.strictEqual(result.totalHits, 1);
      assert.ok(result.resetTime instanceof Date);
      assert.ok(result.resetTime.getTime() > Date.now());
    });

    it('should increment counter on subsequent requests', () => {
      store.resetKey('counter-test');
      store.increment('counter-test');
      store.increment('counter-test');
      const result = store.increment('counter-test');
      assert.strictEqual(result.totalHits, 3);
    });

    it('should prefix keys correctly', () => {
      store.resetKey('prefixed');
      store.increment('prefixed');
      // Check the prefixed key exists in the database
      const row = db.prepare("SELECT count FROM rate_limits WHERE key = 'test:prefixed'").get() as any;
      assert.ok(row, 'Prefixed key should exist in database');
      assert.strictEqual(row.count, 1);
    });

    it('should not mix keys with different prefixes', () => {
      const storeA = new SqliteRateLimitStore(db, 'prefixA:');
      const storeB = new SqliteRateLimitStore(db, 'prefixB:');

      storeA.resetKey('shared');
      storeB.resetKey('shared');

      storeA.increment('shared');
      storeA.increment('shared');
      storeB.increment('shared');

      const resultA = storeA.increment('shared');
      const resultB = storeB.increment('shared');

      assert.strictEqual(resultA.totalHits, 3); // 2 from storeA + this increment
      assert.strictEqual(resultB.totalHits, 2); // 1 from storeB + this increment
    });
  });

  describe('decrement()', () => {
    it('should decrement counter', () => {
      store.resetKey('dec-test');
      store.increment('dec-test');
      store.increment('dec-test');
      store.increment('dec-test');
      store.decrement('dec-test');

      const result = store.get('dec-test');
      assert.ok(result);
      assert.strictEqual(result.totalHits, 2);
    });

    it('should not go below 0', () => {
      store.resetKey('floor-test');
      store.decrement('floor-test');
      store.decrement('floor-test');

      const result = store.get('floor-test');
      // After decrementing non-existent key, it should still be 0 or undefined
      if (result) {
        assert.ok(result.totalHits >= 0);
      }
    });
  });

  describe('resetKey()', () => {
    it('should remove a specific key', () => {
      store.increment('to-reset');
      store.increment('to-reset');
      assert.ok(store.get('to-reset'));

      store.resetKey('to-reset');
      const result = store.get('to-reset');
      assert.strictEqual(result, undefined);
    });
  });

  describe('resetAll()', () => {
    it('should remove all keys', () => {
      store.increment('a');
      store.increment('b');
      store.increment('c');

      store.resetAll();

      assert.strictEqual(store.get('a'), undefined);
      assert.strictEqual(store.get('b'), undefined);
      assert.strictEqual(store.get('c'), undefined);
    });
  });

  describe('get()', () => {
    it('should return undefined for non-existent key', () => {
      const result = store.get('non-existent');
      assert.strictEqual(result, undefined);
    });

    it('should return totalHits and resetTime', () => {
      store.resetKey('get-test');
      store.increment('get-test');
      store.increment('get-test');

      const result = store.get('get-test');
      assert.ok(result);
      assert.strictEqual(result.totalHits, 2);
      assert.ok(result.resetTime instanceof Date);
      assert.ok(result.resetTime.getTime() > Date.now());
    });

    it('should return undefined for expired entries', () => {
      // Insert an expired entry directly
      db.prepare(
        "INSERT OR REPLACE INTO rate_limits (key, count, expires, created) VALUES ('test:expired', 5, ?, ?)"
      ).run(Date.now() - 1000, Date.now() - 60000);

      const result = store.get('expired');
      assert.strictEqual(result, undefined);
    });
  });

  describe('cleanupExpired()', () => {
    it('should remove expired entries', () => {
      // Insert some expired entries
      const now = Date.now();
      db.prepare(
        "INSERT OR REPLACE INTO rate_limits (key, count, expires, created) VALUES ('test:exp1', 1, ?, ?)"
      ).run(now - 5000, now - 60000);
      db.prepare(
        "INSERT OR REPLACE INTO rate_limits (key, count, expires, created) VALUES ('test:exp2', 1, ?, ?)"
      ).run(now - 3000, now - 60000);

      // Insert a valid entry
      db.prepare(
        "INSERT OR REPLACE INTO rate_limits (key, count, expires, created) VALUES ('test:valid', 1, ?, ?)"
      ).run(now + 60000, now);

      const cleaned = store.cleanupExpired();
      assert.ok(cleaned >= 2, `Should clean at least 2 entries, got ${cleaned}`);

      // Valid entry should still exist
      const valid = store.get('valid');
      assert.ok(valid, 'Valid entry should still exist');
    });
  });

  describe('getKeyCount()', () => {
    it('should return total number of tracked keys', () => {
      store.resetAll();
      store.increment('k1');
      store.increment('k2');
      store.increment('k3');

      const count = store.getKeyCount();
      assert.strictEqual(count, 3);
    });
  });

  describe('Persistence', () => {
    it('should persist data across store instances', () => {
      // Create a new store with the same database
      const store2 = new SqliteRateLimitStore(db, 'test:');

      // The data should still be there from previous tests
      // (since we're using the same database)
      store2.increment('persist-test');

      const result = store2.get('persist-test');
      assert.ok(result);
      assert.ok(result.totalHits >= 1);
    });
  });

  describe('Window Expiry', () => {
    it('should reset counter after window expires', () => {
      // Create a store with very short window
      const shortStore = new SqliteRateLimitStore(db, 'short:');
      shortStore.init({ windowMs: 100 } as any); // 100ms window

      shortStore.increment('expires-soon');
      shortStore.increment('expires-soon');

      // Wait for expiry
      const start = Date.now();
      while (Date.now() - start < 150) {
        // Busy wait for 150ms
      }

      // Next increment should start fresh
      const result = shortStore.increment('expires-soon');
      assert.strictEqual(result.totalHits, 1, 'Counter should reset after window expires');
    });
  });

  describe('No Prefix', () => {
    it('should work without prefix', () => {
      const noPrefixStore = new SqliteRateLimitStore(db);
      noPrefixStore.resetKey('no-prefix');
      noPrefixStore.increment('no-prefix');

      const result = noPrefixStore.get('no-prefix');
      assert.ok(result);
      assert.strictEqual(result.totalHits, 1);

      // Check raw key in database
      const row = db.prepare("SELECT count FROM rate_limits WHERE key = 'no-prefix'").get() as any;
      assert.ok(row, 'Key without prefix should exist');
    });
  });
});
