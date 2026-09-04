// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Data Export Routes (CSV / JSON)
// ═══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { TradeLogRepository, ExecutionRepository } from '../database/repositories';
import { LearningService } from '../modules/learning/service';

const router = Router();
const learningService = new LearningService();

// ─── Helpers ──────────────────────────────────────────────────

function tradesToCSV(trades: any[]): string {
  const headers = [
    'ID', 'Coin', 'Action', 'Price', 'Monto', 'RSI', 'ADX',
    'Direction', 'Entry Price', 'Entry Time', 'PnL', 'Reason', 'Timestamp',
  ];

  const rows = trades.map(t => [
    t.id,
    t.coin,
    t.decision,
    t.precio?.toFixed(6) || '',
    t.monto?.toFixed(2) || '',
    t.rsi?.toFixed(2) || '',
    t.adx?.toFixed(2) || '',
    t.direction || '',
    t.entryPrice?.toFixed(6) || '',
    t.entryTime || '',
    t.pnl || '',
    `"${(t.motivo || '').replace(/"/g, '""')}"`,
    t.timestamp || '',
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

function executionsToCSV(executions: any[]): string {
  const headers = ['ID', 'Coin', 'Status', 'Decision', 'Reason', 'Monto', 'Entry Price', 'Score', 'RSI', 'ADX', 'Error', 'Timestamp'];

  const rows = executions.map(e => [
    e.id,
    e.coin,
    e.status,
    e.decision || '',
    `"${(e.motivo || '').replace(/"/g, '""')}"`,
    e.monto?.toFixed(2) || '',
    e.entryPrice?.toFixed(6) || '',
    e.score?.toFixed(2) || '',
    e.rsi?.toFixed(2) || '',
    e.adx?.toFixed(2) || '',
    `"${(e.error || '').replace(/"/g, '""')}"`,
    e.timestamp || '',
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

function performanceToJSON(): object {
  const summary = learningService.getOverallSummary();
  const coinAnalyses = summary.coinPerformance
    .filter(c => c.trades > 0)
    .map(c => {
      const analysis = learningService.analyzeCoin(c.coin as any);
      return {
        coin: c.coin,
        trades: c.trades,
        winRate: c.winRate,
        totalPnl: c.pnl,
        avgPnl: analysis.avgPnl,
        bestPnl: analysis.bestPnl,
        worstPnl: analysis.worstPnl,
        commonMotivos: analysis.commonMotivos,
        patterns: analysis.patterns,
      };
    });

  return {
    exportedAt: new Date().toISOString(),
    summary: {
      totalTrades: summary.totalTrades,
      totalWins: summary.totalWins,
      totalLosses: summary.totalLosses,
      overallWinRate: summary.overallWinRate,
    },
    coinPerformance: coinAnalyses,
  };
}

// ─── Routes ───────────────────────────────────────────────────

/**
 * GET /api/export/trades
 * Export trade history as CSV or JSON
 */
router.get('/export/trades', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const format = (req.query.format as string) || 'json';
    const coin = req.query.coin as string | undefined;
    const limit = parseInt(req.query.limit as string) || 1000;

    let trades;
    if (coin) {
      trades = TradeLogRepository.getByCoin(coin.toUpperCase(), limit);
    } else {
      trades = TradeLogRepository.getAll(limit);
    }

    if (format === 'csv') {
      const csv = tradesToCSV(trades);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="trades_${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csv);
    }

    // JSON format
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="trades_${new Date().toISOString().split('T')[0]}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      count: trades.length,
      trades,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
    });
  }
});

/**
 * GET /api/export/executions
 * Export execution log as CSV or JSON
 */
router.get('/export/executions', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const format = (req.query.format as string) || 'json';
    const limit = parseInt(req.query.limit as string) || 1000;
    const executions = ExecutionRepository.getAll(limit);

    if (format === 'csv') {
      const csv = executionsToCSV(executions);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="executions_${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csv);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="executions_${new Date().toISOString().split('T')[0]}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      count: executions.length,
      executions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
    });
  }
});

/**
 * GET /api/export/performance
 * Export full performance report as JSON
 */
