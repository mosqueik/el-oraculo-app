// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Trades Routes (with Zod Validation)
// ═══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { TradeLogRepository } from '../database/repositories';
import {
  validateQuery,
  validateParams,
  TradesQuerySchema,
  TradesRecentQuerySchema,
  TradesCoinParamsSchema,
  TradesCoinQuerySchema,
  TradesActionParamsSchema,
} from '../validation';

const router = Router();

/**
 * GET /api/trades
 * Get all trades with optional pagination
 */
router.get('/trades', validateQuery(TradesQuerySchema), (req: Request, res: Response) => {
  try {
    const { limit, offset } = req.query as any as { limit: number; offset: number };

    const trades = TradeLogRepository.getAll(limit, offset);
    const total = TradeLogRepository.getCount();

    res.json({
      success: true,
      data: trades,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get trades',
    });
  }
});

/**
 * GET /api/trades/recent
 * Get trades from last N hours
 */
router.get('/trades/recent', validateQuery(TradesRecentQuerySchema), (req: Request, res: Response) => {
  try {
    const { hours } = req.query as any as { hours: number };
    const trades = TradeLogRepository.getRecent(hours);

    res.json({
      success: true,
      data: trades,
      hours,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get recent trades',
    });
  }
});

/**
 * GET /api/trades/:coin
 * Get trades for a specific coin
 */
router.get(
  '/trades/:coin',
  validateParams(TradesCoinParamsSchema),
  validateQuery(TradesCoinQuerySchema),
  (req: Request, res: Response) => {
    try {
      const { coin } = req.params as any as { coin: string };
      const { limit } = req.query as any as { limit: number };

      const trades = TradeLogRepository.getByCoin(coin.toUpperCase(), limit);

      res.json({
        success: true,
        data: trades,
        count: trades.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get trades for coin',
      });
    }
  }
);

/**
 * GET /api/trades/:coin/action/:action
 * Get trades by coin and action (COMPRAR/VENDER)
 */
router.get(
  '/trades/:coin/action/:action',
  validateParams(TradesActionParamsSchema),
  (req: Request, res: Response) => {
    try {
      const { coin, action } = req.params as any as { coin: string; action: string };
      const trades = TradeLogRepository.getByCoin(coin.toUpperCase(), 100);

      const filtered = trades.filter(
        (t) => t.decision === action.toUpperCase()
      );

      res.json({
        success: true,
        data: filtered,
        count: filtered.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get trades',
      });
    }
  }
);

export default router;
