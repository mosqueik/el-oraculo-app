// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Database Schema (Drizzle ORM + SQLite)
// ═══════════════════════════════════════════════════════════════════

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// ─── Bot State ───────────────────────────────────────────────────
// Tracks the current state of each coin's trading bot
export const botState = sqliteTable('bot_state', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  coin: text('coin').notNull().unique(), // BTC, ETH, SOL, etc.
  status: text('status').notNull().default('LÍQUIDO'), // LÍQUIDO | COMPRADO
  entryPrice: real('entry_price').notNull().default(0),
  entryTime: text('entry_time'), // ISO timestamp
  tpTarget: real('tp_target').notNull().default(0),
  pisoActual: real('piso_actual').notNull().default(0),
  streakLosses: integer('streak_losses').notNull().default(0),
  montoEntrada: real('monto_entrada').notNull().default(0),
  lastSellTime: text('last_sell_time'),
  lastSellReason: text('last_sell_reason'),
  lastSellPrice: real('last_sell_price').notNull().default(0),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
});

// ─── Trade Log ───────────────────────────────────────────────────
// Records every trade executed by the bot
export const tradeLog = sqliteTable('trade_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  coin: text('coin').notNull(),
  decision: text('decision').notNull(), // COMPRAR | VENDER | ESPERAR
  motivo: text('motivo'),
  monto: real('monto').notNull().default(0),
  precio: real('precio').notNull().default(0),
  rsi: real('rsi'),
  adx: real('adx'),
  direction: text('direction'), // BULLISH | BEARISH | UNKNOWN
  entryPrice: real('entry_price'),
  entryTime: text('entry_time'),
  pnl: text('pnl'), // P&L percentage string
  timestamp: text('timestamp').notNull().default(new Date().toISOString()),
});

// ─── Execution Log ───────────────────────────────────────────────
// Logs each execution attempt (success or failure)
export const executionLog = sqliteTable('execution_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  coin: text('coin').notNull(),
  status: text('status').notNull(), // success | error | running
  decision: text('decision'), // COMPRAR | VENDER | ESPERAR
  motivo: text('motivo'),
  monto: real('monto'),
  entryPrice: real('entry_price'),
  error: text('error'),
  score: real('score'),
  rsi: real('rsi'),
  adx: real('adx'),
  timestamp: text('timestamp').notNull().default(new Date().toISOString()),
});

// ─── Users ───────────────────────────────────────────────────────
// User accounts for multi-tenant access
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  plan: text('plan').notNull().default('free'), // free | pro | enterprise
  apiKeyEncrypted: text('api_key_encrypted'), // Encrypted Binance API key
  apiSecretEncrypted: text('api_secret_encrypted'), // Encrypted Binance secret
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
});

// ─── User Config ─────────────────────────────────────────────────
// Per-user custom configuration per coin
export const userConfig = sqliteTable('user_config', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  coin: text('coin').notNull(),
  riskPct: real('risk_pct'),
  entryMin: real('entry_min'),
  entryMax: real('entry_max'),
  customSettings: text('custom_settings'), // JSON string for additional overrides
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
});

// ─── Push Tokens ─────────────────────────────────────────────────
// Device push notification tokens (Expo Push Notifications)
export const pushTokens = sqliteTable('push_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  token: text('token').notNull().unique(), // Expo push token
  userId: integer('user_id').references(() => users.id),
  platform: text('platform').notNull(), // ios | android | web
  deviceName: text('device_name'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  lastUsedAt: text('last_used_at'),
});

// ─── Notification Log ────────────────────────────────────────────
// History of sent notifications
export const notificationLog = sqliteTable('notification_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(), // trade | alert | daily_report | system
  title: text('title').notNull(),
  body: text('body').notNull(),
  coin: text('coin'),
  action: text('action'), // COMPRAR | VENDER | ESPERAR
  price: real('price'),
  pnl: text('pnl'),
  sentVia: text('sent_via').notNull(), // push | telegram | both
  sentCount: integer('sent_count').notNull().default(0),
  errorCount: integer('error_count').notNull().default(0),
  timestamp: text('timestamp').notNull().default(new Date().toISOString()),
});

// ─── Subscriptions ─────────────────────────────────────────────
// Stripe subscription tracking
export const subscriptions = sqliteTable('subscriptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripePriceId: text('stripe_price_id'),
  plan: text('plan').notNull().default('free'), // free | pro | enterprise
  status: text('status').notNull().default('active'), // active | canceled | past_due | unpaid
  currentPeriodStart: text('current_period_start'),
  currentPeriodEnd: text('current_period_end'),
  cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
});

// ─── Invoices ──────────────────────────────────────────────────
// Stripe invoice tracking
export const invoices = sqliteTable('invoices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  stripeInvoiceId: text('stripe_invoice_id').unique(),
  amount: integer('amount').notNull(), // Amount in cents
  currency: text('currency').notNull().default('usd'),
  status: text('status').notNull(), // paid | open | void | uncollectible
  invoiceUrl: text('invoice_url'),
  invoicePdf: text('invoice_pdf'),
  periodStart: text('period_start'),
  periodEnd: text('period_end'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// ─── Custom Indicators ────────────────────────────────────────
// User-defined custom indicators (Enterprise plan)
export const customIndicators = sqliteTable('custom_indicators', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  description: text('description'),
  formula: text('formula').notNull(), // JSON: { type, params, logic }
  type: text('type').notNull(), // momentum | volatility | trend | volume | custom
  timeframe: text('timeframe').notNull().default('15m'),
  parameters: text('parameters'), // JSON: { period, multiplier, etc. }
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
});

// ─── Custom Indicator Usage ─────────────────────────────────────
// Tracks how custom indicators are used in scoring
export const indicatorUsage = sqliteTable('indicator_usage', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  indicatorId: integer('indicator_id').notNull().references(() => customIndicators.id),
  coin: text('coin').notNull(),
  weight: real('weight').notNull().default(1.0), // 0.0 - 2.0
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// ─── Alert Config ────────────────────────────────────────────
// User-configured profit/loss alert thresholds per coin
export const alertConfig = sqliteTable('alert_config', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id),
  coin: text('coin').notNull(), // BTC, ETH, etc. or 'ALL' for global
  alertType: text('alert_type').notNull(), // profit_pct | loss_pct | profit_usdt | loss_usdt | price_above | price_below
  threshold: real('threshold').notNull(), // e.g., 5.0 for 5% or 50 for $50
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  triggered: integer('triggered', { mode: 'boolean' }).notNull().default(false),
  lastTriggeredAt: text('last_triggered_at'),
  cooldownMinutes: integer('cooldown_minutes').notNull().default(60), // Min between triggers
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
});

