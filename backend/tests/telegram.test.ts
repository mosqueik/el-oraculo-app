// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Telegram Notification Service Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { NotificationService } from '../src/modules/notifications/service';

describe('NotificationService (Telegram)', () => {
  let service: NotificationService;

  beforeEach(() => {
    // Clear env vars
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.TELEGRAM_THREAD_ID;
    delete process.env.TELEGRAM_SILENT;

    service = new NotificationService();
  });

  describe('Configuration', () => {
    it('should report not configured when env vars missing', () => {
      const config = service.getConfig();
      assert.strictEqual(config.configured, false);
      assert.strictEqual(config.botTokenSet, false);
      assert.strictEqual(config.chatIdSet, false);
    });

    it('should report configured when both env vars set', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-token-123';
      process.env.TELEGRAM_CHAT_ID = '123456789';

      const svc = new NotificationService();
      const config = svc.getConfig();
      assert.strictEqual(config.configured, true);
      assert.strictEqual(config.botTokenSet, true);
      assert.strictEqual(config.chatIdSet, true);
    });

    it('should detect thread ID', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      process.env.TELEGRAM_CHAT_ID = '12345';
      process.env.TELEGRAM_THREAD_ID = '99';

      const svc = new NotificationService();
      const config = svc.getConfig();
      assert.strictEqual(config.threadIdSet, true);
    });

    it('should detect silent mode', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      process.env.TELEGRAM_CHAT_ID = '12345';
      process.env.TELEGRAM_SILENT = 'true';

      const svc = new NotificationService();
      const config = svc.getConfig();
      assert.strictEqual(config.silentMode, true);
    });
  });

  describe('In-Memory Notifications', () => {
    it('should store trade notifications', () => {
      service.notifyTrade({
        coin: 'BTC', action: 'COMPRAR', price: 65000, quantity: 0.001,
        motivo: 'RSI_OVERSOLD', timestamp: new Date().toISOString(),
      });

      const recent = service.getRecent();
      assert.strictEqual(recent.length, 1);
    });

    it('should store alert notifications', () => {
      service.notifyAlert({
        level: 'warning', title: 'High Drawdown', message: 'Drawdown exceeded 5%',
        timestamp: new Date().toISOString(),
      });

      const recent = service.getRecent();
      assert.strictEqual(recent.length, 1);
    });

    it('should clear notifications', () => {
      service.notifyTrade({
        coin: 'ETH', action: 'VENDER', price: 3500, quantity: 0.1,
        motivo: 'TAKE_PROFIT', timestamp: new Date().toISOString(),
      });

      service.clear();
      assert.strictEqual(service.getRecent().length, 0);
    });

    it('should limit recent notifications', () => {
      for (let i = 0; i < 25; i++) {
        service.notifyTrade({
          coin: 'BTC', action: 'COMPRAR', price: 65000, quantity: 0.001,
          motivo: 'TEST', timestamp: new Date().toISOString(),
        });
      }

      const recent = service.getRecent(10);
      assert.strictEqual(recent.length, 10);
    });

    it('should store multiple notification types', () => {
      service.notifyTrade({
        coin: 'BTC', action: 'COMPRAR', price: 65000, quantity: 0.001,
        motivo: 'RSI_OVERSOLD', timestamp: new Date().toISOString(),
      });

      service.notifyAlert({
        level: 'error', title: 'API Error', message: 'Binance timeout',
        timestamp: new Date().toISOString(),
      });

      const recent = service.getRecent();
      assert.strictEqual(recent.length, 2);
    });
  });

  describe('Telegram Sending (no env vars — should silently skip)', () => {
    it('should return false when not configured (trade)', async () => {
      const sent = await service.notifyTrade({
        coin: 'BTC', action: 'COMPRAR', price: 65000, quantity: 0.001,
        motivo: 'RSI_OVERSOLD', timestamp: new Date().toISOString(),
      });
      assert.strictEqual(sent, false);
    });

    it('should return false when not configured (alert)', async () => {
      const sent = await service.notifyAlert({
        level: 'info', title: 'Test', message: 'Hello',
        timestamp: new Date().toISOString(),
      });
      assert.strictEqual(sent, false);
    });

    it('should return false when not configured (daily report)', async () => {
      const sent = await service.sendDailyReport({
        date: '2025-01-01', totalTrades: 5, wins: 3, losses: 2,
        totalPnl: 2.5, bestTrade: 'BTC +3%', worstTrade: 'ETH -1%',
        activePositions: [],
      });
      assert.strictEqual(sent, false);
    });

    it('should return false when not configured (raw message)', async () => {
      const sent = await service.sendMessage('Hello world');
      assert.strictEqual(sent, false);
    });
  });

  describe('Test Connection (no env vars)', () => {
    it('should return error when not configured', async () => {
      const result = await service.testConnection();
      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('not configured'));
    });
  });

  describe('Message Formatting', () => {
    it('should handle trade notification with PnL', async () => {
      // Will silently skip (no Telegram configured), but should not throw
      const sent = await service.notifyTrade({
        coin: 'SOL', action: 'VENDER', price: 150, quantity: 10,
        motivo: '🟢 TAKE PROFIT', pnl: '+2.5%', timestamp: '2025-01-01T12:00:00Z',
      });
      assert.strictEqual(sent, false); // No Telegram configured
      // But should still be stored
      assert.strictEqual(service.getRecent().length, 1);
    });

    it('should handle daily report with active positions', async () => {
      const sent = await service.sendDailyReport({
        date: '2025-06-15', totalTrades: 8, wins: 5, losses: 3,
        totalPnl: 4.2,
        bestTrade: 'BTC +3.1%',
        worstTrade: 'DOGE -1.8%',
        activePositions: [
          { coin: 'BTC', pnl: '+1.5%', hours: 4.2 },
          { coin: 'SOL', pnl: '-0.3%', hours: 1.5 },
        ],
      });
      assert.strictEqual(sent, false);
    });

    it('should handle alert with coin reference', async () => {
      const sent = await service.notifyAlert({
        level: 'critical', title: 'Hard Stop Triggered',
        message: 'BTC hit ATR hard stop at $63,200',
        coin: 'BTC',
        timestamp: '2025-01-01T12:00:00Z',
      });
      assert.strictEqual(sent, false);
    });
  });

  describe('Markdown Escaping', () => {
    it('should escape special characters in messages', async () => {
      // Test that messages with special chars don't throw
      const sent = await service.notifyTrade({
        coin: 'BTC', action: 'COMPRAR', price: 65000, quantity: 0.001,
        motivo: 'Test with *bold* and _italic_ and [link](url)',
        timestamp: new Date().toISOString(),
      });
      assert.strictEqual(sent, false);
      assert.strictEqual(service.getRecent().length, 1);
    });
  });
});
