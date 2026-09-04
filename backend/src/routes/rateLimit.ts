// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Rate Limit Admin Routes
// ═══════════════════════════════════════════════════════════════════
//
// GET  /api/ratelimit/status     — Current rate limit config
// POST /api/ratelimit/block      — Block an IP
// POST /api/ratelimit/unblock    — Unblock an IP
// GET  /api/ratelimit/blocked    — List blocked IPs
// ═══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../validation';
import { authenticate } from '../middleware/auth';
import {
  blockIP, unblockIP, getBlockedIPs,
} from '../middleware/security';
import { getRateLimitStore, cleanupAllRateLimits } from '../middleware/rateLimitStore';

const router = Router();

const BlockIPSchema = z.object({
  ip: z.string().min(1, 'IP address required'),
});

const UnblockIPSchema = z.object({
  ip: z.string().min(1, 'IP address required'),
});

/**
 * GET /api/ratelimit/status
 * Returns current rate limit configuration and blocked IPs
 */
router.get('/ratelimit/status', authenticate, (req: Request, res: Response) => {
  try {
    const isProd = process.env.NODE_ENV === 'production';

    res.json({
      success: true,
      data: {
        environment: process.env.NODE_ENV || 'development',
        limiters: {
          api: {
            windowMs: 60_000,
            max: isProd ? 100 : 1000,
            description: 'General API: requests per minute per IP',
          },
          auth: {
            windowMs: 60_000,
            max: isProd ? 5 : 50,
            description: 'Auth endpoints: login/register attempts per minute',
          },
          loginBurst: {
            windowMs: 900_000, // 15 min
            max: isProd ? 3 : 30,
            description: 'Login burst: attempts per 15 minutes per IP',
          },
          write: {
            windowMs: 60_000,
            max: isProd ? 30 : 300,
            description: 'Write operations: POST/PUT/DELETE per minute',
          },
          trading: {
            windowMs: 60_000,
            max: isProd ? 10 : 100,
            description: 'Trading actions: buy/sell per minute per user',
          },
          expensive: {
            windowMs: 60_000,
            max: isProd ? 5 : 30,
            description: 'Expensive ops: backtest/AI per minute per user',
          },
          perUser: {
            windowMs: 60_000,
            max: isProd ? 200 : 2000,
            description: 'Per-user: authenticated requests per minute',
          },
          push: {
            windowMs: 60_000,
            max: isProd ? 10 : 100,
            description: 'Push notifications: per minute',
          },
        },
        store: {
          type: getRateLimitStore() ? 'SQLite (persistent)' : 'In-memory (resets on restart)',
          totalKeys: getRateLimitStore()?.getKeyCount() || 0,
        },
        blockedIPs: getBlockedIPs(),
        totalBlocked: getBlockedIPs().length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get rate limit status',
    });
  }
});

/**
 * POST /api/ratelimit/block
 * Block an IP address
 */
router.post('/ratelimit/block', authenticate, validateBody(BlockIPSchema), (req: Request, res: Response) => {
  try {
    const { ip } = req.body;
    blockIP(ip);

    res.json({
      success: true,
      data: {
        message: `IP ${ip} has been blocked`,
        blockedIPs: getBlockedIPs(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to block IP',
    });
  }
});

/**
 * POST /api/ratelimit/unblock
 * Unblock an IP address
 */
router.post('/ratelimit/unblock', authenticate, validateBody(UnblockIPSchema), (req: Request, res: Response) => {
  try {
    const { ip } = req.body;
    unblockIP(ip);

    res.json({
      success: true,
      data: {
        message: `IP ${ip} has been unblocked`,
        blockedIPs: getBlockedIPs(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to unblock IP',
    });
  }
});

/**
 * GET /api/ratelimit/blocked
 * List all blocked IPs
 */
router.get('/ratelimit/blocked', authenticate, (req: Request, res: Response) => {
  try {
    const blocked = getBlockedIPs();

    res.json({
      success: true,
      data: {
        ips: blocked,
        count: blocked.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list blocked IPs',
    });
  }
});

/**
 * POST /api/ratelimit/cleanup
 * Force cleanup of expired rate limit entries
 */
router.post('/ratelimit/cleanup', authenticate, (req: Request, res: Response) => {
  try {
    const cleaned = cleanupAllRateLimits();

    res.json({
      success: true,
      data: {
        message: `Cleaned ${cleaned} expired entries`,
        cleaned,
        remainingKeys: getRateLimitStore()?.getKeyCount() || 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cleanup',
    });
  }
});

export default router;
