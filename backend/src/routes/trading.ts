// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Trading Control & Analytics Routes
// ═══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { tradingLimiter, expensiveLimiter } from '../middleware/security';
import { aiService } from '../modules/ai/service';
import { LearningService } from '../modules/learning/service';
import {
  BotStateRepository,
  TradeLogRepository,
  ExecutionRepository,
} from '../database/repositories';
import { emitTradeExecuted } from '../ws/server';
import { logger } from '../utils/logger';

const router = Router();
const learningService = new LearningService();

// Reference to trading engine (set at startup)
let tradingEngine: any = null;
let exchangeService: any = null;

export function setTradingReferences(engine: any, exchange: any) {
  tradingEngine = engine;
  exchangeService = exchange;
}

// ─── EMERGENCY STOP ─────────────────────────────────────────────
/**
 * @swagger
 * /api/trading/emergency-sell/{coin}:
 *   post:
 *     tags: [Trading]
 *     summary: Emergency sell
 *     description: Immediately sell an active position at market price
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: coin
 *         required: true
 *         schema:
 *           type: string
 *         description: Coin symbol (BTC, ETH, SOL, etc.)
 *     responses:
 *       200:
 *         description: Position sold successfully
 *       400:
 *         description: No active position or invalid coin
 *       401:
 *         description: Unauthorized
 */
router.post('/trading/emergency-sell/:coin', authenticate, tradingLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { coin } = req.params;
    const validCoins = ['BTC', 'ETH', 'SOL', 'BNB', 'AVAX', 'POL', 'SUI', 'LINK', 'NEAR', 'DOGE'];

    if (!validCoins.includes(coin.toUpperCase())) {
      return res.status(400).json({ success: false, error: 'Invalid coin' });
    }

    const coinUpper = coin.toUpperCase() as any;
    const botState = BotStateRepository.getByCoin(coinUpper);

    if (!botState || botState.status !== 'COMPRADO') {
      return res.status(400).json({
        success: false,
        error: `No active position for ${coinUpper}`,
      });
    }

    // Execute emergency sell
    if (!exchangeService) {
      return res.status(503).json({ success: false, error: 'Exchange not available' });
    }

    const config = require('@el-oraculo/shared').COIN_CONFIGS[coinUpper];
    const balance = await exchangeService.getBalance();
    const coinBalance = (balance as any)[`${coin.toLowerCase()}_free`] || 0;

    if (coinBalance <= 0) {
      return res.status(400).json({ success: false, error: 'No balance to sell' });
    }

    const result = await exchangeService.marketSell(config.pair, coinBalance);
    const fillPrice = result.fills?.[0]?.price || 0;

    // Calculate PnL
    let pnl = '0%';
    if (botState.entryPrice > 0 && fillPrice > 0) {
      const pnlPct = ((fillPrice - botState.entryPrice) / botState.entryPrice) * 100;
      pnl = `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`;
    }

    // Log the trade
    TradeLogRepository.create({
      coin: coinUpper,
      decision: 'VENDER',
      motivo: '🚨 EMERGENCY SELL - Manual override',
      monto: botState.montoEntrada,
      precio: fillPrice,
      rsi: 0,
      adx: 0,
      direction: 'UNKNOWN',
      entryPrice: botState.entryPrice,
      entryTime: botState.entryTime,
      pnl,
      timestamp: new Date().toISOString(),
    });

    BotStateRepository.markSold(coinUpper, 'EMERGENCY SELL', fillPrice);

    // Emit WebSocket event
    emitTradeExecuted({
      coin: coinUpper,
      action: 'EMERGENCY_SELL',
      price: fillPrice,
      motivo: '🚨 EMERGENCY SELL - Manual override',
      timestamp: new Date().toISOString(),
    });

    logger.warn(`🚨 EMERGENCY SELL ${coinUpper}: ${coinBalance} @ $${fillPrice.toFixed(4)} (${pnl})`);

    res.json({
      success: true,
      data: {
        coin: coinUpper,
        action: 'EMERGENCY_SELL',
        quantity: coinBalance,
        price: fillPrice,
        pnl,
        motivo: 'Manual emergency sell',
      },
    });
  } catch (error) {
    logger.error('Emergency sell error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Emergency sell failed',
    });
  }
});

