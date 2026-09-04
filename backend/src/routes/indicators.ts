// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Custom Indicator Builder Routes (Enterprise)
// ═══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { CustomIndicatorRepository } from '../database/repositories';
import { UserRepository } from '../database/repositories';
import { logger } from '../utils/logger';

const router = Router();

// ─── Middleware: Enterprise Plan Check ─────────────────────────
function requireEnterprise(req: AuthRequest, res: Response, next: Function): void {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  const user = UserRepository.getById(userId);
  if (!user || (user.plan !== 'enterprise' && user.plan !== 'pro')) {
    res.status(403).json({
      success: false,
      error: 'Custom indicators require Enterprise plan',
      upgradeUrl: '/subscription',
    });
    return;
  }

  next();
}

// ─── Indicator Templates ──────────────────────────────────────
const INDICATOR_TEMPLATES = [
  {
    id: 'rsi_divergence',
    name: 'RSI Divergence',
    description: 'Detects divergence between price and RSI',
    type: 'momentum',
    defaultFormula: {
      type: 'divergence',
      indicator: 'rsi',
      lookback: 14,
      minBars: 5,
    },
    defaultParameters: { period: 14, sensitivity: 3 },
  },
  {
    id: 'vwap_band',
    name: 'VWAP Bands',
    description: 'Volume-weighted average price with standard deviation bands',
    type: 'volatility',
    defaultFormula: {
      type: 'vwap_bands',
      stdDevMultiplier: 2,
    },
    defaultParameters: { period: 20, multiplier: 2 },
  },
  {
    id: 'ichimoku_cloud',
    name: 'Ichimoku Cloud',
    description: 'Japanese cloud indicator for trend and support/resistance',
    type: 'trend',
    defaultFormula: {
      type: 'ichimoku',
      tenkan: 9,
      kijun: 26,
      senkou: 52,
    },
    defaultParameters: { tenkan: 9, kijun: 26, senkou: 52 },
  },
  {
    id: 'macd_histogram',
    name: 'MACD Histogram',
    description: 'Moving Average Convergence Divergence histogram',
    type: 'momentum',
    defaultFormula: {
      type: 'macd',
      fast: 12,
      slow: 26,
      signal: 9,
    },
    defaultParameters: { fast: 12, slow: 26, signal: 9 },
  },
  {
    id: 'atr_trailing',
    name: 'ATR Trailing Stop',
    description: 'Average True Range based trailing stop loss',
    type: 'volatility',
    defaultFormula: {
      type: 'atr_trailing',
      period: 14,
      multiplier: 2,
    },
    defaultParameters: { period: 14, multiplier: 2 },
  },
  {
    id: 'volume_profile',
    name: 'Volume Profile',
    description: 'Volume distribution at price levels',
    type: 'volume',
    defaultFormula: {
      type: 'volume_profile',
      bins: 20,
      lookback: 100,
    },
    defaultParameters: { bins: 20, lookback: 100 },
  },
  {
    id: 'custom_sma_cross',
    name: 'SMA Cross',
    description: 'Custom SMA crossover with configurable periods',
    type: 'trend',
    defaultFormula: {
      type: 'sma_cross',
      fast: 10,
      slow: 50,
    },
    defaultParameters: { fast: 10, slow: 50 },
  },
  {
    id: 'bollinger_squeeze',
    name: 'Bollinger Squeeze',
    description: 'Detects low volatility squeeze before breakout',
    type: 'volatility',
    defaultFormula: {
      type: 'bollinger',
      period: 20,
      stdDev: 2,
      squeezeThreshold: 0.5,
    },
    defaultParameters: { period: 20, stdDev: 2, squeezeThreshold: 0.5 },
  },
];

// ─── Routes ───────────────────────────────────────────────────

/**
 * GET /api/indicators/templates
 * Get available indicator templates
 */
router.get('/indicators/templates', authenticate, (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: INDICATOR_TEMPLATES });
});

/**
 * GET /api/indicators/custom
 * Get user's custom indicators
 */
router.get('/indicators/custom', authenticate, requireEnterprise, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const indicators = CustomIndicatorRepository.getByUserId(userId);

    // Parse JSON fields
    const parsed = indicators.map(ind => ({
      ...ind,
      formula: ind.formula ? JSON.parse(ind.formula) : null,
      parameters: ind.parameters ? JSON.parse(ind.parameters) : null,
    }));

    res.json({ success: true, data: parsed });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get indicators',
    });
  }
});

/**
 * GET /api/indicators/custom/:id
 * Get a single custom indicator
 */
router.get('/indicators/custom/:id', authenticate, requireEnterprise, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const indicator = CustomIndicatorRepository.getById(Number(id));

    if (!indicator) {
      return res.status(404).json({ success: false, error: 'Indicator not found' });
    }

    // Check ownership
    if (indicator.userId !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Not your indicator' });
    }

    res.json({
      success: true,
      data: {
        ...indicator,
        formula: indicator.formula ? JSON.parse(indicator.formula) : null,
        parameters: indicator.parameters ? JSON.parse(indicator.parameters) : null,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get indicator',
    });
  }
});

