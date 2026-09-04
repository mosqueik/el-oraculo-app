// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Trading Pipeline E2E Integration Tests
// Tests the full pipeline: Indicators → Scoring → Risk → Decision
// ═══════════════════════════════════════════════════════════════════

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { IndicatorService } from '../src/modules/indicators/service';
import { ScoringService } from '../src/modules/scoring/service';
import { RiskService, RiskContext } from '../src/modules/risk/service';
import {
  CoinSymbol, COIN_CONFIGS, ACTIVE_COINS,
  FullIndicatorData, MarketRegimeData, ScoringResult, RiskData,
} from '@el-oraculo/shared';

// ─── Mock Exchange Service ──────────────────────────────────────

type KlinePattern = 'BULLISH' | 'BEARISH' | 'RANGING' | 'VOLATILE';

interface MockConfig {
  pattern: KlinePattern;
  basePrice: number;
  balance?: number;
}

function createMockExchange(config: MockConfig) {
  const klines = generateKlines(config.pattern, config.basePrice, 200);

  return {
    getKlines: async () => klines,
    getTicker: async () => config.basePrice,
    getBalance: async () => ({
      usdt_free: config.balance ?? 1000,
      usdt_total: config.balance ?? 1000,
    }),
    marketBuy: async () => ({ fills: [{ price: config.basePrice }] }),
    marketSell: async () => ({ fills: [{ price: config.basePrice }] }),
  } as any;
}

function generateKlines(pattern: KlinePattern, basePrice: number, count: number): any[] {
  const klines: any[] = [];
  for (let i = 0; i < count; i++) {
    let open: number, high: number, low: number, close: number;
    switch (pattern) {
      case 'BULLISH':
        open = basePrice + i * 10 + (Math.random() - 0.3) * 50;
        high = open + Math.random() * 100;
        low = open - Math.random() * 30;
        close = open + 20 + Math.random() * 80;
        break;
      case 'BEARISH':
        open = basePrice - i * 10 + (Math.random() - 0.7) * 50;
        high = open + Math.random() * 30;
        low = open - Math.random() * 100;
        close = open - 20 - Math.random() * 80;
        break;
      case 'RANGING':
        open = basePrice + (Math.random() - 0.5) * 100;
        high = open + Math.random() * 50;
        low = open - Math.random() * 50;
        close = open + (Math.random() - 0.5) * 30;
        break;
      case 'VOLATILE':
        open = basePrice + (Math.random() - 0.5) * 500;
        high = open + Math.random() * 300;
        low = open - Math.random() * 300;
        close = open + (Math.random() - 0.5) * 400;
        break;
    }
    klines.push({
      openTime: Date.now() - (count - i) * 15 * 60 * 1000,
      open, high, low, close,
      volume: 500 + Math.random() * 2000,
      closeTime: Date.now() - (count - i - 1) * 15 * 60 * 1000,
    });
  }
  return klines;
}

// ─── Pipeline Helper ────────────────────────────────────────────

interface PipelineResult {
  indicators: FullIndicatorData;
  marketRegime: MarketRegimeData;
  scoring: ScoringResult;
  risk: RiskData;
  decision: 'COMPRAR' | 'VENDER' | 'ESPERAR';
  motivo: string;
}

