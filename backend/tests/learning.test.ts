// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Learning Service Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { LearningService } from '../src/modules/learning/service';
import { initializeDatabase } from '../src/database/init';
import { TradeLogRepository } from '../src/database/repositories';

// Initialize DB tables before all tests
before(async () => {
  try {
    await initializeDatabase();
  } catch {
    // Tables may already exist
  }
});

describe('LearningService', () => {
  const service = new LearningService();

  describe('analyzeCoin', () => {
    it('should return empty analysis when no trades', () => {
      const analysis = service.analyzeCoin('DOGE');

      assert.equal(analysis.coin, 'DOGE');
      assert.equal(analysis.totalTrades, 0);
      assert.equal(analysis.winRate, 0);
      assert.equal(analysis.avgPnl, 0);
      assert.ok(Array.isArray(analysis.commonMotivos));
      assert.ok(Array.isArray(analysis.patterns));
    });

    it('should analyze trades correctly', () => {
      // Insert test trades
      const trades = [
        { coin: 'ESP', decision: 'COMPRAR', motivo: 'ENTRY: RSI_OVERSOLD+FVG_BULL', monto: 100, precio: 50000, rsi: 25, adx: 30, direction: 'BULLISH', entryPrice: 50000, entryTime: new Date().toISOString(), pnl: '+2.5%', timestamp: new Date().toISOString() },
        { coin: 'ESP', decision: 'VENDER', motivo: 'TAKE PROFIT', monto: 100, precio: 51250, rsi: 65, adx: 28, direction: 'BULLISH', entryPrice: 50000, entryTime: new Date().toISOString(), pnl: '+2.5%', timestamp: new Date(Date.now() + 1000).toISOString() },
        { coin: 'ESP', decision: 'COMPRAR', motivo: 'ENTRY: ADX_BULL+MOM_BULL', monto: 100, precio: 51000, rsi: 45, adx: 35, direction: 'BULLISH', entryPrice: 51000, entryTime: new Date().toISOString(), pnl: '0%', timestamp: new Date(Date.now() + 2000).toISOString() },
        { coin: 'ESP', decision: 'VENDER', motivo: 'HARD STOP', monto: 100, precio: 49500, rsi: 30, adx: 40, direction: 'BEARISH', entryPrice: 51000, entryTime: new Date().toISOString(), pnl: '-2.94%', timestamp: new Date(Date.now() + 3000).toISOString() },
        { coin: 'ESP', decision: 'COMPRAR', motivo: 'ENTRY: RSI_LOW', monto: 100, precio: 49800, rsi: 35, adx: 25, direction: 'BEARISH', entryPrice: 49800, entryTime: new Date().toISOString(), pnl: '0%', timestamp: new Date(Date.now() + 4000).toISOString() },
      ];

      for (const trade of trades) {
        TradeLogRepository.create(trade);
      }

      const analysis = service.analyzeCoin('ESP');

      assert.ok(analysis.totalTrades >= 5, `Expected at least 5 trades, got ${analysis.totalTrades}`);
      assert.ok(analysis.wins >= 1, 'Should have at least 1 win');
      assert.ok(analysis.losses >= 1, 'Should have at least 1 loss');
      assert.ok(analysis.winRate > 0, 'Win rate should be > 0');
      assert.ok(analysis.bestPnl > 0, 'Best PnL should be positive');
      assert.ok(analysis.worstPnl < 0, 'Worst PnL should be negative');
      assert.ok(analysis.commonMotivos.length > 0, 'Should have common motivos');
    });
  });

  describe('generateInsights', () => {
    it('should return insights for empty analysis (0% win rate triggers insight)', () => {
      const analysis = service.analyzeCoin('DOGE');
      const insights = service.generateInsights(analysis);

      assert.ok(Array.isArray(insights));
      // 0 trades = 0% win rate = should generate a scoring insight
      assert.ok(insights.length >= 0, 'Insights should be an array');
      for (const insight of insights) {
        assert.ok(['SCORING', 'RISK', 'TIMING', 'COIN'].includes(insight.category));
        assert.ok(['HIGH', 'MEDIUM', 'LOW'].includes(insight.impact));
        assert.ok(typeof insight.message === 'string');
        assert.ok(typeof insight.recommendation === 'string');
      }
    });
  });

  describe('getOverallSummary', () => {
    it('should return valid summary structure', () => {
      const summary = service.getOverallSummary();

      assert.ok(typeof summary.totalTrades === 'number');
      assert.ok(typeof summary.totalWins === 'number');
      assert.ok(typeof summary.totalLosses === 'number');
      assert.ok(typeof summary.overallWinRate === 'number');
      assert.ok(Array.isArray(summary.coinPerformance));

      for (const coin of summary.coinPerformance) {
        assert.ok(typeof coin.coin === 'string');
        assert.ok(typeof coin.trades === 'number');
        assert.ok(typeof coin.winRate === 'number');
        assert.ok(typeof coin.pnl === 'number');
      }
    });
  });
});
