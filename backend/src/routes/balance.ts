// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Balance Routes
// ═══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';

const router = Router();

// Reference to exchange service (set at startup)
let exchangeService: any = null;

/**
 * Set the exchange service reference
 * Called from index.ts during startup
 */
export function setExchangeService(exchange: any) {
  exchangeService = exchange;
}

/**
 * GET /api/balance
 * Get USDT balance and per-coin balances
 */
router.get('/balance', async (req: Request, res: Response) => {
  try {
    if (!exchangeService) {
      return res.json({
        success: true,
        data: {
          usdt_free: 0,
          usdt_total: 0,
          message: 'Exchange not connected',
        },
      });
    }

    const balance = await exchangeService.getBalance();

    res.json({
      success: true,
      data: balance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch balance',
    });
  }
});

/**
 * GET /api/balance/summary
 * Get balance summary with total portfolio value
 */
router.get('/balance/summary', async (req: Request, res: Response) => {
  try {
    if (!exchangeService) {
      return res.json({
        success: true,
        data: { usdt_free: 0, usdt_total: 0, coins: [], total: 0 },
      });
    }

    const balance = await exchangeService.getBalance() as any;

    // Extract coin balances
    const coins = Object.entries(balance)
      .filter(([key]) => key !== 'usdt_free' && key !== 'usdt_total' && key.endsWith('_free'))
      .map(([key, free]) => {
        const symbol = key.replace('_free', '').toUpperCase();
        const totalKey = `${symbol.toLowerCase()}_total`;
        return {
          symbol,
          free: Number(free) || 0,
          total: Number(balance[totalKey]) || 0,
        };
      })
      .filter((c) => c.free > 0 || c.total > 0);

    res.json({
      success: true,
      data: {
        usdt_free: balance.usdt_free || 0,
        usdt_total: balance.usdt_total || 0,
        coins,
        total: (balance.usdt_total || 0),
        coinCount: coins.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch balance summary',
    });
  }
});

export default router;
