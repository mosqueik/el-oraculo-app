// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Trade Logger Service
// ═══════════════════════════════════════════════════════════════════
//
// Full pipeline state logging at each decision point.
// Replaces Google Sheets with structured database entries.
// Provides analytics, streaks, and export functionality.
// ═══════════════════════════════════════════════════════════════════

import { DecisionSnapshotRepository } from '../../database/repositories/DecisionSnapshotRepository';
import { DailySummaryRepository } from '../../database/repositories/DailySummaryRepository';
import { TradeLogRepository } from '../../database/repositories/TradeLogRepository';
import { logger } from '../../utils/logger';
import type { CoinSymbol } from '@el-oraculo/shared';

// ─── Types ──────────────────────────────────────────────────────
export interface PipelineContext {
  coin: CoinSymbol;
  cycleNumber: number;
  cycleStartTime: number;

  // Market state
  regime?: string;
  rsi?: number;
  adx?: number;
  atrPct?: number;
  ema20?: number;
  ema50?: number;
  histogram?: number;
  momentum?: string;
  fvg?: string;

  // Multi-timeframe
  htfBias?: string;
  confluenceScore?: number;
  alignment?: boolean;

  // Scoring
  entryScore?: number;
  entryThreshold?: number;
  entryReasons?: string[];

  // Risk
  hardStop?: number;
  tpTarget?: number;
  vPiso?: number;

  // Decision
  decision: 'COMPRAR' | 'VENDER' | 'ESPERAR';
  motivo: string;
  monto?: number;

  // Execution
  fillPrice?: number;
  quantity?: number;
  pnlPct?: number;

  // Position info
  entryPrice?: number;
  entryTime?: string;

  // Timestamp
  timestamp?: string;
}

export interface DailySummaryData {
  date: string;
  totalTrades: number;
  buys: number;
  sells: number;
  wins: number;
  losses: number;
  totalPnlPct: number;
  bestTrade?: { coin: string; pnl: number; motivo: string };
  worstTrade?: { coin: string; pnl: number; motivo: string };
  activePositions: string[];
  balanceStart?: number;
  balanceEnd?: number;
}

export interface TradeExport {
  id: number;
  coin: string;
  decision: string;
  motivo: string;
  monto: number;
  precio: number;
  rsi: number | null;
  adx: number | null;
  direction: string | null;
  entryPrice: number | null;
  entryTime: string | null;
  pnl: string | null;
  timestamp: string;
}

export interface PerformanceByCoin {
  coin: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  bestTrade: number;
  worstTrade: number;
  avgHoldTimeMs: number;
}

export interface WinStreakInfo {
  currentWinStreak: number;
  currentLoseStreak: number;
  maxWinStreak: number;
  maxLoseStreak: number;
  totalWinningDays: number;
  totalLosingDays: number;
}

// ─── Service ────────────────────────────────────────────────────
export class TradeLoggerService {
  /**
   * Log a full pipeline decision with context
   */
  static logDecision(context: PipelineContext): void {
    try {
      const cycleMs = Date.now() - context.cycleStartTime;

      // Save decision snapshot (full pipeline state)
      DecisionSnapshotRepository.create({
        coin: context.coin,
        cycleNumber: context.cycleNumber,
        regime: context.regime,
        rsi: context.rsi,
        adx: context.adx,
        atrPct: context.atrPct,
        ema20: context.ema20,
        ema50: context.ema50,
        histogram: context.histogram,
        momentum: context.momentum,
        fvg: context.fvg,
        htfBias: context.htfBias,
        confluenceScore: context.confluenceScore,
        alignment: context.alignment,
        entryScore: context.entryScore,
        entryThreshold: context.entryThreshold,
        entryReasons: context.entryReasons ? JSON.stringify(context.entryReasons) : null,
        hardStop: context.hardStop,
        tpTarget: context.tpTarget,
        vPiso: context.vPiso,
        decision: context.decision,
        motivo: context.motivo,
        monto: context.monto,
        fillPrice: context.fillPrice,
        quantity: context.quantity,
        pnlPct: context.pnlPct,
        cycleMs,
        timestamp: new Date().toISOString(),
      });

      // Also log to trade_log for backwards compatibility
      if (context.decision === 'COMPRAR' || context.decision === 'VENDER') {
        TradeLogRepository.create({
          coin: context.coin,
          decision: context.decision,
          motivo: context.motivo,
          monto: context.monto || 0,
          precio: context.fillPrice || 0,
          rsi: context.rsi,
          adx: context.adx,
          direction: context.momentum || 'UNKNOWN',
          entryPrice: context.entryPrice || context.fillPrice,
          entryTime: context.entryTime,
          pnl: context.pnlPct ? `${context.pnlPct}%` : undefined,
          timestamp: new Date().toISOString(),
        });
      }

      logger.debug(`📝 Logged decision for ${context.coin}: ${context.decision} (${context.motivo})`);
    } catch (error) {
      logger.error(`Failed to log decision for ${context.coin}:`, error);
    }
  }

