// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Analytics Routes
// ═══════════════════════════════════════════════════════════════════
//
// Endpoints for trade analytics, daily summaries, and export.
// Replaces Google Sheets logging with structured API.
// ═══════════════════════════════════════════════════════════════════

import { Router } from 'express';
import { TradeLoggerService } from '../modules/tradeLogger/service';
import { DecisionSnapshotRepository } from '../database/repositories/DecisionSnapshotRepository';
import { DailySummaryRepository } from '../database/repositories/DailySummaryRepository';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// ─── Dashboard Summary ──────────────────────────────────────────

/**
 * GET /api/analytics/dashboard
 * Get today's summary + quick stats
 */
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const todaySummary = TradeLoggerService.getTodaySummary();
    const winStreaks = TradeLoggerService.getWinStreaks();
    const avgCycleTime = TradeLoggerService.getAvgCycleTime();

    const totalDecisions = DecisionSnapshotRepository.getCount();
    const decisionCounts = DecisionSnapshotRepository.getCountByDecision();

    res.json({
      today: todaySummary,
      streaks: winStreaks,
      totalDecisions,
      decisionCounts,
      avgCycleTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

// ─── Per-Coin Performance ───────────────────────────────────────

/**
 * GET /api/analytics/performance
 * Get performance breakdown by coin
 */
router.get('/performance', authenticate, async (req, res) => {
  try {
    const performance = TradeLoggerService.getPerformanceByCoin();
    res.json({ performance });
  } catch (error) {
    logger.error('Performance error:', error);
    res.status(500).json({ error: 'Failed to get performance data' });
  }
});

// ─── Win Streaks ────────────────────────────────────────────────

/**
 * GET /api/analytics/streaks
 * Get current and max win/loss streaks
 */
router.get('/streaks', authenticate, async (req, res) => {
  try {
    const streaks = TradeLoggerService.getWinStreaks();
    res.json({ streaks });
  } catch (error) {
    logger.error('Streaks error:', error);
    res.status(500).json({ error: 'Failed to get streak data' });
  }
});

// ─── Daily Summaries ────────────────────────────────────────────

/**
 * GET /api/analytics/daily
 * Get daily summaries with optional date range
 */
router.get('/daily', authenticate, async (req, res) => {
  try {
    const { startDate, endDate, days } = req.query;

    let summaries;
    if (startDate && endDate) {
      summaries = DailySummaryRepository.getByDateRange(startDate as string, endDate as string);
    } else if (days) {
      summaries = DailySummaryRepository.getLastNDays(parseInt(days as string));
    } else {
      summaries = DailySummaryRepository.getAll(30);
    }

    res.json({ summaries });
  } catch (error) {
    logger.error('Daily summaries error:', error);
    res.status(500).json({ error: 'Failed to get daily summaries' });
  }
});

/**
 * GET /api/analytics/daily/:date
 * Get summary for a specific date
 */
router.get('/daily/:date', authenticate, async (req, res) => {
  try {
    const summary = DailySummaryRepository.getByDate(req.params.date);
    if (!summary) {
      return res.status(404).json({ error: 'No summary found for this date' });
    }
    res.json({ summary });
  } catch (error) {
    logger.error('Daily summary error:', error);
    res.status(500).json({ error: 'Failed to get daily summary' });
  }
});

// ─── Aggregated Stats ───────────────────────────────────────────

/**
 * GET /api/analytics/stats
 * Get aggregated stats for a period
 */
router.get('/stats', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const stats = TradeLoggerService.getAggregatedStats(
      startDate as string,
      endDate as string
    );
    res.json({ stats });
  } catch (error) {
    logger.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ─── Decision Distribution ──────────────────────────────────────

/**
 * GET /api/analytics/distribution
 * Get decision and regime distribution
 */
router.get('/distribution', authenticate, async (req, res) => {
  try {
    const decisionDist = TradeLoggerService.getDecisionDistribution();
    const regimeDist = TradeLoggerService.getRegimeDistribution();

    res.json({
      decisions: decisionDist,
      regimes: regimeDist,
    });
  } catch (error) {
    logger.error('Distribution error:', error);
    res.status(500).json({ error: 'Failed to get distribution data' });
  }
});

// ─── Recent Decisions ───────────────────────────────────────────

/**
 * GET /api/analytics/decisions
 * Get recent decisions with full context
 */
router.get('/decisions', authenticate, async (req, res) => {
  try {
    const { coin, hours = '24' } = req.query;
    const snapshots = DecisionSnapshotRepository.getRecent(parseInt(hours as string));

    let filtered = snapshots;
    if (coin) {
      filtered = snapshots.filter(s => s.coin === coin);
    }

    res.json({
      decisions: filtered,
      count: filtered.length,
    });
  } catch (error) {
    logger.error('Decisions error:', error);
    res.status(500).json({ error: 'Failed to get decisions' });
  }
});

// ─── Export ──────────────────────────────────────────────────────

/**
 * GET /api/analytics/export/json
 * Export trades as JSON
 */
router.get('/export/json', authenticate, async (req, res) => {
  try {
    const { coin, startDate, endDate, limit } = req.query;

    const trades = TradeLoggerService.exportJson({
      coin: coin as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: limit ? parseInt(limit as string) : 1000,
    });

    res.json({
      trades,
      count: trades.length,
      exportedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('JSON export error:', error);
    res.status(500).json({ error: 'Failed to export trades' });
  }
});

/**
 * GET /api/analytics/export/csv
 * Export trades as CSV
 */
router.get('/export/csv', authenticate, async (req, res) => {
  try {
    const { coin, startDate, endDate, limit } = req.query;

    const csv = TradeLoggerService.exportCsv({
      coin: coin as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: limit ? parseInt(limit as string) : 1000,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="trades-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    logger.error('CSV export error:', error);
    res.status(500).json({ error: 'Failed to export trades' });
  }
});

// ─── Cleanup ─────────────────────────────────────────────────────

/**
 * POST /api/analytics/cleanup
 * Cleanup old data (admin only)
 */
router.post('/cleanup', authenticate, async (req, res) => {
  try {
    const { daysToKeep = 90 } = req.body;
    const result = TradeLoggerService.cleanup(daysToKeep);

    res.json({
      message: 'Cleanup completed',
      removed: result,
    });
  } catch (error) {
    logger.error('Cleanup error:', error);
    res.status(500).json({ error: 'Failed to cleanup data' });
  }
});

export default router;
