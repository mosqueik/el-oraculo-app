// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Monitoring Service
// System stats, error tracking, performance metrics, alerts
// ═══════════════════════════════════════════════════════════════════

import { logger, getLoggerStats } from '../../utils/logger';
import { ExecutionRepository, TradeLogRepository, BotStateRepository } from '../../database/repositories';

// ─── Types ──────────────────────────────────────────────────────
export interface SystemStats {
  uptime: number;
  uptimeFormatted: string;
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  process: {
    pid: number;
    platform: string;
    nodeVersion: string;
    env: string;
  };
}

export interface ErrorStats {
  totalErrors: number;
  errorsLastHour: number;
  errorsLast24h: number;
  recentErrors: Array<{
    coin: string;
    error: string;
    timestamp: string;
  }>;
}

export interface TradingStats {
  totalTrades: number;
  tradesLast24h: number;
  activePositions: number;
  totalCoins: number;
  executionsToday: number;
  successRate: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, { status: string; message?: string; duration?: number }>;
  timestamp: string;
}

// ─── Alert Thresholds ───────────────────────────────────────────
const ALERT_THRESHOLDS = {
  ERROR_RATE_HIGH: 10,      // errors per hour
  MEMORY_HIGH_PERCENT: 85,  // % of heap used
  UPTIME_LOW_SECONDS: 60,   // restart detection
  TRADE_FAILURE_RATE: 0.3,  // 30% failure rate
};

// ─── Monitoring Service ─────────────────────────────────────────
export class MonitoringService {
  private startTime: number = Date.now();
  private errorBuffer: Array<{ timestamp: string; level: string; message: string }> = [];
  private readonly ERROR_BUFFER_MAX = 100;

  constructor() {
    // Capture uncaught errors for tracking
    process.on('uncaughtException', (error) => {
      this.trackError(error);
    });

    process.on('unhandledRejection', (reason) => {
      if (reason instanceof Error) {
        this.trackError(reason);
      }
    });
  }

  /**
   * Get system statistics
   */
  getSystemStats(): SystemStats {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();

    return {
      uptime: process.uptime(),
      uptimeFormatted: this.formatUptime(process.uptime()),
      memory: {
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        rss: mem.rss,
        external: mem.external,
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100,
        rssMB: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
      },
      cpu: {
        user: cpu.user,
        system: cpu.system,
      },
      process: {
        pid: process.pid,
        platform: process.platform,
        nodeVersion: process.version,
        env: process.env.NODE_ENV || 'development',
      },
    };
  }

  /**
   * Get error statistics
   */
  getErrorStats(): ErrorStats {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const errorsLastHour = ExecutionRepository.getErrorCount(1);
    const errorsLast24h = ExecutionRepository.getErrorCount(24);
    const recentErrors = ExecutionRepository.getByStatus('error', 10);

    // Estimate total errors from recent data
    const totalErrors = errorsLast24h * 7; // Rough weekly estimate

    return {
      totalErrors,
      errorsLastHour,
      errorsLast24h,
      recentErrors: recentErrors.map((e) => ({
        coin: e.coin,
        error: e.error || 'Unknown error',
        timestamp: e.timestamp,
      })),
    };
  }

  /**
   * Get trading statistics
   */
  getTradingStats(): TradingStats {
    const totalTrades = TradeLogRepository.getCount();
    const tradesLast24h = TradeLogRepository.getRecent(24).length;
    const activePositions = BotStateRepository.getActivePositions().length;
    const executionsToday = ExecutionRepository.getRecent(24).length;

    // Calculate success rate
    const recentExecutions = ExecutionRepository.getRecent(24);
    const successfulExecutions = recentExecutions.filter((e) => e.status === 'success').length;
    const successRate = recentExecutions.length > 0
      ? (successfulExecutions / recentExecutions.length) * 100
      : 100;

    return {
      totalTrades,
      tradesLast24h,
      activePositions,
      totalCoins: 10, // ACTIVE_COINS.length
      executionsToday,
      successRate: Math.round(successRate * 100) / 100,
    };
  }

