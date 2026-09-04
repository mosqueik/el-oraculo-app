// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Backtest Runner Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it } from 'node:test';
import assert from 'node:assert';

// We test the internal logic by importing the module
// Since the service uses real Binance API, we test the helper/calculation methods
// and mock-free scenarios

// ─── Import the module to access types and verify exports ────────
import {
  BacktestRunner,
  BacktestParams,
  BacktestResult,
  SignalAccuracyStats,
} from '../src/modules/backtesting/service';

// ─── Generate synthetic candles for testing ───────────────────────
function generateCandles(count: number, basePrice: number, volatility: number = 0.02): Array<{
  timestamp: number; open: number; high: number; low: number; close: number; volume: number;
}> {
  const candles = [];
  let price = basePrice;
  const startTime = Date.now() - count * 15 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.48) * volatility;
    const open = price;
    price = price * (1 + change);
    const close = price;
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
    const volume = 1000 + Math.random() * 5000;

    candles.push({
      timestamp: startTime + i * 15 * 60 * 1000,
      open, high, low, close, volume,
    });
  }
  return candles;
}

// ─── Create a runner instance (for method testing) ────────────────
const runner = new BacktestRunner() as any; // Access private methods via `any`

describe('BacktestRunner', () => {
  describe('Indicator calculation from candles', () => {
    it('should calculate indicators from 200 candles', () => {
      const candles = generateCandles(200, 65000);
      const indicators = runner.calculateFromCandles(candles);

      assert.ok(typeof indicators.rsi === 'number', 'RSI should be a number');
      assert.ok(indicators.rsi >= 0 && indicators.rsi <= 100, 'RSI should be 0-100');
      assert.ok(typeof indicators.adx === 'number', 'ADX should be a number');
      assert.ok(indicators.adx >= 0, 'ADX should be non-negative');
      assert.ok(typeof indicators.atr_pct === 'number', 'ATR% should be a number');
      assert.ok(indicators.currentPrice > 0, 'Current price should be positive');
      assert.ok(indicators.ema20 > 0, 'EMA20 should be positive');
      assert.ok(indicators.ema50 > 0, 'EMA50 should be positive');
    });

    it('should detect BULL/BEAR momentum correctly', () => {
      // Create uptrend
      const uptrend = [];
      let p = 100;
      for (let i = 0; i < 200; i++) {
        p *= 1.005;
        const o = p / 1.003;
        const h = p * 1.002;
        const l = o * 0.998;
        uptrend.push({ timestamp: i, open: o, high: h, low: l, close: p, volume: 1000 });
      }

      const indicators = runner.calculateFromCandles(uptrend);
      // Strong uptrend should have BULL momentum
      assert.ok(indicators.momentum === 'BULL' || indicators.rsi > 60,
        `Uptrend should have bullish signals, got momentum=${indicators.momentum} RSI=${indicators.rsi}`);
    });

    it('should detect FVG (Fair Value Gap)', () => {
      const candles = generateCandles(200, 100);
      const indicators = runner.calculateFromCandles(candles);
      assert.ok(['BULLISH', 'BEARISH', 'NEUTRAL'].includes(indicators.fvg));
    });

    it('should calculate MACD correctly', () => {
      const candles = generateCandles(200, 65000);
      const indicators = runner.calculateFromCandles(candles);
      if (indicators.macd) {
        assert.ok(typeof indicators.macd.macd === 'number');
        assert.ok(typeof indicators.macd.signal === 'number');
        assert.ok(typeof indicators.macd.histogram === 'number');
      }
    });

    it('should handle empty candles gracefully', () => {
      const indicators = runner.calculateFromCandles([]);
      assert.ok(indicators.rsi === 50, 'Empty candles should return default RSI');
      assert.ok(indicators.currentPrice === 0, 'Empty candles should return 0 price');
    });
  });

  describe('SM Indicator calculations', () => {
    it('should detect Order Blocks', () => {
      const candles = generateCandles(200, 100, 0.03);
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);
      const opens = candles.map(c => c.open);
      const closes = candles.map(c => c.close);
      const volumes = candles.map(c => c.volume);

      const obs = runner.detectOrderBlocks(highs, lows, opens, closes, volumes);
      assert.ok(Array.isArray(obs), 'Order blocks should be an array');
      for (const ob of obs) {
        assert.ok(ob.type === 'BULLISH' || ob.type === 'BEARISH');
        assert.ok(ob.high > ob.low, 'OB high should be > low');
        assert.ok(ob.strength > 0, 'OB strength should be positive');
      }
    });

    it('should detect Structure Breaks', () => {
      const candles = generateCandles(200, 100);
      const closes = candles.map(c => c.close);
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);

      const breaks = runner.detectStructureBreaks(closes, highs, lows);
      assert.ok(Array.isArray(breaks), 'Structure breaks should be an array');
      for (const sb of breaks) {
        assert.ok(sb.type === 'BULLISH' || sb.type === 'BEARISH');
        assert.ok(sb.level > 0, 'BOS level should be positive');
      }
    });

    it('should calculate Volume Profile', () => {
      const candles = generateCandles(200, 100);
      const closes = candles.map(c => c.close);
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);
      const volumes = candles.map(c => c.volume);

      const vp = runner.calculateVolumeProfile(closes, highs, lows, volumes);
      assert.ok(vp.poc > 0, 'POC should be positive');
      assert.ok(vp.vah >= vp.poc, 'VAH should be >= POC');
      assert.ok(vp.val <= vp.poc, 'VAL should be <= POC');
      assert.ok(vp.totalVolume > 0, 'Total volume should be positive');
    });

    it('should calculate Fibonacci levels', () => {
      const candles = generateCandles(200, 100);
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);

      const fibs = runner.calculateFibLevels(highs, lows);
      assert.ok(Array.isArray(fibs), 'Fib levels should be an array');
      assert.ok(fibs.length === 7, 'Should have 7 Fibonacci levels');
      assert.ok(fibs[0].level === 0, 'First level should be 0');
      assert.ok(fibs[6].level === 1, 'Last level should be 1');
    });

    it('should determine Premium/Discount zone', () => {
      const candles = generateCandles(200, 100);
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);

      const pd = runner.getPremiumDiscount(100, highs, lows);
      assert.ok(['PREMIUM', 'DISCOUNT', 'EQUILIBRIUM'].includes(pd));
    });

    it('should calculate Liquidity Zones', () => {
      const candles = generateCandles(200, 100, 0.01);
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);
      const volumes = candles.map(c => c.volume);

      const zones = runner.detectLiquidityZones(highs, lows, volumes);
      assert.ok(Array.isArray(zones), 'Liquidity zones should be an array');
      for (const z of zones) {
        assert.ok(z.type === 'BUY_SIDE' || z.type === 'SELL_SIDE');
        assert.ok(z.price > 0, 'Zone price should be positive');
        assert.ok(z.touches >= 3, 'Zone should have at least 3 touches');
      }
    });
  });

  describe('Market Regime', () => {
    it('should detect TRENDING regime (ADX > 25)', () => {
      const regime = runner.calculateMarketRegime({
        adx: 30, atr_pct: 1.0, plusDI: 30, minusDI: 20, rsi: 60, fvg: 'NEUTRAL',
      });
      assert.strictEqual(regime.regime, 'TRENDING');
    });

    it('should detect VOLATILE regime (ATR% > 2)', () => {
      const regime = runner.calculateMarketRegime({
        adx: 18, atr_pct: 3.0, plusDI: 15, minusDI: 15, rsi: 50, fvg: 'NEUTRAL',
      });
      assert.strictEqual(regime.regime, 'VOLATILE');
    });

    it('should detect RANGING regime (ADX < 20)', () => {
      const regime = runner.calculateMarketRegime({
        adx: 15, atr_pct: 0.8, plusDI: 10, minusDI: 12, rsi: 45, fvg: 'NEUTRAL',
      });
      assert.strictEqual(regime.regime, 'RANGING');
    });

    it('should calculate regime multiplier', () => {
      const trending = runner.calculateMarketRegime({
        adx: 30, atr_pct: 1.0, plusDI: 25, minusDI: 15, rsi: 55, fvg: 'NEUTRAL',
      });
      assert.strictEqual(trending.regimeMultiplier, 1.2);

      const volatile = runner.calculateMarketRegime({
        adx: 18, atr_pct: 3.0, plusDI: 15, minusDI: 15, rsi: 50, fvg: 'NEUTRAL',
      });
      assert.strictEqual(volatile.regimeMultiplier, 0.8);
    });
  });

  describe('Multi-Timeframe Bias', () => {
    it('should calculate HTF bias with proper weighting', () => {
      const timeframes = {
        '15m': { bias: 'BULLISH' as const, strength: 80 },
        '1h': { bias: 'BULLISH' as const, strength: 70 },
        '4h': { bias: 'BULLISH' as const, strength: 90 },
      };
      const bias = runner.calculateHTFBias(timeframes);
      assert.strictEqual(bias, 'BULLISH');
    });

    it('should return NEUTRAL when timeframes disagree', () => {
      // 4h(0.5) bearish strong vs 1h+15m bullish weak → NEUTRAL
      const timeframes = {
        '15m': { bias: 'BULLISH' as const, strength: 30 },
        '1h': { bias: 'BULLISH' as const, strength: 30 },
        '4h': { bias: 'BEARISH' as const, strength: 40 },
      };
      // weighted = 30*0.2 + 30*0.3 + (-40*0.5) = 6+9-20 = -5 → NEUTRAL
      const bias = runner.calculateHTFBias(timeframes);
      assert.strictEqual(bias, 'NEUTRAL');
    });

    it('should check alignment correctly', () => {
      const aligned = {
        '15m': { bias: 'BULLISH' as const, strength: 50 },
        '1h': { bias: 'BULLISH' as const, strength: 60 },
        '4h': { bias: 'BULLISH' as const, strength: 70 },
      };
      assert.ok(runner.checkAlignment(aligned), 'All bullish should be aligned');

      const misaligned = {
        '15m': { bias: 'BULLISH' as const, strength: 50 },
        '1h': { bias: 'BEARISH' as const, strength: 60 },
        '4h': { bias: 'BULLISH' as const, strength: 70 },
      };
      assert.ok(!runner.checkAlignment(misaligned), 'Mixed biases should not be aligned');
    });
  });

  describe('Confluence Score', () => {
    it('should calculate confluence with SM bonus', () => {
      const timeframes = {
        '15m': { bias: 'BULLISH' as const, strength: 60, sm: { orderBlocks: [{}], structureBreaks: [{}], liquidityZones: [] } },
        '1h': { bias: 'BULLISH' as const, strength: 70, sm: { orderBlocks: [], structureBreaks: [{}], liquidityZones: [{}] } },
        '4h': { bias: 'BULLISH' as const, strength: 80, sm: { orderBlocks: [{}], structureBreaks: [], liquidityZones: [] } },
      };
      const score = runner.calculateConfluence(timeframes);
      assert.ok(score > 0, 'Confluence should be positive');
      assert.ok(score <= 100, 'Confluence should be capped at 100');
    });
  });

  describe('Signal Accuracy Stats', () => {
    it('should calculate stats correctly', () => {
      const signals = [
        { signalType: 'ORDER_BLOCK', outcome: 'WIN', pnlPct: 2, priceAtSignal: 100, priceAfter5: 101, priceAfter10: 102, priceAfter20: 103 },
        { signalType: 'ORDER_BLOCK', outcome: 'WIN', pnlPct: 1, priceAtSignal: 100, priceAfter5: 100.5, priceAfter10: 101, priceAfter20: 101.5 },
        { signalType: 'ORDER_BLOCK', outcome: 'LOSS', pnlPct: -1, priceAtSignal: 100, priceAfter5: 99, priceAfter10: 98, priceAfter20: 97 },
        { signalType: 'BOS', outcome: 'WIN', pnlPct: 3, priceAtSignal: 100, priceAfter5: 102, priceAfter10: 103, priceAfter20: 104 },
      ];

      const stats = runner.validateSMSignals(signals);
      assert.strictEqual(stats.orderBlocks.total, 3);
      assert.strictEqual(stats.orderBlocks.wins, 2);
      assert.strictEqual(stats.orderBlocks.losses, 1);
      assert.ok(Math.abs(stats.orderBlocks.winRate - 66.67) < 0.1, `OB win rate should be ~66.7%, got ${stats.orderBlocks.winRate}`);

      assert.strictEqual(stats.bos.total, 1);
      assert.strictEqual(stats.bos.wins, 1);
    });

    it('should handle empty signals', () => {
      const stats = runner.validateSMSignals([]);
      assert.strictEqual(stats.orderBlocks.total, 0);
      assert.strictEqual(stats.orderBlocks.winRate, 0);
    });
  });

  describe('Decision Logic', () => {
    it('should decide VENDER on hard stop', () => {
      const decision = runner.makeDecision(
        { config: { risk_pct: 0.07, entry_min: 2 }, balance: { usdt_free: 100 } },
        { entryScore: 0, entryThreshold: 2, entryReasons: [] },
        { hardStop: 100, tp_target: 1, v_piso: 95, maxHoldHours: 6, beActive: false },
        { currentPrice: 99, rsi: 40 },
        { entryPrice: 105, holdCandles: 10 }
      );
      assert.strictEqual(decision.decision, 'VENDER');
      assert.ok(decision.motivo.includes('HARD STOP'));
    });

    it('should decide VENDER on take profit', () => {
      const decision = runner.makeDecision(
        { config: { risk_pct: 0.07, entry_min: 2 }, balance: { usdt_free: 100 } },
        { entryScore: 0, entryThreshold: 2, entryReasons: [] },
        { hardStop: 90, tp_target: 1.0, v_piso: 85, maxHoldHours: 6, beActive: false },
        { currentPrice: 101.5, rsi: 50, momentum: 'BULL' },
        { entryPrice: 100, holdCandles: 4 }
      );
      assert.strictEqual(decision.decision, 'VENDER');
      assert.ok(decision.motivo.includes('TAKE PROFIT'));
    });

    it('should decide VENDER on time exit', () => {
      const decision = runner.makeDecision(
        { config: { risk_pct: 0.07, entry_min: 2 }, balance: { usdt_free: 100 } },
        { entryScore: 0, entryThreshold: 2, entryReasons: [] },
        { hardStop: 90, tp_target: 5, v_piso: 85, maxHoldHours: 6, beActive: false },
        { currentPrice: 100.3, rsi: 50, momentum: 'NEUTRAL' },
        { entryPrice: 100, holdCandles: 28 } // 28 * 0.25 = 7h > 6h
      );
      assert.strictEqual(decision.decision, 'VENDER');
      assert.ok(decision.motivo.includes('TIME EXIT'));
    });

    it('should decide ESPERAR when holding and conditions not met', () => {
      const decision = runner.makeDecision(
        { config: { risk_pct: 0.07, entry_min: 2 }, balance: { usdt_free: 100 } },
        { entryScore: 0, entryThreshold: 2, entryReasons: [] },
        { hardStop: 90, tp_target: 5, v_piso: 85, maxHoldHours: 6, beActive: false },
        { currentPrice: 100.3, rsi: 50, momentum: 'NEUTRAL' },
        { entryPrice: 100, holdCandles: 8 } // 2h < 6h
      );
      assert.strictEqual(decision.decision, 'ESPERAR');
    });

    it('should decide COMPRAR when score meets threshold', () => {
      const decision = runner.makeDecision(
        { config: { risk_pct: 0.07, entry_min: 2 }, balance: { usdt_free: 100 } },
        { entryScore: 5, entryThreshold: 3, entryReasons: ['RSI_OVERSOLD', 'MOM_BULL'] },
        { hardStop: 90, tp_target: 1, v_piso: 85, maxHoldHours: 6, beActive: false },
        { currentPrice: 100, rsi: 30 },
        undefined // no position
      );
      assert.strictEqual(decision.decision, 'COMPRAR');
      assert.ok(decision.monto_reporte > 0);
    });

    it('should decide ESPERAR when score below threshold', () => {
      const decision = runner.makeDecision(
        { config: { risk_pct: 0.07, entry_min: 2 }, balance: { usdt_free: 100 } },
        { entryScore: 1, entryThreshold: 3, entryReasons: [] },
        { hardStop: 90, tp_target: 1, v_piso: 85, maxHoldHours: 6, beActive: false },
        { currentPrice: 100, rsi: 50 },
        undefined
      );
      assert.strictEqual(decision.decision, 'ESPERAR');
    });

    it('should exit on momentum BEAR when in profit', () => {
      const decision = runner.makeDecision(
        { config: { risk_pct: 0.07, entry_min: 2 }, balance: { usdt_free: 100 } },
        { entryScore: 0, entryThreshold: 2, entryReasons: [] },
        { hardStop: 90, tp_target: 10, v_piso: 85, maxHoldHours: 20, beActive: false },
        { currentPrice: 100.5, rsi: 50, momentum: 'BEAR' },
        { entryPrice: 100, holdCandles: 4 }
      );
      assert.strictEqual(decision.decision, 'VENDER');
      assert.ok(decision.motivo.includes('MOMENTUM BEAR'));
    });
  });

  describe('Paper Trading', () => {
    it('should execute paper buy and update balance', () => {
      const state = {
        balance: 1000, initialBalance: 1000, peakBalance: 1000,
        positions: new Map(), trades: [], smSignals: [], currentCandleIndex: 100,
      };

      runner.executePaperBuy(
        state, 'BTC', 65000,
        { risk_pct: 0.07, entry_min: 2, stop_loss: -0.5 },
        { rsi: 30 }, { entryScore: 5, entryReasons: [] },
        { htfBias: 'BULLISH', confluenceScore: 70, timeframes: { '15m': { sm: { orderBlocks: [], structureBreaks: [], liquidityZones: [] } } } },
        { regime: 'TRENDING' }
      );

      assert.ok(state.positions.has('BTC'), 'Should have BTC position');
      assert.ok(state.balance < 1000, 'Balance should decrease');
    });

    it('should execute paper sell and record trade', () => {
      const state = {
        balance: 930, initialBalance: 1000, peakBalance: 1000,
        positions: new Map(), trades: [], smSignals: [], currentCandleIndex: 110,
      };

      state.positions.set('BTC', {
        coin: 'BTC', entryPrice: 65000, entryDate: '2025-01-01',
        entryIndex: 100, entryScore: 5, entryReasons: [],
        regime: 'TRENDING', htfBias: 'BULLISH', confluenceScore: 70,
        obCount: 0, bosCount: 0, liquidtyCount: 0,
        peakPrice: 66000, pisoActual: 64000,
        streakLosses: 0, montoEntrada: 70, holdCandles: 10,
      });

      runner.executePaperSell(state, 'BTC', 66000, 'TAKE PROFIT', { entry_min: 2 });

      assert.ok(!state.positions.has('BTC'), 'Position should be removed');
      assert.strictEqual(state.trades.length, 1, 'Should have 1 trade');
      assert.ok(state.trades[0].pnlPct > 0, 'Trade should be profitable');
      assert.ok(state.balance > 930, 'Balance should increase');
    });
  });

  describe('Monthly Returns', () => {
    it('should group trades by month', () => {
      const state = {
        trades: [
          { exitDate: '2025-01-15T12:00:00Z', pnlPct: 2, coin: 'BTC' },
          { exitDate: '2025-01-20T12:00:00Z', pnlPct: -1, coin: 'ETH' },
          { exitDate: '2025-02-10T12:00:00Z', pnlPct: 3, coin: 'SOL' },
        ],
      };

      const monthly = runner.calculateMonthlyReturns(state);
      assert.strictEqual(monthly.length, 2);
      assert.strictEqual(monthly[0].month, '2025-01');
      assert.strictEqual(monthly[0].trades, 2);
      assert.ok(Math.abs(monthly[0].pnlPct - 1) < 0.01);
      assert.strictEqual(monthly[1].month, '2025-02');
      assert.strictEqual(monthly[1].trades, 1);
    });
  });

  describe('Per-Coin Stats', () => {
    it('should calculate per-coin performance', () => {
      const state = {
        trades: [
          { coin: 'BTC', pnlPct: 2 },
          { coin: 'BTC', pnlPct: -1 },
          { coin: 'ETH', pnlPct: 3 },
          { coin: 'SOL', pnlPct: 1.5 },
          { coin: 'SOL', pnlPct: -0.5 },
        ],
      };

      const stats = runner.calculatePerCoinStats(state, ['BTC', 'ETH', 'SOL']);
      assert.strictEqual(stats.BTC.trades, 2);
      assert.strictEqual(stats.BTC.winRate, 50);
      assert.strictEqual(stats.ETH.trades, 1);
      assert.strictEqual(stats.ETH.winRate, 100);
      assert.strictEqual(stats.SOL.trades, 2);
      assert.strictEqual(stats.SOL.winRate, 50);
    });
  });

  describe('Regime Performance', () => {
    it('should group performance by market regime', () => {
      const state = {
        trades: [
          { regime: 'TRENDING', pnlPct: 2 },
          { regime: 'TRENDING', pnlPct: -1 },
          { regime: 'RANGING', pnlPct: 0.5 },
        ],
      };

      const perf = runner.calculateRegimePerformance(state);
      assert.strictEqual(perf.TRENDING.trades, 2);
      assert.strictEqual(perf.TRENDING.winRate, 50);
      assert.strictEqual(perf.RANGING.trades, 1);
      assert.strictEqual(perf.RANGING.winRate, 100);
    });
  });
});
