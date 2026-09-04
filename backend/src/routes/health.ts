// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Health Check Route
// ═══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { getDatabase } from '../database/connection';
import { ExecutionRepository } from '../database/repositories';

const router = Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     tags: [System]
 *     summary: Health check
 *     description: Check API and database health status
 *     responses:
 *       200:
 *         description: System healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *                 database:
 *                   type: string
 *                   example: connected
 *                 recentErrors:
 *                   type: integer
 *                   description: Errors in last hour
 *       503:
 *         description: System unhealthy
 */
router.get('/health', (req: Request, res: Response) => {
  try {
    // Test database connection
    const db = getDatabase();
    db.sqlite.prepare('SELECT 1').get();

    // Get error count in last hour
    const recentErrors = ExecutionRepository.getErrorCount(1);

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      recentErrors,
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
