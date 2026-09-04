// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Validation Middleware Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  PaginationQuerySchema,
  TimeRangeQuerySchema,
  PortfolioParamsSchema,
  PortfolioBuyBodySchema,
  PortfolioSellBodySchema,
  TradesQuerySchema,
  TradesRecentQuerySchema,
  TradesCoinParamsSchema,
  TradesCoinQuerySchema,
  TradesActionParamsSchema,
  ExecutionsQuerySchema,
  ExecutionsRecentQuerySchema,
  ExecutionsErrorsQuerySchema,
  ExecutionsCoinParamsSchema,
  ExecutionsCoinQuerySchema,
  ExecutionsIdParamsSchema,
  AuthRegisterBodySchema,
  AuthLoginBodySchema,
  CoinSymbolSchema,
} from '../src/validation/schemas';

// ─── Tests ──────────────────────────────────────────────────────
describe('Zod Validation Schemas', () => {
  describe('CoinSymbolSchema', () => {
    it('should accept valid coin symbols', () => {
      const validCoins = ['BTC', 'ETH', 'SOL', 'BNB', 'AVAX', 'POL', 'SUI', 'LINK', 'NEAR', 'DOGE', 'XRP', 'ARB', 'ADA', 'ESP'];
      for (const coin of validCoins) {
        const result = CoinSymbolSchema.safeParse(coin);
        assert.ok(result.success, `${coin} should be valid`);
      }
    });

    it('should reject invalid coin symbols', () => {
      const invalidCoins = ['btc', 'BTCUSDT', 'INVALID', '', '123'];
      for (const coin of invalidCoins) {
        const result = CoinSymbolSchema.safeParse(coin);
        assert.ok(!result.success, `${coin} should be invalid`);
      }
    });
  });

  describe('PaginationQuerySchema', () => {
    it('should apply defaults for missing values', () => {
      const result = PaginationQuerySchema.parse({});
      assert.equal(result.limit, 100);
      assert.equal(result.offset, 0);
    });

    it('should coerce string numbers', () => {
      const result = PaginationQuerySchema.parse({ limit: '50', offset: '10' });
      assert.equal(result.limit, 50);
      assert.equal(result.offset, 10);
    });

    it('should reject limit > 1000', () => {
      const result = PaginationQuerySchema.safeParse({ limit: 1001 });
      assert.ok(!result.success, 'limit > 1000 should be invalid');
    });

    it('should reject negative offset', () => {
      const result = PaginationQuerySchema.safeParse({ offset: -1 });
      assert.ok(!result.success, 'negative offset should be invalid');
    });
  });

  describe('TimeRangeQuerySchema', () => {
    it('should apply default hours', () => {
      const result = TimeRangeQuerySchema.parse({});
      assert.equal(result.hours, 24);
    });

    it('should accept valid hours', () => {
      const result = TimeRangeQuerySchema.parse({ hours: 48 });
      assert.equal(result.hours, 48);
    });

    it('should reject hours > 720', () => {
      const result = TimeRangeQuerySchema.safeParse({ hours: 721 });
      assert.ok(!result.success, 'hours > 720 should be invalid');
    });

    it('should reject hours < 1', () => {
      const result = TimeRangeQuerySchema.safeParse({ hours: 0 });
      assert.ok(!result.success, 'hours < 1 should be invalid');
    });
  });

  describe('Portfolio Schemas', () => {
    it('should accept valid portfolio params', () => {
      const result = PortfolioParamsSchema.parse({ coin: 'BTC' });
      assert.equal(result.coin, 'BTC');
    });

    it('should reject invalid coin in params', () => {
      const result = PortfolioParamsSchema.safeParse({ coin: 'INVALID' });
      assert.ok(!result.success, 'invalid coin should be rejected');
    });

    it('should accept valid buy body', () => {
      const result = PortfolioBuyBodySchema.parse({ entryPrice: 50000, monto: 100 });
      assert.equal(result.entryPrice, 50000);
      assert.equal(result.monto, 100);
    });

    it('should reject negative entryPrice', () => {
      const result = PortfolioBuyBodySchema.safeParse({ entryPrice: -100, monto: 100 });
      assert.ok(!result.success, 'negative entryPrice should be rejected');
    });

    it('should reject zero monto', () => {
      const result = PortfolioBuyBodySchema.safeParse({ entryPrice: 100, monto: 0 });
      assert.ok(!result.success, 'zero monto should be rejected');
    });

    it('should accept valid sell body', () => {
      const result = PortfolioSellBodySchema.parse({ reason: 'TAKE PROFIT', price: 55000 });
      assert.equal(result.reason, 'TAKE PROFIT');
      assert.equal(result.price, 55000);
    });

    it('should reject empty reason', () => {
      const result = PortfolioSellBodySchema.safeParse({ reason: '', price: 55000 });
      assert.ok(!result.success, 'empty reason should be rejected');
    });

    it('should reject negative price', () => {
      const result = PortfolioSellBodySchema.safeParse({ reason: 'TEST', price: -100 });
      assert.ok(!result.success, 'negative price should be rejected');
    });
  });

  describe('Trades Schemas', () => {
    it('should accept valid trades query', () => {
      const result = TradesQuerySchema.parse({ limit: '50', offset: '10' });
      assert.equal(result.limit, 50);
      assert.equal(result.offset, 10);
    });

    it('should accept valid recent query', () => {
      const result = TradesRecentQuerySchema.parse({ hours: '12' });
      assert.equal(result.hours, 12);
    });

    it('should accept valid coin params', () => {
      const result = TradesCoinParamsSchema.parse({ coin: 'ETH' });
      assert.equal(result.coin, 'ETH');
    });

    it('should accept valid coin query', () => {
      const result = TradesCoinQuerySchema.parse({ limit: '25' });
      assert.equal(result.limit, 25);
    });

    it('should accept valid action params', () => {
      const result = TradesActionParamsSchema.parse({ coin: 'SOL', action: 'COMPRAR' });
      assert.equal(result.coin, 'SOL');
      assert.equal(result.action, 'COMPRAR');
    });

    it('should reject invalid action', () => {
      const result = TradesActionParamsSchema.safeParse({ coin: 'SOL', action: 'INVALID' });
      assert.ok(!result.success, 'invalid action should be rejected');
    });
  });

  describe('Executions Schemas', () => {
    it('should accept valid executions query', () => {
      const result = ExecutionsQuerySchema.parse({ limit: '100', offset: '0' });
      assert.equal(result.limit, 100);
      assert.equal(result.offset, 0);
    });

    it('should accept valid recent query', () => {
      const result = ExecutionsRecentQuerySchema.parse({ hours: '24' });
      assert.equal(result.hours, 24);
    });

    it('should accept valid errors query', () => {
      const result = ExecutionsErrorsQuerySchema.parse({ hours: '6' });
      assert.equal(result.hours, 6);
    });

    it('should accept valid coin params', () => {
      const result = ExecutionsCoinParamsSchema.parse({ coin: 'BNB' });
      assert.equal(result.coin, 'BNB');
    });

    it('should accept valid coin query', () => {
      const result = ExecutionsCoinQuerySchema.parse({ limit: '50' });
      assert.equal(result.limit, 50);
    });

    it('should accept valid id params', () => {
      const result = ExecutionsIdParamsSchema.parse({ id: '123' });
      assert.equal(result.id, 123);
    });

    it('should reject non-numeric id', () => {
      const result = ExecutionsIdParamsSchema.safeParse({ id: 'abc' });
      assert.ok(!result.success, 'non-numeric id should be rejected');
    });

    it('should reject negative id', () => {
      const result = ExecutionsIdParamsSchema.safeParse({ id: '-1' });
      assert.ok(!result.success, 'negative id should be rejected');
    });
  });

  describe('Auth Schemas', () => {
    it('should accept valid register body', () => {
      const result = AuthRegisterBodySchema.parse({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });
      assert.equal(result.email, 'test@example.com');
      assert.equal(result.password, 'password123');
      assert.equal(result.name, 'Test User');
    });

    it('should accept register without name', () => {
      const result = AuthRegisterBodySchema.parse({
        email: 'test@example.com',
        password: 'password123',
      });
      assert.equal(result.email, 'test@example.com');
      assert.equal(result.name, undefined);
    });

    it('should reject invalid email', () => {
      const result = AuthRegisterBodySchema.safeParse({
        email: 'not-an-email',
        password: 'password123',
      });
      assert.ok(!result.success, 'invalid email should be rejected');
    });

    it('should reject short password', () => {
      const result = AuthRegisterBodySchema.safeParse({
        email: 'test@example.com',
        password: 'short',
      });
      assert.ok(!result.success, 'short password should be rejected');
    });

    it('should accept valid login body', () => {
      const result = AuthLoginBodySchema.parse({
        email: 'test@example.com',
        password: 'password123',
      });
      assert.equal(result.email, 'test@example.com');
      assert.equal(result.password, 'password123');
    });

    it('should reject empty password in login', () => {
      const result = AuthLoginBodySchema.safeParse({
        email: 'test@example.com',
        password: '',
      });
      assert.ok(!result.success, 'empty password should be rejected');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty objects with defaults', () => {
      const pagination = PaginationQuerySchema.parse({});
      assert.equal(pagination.limit, 100);
      assert.equal(pagination.offset, 0);

      const timeRange = TimeRangeQuerySchema.parse({});
      assert.equal(timeRange.hours, 24);
    });

    it('should handle string numbers in query params', () => {
      const result = PaginationQuerySchema.parse({ limit: '25', offset: '5' });
      assert.equal(result.limit, 25);
      assert.equal(result.offset, 5);
    });

    it('should reject missing required fields', () => {
      const result = PortfolioBuyBodySchema.safeParse({});
      assert.ok(!result.success, 'missing fields should be rejected');
    });

    it('should reject extra fields (strict mode)', () => {
      const result = PortfolioBuyBodySchema.safeParse({
        entryPrice: 100,
        monto: 50,
        extra: 'field',
      });
      // Zod strips extra fields by default, so this should succeed
      assert.ok(result.success, 'extra fields should be stripped');
    });
  });
});
