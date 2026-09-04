// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Bot Status Routes
// ═══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';

const router = Router();

// Reference to trading engine (set at startup)
let tradingEngine: any = null;
let scheduler: any = null;

/**
 * Set the trading engine and scheduler references
 * Called from index.ts during startup
 */
export function setEngineReferences(engine: any, sched: any) {
  tradingEngine = engine;
  scheduler = sched;
}

/**
 * GET /api/status
 * Get bot status (running, cycle count, uptime)
 */
router.get('/status', (req: Request, res: Response) => {
  try {
    if (!tradingEngine) {
      return res.json({
        success: true,
        data: {
          running: false,
          cycleCount: 0,
          uptime: process.uptime(),
          message: 'Trading engine not initialized',
        },
      });
    }

    const status = tradingEngine.getStatus();

    res.json({
      success: true,
      data: {
        ...status,
        uptimeFormatted: formatUptime(status.uptime),
        memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get status',
    });
  }
});

/**
 * POST /api/start
 * Start the trading bot
 */
router.post('/start', (req: Request, res: Response) => {
  try {
    if (!scheduler) {
      return res.status(503).json({
        success: false,
        error: 'Scheduler not initialized',
      });
    }

    scheduler.start();

    res.json({
      success: true,
      data: { message: 'Bot started', running: true },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start bot',
    });
  }
});

/**
 * POST /api/stop
 * Stop the trading bot
 */
router.post('/stop', (req: Request, res: Response) => {
  try {
    if (!scheduler) {
      return res.status(503).json({
        success: false,
        error: 'Scheduler not initialized',
      });
    }

    scheduler.stop();

    res.json({
      success: true,
      data: { message: 'Bot stopped', running: false },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to stop bot',
    });
  }
});

/**
 * POST /api/execute/:coin
 * Force execution for a specific coin
 */
router.post('/execute/:coin', (req: Request, res: Response) => {
  try {
    const { coin } = req.params;

    if (!tradingEngine) {
      return res.status(503).json({
        success: false,
        error: 'Trading engine not initialized',
      });
    }

    // Trigger immediate cycle (the engine will process all coins)
    tradingEngine.runCycle().catch((err: any) => {
      console.error('Manual execution error:', err);
    });

    res.json({
      success: true,
      data: { message: `Execution triggered for ${coin}`, coin },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute',
    });
  }
});

// ─── Helpers ──────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default router;
