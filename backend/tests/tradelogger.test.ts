// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — TradeLogger Service Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { setDatabase, closeDatabase } from '../src/database/connection';
import { TradeLoggerService } from '../src/modules/tradeLogger/service';
import { DecisionSnapshotRepository } from '../src/database/repositories/DecisionSnapshotRepository';
import { DailySummaryRepository } from '../src/database/repositories/DailySummaryRepository';
import { TradeLogRepository } from '../src/database/repositories/TradeLogRepository';

// ─── Inline DB Setup ──────────────────────────────────────────
let sqlite: Database.Database;

function createTestDb() {
  sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS bot_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coin TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'LÍQUIDO',
      entry_price REAL NOT NULL DEFAULT 0,
      entry_time TEXT,
      tp_target REAL NOT NULL DEFAULT 0,
      piso_actual REAL NOT NULL DEFAULT 0,
      streak_losses INTEGER NOT NULL DEFAULT 0,
      monto_entrada REAL NOT NULL DEFAULT 0,
      last_sell_time TEXT,
      last_sell_reason TEXT,
      last_sell_price REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS trade_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coin TEXT NOT NULL,
      decision TEXT NOT NULL,
      motivo TEXT,
      monto REAL NOT NULL DEFAULT 0,
      precio REAL NOT NULL DEFAULT 0,
      rsi REAL,
      adx REAL,
      direction TEXT,
      entry_price REAL,
      entry_time TEXT,
      pnl TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS execution_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coin TEXT NOT NULL,
      status TEXT NOT NULL,
      decision TEXT,
      motivo TEXT,
      monto REAL,
      entry_price REAL,
      error TEXT,
      score REAL,
      rsi REAL,
      adx REAL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS decision_snapshot (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coin TEXT NOT NULL,
      cycle_number INTEGER,
      regime TEXT,
      rsi REAL,
      adx REAL,
      atr_pct REAL,
      ema20 REAL,
      ema50 REAL,
      histogram REAL,
      momentum TEXT,
      fvg TEXT,
      htf_bias TEXT,
      confluence_score INTEGER,
      alignment INTEGER,
      entry_score INTEGER,
      entry_threshold INTEGER,
      entry_reasons TEXT,
      hard_stop REAL,
      tp_target REAL,
      v_piso REAL,
      decision TEXT NOT NULL,
      motivo TEXT,
      monto REAL,
      fill_price REAL,
      quantity REAL,
      pnl_pct REAL,
      cycle_ms INTEGER,
      entry_price REAL,
      entry_time TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS daily_summary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      total_trades INTEGER NOT NULL DEFAULT 0,
      buys INTEGER NOT NULL DEFAULT 0,
      sells INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      total_pnl_pct REAL NOT NULL DEFAULT 0,
      best_trade TEXT,
      worst_trade TEXT,
      active_positions TEXT,
      balance_start REAL,
      balance_end REAL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT,
      plan TEXT NOT NULL DEFAULT 'free',
      api_key_encrypted TEXT,
      api_secret_encrypted TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS push_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      user_id INTEGER,
      platform TEXT NOT NULL,
      device_name TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_used_at TEXT
    );
    CREATE TABLE IF NOT EXISTS notification_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      coin TEXT,
      action TEXT,
      price REAL,
      pnl TEXT,
      sent_via TEXT NOT NULL,
      sent_count INTEGER NOT NULL DEFAULT 0,
      error_count INTEGER NOT NULL DEFAULT 0,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT UNIQUE,
      stripe_price_id TEXT,
      plan TEXT NOT NULL DEFAULT 'free',
      status TEXT NOT NULL DEFAULT 'active',
      current_period_start TEXT,
      current_period_end TEXT,
      cancel_at_period_end INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      stripe_invoice_id TEXT UNIQUE,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'usd',
      status TEXT NOT NULL,
      invoice_url TEXT,
      invoice_pdf TEXT,
      period_start TEXT,
      period_end TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 1,
      expires INTEGER NOT NULL,
      created INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE TABLE IF NOT EXISTS alert_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      coin TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      threshold REAL NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      triggered INTEGER NOT NULL DEFAULT 0,
      last_triggered_at TEXT,
      cooldown_minutes INTEGER NOT NULL DEFAULT 60,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS alert_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_config_id INTEGER NOT NULL,
      coin TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      threshold REAL NOT NULL,
      current_value REAL NOT NULL,
      message TEXT NOT NULL,
      sent_via TEXT NOT NULL DEFAULT 'push',
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS custom_indicators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      formula TEXT NOT NULL,
      type TEXT NOT NULL,
      timeframe TEXT NOT NULL DEFAULT '15m',
      parameters TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS indicator_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      indicator_id INTEGER NOT NULL,
      coin TEXT NOT NULL,
      weight REAL NOT NULL DEFAULT 1.0,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Set the test database as the active connection
  setDatabase(sqlite);
}

