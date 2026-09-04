// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Portfolio Risk Routes
// ═══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { portfolioRiskService } from '../modules/portfolioRisk/service';
import { ACTIVE_COINS, CoinSymbol } from '@el-oraculo/shared';
import { logger } from '../utils/logger';

const router = Router();

// Reference to exchange for balance
let exchangeService: any = null;

/**
 * Set exchange service reference
 */
export function setExchangeReference(exchange: any) {
  exchangeService = exchange;
}

/**
 * GET /api/risk/portfolio
 * Get current portfolio risk state
 */
router.get('/risk/portfolio', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    let totalBalance = 10000; // Default

    if (exchangeService) {
      try {
        const balance = await exchangeService.getBalance();
        totalBalance = balance.usdt_total;
      } catch (err) {
        // Use default
      }
    }

    const state = portfolioRiskService.getPortfolioState(totalBalance);

    res.json({
      success: true,
      data: state,
    });
  } catch (error) {
    logger.error('Portfolio risk error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get portfolio risk',
    });
  }
});

/**
 * GET /api/risk/config
 * Get current risk configuration
 */
router.get('/risk/config', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const config = portfolioRiskService.getConfig();

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get risk config',
    });
  }
});

/**
 * PUT /api/risk/config
 * Update risk configuration
 */
router.put('/risk/config', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const {
      maxTotalExposurePct,
      maxSinglePositionPct,
      maxCorrelatedPositions,
      correlationThreshold,
      maxDrawdownPct,
      drawdownCooldownMinutes,
      maxSectorExposurePct,
      portfolioHeatThreshold,
      reduceHeatThreshold,
    } = req.body;

    const updates: any = {};
    if (maxTotalExposurePct !== undefined) updates.maxTotalExposurePct = maxTotalExposurePct;
    if (maxSinglePositionPct !== undefined) updates.maxSinglePositionPct = maxSinglePositionPct;
    if (maxCorrelatedPositions !== undefined) updates.maxCorrelatedPositions = maxCorrelatedPositions;
    if (correlationThreshold !== undefined) updates.correlationThreshold = correlationThreshold;
    if (maxDrawdownPct !== undefined) updates.maxDrawdownPct = maxDrawdownPct;
    if (drawdownCooldownMinutes !== undefined) updates.drawdownCooldownMinutes = drawdownCooldownMinutes;
    if (maxSectorExposurePct !== undefined) updates.maxSectorExposurePct = maxSectorExposurePct;
    if (portfolioHeatThreshold !== undefined) updates.portfolioHeatThreshold = portfolioHeatThreshold;
    if (reduceHeatThreshold !== undefined) updates.reduceHeatThreshold = reduceHeatThreshold;

    portfolioRiskService.updateConfig(updates);

    res.json({
      success: true,
      data: portfolioRiskService.getConfig(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update risk config',
    });
  }
});

/**
 * GET /api/risk/correlation
 * Get correlation matrix
 */
router.get('/risk/correlation', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const matrix = portfolioRiskService.getCorrelationMatrix();

    res.json({
      success: true,
      data: matrix || {
        coins: [],
        matrix: [],
        timestamp: new Date().toISOString(),
        message: 'Insufficient data for correlation matrix (need at least 20 price updates per coin)',
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get correlation',
    });
  }
});

/**
 * GET /api/risk/correlation/:coin1/:coin2
 * Get correlation between two specific coins
 */
router.get('/risk/correlation/:coin1/:coin2', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { coin1, coin2 } = req.params;
    const correlation = portfolioRiskService.getCorrelation(
      coin1.toUpperCase() as CoinSymbol,
      coin2.toUpperCase() as CoinSymbol
    );

    res.json({
      success: true,
      data: {
        coin1: coin1.toUpperCase(),
        coin2: coin2.toUpperCase(),
        correlation,
        strength: Math.abs(correlation) > 0.7 ? 'strong' : Math.abs(correlation) > 0.4 ? 'moderate' : 'weak',
        direction: correlation > 0 ? 'positive' : correlation < 0 ? 'negative' : 'none',
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get correlation',
    });
  }
});

