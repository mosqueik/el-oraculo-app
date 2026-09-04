// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Prometheus Metrics Collector
// Collects and exposes system metrics in Prometheus format
// ═══════════════════════════════════════════════════════════════════

import { getDb } from '../../database/connection';
import { logger } from '../../utils/logger';

// ─── Metric Types ────────────────────────────────────────────────

interface GaugeMetric {
  name: string;
  help: string;
  value: number;
  labels?: Record<string, string>;
}

interface CounterMetric {
  name: string;
  help: string;
  value: number;
  labels?: Record<string, string>;
}

// ─── Metrics Collector ───────────────────────────────────────────

export class MetricsCollector {
  private static instance: MetricsCollector;
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private startTime: number = Date.now();

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  // ─── Counter Methods ─────────────────────────────────────────

  incrementCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  // ─── Gauge Methods ───────────────────────────────────────────

  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    this.gauges.set(key, value);
  }

  // ─── Histogram Methods ───────────────────────────────────────

  observeHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    // Keep only last 1000 values
    if (values.length > 1000) {
      values.shift();
    }
    this.histograms.set(key, values);
  }

  // ─── System Metrics ──────────────────────────────────────────

  collectSystemMetrics(): GaugeMetric[] {
    const mem = process.memoryUsage();
    const uptime = (Date.now() - this.startTime) / 1000;

    return [
      // Memory
      { name: 'nodejs_memory_heap_used_bytes', help: 'Heap used in bytes', value: mem.heapUsed },
      { name: 'nodejs_memory_heap_total_bytes', help: 'Heap total in bytes', value: mem.heapTotal },
      { name: 'nodejs_memory_rss_bytes', help: 'Resident Set Size in bytes', value: mem.rss },
      { name: 'nodejs_memory_external_bytes', help: 'External memory in bytes', value: mem.external },

      // Process
      { name: 'process_uptime_seconds', help: 'Process uptime in seconds', value: uptime },
      { name: 'process_cpu_usage_percent', help: 'CPU usage percentage', value: process.cpuUsage().user / 1000 },

      // Event Loop
      { name: 'nodejs_eventloop_lag_seconds', help: 'Event loop lag', value: this.getEventLoopLag() },
    ];
  }

  // ─── Database Metrics ────────────────────────────────────────

  collectDatabaseMetrics(): GaugeMetric[] {
    try {
      const db = getDb();

      // Get table row counts
      const tables = [
        'trade_log', 'execution_log', 'decision_snapshot', 'daily_summary',
        'bot_state', 'users', 'subscriptions', 'invoices', 'alert_config',
        'alert_history', 'notification_log', 'push_tokens', 'rate_limits',
      ];

      const metrics: GaugeMetric[] = [];

      for (const table of tables) {
        try {
          const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
          metrics.push({
            name: `db_${table}_rows`,
            help: `Number of rows in ${table}`,
            value: row.count,
          });
        } catch {
          // Table might not exist yet
        }
      }

      // Database file size
      try {
        const sizeRow = db.prepare(`SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()`).get() as { size: number };
        metrics.push({
          name: 'db_size_bytes',
          help: 'Database file size in bytes',
          value: sizeRow.size || 0,
        });
      } catch {
        // Ignore
      }

      // Rate limit entries
      try {
        const rlRow = db.prepare(`SELECT COUNT(*) as count FROM rate_limits`).get() as { count: number };
        metrics.push({
          name: 'rate_limit_active_keys',
          help: 'Number of active rate limit keys',
          value: rlRow.count,
        });
      } catch {
        // Ignore
      }

      return metrics;
    } catch {
      return [];
    }
  }

  // ─── Trading Metrics ─────────────────────────────────────────

  collectTradingMetrics(): GaugeMetric[] {
    try {
      const db = getDb();
      const metrics: GaugeMetric[] = [];

      // Today's trades
      const today = new Date().toISOString().split('T')[0];
      try {
        const tradesToday = db.prepare(
          `SELECT COUNT(*) as count FROM trade_log WHERE timestamp LIKE ?`
        ).get(`${today}%`) as { count: number };
        metrics.push({
          name: 'trades_today_total',
          help: 'Total trades executed today',
          value: tradesToday.count,
        });
      } catch { /* ignore */ }

      // Active positions
      try {
        const positions = db.prepare(
          `SELECT COUNT(*) as count FROM bot_state WHERE status = 'COMPRADO'`
        ).get() as { count: number };
        metrics.push({
          name: 'active_positions',
          help: 'Number of active positions',
          value: positions.count,
        });
      } catch { /* ignore */ }

      // Total PnL today
      try {
        const pnlToday = db.prepare(
          `SELECT SUM(CAST(pnl AS REAL)) as total FROM trade_log WHERE timestamp LIKE ? AND decision = 'VENDER'`
        ).get(`${today}%`) as { total: number };
        metrics.push({
          name: 'pnl_today_percent',
          help: 'Total PnL percentage today',
          value: pnlToday.total || 0,
        });
      } catch { /* ignore */ }

      // Win rate (last 30 days)
      try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const winRate = db.prepare(
          `SELECT 
            COUNT(CASE WHEN CAST(pnl AS REAL) > 0 THEN 1 END) as wins,
            COUNT(*) as total
          FROM trade_log 
          WHERE timestamp > ? AND decision = 'VENDER'`
        ).get(thirtyDaysAgo) as { wins: number; total: number };
        
        if (winRate.total > 0) {
          metrics.push({
            name: 'win_rate_30d',
            help: 'Win rate over last 30 days',
            value: (winRate.wins / winRate.total) * 100,
          });
        }
      } catch { /* ignore */ }

      return metrics;
    } catch {
      return [];
    }
  }

  // ─── Custom Counter Metrics ──────────────────────────────────

  collectCounterMetrics(): CounterMetric[] {
    const metrics: CounterMetric[] = [];

    for (const [key, value] of this.counters) {
      const [name, ...labelParts] = key.split('|');
      const labels: Record<string, string> = {};
      
      for (let i = 0; i < labelParts.length; i += 2) {
        if (labelParts[i] && labelParts[i + 1]) {
          labels[labelParts[i]] = labelParts[i + 1];
        }
      }

      metrics.push({
        name,
        help: `Counter: ${name}`,
        value,
        labels: Object.keys(labels).length > 0 ? labels : undefined,
      });
    }

    return metrics;
  }

  // ─── Histogram Metrics ───────────────────────────────────────

  collectHistogramMetrics(): Array<{ name: string; help: string; count: number; sum: number; avg: number; p50: number; p95: number; p99: number }> {
    const metrics: Array<{ name: string; help: string; count: number; sum: number; avg: number; p50: number; p95: number; p99: number }> = [];

    for (const [key, values] of this.histograms) {
      if (values.length === 0) continue;

      const sorted = [...values].sort((a, b) => a - b);
      const sum = sorted.reduce((a, b) => a + b, 0);

      metrics.push({
        name: key,
        help: `Histogram: ${key}`,
        count: sorted.length,
        sum,
        avg: sum / sorted.length,
        p50: this.percentile(sorted, 50),
        p95: this.percentile(sorted, 95),
        p99: this.percentile(sorted, 99),
      });
    }

    return metrics;
  }

  // ─── Format as Prometheus Text ───────────────────────────────

  formatPrometheusText(): string {
    const lines: string[] = [];

    // System metrics
    const systemMetrics = this.collectSystemMetrics();
    for (const m of systemMetrics) {
      lines.push(`# HELP ${m.name} ${m.help}`);
      lines.push(`# TYPE ${m.name} gauge`);
      lines.push(`${m.name} ${m.value}`);
    }

    // Database metrics
    const dbMetrics = this.collectDatabaseMetrics();
    for (const m of dbMetrics) {
      lines.push(`# HELP ${m.name} ${m.help}`);
      lines.push(`# TYPE ${m.name} gauge`);
      lines.push(`${m.name} ${m.value}`);
    }

    // Trading metrics
    const tradingMetrics = this.collectTradingMetrics();
    for (const m of tradingMetrics) {
      lines.push(`# HELP ${m.name} ${m.help}`);
      lines.push(`# TYPE ${m.name} gauge`);
      lines.push(`${m.name} ${m.value}`);
    }

    // Counter metrics
    const counterMetrics = this.collectCounterMetrics();
    for (const m of counterMetrics) {
      lines.push(`# HELP ${m.name} ${m.help}`);
      lines.push(`# TYPE ${m.name} counter`);
      if (m.labels) {
        const labelStr = Object.entries(m.labels).map(([k, v]) => `${k}="${v}"`).join(',');
        lines.push(`${m.name}{${labelStr}} ${m.value}`);
      } else {
        lines.push(`${m.name} ${m.value}`);
      }
    }

    // Histogram metrics
    const histMetrics = this.collectHistogramMetrics();
    for (const m of histMetrics) {
      lines.push(`# HELP ${m.name} ${m.help}`);
      lines.push(`# TYPE ${m.name} histogram`);
      lines.push(`${m.name}_count ${m.count}`);
      lines.push(`${m.name}_sum ${m.sum}`);
      lines.push(`${m.name}_avg ${m.avg}`);
      lines.push(`${m.name}_p50 ${m.p50}`);
      lines.push(`${m.name}_p95 ${m.p95}`);
      lines.push(`${m.name}_p99 ${m.p99}`);
    }

    return lines.join('\n') + '\n';
  }

  // ─── JSON Format (for dashboard) ─────────────────────────────

  formatJSON(): object {
    return {
      timestamp: new Date().toISOString(),
      uptime: (Date.now() - this.startTime) / 1000,
      system: this.collectSystemMetrics(),
      database: this.collectDatabaseMetrics(),
      trading: this.collectTradingMetrics(),
      counters: this.collectCounterMetrics(),
      histograms: this.collectHistogramMetrics(),
    };
  }

  // ─── Helper Methods ──────────────────────────────────────────

  private buildKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    const labelParts = Object.entries(labels).flat();
    return [name, ...labelParts].join('|');
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private getEventLoopLag(): number {
    const start = process.hrtime.bigint();
    return new Promise<number>((resolve) => {
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1e9;
        resolve(lag);
      });
    }) as any; // Sync fallback
  }
}

// Export singleton
export const metrics = MetricsCollector.getInstance();