// ─── Alert History ────────────────────────────────────────────
// Record of triggered alerts
export const alertHistory = sqliteTable('alert_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  alertConfigId: integer('alert_config_id').notNull().references(() => alertConfig.id),
  coin: text('coin').notNull(),
  alertType: text('alert_type').notNull(),
  threshold: real('threshold').notNull(),
  currentValue: real('current_value').notNull(), // Actual PnL% or price when triggered
  message: text('message').notNull(),
  sentVia: text('sent_via').notNull().default('push'), // push | telegram | both
  timestamp: text('timestamp').notNull().default(new Date().toISOString()),
});

// ─── Decision Snapshot ───────────────────────────────────────
// Full pipeline state at each decision point (replaces Google Sheets logging)
export const decisionSnapshot = sqliteTable('decision_snapshot', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  coin: text('coin').notNull(),
  cycleNumber: integer('cycle_number'),
  // Market state
  regime: text('regime'), // TRENDING | RANGING | VOLATILE | NEUTRAL
  rsi: real('rsi'),
  adx: real('adx'),
  atrPct: real('atr_pct'),
  ema20: real('ema20'),
  ema50: real('ema50'),
  histogram: real('histogram'),
  momentum: text('momentum'), // BULL | BEAR | NEUTRAL
  fvg: text('fvg'), // BULLISH | BEARISH | NEUTRAL
  // Multi-timeframe
  htfBias: text('htf_bias'), // BULLISH | BEARISH | NEUTRAL
  confluenceScore: integer('confluence_score'),
  alignment: integer('alignment', { mode: 'boolean' }),
  // Scoring
  entryScore: integer('entry_score'),
  entryThreshold: integer('entry_threshold'),
  entryReasons: text('entry_reasons'), // JSON array
  // Risk
  hardStop: real('hard_stop'),
  tpTarget: real('tp_target'),
  vPiso: real('v_piso'),
  // Decision
  decision: text('decision').notNull(), // COMPRAR | VENDER | ESPERAR
  motivo: text('motivo'),
  monto: real('monto'),
  // Execution
  fillPrice: real('fill_price'),
  quantity: real('quantity'),
  pnlPct: real('pnl_pct'),
  // Timing
  cycleMs: integer('cycle_ms'),
  timestamp: text('timestamp').notNull().default(new Date().toISOString()),
});

// ─── Daily Summary ─────────────────────────────────────────────
// Aggregated daily performance (cached)
export const dailySummary = sqliteTable('daily_summary', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(), // YYYY-MM-DD
  totalTrades: integer('total_trades').notNull().default(0),
  buys: integer('buys').notNull().default(0),
  sells: integer('sells').notNull().default(0),
  wins: integer('wins').notNull().default(0),
  losses: integer('losses').notNull().default(0),
  totalPnlPct: real('total_pnl_pct').notNull().default(0),
  bestTrade: text('best_trade'), // JSON: { coin, pnl, motivo }
  worstTrade: text('worst_trade'), // JSON: { coin, pnl, motivo }
  activePositions: text('active_positions'), // JSON array
  balanceStart: real('balance_start'),
  balanceEnd: real('balance_end'),
  timestamp: text('timestamp').notNull().default(new Date().toISOString()),
});

// ─── Export types ────────────────────────────────────────────────────────
export type BotState = typeof botState.$inferSelect;
export type NewBotState = typeof botState.$inferInsert;
export type TradeLogEntry = typeof tradeLog.$inferSelect;
export type NewTradeLogEntry = typeof tradeLog.$inferInsert;
export type ExecutionLogEntry = typeof executionLog.$inferSelect;
export type NewExecutionLogEntry = typeof executionLog.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserConfigEntry = typeof userConfig.$inferSelect;
export type NewUserConfigEntry = typeof userConfig.$inferInsert;
export type PushToken = typeof pushTokens.$inferSelect;
export type NewPushToken = typeof pushTokens.$inferInsert;
export type NotificationLogEntry = typeof notificationLog.$inferSelect;
export type NewNotificationLogEntry = typeof notificationLog.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type AlertConfig = typeof alertConfig.$inferSelect;
export type NewAlertConfig = typeof alertConfig.$inferInsert;
export type AlertHistoryEntry = typeof alertHistory.$inferSelect;
export type NewAlertHistoryEntry = typeof alertHistory.$inferInsert;
export type DecisionSnapshotEntry = typeof decisionSnapshot.$inferSelect;
export type NewDecisionSnapshotEntry = typeof decisionSnapshot.$inferInsert;
export type DailySummaryEntry = typeof dailySummary.$inferSelect;
export type NewDailySummaryEntry = typeof dailySummary.$inferInsert;
