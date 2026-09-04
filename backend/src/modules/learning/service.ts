// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Post-Trade Learning Module
// ═══════════════════════════════════════════════════════════════════

import { logger } from '../../utils/logger';
import { TradeLogRepository } from '../../database/repositories';
import { CoinSymbol } from '@el-oraculo/shared';

// ─── Learning Types ─────────────────────────────────────────────
export interface TradeAnalysis {
  coin: CoinSymbol;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgPnl: number;
  bestPnl: number;
  worstPnl: number;
  avgHoldTime: number;
  commonMotivos: Array<{ motivo: string; count: number; winRate: number }>;
  patterns: TradePattern[];
}

export interface TradePattern {
  type: 'SUCCESS' | 'FAILURE';
  description: string;
  frequency: number;
  confidence: number; // 0-1
}

export interface Insight {
  category: 'SCORING' | 'RISK' | 'TIMING' | 'COIN';
  message: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  actionable: boolean;
  recommendation: string;
}

// ─── Learning Service ───────────────────────────────────────────
export class LearningService {

  /**
   * Analyze all trades for a specific coin
   */
  analyzeCoin(coin: CoinSymbol): TradeAnalysis {
    const trades = TradeLogRepository.getByCoin(coin);

    if (trades.length === 0) {
      return {
        coin,
        totalTrades: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        avgPnl: 0,
        bestPnl: 0,
        worstPnl: 0,
        avgHoldTime: 0,
        commonMotivos: [],
        patterns: [],
      };
    }

    // Parse PnL values
    const pnls = trades.map(t => {
      const match = t.pnl?.match(/([+-]?[\d.]+)/);
      return match ? parseFloat(match[1]) : 0;
    });

    const wins = pnls.filter(p => p > 0).length;
    const losses = pnls.filter(p => p < 0).length;
    const totalPnl = pnls.reduce((a, b) => a + b, 0);

    // Motivos analysis
    const motivoMap = new Map<string, { count: number; wins: number }>();
    for (const trade of trades) {
      const motivo = this.extractMotivoBase(trade.motivo || '');
      const existing = motivoMap.get(motivo) || { count: 0, wins: 0 };
      existing.count++;
      const pnlMatch = trade.pnl?.match(/([+-]?[\d.]+)/);
      if (pnlMatch && parseFloat(pnlMatch[1]) > 0) {
        existing.wins++;
      }
      motivoMap.set(motivo, existing);
    }

    const commonMotivos = Array.from(motivoMap.entries())
      .map(([motivo, data]) => ({
        motivo,
        count: data.count,
        winRate: data.count > 0 ? (data.wins / data.count) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Detect patterns
    const patterns = this.detectPatterns(trades);

    return {
      coin,
      totalTrades: trades.length,
      wins,
      losses,
      winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
      avgPnl: totalPnl / trades.length,
      bestPnl: Math.max(...pnls),
      worstPnl: Math.min(...pnls),
      avgHoldTime: 0, // TODO: Calculate from entry/exit times
      commonMotivos,
      patterns,
    };
  }

  /**
   * Generate insights from analysis
   */
  generateInsights(analysis: TradeAnalysis): Insight[] {
    const insights: Insight[] = [];

    // Win rate insights
    if (analysis.winRate < 40) {
      insights.push({
        category: 'SCORING',
        message: `Win rate is low (${analysis.winRate.toFixed(1)}%)`,
        impact: 'HIGH',
        actionable: true,
        recommendation: 'Consider raising entry threshold or adding more filters',
      });
    } else if (analysis.winRate > 60) {
      insights.push({
        category: 'SCORING',
        message: `Win rate is strong (${analysis.winRate.toFixed(1)}%)`,
        impact: 'LOW',
        actionable: false,
        recommendation: 'Current scoring is working well',
      });
    }

    // PnL insights
    if (analysis.avgPnl < 0) {
      insights.push({
        category: 'RISK',
        message: `Average PnL is negative (${analysis.avgPnl.toFixed(2)}%)`,
        impact: 'HIGH',
        actionable: true,
        recommendation: 'Review stop-loss and take-profit levels',
      });
    }

    if (analysis.worstPnl < -5) {
      insights.push({
        category: 'RISK',
        message: `Worst trade was ${analysis.worstPnl.toFixed(2)}% — consider tighter stops`,
        impact: 'HIGH',
        actionable: true,
        recommendation: 'Reduce hard stop or add circuit breaker',
      });
    }

    // Motivo insights
    const bestMotivo = analysis.commonMotivos.find(m => m.winRate > 60 && m.count >= 3);
    if (bestMotivo) {
      insights.push({
        category: 'SCORING',
        message: `Best entry reason: "${bestMotivo.motivo}" (${bestMotivo.winRate.toFixed(0)}% win rate)`,
        impact: 'MEDIUM',
        actionable: true,
        recommendation: `Weight "${bestMotivo.motivo}" signals more heavily in scoring`,
      });
    }

    const worstMotivo = analysis.commonMotivos.find(m => m.winRate < 30 && m.count >= 3);
    if (worstMotivo) {
      insights.push({
        category: 'SCORING',
        message: `Worst entry reason: "${worstMotivo.motivo}" (${worstMotivo.winRate.toFixed(0)}% win rate)`,
        impact: 'MEDIUM',
        actionable: true,
        recommendation: `Reduce weight of "${worstMotivo.motivo}" signals or filter them out`,
      });
    }

    return insights;
  }

  /**
   * Get performance summary across all coins
   */
  getOverallSummary(): {
    totalTrades: number;
    totalWins: number;
    totalLosses: number;
    overallWinRate: number;
    coinPerformance: Array<{ coin: CoinSymbol; trades: number; winRate: number; pnl: number }>;
  } {
    const coins: CoinSymbol[] = ['BTC', 'ETH', 'SOL', 'BNB', 'AVAX', 'POL', 'SUI', 'LINK', 'NEAR', 'DOGE', 'XRP', 'ARB', 'ADA', 'ESP'];
    const coinPerformance = coins.map(coin => {
      const analysis = this.analyzeCoin(coin);
      return {
        coin,
        trades: analysis.totalTrades,
        winRate: analysis.winRate,
        pnl: analysis.avgPnl * analysis.totalTrades,
      };
    }).filter(c => c.trades > 0);

    const totalTrades = coinPerformance.reduce((a, c) => a + c.trades, 0);
    const totalWins = coinPerformance.reduce((a, c) => a + Math.round(c.trades * c.winRate / 100), 0);

    return {
      totalTrades,
      totalWins,
      totalLosses: totalTrades - totalWins,
      overallWinRate: totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0,
      coinPerformance,
    };
  }

  // ─── Private Helpers ─────────────────────────────────────────

  private extractMotivoBase(motivo: string): string {
    // Extract the core reason, removing numbers and dynamic parts
    if (motivo.includes('HARD STOP')) return 'HARD_STOP';
    if (motivo.includes('TRAILING STOP')) return 'TRAILING_STOP';
    if (motivo.includes('TAKE PROFIT')) return 'TAKE_PROFIT';
    if (motivo.includes('TIME EXIT')) return 'TIME_EXIT';
    if (motivo.includes('BREAK EVEN')) return 'BREAK_EVEN';
    if (motivo.includes('MOMENTUM BEAR')) return 'MOMENTUM_BEAR';
    if (motivo.includes('RSI EXIT')) return 'RSI_EXIT';

    // Entry reasons
    if (motivo.includes('ENTRY:')) {
      const reasons = motivo.replace('ENTRY:', '').trim();
      return `ENTRY:${reasons}`;
    }

    return motivo.slice(0, 30);
  }

  private detectPatterns(trades: any[]): TradePattern[] {
    const patterns: TradePattern[] = [];

    if (trades.length < 5) return patterns;

    // Pattern 1: Consecutive losses
    let consecutiveLosses = 0;
    let maxConsecutiveLosses = 0;
    for (const trade of trades) {
      const pnlMatch = trade.pnl?.match(/([+-]?[\d.]+)/);
      const pnl = pnlMatch ? parseFloat(pnlMatch[1]) : 0;
      if (pnl < 0) {
        consecutiveLosses++;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses);
      } else {
        consecutiveLosses = 0;
      }
    }
    if (maxConsecutiveLosses >= 3) {
      patterns.push({
        type: 'FAILURE',
        description: `${maxConsecutiveLosses} consecutive losses detected`,
        frequency: maxConsecutiveLosses,
        confidence: 0.8,
      });
    }

    // Pattern 2: Win streak
    let winStreak = 0;
    let maxWinStreak = 0;
    for (const trade of trades) {
      const pnlMatch = trade.pnl?.match(/([+-]?[\d.]+)/);
      const pnl = pnlMatch ? parseFloat(pnlMatch[1]) : 0;
      if (pnl > 0) {
        winStreak++;
        maxWinStreak = Math.max(maxWinStreak, winStreak);
      } else {
        winStreak = 0;
      }
    }
    if (maxWinStreak >= 3) {
      patterns.push({
        type: 'SUCCESS',
        description: `${maxWinStreak} consecutive wins achieved`,
        frequency: maxWinStreak,
        confidence: 0.7,
      });
    }

    // Pattern 3: RSI oversold wins
    const rsiWins = trades.filter(t => {
      const rsi = t.rsi || 50;
      const pnlMatch = t.pnl?.match(/([+-]?[\d.]+)/);
      const pnl = pnlMatch ? parseFloat(pnlMatch[1]) : 0;
      return rsi < 35 && pnl > 0;
    }).length;

    const rsiOversoldTrades = trades.filter(t => (t.rsi || 50) < 35).length;
    if (rsiOversoldTrades >= 3 && rsiWins / rsiOversoldTrades > 0.6) {
      patterns.push({
        type: 'SUCCESS',
        description: `RSI oversold entries perform well (${rsiWins}/${rsiOversoldTrades})`,
        frequency: rsiOversoldTrades,
        confidence: 0.75,
      });
    }

    return patterns;
  }
}