/**
 * POST /api/risk/check
 * Check if a new position is allowed
 */
router.post('/risk/check', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { coin, monto } = req.body;

    if (!coin || !monto) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: coin, monto',
      });
    }

    if (!(ACTIVE_COINS as readonly string[]).includes(coin)) {
      return res.status(400).json({
        success: false,
        error: `Invalid coin. Available: ${ACTIVE_COINS.join(', ')}`,
      });
    }

    let totalBalance = 10000;
    let freeBalance = monto * 2;

    if (exchangeService) {
      try {
        const balance = await exchangeService.getBalance();
        totalBalance = balance.usdt_total;
        freeBalance = balance.usdt_free;
      } catch (err) {
        // Use defaults
      }
    }

    const result = portfolioRiskService.checkNewPosition(
      coin as CoinSymbol,
      monto,
      { usdt_free: freeBalance, usdt_total: totalBalance },
      { rsi: 50, adx: 20, atr_pct: 1, currentPrice: 0 } as any
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check risk',
    });
  }
});

/**
 * POST /api/risk/reset-circuit-breaker
 * Manually reset circuit breaker
 */
router.post('/risk/reset-circuit-breaker', authenticate, (req: AuthRequest, res: Response) => {
  try {
    portfolioRiskService.resetCircuitBreaker();

    res.json({
      success: true,
      data: { message: 'Circuit breaker reset' },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reset circuit breaker',
    });
  }
});

/**
 * GET /api/risk/positions
 * Get risk-adjusted position sizes for all coins
 */
router.get('/risk/positions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    let totalBalance = 10000;
    let freeBalance = 5000;

    if (exchangeService) {
      try {
        const balance = await exchangeService.getBalance();
        totalBalance = balance.usdt_total;
        freeBalance = balance.usdt_free;
      } catch (err) {
        // Use defaults
      }
    }

    const state = portfolioRiskService.getPortfolioState(totalBalance);

    // Calculate recommended position sizes
    const recommendations = ACTIVE_COINS.map(coin => {
      const config = {
        risk_pct: 0.05,
        entry_min: 10,
      };

      const baseMonto = freeBalance * config.risk_pct;
      const maxAllowed = totalBalance * 0.2; // 20% max single position

      return {
        coin,
        baseMonto: Math.min(baseMonto, maxAllowed),
        maxAllowed,
        riskPct: config.risk_pct,
      };
    });

    res.json({
      success: true,
      data: {
        portfolioState: state,
        recommendations,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get positions',
    });
  }
});

/**
 * GET /api/risk/sectors
 * Get sector exposure breakdown
 */
router.get('/risk/sectors', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    let totalBalance = 10000;

    if (exchangeService) {
      try {
        const balance = await exchangeService.getBalance();
        totalBalance = balance.usdt_total;
      } catch (err) {
        // Use default
      }
    }

    const state = portfolioRiskService.getPortfolioState(totalBalance);
    const config = portfolioRiskService.getConfig();

    // Build sector details
    const sectors: Record<string, {
      exposure: number;
      exposurePct: number;
      coins: string[];
      limit: number;
    }> = {};

    for (const [coin, sector] of Object.entries(config.sectors)) {
      if (!sectors[sector]) {
        sectors[sector] = { exposure: 0, exposurePct: 0, coins: [], limit: config.maxSectorExposurePct };
      }
      sectors[sector].coins.push(coin);
      sectors[sector].exposurePct = state.sectorExposure[sector] || 0;
    }

    res.json({
      success: true,
      data: {
        sectors,
        totalExposurePct: state.totalExposurePct,
        maxSectorExposurePct: config.maxSectorExposurePct,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get sectors',
    });
  }
});

export default router;
