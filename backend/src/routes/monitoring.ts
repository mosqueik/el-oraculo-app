// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Monitoring Routes
// ═══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getMonitoringService } from '../modules/monitoring/service';
import { validateQuery } from '../validation';

const router = Router();

// ─── Validation Schemas ────────────────────────────────────────
const HealthQuerySchema = z.object({
  detailed: z.coerce.boolean().default(false),
});

const LogsQuerySchema = z.object({
  type: z.enum(['error', 'combined', 'trading']).default('combined'),
  lines: z.coerce.number().int().min(1).max(1000).default(100),
  since: z.string().optional(), // ISO timestamp
  level: z.enum(['error', 'warn', 'info', 'debug']).optional(),
});

// ─── GET /api/monitoring/health ─────────────────────────────────
// Comprehensive health check with individual component status
router.get('/monitoring/health', async (req: Request, res: Response) => {
  try {
    const monitoring = getMonitoringService();
    const health = await monitoring.getHealthStatus();

    const statusCode = health.status === 'healthy' ? 200
      : health.status === 'degraded' ? 200  // Still operational
      : 503;  // Unhealthy

    res.status(statusCode).json({
      success: true,
      data: health,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Health check failed',
    });
  }
});

// ─── GET /api/monitoring/stats ──────────────────────────────────
// System statistics (memory, CPU, uptime)
router.get('/monitoring/stats', (req: Request, res: Response) => {
  try {
    const monitoring = getMonitoringService();
    const stats = monitoring.getMonitoringSummary();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get stats',
    });
  }
});

// ─── GET /api/monitoring/system ─────────────────────────────────
// System-level stats only
router.get('/monitoring/system', (req: Request, res: Response) => {
  try {
    const monitoring = getMonitoringService();
    const system = monitoring.getSystemStats();

    res.json({
      success: true,
      data: system,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get system stats',
    });
  }
});

// ─── GET /api/monitoring/errors ─────────────────────────────────
// Error statistics
router.get('/monitoring/errors', (req: Request, res: Response) => {
  try {
    const monitoring = getMonitoringService();
    const errors = monitoring.getErrorStats();

    res.json({
      success: true,
      data: errors,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get error stats',
    });
  }
});

// ─── GET /api/monitoring/trading ────────────────────────────────
// Trading statistics
router.get('/monitoring/trading', (req: Request, res: Response) => {
  try {
    const monitoring = getMonitoringService();
    const trading = monitoring.getTradingStats();

    res.json({
      success: true,
      data: trading,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get trading stats',
    });
  }
});

// ─── GET /api/monitoring/logs ───────────────────────────────────
// Read recent log entries
router.get('/monitoring/logs', validateQuery(LogsQuerySchema), (req: Request, res: Response) => {
  try {
    const { type, lines } = req.query as any;
    const fs = require('fs');
    const path = require('path');

    const logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
    const logFile = path.join(logDir, `${type}.log`);

    if (!fs.existsSync(logFile)) {
      return res.json({
        success: true,
        data: [],
        message: `No ${type} log file found`,
      });
    }

    // Read last N lines
    const content = fs.readFileSync(logFile, 'utf-8');
    const allLines = content.split('\n').filter((l: string) => l.trim());
    const recentLines = allLines.slice(-lines);

    res.json({
      success: true,
      data: {
        type,
        totalLines: allLines.length,
        returnedLines: recentLines.length,
        lines: recentLines,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read logs',
    });
  }
});

// ─── GET /api/monitoring/dashboard ──────────────────────────────
// All monitoring data in one call (for dashboard widgets)
router.get('/monitoring/dashboard', (req: Request, res: Response) => {
  try {
    const monitoring = getMonitoringService();

    const dashboard = {
      system: monitoring.getSystemStats(),
      trading: monitoring.getTradingStats(),
      errors: monitoring.getErrorStats(),
      logger: {
        level: process.env.LOG_LEVEL || 'info',
        logDir: process.env.LOG_DIR || 'logs',
      },
      timestamp: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get dashboard data',
    });
  }
});

export default router;