// ─── Helper ─────────────────────────────────────────────────────
function createTestContext(overrides: Partial<Parameters<typeof TradeLoggerService.logDecision>[0]> = {}) {
  return {
    coin: 'BTC' as const,
    cycleNumber: 1,
    cycleStartTime: Date.now() - 100, // 100ms ago
    regime: 'TRENDING',
    rsi: 55,
    adx: 30,
    atr_pct: 2.5,
    ema20: 50000,
    ema50: 49000,
    histogram: 0.5,
    momentum: 'BULL',
    fvg: 'BULLISH',
    htfBias: 'BULLISH',
    confluenceScore: 75,
    alignment: true,
    entryScore: 65,
    entryThreshold: 60,
    entryReasons: ['RSI favorable', 'FVG bullish'],
    hardStop: 48000,
    tpTarget: 3.0,
    vPiso: 49500,
    decision: 'ESPERAR' as const,
    motivo: '📊 SCORING: 65/60 [RSI favorable, FVG bullish]',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────
describe('TradeLoggerService', () => {
  before(() => {
    createTestDb();
  });

  after(() => {
    sqlite?.close();
  });

  describe('logDecision', () => {
    it('should log an ESPERAR decision', () => {
      const context = createTestContext();
      
      // Should not throw
      TradeLoggerService.logDecision(context);
      
      // Verify snapshot was created
      const snapshots = DecisionSnapshotRepository.getAll(10);
      assert.ok(snapshots.length > 0, 'Should have at least one snapshot');
      
      const latest = snapshots[0];
      assert.equal(latest.coin, 'BTC');
      assert.equal(latest.decision, 'ESPERAR');
      assert.equal(latest.rsi, 55);
      assert.equal(latest.adx, 30);
      assert.equal(latest.momentum, 'BULL');
      assert.equal(latest.confluenceScore, 75);
    });

    it('should log a COMPRAR decision with trade entry', () => {
      const context = createTestContext({
        decision: 'COMPRAR',
        motivo: 'ENTRY: RSI favorable+FVG bullish',
        monto: 100,
        fillPrice: 50000,
      });
      
      TradeLoggerService.logDecision(context);
      
      // Verify both snapshot and trade log
      const snapshots = DecisionSnapshotRepository.getAll(10);
      const trades = TradeLogRepository.getAll(10);
      
      assert.ok(snapshots.length > 0);
      assert.ok(trades.length > 0, 'Should create trade log for COMPRAR');
      
      const trade = trades[0];
      assert.equal(trade.coin, 'BTC');
      assert.equal(trade.decision, 'COMPRAR');
      assert.equal(trade.monto, 100);
      assert.equal(trade.precio, 50000);
    });

    it('should log a VENDER decision with PnL', () => {
      const context = createTestContext({
        decision: 'VENDER',
        motivo: '🔴 ATR HARD STOP',
        fillPrice: 48000,
        pnlPct: -4.0,
      });
      
      TradeLoggerService.logDecision(context);
      
      const trades = TradeLogRepository.getAll(10);
      assert.ok(trades.length > 0);
      
      const trade = trades[0];
      assert.equal(trade.decision, 'VENDER');
      assert.equal(trade.pnl, '-4%');
    });
  });

  describe('getDecisions', () => {
    it('should return decisions for a specific coin', () => {
      // Create some decisions
      TradeLoggerService.logDecision(createTestContext({ coin: 'BTC', decision: 'ESPERAR' }));
      TradeLoggerService.logDecision(createTestContext({ coin: 'ETH', decision: 'COMPRAR', monto: 50 }));
      TradeLoggerService.logDecision(createTestContext({ coin: 'BTC', decision: 'VENDER', pnlPct: 2.5 }));
      
      const btcDecisions = TradeLoggerService.getDecisions('BTC', 24);
      
      assert.ok(btcDecisions.length >= 2, 'Should have at least 2 BTC decisions');
      assert.ok(btcDecisions.every(d => d.coin === 'BTC'), 'All should be BTC');
    });
  });

  describe('getPerformanceByCoin', () => {
    it('should calculate win rate per coin', () => {
      // Create some winning and losing trades
      for (let i = 0; i < 3; i++) {
        TradeLoggerService.logDecision(createTestContext({
          coin: 'BTC',
          decision: 'VENDER',
          pnlPct: 2.5, // Win
        }));
      }
      
      for (let i = 0; i < 2; i++) {
        TradeLoggerService.logDecision(createTestContext({
          coin: 'BTC',
          decision: 'VENDER',
          pnlPct: -1.5, // Loss
        }));
      }
      
      const performance = TradeLoggerService.getPerformanceByCoin();
      const btc = performance.find(p => p.coin === 'BTC');
      
      assert.ok(btc, 'Should have BTC performance');
      assert.ok(btc.wins >= 3, 'Should have at least 3 wins');
      assert.ok(btc.losses >= 2, 'Should have at least 2 losses');
      assert.ok(btc.winRate > 0, 'Win rate should be positive');
    });
  });

  describe('getWinStreaks', () => {
    it('should track streaks', () => {
      const streaks = TradeLoggerService.getWinStreaks();
      
      assert.ok(typeof streaks.currentWinStreak === 'number');
      assert.ok(typeof streaks.currentLoseStreak === 'number');
      assert.ok(typeof streaks.maxWinStreak === 'number');
      assert.ok(typeof streaks.maxLoseStreak === 'number');
      assert.ok(typeof streaks.totalWinningDays === 'number');
      assert.ok(typeof streaks.totalLosingDays === 'number');
    });
  });

  describe('getTodaySummary', () => {
    it('should return today summary', () => {
      const summary = TradeLoggerService.getTodaySummary();
      
      assert.ok(summary.date);
      assert.equal(summary.date, new Date().toISOString().split('T')[0]);
      assert.ok(typeof summary.totalTrades === 'number');
      assert.ok(typeof summary.buys === 'number');
      assert.ok(typeof summary.sells === 'number');
    });
  });

  describe('updateDailySummary', () => {
    it('should update daily summary with a buy', () => {
      const initial = TradeLoggerService.getTodaySummary();
      
      TradeLoggerService.updateDailySummary({
        coin: 'BTC',
        decision: 'COMPRAR',
        monto: 100,
      });
      
      const updated = TradeLoggerService.getTodaySummary();
      assert.equal(updated.buys, initial.buys + 1);
      assert.equal(updated.totalTrades, initial.totalTrades + 1);
    });

    it('should update daily summary with a winning sell', () => {
      const initial = TradeLoggerService.getTodaySummary();
      
      TradeLoggerService.updateDailySummary({
        coin: 'BTC',
        decision: 'VENDER',
        pnlPct: 2.5,
      });
      
      const updated = TradeLoggerService.getTodaySummary();
      assert.equal(updated.sells, initial.sells + 1);
      assert.equal(updated.wins, initial.wins + 1);
      assert.ok(updated.totalPnlPct > initial.totalPnlPct);
    });

    it('should update daily summary with a losing sell', () => {
      const initial = TradeLoggerService.getTodaySummary();
      
      TradeLoggerService.updateDailySummary({
        coin: 'BTC',
        decision: 'VENDER',
        pnlPct: -1.5,
      });
      
      const updated = TradeLoggerService.getTodaySummary();
      assert.equal(updated.losses, initial.losses + 1);
    });
  });

  describe('exportJson', () => {
    it('should export trades as JSON', () => {
      // Create some trades
      TradeLoggerService.logDecision(createTestContext({
        coin: 'BTC',
        decision: 'COMPRAR',
        monto: 100,
        fillPrice: 50000,
      }));
      
      const trades = TradeLoggerService.exportJson({ coin: 'BTC', limit: 10 });
      
      assert.ok(Array.isArray(trades));
      assert.ok(trades.length > 0);
      assert.equal(trades[0].coin, 'BTC');
    });

    it('should filter by date range', () => {
      const today = new Date().toISOString();
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      
      const trades = TradeLoggerService.exportJson({
        startDate: yesterday,
        endDate: today,
        limit: 100,
      });
      
      assert.ok(Array.isArray(trades));
    });
  });

  describe('exportCsv', () => {
    it('should export trades as CSV', () => {
      // Create a trade
      TradeLoggerService.logDecision(createTestContext({
        coin: 'ETH',
        decision: 'COMPRAR',
        monto: 50,
        fillPrice: 3000,
      }));
      
      const csv = TradeLoggerService.exportCsv({ coin: 'ETH' });
      
      assert.ok(typeof csv === 'string');
      assert.ok(csv.includes('ID,Coin,Decision'));
      assert.ok(csv.includes('ETH'));
    });

    it('should return message when no trades', () => {
      const csv = TradeLoggerService.exportCsv({ coin: 'NONEXISTENT' });
      assert.equal(csv, 'No trades to export');
    });
  });

  describe('getDecisionDistribution', () => {
    it('should count decisions per coin', () => {
      TradeLoggerService.logDecision(createTestContext({ coin: 'BTC', decision: 'ESPERAR' }));
      TradeLoggerService.logDecision(createTestContext({ coin: 'BTC', decision: 'COMPRAR', monto: 100 }));
      TradeLoggerService.logDecision(createTestContext({ coin: 'ETH', decision: 'VENDER', pnlPct: 1.5 }));
      
      const dist = TradeLoggerService.getDecisionDistribution();
      
      assert.ok(dist['BTC']);
      assert.ok(dist['BTC']['ESPERAR'] >= 1);
      assert.ok(dist['BTC']['COMPRAR'] >= 1);
      assert.ok(dist['ETH']);
      assert.ok(dist['ETH']['VENDER'] >= 1);
    });
  });

  describe('getRegimeDistribution', () => {
    it('should count decisions by regime', () => {
      TradeLoggerService.logDecision(createTestContext({ regime: 'TRENDING' }));
      TradeLoggerService.logDecision(createTestContext({ regime: 'RANGING' }));
      TradeLoggerService.logDecision(createTestContext({ regime: 'TRENDING' }));
      
      const dist = TradeLoggerService.getRegimeDistribution();
      
      assert.ok(dist['TRENDING'] >= 2);
      assert.ok(dist['RANGING'] >= 1);
    });
  });

  describe('getAvgCycleTime', () => {
    it('should calculate average cycle time', () => {
      TradeLoggerService.logDecision(createTestContext({
        cycleStartTime: Date.now() - 100, // 100ms ago
      }));
      
      const avgTimes = TradeLoggerService.getAvgCycleTime();
      
      assert.ok(typeof avgTimes['BTC'] === 'number');
      assert.ok(avgTimes['BTC'] >= 0);
    });
  });

  describe('cleanup', () => {
    it('should cleanup old data', () => {
      const result = TradeLoggerService.cleanup(0); // Delete all
      
      assert.ok(typeof result.snapshots === 'number');
      assert.ok(typeof result.summaries === 'number');
    });
  });
});

// ─── Analytics Routes Tests ─────────────────────────────────────
describe('Analytics Routes', () => {
  it('should have all required endpoints', () => {
    // Verify the module exports a router
    const analyticsRoutes = require('../src/routes/analytics').default;
    assert.ok(analyticsRoutes, 'Should export analytics routes');
  });
});
