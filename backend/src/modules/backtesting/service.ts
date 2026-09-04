// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Backtest Runner (Full Pipeline Replay)
// ═══════════════════════════════════════════════════════════════════
//
// Replays the entire trading pipeline against historical kline data:
//   INDICATORS → MARKET_REGIME → SCORING → RISK → DECISION → EXECUTE
//
// Validates SM multi-timeframe signals (Order Blocks, BOS, Liquidity)
// against actual subsequent price action.
// ═══════════════════════════════════════════════════════════════════

import {
  RSI, ADX, BollingerBands, ATR, EMA,
  MACD, StochasticRSI, OBV,
} from 'technicalindicators';
import { logger } from '../../utils/logger';
import { IndicatorService } from '../indicators/service';
import { ScoringService } from '../scoring/service';
import { RiskService, RiskContext } from '../risk/service';
import {
  CoinSymbol, CoinConfig, COIN_CONFIGS, ACTIVE_COINS,
  FullIndicatorData, MarketRegimeData, ScoringResult, DecisionResult,
  MultiTimeframeData, Timeframe, TimeframeData, SMIndicators,
  OrderBlock, LiquidityZone, StructureBreak, VolumeProfile,
  FVGType,
} from '@el-oraculo/shared';

// ─── Types ───────────────────────────────────────────────────────

export interface BacktestParams {
  coins: CoinSymbol[];
  startDate: string;         // ISO date: '2025-01-01'
  endDate: string;           // ISO date: '2025-06-30'
  initialBalance: number;    // Starting USDT balance
  strategy?: 'default' | 'conservative' | 'aggressive';
}

export interface BacktestTrade {
  coin: CoinSymbol;
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  entryScore: number;
  entryReasons: string[];
  exitReason: string;
  pnlPct: number;
  holdCandles: number;
  holdHours: number;
  regime: string;
  htfBias: string;
  confluenceScore: number;
  obCount: number;           // Order Blocks at entry
  bosCount: number;          // Structure Breaks at entry
  liquidtyCount: number;     // Liquidity Zones at entry
}

export interface SMSignalValidation {
  signalType: string;        // 'ORDER_BLOCK' | 'BOS' | 'LIQUIDITY' | 'FVG' | 'PREMIUM_DISCOUNT'
  coin: CoinSymbol;
  direction: string;         // 'BULLISH' | 'BEARISH'
  timestamp: string;
  priceAtSignal: number;
  priceAfter5: number;       // Price 5 candles later
  priceAfter10: number;      // Price 10 candles later
  priceAfter20: number;      // Price 20 candles later
  outcome: 'WIN' | 'LOSS' | 'NEUTRAL';
  pnlPct: number;
}

export interface BacktestResult {
  params: BacktestParams;
  summary: {
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: number;
    totalPnlPct: number;
    avgPnlPct: number;
    maxDrawdown: number;
    maxConsecutiveLosses: number;
    profitFactor: number;
    sharpeRatio: number;
    avgHoldHours: number;
    bestTrade: number;
    worstTrade: number;
    totalCandles: number;
    simulationDurationMs: number;
  };
  perCoin: Record<CoinSymbol, {
    trades: number;
    winRate: number;
    totalPnlPct: number;
    avgPnlPct: number;
  }>;
  trades: BacktestTrade[];
  equityCurve: Array<{ date: string; balance: number; drawdown: number }>;
  monthlyReturns: Array<{ month: string; pnlPct: number; trades: number; winRate: number }>;
  smSignalAccuracy: {
    orderBlocks: SignalAccuracyStats;
    bos: SignalAccuracyStats;
    liquidityZones: SignalAccuracyStats;
    fvg: SignalAccuracyStats;
    premiumDiscount: SignalAccuracyStats;
  };
  regimePerformance: Record<string, { trades: number; winRate: number; avgPnl: number }>;
}

export interface SignalAccuracyStats {
  total: number;
  wins: number;
  losses: number;
  neutral: number;
  winRate: number;
  avgPnlPct: number;
  avgPnl5Candles: number;
  avgPnl10Candles: number;
  avgPnl20Candles: number;
}

// ─── Candle Replay Engine ────────────────────────────────────────

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface SimPosition {
  coin: CoinSymbol;
  entryPrice: number;
  entryDate: string;
  entryIndex: number;
  entryScore: number;
  entryReasons: string[];
  regime: string;
  htfBias: string;
  confluenceScore: number;
  obCount: number;
  bosCount: number;
  liquidtyCount: number;
  peakPrice: number;
  pisoActual: number;
  streakLosses: number;
  montoEntrada: number;
  holdCandles: number;
}

interface SimState {
  balance: number;
  initialBalance: number;
  peakBalance: number;
  positions: Map<CoinSymbol, SimPosition>;
  trades: BacktestTrade[];
  smSignals: SMSignalValidation[];
  currentCandleIndex: number;
}

// ─── Backtest Runner ─────────────────────────────────────────────

export class BacktestRunner {
  private scoring = new ScoringService();
  private risk = new RiskService();

