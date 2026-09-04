// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Scoring Service
// ═══════════════════════════════════════════════════════════════════

import { ScoringResult, SCORING_WEIGHTS, RSI_LEVELS } from '@el-oraculo/shared';

interface ScoringContext {
  rsi: number;
  adx: number;
  adx_btc: number;
  fvg: string;
  dir: string;
  momentumBullish: boolean;
  momentumBearish: boolean;
  squeezeActive: boolean;
  chochSignal: string;
  correlationSignal: string;
}

export class ScoringService {
  scoreEntry(ctx: any): ScoringResult {
    const { indicators: ind, marketRegime: mr, config: COIN } = ctx;
    let entryScore = 0;
    const entryReasons: string[] = [];

    // RSI signals
    if (ind.rsi < RSI_LEVELS.OVERSOLD) {
      entryScore += SCORING_WEIGHTS.RSI_OVERSOLD;
      entryReasons.push('RSI_OVERSOLD');
    } else if (ind.rsi < RSI_LEVELS.LOW) {
      entryScore += SCORING_WEIGHTS.RSI_LOW;
      entryReasons.push('RSI_LOW');
    }

    // FVG signals
    const fvg = ctx.indicators?.fvg || 'NEUTRAL';
    if (fvg === 'BULLISH') {
      entryScore += SCORING_WEIGHTS.FVG_BULL;
      entryReasons.push('FVG_BULL');
    } else if (fvg === 'BEARISH') {
      entryScore += SCORING_WEIGHTS.FVG_BEAR;
      entryReasons.push('FVG_BEAR');
    }

    // ADX direction
    if (ind.adx > 25 && ind.plusDI > ind.minusDI) {
      entryScore += SCORING_WEIGHTS.ADX_BULL;
      entryReasons.push('ADX_BULL');
    } else if (ind.adx > 25 && ind.minusDI > ind.plusDI) {
      entryScore += SCORING_WEIGHTS.ADX_BEAR;
      entryReasons.push('ADX_BEAR');
    }

    // Momentum (EMA crossover + MACD histogram)
    const momentumBullish = ind.ema20 > ind.ema50 && ind.histogram > 0;
    const momentumBearish = ind.ema20 < ind.ema50 && ind.histogram < 0;

    if (momentumBullish) {
      entryScore += SCORING_WEIGHTS.MOM_BULL;
      entryReasons.push('MOM_BULL');
    } else if (momentumBearish) {
      entryScore += SCORING_WEIGHTS.MOM_BEAR;
      entryReasons.push('MOM_BEAR');
    }

    // Downtrend penalty (streak losses >= 2)
    if (ctx.botState?.streakLosses >= 2) {
      entryScore += SCORING_WEIGHTS.DOWNTREND_PENALTY;
      entryReasons.push('DOWNTREND_PENALTY');
    }

    // Get threshold based on market regime
    let entryThreshold = COIN.entry_min;

    return {
      entryScore,
      entryThreshold,
      entryReasons,
    };
  }
}