  /**
   * Get recent decisions for a coin
   */
  static getDecisions(coin: CoinSymbol, hours = 24): PipelineContext[] {
    const snapshots = DecisionSnapshotRepository.getRecent(hours);
    return snapshots
      .filter(s => s.coin === coin)
      .map(s => ({
        coin: s.coin as CoinSymbol,
        cycleNumber: s.cycleNumber || 0,
        cycleStartTime: Date.now(),
        regime: s.regime || undefined,
        rsi: s.rsi || undefined,
        adx: s.adx || undefined,
        atrPct: s.atrPct || undefined,
        ema20: s.ema20 || undefined,
        ema50: s.ema50 || undefined,
        histogram: s.histogram || undefined,
        momentum: s.momentum || undefined,
        fvg: s.fvg || undefined,
        htfBias: s.htfBias || undefined,
        confluenceScore: s.confluenceScore || undefined,
        alignment: s.alignment || undefined,
        entryScore: s.entryScore || undefined,
        entryThreshold: s.entryThreshold || undefined,
        entryReasons: s.entryReasons ? JSON.parse(s.entryReasons) : undefined,
        hardStop: s.hardStop || undefined,
        tpTarget: s.tpTarget || undefined,
        vPiso: s.vPiso || undefined,
        decision: s.decision as 'COMPRAR' | 'VENDER' | 'ESPERAR',
        motivo: s.motivo || '',
        monto: s.monto || undefined,
        fillPrice: s.fillPrice || undefined,
        quantity: s.quantity || undefined,
        pnlPct: s.pnlPct || undefined,
      }));
  }

  /**
   * Get performance stats per coin
   */
  static getPerformanceByCoin(): PerformanceByCoin[] {
    const snapshots = DecisionSnapshotRepository.getAll(10000);
    const coinStats: Record<string, {
      trades: Array<{ decision: string; pnlPct: number | null; timestamp: string }>;
    }> = {};

    // Group by coin
    for (const snap of snapshots) {
      if (snap.decision === 'ESPERAR') continue;
      if (!coinStats[snap.coin]) coinStats[snap.coin] = { trades: [] };
      coinStats[snap.coin].trades.push({
        decision: snap.decision,
        pnlPct: snap.pnlPct,
        timestamp: snap.timestamp,
      });
    }

    const results: PerformanceByCoin[] = [];

    for (const [coin, data] of Object.entries(coinStats)) {
      const sells = data.trades.filter(t => t.decision === 'VENDER');
      const wins = sells.filter(t => (t.pnlPct || 0) > 0);
      const losses = sells.filter(t => (t.pnlPct || 0) < 0);
      const pnls = sells.map(t => t.pnlPct || 0);

      results.push({
        coin,
        totalTrades: data.trades.length,
        wins: wins.length,
        losses: losses.length,
        winRate: sells.length > 0 ? (wins.length / sells.length) * 100 : 0,
        totalPnl: pnls.reduce((a, b) => a + b, 0),
        avgPnl: sells.length > 0 ? pnls.reduce((a, b) => a + b, 0) / sells.length : 0,
        bestTrade: pnls.length > 0 ? Math.max(...pnls) : 0,
        worstTrade: pnls.length > 0 ? Math.min(...pnls) : 0,
        avgHoldTimeMs: 0, // Would need entry/exit timestamps
      });
    }

    return results.sort((a, b) => b.totalPnl - a.totalPnl);
  }

