// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Indicator Service Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { IndicatorService } from '../src/modules/indicators/service';
import { FullIndicatorData } from '@el-oraculo/shared';

// ─── Mock Exchange Service ──────────────────────────────────────
function createMockExchange() {
  // Generate realistic kline data (200 candles)
  const basePrice = 50000; // BTC-like
  const klines: any[] = [];

  for (let i = 0; i < 200; i++) {
    const variation = (Math.random() - 0.5) * 1000;
    const open = basePrice + variation;
    const high = open + Math.random() * 500;
    const low = open - Math.random() * 500;
    const close = open + (Math.random() - 0.5) * 300;
    const volume = Math.random() * 1000;

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
describe('IndicatorService', () => {
  const mockExchange = createMockExchange();
  const service = new IndicatorService(mockExchange);

  describe('getIndicators', () => {
    it('should return all L1 indicators (RSI, ADX, BB, ATR)', async () => {
      const indicators = await service.getIndicators('BTCUSDT');

      // RSI should be 0-100
      assert.ok(indicators.rsi >= 0 && indicators.rsi <= 100, `RSI ${indicators.rsi} out of range`);
      // ADX should be >= 0
      assert.ok(indicators.adx >= 0, `ADX ${indicators.adx} should be >= 0`);
      // BB should have upper > lower
      assert.ok(indicators.bb_upper >= indicators.bb_lower, 'BB upper should be >= lower');
      // ATR should be >= 0
      assert.ok(indicators.atr_pct >= 0, `ATR% ${indicators.atr_pct} should be >= 0`);
    });

    it('should return all L2 indicators (MACD, StochRSI, OBV, VWAP, EMA)', async () => {
      const indicators = await service.getIndicators('BTCUSDT');

      // MACD should have 3 components
      if (indicators.macd) {
        assert.ok(typeof indicators.macd.macd === 'number', 'MACD value should be number');
        assert.ok(typeof indicators.macd.signal === 'number', 'MACD signal should be number');
        assert.ok(typeof indicators.macd.histogram === 'number', 'MACD histogram should be number');
      }

      // StochRSI should have k and d
      if (indicators.stochRsi) {
        assert.ok(typeof indicators.stochRsi.k === 'number', 'StochRSI k should be number');
        assert.ok(typeof indicators.stochRsi.d === 'number', 'StochRSI d should be number');
      }

      // OBV should be a number
      assert.ok(typeof indicators.obv === 'number', 'OBV should be number');

      // VWAP should be > 0
      assert.ok(indicators.vwap > 0, `VWAP ${indicators.vwap} should be > 0`);

      // EMAs should be > 0
      assert.ok(indicators.ema20 > 0, 'EMA20 should be > 0');
      assert.ok(indicators.ema50 > 0, 'EMA50 should be > 0');
      assert.ok(indicators.ema200 > 0, 'EMA200 should be > 0');
    });

    it('should return all L3 indicators (FVG, Choch, Squeeze)', async () => {
      const indicators = await service.getIndicators('BTCUSDT');

      // FVG should be one of the valid types
      assert.ok(['BULLISH', 'BEARISH', 'NEUTRAL'].includes(indicators.fvg), `FVG ${indicators.fvg} invalid`);

      // Choch should be one of the valid types
      assert.ok(['BULLISH', 'BEARISH', 'NEUTRAL'].includes(indicators.choch), `Choch ${indicators.choch} invalid`);

      // Squeeze should be boolean
      assert.ok(typeof indicators.squeeze === 'boolean', 'Squeeze should be boolean');

      // Squeeze momentum should be number
      assert.ok(typeof indicators.squeezeMomentum === 'number', 'SqueezeMomentum should be number');

      // Momentum should be one of the valid types
      assert.ok(['BULL', 'BEAR', 'NEUTRAL'].includes(indicators.momentum), `Momentum ${indicators.momentum} invalid`);
    });

    it('should return valid currentPrice', async () => {
      const indicators = await service.getIndicators('BTCUSDT');
      assert.ok(indicators.currentPrice > 0, `CurrentPrice ${indicators.currentPrice} should be > 0`);
    });
  });

  describe('getMarketRegime', () => {
    it('should return valid market regime', () => {
      const indicators: FullIndicatorData = {
        rsi: 55, adx: 30, adx_btc: 20, histogram: 0.5,
        bb_lower: 48000, bb_upper: 52000, plusDI: 25, minusDI: 15,
        atr_pct: 1.5, volume: 1000,
        macd: { macd: 100, signal: 80, histogram: 20 },
        stochRsi: { k: 60, d: 55 }, obv: 500000, vwap: 50000,
        ema20: 50500, ema50: 50000, ema200: 49000,
        fvg: 'NEUTRAL', choch: 'NEUTRAL', squeeze: false,
        squeezeMomentum: 0, momentum: 'BULL',
        volumeChange: 5, bbWidth: 4, atr: 750, currentPrice: 50000,
      };

      const regime = service.getMarketRegime(indicators);

      assert.ok(['TRENDING', 'RANGING', 'VOLATILE', 'NEUTRAL'].includes(regime.regime));
      assert.ok(regime.regimeMultiplier > 0, 'Regime multiplier should be > 0');
      assert.ok(typeof regime.sentiment === 'string', 'Sentiment should be string');
    });
  });
});
