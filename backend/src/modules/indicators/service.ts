// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Indicator Service (Multi-Timeframe SM Analysis)
// ═══════════════════════════════════════════════════════════════════

import {
  RSI, ADX, BollingerBands, ATR, EMA,
  MACD, StochasticRSI, OBV, VWAP
} from 'technicalindicators';
import { ExchangeService } from '../exchange/service';
import {
  IndicatorData, FullIndicatorData, MarketRegimeData, MarketRegime, TechRegime, FVGType,
  Timeframe, TimeframeData, MultiTimeframeData, SMIndicators,
  OrderBlock, LiquidityZone, StructureBreak, VolumeProfile,
} from '@el-oraculo/shared';
import { logger } from '../../utils/logger';

// ─── Config ─────────────────────────────────────────────────────
const TIMEFRAMES: Timeframe[] = ['15m', '1h', '4h'];
const TIMEFRAME_LIMITS: Record<Timeframe, number> = { '15m': 200, '1h': 200, '4h': 200 };

export class IndicatorService {
  private exchange: ExchangeService;

  constructor(exchange: ExchangeService) {
    this.exchange = exchange;
  }

  // ═══════════════════════════════════════════════════════════════
  // SINGLE TIMEFRAME (backward-compatible)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Calculate ALL indicators for a given pair (15m default)
   */
  async getIndicators(pair: string, timeframe: Timeframe = '15m'): Promise<FullIndicatorData> {
    const rawKlines = await this.exchange.getKlines(pair, timeframe, TIMEFRAME_LIMITS[timeframe]);
    return this.calculateIndicators(rawKlines);
  }