  /**
   * Get win streak information
   */
  static getWinStreaks(): WinStreakInfo {
    const dailyStreaks = DailySummaryRepository.getStreaks();

    // Count total winning/losing days
    const summaries = DailySummaryRepository.getLastNDays(365);
    const totalWinningDays = summaries.filter(d => d.totalPnlPct > 0).length;
    const totalLosingDays = summaries.filter(d => d.totalPnlPct < 0).length;

    return {
      ...dailyStreaks,
      totalWinningDays,
      totalLosingDays,
    };
  }

  /**
   * Get daily summary for today (auto-create if needed)
   */
  static getTodaySummary(): DailySummaryData {
    const today = new Date().toISOString().split('T')[0];
    let summary = DailySummaryRepository.getByDate(today);

    if (!summary) {
      // Create empty summary for today
      summary = DailySummaryRepository.upsert({
        date: today,
        totalTrades: 0,
        buys: 0,
        sells: 0,
        wins: 0,
        losses: 0,
        totalPnlPct: 0,
        activePositions: '[]',
      });
    }

    return {
      date: summary.date,
      totalTrades: summary.totalTrades,
      buys: summary.buys,
      sells: summary.sells,
      wins: summary.wins,
      losses: summary.losses,
      totalPnlPct: summary.totalPnlPct,
      bestTrade: summary.bestTrade ? JSON.parse(summary.bestTrade) : undefined,
      worstTrade: summary.worstTrade ? JSON.parse(summary.worstTrade) : undefined,
      activePositions: summary.activePositions ? JSON.parse(summary.activePositions) : [],
      balanceStart: summary.balanceStart || undefined,
      balanceEnd: summary.balanceEnd || undefined,
    };
  }

  /**
   * Update today's summary with a new trade
   */
  static updateDailySummary(trade: {
    coin: string;
    decision: string;
    pnlPct?: number;
    monto?: number;
  }): void {
    const today = new Date().toISOString().split('T')[0];
    const existing = DailySummaryRepository.getByDate(today);

    if (!existing) {
      // Create new
      DailySummaryRepository.upsert({
        date: today,
        totalTrades: 1,
        buys: trade.decision === 'COMPRAR' ? 1 : 0,
        sells: trade.decision === 'VENDER' ? 1 : 0,
        wins: trade.decision === 'VENDER' && (trade.pnlPct || 0) > 0 ? 1 : 0,
        losses: trade.decision === 'VENDER' && (trade.pnlPct || 0) < 0 ? 1 : 0,
        totalPnlPct: trade.pnlPct || 0,
        bestTrade: trade.pnlPct ? JSON.stringify({ coin: trade.coin, pnl: trade.pnlPct, motivo: '' }) : undefined,
        worstTrade: trade.pnlPct ? JSON.stringify({ coin: trade.coin, pnl: trade.pnlPct, motivo: '' }) : undefined,
        activePositions: trade.decision === 'COMPRAR' ? JSON.stringify([trade.coin]) : '[]',
      });
    } else {
      // Update existing
      const buys = existing.buys + (trade.decision === 'COMPRAR' ? 1 : 0);
      const sells = existing.sells + (trade.decision === 'VENDER' ? 1 : 0);
      const wins = existing.wins + (trade.decision === 'VENDER' && (trade.pnlPct || 0) > 0 ? 1 : 0);
      const losses = existing.losses + (trade.decision === 'VENDER' && (trade.pnlPct || 0) < 0 ? 1 : 0);

      // Update best/worst trade
      let bestTrade = existing.bestTrade ? JSON.parse(existing.bestTrade) : null;
      let worstTrade = existing.worstTrade ? JSON.parse(existing.worstTrade) : null;

      if (trade.pnlPct) {
        if (!bestTrade || trade.pnlPct > bestTrade.pnl) {
          bestTrade = { coin: trade.coin, pnl: trade.pnlPct, motivo: '' };
        }
        if (!worstTrade || trade.pnlPct < worstTrade.pnl) {
          worstTrade = { coin: trade.coin, pnl: trade.pnlPct, motivo: '' };
        }
      }

      DailySummaryRepository.upsert({
        date: today,
        totalTrades: existing.totalTrades + 1,
        buys,
        sells,
        wins,
        losses,
        totalPnlPct: existing.totalPnlPct + (trade.pnlPct || 0),
        bestTrade: bestTrade ? JSON.stringify(bestTrade) : undefined,
        worstTrade: worstTrade ? JSON.stringify(worstTrade) : undefined,
        activePositions: existing.activePositions,
      });
    }
  }

