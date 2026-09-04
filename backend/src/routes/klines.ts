// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Klines Routes (Chart Data)
// ═══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateParams, validateQuery, CoinSymbolSchema } from '../validation';

const router = Router();

// Reference to exchange service (set at startup)
let exchangeService: any = null;

export function setExchangeServiceForKlines(exchange: any) {
  exchangeService = exchange;
}

const KlinesQuerySchema = z.object({
  interval: z.enum(['15m', '1h', '4h', '1d']).default('15m'),
  limit: z.coerce.number().int().min(10).max(500).default(100),
});

/**
 * GET /api/klines/:coin
 * Get kline (candlestick) data for chart
 */
router.get(
  '/klines/:coin',
  validateParams(z.object({ coin: CoinSymbolSchema })),
  validateQuery(KlinesQuerySchema),
  async (req: Request, res: Response) => {
    try {
      if (!exchangeService) {
        return res.status(503).json({
          success: false,
          error: 'Exchange service not connected',
        });
      }

      const { coin } = req.params as any as { coin: string };
      const { interval, limit } = req.query as any as { interval: string; limit: number };

      const pair = `${coin.toUpperCase()}USDT`;
      const rawKlines = await exchangeService.getKlines(pair, interval, limit);

      // Transform to chart-friendly format
      const klines = rawKlines.map((k: any) => ({
        time: k.openTime || k[0],
        open: parseFloat(String(k.open ?? k[1])),
        high: parseFloat(String(k.high ?? k[2])),
        low: parseFloat(String(k.low ?? k[3])),
        close: parseFloat(String(k.close ?? k[4])),
        volume: parseFloat(String(k.volume ?? k[5])),
      }));

      res.json({
        success: true,
        data: {
          coin: coin.toUpperCase(),
          pair,
          interval,
          count: klines.length,
          klines,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch klines',
      });
    }
  }
);

export default router;
