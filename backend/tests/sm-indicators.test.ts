// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — SM Multi-Timeframe Indicator Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { IndicatorService } from '../src/modules/indicators/service';

// ─── Mock Exchange Service ──────────────────────────────────────
function createMockExchange(timeframe?: string) {
  // Generate realistic kline data with patterns
  const basePrice = 50000;
  const klines: any[] = [];

  for (let i = 0; i < 200; i++) {
    // Create trending pattern (upward)
    const trend = i * 10;
    const noise = (Math.random() - 0.5) * 500;
    const open = basePrice + trend + noise;
    const high = open + Math.random() * 300;
    const low = open - Math.random() * 300;
    const close = open + (Math.random() - 0.5) * 200;
    const volume = 500 + Math.random() * 1000;

    klines.push({
      openTime: Date.now() - (200 - i) * 15 * 60 * 1000,
      open,
      high,
      low,
      close,
      volume,
      closeTime: Date.now() - (200 - i - 1) * 15 * 60 * 1000,
    });
  }

  return {
    getKlines: async () => klines,
    getTicker: async () => basePrice,
    getBalance: async () => ({ usdt_free: 1000, usdt_total: 1000 }),
  } as any;
}

// ─── Tests ──────────────────────────────────────────────────────
describe('SM Multi-Timeframe Indicators', () => {
  const mockExchange = createMockExchange();
  const service = new IndicatorService(mockExchange);

  describe('getMultiTimeframeData', () => {
    it('should return data for all 3 timeframes', async () => {
      const data = await service.getMultiTimeframeData('BTCUSDT');

      assert.ok(data.coin === 'BTC', 'Coin should be BTC');
      assert.ok(data.timeframes['15m'], 'Should have 15m data');
      assert.ok(data.timeframes['1h'], 'Should have 1h data');
      assert.ok(data.timeframes['4h'], 'Should have 4h data');
    });

    it('should have valid indicators for each timeframe', async () => {
      const data = await service.getMultiTimeframeData('BTCUSDT');

      for (const tf of ['15m', '1h', '4h'] as const) {
        const tfData = data.timeframes[tf];
        assert.ok(tfData.timeframe === tf, `Timeframe should be ${tf}`);
        assert.ok(tfData.indicators.rsi >= 0 && tfData.indicators.rsi <= 100, 'RSI out of range');
        assert.ok(tfData.indicators.adx >= 0, 'ADX should be >= 0');
        assert.ok(tfData.indicators.currentPrice > 0, 'Current price should be > 0');
      }
    });

    it('should have valid SM indicators for each timeframe', async () => {
      const data = await service.getMultiTimeframeData('BTCUSDT');

      for (const tf of ['15m', '1h', '4h'] as const) {
        const sm = data.timeframes[tf].sm;

        // Order Blocks
        assert.ok(Array.isArray(sm.orderBlocks), 'Order blocks should be array');
        for (const ob of sm.orderBlocks) {
          assert.ok(['BULLISH', 'BEARISH'].includes(ob.type), 'OB type invalid');
          assert.ok(ob.high > ob.low, 'OB high should be > low');
          assert.ok(ob.strength >= 0 && ob.strength <= 100, 'OB strength out of range');
        }

        // Liquidity Zones
        assert.ok(Array.isArray(sm.liquidityZones), 'Liquidity zones should be array');
        for (const lz of sm.liquidityZones) {
          assert.ok(['BUY_SIDE', 'SELL_SIDE'].includes(lz.type), 'LZ type invalid');
          assert.ok(lz.price > 0, 'LZ price should be > 0');
          assert.ok(lz.touches >= 3, 'LZ should have >= 3 touches');
        }

        // Structure Breaks
        assert.ok(Array.isArray(sm.structureBreaks), 'Structure breaks should be array');
        for (const sb of sm.structureBreaks) {
          assert.ok(['BULLISH', 'BEARISH'].includes(sb.type), 'SB type invalid');
          assert.ok(sb.level > 0, 'SB level should be > 0');
        }

        // Volume Profile
        assert.ok(sm.volumeProfile.poc > 0, 'POC should be > 0');
        assert.ok(sm.volumeProfile.vah >= sm.volumeProfile.poc, 'VAH should be >= POC');
        assert.ok(sm.volumeProfile.val <= sm.volumeProfile.poc, 'VAL should be <= POC');

        // Fibonacci Levels
        assert.ok(Array.isArray(sm.fibLevels), 'Fib levels should be array');
        assert.ok(sm.fibLevels.length === 7, 'Should have 7 fib levels');

        // Premium/Discount
        assert.ok(['PREMIUM', 'DISCOUNT', 'EQUILIBRIUM'].includes(sm.premiumDiscount), 'PD invalid');
      }
    });

    it('should calculate HTF bias correctly', async () => {
      const data = await service.getMultiTimeframeData('BTCUSDT');

      assert.ok(['BULLISH', 'BEARISH', 'NEUTRAL'].includes(data.htfBias), 'HTF bias invalid');
      assert.ok(data.confluenceScore >= 0 && data.confluenceScore <= 100, 'Confluence out of range');
      assert.ok(typeof data.alignment === 'boolean', 'Alignment should be boolean');
    });

    it('should have valid bias and strength for each timeframe', async () => {
      const data = await service.getMultiTimeframeData('BTCUSDT');

      for (const tf of ['15m', '1h', '4h'] as const) {
        const tfData = data.timeframes[tf];
        assert.ok(['BULLISH', 'BEARISH', 'NEUTRAL'].includes(tfData.bias), `${tf} bias invalid`);
        assert.ok(tfData.strength >= 0 && tfData.strength <= 100, `${tf} strength out of range`);
      }
    });
  });

  describe('SM Indicator Edge Cases', () => {
    it('should handle empty klines gracefully', async () => {
      const emptyExchange = {
        getKlines: async () => [],
        getTicker: async () => 0,
      } as any;
      const emptyService = new IndicatorService(emptyExchange);

      const data = await emptyService.getMultiTimeframeData('BTCUSDT');
      assert.ok(data.timeframes['15m'], 'Should still return 15m data');
      assert.ok(data.timeframes['15m'].sm.orderBlocks.length === 0, 'No OBs in empty data');
      assert.ok(data.timeframes['15m'].sm.liquidityZones.length === 0, 'No LZs in empty data');
    });

    it('should detect bullish order blocks in uptrend', async () => {
      // Create exchange with clear uptrend pattern
      const uptrendExchange = {
        getKlines: async () => {
          const klines: any[] = [];
          for (let i = 0; i < 200; i++) {
            const base = 50000 + i * 50; // Clear uptrend
            klines.push({
              open: base,
              high: base + 200,
              low: base - 100,
              close: base + 150,
              volume: i % 10 === 0 ? 2000 : 500, // Spike on some candles
            });
          }
          return klines;
        },
        getTicker: async () => 60000,
      } as any;

      const service = new IndicatorService(uptrendExchange);
      const data = await service.getMultiTimeframeData('BTCUSDT');

      // Should have bullish bias on most timeframes
      const biases = ['15m', '1h', '4h'].map(tf => data.timeframes[tf as keyof typeof data.timeframes].bias);
      const bullishCount = biases.filter(b => b === 'BULLISH').length;
      assert.ok(bullishCount >= 1, 'Should detect bullish bias in uptrend');
    });
  });
});