  /**
   * Get comprehensive health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const checks: Record<string, { status: string; message?: string; duration?: number }> = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // ─── Database Check ──────────────────────────────────────
    const dbStart = Date.now();
    try {
      const { getDatabase } = require('../../database/connection');
      const db = getDatabase();
      db.sqlite.prepare('SELECT 1').get();
      checks.database = {
        status: 'healthy',
        duration: Date.now() - dbStart,
      };
    } catch (error) {
      checks.database = {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'DB connection failed',
        duration: Date.now() - dbStart,
      };
      overallStatus = 'unhealthy';
    }

    // ─── Memory Check ────────────────────────────────────────
    const mem = process.memoryUsage();
    const heapUsedPercent = (mem.heapUsed / mem.heapTotal) * 100;

    if (heapUsedPercent > ALERT_THRESHOLDS.MEMORY_HIGH_PERCENT) {
      checks.memory = {
        status: 'degraded',
        message: `Heap usage at ${heapUsedPercent.toFixed(1)}%`,
      };
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    } else {
      checks.memory = {
        status: 'healthy',
        message: `${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
      };
    }

    // ─── Error Rate Check ────────────────────────────────────
    const errorsLastHour = ExecutionRepository.getErrorCount(1);
    if (errorsLastHour > ALERT_THRESHOLDS.ERROR_RATE_HIGH) {
      checks.errorRate = {
        status: 'degraded',
        message: `${errorsLastHour} errors in last hour`,
      };
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    } else {
      checks.errorRate = {
        status: 'healthy',
        message: `${errorsLastHour} errors in last hour`,
      };
    }

    // ─── Uptime Check ────────────────────────────────────────
    const uptime = process.uptime();
    if (uptime < ALERT_THRESHOLDS.UPTIME_LOW_SECONDS) {
      checks.uptime = {
        status: 'degraded',
        message: `Recently restarted (${Math.round(uptime)}s ago)`,
      };
    } else {
      checks.uptime = {
        status: 'healthy',
        message: this.formatUptime(uptime),
      };
    }

    // ─── Trade Success Rate ──────────────────────────────────
    const tradingStats = this.getTradingStats();
    if (tradingStats.successRate < (1 - ALERT_THRESHOLDS.TRADE_FAILURE_RATE) * 100) {
      checks.trading = {
        status: 'degraded',
        message: `Success rate: ${tradingStats.successRate}%`,
      };
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    } else {
      checks.trading = {
        status: 'healthy',
        message: `Success rate: ${tradingStats.successRate}%`,
      };
    }

    return {
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get monitoring summary (all stats combined)
   */
  getMonitoringSummary(): {
    system: SystemStats;
    errors: ErrorStats;
    trading: TradingStats;
    logger: ReturnType<typeof getLoggerStats>;
  } {
    return {
      system: this.getSystemStats(),
      errors: this.getErrorStats(),
      trading: this.getTradingStats(),
      logger: getLoggerStats(),
    };
  }

  /**
   * Track an error for alerting
   */
  private trackError(error: Error): void {
    this.errorBuffer.push({
      timestamp: new Date().toISOString(),
      level: 'error',
      message: error.message,
    });

    // Trim buffer
    if (this.errorBuffer.length > this.ERROR_BUFFER_MAX) {
      this.errorBuffer = this.errorBuffer.slice(-this.ERROR_BUFFER_MAX);
    }

    // Check if we should alert
    this.checkAlertConditions();
  }

  /**
   * Check if alert conditions are met
   */
  private checkAlertConditions(): void {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    // Count recent errors
    const recentErrors = this.errorBuffer.filter(
      (e) => new Date(e.timestamp).getTime() > fiveMinutesAgo
    );

    // High error rate alert
    if (recentErrors.length >= 5) {
      logger.warn(`🚨 ALERT: ${recentErrors.length} errors in last 5 minutes`);
      // In production, this would send a Telegram/email alert
    }
  }

  /**
   * Format uptime as human readable
   */
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
}

// ─── Singleton ──────────────────────────────────────────────────
let monitoringService: MonitoringService | null = null;

export function getMonitoringService(): MonitoringService {
  if (!monitoringService) {
    monitoringService = new MonitoringService();
  }
  return monitoringService;
}