// ─── MANUAL BUY/SELL ───────────────────────────────────────────
/**
 * @swagger
 * /api/trading/manual-buy/{coin}:
 *   post:
 *     tags: [Trading]
 *     summary: Manual buy
 *     description: Manually buy a coin with specified USDT amount
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: coin
 *         required: true
 *         schema:
 *           type: string
 *         description: Coin symbol
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amountUsdt:
 *                 type: number
 *                 description: Amount in USDT to spend
 *                 example: 50
 *     responses:
 *       200:
 *         description: Buy executed
 *       400:
 *         description: Already holding or insufficient balance
 */
router.post('/trading/manual-buy/:coin', authenticate, tradingLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { coin } = req.params;
    const { amountUsdt } = req.body;
    const validCoins = ['BTC', 'ETH', 'SOL', 'BNB', 'AVAX', 'POL', 'SUI', 'LINK', 'NEAR', 'DOGE'];

    if (!validCoins.includes(coin.toUpperCase())) {
      return res.status(400).json({ success: false, error: 'Invalid coin' });
    }

    const coinUpper = coin.toUpperCase() as any;

    if (!exchangeService) {
      return res.status(503).json({ success: false, error: 'Exchange not available' });
    }

    // Check if already holding
    const botState = BotStateRepository.getByCoin(coinUpper);
    if (botState?.status === 'COMPRADO') {
      return res.status(400).json({
        success: false,
        error: `Already holding ${coinUpper}. Sell first before buying again.`,
      });
    }

    // Check USDT balance
    const balance = await exchangeService.getBalance();
    const usdtFree = (balance as any).usdt_free || 0;
    const requestedAmount = parseFloat(amountUsdt) || 50; // Default $50

    if (requestedAmount > usdtFree) {
      return res.status(400).json({
        success: false,
        error: `Insufficient USDT. Available: $${usdtFree.toFixed(2)}`,
      });
    }

    const config = require('@el-oraculo/shared').COIN_CONFIGS[coinUpper];
    const currentPrice = await exchangeService.getTicker(config.pair);
    const quantity = requestedAmount / currentPrice;

    // Execute buy
    const result = await exchangeService.marketBuy(config.pair, quantity);
    const fillPrice = result.fills?.[0]?.price || currentPrice;
    const filledQty = result.fills?.reduce((sum: number, f: any) => sum + parseFloat(String(f.qty)), 0) || quantity;
    const filledAmount = filledQty * fillPrice;

    // Update bot state
    BotStateRepository.markBought(coinUpper, fillPrice, filledAmount);

    // Log the trade
    TradeLogRepository.create({
      coin: coinUpper,
      decision: 'COMPRAR',
      motivo: '🖐️ MANUAL BUY - User initiated',
      monto: filledAmount,
      precio: fillPrice,
      rsi: 0,
      adx: 0,
      direction: 'UNKNOWN',
      entryPrice: fillPrice,
      entryTime: new Date().toISOString(),
      pnl: undefined,
      timestamp: new Date().toISOString(),
    });

    // Emit WebSocket event
    emitTradeExecuted({
      coin: coinUpper,
      action: 'COMPRAR',
      price: fillPrice,
      motivo: `🖐️ MANUAL BUY: $${filledAmount.toFixed(2)} @ $${fillPrice.toFixed(4)}`,
      timestamp: new Date().toISOString(),
    });

    logger.info(`🖐️ MANUAL BUY ${coinUpper}: ${filledQty.toFixed(8)} @ $${fillPrice.toFixed(4)} ($${filledAmount.toFixed(2)})`);

    res.json({
      success: true,
      data: {
        coin: coinUpper,
        action: 'BUY',
        quantity: filledQty,
        price: fillPrice,
        amountUsdt: filledAmount,
        motivo: 'Manual buy',
      },
    });
  } catch (error) {
    logger.error('Manual buy error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Manual buy failed',
    });
  }
});

/**
 * @swagger
 * /api/trading/manual-sell/{coin}:
 *   post:
 *     tags: [Trading]
 *     summary: Manual sell
 *     description: Manually sell an active position at market price
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: coin
 *         required: true
 *         schema:
 *           type: string
 *         description: Coin symbol
 *     responses:
 *       200:
 *         description: Sell executed with PnL
 *       400:
 *         description: No active position
 */
