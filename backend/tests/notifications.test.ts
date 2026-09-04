// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Notification Service Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { NotificationService } from '../src/modules/notifications/service';

describe('NotificationService', () => {
  const service = new NotificationService();

  describe('notifyTrade', () => {
    it('should store trade notification locally', async () => {
      await service.notifyTrade({
        coin: 'BTC',
        action: 'COMPRAR',
        motivo: 'ENTRY: RSI_OVERSOLD',
        price: 50000,
        quantity: 0.002,
        timestamp: new Date().toISOString(),
      });

      const recent = service.getRecent(1);
      assert.equal(recent.length, 1);
      assert.equal((recent[0] as any).coin, 'BTC');
      assert.equal((recent[0] as any).action, 'COMPRAR');
    });

    it('should store sell notification with PnL', async () => {
      await service.notifyTrade({
        coin: 'ETH',
        action: 'VENDER',
        motivo: 'TAKE PROFIT',
        price: 3200,
        quantity: 0.5,
        pnl: '+3.2%',
        timestamp: new Date().toISOString(),
      });

      const recent = service.getRecent(2);
      assert.ok(recent.length >= 2);
    });
  });

  describe('notifyAlert', () => {
    it('should store alert notification', async () => {
      await service.notifyAlert({
        level: 'warning',
        title: 'Low Balance',
        message: 'USDT balance below $50',
        timestamp: new Date().toISOString(),
      });

      const recent = service.getRecent();
      assert.ok(recent.length >= 3);
    });

    it('should handle critical alerts', async () => {
      await service.notifyAlert({
        level: 'critical',
        title: 'API Error',
        message: 'Binance API timeout',
        coin: 'BTC',
        timestamp: new Date().toISOString(),
      });

      const recent = service.getRecent();
      assert.ok(recent.length >= 4);
    });
  });

  describe('getRecent', () => {
    it('should respect limit parameter', () => {
      const recent = service.getRecent(2);
      assert.ok(recent.length <= 2);
    });
  });

  describe('clear', () => {
    it('should clear all notifications', () => {
      service.clear();
      const recent = service.getRecent();
      assert.equal(recent.length, 0);
    });
  });
});