  /**
   * Calculate indicators from raw kline data
   */
  private calculateIndicators(rawKlines: any[]): FullIndicatorData {
    const closes = rawKlines.map((k: any) => k.close);
    const highs = rawKlines.map((k: any) => k.high);
    const lows = rawKlines.map((k: any) => k.low);
    const volumes = rawKlines.map((k: any) => k.volume);
    const currentPrice = closes[closes.length - 1] || 0;

    // ═══ L1 Indicators ═══

    // RSI
    const rsi = RSI.calculate({ values: closes, period: 14 });
    const lastRsi = rsi[rsi.length - 1] ?? 50;

    // ADX
    const adx = ADX.calculate({ high: highs, low: lows, close: closes, period: 14 });
    const lastAdx = adx[adx.length - 1] ?? { adx: 20, pdi: 0, mdi: 0 };

    // Bollinger Bands
    const bb = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });
    const lastBB = bb[bb.length - 1] ?? { upper: 0, middle: 0, lower: 0 };
    const bbWidth = lastBB.upper > 0
      ? ((lastBB.upper - lastBB.lower) / lastBB.middle) * 100
      : 0;

    // ATR
    const atr = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });
    const lastAtr = atr[atr.length - 1] ?? 0;
    const atrPct = currentPrice > 0 ? (lastAtr / currentPrice) * 100 : 0;

    // ═══ L2 Indicators ═══

    // EMA
    const ema20Arr = EMA.calculate({ values: closes, period: 20 });
    const ema50Arr = EMA.calculate({ values: closes, period: 50 });
    const ema200Arr = EMA.calculate({ values: closes, period: 200 });
    const ema20 = ema20Arr[ema20Arr.length - 1] ?? currentPrice;
    const ema50 = ema50Arr[ema50Arr.length - 1] ?? currentPrice;
    const ema200 = ema200Arr[ema200Arr.length - 1] ?? currentPrice;

    // MACD
    const macdRaw = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
    const lastMacdRaw = macdRaw[macdRaw.length - 1];
    const lastMacd: { macd: number; signal: number; histogram: number } | null = lastMacdRaw
      ? {
          macd: (lastMacdRaw as any).MACD ?? 0,
          signal: (lastMacdRaw as any).signal ?? 0,
          histogram: (lastMacdRaw as any).histogram ?? 0,
        }
      : null;

    // Stochastic RSI
    const stochRsiRaw = StochasticRSI.calculate({
      values: closes,
      rsiPeriod: 14,
      stochasticPeriod: 14,
      kPeriod: 3,
      dPeriod: 3,
    });
    const lastStochRsiRaw = stochRsiRaw[stochRsiRaw.length - 1];
    const lastStochRsi: { k: number; d: number } | null = lastStochRsiRaw
      ? {
          k: (lastStochRsiRaw as any).k ?? (lastStochRsiRaw as any).stochRSI ?? 50,
          d: (lastStochRsiRaw as any).d ?? (lastStochRsiRaw as any).signal ?? 50,
        }
      : null;

    // OBV
    const obvRaw = OBV.calculate({ close: closes, volume: volumes });
    const lastObv = obvRaw[obvRaw.length - 1] ?? 0;

    // VWAP
    let cumTypVol = 0;
    let cumVol = 0;
    for (let i = 0; i < closes.length; i++) {
      const tp = (highs[i] + lows[i] + closes[i]) / 3;
      cumTypVol += tp * volumes[i];
      cumVol += volumes[i];
    }
    const vwap = cumVol > 0 ? cumTypVol / cumVol : currentPrice;

    // ═══ L3 Indicators ═══

    // FVG Detection
    const fvg = this.detectFVG(highs, lows);

    // Choch Detection
    const choch = this.detectChoch(closes, highs, lows);

    // Squeeze Detection (BB inside Keltner Channels)
    const keltnerUpper = ema20 + lastAtr * 1.5;
    const keltnerLower = ema20 - lastAtr * 1.5;
    const squeezeActive = lastBB.lower > keltnerLower && lastBB.upper < keltnerUpper;

    // Squeeze momentum
    let squeezeMomentum = 0;
    if (macdRaw.length >= 3) {
      const h1 = (macdRaw[macdRaw.length - 3] as any)?.histogram ?? 0;
      const h3 = (macdRaw[macdRaw.length - 1] as any)?.histogram ?? 0;
      squeezeMomentum = h3 - h1;
    }

    // Momentum (composite signal)
    let momentum: 'BULL' | 'BEAR' | 'NEUTRAL' = 'NEUTRAL';
    const macdHist = lastMacd?.histogram ?? 0;
    if (ema20 > ema50 && lastRsi > 50 && macdHist > 0) {
      momentum = 'BULL';
    } else if (ema20 < ema50 && lastRsi < 50 && macdHist < 0) {
      momentum = 'BEAR';
    }

    // Volume change
    const avgVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const currentVol = volumes[volumes.length - 1] || 0;
    const volumeChange = avgVol > 0 ? ((currentVol - avgVol) / avgVol) * 100 : 0;

    return {
      // L1
      rsi: lastRsi,
      adx: lastAdx.adx,
      adx_btc: 0,
      histogram: macdHist,
      bb_lower: lastBB.lower,
      bb_upper: lastBB.upper,
      plusDI: lastAdx.pdi,
      minusDI: lastAdx.mdi,
      atr_pct: atrPct,
      volume: currentVol,

      // L2
      macd: lastMacd,
      stochRsi: lastStochRsi,
      obv: lastObv,
      vwap,
      ema20,
      ema50,
      ema200,

      // L3
      fvg,
      choch,
      squeeze: squeezeActive,
      squeezeMomentum,
      momentum,

      // Extra
      volumeChange,
      bbWidth,
      atr: lastAtr,
      currentPrice,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // MULTI-TIMEFRAME SM ANALYSIS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get multi-timeframe indicators with SM analysis for a coin
   */
  async getMultiTimeframeData(pair: string): Promise<MultiTimeframeData> {
    const coin = pair.replace('USDT', '');
    const timeframes: Record<Timeframe, TimeframeData> = {} as any;

    // Fetch all timeframes in parallel
    const klinePromises = TIMEFRAMES.map(async (tf) => {
      const klines = await this.exchange.getKlines(pair, tf, TIMEFRAME_LIMITS[tf]);
      return { tf, klines };
    });

    const klineResults = await Promise.all(klinePromises);

    // Calculate indicators + SM for each timeframe
    for (const { tf, klines } of klineResults) {
      const indicators = this.calculateIndicators(klines);
      const sm = this.calculateSMIndicators(klines);
      const { bias, strength } = this.calculateTimeframeBias(indicators, sm);

      timeframes[tf] = {
        timeframe: tf,
        indicators,
        sm,
        bias,
        strength,
      };
    }

    // Cross-timeframe aggregation
    const htfBias = this.calculateHTFBias(timeframes);
    const confluenceScore = this.calculateConfluence(timeframes);
    const alignment = this.checkAlignment(timeframes);

    return {
      coin,
      timeframes,
      htfBias,
      confluenceScore,
      alignment,
    };
  }

  /**
   * Calculate Smart Money indicators from klines
   */
  private calculateSMIndicators(klines: any[]): SMIndicators {
    const closes = klines.map((k: any) => k.close);
    const highs = klines.map((k: any) => k.high);
    const lows = klines.map((k: any) => k.low);
    const opens = klines.map((k: any) => k.open);
    const volumes = klines.map((k: any) => k.volume);
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

  /**
   * Detect Order Blocks (last significant candle before displacement)
   */
  private detectOrderBlocks(
    highs: number[], lows: number[], opens: number[],
    closes: number[], volumes: number[]
  ): OrderBlock[] {
    const orderBlocks: OrderBlock[] = [];
    if (highs.length < 20) return orderBlocks;

    const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;

    for (let i = 5; i < highs.length - 1; i++) {
      const bodySize = Math.abs(closes[i] - opens[i]);
      const range = highs[i] - lows[i];
      const isSignificant = range > 0 && bodySize / range > 0.5;
      const hasHighVolume = volumes[i] > avgVol * 1.5;

      if (!isSignificant || !hasHighVolume) continue;

      // Check for displacement (strong move after this candle)
      const nextMove = closes[i + 1] - closes[i];
      const displacement = Math.abs(nextMove) / closes[i];

      if (displacement < 0.005) continue; // Need at least 0.5% displacement

      // Bullish OB: bearish candle followed by strong bullish displacement
      if (closes[i] < opens[i] && nextMove > 0) {
        orderBlocks.push({
          type: 'BULLISH',
          high: highs[i],
          low: lows[i],
          candleIndex: i,
          strength: Math.min(100, Math.round(displacement * 1000 + (volumes[i] / avgVol) * 10)),
        });
      }

      // Bearish OB: bullish candle followed by strong bearish displacement
      if (closes[i] > opens[i] && nextMove < 0) {
        orderBlocks.push({
          type: 'BEARISH',
          high: highs[i],
          low: lows[i],
          candleIndex: i,
          strength: Math.min(100, Math.round(displacement * 1000 + (volumes[i] / avgVol) * 10)),
        });
      }
    }

    // Return only the most recent 5 of each type
    const bullish = orderBlocks.filter(o => o.type === 'BULLISH').slice(-3);
    const bearish = orderBlocks.filter(o => o.type === 'BEARISH').slice(-3);
    return [...bullish, ...bearish];
  }

  /**
   * Detect Liquidity Zones (areas with clustered stop losses)
   */
  private detectLiquidityZones(
    highs: number[], lows: number[], volumes: number[]
  ): LiquidityZone[] {
    const zones: LiquidityZone[] = [];
    if (highs.length < 20) return zones;

    // Group prices into buckets (0.1% each)
    const bucketSize = 0.001;
    const buySideBuckets: Record<number, { count: number; totalVol: number }> = {};
    const sellSideBuckets: Record<number, { count: number; totalVol: number }> = {};

    for (let i = 0; i < highs.length; i++) {
      const highBucket = Math.round(highs[i] / (highs[i] * bucketSize));
      const lowBucket = Math.round(lows[i] / (lows[i] * bucketSize));

      // Sell-side liquidity: stop losses above highs
      if (!sellSideBuckets[highBucket]) sellSideBuckets[highBucket] = { count: 0, totalVol: 0 };
      sellSideBuckets[highBucket].count++;
      sellSideBuckets[highBucket].totalVol += volumes[i];

      // Buy-side liquidity: stop losses below lows
      if (!buySideBuckets[lowBucket]) buySideBuckets[lowBucket] = { count: 0, totalVol: 0 };
      buySideBuckets[lowBucket].count++;
      buySideBuckets[lowBucket].totalVol += volumes[i];
    }

    // Find zones with multiple touches
    const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;

    for (const [bucket, data] of Object.entries(sellSideBuckets)) {
      if (data.count >= 3) {
        zones.push({
          type: 'SELL_SIDE',
          price: Number(bucket) * bucketSize * (highs[0] || 1),
          strength: Math.min(100, data.count * 15 + Math.round(data.totalVol / avgVol) * 5),
          touches: data.count,
        });
      }
    }

    for (const [bucket, data] of Object.entries(buySideBuckets)) {
      if (data.count >= 3) {
        zones.push({
          type: 'BUY_SIDE',
          price: Number(bucket) * bucketSize * (lows[0] || 1),
          strength: Math.min(100, data.count * 15 + Math.round(data.totalVol / avgVol) * 5),
          touches: data.count,
        });
      }
    }

    return zones.sort((a, b) => b.strength - a.strength).slice(0, 6);
  }

  /**
   * Detect Break of Structure (BOS)
   */
  private detectStructureBreaks(
    closes: number[], highs: number[], lows: number[]
  ): StructureBreak[] {
    const breaks: StructureBreak[] = [];
    if (closes.length < 20) return breaks;

    // Find swing highs and lows (using 5-candle lookback)
    const swingHighs: { index: number; price: number }[] = [];
    const swingLows: { index: number; price: number }[] = [];

    for (let i = 5; i < highs.length - 5; i++) {
      // Swing high: highest high in window
      const windowHighs = highs.slice(i - 5, i + 6);
      if (highs[i] === Math.max(...windowHighs)) {
        swingHighs.push({ index: i, price: highs[i] });
      }

      // Swing low: lowest low in window
      const windowLows = lows.slice(i - 5, i + 6);
      if (lows[i] === Math.min(...windowLows)) {
        swingLows.push({ index: i, price: lows[i] });
      }
    }

    // Bullish BOS: price breaks above previous swing high
    for (let i = 1; i < swingHighs.length; i++) {
      const prev = swingHighs[i - 1];
      const curr = swingHighs[i];
      if (curr.price > prev.price && closes[curr.index] > prev.price) {
        breaks.push({
          type: 'BULLISH',
          level: prev.price,
          candleIndex: curr.index,
        });
      }
    }

    // Bearish BOS: price breaks below previous swing low
    for (let i = 1; i < swingLows.length; i++) {
      const prev = swingLows[i - 1];
      const curr = swingLows[i];
      if (curr.price < prev.price && closes[curr.index] < prev.price) {
        breaks.push({
          type: 'BEARISH',
          level: prev.price,
          candleIndex: curr.index,
        });
      }
    }

    return breaks.slice(-5); // Return last 5 breaks
  }

  /**
   * Calculate Volume Profile (POC, VAH, VAL)
   */
  private calculateVolumeProfile(
    closes: number[], highs: number[], lows: number[], volumes: number[]
  ): VolumeProfile {
    if (closes.length === 0) {
      return { poc: 0, vah: 0, val: 0, totalVolume: 0 };
    }

    // Create price-volume distribution
    const priceRange = Math.max(...highs) - Math.min(...lows);
    const bucketCount = 50;
    const bucketSize = priceRange / bucketCount;
    const minPrice = Math.min(...lows);

    const buckets: { price: number; volume: number }[] = [];
    for (let i = 0; i < bucketCount; i++) {
      buckets.push({ price: minPrice + bucketSize * (i + 0.5), volume: 0 });
    }

    // Distribute volume across buckets
    for (let i = 0; i < closes.length; i++) {
      const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
      const bucketIndex = Math.min(
        bucketCount - 1,
        Math.max(0, Math.floor((typicalPrice - minPrice) / bucketSize))
      );
      buckets[bucketIndex].volume += volumes[i];
    }

    // Find POC (highest volume bucket)
    const pocBucket = buckets.reduce((max, b) => b.volume > max.volume ? b : max, buckets[0]);

    // Calculate Value Area (70% of volume)
    const totalVol = buckets.reduce((sum, b) => sum + b.volume, 0);
    const targetVol = totalVol * 0.7;
    let accumulatedVol = pocBucket.volume;
    let vaLowIndex = buckets.indexOf(pocBucket);
    let vaHighIndex = buckets.indexOf(pocBucket);

    while (accumulatedVol < targetVol && (vaLowIndex > 0 || vaHighIndex < bucketCount - 1)) {
      const expandDown = vaLowIndex > 0 ? buckets[vaLowIndex - 1].volume : 0;
      const expandUp = vaHighIndex < bucketCount - 1 ? buckets[vaHighIndex + 1].volume : 0;

      if (expandDown >= expandUp && vaLowIndex > 0) {
        vaLowIndex--;
        accumulatedVol += buckets[vaLowIndex].volume;
      } else if (vaHighIndex < bucketCount - 1) {
        vaHighIndex++;
        accumulatedVol += buckets[vaHighIndex].volume;
      } else {
        break;
      }
    }

    return {
      poc: pocBucket.price,
      vah: buckets[vaHighIndex].price,
      val: buckets[vaLowIndex].price,
      totalVolume: totalVol,
    };
  }

  /**
   * Calculate Fibonacci levels from recent swing
   */
  private calculateFibLevels(highs: number[], lows: number[]): { level: number; price: number }[] {
    if (highs.length < 20) return [];

    const lookback = Math.min(100, highs.length);
    const recentHighs = highs.slice(-lookback);
    const recentLows = lows.slice(-lookback);

    const swingHigh = Math.max(...recentHighs);
    const swingLow = Math.min(...recentLows);
    const range = swingHigh - swingLow;

    if (range <= 0) return [];

    const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];

    return levels.map(level => ({
      level,
      price: swingLow + range * level,
    }));
  }

  /**
   * Determine if price is in premium/discount/equilibrium zone
   */
  private getPremiumDiscount(
    currentPrice: number, highs: number[], lows: number[]
  ): 'PREMIUM' | 'DISCOUNT' | 'EQUILIBRIUM' {
    if (highs.length < 20) return 'EQUILIBRIUM';

    const lookback = Math.min(100, highs.length);
    const swingHigh = Math.max(...highs.slice(-lookback));
    const swingLow = Math.min(...lows.slice(-lookback));
    const midpoint = (swingHigh + swingLow) / 2;

    if (currentPrice > midpoint * 1.01) return 'PREMIUM';
    if (currentPrice < midpoint * 0.99) return 'DISCOUNT';
    return 'EQUILIBRIUM';
  }

  /**
   * Calculate bias for a single timeframe
   */
  private calculateTimeframeBias(
    indicators: FullIndicatorData,
    sm: SMIndicators
  ): { bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; strength: number } {
    let score = 0;

    // EMA alignment (+/- 20)
    if (indicators.ema20 > indicators.ema50) score += 20;
    else if (indicators.ema20 < indicators.ema50) score -= 20;

    // RSI (+/- 15)
    if (indicators.rsi > 55) score += 15;
    else if (indicators.rsi < 45) score -= 15;

    // MACD histogram (+/- 15)
    if (indicators.histogram > 0) score += 15;
    else if (indicators.histogram < 0) score -= 15;

    // ADX trend strength (+/- 10)
    if (indicators.adx > 25) {
      score += indicators.plusDI > indicators.minusDI ? 10 : -10;
    }

    // Order blocks (+/- 10 each)
    for (const ob of sm.orderBlocks.slice(-2)) {
      if (ob.type === 'BULLISH' && indicators.currentPrice >= ob.low && indicators.currentPrice <= ob.high) {
        score += 10;
      }
      if (ob.type === 'BEARISH' && indicators.currentPrice >= ob.low && indicators.currentPrice <= ob.high) {
        score -= 10;
      }
    }

    // Structure breaks (+/- 10 each)
    for (const sb of sm.structureBreaks.slice(-2)) {
      if (sb.type === 'BULLISH') score += 10;
      if (sb.type === 'BEARISH') score -= 10;
    }

    // Premium/Discount (+/- 5)
    if (sm.premiumDiscount === 'DISCOUNT') score += 5;
    if (sm.premiumDiscount === 'PREMIUM') score -= 5;

    // Momentum (+/- 10)
    if (indicators.momentum === 'BULL') score += 10;
    if (indicators.momentum === 'BEAR') score -= 10;

    // FVG (+/- 5)
    if (indicators.fvg === 'BULLISH') score += 5;
    if (indicators.fvg === 'BEARISH') score -= 5;

    const strength = Math.min(100, Math.abs(score));
    const bias = score > 10 ? 'BULLISH' : score < -10 ? 'BEARISH' : 'NEUTRAL';

    return { bias, strength };
  }

  /**
   * Calculate Higher Timeframe Bias (4h > 1h > 15m)
   */
  private calculateHTFBias(timeframes: Record<Timeframe, TimeframeData>): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    const weights: Record<Timeframe, number> = { '4h': 0.5, '1h': 0.3, '15m': 0.2 };

    let weightedScore = 0;
    for (const tf of TIMEFRAMES) {
      const data = timeframes[tf];
      const tfScore = data.bias === 'BULLISH' ? 1 : data.bias === 'BEARISH' ? -1 : 0;
      weightedScore += tfScore * data.strength * weights[tf];
    }

    if (weightedScore > 15) return 'BULLISH';
    if (weightedScore < -15) return 'BEARISH';
    return 'NEUTRAL';
  }

  /**
   * Calculate confluence score (0-100)
   */
  private calculateConfluence(timeframes: Record<Timeframe, TimeframeData>): number {
    let score = 0;

    for (const tf of TIMEFRAMES) {
      const data = timeframes[tf];

      // Add timeframe strength weighted by importance
      const weight = tf === '4h' ? 0.5 : tf === '1h' ? 0.3 : 0.2;
      score += data.strength * weight;

      // Bonus for SM confluence
      if (data.sm.orderBlocks.length > 0) score += 5;
      if (data.sm.structureBreaks.length > 0) score += 5;
      if (data.sm.liquidityZones.length > 0) score += 3;
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * Check if all timeframes agree on direction
   */
  private checkAlignment(timeframes: Record<Timeframe, TimeframeData>): boolean {
    const biases = TIMEFRAMES.map(tf => timeframes[tf].bias);
    return biases.every(b => b === biases[0]) && biases[0] !== 'NEUTRAL';
  }

  // ═══════════════════════════════════════════════════════════════
  // MARKET REGIME
  // ═══════════════════════════════════════════════════════════════

  /**
   * Market Regime detection
   */
  getMarketRegime(indicators: FullIndicatorData): MarketRegimeData {
    let regime: MarketRegime = 'NEUTRAL';
    let techRegime: TechRegime = 'NEUTRAL';

    // n8n spec: TRENDING (ADX>25), VOLATILE (ATR%>2), RANGING (ADX<20), CALM (else)
    if (indicators.adx > 25) {
      regime = 'TRENDING';
      techRegime = 'TRENDING';
    } else if (indicators.atr_pct > 2) {
      regime = 'VOLATILE';
      techRegime = 'VOLATILE';
    } else if (indicators.adx < 20) {
      regime = 'RANGING';
      techRegime = 'RANGING';
    } else {
      // CALM: ADX between 20-25, ATR% < 2
      regime = 'NEUTRAL';
      techRegime = 'NEUTRAL';
    }

    // Regime multiplier
    let regimeMultiplier = 1.0;
    if (regime === 'TRENDING') regimeMultiplier = 1.2;
    if (regime === 'VOLATILE') regimeMultiplier = 0.8;
    if (regime === 'RANGING') regimeMultiplier = 0.7;

    return {
      regime,
      techRegime,
      divergence: indicators.adx > 25 ? 1 : 0,
      lsRatio: indicators.plusDI / (indicators.minusDI || 1),
      longPct: indicators.plusDI > indicators.minusDI ? 60 : 40,
      sentiment: indicators.rsi > 50 ? 'VERDE' : indicators.rsi < 40 ? 'ROJO' : 'AMARILLO',
      atrPct: indicators.atr_pct,
      rsiPrev: indicators.rsi,
      rsiRising: indicators.rsi > 50,
      rsiFalling: indicators.rsi < 50,
      adxRising: indicators.adx > 20,
      prevFvg: indicators.fvg,
      regimeMultiplier,
    };
  }

  // ─── FVG Detection (Fair Value Gap) ──────────────────────────
  private detectFVG(highs: number[], lows: number[]): FVGType {
    if (highs.length < 5) return 'NEUTRAL';

    // Bullish FVG: gap between candle[i-2].high and candle[i].low
    for (let i = 3; i < highs.length; i++) {
      const prevHigh = highs[i - 2];
      const currLow = lows[i];
      if (currLow > prevHigh && (currLow - prevHigh) / currLow > 0.001) {
        return 'BULLISH';
      }
    }

    // Bearish FVG: gap between candle[i].high and candle[i-2].low
    for (let i = 3; i < highs.length; i++) {
      const prevLow = lows[i - 2];
      const currHigh = highs[i];
      if (currHigh < prevLow && (prevLow - currHigh) / prevLow > 0.001) {
        return 'BEARISH';
      }
    }

    return 'NEUTRAL';
  }

  // ─── Choch Detection (Change of Character) ───────────────────
  private detectChoch(closes: number[], highs: number[], lows: number[]): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    if (closes.length < 20) return 'NEUTRAL';

    const recentHighs = highs.slice(-10);
    const recentLows = lows.slice(-10);

    const prevHigh = Math.max(...recentHighs.slice(0, 5));
    const prevLow = Math.min(...recentLows.slice(0, 5));
    const currHigh = Math.max(...recentHighs.slice(5));
    const currLow = Math.min(...recentLows.slice(5));

    if (currHigh > prevHigh && closes[closes.length - 1] > prevHigh) {
      return 'BULLISH';
    }

    if (currLow < prevLow && closes[closes.length - 1] < prevLow) {
      return 'BEARISH';
    }

    return 'NEUTRAL';
  }

  /**
   * Get BTC indicators for correlation
   */
  async getBTCIndicators(): Promise<{ adx: number; rsi: number; regime: string }> {
    try {
      const indicators = await this.getIndicators('BTCUSDT');
      const regime = this.getMarketRegime(indicators);
      return {
        adx: indicators.adx,
        rsi: indicators.rsi,
        regime: regime.regime,
      };
    } catch (error) {
      logger.warn('Failed to get BTC indicators:', error);
      return { adx: 20, rsi: 50, regime: 'NEUTRAL' };
    }
  }
}
