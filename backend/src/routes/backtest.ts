// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Backtesting Routes
// ═══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { expensiveLimiter } from '../middleware/security';
import { backtestRunner, BacktestParams } from '../modules/backtesting/service';
import { ACTIVE_COINS, CoinSymbol } from '@el-oraculo/shared';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/backtest/coins
 * List available coins for backtesting
 */
router.get('/backtest/coins', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const coins = ACTIVE_COINS.map(coin => ({
      symbol: coin,
      name: coin,
      pair: `${coin}USDT`,
    }));

    res.json({
      success: true,
      data: coins,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get coins',
    });
  }
});

/**
 * GET /api/backtest/presets
 * Get preset strategies for backtesting
 */
router.get('/backtest/presets', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const presets = [
      {
        name: 'Conservative',
        description: 'Low risk, steady returns',
        params: {
          coins: ['BTC', 'ETH'] as CoinSymbol[],
          initialBalance: 10000,
          strategy: 'conservative' as const,
        },
      },
      {
        name: 'Balanced',
        description: 'Moderate risk/reward',
        params: {
          coins: ['BTC', 'ETH', 'SOL', 'BNB'] as CoinSymbol[],
          initialBalance: 10000,
          strategy: 'default' as const,
        },
      },
      {
        name: 'Aggressive',
        description: 'High risk, high reward, all coins',
        params: {
          coins: [...ACTIVE_COINS] as CoinSymbol[],
          initialBalance: 10000,
          strategy: 'aggressive' as const,
        },
      },
    ];

    res.json({
      success: true,
      data: presets,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get presets',
    });
  }
});

/**
 * POST /api/backtest/run
 * Run a full backtest simulation with historical data
 *
 * Body: {
 *   coins: string[],       // e.g. ['BTC', 'ETH']
 *   startDate: string,     // e.g. '2025-01-01'
 *   endDate: string,       // e.g. '2025-06-30'
 *   initialBalance: number, // e.g. 10000
 *   strategy?: string      // 'default' | 'conservative' | 'aggressive'
 * }
 */
router.post('/backtest/run', authenticate, expensiveLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const {
      coins = ['BTC', 'ETH'],
      startDate,
      endDate,
      initialBalance = 10000,
      strategy = 'default',
    } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: startDate, endDate',
      });
    }

    // Validate coins
    const validCoins = coins.filter((c: string) => (ACTIVE_COINS as readonly string[]).includes(c)) as CoinSymbol[];
    if (validCoins.length === 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid coins. Available: ${ACTIVE_COINS.join(', ')}`,
      });
    }

    const params: BacktestParams = {
      coins: validCoins as CoinSymbol[],
      startDate,
      endDate,
      initialBalance,
      strategy: strategy as any,
    };

    logger.info(`🔬 API: Running backtest for ${validCoins.join(',')} from ${startDate} to ${endDate}`);

    const result = await backtestRunner.runBacktest(params);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Backtest failed',
    });
  }
});

/**
 * POST /api/backtest/validate-signals
 * Run backtest and return only SM signal accuracy
 */
router.post('/backtest/validate-signals', authenticate, expensiveLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const {
      coins = ['BTC'],
      startDate,
      endDate,
      initialBalance = 10000,
    } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: startDate, endDate',
      });
    }

    const params: BacktestParams = {
      coins: coins.filter((c: string) => (ACTIVE_COINS as readonly string[]).includes(c)) as CoinSymbol[],
      startDate,
      endDate,
      initialBalance,
    };

    const result = await backtestRunner.runBacktest(params);

    res.json({
      success: true,
      data: {
        smSignalAccuracy: result.smSignalAccuracy,
        regimePerformance: result.regimePerformance,
        perCoin: result.perCoin,
        summary: result.summary,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Signal validation failed',
    });
  }
});

/**
 * POST /api/backtest/export
 * Export backtest results as CSV
 */
router.post('/backtest/export', authenticate, expensiveLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const {
      coins = ['BTC'],
      startDate,
      endDate,
      initialBalance = 10000,
    } = req.body;

    const params: BacktestParams = {
      coins: coins.filter((c: string) => (ACTIVE_COINS as readonly string[]).includes(c)) as CoinSymbol[],
      startDate,
      endDate,
      initialBalance,
    };

    const result = await backtestRunner.runBacktest(params);

    // Convert trades to CSV
    const headers = [
      'Coin', 'Entry Date', 'Exit Date', 'Entry Price', 'Exit Price',
      'PnL %', 'Hold Hours', 'Exit Reason', 'Regime', 'HTF Bias',
      'Confluence', 'OB Count', 'BOS Count',
    ];
    const rows = result.trades.map(t => [
      t.coin,
      t.entryDate,
      t.exitDate,
      t.entryPrice.toFixed(2),
      t.exitPrice.toFixed(2),
      t.pnlPct.toFixed(2),
      t.holdHours.toFixed(1),
      t.exitReason,
      t.regime,
      t.htfBias,
      t.confluenceScore.toString(),
      t.obCount.toString(),
      t.bosCount.toString(),
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="backtest-${startDate}-${endDate}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
    });
  }
});

export default router;
