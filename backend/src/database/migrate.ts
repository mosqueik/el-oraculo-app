// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Migration Runner
// ═══════════════════════════════════════════════════════════════════

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { getDatabase } from './connection';
import { logger } from '../utils/logger';

/**
 * Run Drizzle migrations from the ./drizzle directory
 */
export async function runMigrations(): Promise<void> {
  const { drizzle } = getDatabase();

  logger.info('🔄 Running database migrations...');

  try {
    migrate(drizzle, {
      migrationsFolder: './drizzle',
    });

    logger.info('✅ Migrations applied successfully');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // migrationsOutdated is expected when no migrations exist yet
    if (msg.includes('migrationsOutdated')) {
      logger.warn('⚠️ Migrations outdated — run `npm run db:generate` to create new migrations');
    } else if (msg.includes('already exists') || msg.includes('Failed to run the query')) {
      // Table already exists from init — safe to continue
      logger.warn('⚠️ Migration skipped (tables may already exist):', msg.substring(0, 200));
    } else {
      logger.error('❌ Migration failed:', error);
      throw error;
    }
  }
}
