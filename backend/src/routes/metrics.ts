// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Metrics Routes
// Prometheus-compatible metrics endpoint
// ═══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { metrics } from '../modules/monitoring/metrics';
import { getIndexStats } from '../database/indexes';
import { logger } from '../utils/logger';

const router = Router();

// ─── GET /api/metrics ────────────────────────────────────────────
// Prometheus text format (for scraping)
router.get('/', (req: Request, res: Response) => {
  try {
    const prometheusText = metrics.formatPrometheusText();
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(prometheusText);
  } catch (error) {
    logger.error('Metrics error:', error);
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
});

// ─── GET /api/metrics/json ───────────────────────────────────────
// JSON format (for dashboard/API consumption)
router.get('/json', (req: Request, res: Response) => {
  try {
    const jsonData = metrics.formatJSON();
    res.json(jsonData);
  } catch (error) {
    logger.error('Metrics JSON error:', error);
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
});

// ─── GET /api/metrics/system ─────────────────────────────────────
// System metrics only (memory, CPU, uptime)
router.get('/system', (req: Request, res: Response) => {
  try {
    const systemMetrics = metrics.collectSystemMetrics();
    res.json({
      timestamp: new Date().toISOString(),
      metrics: systemMetrics,
    });
  } catch (error) {
    logger.error('System metrics error:', error);
    res.status(500).json({ error: 'Failed to collect system metrics' });
  }
});

// ─── GET /api/metrics/database ───────────────────────────────────
// Database metrics (table sizes, row counts)
router.get('/database', (req: Request, res: Response) => {
  try {
    const dbMetrics = metrics.collectDatabaseMetrics();
    const indexStats = getIndexStats();
    res.json({
      timestamp: new Date().toISOString(),
      tables: dbMetrics,
      indexes: indexStats,
    });
  } catch (error) {
    logger.error('Database metrics error:', error);
    res.status(500).json({ error: 'Failed to collect database metrics' });
  }
});

// ─── GET /api/metrics/trading ────────────────────────────────────
// Trading metrics (trades today, PnL, win rate)
router.get('/trading', (req: Request, res: Response) => {
  try {
    const tradingMetrics = metrics.collectTradingMetrics();
    res.json({
      timestamp: new Date().toISOString(),
      metrics: tradingMetrics,
    });
  } catch (error) {
    logger.error('Trading metrics error:', error);
    res.status(500).json({ error: 'Failed to collect trading metrics' });
  }
});

// ─── GET /api/metrics/counters ───────────────────────────────────
// Application counters (API calls, trades, errors)
router.get('/counters', (req: Request, res: Response) => {
  try {
    const counters = metrics.collectCounterMetrics();
    res.json({
      timestamp: new Date().toISOString(),
      counters,
    });
  } catch (error) {
    logger.error('Counter metrics error:', error);
    res.status(500).json({ error: 'Failed to collect counter metrics' });
  }
});

// ─── GET /api/metrics/histograms ─────────────────────────────────
// Histogram metrics (latency, response times)
router.get('/histograms', (req: Request, res: Response) => {
  try {
    const histograms = metrics.collectHistogramMetrics();
    res.json({
      timestamp: new Date().toISOString(),
      histograms,
    });
  } catch (error) {
    logger.error('Histogram metrics error:', error);
    res.status(500).json({ error: 'Failed to collect histogram metrics' });
  }
});

// ─── POST /api/metrics/increment ─────────────────────────────────
// Manually increment a counter
router.post('/increment', (req: Request, res: Response) => {
  try {
    const { name, value, labels } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    metrics.incrementCounter(name, value || 1, labels);
    res.json({ ok: true, name, value: value || 1 });
  } catch (error) {
    logger.error('Increment counter error:', error);
    res.status(500).json({ error: 'Failed to increment counter' });
  }
});

// ─── POST /api/metrics/observe ───────────────────────────────────
// Manually observe a histogram value
router.post('/observe', (req: Request, res: Response) => {
  try {
    const { name, value, labels } = req.body;
    if (!name || value === undefined) {
      return res.status(400).json({ error: 'name and value are required' });
    }
    metrics.observeHistogram(name, value, labels);
    res.json({ ok: true, name, value });
  } catch (error) {
    logger.error('Observe histogram error:', error);
    res.status(500).json({ error: 'Failed to observe histogram' });
  }
});

export default router;