  /**
   * Export trades as JSON
   */
  static exportJson(options: {
    coin?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  } = {}): TradeExport[] {
    const { coin, startDate, endDate, limit = 1000 } = options;

    let trades: TradeExport[];

    if (coin) {
      trades = TradeLogRepository.getByCoin(coin, limit) as TradeExport[];
    } else {
      trades = TradeLogRepository.getAll(limit) as TradeExport[];
    }

    // Filter by date range if provided
    if (startDate) {
      trades = trades.filter(t => t.timestamp >= startDate);
    }
    if (endDate) {
      trades = trades.filter(t => t.timestamp <= endDate);
    }

    return trades;
  }

  /**
   * Export trades as CSV string
   */
  static exportCsv(options: {
    coin?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  } = {}): string {
    const trades = this.exportJson(options);

    if (trades.length === 0) {
      return 'No trades to export';
    }

    // CSV header
    const headers = [
      'ID', 'Coin', 'Decision', 'Motivo', 'Monto', 'Precio',
      'RSI', 'ADX', 'Direction', 'EntryPrice', 'EntryTime',
      'PnL', 'Timestamp',
    ];

    const rows = trades.map(t => [
      t.id,
      t.coin,
      t.decision,
      `"${(t.motivo || '').replace(/"/g, '""')}"`,
      t.monto,
      t.precio,
      t.rsi?.toFixed(2) || '',
      t.adx?.toFixed(2) || '',
      t.direction || '',
      t.entryPrice || '',
      t.entryTime || '',
      t.pnl || '',
      t.timestamp,
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Get aggregated stats for a period
   */
  static getAggregatedStats(startDate: string, endDate: string) {
    return DailySummaryRepository.getAggregatedStats(startDate, endDate);
  }

  /**
   * Get decision distribution (how many COMPRAR/VENDER/ESPERAR per coin)
   */
  static getDecisionDistribution(): Record<string, Record<string, number>> {
    const snapshots = DecisionSnapshotRepository.getAll(10000);
    const distribution: Record<string, Record<string, number>> = {};

    for (const snap of snapshots) {
      if (!distribution[snap.coin]) {
        distribution[snap.coin] = { COMPRAR: 0, VENDER: 0, ESPERAR: 0 };
      }
      distribution[snap.coin][snap.decision] = (distribution[snap.coin][snap.decision] || 0) + 1;
    }

    return distribution;
  }

  /**
   * Get regime distribution (how many decisions per regime)
   */
  static getRegimeDistribution(): Record<string, number> {
    const snapshots = DecisionSnapshotRepository.getAll(10000);
    const distribution: Record<string, number> = {};

    for (const snap of snapshots) {
      const regime = snap.regime || 'UNKNOWN';
      distribution[regime] = (distribution[regime] || 0) + 1;
    }

    return distribution;
  }

  /**
   * Get average cycle time per coin
   */
  static getAvgCycleTime(): Record<string, number> {
    const snapshots = DecisionSnapshotRepository.getAll(10000);
    const times: Record<string, number[]> = {};

    for (const snap of snapshots) {
      if (snap.cycleMs) {
        if (!times[snap.coin]) times[snap.coin] = [];
        times[snap.coin].push(snap.cycleMs);
      }
    }

    const result: Record<string, number> = {};
    for (const [coin, ms] of Object.entries(times)) {
      result[coin] = ms.reduce((a, b) => a + b, 0) / ms.length;
    }

    return result;
  }

  /**
   * Cleanup old data
   */
  static cleanup(daysToKeep = 90): { snapshots: number; summaries: number } {
    const snapshots = DecisionSnapshotRepository.cleanupOlderThan(daysToKeep);
    const summaries = DailySummaryRepository.cleanupOlderThan(daysToKeep);

    logger.info(`🧹 TradeLogger cleanup: removed ${snapshots} snapshots, ${summaries} summaries`);
    return { snapshots, summaries };
  }
}