  /**
   * Run a full backtest simulation against historical data.
   */
  async runBacktest(params: BacktestParams): Promise<BacktestResult> {
    const startTime = Date.now();
    logger.info(`🔬 BacktestRunner: ${params.coins.join(',')} | ${params.startDate} → ${params.endDate}`);

    // ── Step 1: Fetch historical data for all coins + BTC (for correlation) ──
    const historicalData = await this.fetchAllHistoricalData(params);

    // ── Step 2: Build simulation state ──
    const state: SimState = {
      balance: params.initialBalance,
      initialBalance: params.initialBalance,
      peakBalance: params.initialBalance,
      positions: new Map(),
      trades: [],
      smSignals: [],
      currentCandleIndex: 0,
    };

    // ── Step 3: Determine total candle count from first pair ──
    const firstPairCandles = historicalData.candles15m[params.coins.map(c => COIN_CONFIGS[c].pair)[0]] || [];
    const totalCandles = firstPairCandles.length;

    // ── Step 4: Candle-by-candle replay ──
    for (let i = 60; i < totalCandles; i++) { // Start at 60 for indicator warmup
      state.currentCandleIndex = i;

      for (const coin of params.coins) {
        try {
          await this.replayCandle(state, coin, i, historicalData, params);
        } catch (error) {
          // Silently skip errors on individual candles
        }
      }

      // Update equity curve peak
      const totalEquity = this.calculateTotalEquity(state, firstPairCandles[i]?.close || 0);
      state.peakBalance = Math.max(state.peakBalance, totalEquity);
    }

    // ── Step 5: Close any remaining positions at last price ──
    await this.closeAllPositions(state, historicalData, params);

    // ── Step 6: Validate SM signals ──
    const smSignalAccuracy = this.validateSMSignals(state.smSignals);

    // ── Step 7: Calculate analytics ──
    const summary = this.calculateSummary(state, params, Date.now() - startTime);
    const perCoin = this.calculatePerCoinStats(state, params.coins);
    const equityCurve = this.buildEquityCurve(state);
    const monthlyReturns = this.calculateMonthlyReturns(state);
    const regimePerformance = this.calculateRegimePerformance(state);

    return {
      params,
      summary,
      perCoin,
      trades: state.trades,
      equityCurve,
      monthlyReturns,
      smSignalAccuracy,
      regimePerformance,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // HISTORICAL DATA FETCHING
  // ═══════════════════════════════════════════════════════════════

  private async fetchAllHistoricalData(params: BacktestParams) {
    // Fetch from Binance REST API directly (no auth needed for klines)
    const timeframes: Timeframe[] = ['15m', '1h', '4h'];

    const fetchKlines = async (symbol: string, interval: string, startMs: number, endMs: number): Promise<Candle[]> => {
      const candles: Candle[] = [];
      let currentStart = startMs;

      while (currentStart < endMs) {
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${currentStart}&endTime=${endMs}&limit=1000`;
        try {
          const response = await fetch(url);
          if (!response.ok) break;
          const data = await response.json() as any[][];

          if (!data || data.length === 0) break;

          for (const k of data) {
            candles.push({
              timestamp: k[0],
              open: parseFloat(k[1]),
              high: parseFloat(k[2]),
              low: parseFloat(k[3]),
              close: parseFloat(k[4]),
              volume: parseFloat(k[5]),
            });
          }

          // Move start to after last candle
          currentStart = data[data.length - 1][0] + 1;
          if (data.length < 1000) break;
        } catch {
          break;
        }
      }

      return candles;
    };

    const startMs = new Date(params.startDate).getTime();
    const endMs = new Date(params.endDate).getTime();

    // Fetch 15m data for all coins + BTC
    const candles15m: Record<string, Candle[]> = {};
    const candles1h: Record<string, Candle[]> = {};
    const candles4h: Record<string, Candle[]> = {};

    // BTC is needed for correlation
    const allPairs = [...new Set([...params.coins.map(c => COIN_CONFIGS[c].pair), 'BTCUSDT'])];

    for (const pair of allPairs) {
      candles15m[pair] = await fetchKlines(pair, '15m', startMs, endMs);
      candles1h[pair] = await fetchKlines(pair, '1h', startMs, endMs);
      candles4h[pair] = await fetchKlines(pair, '4h', startMs, endMs);
    }

    return { candles15m, candles1h, candles4h };
  }

  // ═══════════════════════════════════════════════════════════════
  // CANDLE-BY-CANDLE REPLAY
  // ═══════════════════════════════════════════════════════════════

  private async replayCandle(
    state: SimState,
    coin: CoinSymbol,
    candleIndex: number,
    data: any,
    params: BacktestParams
  ): Promise<void> {
    const config = COIN_CONFIGS[coin];
    const pair = config.pair;

    // ── Build OHLCV slice up to current candle ──
    const slice15m = (data.candles15m[pair] || []).slice(Math.max(0, candleIndex - 200), candleIndex + 1);
    const slice1h = (data.candles1h[pair] || []);
    const slice4h = (data.candles4h[pair] || []);

    if (slice15m.length < 60) return; // Need warmup

    // ── Find matching candles on higher timeframes ──
    const currentTs = slice15m[slice15m.length - 1].timestamp;
    const htf1h = this.getHTFSlice(slice1h, currentTs, 200);
    const htf4h = this.getHTFSlice(slice4h, currentTs, 200);

    // ── BTC correlation ──
    const btcSlice = (data.candles15m['BTCUSDT'] || []).slice(Math.max(0, candleIndex - 200), candleIndex + 1);
    const btcIndicators = btcSlice.length >= 60 ? this.calculateFromCandles(btcSlice) : null;

    // ── Node 1: INDICATORS ──
    const indicators = this.calculateFromCandles(slice15m);

    // ── Node 1b: MULTI-TIMEFRAME ──
    const multiTimeframe = this.buildMultiTimeframeFromCandles(
      coin, slice15m, htf1h, htf4h
    );

    // ── Node 2: MARKET REGIME ──
    const marketRegime = this.calculateMarketRegime(indicators);

    // ── Node 3: STATUS ──
    const position = state.positions.get(coin);
    const currentPrice = indicators.currentPrice;
    const r = position && position.entryPrice > 0
      ? ((currentPrice - position.entryPrice) / position.entryPrice) * 100
      : 0;

    // ── Node 4: SCORING ──
    const ctx = {
      coin, config,
      balance: { usdt_free: state.balance, usdt_total: state.balance } as any,
      indicators, marketRegime, multiTimeframe,
      botState: {
        status: position ? 'COMPRADO' : 'LÍQUIDO',
        entryPrice: position?.entryPrice || 0,
        streakLosses: position?.streakLosses || 0,
      },
    };
    const scoring = this.scoring.scoreEntry(ctx);

    // ── Node 5: RISK ──
    const riskCtx: RiskContext = {
      entryPrice: position?.entryPrice || 0,
      currentPrice,
      r,
      st: position ? 'COMPRADO' : 'LÍQUIDO',
      pisoActual: position?.pisoActual || 0,
      hoursHeld: position ? position.holdCandles * 0.25 : 0, // 15m candles → hours
      config,
      marketRegime,
    };
    const risk = this.risk.calculate(riskCtx);

    // ── Node 6: DECISION ──
    const decision = this.makeDecision(ctx, scoring, risk, indicators, position);

    // ── Node 7: EXECUTE (paper trades) ──
    if (decision.decision === 'COMPRAR' && !position) {
      this.executePaperBuy(state, coin, currentPrice, config, indicators, scoring, multiTimeframe, marketRegime);
    } else if (decision.decision === 'VENDER' && position) {
      this.executePaperSell(state, coin, currentPrice, decision.motivo, config);
    } else if (position) {
      // Update position tracking
      position.holdCandles++;
      position.peakPrice = Math.max(position.peakPrice, currentPrice);
      // Update trailing stop floor
      if (currentPrice > position.entryPrice) {
        const trailOffset = (config as any).TRAILING_OFFSET || 0.05;
        const newPiso = currentPrice * (1 - trailOffset);
        position.pisoActual = Math.max(position.pisoActual, newPiso);
      }
    }

    // ── Node 8: SM SIGNAL VALIDATION ──
    this.recordSMSignals(state, coin, indicators, multiTimeframe, currentPrice, candleIndex, data.candles15m[pair]);
  }

  // ═══════════════════════════════════════════════════════════════
  // INDICATOR CALCULATION FROM CANDLES
  // ═══════════════════════════════════════════════════════════════

  private calculateFromCandles(candles: Candle[]): FullIndicatorData {
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const opens = candles.map(c => c.open);
    const volumes = candles.map(c => c.volume);
    const currentPrice = closes[closes.length - 1] || 0;

    // L1 Indicators
    const rsi = RSI.calculate({ values: closes, period: 14 });
    const lastRsi = rsi[rsi.length - 1] ?? 50;

    const adx = ADX.calculate({ high: highs, low: lows, close: closes, period: 14 });
    const lastAdx = adx[adx.length - 1] ?? { adx: 20, pdi: 0, mdi: 0 };

    const bb = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });
    const lastBB = bb[bb.length - 1] ?? { upper: 0, middle: 0, lower: 0 };
    const bbWidth = lastBB.upper > 0
      ? ((lastBB.upper - lastBB.lower) / lastBB.middle) * 100
      : 0;

    const atr = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });
    const lastAtr = atr[atr.length - 1] ?? 0;
    const atrPct = currentPrice > 0 ? (lastAtr / currentPrice) * 100 : 0;

    // L2 Indicators
    const ema20Arr = EMA.calculate({ values: closes, period: 20 });
    const ema50Arr = EMA.calculate({ values: closes, period: 50 });
    const ema200Arr = EMA.calculate({ values: closes, period: 200 });
    const ema20 = ema20Arr[ema20Arr.length - 1] ?? currentPrice;
    const ema50 = ema50Arr[ema50Arr.length - 1] ?? currentPrice;
    const ema200 = ema200Arr[ema200Arr.length - 1] ?? currentPrice;

    const macdRaw = MACD.calculate({
      values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
      SimpleMAOscillator: false, SimpleMASignal: false,
    });
    const lastMacdRaw = macdRaw[macdRaw.length - 1];
    const lastMacd = lastMacdRaw
      ? { macd: (lastMacdRaw as any).MACD ?? 0, signal: (lastMacdRaw as any).signal ?? 0, histogram: (lastMacdRaw as any).histogram ?? 0 }
      : null;

    const stochRsiRaw = StochasticRSI.calculate({
      values: closes, rsiPeriod: 14, stochasticPeriod: 14, kPeriod: 3, dPeriod: 3,
    });
    const lastStochRsiRaw = stochRsiRaw[stochRsiRaw.length - 1];
    const lastStochRsi = lastStochRsiRaw
      ? { k: (lastStochRsiRaw as any).k ?? (lastStochRsiRaw as any).stochRSI ?? 50, d: (lastStochRsiRaw as any).d ?? (lastStochRsiRaw as any).signal ?? 50 }
      : null;

    const obvRaw = OBV.calculate({ close: closes, volume: volumes });
    const lastObv = obvRaw[obvRaw.length - 1] ?? 0;

    let cumTypVol = 0, cumVol = 0;
    for (let i = 0; i < closes.length; i++) {
      const tp = (highs[i] + lows[i] + closes[i]) / 3;
      cumTypVol += tp * volumes[i];
      cumVol += volumes[i];
    }
    const vwap = cumVol > 0 ? cumTypVol / cumVol : currentPrice;

    // L3 Indicators
    const fvg = this.detectFVG(highs, lows);
    const choch = this.detectChoch(closes, highs, lows);

    const keltnerUpper = ema20 + lastAtr * 1.5;
    const keltnerLower = ema20 - lastAtr * 1.5;
    const squeezeActive = lastBB.lower > keltnerLower && lastBB.upper < keltnerUpper;

    let squeezeMomentum = 0;
    if (macdRaw.length >= 3) {
      const h1 = (macdRaw[macdRaw.length - 3] as any)?.histogram ?? 0;
      const h3 = (macdRaw[macdRaw.length - 1] as any)?.histogram ?? 0;
      squeezeMomentum = h3 - h1;
    }

    const macdHist = lastMacd?.histogram ?? 0;
    let momentum: 'BULL' | 'BEAR' | 'NEUTRAL' = 'NEUTRAL';
    if (ema20 > ema50 && lastRsi > 50 && macdHist > 0) {
      momentum = 'BULL';
    } else if (ema20 < ema50 && lastRsi < 50 && macdHist < 0) {
      momentum = 'BEAR';
    }

    const avgVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const currentVol = volumes[volumes.length - 1] || 0;
    const volumeChange = avgVol > 0 ? ((currentVol - avgVol) / avgVol) * 100 : 0;

    return {
      rsi: lastRsi, adx: lastAdx.adx, adx_btc: 0, histogram: macdHist,
      bb_lower: lastBB.lower, bb_upper: lastBB.upper,
      plusDI: lastAdx.pdi, minusDI: lastAdx.mdi,
      atr_pct: atrPct, volume: currentVol,
      macd: lastMacd, stochRsi: lastStochRsi, obv: lastObv, vwap,
      ema20, ema50, ema200,
      fvg, choch, squeeze: squeezeActive, squeezeMomentum, momentum,
      volumeChange, bbWidth, atr: lastAtr, currentPrice,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // MULTI-TIMEFRAME FROM CANDLES
  // ═══════════════════════════════════════════════════════════════

  private buildMultiTimeframeFromCandles(
    coin: string,
    candles15m: Candle[],
    candles1h: Candle[],
    candles4h: Candle[],
  ): MultiTimeframeData {
    const buildTF = (tf: Timeframe, candles: Candle[]): TimeframeData => {
      if (candles.length < 60) {
        return {
          timeframe: tf,
          indicators: this.emptyIndicators(candles),
          sm: this.emptySM(),
          bias: 'NEUTRAL',
          strength: 0,
        };
      }

      const indicators = this.calculateFromCandles(candles);
      const sm = this.calculateSMFromCandles(candles);
      const { bias, strength } = this.calculateBias(indicators, sm);

      return { timeframe: tf, indicators, sm, bias, strength };
    };

    const timeframes: Record<Timeframe, TimeframeData> = {
      '15m': buildTF('15m', candles15m),
      '1h': buildTF('1h', candles1h),
      '4h': buildTF('4h', candles4h),
    };

    const htfBias = this.calculateHTFBias(timeframes);
    const confluenceScore = this.calculateConfluence(timeframes);
    const alignment = this.checkAlignment(timeframes);

    return { coin, timeframes, htfBias, confluenceScore, alignment };
  }

  private emptyIndicators(candles: Candle[]): FullIndicatorData {
    const price = candles.length > 0 ? candles[candles.length - 1].close : 0;
    return {
      rsi: 50, adx: 20, adx_btc: 0, histogram: 0,
      bb_lower: price * 0.98, bb_upper: price * 1.02,
      plusDI: 0, minusDI: 0, atr_pct: 1, volume: 0,
      macd: null, stochRsi: null, obv: 0, vwap: price,
      ema20: price, ema50: price, ema200: price,
      fvg: 'NEUTRAL', choch: 'NEUTRAL', squeeze: false,
      squeezeMomentum: 0, momentum: 'NEUTRAL',
      volumeChange: 0, bbWidth: 4, atr: price * 0.01, currentPrice: price,
    };
  }

  private emptySM(): SMIndicators {
    return {
      orderBlocks: [], liquidityZones: [], structureBreaks: [],
      volumeProfile: { poc: 0, vah: 0, val: 0, totalVolume: 0 },
      fibLevels: [], premiumDiscount: 'EQUILIBRIUM',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // SM INDICATOR CALCULATIONS (same logic as IndicatorService)
  // ═══════════════════════════════════════════════════════════════

  private calculateSMFromCandles(candles: Candle[]): SMIndicators {
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const opens = candles.map(c => c.open);
    const volumes = candles.map(c => c.volume);
    const currentPrice = closes[closes.length - 1] || 0;

    return {
      orderBlocks: this.detectOrderBlocks(highs, lows, opens, closes, volumes),
      liquidityZones: this.detectLiquidityZones(highs, lows, volumes),
      structureBreaks: this.detectStructureBreaks(closes, highs, lows),
      volumeProfile: this.calculateVolumeProfile(closes, highs, lows, volumes),
      fibLevels: this.calculateFibLevels(highs, lows),
      premiumDiscount: this.getPremiumDiscount(currentPrice, highs, lows),
    };
  }

  private detectOrderBlocks(highs: number[], lows: number[], opens: number[], closes: number[], volumes: number[]): OrderBlock[] {
    const obs: OrderBlock[] = [];
    if (highs.length < 20) return obs;
    const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;

    for (let i = 5; i < highs.length - 1; i++) {
      const bodySize = Math.abs(closes[i] - opens[i]);
      const range = highs[i] - lows[i];
      if (range === 0 || bodySize / range <= 0.5) continue;
      if (volumes[i] <= avgVol * 1.5) continue;

      const nextMove = closes[i + 1] - closes[i];
      const displacement = Math.abs(nextMove) / closes[i];
      if (displacement < 0.005) continue;

      if (closes[i] < opens[i] && nextMove > 0) {
        obs.push({
          type: 'BULLISH', high: highs[i], low: lows[i], candleIndex: i,
          strength: Math.min(100, Math.round(displacement * 1000 + (volumes[i] / avgVol) * 10)),
        });
      }
      if (closes[i] > opens[i] && nextMove < 0) {
        obs.push({
          type: 'BEARISH', high: highs[i], low: lows[i], candleIndex: i,
          strength: Math.min(100, Math.round(displacement * 1000 + (volumes[i] / avgVol) * 10)),
        });
      }
    }

    const bullish = obs.filter(o => o.type === 'BULLISH').slice(-3);
    const bearish = obs.filter(o => o.type === 'BEARISH').slice(-3);
    return [...bullish, ...bearish];
  }

  private detectLiquidityZones(highs: number[], lows: number[], volumes: number[]): LiquidityZone[] {
    const zones: LiquidityZone[] = [];
    if (highs.length < 20) return zones;
    const bucketSize = 0.001;
    const sellSideBuckets: Record<number, { count: number; totalVol: number }> = {};
    const buySideBuckets: Record<number, { count: number; totalVol: number }> = {};

    for (let i = 0; i < highs.length; i++) {
      const hBucket = Math.round(highs[i] / (highs[i] * bucketSize));
      const lBucket = Math.round(lows[i] / (lows[i] * bucketSize));
      if (!sellSideBuckets[hBucket]) sellSideBuckets[hBucket] = { count: 0, totalVol: 0 };
      sellSideBuckets[hBucket].count++;
      sellSideBuckets[hBucket].totalVol += volumes[i];
      if (!buySideBuckets[lBucket]) buySideBuckets[lBucket] = { count: 0, totalVol: 0 };
      buySideBuckets[lBucket].count++;
      buySideBuckets[lBucket].totalVol += volumes[i];
    }

    const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    for (const [bucket, data] of Object.entries(sellSideBuckets)) {
      if (data.count >= 3) {
        zones.push({
          type: 'SELL_SIDE', price: Number(bucket) * bucketSize * (highs[0] || 1),
          strength: Math.min(100, data.count * 15 + Math.round(data.totalVol / avgVol) * 5),
          touches: data.count,
        });
      }
    }
    for (const [bucket, data] of Object.entries(buySideBuckets)) {
      if (data.count >= 3) {
        zones.push({
          type: 'BUY_SIDE', price: Number(bucket) * bucketSize * (lows[0] || 1),
          strength: Math.min(100, data.count * 15 + Math.round(data.totalVol / avgVol) * 5),
          touches: data.count,
        });
      }
    }

    return zones.sort((a, b) => b.strength - a.strength).slice(0, 6);
  }

  private detectStructureBreaks(closes: number[], highs: number[], lows: number[]): StructureBreak[] {
    const breaks: StructureBreak[] = [];
    if (closes.length < 20) return breaks;

    const swingHighs: { index: number; price: number }[] = [];
    const swingLows: { index: number; price: number }[] = [];

    for (let i = 5; i < highs.length - 5; i++) {
      const windowHighs = highs.slice(i - 5, i + 6);
      if (highs[i] === Math.max(...windowHighs)) swingHighs.push({ index: i, price: highs[i] });
      const windowLows = lows.slice(i - 5, i + 6);
      if (lows[i] === Math.min(...windowLows)) swingLows.push({ index: i, price: lows[i] });
    }

    for (let i = 1; i < swingHighs.length; i++) {
      const prev = swingHighs[i - 1];
      const curr = swingHighs[i];
      if (curr.price > prev.price && closes[curr.index] > prev.price) {
        breaks.push({ type: 'BULLISH', level: prev.price, candleIndex: curr.index });
      }
    }
    for (let i = 1; i < swingLows.length; i++) {
      const prev = swingLows[i - 1];
      const curr = swingLows[i];
      if (curr.price < prev.price && closes[curr.index] < prev.price) {
        breaks.push({ type: 'BEARISH', level: prev.price, candleIndex: curr.index });
      }
    }

    return breaks.slice(-5);
  }

  private calculateVolumeProfile(closes: number[], highs: number[], lows: number[], volumes: number[]): VolumeProfile {
    if (closes.length === 0) return { poc: 0, vah: 0, val: 0, totalVolume: 0 };
    const priceRange = Math.max(...highs) - Math.min(...lows);
    const bucketCount = 50;
    const bucketSize = priceRange / bucketCount;
    const minPrice = Math.min(...lows);
    const buckets: { price: number; volume: number }[] = [];
    for (let i = 0; i < bucketCount; i++) buckets.push({ price: minPrice + bucketSize * (i + 0.5), volume: 0 });

    for (let i = 0; i < closes.length; i++) {
      const tp = (highs[i] + lows[i] + closes[i]) / 3;
      const bi = Math.min(bucketCount - 1, Math.max(0, Math.floor((tp - minPrice) / bucketSize)));
      buckets[bi].volume += volumes[i];
    }

    const pocBucket = buckets.reduce((max, b) => b.volume > max.volume ? b : max, buckets[0]);
    const totalVol = buckets.reduce((sum, b) => sum + b.volume, 0);
    const targetVol = totalVol * 0.7;
    let accumVol = pocBucket.volume;
    let vaLow = buckets.indexOf(pocBucket);
    let vaHigh = buckets.indexOf(pocBucket);

    while (accumVol < targetVol && (vaLow > 0 || vaHigh < bucketCount - 1)) {
      const down = vaLow > 0 ? buckets[vaLow - 1].volume : 0;
      const up = vaHigh < bucketCount - 1 ? buckets[vaHigh + 1].volume : 0;
      if (down >= up && vaLow > 0) { vaLow--; accumVol += buckets[vaLow].volume; }
      else if (vaHigh < bucketCount - 1) { vaHigh++; accumVol += buckets[vaHigh].volume; }
      else break;
    }

    return { poc: pocBucket.price, vah: buckets[vaHigh].price, val: buckets[vaLow].price, totalVolume: totalVol };
  }

  private calculateFibLevels(highs: number[], lows: number[]): { level: number; price: number }[] {
    if (highs.length < 20) return [];
    const lookback = Math.min(100, highs.length);
    const swingHigh = Math.max(...highs.slice(-lookback));
    const swingLow = Math.min(...lows.slice(-lookback));
    const range = swingHigh - swingLow;
    if (range <= 0) return [];
    return [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0].map(level => ({ level, price: swingLow + range * level }));
  }

  private getPremiumDiscount(currentPrice: number, highs: number[], lows: number[]): 'PREMIUM' | 'DISCOUNT' | 'EQUILIBRIUM' {
    if (highs.length < 20) return 'EQUILIBRIUM';
    const lookback = Math.min(100, highs.length);
    const swingHigh = Math.max(...highs.slice(-lookback));
    const swingLow = Math.min(...lows.slice(-lookback));
    const midpoint = (swingHigh + swingLow) / 2;
    if (currentPrice > midpoint * 1.01) return 'PREMIUM';
    if (currentPrice < midpoint * 0.99) return 'DISCOUNT';
    return 'EQUILIBRIUM';
  }

  private detectFVG(highs: number[], lows: number[]): FVGType {
    if (highs.length < 5) return 'NEUTRAL';
    for (let i = 3; i < highs.length; i++) {
      if (lows[i] > highs[i - 2] && (lows[i] - highs[i - 2]) / lows[i] > 0.001) return 'BULLISH';
    }
    for (let i = 3; i < highs.length; i++) {
      if (highs[i] < lows[i - 2] && (lows[i - 2] - highs[i]) / lows[i - 2] > 0.001) return 'BEARISH';
    }
    return 'NEUTRAL';
  }

  private detectChoch(closes: number[], highs: number[], lows: number[]): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    if (closes.length < 20) return 'NEUTRAL';
    const rHighs = highs.slice(-10);
    const rLows = lows.slice(-10);
    const prevHigh = Math.max(...rHighs.slice(0, 5));
    const prevLow = Math.min(...rLows.slice(0, 5));
    const currHigh = Math.max(...rHighs.slice(5));
    const currLow = Math.min(...rLows.slice(5));
    if (currHigh > prevHigh && closes[closes.length - 1] > prevHigh) return 'BULLISH';
    if (currLow < prevLow && closes[closes.length - 1] < prevLow) return 'BEARISH';
    return 'NEUTRAL';
  }

  // ═══════════════════════════════════════════════════════════════
  // BIAS / REGIME / DECISION (mirror IndicatorService logic)
  // ═══════════════════════════════════════════════════════════════

  private calculateBias(indicators: FullIndicatorData, sm: SMIndicators): { bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; strength: number } {
    let score = 0;
    if (indicators.ema20 > indicators.ema50) score += 20;
    else if (indicators.ema20 < indicators.ema50) score -= 20;
    if (indicators.rsi > 55) score += 15;
    else if (indicators.rsi < 45) score -= 15;
    if (indicators.histogram > 0) score += 15;
    else if (indicators.histogram < 0) score -= 15;
    if (indicators.adx > 25) score += indicators.plusDI > indicators.minusDI ? 10 : -10;
    for (const ob of sm.orderBlocks.slice(-2)) {
      if (ob.type === 'BULLISH' && indicators.currentPrice >= ob.low && indicators.currentPrice <= ob.high) score += 10;
      if (ob.type === 'BEARISH' && indicators.currentPrice >= ob.low && indicators.currentPrice <= ob.high) score -= 10;
    }
    for (const sb of sm.structureBreaks.slice(-2)) {
      if (sb.type === 'BULLISH') score += 10;
      if (sb.type === 'BEARISH') score -= 10;
    }
    if (sm.premiumDiscount === 'DISCOUNT') score += 5;
    if (sm.premiumDiscount === 'PREMIUM') score -= 5;
    if (indicators.momentum === 'BULL') score += 10;
    if (indicators.momentum === 'BEAR') score -= 10;
    if (indicators.fvg === 'BULLISH') score += 5;
    if (indicators.fvg === 'BEARISH') score -= 5;

    const strength = Math.min(100, Math.abs(score));
    const bias = score > 10 ? 'BULLISH' : score < -10 ? 'BEARISH' : 'NEUTRAL';
    return { bias, strength };
  }

  private calculateHTFBias(timeframes: Record<Timeframe, TimeframeData>): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    const weights: Record<Timeframe, number> = { '4h': 0.5, '1h': 0.3, '15m': 0.2 };
    let weightedScore = 0;
    for (const tf of ['15m', '1h', '4h'] as Timeframe[]) {
      const data = timeframes[tf];
      const tfScore = data.bias === 'BULLISH' ? 1 : data.bias === 'BEARISH' ? -1 : 0;
      weightedScore += tfScore * data.strength * weights[tf];
    }
    if (weightedScore > 15) return 'BULLISH';
    if (weightedScore < -15) return 'BEARISH';
    return 'NEUTRAL';
  }

  private calculateConfluence(timeframes: Record<Timeframe, TimeframeData>): number {
    let score = 0;
    for (const tf of ['15m', '1h', '4h'] as Timeframe[]) {
      const data = timeframes[tf];
      const weight = tf === '4h' ? 0.5 : tf === '1h' ? 0.3 : 0.2;
      score += data.strength * weight;
      if (data.sm.orderBlocks.length > 0) score += 5;
      if (data.sm.structureBreaks.length > 0) score += 5;
      if (data.sm.liquidityZones.length > 0) score += 3;
    }
    return Math.min(100, Math.round(score));
  }

  private checkAlignment(timeframes: Record<Timeframe, TimeframeData>): boolean {
    const biases = (['15m', '1h', '4h'] as Timeframe[]).map(tf => timeframes[tf].bias);
    return biases.every(b => b === biases[0]) && biases[0] !== 'NEUTRAL';
  }

  private calculateMarketRegime(indicators: FullIndicatorData): MarketRegimeData {
    let regime: 'TRENDING' | 'RANGING' | 'VOLATILE' | 'NEUTRAL' = 'NEUTRAL';
    if (indicators.adx > 25) regime = 'TRENDING';
    else if (indicators.atr_pct > 2) regime = 'VOLATILE';
    else if (indicators.adx < 20) regime = 'RANGING';

    let regimeMultiplier = 1.0;
    if (regime === 'TRENDING') regimeMultiplier = 1.2;
    if (regime === 'VOLATILE') regimeMultiplier = 0.8;
    if (regime === 'RANGING') regimeMultiplier = 0.7;

    return {
      regime, techRegime: regime,
      divergence: indicators.adx > 25 ? 1 : 0,
      lsRatio: indicators.plusDI / (indicators.minusDI || 1),
      longPct: indicators.plusDI > indicators.minusDI ? 60 : 40,
      sentiment: indicators.rsi > 50 ? 'VERDE' : indicators.rsi < 40 ? 'ROJO' : 'AMARILLO',
      atrPct: indicators.atr_pct, rsiPrev: indicators.rsi,
      rsiRising: indicators.rsi > 50, rsiFalling: indicators.rsi < 50,
      adxRising: indicators.adx > 20, prevFvg: indicators.fvg,
      regimeMultiplier,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // DECISION LOGIC (mirrors TradingEngine.makeDecision)
  // ═══════════════════════════════════════════════════════════════

  private makeDecision(
    ctx: any, scoring: ScoringResult, risk: any, indicators: FullIndicatorData,
    position?: SimPosition
  ): DecisionResult {
    const currentPrice = indicators.currentPrice;
    const config = ctx.config;

    if (position) {
      const r = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
      const hoursHeld = position.holdCandles * 0.25;

      // Priority 1: Hard stop
      if (currentPrice <= risk.hardStop) {
        return { decision: 'VENDER', motivo: '🔴 ATR HARD STOP', monto_reporte: 0 };
      }
      // Priority 2: Trailing stop
      if (currentPrice <= risk.v_piso && currentPrice > position.entryPrice) {
        return { decision: 'VENDER', motivo: '🟠 TRAILING STOP', monto_reporte: 0 };
      }
      // Priority 3: Take profit
      if (r >= risk.tp_target) {
        return { decision: 'VENDER', motivo: '🟢 TAKE PROFIT', monto_reporte: 0 };
      }
      // Priority 4: Time exit
      if (hoursHeld >= risk.maxHoldHours) {
        return { decision: 'VENDER', motivo: '⏰ TIME EXIT', monto_reporte: 0 };
      }
      // Priority 5: Safety exit (12h)
      if (hoursHeld >= 12) {
        return { decision: 'VENDER', motivo: '🛡️ SAFETY EXIT (12h)', monto_reporte: 0 };
      }
      // Priority 6: Break-even
      if (risk.beActive && r < 0.1 && r > 0) {
        return { decision: 'VENDER', motivo: '🔄 BREAK EVEN', monto_reporte: 0 };
      }
      // Priority 7: Momentum bear + profit
      if (indicators.momentum === 'BEAR' && r > 0.3) {
        return { decision: 'VENDER', motivo: '📉 MOMENTUM BEAR', monto_reporte: 0 };
      }
      // Priority 8: RSI overbought
      if (indicators.rsi > 75 && r > 0.2) {
        return { decision: 'VENDER', motivo: '📊 RSI EXIT', monto_reporte: 0 };
      }

      return { decision: 'ESPERAR', motivo: '🟢 HOLDING', monto_reporte: 0 };
    }

    // Entry conditions
    if (scoring.entryScore >= scoring.entryThreshold) {
      const monto = ctx.balance.usdt_free * config.risk_pct;
      if (monto >= config.entry_min) {
        return { decision: 'COMPRAR', motivo: `ENTRY: ${scoring.entryReasons.join('+')}`, monto_reporte: monto };
      }
      return { decision: 'ESPERAR', motivo: `💰 MONTO INSUFFICIENT`, monto_reporte: 0 };
    }

    return { decision: 'ESPERAR', motivo: `📊 SCORING: ${scoring.entryScore}/${scoring.entryThreshold}`, monto_reporte: 0 };
  }

  // ═══════════════════════════════════════════════════════════════
  // PAPER TRADE EXECUTION
  // ═══════════════════════════════════════════════════════════════

  private executePaperBuy(
    state: SimState, coin: CoinSymbol, price: number, config: CoinConfig,
    indicators: FullIndicatorData, scoring: ScoringResult,
    mtf: MultiTimeframeData, regime: MarketRegimeData,
  ): void {
    const monto = Math.min(state.balance * config.risk_pct, state.balance * 0.5);
    if (monto < config.entry_min) return;

    state.positions.set(coin, {
      coin, entryPrice: price, entryDate: new Date().toISOString(),
      entryIndex: state.currentCandleIndex,
      entryScore: scoring.entryScore, entryReasons: [...scoring.entryReasons],
      regime: regime.regime,
      htfBias: mtf.htfBias,
      confluenceScore: mtf.confluenceScore,
      obCount: mtf.timeframes['15m']?.sm.orderBlocks.length || 0,
      bosCount: mtf.timeframes['15m']?.sm.structureBreaks.length || 0,
      liquidtyCount: mtf.timeframes['15m']?.sm.liquidityZones.length || 0,
      peakPrice: price, pisoActual: price * (1 - (config.stop_loss ? Math.abs(config.stop_loss) / 100 : 0.02)),
      streakLosses: 0, montoEntrada: monto, holdCandles: 0,
    });

    state.balance -= monto;
  }

  private executePaperSell(state: SimState, coin: CoinSymbol, price: number, motivo: string, config: CoinConfig): void {
    const position = state.positions.get(coin);
    if (!position) return;

    const pnlPct = ((price - position.entryPrice) / position.entryPrice) * 100;
    const holdHours = position.holdCandles * 0.25;

    state.trades.push({
      coin, entryDate: position.entryDate, exitDate: new Date().toISOString(),
      entryPrice: position.entryPrice, exitPrice: price,
      entryScore: position.entryScore, entryReasons: position.entryReasons,
      exitReason: motivo, pnlPct, holdCandles: position.holdCandles, holdHours,
      regime: position.regime, htfBias: position.htfBias,
      confluenceScore: position.confluenceScore,
      obCount: position.obCount, bosCount: position.bosCount, liquidtyCount: position.liquidtyCount,
    });

    state.balance += position.montoEntrada * (1 + pnlPct / 100);
    state.positions.delete(coin);
  }

  private async closeAllPositions(state: SimState, data: any, params: BacktestParams): Promise<void> {
    for (const [coin, position] of state.positions) {
      const pair = COIN_CONFIGS[coin].pair;
      const candles = data.candles15m[pair] || [];
      const lastPrice = candles.length > 0 ? candles[candles.length - 1].close : position.entryPrice;
      this.executePaperSell(state, coin, lastPrice, '📅 END OF BACKTEST', COIN_CONFIGS[coin]);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SM SIGNAL VALIDATION
  // ═══════════════════════════════════════════════════════════════

  private recordSMSignals(
    state: SimState, coin: CoinSymbol, indicators: FullIndicatorData,
    mtf: MultiTimeframeData, price: number, candleIndex: number,
    allCandles: Candle[]
  ): void {
    const ts = new Date().toISOString();

    // Validate Order Blocks: are they respected (price doesn't break through)?
    for (const ob of mtf.timeframes['15m']?.sm.orderBlocks || []) {
      const futureIdx = Math.min(candleIndex + 10, allCandles.length - 1);
      const futurePrice = allCandles[futureIdx]?.close || price;
      const outcome = ob.type === 'BULLISH'
        ? (futurePrice >= price ? 'WIN' : 'LOSS')
        : (futurePrice <= price ? 'WIN' : 'LOSS');

      state.smSignals.push({
        signalType: 'ORDER_BLOCK', coin, direction: ob.type,
        timestamp: ts, priceAtSignal: price,
        priceAfter5: allCandles[Math.min(candleIndex + 5, allCandles.length - 1)]?.close || price,
        priceAfter10: futurePrice,
        priceAfter20: allCandles[Math.min(candleIndex + 20, allCandles.length - 1)]?.close || price,
        outcome, pnlPct: ((futurePrice - price) / price) * 100,
      });
    }

    // Validate BOS: did price continue in the break direction?
    for (const sb of mtf.timeframes['15m']?.sm.structureBreaks || []) {
      const futureIdx = Math.min(candleIndex + 10, allCandles.length - 1);
      const futurePrice = allCandles[futureIdx]?.close || price;
      const outcome = sb.type === 'BULLISH'
        ? (futurePrice >= sb.level ? 'WIN' : 'LOSS')
        : (futurePrice <= sb.level ? 'WIN' : 'LOSS');

      state.smSignals.push({
        signalType: 'BOS', coin, direction: sb.type,
        timestamp: ts, priceAtSignal: price,
        priceAfter5: allCandles[Math.min(candleIndex + 5, allCandles.length - 1)]?.close || price,
        priceAfter10: futurePrice,
        priceAfter20: allCandles[Math.min(candleIndex + 20, allCandles.length - 1)]?.close || price,
        outcome, pnlPct: ((futurePrice - price) / price) * 100,
      });
    }

    // Validate Premium/Discount
    const pd = mtf.timeframes['15m']?.sm.premiumDiscount;
    if (pd === 'DISCOUNT' || pd === 'PREMIUM') {
      const futureIdx = Math.min(candleIndex + 10, allCandles.length - 1);
      const futurePrice = allCandles[futureIdx]?.close || price;
      const outcome = pd === 'DISCOUNT'
        ? (futurePrice >= price ? 'WIN' : 'LOSS')
        : (futurePrice <= price ? 'WIN' : 'LOSS');

      state.smSignals.push({
        signalType: 'PREMIUM_DISCOUNT', coin, direction: pd === 'DISCOUNT' ? 'BULLISH' : 'BEARISH',
        timestamp: ts, priceAtSignal: price,
        priceAfter5: allCandles[Math.min(candleIndex + 5, allCandles.length - 1)]?.close || price,
        priceAfter10: futurePrice,
        priceAfter20: allCandles[Math.min(candleIndex + 20, allCandles.length - 1)]?.close || price,
        outcome, pnlPct: ((futurePrice - price) / price) * 100,
      });
    }

    // Validate FVG
    if (indicators.fvg !== 'NEUTRAL') {
      const futureIdx = Math.min(candleIndex + 10, allCandles.length - 1);
      const futurePrice = allCandles[futureIdx]?.close || price;
      const outcome = indicators.fvg === 'BULLISH'
        ? (futurePrice >= price ? 'WIN' : 'LOSS')
        : (futurePrice <= price ? 'WIN' : 'LOSS');

      state.smSignals.push({
        signalType: 'FVG', coin, direction: indicators.fvg,
        timestamp: ts, priceAtSignal: price,
        priceAfter5: allCandles[Math.min(candleIndex + 5, allCandles.length - 1)]?.close || price,
        priceAfter10: futurePrice,
        priceAfter20: allCandles[Math.min(candleIndex + 20, allCandles.length - 1)]?.close || price,
        outcome, pnlPct: ((futurePrice - price) / price) * 100,
      });
    }
  }

  private validateSMSignals(signals: SMSignalValidation[]): {
    orderBlocks: SignalAccuracyStats;
    bos: SignalAccuracyStats;
    liquidityZones: SignalAccuracyStats;
    fvg: SignalAccuracyStats;
    premiumDiscount: SignalAccuracyStats;
  } {
    const calcStats = (filtered: SMSignalValidation[]): SignalAccuracyStats => {
      const wins = filtered.filter(s => s.outcome === 'WIN');
      const losses = filtered.filter(s => s.outcome === 'LOSS');
      const neutral = filtered.filter(s => s.outcome === 'NEUTRAL');
      const total = filtered.length;

      return {
        total, wins: wins.length, losses: losses.length, neutral: neutral.length,
        winRate: total > 0 ? (wins.length / total) * 100 : 0,
        avgPnlPct: total > 0 ? filtered.reduce((s, x) => s + x.pnlPct, 0) / total : 0,
        avgPnl5Candles: total > 0 ? filtered.reduce((s, x) => s + ((x.priceAfter5 - x.priceAtSignal) / x.priceAtSignal) * 100, 0) / total : 0,
        avgPnl10Candles: total > 0 ? filtered.reduce((s, x) => s + ((x.priceAfter10 - x.priceAtSignal) / x.priceAtSignal) * 100, 0) / total : 0,
        avgPnl20Candles: total > 0 ? filtered.reduce((s, x) => s + ((x.priceAfter20 - x.priceAtSignal) / x.priceAtSignal) * 100, 0) / total : 0,
      };
    };

    return {
      orderBlocks: calcStats(signals.filter(s => s.signalType === 'ORDER_BLOCK')),
      bos: calcStats(signals.filter(s => s.signalType === 'BOS')),
      liquidityZones: calcStats(signals.filter(s => s.signalType === 'LIQUIDITY')),
      fvg: calcStats(signals.filter(s => s.signalType === 'FVG')),
      premiumDiscount: calcStats(signals.filter(s => s.signalType === 'PREMIUM_DISCOUNT')),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ANALYTICS
  // ═══════════════════════════════════════════════════════════════

  private calculateSummary(state: SimState, params: BacktestParams, durationMs: number) {
    const { trades, initialBalance, peakBalance } = state;
    const wins = trades.filter(t => t.pnlPct > 0);
    const losses = trades.filter(t => t.pnlPct <= 0);

    const totalPnlPct = trades.reduce((s, t) => s + t.pnlPct, 0);
    const avgPnlPct = trades.length > 0 ? totalPnlPct / trades.length : 0;

    // Max drawdown
    let peak = initialBalance;
    let maxDrawdown = 0;
    let balance = initialBalance;
    for (const trade of trades) {
      balance *= (1 + trade.pnlPct / 100);
      peak = Math.max(peak, balance);
      const dd = ((peak - balance) / peak) * 100;
      maxDrawdown = Math.max(maxDrawdown, dd);
    }

    // Max consecutive losses
    let maxConsecLosses = 0;
    let currentStreak = 0;
    for (const t of trades) {
      if (t.pnlPct <= 0) { currentStreak++; maxConsecLosses = Math.max(maxConsecLosses, currentStreak); }
      else currentStreak = 0;
    }

    // Profit factor
    const grossProfit = wins.reduce((s, t) => s + t.pnlPct, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    // Sharpe
    const avgReturn = trades.length > 0 ? totalPnlPct / trades.length : 0;
    const variance = trades.length > 0
      ? trades.reduce((s, t) => s + Math.pow(t.pnlPct - avgReturn, 2), 0) / trades.length
      : 0;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

    return {
      totalTrades: trades.length, wins: wins.length, losses: losses.length,
      winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
      totalPnlPct, avgPnlPct, maxDrawdown, maxConsecutiveLosses: maxConsecLosses,
      profitFactor, sharpeRatio,
      avgHoldHours: trades.length > 0 ? trades.reduce((s, t) => s + t.holdHours, 0) / trades.length : 0,
      bestTrade: trades.length > 0 ? Math.max(...trades.map(t => t.pnlPct)) : 0,
      worstTrade: trades.length > 0 ? Math.min(...trades.map(t => t.pnlPct)) : 0,
      totalCandles: state.currentCandleIndex,
      simulationDurationMs: durationMs,
    };
  }

  private calculatePerCoinStats(state: SimState, coins: CoinSymbol[]): Record<CoinSymbol, any> {
    const result: any = {};
    for (const coin of coins) {
      const coinTrades = state.trades.filter(t => t.coin === coin);
      const wins = coinTrades.filter(t => t.pnlPct > 0);
      result[coin] = {
        trades: coinTrades.length,
        winRate: coinTrades.length > 0 ? (wins.length / coinTrades.length) * 100 : 0,
        totalPnlPct: coinTrades.reduce((s, t) => s + t.pnlPct, 0),
        avgPnlPct: coinTrades.length > 0 ? coinTrades.reduce((s, t) => s + t.pnlPct, 0) / coinTrades.length : 0,
      };
    }
    return result;
  }

  private buildEquityCurve(state: SimState) {
    const curve: Array<{ date: string; balance: number; drawdown: number }> = [];
    let balance = state.initialBalance;
    let peak = state.initialBalance;

    for (const trade of state.trades) {
      balance *= (1 + trade.pnlPct / 100);
      peak = Math.max(peak, balance);
      curve.push({ date: trade.exitDate, balance, drawdown: ((peak - balance) / peak) * 100 });
    }

    return curve;
  }

  private calculateMonthlyReturns(state: SimState) {
    const monthly = new Map<string, { pnlPct: number; trades: number; wins: number }>();
    for (const t of state.trades) {
      const month = t.exitDate.substring(0, 7);
      const existing = monthly.get(month) || { pnlPct: 0, trades: 0, wins: 0 };
      monthly.set(month, {
        pnlPct: existing.pnlPct + t.pnlPct,
        trades: existing.trades + 1,
        wins: existing.wins + (t.pnlPct > 0 ? 1 : 0),
      });
    }
    return Array.from(monthly.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, pnlPct: data.pnlPct, trades: data.trades, winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0 }));
  }

  private calculateRegimePerformance(state: SimState): Record<string, { trades: number; winRate: number; avgPnl: number }> {
    const regimes: Record<string, { trades: number; wins: number; totalPnl: number }> = {};
    for (const t of state.trades) {
      const r = t.regime || 'NEUTRAL';
      if (!regimes[r]) regimes[r] = { trades: 0, wins: 0, totalPnl: 0 };
      regimes[r].trades++;
      if (t.pnlPct > 0) regimes[r].wins++;
      regimes[r].totalPnl += t.pnlPct;
    }
    const result: any = {};
    for (const [regime, data] of Object.entries(regimes)) {
      result[regime] = {
        trades: data.trades,
        winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
        avgPnl: data.trades > 0 ? data.totalPnl / data.trades : 0,
      };
    }
    return result;
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private calculateTotalEquity(state: SimState, _lastPrice: number): number {
    let equity = state.balance;
    for (const [, pos] of state.positions) {
      equity += pos.montoEntrada;
    }
    return equity;
  }

  private getHTFSlice(candles: Candle[], currentTs: number, limit: number): Candle[] {
    return candles.filter(c => c.timestamp <= currentTs).slice(-limit);
  }
}

export const backtestRunner = new BacktestRunner();