router.post('/trading/manual-sell/:coin', authenticate, tradingLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { coin } = req.params;
    const validCoins = ['BTC', 'ETH', 'SOL', 'BNB', 'AVAX', 'POL', 'SUI', 'LINK', 'NEAR', 'DOGE'];

    if (!validCoins.includes(coin.toUpperCase())) {
      return res.status(400).json({ success: false, error: 'Invalid coin' });
    }

    const coinUpper = coin.toUpperCase() as any;
    const botState = BotStateRepository.getByCoin(coinUpper);

    if (!botState || botState.status !== 'COMPRADO') {
      return res.status(400).json({
        success: false,
        error: `No active position for ${coinUpper}`,
      });
    }

    if (!exchangeService) {
      return res.status(503).json({ success: false, error: 'Exchange not available' });
    }

    const config = require('@el-oraculo/shared').COIN_CONFIGS[coinUpper];
    const balance = await exchangeService.getBalance();
    const coinBalance = (balance as any)[`${coin.toLowerCase()}_free`] || 0;

    if (coinBalance <= 0) {
      return res.status(400).json({ success: false, error: 'No balance to sell' });
    }

    // Execute sell
    const result = await exchangeService.marketSell(config.pair, coinBalance);
    const fillPrice = result.fills?.[0]?.price || 0;
    const filledQty = result.fills?.reduce((sum: number, f: any) => sum + parseFloat(String(f.qty)), 0) || coinBalance;
    const filledAmount = filledQty * fillPrice;

    // Calculate PnL
    let pnl = '0%';
    let pnlUsdt = 0;
    if (botState.entryPrice > 0 && fillPrice > 0) {
      const pnlPct = ((fillPrice - botState.entryPrice) / botState.entryPrice) * 100;
      pnl = `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`;
      pnlUsdt = (fillPrice - botState.entryPrice) * (botState.montoEntrada / botState.entryPrice);
    }

    // Update bot state
    BotStateRepository.markSold(coinUpper, 'MANUAL SELL', fillPrice);

    // Log the trade
    TradeLogRepository.create({
      coin: coinUpper,
      decision: 'VENDER',
      motivo: '🖐️ MANUAL SELL - User initiated',
      monto: botState.montoEntrada,
      precio: fillPrice,
      rsi: 0,
      adx: 0,
      direction: 'UNKNOWN',
      entryPrice: botState.entryPrice,
      entryTime: botState.entryTime,
      pnl,
      timestamp: new Date().toISOString(),
    });

    // Emit WebSocket event
    emitTradeExecuted({
      coin: coinUpper,
      action: 'VENDER',
      price: fillPrice,
      motivo: `🖐️ MANUAL SELL: ${pnl} ($${pnlUsdt.toFixed(2)})`,
      timestamp: new Date().toISOString(),
    });

    logger.info(`🖐️ MANUAL SELL ${coinUpper}: ${filledQty.toFixed(8)} @ $${fillPrice.toFixed(4)} (${pnl})`);

    res.json({
      success: true,
      data: {
        coin: coinUpper,
        action: 'SELL',
        quantity: filledQty,
        price: fillPrice,
        amountUsdt: filledAmount,
        entryPrice: botState.entryPrice,
        pnl,
        pnlUsdt: pnlUsdt.toFixed(2),
        motivo: 'Manual sell',
      },
    });
  } catch (error) {
    logger.error('Manual sell error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Manual sell failed',
    });
  }
});

// ─── PAUSE/RESUME COIN ──────────────────────────────────────────
const pausedCoins = new Set<string>();

/**
 * POST /api/trading/pause/:coin
 * Pause trading for a specific coin
 */
router.post('/trading/pause/:coin', authenticate, (req: AuthRequest, res: Response) => {
  const { coin } = req.params;
  pausedCoins.add(coin.toUpperCase());
  logger.info(`⏸️ Trading paused for ${coin.toUpperCase()}`);
  res.json({ success: true, data: { coin: coin.toUpperCase(), paused: true } });
});

/**
 * POST /api/trading/resume/:coin
 * Resume trading for a specific coin
 */
router.post('/trading/resume/:coin', authenticate, (req: AuthRequest, res: Response) => {
  const { coin } = req.params;
  pausedCoins.delete(coin.toUpperCase());
  logger.info(`▶️ Trading resumed for ${coin.toUpperCase()}`);
  res.json({ success: true, data: { coin: coin.toUpperCase(), paused: false } });
});

/**
 * GET /api/trading/paused
 * Get list of paused coins
 */
router.get('/trading/paused', authenticate, (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      paused: Array.from(pausedCoins),
      count: pausedCoins.size,
    },
  });
});

/**
 * Check if a coin is paused (used by trading engine)
 */
export function isCoinPaused(coin: string): boolean {
  return pausedCoins.has(coin.toUpperCase());
}

// ─── AI ANALYSIS ────────────────────────────────────────────────
/**
 * POST /api/analytics/analyze-trade/:id
 * AI analysis of a specific trade
 */
