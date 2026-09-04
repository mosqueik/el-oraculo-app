// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Database Initialization
// ═══════════════════════════════════════════════════════════════════

import { sql } from 'drizzle-orm';
import { getDrizzle, getDatabase } from './connection';
import { botState } from './schema';
import { COIN_CONFIGS } from '@el-oraculo/shared';
import { logger } from '../utils/logger';
import { runMigrations } from './migrate';
import { ensureIndexes } from './indexes';

export async function initializeDatabase(): Promise<void> {
  logger.info('🔧 Initializing database...');

  // Step 1: Run Drizzle migrations (creates tables)
  await runMigrations();

  // Step 2: Create performance indexes
  ensureIndexes();

  // Step 3: Seed initial data
  seedBotStates();

  logger.info('✅ Database initialized successfully');
}

function seedBotStates(): void {
  const drizzle = getDrizzle();
  const now = new Date().toISOString();

  for (const [coin, config] of Object.entries(COIN_CONFIGS)) {
    // Check if coin already exists
    const existing = drizzle
      .select()
      .from(botState)
      .where(sql`${botState.coin} = ${coin}`)
      .get();

    if (!existing) {
      drizzle.insert(botState)
        .values({
          coin,
          status: 'LÍQUIDO',
          entryPrice: 0,
          tpTarget: 0,
          pisoActual: 0,
          streakLosses: 0,
          montoEntrada: 0,
          lastSellPrice: 0,
          updatedAt: now,
        })
        .run();

      logger.debug(`🌱 Seeded bot_state for ${coin}`);
    }
  }
}