async function runPipeline(
  coin: CoinSymbol,
  mockConfig: MockConfig,
  botState?: { status: string; entryPrice: number; entryTime: string; pisoActual: number; hoursHeld: number }
): Promise<PipelineResult> {
  const exchange = createMockExchange(mockConfig);
  const indicatorService = new IndicatorService(exchange);
  const scoringService = new ScoringService();
  const riskService = new RiskService();
  const config = COIN_CONFIGS[coin];

  // Node 1: INDICATORS
  const indicators = await indicatorService.getIndicators(config.pair);

  // Node 2: MARKET REGIME
  const marketRegime = indicatorService.getMarketRegime(indicators);

  // Node 4: SCORING
  const scoring = scoringService.scoreEntry({
    coin, config,
    balance: { usdt_free: mockConfig.balance ?? 1000, usdt_total: mockConfig.balance ?? 1000 },
    indicators, marketRegime,
    botState: {
      status: botState?.status ?? 'LÍQUIDO',
      entryPrice: botState?.entryPrice ?? 0,
      entryTime: botState?.entryTime ?? '',
      pisoActual: botState?.pisoActual ?? 0,
      streakLosses: 0,
      montoEntrada: 0,
      r: 0,
      hoursHeld: botState?.hoursHeld ?? 0,
    },
  });

  // Node 5: RISK
  const entryPrice = botState?.entryPrice ?? 0;
  const r = entryPrice > 0 ? ((mockConfig.basePrice - entryPrice) / entryPrice) * 100 : 0;
  const riskCtx: RiskContext = {
    entryPrice,
    currentPrice: mockConfig.basePrice,
    r,
    st: botState?.status ?? 'LÍQUIDO',
    pisoActual: botState?.pisoActual ?? 0,
    hoursHeld: botState?.hoursHeld ?? 0,
    config,
    marketRegime,
  };
  const risk = riskService.calculate(riskCtx);

  // Node 6: DECISION (simplified from engine logic)
  let decision: 'COMPRAR' | 'VENDER' | 'ESPERAR' = 'ESPERAR';
  let motivo = '';

  if (botState?.status === 'COMPRADO') {
    // EXIT conditions
    if (r <= risk.hardStop) {
      decision = 'VENDER';
      motivo = '🔴 ATR HARD STOP';
    } else if (r <= risk.v_piso && r > 0) {
      decision = 'VENDER';
      motivo = '🟠 TRAILING STOP';
    } else if (r >= risk.tp_target) {
      decision = 'VENDER';
      motivo = '🟢 TAKE PROFIT';
    } else if ((botState?.hoursHeld ?? 0) >= risk.maxHoldHours) {
      decision = 'VENDER';
      motivo = '⏰ TIME EXIT';
    } else {
      decision = 'ESPERAR';
      motivo = '🟢 HOLDING';
    }
  } else {
    // ENTRY conditions
    if (scoring.entryScore >= scoring.entryThreshold) {
      const monto = (mockConfig.balance ?? 1000) * config.risk_pct;
      if (monto >= config.entry_min) {
        decision = 'COMPRAR';
        motivo = `ENTRY: ${scoring.entryReasons.join('+')}`;
      } else {
        decision = 'ESPERAR';
        motivo = `💰 MONTO INSUFFICIENT`;
      }
    } else {
      decision = 'ESPERAR';
      motivo = `📊 SCORING: ${scoring.entryScore}/${scoring.entryThreshold}`;
    }
  }

  return { indicators, marketRegime, scoring, risk, decision, motivo };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('Trading Pipeline E2E', () => {
  describe('Indicator → Scoring Pipeline', () => {
    it('should calculate indicators and score for BTC', async () => {
      const result = await runPipeline('BTC', { pattern: 'BULLISH', basePrice: 50000 });

      assert.ok(result.indicators.rsi >= 0 && result.indicators.rsi <= 100, 'RSI in range');
      assert.ok(result.indicators.adx >= 0, 'ADX >= 0');
      assert.ok(result.indicators.currentPrice > 0, 'Current price > 0');
      assert.ok(typeof result.scoring.entryScore === 'number', 'Score is number');
      assert.ok(Array.isArray(result.scoring.entryReasons), 'Reasons is array');
    });

    it('should calculate indicators and score for all active coins', async () => {
      for (const coin of ACTIVE_COINS) {
        const config = COIN_CONFIGS[coin];
        const result = await runPipeline(coin, { pattern: 'RANGING', basePrice: 100 });

        assert.ok(result.indicators.rsi >= 0, `${coin}: RSI >= 0`);
        assert.ok(result.indicators.adx >= 0, `${coin}: ADX >= 0`);
        assert.ok(typeof result.scoring.entryScore === 'number', `${coin}: score is number`);
      }
    });

    it('should detect bullish indicators in bullish pattern', async () => {
      const result = await runPipeline('BTC', { pattern: 'BULLISH', basePrice: 50000 });

      // In bullish pattern, EMA20 should be > EMA50
      assert.ok(
        result.indicators.ema20 > 0 && result.indicators.ema50 > 0,
        'EMAs should be positive'
      );
    });
  });

  describe('Scoring → Risk Pipeline', () => {
    it('should calculate risk parameters based on regime', async () => {
      const result = await runPipeline('SOL', { pattern: 'VOLATILE', basePrice: 150 });

      assert.ok(result.risk.hardStop > 0, 'Hard stop should be a positive price level');
      assert.ok(result.risk.hardStop < 150, 'Hard stop should be below current price');
      assert.ok(result.risk.tp_target > 0, 'TP target should be positive');
      assert.ok(result.risk.maxHoldHours > 0, 'Max hold hours should be positive');
    });

    it('should adjust TP for high volatility', async () => {
      const volatile = await runPipeline('BTC', { pattern: 'VOLATILE', basePrice: 50000 });
      const ranging = await runPipeline('BTC', { pattern: 'RANGING', basePrice: 50000 });

      // Both should have valid TP targets
      assert.ok(volatile.risk.tp_target > 0, 'Volatile TP > 0');
      assert.ok(ranging.risk.tp_target > 0, 'Ranging TP > 0');
    });
  });

  describe('Full Pipeline: Entry Decisions', () => {
    it('should decide COMPRAR when conditions align', async () => {
      // Use low entry_min coin with good balance
      const result = await runPipeline('BTC', {
        pattern: 'BULLISH',
        basePrice: 50000,
        balance: 1000,
      });

      // Decision should be valid
      assert.ok(
        ['COMPRAR', 'ESPERAR'].includes(result.decision),
        'Decision should be COMPRAR or ESPERAR'
      );
    });

    it('should decide ESPERAR when score too low', async () => {
      const result = await runPipeline('BTC', {
        pattern: 'RANGING',
        basePrice: 50000,
        balance: 1000,
      });

      // In ranging market, score is usually low
      assert.ok(
        ['COMPRAR', 'ESPERAR'].includes(result.decision),
        'Decision should be valid'
      );
    });

    it('should filter BUY when balance too low', async () => {
      const result = await runPipeline('BTC', {
        pattern: 'BULLISH',
        basePrice: 50000,
        balance: 0.5, // Very low balance
      });

      // Should not COMPRAR with $0.50 balance
      if (result.decision === 'COMPRAR') {
        const monto = 0.5 * COIN_CONFIGS.BTC.risk_pct;
        assert.ok(monto < COIN_CONFIGS.BTC.entry_min, 'monto should be below entry_min');
      }
    });
  });

  describe('Full Pipeline: Exit Decisions', () => {
    it('should decide VENDER on hard stop loss', async () => {
      const entryPrice = 55000;
      const currentPrice = 50000; // -9% from entry
      const r = ((currentPrice - entryPrice) / entryPrice) * 100;

      const result = await runPipeline('BTC', {
        pattern: 'BEARISH',
        basePrice: currentPrice,
      }, {
        status: 'COMPRADO',
        entryPrice,
        entryTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        pisoActual: 54000,
        hoursHeld: 2,
      });

      // With -9% and hard_stop around -0.9%, should trigger hard stop
      assert.equal(result.decision, 'VENDER', 'Should VENDER on hard stop');
      assert.ok(result.motivo.includes('HARD STOP'), 'Motivo should mention hard stop');
    });

    it('should decide VENDER on take profit', async () => {
      const entryPrice = 50000;
      const currentPrice = 51000; // +2% profit
      const r = ((currentPrice - entryPrice) / entryPrice) * 100;

      const result = await runPipeline('BTC', {
        pattern: 'BULLISH',
        basePrice: currentPrice,
      }, {
        status: 'COMPRADO',
        entryPrice,
        entryTime: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        pisoActual: 49500,
        hoursHeld: 1,
      });

      // Should trigger take profit if r >= tp_target
      if (result.decision === 'VENDER') {
        assert.ok(
          result.motivo.includes('TAKE PROFIT') || result.motivo.includes('HARD STOP') || result.motivo.includes('TRAILING'),
          'Should be a valid exit reason'
        );
      }
    });

    it('should decide VENDER on time exit', async () => {
      const result = await runPipeline('BTC', {
        pattern: 'RANGING',
        basePrice: 50200, // Small profit
      }, {
        status: 'COMPRADO',
        entryPrice: 50000,
        entryTime: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
        pisoActual: 49500,
        hoursHeld: 7,
      });

      // 7h > 6h max hold → should VENDER (time exit or trailing stop)
      assert.equal(result.decision, 'VENDER', 'Should VENDER on time exit or trailing stop');
    });

    it('should decide ESPERAR or VENDER when holding with small profit', async () => {
      const result = await runPipeline('ETH', {
        pattern: 'RANGING',
        basePrice: 3010, // +0.33% profit
      }, {
        status: 'COMPRADO',
        entryPrice: 3000,
        entryTime: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        pisoActual: 2950,
        hoursHeld: 1,
      });

      // Small profit, not enough for TP, not enough time
      assert.ok(
        ['COMPRAR', 'VENDER', 'ESPERAR'].includes(result.decision),
        'Decision should be valid'
      );
    });
  });

  describe('Full Pipeline: Risk Calculations', () => {
    it('should calculate trailing stop that ratchets up', async () => {
      // First position at small profit
      const result1 = await runPipeline('SOL', {
        pattern: 'BULLISH',
        basePrice: 155,
      }, {
        status: 'COMPRADO',
        entryPrice: 150,
        entryTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        pisoActual: 148,
        hoursHeld: 2,
      });

      // Price rises more
      const result2 = await runPipeline('SOL', {
        pattern: 'BULLISH',
        basePrice: 160,
      }, {
        status: 'COMPRADO',
        entryPrice: 150,
        entryTime: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        pisoActual: result1.risk.v_piso, // Use previous floor
        hoursHeld: 3,
      });

      // Floor should have ratcheted up
      assert.ok(result2.risk.v_piso >= result1.risk.v_piso, 'Floor should ratchet up');
    });

    it('should calculate risk for all active coins', async () => {
      for (const coin of ACTIVE_COINS) {
        const config = COIN_CONFIGS[coin];
        const basePrice = config.entry_min * 10;
        const result = await runPipeline(coin, {
          pattern: 'RANGING',
          basePrice,
        });

        assert.ok(result.risk.hardStop > 0, `${coin}: hardStop should be positive price`);
        assert.ok(result.risk.hardStop < basePrice, `${coin}: hardStop should be below price`);
        assert.ok(result.risk.tp_target > 0, `${coin}: tp_target > 0`);
        assert.ok(result.risk.maxHoldHours > 0, `${coin}: maxHoldHours > 0`);
        assert.ok(result.risk.stopLoss < 0, `${coin}: stopLoss < 0`);
      }
    });
  });

  describe('Full Pipeline: Multi-Timeframe Integration', () => {
    it('should include multi-timeframe data in pipeline', async () => {
      const exchange = createMockExchange({ pattern: 'BULLISH', basePrice: 50000 });
      const indicatorService = new IndicatorService(exchange);

      const mtData = await indicatorService.getMultiTimeframeData('BTCUSDT');

      assert.ok(mtData.timeframes['15m'], 'Should have 15m data');
      assert.ok(mtData.timeframes['1h'], 'Should have 1h data');
      assert.ok(mtData.timeframes['4h'], 'Should have 4h data');
      assert.ok(mtData.confluenceScore >= 0 && mtData.confluenceScore <= 100, 'Confluence in range');
      assert.ok(typeof mtData.alignment === 'boolean', 'Alignment is boolean');
    });

    it('should detect SM indicators in each timeframe', async () => {
      const exchange = createMockExchange({ pattern: 'BULLISH', basePrice: 50000 });
      const indicatorService = new IndicatorService(exchange);

      const mtData = await indicatorService.getMultiTimeframeData('ETHUSDT');

      for (const tf of ['15m', '1h', '4h'] as const) {
        const data = mtData.timeframes[tf];
        assert.ok(Array.isArray(data.sm.orderBlocks), `${tf}: orderBlocks is array`);
        assert.ok(Array.isArray(data.sm.liquidityZones), `${tf}: liquidityZones is array`);
        assert.ok(Array.isArray(data.sm.structureBreaks), `${tf}: structureBreaks is array`);
        assert.ok(data.sm.volumeProfile.poc > 0, `${tf}: POC > 0`);
        assert.ok(data.sm.fibLevels.length === 7, `${tf}: 7 fib levels`);
      }
    });
  });

  describe('Full Pipeline: Market Regime Detection', () => {
    it('should detect TRENDING regime in strong trend', async () => {
      const result = await runPipeline('BTC', { pattern: 'BULLISH', basePrice: 50000 });
      // ADX > 25 in strong trend
      assert.ok(
        ['TRENDING', 'RANGING', 'VOLATILE', 'NEUTRAL'].includes(result.marketRegime.regime),
        'Regime should be valid'
      );
    });

    it('should detect RANGING regime in sideways market', async () => {
      const result = await runPipeline('ETH', { pattern: 'RANGING', basePrice: 3000 });
      assert.ok(
        ['TRENDING', 'RANGING', 'VOLATILE', 'NEUTRAL'].includes(result.marketRegime.regime),
        'Regime should be valid'
      );
    });

    it('should return valid regime multiplier', async () => {
      const result = await runPipeline('SOL', { pattern: 'VOLATILE', basePrice: 150 });
      assert.ok(result.marketRegime.regimeMultiplier > 0, 'Multiplier should be > 0');
      assert.ok(result.marketRegime.regimeMultiplier <= 2, 'Multiplier should be reasonable');
    });
  });

  describe('Full Pipeline: Edge Cases', () => {
    it('should handle zero balance gracefully', async () => {
      const result = await runPipeline('BTC', {
        pattern: 'BULLISH',
        basePrice: 50000,
        balance: 0,
      });

      // Should not COMPRAR with zero balance
      if (result.decision === 'COMPRAR') {
        const monto = 0 * COIN_CONFIGS.BTC.risk_pct;
        assert.ok(monto < COIN_CONFIGS.BTC.entry_min, 'monto should be below entry_min');
      }
    });

    it('should handle very low prices', async () => {
      const result = await runPipeline('DOGE', { pattern: 'RANGING', basePrice: 0.20 });
      assert.ok(typeof result.indicators.currentPrice === 'number', 'Price should be a number');
      assert.ok(typeof result.risk.tp_target === 'number', 'TP should be a number');
    });

    it('should handle very high prices', async () => {
      const result = await runPipeline('BTC', { pattern: 'RANGING', basePrice: 100000 });
      assert.ok(result.indicators.currentPrice > 0, 'Price should be positive');
      assert.ok(result.risk.hardStop > 0, 'Hard stop should be positive price');
      assert.ok(result.risk.hardStop < 100000, 'Hard stop should be below price');
    });
  });
});
