// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Dashboard Route
// ═══════════════════════════════════════════════════════════════════
//
// Serves the web dashboard for real-time monitoring.
// Provides consolidated API endpoints optimized for dashboard widgets.
// ═══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import path from 'path';
import { BotStateRepository, TradeLogRepository, ExecutionRepository } from '../database/repositories';
import { DecisionSnapshotRepository } from '../database/repositories/DecisionSnapshotRepository';
import { DailySummaryRepository } from '../database/repositories/DailySummaryRepository';
import { getWSStats } from '../ws/server';
import { ACTIVE_COINS, COIN_CONFIGS } from '@el-oraculo/shared';
import { logger } from '../utils/logger';

const router = Router();

// Reference to trading engine (set at startup)
let tradingEngine: any = null;
let exchangeService: any = null;

/**
 * Set trading engine and exchange references
 */
export function setDashboardReferences(engine: any, exchange: any) {
  tradingEngine = engine;
  exchangeService = exchange;
}

// ─── Serve Dashboard HTML ──────────────────────────────────────

/**
 * GET /dashboard
 * Serve the real-time monitoring dashboard
 */
router.get('/dashboard', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../../public/dashboard.html'));
});

// ─── Dashboard API Endpoints ───────────────────────────────────

/**
 * GET /api/dashboard/overview
 * Get all dashboard data in one call
 */
