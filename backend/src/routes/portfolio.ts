// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Portfolio Routes (with Zod Validation)
// ═══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { BotStateRepository } from '../database/repositories';
import { ExchangeService } from '../modules/exchange/service';
import {
  validateParams,
  validateBody,
  PortfolioParamsSchema,
  PortfolioBuyBodySchema,
  PortfolioSellBodySchema,
} from '../validation';
import { ACTIVE_COINS, COIN_CONFIGS } from '@el-oraculo/shared';

const router = Router();

// Reference to exchange service (set at startup)
let exchangeService: ExchangeService | null = null;

export function setExchangeReference(exchange: ExchangeService) {
  exchangeService = exchange;
}

/**
 * @swagger
 * /api/portfolio:
 *   get:
 *     tags: [Portfolio]
 *     summary: Get all coin states
 *     description: Returns the current state of all coins in the portfolio
 *     responses:
 *       200:
 *         description: Portfolio data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BotState'
 *                 count:
 *                   type: integer
 */
router.get('/portfolio', (req: Request, res: Response) => {
  try {
    const allStates = BotStateRepository.getAll();
    res.json({
      success: true,
      data: allStates,
      count: allStates.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get portfolio',
    });
  }
});

/**
 * @swagger
 * /api/portfolio/active:
 *   get:
 *     tags: [Portfolio]
 *     summary: Get active positions
 *     description: Returns only coins with active positions (status = COMPRADO)
 *     responses:
 *       200:
 *         description: Active positions
 */
router.get('/portfolio/active', (req: Request, res: Response) => {
  try {
    const activePositions = BotStateRepository.getActivePositions();
    res.json({
      success: true,
      data: activePositions,
      count: activePositions.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get active positions',
    });
  }
});

/**
 * @swagger
 * /api/portfolio/{coin}:
 *   get:
 *     tags: [Portfolio]
 *     summary: Get specific coin state
 *     description: Returns the current state of a specific coin
 *     parameters:
 *       - in: path
 *         name: coin
 *         required: true
 *         schema:
 *           type: string
 *           enum: [BTC, ETH, SOL, BNB, XRP, ADA, DOGE, AVAX, DOT, LINK, POL, ARB, SUI, NEAR, ESP]
 *         description: Coin symbol
 *     responses:
 *       200:
 *         description: Coin state
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BotState'
 *       404:
 *         description: Coin not found
 */
router.get('/portfolio/:coin', validateParams(PortfolioParamsSchema), (req: Request, res: Response) => {
  try {
    const { coin } = req.params as any as { coin: string };
    const state = BotStateRepository.getByCoin(coin.toUpperCase());

    if (!state) {
      return res.status(404).json({
        success: false,
        error: `Coin ${coin} not found`,
      });
    }

    res.json({
      success: true,
      data: state,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get coin state',
    });
  }
});

/**
 * POST /api/portfolio/:coin/buy
 * Mark coin as bought
 */
router.post(
  '/portfolio/:coin/buy',
  validateParams(PortfolioParamsSchema),
  validateBody(PortfolioBuyBodySchema),
  (req: Request, res: Response) => {
    try {
      const { coin } = req.params as any as { coin: string };
      const { entryPrice, monto } = req.body;

      const updated = BotStateRepository.markBought(
        coin.toUpperCase(),
        entryPrice,
        monto
      );

      if (!updated) {
        return res.status(404).json({
          success: false,
          error: `Coin ${coin} not found`,
        });
      }

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark as bought',
      });
    }
  }
);

/**
 * POST /api/portfolio/:coin/sell
 * Mark coin as sold
 */
router.post(
  '/portfolio/:coin/sell',
  validateParams(PortfolioParamsSchema),
  validateBody(PortfolioSellBodySchema),
  (req: Request, res: Response) => {
    try {
      const { coin } = req.params as any as { coin: string };
      const { reason, price } = req.body;

      const updated = BotStateRepository.markSold(
        coin.toUpperCase(),
        reason,
        price
      );

      if (!updated) {
        return res.status(404).json({
          success: false,
          error: `Coin ${coin} not found`,
        });
      }

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark as sold',
      });
    }
  }
);

// ─── REAL-TIME PnL ─────────────────────────────────────────────

/**
 * GET /api/portfolio/pnl
 * Real-time PnL for ALL positions with live prices
 * Returns current price, entry price, PnL%, time held, etc.
 */
