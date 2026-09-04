// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Executions Routes (with Zod Validation)
// ═══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { ExecutionRepository } from '../database/repositories';
import {
  validateQuery,
  validateParams,
  ExecutionsQuerySchema,
  ExecutionsRecentQuerySchema,
  ExecutionsErrorsQuerySchema,
  ExecutionsCoinParamsSchema,
  ExecutionsCoinQuerySchema,
  ExecutionsIdParamsSchema,
} from '../validation';

const router = Router();

/**
 * GET /api/executions
 * Get all executions with optional pagination
 */
router.get('/executions', validateQuery(ExecutionsQuerySchema), (req: Request, res: Response) => {
  try {
    const { limit, offset } = req.query as any as { limit: number; offset: number };

    const executions = ExecutionRepository.getAll(limit, offset);
    const total = ExecutionRepository.getCount();

    res.json({
      success: true,
      data: executions,
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
      error: error instanceof Error ? error.message : 'Failed to get executions',
    });
  }
});

/**
 * GET /api/executions/recent
 * Get executions from last N hours
 */
router.get('/executions/recent', validateQuery(ExecutionsRecentQuerySchema), (req: Request, res: Response) => {
  try {
    const { hours } = req.query as any as { hours: number };
    const executions = ExecutionRepository.getRecent(hours);

    res.json({
      success: true,
      data: executions,
      hours,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get recent executions',
    });
  }
});

/**
 * GET /api/executions/errors
 * Get recent errors
 */
router.get('/executions/errors', validateQuery(ExecutionsErrorsQuerySchema), (req: Request, res: Response) => {
  try {
    const { hours } = req.query as any as { hours: number };
    const errorCount = ExecutionRepository.getErrorCount(hours);
    const errors = ExecutionRepository.getByStatus('error', 50);

    res.json({
      success: true,
      data: errors,
      errorCount,
      hours,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get errors',
    });
  }
});

/**
 * GET /api/executions/:coin
 * Get executions for a specific coin
 */
router.get(
  '/executions/:coin',
  validateParams(ExecutionsCoinParamsSchema),
  validateQuery(ExecutionsCoinQuerySchema),
  (req: Request, res: Response) => {
    try {
      const { coin } = req.params as any as { coin: string };
      const { limit } = req.query as any as { limit: number };

      const executions = ExecutionRepository.getByCoin(coin.toUpperCase(), limit);

      res.json({
        success: true,
        data: executions,
        count: executions.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get executions for coin',
      });
    }
  }
);

/**
 * GET /api/executions/:id
 * Get execution by ID
 */
router.get('/executions/:id', validateParams(ExecutionsIdParamsSchema), (req: Request, res: Response) => {
  try {
    const { id } = req.params as any as { id: number };
    const execution = ExecutionRepository.getById(id);

    if (!execution) {
      return res.status(404).json({
        success: false,
        error: `Execution ${id} not found`,
      });
    }

    res.json({
      success: true,
      data: execution,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get execution',
    });
  }
});

export default router;
