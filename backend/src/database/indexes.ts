// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Database Indexes
// Performance indexes for frequently queried columns
// ═══════════════════════════════════════════════════════════════════

import { getDb } from './connection';
import { logger } from '../utils/logger';

/**
 * Create all performance indexes.
 * Safe to run multiple times (IF NOT EXISTS).
 */
export function ensureIndexes(): void {
  const db = getDb();

  const indexes = [
    // ─── Trade Log ───────────────────────────────────────────────
    // Most queried table: filter by coin, timestamp range, decision
    `CREATE INDEX IF NOT EXISTS idx_trade_log_coin ON trade_log(coin)`,
    `CREATE INDEX IF NOT EXISTS idx_trade_log_timestamp ON trade_log(timestamp)`,
    `CREATE INDEX IF NOT EXISTS idx_trade_log_coin_timestamp ON trade_log(coin, timestamp)`,
    `CREATE INDEX IF NOT EXISTS idx_trade_log_decision ON trade_log(decision)`,

    // ─── Execution Log ───────────────────────────────────────────
    // Queried by coin, status, timestamp
    `CREATE INDEX IF NOT EXISTS idx_execution_log_coin ON execution_log(coin)`,
    `CREATE INDEX IF NOT EXISTS idx_execution_log_timestamp ON execution_log(timestamp)`,
    `CREATE INDEX IF NOT EXISTS idx_execution_log_coin_timestamp ON execution_log(coin, timestamp)`,
    `CREATE INDEX IF NOT EXISTS idx_execution_log_status ON execution_log(status)`,

    // ─── Decision Snapshot ───────────────────────────────────────
    // Core analytics table: filter by coin, decision, regime, timestamp
    `CREATE INDEX IF NOT EXISTS idx_decision_snapshot_coin ON decision_snapshot(coin)`,
    `CREATE INDEX IF NOT EXISTS idx_decision_snapshot_timestamp ON decision_snapshot(timestamp)`,
    `CREATE INDEX IF NOT EXISTS idx_decision_snapshot_coin_timestamp ON decision_snapshot(coin, timestamp)`,
    `CREATE INDEX IF NOT EXISTS idx_decision_snapshot_decision ON decision_snapshot(decision)`,
    `CREATE INDEX IF NOT EXISTS idx_decision_snapshot_regime ON decision_snapshot(regime)`,

    // ─── Daily Summary ───────────────────────────────────────────
    // Queried by date range
    `CREATE INDEX IF NOT EXISTS idx_daily_summary_date ON daily_summary(date)`,

    // ─── Bot State ───────────────────────────────────────────────
    // Queried by coin (unique already, but explicit for clarity)
    `CREATE INDEX IF NOT EXISTS idx_bot_state_status ON bot_state(status)`,

    // ─── Users ───────────────────────────────────────────────────
    // Queried by email (unique already), plan for admin queries
    `CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan)`,

    // ─── Subscriptions ───────────────────────────────────────────
    // Queried by user, status, stripe IDs
    `CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)`,
    `CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_subscription_id)`,

    // ─── Invoices ────────────────────────────────────────────────
    // Queried by user, date range
    `CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at)`,

    // ─── Alert Config ────────────────────────────────────────────
    // Queried by user, coin, enabled status
    `CREATE INDEX IF NOT EXISTS idx_alert_config_user ON alert_config(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_alert_config_coin ON alert_config(coin)`,
    `CREATE INDEX IF NOT EXISTS idx_alert_config_enabled ON alert_config(enabled)`,

    // ─── Alert History ───────────────────────────────────────────
    // Queried by config, coin, timestamp
    `CREATE INDEX IF NOT EXISTS idx_alert_history_config ON alert_history(alert_config_id)`,
    `CREATE INDEX IF NOT EXISTS idx_alert_history_coin ON alert_history(coin)`,
    `CREATE INDEX IF NOT EXISTS idx_alert_history_timestamp ON alert_history(timestamp)`,

    // ─── Notification Log ────────────────────────────────────────
    // Queried by type, coin, timestamp
    `CREATE INDEX IF NOT EXISTS idx_notification_log_type ON notification_log(type)`,
    `CREATE INDEX IF NOT EXISTS idx_notification_log_coin ON notification_log(coin)`,
    `CREATE INDEX IF NOT EXISTS idx_notification_log_timestamp ON notification_log(timestamp)`,

    // ─── Push Tokens ─────────────────────────────────────────────
    // Queried by user, active status
    `CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_tokens(active)`,

    // ─── Custom Indicators ───────────────────────────────────────
    // Queried by user, type
    `CREATE INDEX IF NOT EXISTS idx_custom_indicators_user ON custom_indicators(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_custom_indicators_type ON custom_indicators(type)`,

    // ─── Indicator Usage ─────────────────────────────────────────
    // Queried by indicator, coin
    `CREATE INDEX IF NOT EXISTS idx_indicator_usage_indicator ON indicator_usage(indicator_id)`,
    `CREATE INDEX IF NOT EXISTS idx_indicator_usage_coin ON indicator_usage(coin)`,

    // ─── Rate Limits ─────────────────────────────────────────────
    // Queried by key, expiry for cleanup
    `CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires)`,
  ];

  let created = 0;
  let errors = 0;

  for (const sql of indexes) {
    try {
      db.prepare(sql).run();
      created++;
    } catch (err: any) {
      // Index already exists or other error — log but don't crash
      if (!err.message?.includes('already exists')) {
        logger.warn(`⚠️  Index creation warning: ${err.message}`);
        errors++;
      }
    }
  }

  logger.info(`📊 Database indexes: ${created} created, ${errors} warnings`);
}

/**
 * Get index statistics for monitoring.
 */
export function getIndexStats(): Array<{ name: string; table: string; rows: number }> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT name, tbl_name as table_name, 0 as rows
    FROM sqlite_master
    WHERE type = 'index' AND name LIKE 'idx_%'
    ORDER BY tbl_name, name
  `).all() as Array<{ name: string; tbl_name: string; rows: number }>;

  return rows.map(r => ({ name: r.name, table: r.tbl_name, rows: r.rows }));
}

/**
 * Analyze tables for query optimization.
 * Should be run periodically (e.g., daily).
 */
export function analyzeTables(): void {
  const db = getDb();
  try {
    db.prepare('ANALYZE').run();
    logger.info('📊 Database analyzed for query optimization');
  } catch (err: any) {
    logger.warn(`⚠️  Analyze warning: ${err.message}`);
  }
}