router.get('/portfolio/pnl', async (req: Request, res: Response) => {
  try {
    if (!exchangeService) {
      return res.status(503).json({ success: false, error: 'Exchange not connected' });
    }

    const allStates = BotStateRepository.getAll();
    const pnlData = [];

    for (const state of allStates) {
      const config = COIN_CONFIGS[state.coin as keyof typeof COIN_CONFIGS];
      if (!config) continue;

      let currentPrice = 0;
      let pnlPct = 0;
      let pnlUsd = 0;
      let hoursHeld = 0;
      let minutesSinceSell = -1;

      try {
        currentPrice = await exchangeService.getTicker(config.pair);
      } catch {
        // Price fetch failed, skip
      }

      if (state.status === 'COMPRADO' && state.entryPrice > 0 && currentPrice > 0) {
        pnlPct = ((currentPrice - state.entryPrice) / state.entryPrice) * 100;
        pnlUsd = (currentPrice - state.entryPrice) * (state.montoEntrada / state.entryPrice);

        if (state.entryTime) {
          hoursHeld = (Date.now() - new Date(state.entryTime).getTime()) / (1000 * 60 * 60);
        }
      }

      // Cooldown info
      if (state.lastSellTime) {
        minutesSinceSell = (Date.now() - new Date(state.lastSellTime).getTime()) / (1000 * 60);
      }

      pnlData.push({
        coin: state.coin,
        status: state.status,
        currentPrice,
        entryPrice: state.entryPrice,
        entryTime: state.entryTime,
        montoEntrada: state.montoEntrada,
        pnlPct: parseFloat(pnlPct.toFixed(4)),
        pnlUsd: parseFloat(pnlUsd.toFixed(4)),
        hoursHeld: parseFloat(hoursHeld.toFixed(2)),
        streakLosses: state.streakLosses,
        lastSellTime: state.lastSellTime,
        lastSellReason: state.lastSellReason,
        minutesSinceSell: minutesSinceSell >= 0 ? parseFloat(minutesSinceSell.toFixed(1)) : null,
        cooldownRemaining: minutesSinceSell >= 0 && minutesSinceSell < 15
          ? parseFloat((15 - minutesSinceSell).toFixed(1))
          : 0,
      });
    }

    // Summary
    const activePositions = pnlData.filter(p => p.status === 'COMPRADO');
    const totalPnl = activePositions.reduce((sum, p) => sum + p.pnlPct, 0);
    const totalUsd = activePositions.reduce((sum, p) => sum + p.pnlUsd, 0);

    res.json({
      success: true,
      data: {
        positions: pnlData,
        summary: {
          activeCount: activePositions.length,
          totalPnlPct: parseFloat(totalPnl.toFixed(4)),
          totalPnlUsd: parseFloat(totalUsd.toFixed(4)),
          positionsInProfit: activePositions.filter(p => p.pnlPct > 0).length,
          positionsInLoss: activePositions.filter(p => p.pnlPct < 0).length,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get PnL',
    });
  }
});

/**
 * GET /api/portfolio/pnl/:coin
 * Real-time PnL for a specific coin
 */
router.get('/portfolio/pnl/:coin', async (req: Request, res: Response) => {
  try {
    const { coin } = req.params;
    const coinUpper = coin.toUpperCase();

    if (!exchangeService) {
      return res.status(503).json({ success: false, error: 'Exchange not connected' });
    }

    const state = BotStateRepository.getByCoin(coinUpper);
    if (!state) {
      return res.status(404).json({ success: false, error: `Coin ${coinUpper} not found` });
    }

    const config = COIN_CONFIGS[state.coin as keyof typeof COIN_CONFIGS];
    if (!config) {
      return res.status(400).json({ success: false, error: 'Invalid coin' });
    }

    let currentPrice = 0;
    try {
      currentPrice = await exchangeService.getTicker(config.pair);
    } catch {
      // Price fetch failed
    }

    let pnlPct = 0;
    let pnlUsd = 0;
    let hoursHeld = 0;

    if (state.status === 'COMPRADO' && state.entryPrice > 0 && currentPrice > 0) {
      pnlPct = ((currentPrice - state.entryPrice) / state.entryPrice) * 100;
      pnlUsd = (currentPrice - state.entryPrice) * (state.montoEntrada / state.entryPrice);

      if (state.entryTime) {
        hoursHeld = (Date.now() - new Date(state.entryTime).getTime()) / (1000 * 60 * 60);
      }
    }

    res.json({
      success: true,
      data: {
        coin: coinUpper,
        status: state.status,
        currentPrice,
        entryPrice: state.entryPrice,
        entryTime: state.entryTime,
        montoEntrada: state.montoEntrada,
        pnlPct: parseFloat(pnlPct.toFixed(4)),
        pnlUsd: parseFloat(pnlUsd.toFixed(4)),
        hoursHeld: parseFloat(hoursHeld.toFixed(2)),
        streakLosses: state.streakLosses,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get PnL',
    });
  }
});

export default router;
