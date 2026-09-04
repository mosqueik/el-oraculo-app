// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Alert Config Routes (Profit/Loss Thresholds)
// ═══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AlertRepository } from '../database/repositories';
import { alertService } from '../modules/alerts/service';
import { logger } from '../utils/logger';

const router = Router();

// ─── ALERT CONFIG CRUD ──────────────────────────────────────────

/**
 * GET /api/alerts
 * Get all alert configs
 */
router.get('/alerts', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const alerts = AlertRepository.getAll();
    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get alerts' });
  }
});

/**
 * GET /api/alerts/:coin
 * Get alert configs for a specific coin
 */
router.get('/alerts/:coin', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { coin } = req.params;
    const alerts = AlertRepository.getByCoin(coin.toUpperCase());
    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get alerts' });
  }
});

/**
 * POST /api/alerts
 * Create a new alert config
 */
router.post('/alerts', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { coin, alertType, threshold, cooldownMinutes } = req.body;

    if (!coin || !alertType || threshold === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: coin, alertType, threshold',
      });
    }

    const validTypes = ['profit_pct', 'loss_pct', 'profit_usdt', 'loss_usdt', 'price_above', 'price_below'];
    if (!validTypes.includes(alertType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid alertType. Valid: ${validTypes.join(', ')}`,
      });
    }

    const validCoins = ['BTC', 'ETH', 'SOL', 'BNB', 'AVAX', 'POL', 'SUI', 'LINK', 'NEAR', 'DOGE'];
    if (!validCoins.includes(coin.toUpperCase())) {
      return res.status(400).json({ success: false, error: 'Invalid coin' });
    }

    const alert = AlertRepository.create({
      userId: req.user?.id || null,
      coin: coin.toUpperCase(),
      alertType,
      threshold: parseFloat(threshold),
      enabled: true,
      triggered: false,
      cooldownMinutes: cooldownMinutes || 60,
    });

    logger.info(`🔔 Alert created: ${coin.toUpperCase()} ${alertType} @ ${threshold}`);
    res.json({ success: true, data: alert });
  } catch (error) {
    logger.error('Create alert error:', error);
    res.status(500).json({ success: false, error: 'Failed to create alert' });
  }
});

/**
 * PUT /api/alerts/:id
 * Update an alert config
 */
router.put('/alerts/:id', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { threshold, enabled, cooldownMinutes } = req.body;

    const updated = AlertRepository.update(Number(id), {
      ...(threshold !== undefined && { threshold: parseFloat(threshold) }),
      ...(enabled !== undefined && { enabled }),
      ...(cooldownMinutes !== undefined && { cooldownMinutes }),
    });

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update alert' });
  }
});

/**
 * DELETE /api/alerts/:id
 * Delete an alert config
 */
router.delete('/alerts/:id', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = AlertRepository.delete(Number(id));

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete alert' });
  }
});

/**
 * POST /api/alerts/check
 * Manually trigger alert check
 */
router.post('/alerts/check', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await alertService.checkAlerts();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Alert check failed' });
  }
});

/**
 * GET /api/alerts/history
 * Get alert trigger history
 */
router.get('/alerts/history/all', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const history = AlertRepository.getHistory(limit);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get alert history' });
  }
});

/**
 * GET /api/alerts/history/:coin
 * Get alert history for a coin
 */
router.get('/alerts/history/:coin', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { coin } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const history = AlertRepository.getHistoryByCoin(coin.toUpperCase(), limit);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get alert history' });
  }
});

/**
 * GET /api/alerts/summary/:coin
 * Get alert summary for a coin
 */
router.get('/alerts/summary/:coin', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { coin } = req.params;
    const summary = alertService.getAlertSummary(coin.toUpperCase());
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get alert summary' });
  }
});

export default router;