router.get('/dashboard/overview', async (req: Request, res: Response) => {
  try {
    // Bot status
    const botStatus = tradingEngine?.getStatus() || {
      running: false,
      cycleCount: 0,
      uptime: process.uptime(),
    };

    // Memory usage
    const mem = process.memoryUsage();

    // Portfolio data
    const botStates = BotStateRepository.getAll();
    const activePositions = botStates.filter(b => b.status === 'COMPRADO');

    // Today's summary
    const today = new Date().toISOString().split('T')[0];
    const dailySummary = DailySummaryRepository.getByDate(today);

    // Win streaks
    const streaks = DailySummaryRepository.getStreaks();

    // Recent trades
    const recentTrades = TradeLogRepository.getRecent(24);

    // WebSocket stats
    const wsStats = getWSStats();

    // Decision counts
    const decisionCounts = DecisionSnapshotRepository.getCountByDecision();

    res.json({
      bot: {
        ...botStatus,
        memoryMB: Math.round(mem.heapUsed / 1024 / 1024),
        memoryTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      },
      portfolio: {
        totalCoins: ACTIVE_COINS.length,
        activePositions: activePositions.length,
        positions: activePositions.map(p => ({
          coin: p.coin,
          entryPrice: p.entryPrice,
          entryTime: p.entryTime,
          montoEntrada: p.montoEntrada,
          streakLosses: p.streakLosses,
        })),
      },
      today: dailySummary ? {
        trades: dailySummary.totalTrades,
        buys: dailySummary.buys,
        sells: dailySummary.sells,
        wins: dailySummary.wins,
        losses: dailySummary.losses,
        pnl: dailySummary.totalPnlPct,
      } : { trades: 0, buys: 0, sells: 0, wins: 0, losses: 0, pnl: 0 },
      streaks,
      ws: wsStats,
      decisions: decisionCounts,
      recentTrades: recentTrades.slice(0, 10),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Dashboard overview error:', error);
    res.status(500).json({ error: 'Failed to get dashboard overview' });
  }
});

/**
 * GET /api/dashboard/coins
 * Get all coin data for the dashboard table
 */
router.get('/dashboard/coins', async (req: Request, res: Response) => {
  try {
    const botStates = BotStateRepository.getAll();
    const latestDecisions = DecisionSnapshotRepository.getLatestPerCoin();

    const coins = ACTIVE_COINS.map(coin => {
      const botState = botStates.find(b => b.coin === coin);
      const decision = latestDecisions.find(d => d.coin === coin);
      const config = COIN_CONFIGS[coin];

      return {
        coin,
        pair: config?.pair || `${coin}USDT`,
        status: botState?.status || 'LÍQUIDO',
        entryPrice: botState?.entryPrice || 0,
        entryTime: botState?.entryTime,
        montoEntrada: botState?.montoEntrada || 0,
        streakLosses: botState?.streakLosses || 0,
        lastSellReason: botState?.lastSellReason,
        // From latest decision snapshot
        rsi: decision?.rsi || 0,
        adx: decision?.adx || 0,
        score: decision?.entryScore || 0,
        regime: decision?.regime || 'UNKNOWN',
        momentum: decision?.momentum || 'NEUTRAL',
        htfBias: decision?.htfBias || 'NEUTRAL',
        confluenceScore: decision?.confluenceScore || 0,
        lastDecision: decision?.decision || 'ESPERAR',
        lastMotivo: decision?.motivo || '',
        lastTimestamp: decision?.timestamp,
        // Config
        riskPct: config?.risk_pct || 0,
        entryMin: config?.entry_min || 0,
      };
    });

    res.json({ coins });
  } catch (error) {
    logger.error('Dashboard coins error:', error);
    res.status(500).json({ error: 'Failed to get coin data' });
  }
});

/**
 * GET /api/dashboard/positions
 * Get active positions with current PnL
 */
router.get('/dashboard/positions', async (req: Request, res: Response) => {
  try {
    const botStates = BotStateRepository.getAll();
    const activePositions = botStates.filter(b => b.status === 'COMPRADO');

    // Get current prices if exchange is available
    const positions = await Promise.all(activePositions.map(async (p) => {
      let currentPrice = 0;
      let pnlPct = 0;
      let pnlUsd = 0;
      let hoursHeld = 0;

      if (exchangeService) {
        try {
          const config = COIN_CONFIGS[p.coin as keyof typeof COIN_CONFIGS];
          if (config) {
            currentPrice = await exchangeService.getTicker(config.pair);

            if (p.entryPrice > 0 && currentPrice > 0) {
              pnlPct = ((currentPrice - p.entryPrice) / p.entryPrice) * 100;
              pnlUsd = (currentPrice - p.entryPrice) * (p.montoEntrada / p.entryPrice);
            }

            if (p.entryTime) {
              hoursHeld = (Date.now() - new Date(p.entryTime).getTime()) / (1000 * 60 * 60);
            }
          }
        } catch (err) {
          // Price fetch failed, continue with zeros
        }
      }

      return {
        coin: p.coin,
        entryPrice: p.entryPrice,
        entryTime: p.entryTime,
        montoEntrada: p.montoEntrada,
        currentPrice,
        pnlPct,
        pnlUsd,
        hoursHeld,
        streakLosses: p.streakLosses,
      };
    }));

    res.json({ positions });
  } catch (error) {
    logger.error('Dashboard positions error:', error);
    res.status(500).json({ error: 'Failed to get positions' });
  }
});

/**
 * GET /api/dashboard/trades
 * Get recent trades with pagination
 */
router.get('/dashboard/trades', (req: Request, res: Response) => {
  try {
    const { hours = '24', limit = '50' } = req.query;
    const trades = TradeLogRepository.getRecent(parseInt(hours as string));

    res.json({
      trades: trades.slice(0, parseInt(limit as string)),
      total: trades.length,
    });
  } catch (error) {
    logger.error('Dashboard trades error:', error);
    res.status(500).json({ error: 'Failed to get trades' });
  }
});

/**
 * GET /api/dashboard/performance
 * Get performance metrics
 */
router.get('/dashboard/performance', (req: Request, res: Response) => {
  try {
    const snapshots = DecisionSnapshotRepository.getAll(10000);
    const trades = TradeLogRepository.getAll(10000);

    // Calculate metrics
    const sells = trades.filter(t => t.decision === 'VENDER');
    const wins = sells.filter(t => t.pnl && !t.pnl.startsWith('-'));
    const totalPnl = sells.reduce((acc, t) => {
      if (t.pnl) {
        const val = parseFloat(t.pnl.replace('%', ''));
        return acc + (isNaN(val) ? 0 : val);
      }
      return acc;
    }, 0);

    const avgCycleMs = snapshots.length > 0
      ? snapshots.reduce((acc, s) => acc + (s.cycleMs || 0), 0) / snapshots.length
      : 0;

    // Per-coin performance
    const perCoin: Record<string, { trades: number; wins: number; pnl: number }> = {};
    for (const t of sells) {
      if (!perCoin[t.coin]) perCoin[t.coin] = { trades: 0, wins: 0, pnl: 0 };
      perCoin[t.coin].trades++;
      if (t.pnl && !t.pnl.startsWith('-')) perCoin[t.coin].wins++;
      const val = parseFloat(t.pnl?.replace('%', '') || '0');
      perCoin[t.coin].pnl += isNaN(val) ? 0 : val;
    }

    res.json({
      totalTrades: trades.length,
      totalSells: sells.length,
      totalWins: wins.length,
      winRate: sells.length > 0 ? (wins.length / sells.length) * 100 : 0,
      totalPnl,
      avgCycleMs,
      perCoin,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Dashboard performance error:', error);
    res.status(500).json({ error: 'Failed to get performance' });
  }
});

export default router;
