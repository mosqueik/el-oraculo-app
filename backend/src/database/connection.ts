// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Database Connection Singleton
// ═══════════════════════════════════════════════════════════════════

import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { logger } from '../utils/logger';

const DB_PATH = process.env.DB_PATH || './data/oraculo.db';

interface DatabaseInstance {
  sqlite: Database.Database;
  drizzle: BetterSQLite3Database<typeof schema>;
}

let db: DatabaseInstance | null = null;

function createDatabase(): DatabaseInstance {
  const sqlite = new Database(DB_PATH);

  // Enable WAL mode for better concurrent read performance
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const drizzleDb = drizzle(sqlite, { schema });

  logger.info(`📦 Database connected: ${DB_PATH}`);

  return { sqlite, drizzle: drizzleDb };
}

export function getDatabase() {
  if (!db) {
    db = createDatabase();
  }
  return db;
}

export function getDrizzle() {
  return getDatabase().drizzle;
}

/**
 * Get the raw better-sqlite3 database instance.
 * Used by rate limit store and other low-level operations.
 */
export function getDb(): Database.Database {
  return getDatabase().sqlite;
}

export function setDatabase(sqliteInstance: Database.Database) {
  db = {
    sqlite: sqliteInstance,
    drizzle: drizzle(sqliteInstance, { schema }),
  };
}

export function closeDatabase() {
  if (db) {
    db.sqlite.close();
    db = null;
    logger.info('📦 Database closed');
  }
}

// Graceful shutdown
process.on('SIGINT', closeDatabase);
process.on('SIGTERM', closeDatabase);