router.post('/analytics/analyze-trade/:id', authenticate, expensiveLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get trade from database
    const trades = TradeLogRepository.getAll(1000);
    const trade = trades.find((t: any) => t.id === Number(id));

    if (!trade) {
      return res.status(404).json({ success: false, error: 'Trade not found' });
    }

    const analysis = await aiService.analyzeTrade({
      coin: trade.coin,
      action: trade.decision,
      price: trade.precio || 0,
      motivo: trade.motivo || '',
      rsi: trade.rsi || 0,
      adx: trade.adx || 0,
      score: 0,
      entryPrice: trade.entryPrice || undefined,
      pnl: trade.pnl || undefined,
      timestamp: trade.timestamp,
    });

    res.json({ success: true, data: analysis });
  } catch (error) {
    logger.error('Trade analysis error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed',
    });
  }
});

/**
 * POST /api/analytics/analyze-portfolio
 * AI analysis of overall portfolio
 */
router.post('/analytics/analyze-portfolio', authenticate, expensiveLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const summary = learningService.getOverallSummary();
    const recentTrades = TradeLogRepository.getAll(20);

    const analysis = await aiService.analyzePortfolio({
      trades: recentTrades,
      winRate: summary.overallWinRate,
      totalPnl: summary.coinPerformance.reduce((a, c) => a + c.pnl, 0),
      coinPerformance: summary.coinPerformance,
      recentTrades,
    });

    res.json({ success: true, data: analysis });
  } catch (error) {
    logger.error('Portfolio analysis error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed',
    });
  }
});

/**
 * POST /api/analytics/recommendation/:coin
 * AI recommendation for a specific coin
 */
router.post('/analytics/recommendation/:coin', authenticate, expensiveLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { coin } = req.params;
    const coinUpper = coin.toUpperCase();

    // Get current data
    const botState = BotStateRepository.getByCoin(coinUpper as any);
    const recentTrades = TradeLogRepository.getByCoin(coinUpper as any).slice(0, 10);

    const recommendation = await aiService.getCoinRecommendation(coinUpper, {
      currentPrice: botState?.entryPrice || 0,
      indicators: {
        rsi: 0,
        adx: 0,
      },
      recentTrades,
      currentPnl: undefined,
    });

    res.json({ success: true, data: { coin: coinUpper, recommendation } });
  } catch (error) {
    logger.error('Recommendation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Recommendation failed',
    });
  }
});

// ─── PERFORMANCE ANALYTICS ──────────────────────────────────────
/**
 * GET /api/analytics/performance
 * Detailed performance metrics
 */