/**
 * POST /api/indicators/custom
 * Create a new custom indicator
 */
router.post('/indicators/custom', authenticate, requireEnterprise, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, description, formula, type, timeframe, parameters } = req.body;

    if (!name || !formula || !type) {
      return res.status(400).json({
        success: false,
        error: 'name, formula, and type are required',
      });
    }

    // Validate type
    const validTypes = ['momentum', 'volatility', 'trend', 'volume', 'custom'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    const indicator = CustomIndicatorRepository.create({
      userId,
      name,
      description,
      formula: typeof formula === 'string' ? formula : JSON.stringify(formula),
      type,
      timeframe,
      parameters: parameters ? (typeof parameters === 'string' ? parameters : JSON.stringify(parameters)) : undefined,
    });

    logger.info(`📊 Custom indicator created: ${name} by user ${userId}`);

    res.status(201).json({
      success: true,
      data: {
        ...indicator,
        formula: JSON.parse(indicator.formula),
        parameters: indicator.parameters ? JSON.parse(indicator.parameters) : null,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create indicator',
    });
  }
});

/**
 * PUT /api/indicators/custom/:id
 * Update a custom indicator
 */
router.put('/indicators/custom/:id', authenticate, requireEnterprise, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const indicator = CustomIndicatorRepository.getById(Number(id));

    if (!indicator) {
      return res.status(404).json({ success: false, error: 'Indicator not found' });
    }

    if (indicator.userId !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Not your indicator' });
    }

    const { name, description, formula, type, timeframe, parameters, enabled } = req.body;

    const updated = CustomIndicatorRepository.update(Number(id), {
      name,
      description,
      formula: formula ? (typeof formula === 'string' ? formula : JSON.stringify(formula)) : undefined,
      type,
      timeframe,
      parameters: parameters ? (typeof parameters === 'string' ? parameters : JSON.stringify(parameters)) : undefined,
      enabled,
    });

    res.json({
      success: true,
      data: {
        ...updated,
        formula: updated.formula ? JSON.parse(updated.formula) : null,
        parameters: updated.parameters ? JSON.parse(updated.parameters) : null,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update indicator',
    });
  }
});

/**
 * DELETE /api/indicators/custom/:id
 * Delete a custom indicator
 */
router.delete('/indicators/custom/:id', authenticate, requireEnterprise, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const indicator = CustomIndicatorRepository.getById(Number(id));

    if (!indicator) {
      return res.status(404).json({ success: false, error: 'Indicator not found' });
    }

    if (indicator.userId !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Not your indicator' });
    }

    CustomIndicatorRepository.delete(Number(id));

    logger.info(`📊 Custom indicator deleted: ${indicator.name} by user ${req.user!.id}`);

    res.json({ success: true, message: 'Indicator deleted' });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete indicator',
    });
  }
});

/**
 * POST /api/indicators/custom/:id/test
 * Test a custom indicator with sample data
 */
router.post('/indicators/custom/:id/test', authenticate, requireEnterprise, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const indicator = CustomIndicatorRepository.getById(Number(id));

    if (!indicator) {
      return res.status(404).json({ success: false, error: 'Indicator not found' });
    }

    if (indicator.userId !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Not your indicator' });
    }

    const { prices, volumes } = req.body;

    if (!prices || !Array.isArray(prices)) {
      return res.status(400).json({ success: false, error: 'prices array is required' });
    }

    // Simple indicator evaluation (placeholder - real implementation would use the formula)
    const formula = JSON.parse(indicator.formula);
    const parameters = indicator.parameters ? JSON.parse(indicator.parameters) : {};

    // Generate mock result based on indicator type
    const result = {
      indicatorId: Number(id),
      name: indicator.name,
      type: indicator.type,
      inputPrices: prices.length,
      output: {
        signal: prices[prices.length - 1] > prices[prices.length - 2] ? 'BUY' : 'SELL',
        strength: Math.random() * 100,
        values: prices.slice(-10).map((p: number) => p * (0.98 + Math.random() * 0.04)),
      },
      testedAt: new Date().toISOString(),
    };

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to test indicator',
    });
  }
});

/**
 * GET /api/indicators/usage/:coin
 * Get indicator usage for a coin
 */
router.get('/indicators/usage/:coin', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { coin } = req.params;
    const usage = CustomIndicatorRepository.getUsageByCoin(coin.toUpperCase());
    res.json({ success: true, data: usage });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get usage',
    });
  }
});

/**
 * POST /api/indicators/usage
 * Set indicator usage (weight) for a coin
 */
router.post('/indicators/usage', authenticate, requireEnterprise, (req: AuthRequest, res: Response) => {
  try {
    const { indicatorId, coin, weight, enabled } = req.body;

    if (!indicatorId || !coin) {
      return res.status(400).json({ success: false, error: 'indicatorId and coin are required' });
    }

    const result = CustomIndicatorRepository.setUsage(
      indicatorId,
      coin.toUpperCase(),
      weight ?? 1.0,
      enabled ?? true
    );

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set usage',
    });
  }
});

export default router;
