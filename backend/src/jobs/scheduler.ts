// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Scheduler (Cron Jobs)
// ═══════════════════════════════════════════════════════════════════

import cron from 'node-cron';
import { TradingEngine } from '../modules/trading/engine';
import { alertService } from '../modules/alerts/service';
import { cleanupAllRateLimits } from '../middleware/rateLimitStore';
import { analyzeTables } from '../database/indexes';
import { logger } from '../utils/logger';

export class Scheduler {
  private engine: TradingEngine;
  private tasks: cron.ScheduledTask[] = [];

  constructor(engine: TradingEngine) {
    this.engine = engine;
  }

  start(): void {
    // Run trading cycle every 5 minutes
    const tradingTask = cron.schedule('*/5 * * * *', async () => {
      try {
        await this.engine.runCycle();
      } catch (error) {
        logger.error('Trading cycle error:', error);
      }
    }, { scheduled: true, timezone: 'America/Argentina/Buenos_Aires' });

    // Check alerts every 60 seconds
    const alertTask = cron.schedule('* * * * *', async () => {
      try {
        const result = await alertService.checkAlerts();
        if (result.triggered) {
          logger.info(`🔔 ${result.alerts.length} alert(s) triggered`);
        }
      } catch (error) {
        logger.debug('Alert check error (suppressed)');
      }
    }, { scheduled: true, timezone: 'America/Argentina/Buenos_Aires' });

    // Reset triggered alerts daily at midnight
    const resetTask = cron.schedule('0 0 * * *', () => {
      try {
        const { AlertRepository } = require('../database/repositories');
        AlertRepository.resetTriggered();
        logger.info('🔔 Alert triggered status reset for new day');
      } catch (error) {
        logger.debug('Alert reset error (suppressed)');
      }
    }, { scheduled: true, timezone: 'America/Argentina/Buenos_Aires' });

    // Cleanup expired rate limit entries every 5 minutes
    const rateLimitCleanupTask = cron.schedule('*/5 * * * *', () => {
      try {
        const cleaned = cleanupAllRateLimits();
        if (cleaned > 0) {
          logger.debug(`🧹 Cleaned ${cleaned} expired rate limit entries`);
        }
      } catch (error) {
        logger.debug('Rate limit cleanup error (suppressed)');
      }
    }, { scheduled: true, timezone: 'America/Argentina/Buenos_Aires' });

    // Analyze tables daily at 3am for query optimization
    const analyzeTask = cron.schedule('0 3 * * *', () => {
      try {
        analyzeTables();
      } catch (error) {
        logger.debug('Analyze tables error (suppressed)');
      }
    }, { scheduled: true, timezone: 'America/Argentina/Buenos_Aires' });

    this.tasks.push(tradingTask, alertTask, resetTask, rateLimitCleanupTask, analyzeTask);
    logger.info('⏰ Scheduler started — trading every 5min, alerts every 60s, rate limit cleanup every 5min, analyze daily at 3am');
  }

  stop(): void {
    this.tasks.forEach(task => task.stop());
    logger.info('⏰ Scheduler stopped');
  }
}
