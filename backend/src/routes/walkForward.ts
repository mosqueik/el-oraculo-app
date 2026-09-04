// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Walk-Forward Optimization Routes
// ═══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { expensiveLimiter } from '../middleware/security';
import { walkForwardOptimizer, OptimizationParams } from '../modules/backtesting/walkForward';
import { ACTIVE_COINS, CoinSymbol } from '@el-oraculo/shared';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/walkforward/optimize
 * Run walk-forward optimization
 *
 * Body: {
 *   coins: string[],
 *   startDate: string,
 *   endDate: string,
 *   initialBalance: number,
 *   inSampleMonths?: number,    // default: 3
 *   outOfSampleMonths?: number, // default: 1
 *   stepMonths?: number,        // default: 1
 *   optimizeFor?: string,       // 'sharpe' | 'profitFactor' | 'winRate' | 'totalPnl' | 'calmar'
 *   monteCarloRuns?: number,    // default: 0 (disabled)
 * }
 */
router.post('/walkforward/optimize', authenticate, expensiveLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const {
      coins = ['BTC', 'ETH'],
      startDate,
      endDate,
      initialBalance = 10000,
      inSampleMonths = 3,
      outOfSampleMonths = 1,
      stepMonths = 1,
      optimizeFor = 'sharpe',
      monteCarloRuns = 0,
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

    // Validate optimization target
    const validTargets = ['sharpe', 'profitFactor', 'winRate', 'totalPnl', 'calmar'];
    if (!validTargets.includes(optimizeFor)) {
      return res.status(400).json({
        success: false,
        error: `Invalid optimizeFor. Available: ${validTargets.join(', ')}`,
      });
    }

    const params: OptimizationParams = {
      coins: validCoins,
      startDate,
      endDate,
      initialBalance,
      inSampleMonths,
      outOfSampleMonths,
      stepMonths,
      optimizeFor: optimizeFor as any,
      monteCarloRuns,
    };

    logger.info(`🔬 API: Walk-forward optimization for ${validCoins.join(',')} (${inSampleMonths}mo IS, ${outOfSampleMonths}mo OOS)`);

    const result = await walkForwardOptimizer.optimize(params);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Walk-forward optimization failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Walk-forward optimization failed',
    });
  }
});

/**
 * POST /api/walkforward/quick
 * Quick optimization (single period, no walk-forward)
 * Useful for finding best params quickly
 */
router.post('/walkforward/quick', authenticate, expensiveLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const {
      coins = ['BTC', 'ETH'],
      startDate,
      endDate,
      initialBalance = 10000,
      optimizeFor = 'sharpe',
    } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: startDate, endDate',
      });
    }

    const validCoins = coins.filter((c: string) => (ACTIVE_COINS as readonly string[]).includes(c)) as CoinSymbol[];
    if (validCoins.length === 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid coins. Available: ${ACTIVE_COINS.join(', ')}`,
      });
    }

    const params: OptimizationParams = {
      coins: validCoins,
      startDate,
      endDate,
      initialBalance,
      inSampleMonths: 6, // Use all data for single optimization
      outOfSampleMonths: 0,
      stepMonths: 6,
      optimizeFor: optimizeFor as any,
    };

    logger.info(`🔬 API: Quick optimization for ${validCoins.join(',')}`);

    const result = await walkForwardOptimizer.optimize(params);

    res.json({
      success: true,
      data: {
        bestParams: result.bestParams,
        aggregate: result.aggregate,
        parameterHistory: result.parameterHistory,
      },
    });
  } catch (error) {
    logger.error('Quick optimization failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Quick optimization failed',
    });
  }
});

/**
 * GET /api/walkforward/presets
 * Get optimization presets
 */
router.get('/walkforward/presets', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const presets = [
      {
        name: 'Conservative',
        description: 'Low risk, steady returns. Tests lower risk percentages.',
        params: {
          inSampleMonths: 3,
          outOfSampleMonths: 1,
          optimizeFor: 'sharpe',
          paramGrid: {
            entryThreshold: [55, 60, 65],
            riskPct: [0.02, 0.03, 0.05],
            maxHoldHours: [8, 12],
            stopLossMultiplier: [1.5, 2.0],
            takeProfitMultiplier: [2.0, 2.5],
          },
        },
      },
      {
        name: 'Balanced',
        description: 'Moderate risk/reward. Default parameter grid.',
        params: {
          inSampleMonths: 3,
          outOfSampleMonths: 1,
          optimizeFor: 'sharpe',
        },
      },
      {
        name: 'Aggressive',
        description: 'High risk, high reward. Tests higher risk percentages.',
        params: {
          inSampleMonths: 2,
          outOfSampleMonths: 1,
          optimizeFor: 'totalPnl',
          paramGrid: {
            entryThreshold: [50, 55, 60],
            riskPct: [0.07, 0.10, 0.15],
            maxHoldHours: [4, 6, 8],
            stopLossMultiplier: [1.0, 1.5],
            takeProfitMultiplier: [1.5, 2.0, 3.0],
          },
        },
      },
      {
        name: 'Monte Carlo',
        description: 'Full walk-forward with Monte Carlo robustness testing.',
        params: {
          inSampleMonths: 3,
          outOfSampleMonths: 1,
          stepMonths: 1,
          optimizeFor: 'sharpe',
          monteCarloRuns: 1000,
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
 * GET /api/walkforward/info
 * Get information about walk-forward optimization
 */
router.get('/walkforward/info', authenticate, (req: AuthRequest, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        description: 'Walk-Forward Optimization (WFO) splits historical data into in-sample (optimization) and out-of-sample (validation) periods. This prevents overfitting by testing parameters on unseen data.',
        howItWorks: [
          '1. Split data into rolling windows (e.g., 3mo IS + 1mo OOS)',
          '2. Optimize parameters on in-sample data (grid search)',
          '3. Test optimized parameters on out-of-sample data',
          '4. Move window forward and repeat',
          '5. Aggregate results across all periods',
        ],
        metrics: {
          walkForwardEfficiency: 'OOS return / IS return ratio. >50% is good, >80% is excellent.',
          parameterStability: 'How stable are optimal parameters across periods. >70 is good.',
          monteCarlo: 'Shuffles trade order to estimate return distribution and probability of profit.',
        },
        optimizationTargets: [
          { value: 'sharpe', label: 'Sharpe Ratio', description: 'Risk-adjusted return' },
          { value: 'profitFactor', label: 'Profit Factor', description: 'Gross profit / Gross loss' },
          { value: 'winRate', label: 'Win Rate', description: 'Percentage of winning trades' },
          { value: 'totalPnl', label: 'Total PnL', description: 'Total percentage return' },
          { value: 'calmar', label: 'Calmar Ratio', description: 'Return / Max Drawdown' },
        ],
        availableCoins: [...ACTIVE_COINS],
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get info',
    });
  }
});

export default router;