router.get('/export/performance', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const performance = performanceToJSON();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="performance_${new Date().toISOString().split('T')[0]}.json"`);
    res.json(performance);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
    });
  }
});

/**
 * GET /api/export/all
 * Export everything (trades + executions + performance) as JSON
 */
router.get('/export/all', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const trades = TradeLogRepository.getAll(10000);
    const executions = ExecutionRepository.getAll(10000);
    const performance = performanceToJSON();

    const exportData = {
      exportedAt: new Date().toISOString(),
      app: 'El Oráculo Trading Bot',
      version: '1.0.0',
      trades: {
        count: trades.length,
        data: trades,
      },
      executions: {
        count: executions.length,
        data: executions,
      },
      performance,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="el_oraculo_export_${new Date().toISOString().split('T')[0]}.json"`);
    res.json(exportData);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
    });
  }
});

// ─── Obsidian Markdown Export ─────────────────────────────────

function tradesToObsidian(trades: any[]): string {
  const lines: string[] = [];
  lines.push('---');
  lines.push('title: El Oráculo — Trade Journal');
  lines.push(`date: ${new Date().toISOString().split('T')[0]}`);
  lines.push('tags: [trading, crypto, journal]');
  lines.push('---');
  lines.push('');
  lines.push('# 📊 Trade Journal — El Oráculo');
  lines.push('');
  lines.push(`> Exported: ${new Date().toISOString()}`);
  lines.push(`> Total trades: ${trades.length}`);
  lines.push('');

  // Group by coin
  const byCoin = new Map<string, any[]>();
  for (const t of trades) {
    const arr = byCoin.get(t.coin) || [];
    arr.push(t);
    byCoin.set(t.coin, arr);
  }

  for (const [coin, coinTrades] of byCoin) {
    const wins = coinTrades.filter(t => t.pnl && !t.pnl.startsWith('-')).length;
    const winRate = coinTrades.length > 0 ? ((wins / coinTrades.length) * 100).toFixed(1) : '0';

    lines.push(`## ${coin}`);
    lines.push('');
    lines.push(`- **Trades:** ${coinTrades.length}`);
    lines.push(`- **Win Rate:** ${winRate}%`);
    lines.push('');

    lines.push('| Date | Action | Price | Amount | RSI | ADX | PnL | Reason |');
    lines.push('|------|--------|-------|--------|-----|-----|-----|--------|');

    for (const t of coinTrades) {
      const date = t.timestamp ? new Date(t.timestamp).toLocaleDateString() : '-';
      const action = t.decision === 'COMPRAR' ? '🟢 BUY' : '🔴 SELL';
      const price = t.precio ? `$${Number(t.precio).toFixed(2)}` : '-';
      const monto = t.monto ? `$${Number(t.monto).toFixed(2)}` : '-';
      const rsi = t.rsi ? Number(t.rsi).toFixed(1) : '-';
      const adx = t.adx ? Number(t.adx).toFixed(1) : '-';
      const pnl = t.pnl || '-';
      const reason = t.motivo ? t.motivo.substring(0, 40) : '-';
      lines.push(`| ${date} | ${action} | ${price} | ${monto} | ${rsi} | ${adx} | ${pnl} | ${reason} |`);
    }
    lines.push('');
  }

  // Summary
  const totalWins = trades.filter(t => t.pnl && !t.pnl.startsWith('-')).length;
  const totalLosses = trades.filter(t => t.pnl && t.pnl.startsWith('-')).length;
  lines.push('## 📈 Summary');
  lines.push('');
  lines.push(`- **Total Trades:** ${trades.length}`);
  lines.push(`- **Wins:** ${totalWins}`);
  lines.push(`- **Losses:** ${totalLosses}`);
  lines.push(`- **Win Rate:** ${trades.length > 0 ? ((totalWins / trades.length) * 100).toFixed(1) : 0}%`);
  lines.push('');
  lines.push('---');
  lines.push('*Generated by El Oráculo 🪙*');

  return lines.join('\n');
}

/**
 * GET /api/export/obsidian
 * Export trades as Obsidian-compatible Markdown with frontmatter
 */
router.get('/export/obsidian', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const coin = req.query.coin as string | undefined;
    const limit = parseInt(req.query.limit as string) || 1000;

    let trades;
    if (coin) {
      trades = TradeLogRepository.getByCoin(coin.toUpperCase(), limit);
    } else {
      trades = TradeLogRepository.getAll(limit);
    }

    const markdown = tradesToObsidian(trades);

    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="trading-journal-${new Date().toISOString().split('T')[0]}.md"`);
    res.send(markdown);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
    });
  }
});

export default router;