router.get('/analytics/performance', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const summary = learningService.getOverallSummary();
    const allTrades = TradeLogRepository.getAll(1000);

    // Calculate detailed metrics
    const sellTrades = allTrades.filter((t: any) => t.decision === 'VENDER' && t.pnl);
    const pnls = sellTrades.map((t: any) => {
      const match = t.pnl?.match(/([+-]?[\d.]+)/);
      return match ? parseFloat(match[1]) : 0;
    });

    // Win/Loss stats
    const wins = pnls.filter(p => p > 0);
    const losses = pnls.filter(p => p < 0);

    // Streaks
    let currentStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    let tempStreak = 0;

    for (const pnl of pnls) {
      if (pnl > 0) {
        if (tempStreak >= 0) tempStreak++;
        else tempStreak = 1;
        maxWinStreak = Math.max(maxWinStreak, tempStreak);
      } else {
        if (tempStreak <= 0) tempStreak--;
        else tempStreak = -1;
        maxLossStreak = Math.max(maxLossStreak, Math.abs(tempStreak));
      }
    }
    currentStreak = tempStreak;

    // Average metrics
    const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;

    // Profit factor
    const grossProfit = wins.reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    // Expectancy
    const winRate = pnls.length > 0 ? wins.length / pnls.length : 0;
    const expectancy = (winRate * avgWin) - ((1 - winRate) * Math.abs(avgLoss));

    // Sharpe-like ratio (simplified)
    const avgPnl = pnls.length > 0 ? pnls.reduce((a, b) => a + b, 0) / pnls.length : 0;
    const variance = pnls.length > 0
      ? pnls.reduce((a, p) => a + Math.pow(p - avgPnl, 2), 0) / pnls.length
      : 0;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? avgPnl / stdDev : 0;

    // Drawdown
    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;
    for (const pnl of pnls) {
      cumulative += pnl;
      peak = Math.max(peak, cumulative);
      const drawdown = peak - cumulative;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    // Best/Worst trades
    const bestTrade = pnls.length > 0 ? Math.max(...pnls) : 0;
    const worstTrade = pnls.length > 0 ? Math.min(...pnls) : 0;

    // Trade frequency
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const tradesLast24h = allTrades.filter((t: any) => new Date(t.timestamp).getTime() > oneDayAgo).length;
    const tradesLastWeek = allTrades.filter((t: any) => new Date(t.timestamp).getTime() > oneWeekAgo).length;

    // Coin breakdown with more details
    const coinBreakdown = summary.coinPerformance.map(cp => {
      const coinTrades = allTrades.filter((t: any) => t.coin === cp.coin);
      const coinSells = coinTrades.filter((t: any) => t.decision === 'VENDER' && t.pnl);
      const coinPnls = coinSells.map((t: any) => {
        const match = t.pnl?.match(/([+-]?[\d.]+)/);
        return match ? parseFloat(match[1]) : 0;
      });

      return {
        coin: cp.coin,
        totalTrades: cp.trades,
        winRate: cp.winRate,
        totalPnl: cp.pnl,
        avgPnl: coinPnls.length > 0 ? coinPnls.reduce((a, b) => a + b, 0) / coinPnls.length : 0,
        bestTrade: coinPnls.length > 0 ? Math.max(...coinPnls) : 0,
        worstTrade: coinPnls.length > 0 ? Math.min(...coinPnls) : 0,
      };
    });

    res.json({
      success: true,
      data: {
        overview: {
          totalTrades: allTrades.length,
          totalSells: sellTrades.length,
          winRate: winRate * 100,
          totalPnl: pnls.reduce((a, b) => a + b, 0),
          avgPnl,
          profitFactor: profitFactor === Infinity ? '∞' : profitFactor.toFixed(2),
          expectancy: expectancy.toFixed(2),
          sharpeRatio: sharpeRatio.toFixed(2),
        },
        streaks: {
          current: currentStreak,
          maxWin: maxWinStreak,
          maxLoss: maxLossStreak,
        },
        extremes: {
          bestTrade,
          worstTrade,
          avgWin: avgWin.toFixed(2),
          avgLoss: avgLoss.toFixed(2),
        },
        risk: {
          maxDrawdown: maxDrawdown.toFixed(2),
          variance: variance.toFixed(2),
          stdDev: stdDev.toFixed(2),
        },
        frequency: {
          last24h: tradesLast24h,
          lastWeek: tradesLastWeek,
          avgPerDay: tradesLastWeek > 0 ? (tradesLastWeek / 7).toFixed(1) : '0',
        },
        coinBreakdown,
      },
    });
  } catch (error) {
    logger.error('Performance analytics error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get performance',
    });
  }
});

/**
 * GET /api/analytics/equity-curve
 * PnL equity curve over time
 */
router.get('/analytics/equity-curve', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const allTrades = TradeLogRepository.getAll(1000);
    const sellTrades = allTrades
      .filter((t: any) => t.decision === 'VENDER' && t.pnl)
      .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let cumulative = 0;
    let peak = 0;
    const curve: Array<{ date: string; pnl: number; cumulative: number; drawdown: number }> = [];

    for (const trade of sellTrades) {
      const match = trade.pnl?.match(/([+-]?[\d.]+)/);
      const pnl = match ? parseFloat(match[1]) : 0;
      cumulative += pnl;
      peak = Math.max(peak, cumulative);
      const drawdown = peak > 0 ? ((peak - cumulative) / peak) * 100 : 0;

      curve.push({
        date: trade.timestamp,
        pnl,
        cumulative,
        drawdown,
      });
    }

    res.json({
      success: true,
      data: {
        curve,
        summary: {
          totalPnl: cumulative,
          maxDrawdown: curve.length > 0 ? Math.max(...curve.map(c => c.drawdown)) : 0,
          dataPoints: curve.length,
        },
      },
    });
  } catch (error) {
    logger.error('Equity curve error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get equity curve',
    });
  }
});

/**
 * GET /api/analytics/coin/:coin
 * Detailed analytics for a specific coin
 */
router.get('/analytics/coin/:coin', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { coin } = req.params;
    const coinUpper = coin.toUpperCase();

    const analysis = learningService.analyzeCoin(coinUpper as any);
    const insights = learningService.generateInsights(analysis);

    res.json({
      success: true,
      data: {
        analysis,
        insights,
      },
    });
  } catch (error) {
    logger.error('Coin analytics error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get coin analytics',
    });
  }
});

export default router;
