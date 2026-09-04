// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Trading Engine (12-Node Pipeline)
// ═══════════════════════════════════════════════════════════════════

import { ExchangeService } from '../exchange/service';
import { IndicatorService } from '../indicators/service';
import { FullIndicatorData } from '@el-oraculo/shared';
import { ScoringService } from '../scoring/service';
import { RiskService, RiskContext } from '../risk/service';
import { portfolioRiskService } from '../portfolioRisk/service';
import { PushNotificationService } from '../notifications/push';
import { notificationService } from '../notifications/service';
import { TradeLoggerService } from '../tradeLogger/service';
import { emitPriceUpdate, emitScoreUpdate, emitTradeExecuted } from '../../ws/server';
import { logger } from '../../utils/logger';
import {
  CoinSymbol, CoinConfig, BalanceData, IndicatorData,
  MarketRegimeData, ScoringResult, RiskData, DecisionResult,
  ACTIVE_COINS, COIN_CONFIGS, MultiTimeframeData
} from '@el-oraculo/shared';
import {
  BotStateRepository,
  TradeLogRepository,
  ExecutionRepository,
} from '../../database/repositories';

// ─── Trade Context ──────────────────────────────────────────────
interface TradeContext {
  coin: CoinSymbol;
  config: CoinConfig;
  balance: BalanceData;
  indicators: FullIndicatorData;
  marketRegime: MarketRegimeData;
  multiTimeframe?: MultiTimeframeData;
  botState: {
    status: string;
    entryPrice: number;
    entryTime: string;
    pisoActual: number;
    streakLosses: number;
    montoEntrada: number;
    r: number;
    hoursHeld: number;
  };
}

// ─── Exit Reasons (prioritized) ─────────────────────────────────
const EXIT_REASONS = {
  HARD_STOP: { priority: 1, label: '🔴 ATR HARD STOP' },
  TRAILING_STOP: { priority: 2, label: '🟠 TRAILING STOP' },
  TAKE_PROFIT: { priority: 3, label: '🟢 TAKE PROFIT' },
  TIME_EXIT: { priority: 4, label: '⏰ TIME EXIT' },
  SAFETY_EXIT: { priority: 5, label: '🛡️ SAFETY EXIT (12h)' },
  BREAK_EVEN: { priority: 6, label: '🔄 BREAK EVEN' },
  MOMENTUM_BEAR: { priority: 7, label: '📉 MOMENTUM BEAR' },
  RSI_EXIT: { priority: 8, label: '📊 RSI EXIT' },
  ADX_EXIT: { priority: 9, label: '📊 ADX EXIT' },
} as const;

// ─── Trading Engine ─────────────────────────────────────────────
export class TradingEngine {
  private exchange: ExchangeService;
  private indicators: IndicatorService;
  private scoring: ScoringService;
  private risk: RiskService;
  private pushNotifications: PushNotificationService;
  private isRunning: boolean = false;
  private cycleCount: number = 0;

  constructor(exchange: ExchangeService) {
    this.exchange = exchange;
    this.indicators = new IndicatorService(exchange);
    this.scoring = new ScoringService();
    this.risk = new RiskService();
    this.pushNotifications = new PushNotificationService();
  }

  // ─── Main Cycle ──────────────────────────────────────────────
  async runCycle(): Promise<void> {
    if (this.isRunning) {
      logger.warn('⚠️ Trading cycle already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    this.cycleCount++;
    const cycleStart = Date.now();

    logger.info(`\n${'═'.repeat(60)}`);
    logger.info(`🔄 TRADING CYCLE #${this.cycleCount} STARTED`);
    logger.info(`${'═'.repeat(60)}`);

    try {
      const balance = await this.exchange.getBalance();
      logger.info(`💰 Balance: $${balance.usdt_free.toFixed(2)} USDT`);

      // Get BTC indicators for correlation
      const btcIndicators = await this.indicators.getBTCIndicators();
      logger.info(`₿ BTC: ADX=${btcIndicators.adx.toFixed(1)} | RSI=${btcIndicators.rsi.toFixed(1)} | ${btcIndicators.regime}`);

      // Process each coin
      const results: Array<{ coin: CoinSymbol; decision: string; motivo: string }> = [];

      for (const coin of ACTIVE_COINS) {
        try {
          const result = await this.processCoin(coin, balance, btcIndicators, cycleStart);
          results.push(result);
        } catch (error) {
          logger.error(`❌ Error processing ${coin}:`, error);
          this.logExecutionError(coin, error);
          results.push({ coin, decision: 'ERROR', motivo: error instanceof Error ? error.message : 'Unknown' });
        }
      }

      // Summary
      const cycleMs = Date.now() - cycleStart;
      const buys = results.filter(r => r.decision === 'COMPRAR').length;
      const sells = results.filter(r => r.decision === 'VENDER').length;
      const holds = results.filter(r => r.decision === 'ESPERAR').length;

      logger.info(`\n${'─'.repeat(60)}`);
      logger.info(`📊 CYCLE #${this.cycleCount} SUMMARY (${cycleMs}ms)`);
      logger.info(`   🟢 COMPRAR: ${buys} | 🔴 VENDER: ${sells} | ⏳ ESPERAR: ${holds}`);
      logger.info(`${'─'.repeat(60)}\n`);

    } catch (error) {
      logger.error('Fatal error in trading cycle:', error);
    } finally {
      this.isRunning = false;
    }
  }

  // ─── Process Single Coin ─────────────────────────────────────
  private async processCoin(
    coin: CoinSymbol,
    balance: BalanceData,
    btcIndicators: { adx: number; rsi: number; regime: string },
    cycleStartTime: number
  ): Promise<{ coin: CoinSymbol; decision: string; motivo: string }> {
    const config = COIN_CONFIGS[coin];

    // Log execution start
    ExecutionRepository.create({
      coin,
      status: 'running',
      timestamp: new Date().toISOString(),
    });

    // ── Node 1a: INDICATORS (15m) ──
    const indicators = await this.indicators.getIndicators(config.pair);

    // ── Node 1b: MULTI-TIMEFRAME SM ──
    const multiTimeframe = await this.indicators.getMultiTimeframeData(config.pair);

    // ── Node 2: MARKET REGIME ──
    const marketRegime = this.indicators.getMarketRegime(indicators);

    // ── Node 3: STATUS (get bot state) ──
    const botStateRecord = BotStateRepository.getByCoin(coin);
    const botState = this.buildBotState(botStateRecord, indicators);

    // ── Node 4: SCORING ──
    const ctx: TradeContext = { coin, config, balance, indicators, marketRegime, multiTimeframe, botState };
    const scoring = this.scoring.scoreEntry(ctx);

    // ── Node 5: RISK ──
    const currentPrice = await this.exchange.getTicker(config.pair);

    // Update price history for correlation tracking
    portfolioRiskService.updatePriceHistory(coin, currentPrice);

    // Check drawdown circuit breaker
    portfolioRiskService.checkDrawdownCircuitBreaker(balance.usdt_total);

    // Emit live price update via WebSocket
    emitPriceUpdate({
      coin,
      price: currentPrice,
      change24h: 0,
      timestamp: new Date().toISOString(),
    });
    const riskCtx: RiskContext = {
      entryPrice: botState.entryPrice,
      currentPrice,
      r: botState.r,
      st: botState.status,
      pisoActual: botState.pisoActual,
      hoursHeld: botState.hoursHeld,
      config,
      marketRegime,
    };
    const risk = this.risk.calculate(riskCtx);

    // ── Node 6: DECISION ──
    const decision = this.makeDecision(ctx, scoring, risk, indicators);

    // ── Node 7: FILTER (validate + cooldown) ──
    const filtered = this.filterDecision(decision, config, balance, botStateRecord, coin, indicators);

    // ── Node 8: OUTPUT (format) ──
    const output = this.formatOutput(coin, filtered, scoring, risk, indicators, marketRegime, multiTimeframe);

    // ── Node 9: EXECUTE ──
    if (filtered.decision === 'COMPRAR') {
      await this.executeBuy(ctx, filtered, indicators, scoring);
    } else if (filtered.decision === 'VENDER') {
      await this.executeSell(ctx, filtered, indicators, scoring);
    }

    // ── Node 10: LOG ──
    ExecutionRepository.create({
      coin,
      status: 'success',
      decision: filtered.decision,
      motivo: filtered.motivo,
      monto: filtered.monto_reporte,
      entryPrice: botState.entryPrice,
      score: scoring.entryScore,
      rsi: indicators.rsi,
      adx: indicators.adx,
      timestamp: new Date().toISOString(),
    });

    // Log full pipeline context for analytics
    TradeLoggerService.logDecision({
      coin,
      cycleNumber: this.cycleCount,
      cycleStartTime,
      regime: marketRegime.regime,
      rsi: indicators.rsi,
      adx: indicators.adx,
      atrPct: indicators.atr_pct,
      ema20: indicators.ema20,
      ema50: indicators.ema50,
      histogram: indicators.histogram,
      momentum: indicators.momentum,
      fvg: indicators.fvg,
      htfBias: multiTimeframe?.htfBias,
      confluenceScore: multiTimeframe?.confluenceScore,
      alignment: multiTimeframe?.alignment,
      entryScore: scoring.entryScore,
      entryThreshold: scoring.entryThreshold,
      entryReasons: scoring.entryReasons,
      hardStop: risk.hardStop,
      tpTarget: risk.tp_target,
      vPiso: risk.v_piso,
      decision: filtered.decision as 'COMPRAR' | 'VENDER' | 'ESPERAR',
      motivo: filtered.motivo,
      monto: filtered.monto_reporte,
      entryPrice: botState.entryPrice,
      entryTime: botState.entryTime,
      pnlPct: botState.r,
      timestamp: new Date().toISOString(),
    });

    // Update daily summary
    TradeLoggerService.updateDailySummary({
      coin,
      decision: filtered.decision,
      pnlPct: botState.r,
      monto: filtered.monto_reporte,
    });

    // Emit score update via WebSocket
    emitScoreUpdate({
      coin,
      score: scoring.entryScore,
      rsi: indicators.rsi,
      adx: indicators.adx,
      timestamp: new Date().toISOString(),
    });

    logger.info(output);

    return { coin, decision: filtered.decision, motivo: filtered.motivo };
  }

  // ─── Build Bot State from DB record ──────────────────────────
  private buildBotState(
    record: any,
    indicators: FullIndicatorData
  ): TradeContext['botState'] {
    if (!record) {
      return {
        status: 'LÍQUIDO',
        entryPrice: 0,
        entryTime: '',
        pisoActual: 0,
        streakLosses: 0,
        montoEntrada: 0,
        r: 0,
        hoursHeld: 0,
      };
    }

    let r = 0;
    let hoursHeld = 0;

    if (record.entryPrice > 0 && record.status === 'COMPRADO' && indicators.currentPrice > 0) {
      r = ((indicators.currentPrice - record.entryPrice) / record.entryPrice) * 100;

      if (record.entryTime) {
        const entryDate = new Date(record.entryTime);
        hoursHeld = (Date.now() - entryDate.getTime()) / (1000 * 60 * 60);
      }
    }

    return {
      status: record.status,
      entryPrice: record.entryPrice,
      entryTime: record.entryTime || '',
      pisoActual: record.pisoActual,
      streakLosses: record.streakLosses,
      montoEntrada: record.montoEntrada,
      r,
      hoursHeld,
    };
  }

  // ─── Decision Logic (Node 8: DECISION) ──────────────────────
  // n8n spec: Exit conditions compare PRICES, not percentages
  private makeDecision(
    ctx: TradeContext,
    scoring: ScoringResult,
    risk: RiskData,
    indicators: FullIndicatorData
  ): DecisionResult {
    const { status, r, hoursHeld } = ctx.botState;
    const currentPrice = indicators.currentPrice;
    const entryPrice = ctx.botState.entryPrice;

    // ═══ EXIT CONDITIONS (if has position) ═══
    if (status === 'COMPRADO') {
      // Priority 1: Hard stop (price <= hardStop price level)
      if (currentPrice <= risk.hardStop) {
        return { decision: 'VENDER', motivo: EXIT_REASONS.HARD_STOP.label, monto_reporte: 0 };
      }

      // Priority 2: Trailing stop (price <= piso price level)
      if (currentPrice <= risk.v_piso && currentPrice > entryPrice) {
        return { decision: 'VENDER', motivo: `${EXIT_REASONS.TRAILING_STOP.label} (price=$${currentPrice.toFixed(2)} ≤ floor=$${risk.v_piso.toFixed(2)})`, monto_reporte: 0 };
      }

      // Priority 3: Take profit (pnl% >= tp_target%)
      if (r >= risk.tp_target) {
        return { decision: 'VENDER', motivo: EXIT_REASONS.TAKE_PROFIT.label, monto_reporte: 0 };
      }

      // Priority 4: Time exit
      if (hoursHeld >= risk.maxHoldHours) {
        return { decision: 'VENDER', motivo: `${EXIT_REASONS.TIME_EXIT.label} (${hoursHeld.toFixed(1)}h / ${risk.maxHoldHours}h)`, monto_reporte: 0 };
      }

      // Priority 5: Safety exit (12h hard limit)
      if (hoursHeld >= 12) {
        return { decision: 'VENDER', motivo: EXIT_REASONS.SAFETY_EXIT.label, monto_reporte: 0 };
      }

      // Priority 6: Break-even (if active)
      if (risk.beActive && r < 0.1 && r > 0) {
        return { decision: 'VENDER', motivo: EXIT_REASONS.BREAK_EVEN.label, monto_reporte: 0 };
      }

      // Priority 7: Momentum bear + profit
      if (indicators.momentum === 'BEAR' && r > 0.3) {
        return { decision: 'VENDER', motivo: EXIT_REASONS.MOMENTUM_BEAR.label, monto_reporte: 0 };
      }

      // Priority 8: RSI overbought
      if (indicators.rsi > 75 && r > 0.2) {
        return { decision: 'VENDER', motivo: EXIT_REASONS.RSI_EXIT.label, monto_reporte: 0 };
      }

      // Hold
      return { decision: 'ESPERAR', motivo: '🟢 HOLDING', monto_reporte: 0 };
    }

    // ═══ ENTRY CONDITIONS (if no position) ═══
    if (scoring.entryScore >= scoring.entryThreshold) {
      const monto = ctx.balance.usdt_free * ctx.config.risk_pct;

      if (monto >= ctx.config.entry_min) {
        return {
          decision: 'COMPRAR',
          motivo: `ENTRY: ${scoring.entryReasons.join('+')}`,
          monto_reporte: monto,
        };
      }

      return {
        decision: 'ESPERAR',
        motivo: `💰 MONTO INSUFFICIENT: $${monto.toFixed(2)} < $${ctx.config.entry_min}`,
        monto_reporte: 0,
      };
    }

    return {
      decision: 'ESPERAR',
      motivo: `📊 SCORING: ${scoring.entryScore}/${scoring.entryThreshold} [${scoring.entryReasons.join(', ')}]`,
      monto_reporte: 0,
    };
  }

  // ─── Filter Decision (Node 11: FILTER) ──────────────────────
  // Now includes cooldown check and balance validation
  private filterDecision(
    decision: DecisionResult,
    config: CoinConfig,
    balance: BalanceData,
    botStateRecord: any,
    coin?: CoinSymbol,
    indicators?: FullIndicatorData
  ): DecisionResult {
    // Filter BUY if balance too low
    if (decision.decision === 'COMPRAR') {
      if (balance.usdt_free < config.entry_min) {
        return {
          ...decision,
          decision: 'ESPERAR',
          motivo: `🚫 FILTERED: Balance $${balance.usdt_free.toFixed(2)} < min $${config.entry_min}`,
        };
      }

      // Filter if monto too low
      if (decision.monto_reporte < config.entry_min) {
        return {
          ...decision,
          decision: 'ESPERAR',
          motivo: `🚫 FILTERED: Monto $${decision.monto_reporte.toFixed(2)} < min $${config.entry_min}`,
        };
      }

      // ── COOLDOWN: Enforce minimum wait time after sell ──
      if (botStateRecord?.lastSellTime) {
        const lastSell = new Date(botStateRecord.lastSellTime).getTime();
        const now = Date.now();
        const minutesSinceSell = (now - lastSell) / (1000 * 60);
        const cooldownMinutes = 15; // 15 minutes minimum after sell

        if (minutesSinceSell < cooldownMinutes) {
          const remaining = Math.ceil(cooldownMinutes - minutesSinceSell);
          return {
            ...decision,
            decision: 'ESPERAR',
            motivo: `⏰ COOLDOWN: Wait ${remaining}min after sell (last: ${botStateRecord.lastSellReason})`,
            monto_reporte: 0,
          };
        }
      }

      // ── STREAK COOLDOWN: Extra wait after consecutive losses ──
      if (botStateRecord && botStateRecord.streakLosses >= 3) {
        const extraMinutes = botStateRecord.streakLosses * 5; // 5min extra per loss streak
        if (botStateRecord.lastSellTime) {
          const lastSell = new Date(botStateRecord.lastSellTime).getTime();
          const now = Date.now();
          const minutesSinceSell = (now - lastSell) / (1000 * 60);
          const requiredWait = 15 + extraMinutes;

          if (minutesSinceSell < requiredWait) {
            const remaining = Math.ceil(requiredWait - minutesSinceSell);
            return {
              ...decision,
              decision: 'ESPERAR',
              motivo: `🔴 STREAK COOLDOWN: ${botStateRecord.streakLosses} losses, wait ${remaining}min`,
              monto_reporte: 0,
            };
          }
        }
      }

      // ── PORTFOLIO RISK CHECK ──
      if (coin && indicators) {
        const riskCheck = portfolioRiskService.checkNewPosition(coin, decision.monto_reporte, balance, indicators);
        if (!riskCheck.allowed) {
          return {
            ...decision,
            decision: 'ESPERAR',
            motivo: riskCheck.reason,
            monto_reporte: 0,
          };
        }
        // Use adjusted monto from risk check
        if (riskCheck.adjustedMonto < decision.monto_reporte) {
          decision = {
            ...decision,
            monto_reporte: riskCheck.adjustedMonto,
            motivo: `${decision.motivo} | ${riskCheck.reason}`,
          };
        }
      }
    }

    return decision;
  }

  // ─── Format Output (Node 10: OUTPUT) ────────────────────────
  private formatOutput(
    coin: CoinSymbol,
    decision: DecisionResult,
    scoring: ScoringResult,
    risk: RiskData,
    indicators: FullIndicatorData,
    regime: MarketRegimeData,
    multiTimeframe?: MultiTimeframeData
  ): string {
    const lines: string[] = [];
    lines.push(`\n[${coin}] ${decision.decision} | ${decision.motivo}`);
    lines.push(`   📊 Score: ${scoring.entryScore}/${scoring.entryThreshold} | RSI: ${indicators.rsi.toFixed(1)} | ADX: ${indicators.adx.toFixed(1)}`);
    lines.push(`   📈 Regime: ${regime.regime} | Momentum: ${indicators.momentum} | FVG: ${indicators.fvg}`);

    if (multiTimeframe) {
      const htfEmoji = multiTimeframe.htfBias === 'BULLISH' ? '🟢' : multiTimeframe.htfBias === 'BEARISH' ? '🔴' : '⚪';
      const alignEmoji = multiTimeframe.alignment ? '✅' : '❌';
      lines.push(`   🕐 HTF: ${htfEmoji} ${multiTimeframe.htfBias} | Confluence: ${multiTimeframe.confluenceScore}/100 | Align: ${alignEmoji}`);

      // SM summary per timeframe
      for (const tf of ['15m', '1h', '4h'] as const) {
        const data = multiTimeframe.timeframes[tf];
        const biasEmoji = data.bias === 'BULLISH' ? '🟢' : data.bias === 'BEARISH' ? '🔴' : '⚪';
        const obs = data.sm.orderBlocks.length;
        const bos = data.sm.structureBreaks.length;
        lines.push(`      ${tf}: ${biasEmoji} ${data.bias} (${data.strength}%) | OB:${obs} BOS:${bos} | ${data.sm.premiumDiscount}`);
      }
    }

    if (decision.decision === 'COMPRAR') {
      lines.push(`   💵 Monto: $${decision.monto_reporte.toFixed(2)}`);
    }

    if (decision.decision === 'VENDER') {
      lines.push(`   ⏱️ Hours: ${(risk.hoursHeld || 0).toFixed(1)}h | TP: ${risk.tp_target.toFixed(2)}% | Floor: ${risk.v_piso.toFixed(2)}%`);
    }

    return lines.join('\n');
  }

  // ─── Execute Buy (Node 9: OUTPUT) ───────────────────────────
  private async executeBuy(
    ctx: TradeContext,
    decision: DecisionResult,
    indicators: FullIndicatorData,
    scoring: ScoringResult
  ): Promise<void> {
    const price = await this.exchange.getTicker(ctx.config.pair);
    const qty = Math.floor(
      (decision.monto_reporte / price) * Math.pow(10, ctx.config.precision_qty)
    ) / Math.pow(10, ctx.config.precision_qty);

    if (qty > 0) {
      const result = await this.exchange.marketBuy(ctx.config.pair, qty);
      const fillPrice = result.fills?.[0]?.price || price;

      logger.info(`✅ BUY ${ctx.coin}: ${qty} @ $${fillPrice.toFixed(4)}`);

      BotStateRepository.markBought(ctx.coin, fillPrice, decision.monto_reporte);

      TradeLogRepository.create({
        coin: ctx.coin,
        decision: 'COMPRAR',
        motivo: decision.motivo,
        monto: decision.monto_reporte,
        precio: fillPrice,
        rsi: indicators.rsi,
        adx: indicators.adx,
        direction: ctx.marketRegime.regime === 'TRENDING'
          ? (ctx.indicators.plusDI > ctx.indicators.minusDI ? 'BULLISH' : 'BEARISH')
          : 'UNKNOWN',
        entryPrice: fillPrice,
        entryTime: new Date().toISOString(),
        pnl: '0%',
        timestamp: new Date().toISOString(),
      });

      BotStateRepository.resetStreak(ctx.coin);

      // Emit trade event via WebSocket
      emitTradeExecuted({
        coin: ctx.coin,
        action: 'COMPRAR',
        price: fillPrice,
        motivo: decision.motivo,
        timestamp: new Date().toISOString(),
      });

      // Send push notification (Expo)
      this.pushNotifications.notifyTrade({
        coin: ctx.coin,
        action: 'COMPRAR',
        price: fillPrice,
        motivo: decision.motivo,
        quantity: qty,
      }).catch((err) => logger.warn('Push notification failed:', err));

      // Send Telegram notification
      notificationService.notifyTrade({
        coin: ctx.coin,
        action: 'COMPRAR',
        price: fillPrice,
        motivo: decision.motivo,
        quantity: qty,
        timestamp: new Date().toISOString(),
      }).catch((err) => logger.warn('Telegram notification failed:', err));
    }
  }

  // ─── Execute Sell ────────────────────────────────────────────
  private async executeSell(
    ctx: TradeContext,
    decision: DecisionResult,
    indicators: FullIndicatorData,
    scoring: ScoringResult
  ): Promise<void> {
    const balance = await this.exchange.getBalance();
    const coinBalance = (balance as any)[`${ctx.coin.toLowerCase()}_free`] || 0;

    if (coinBalance > 0) {
      const result = await this.exchange.marketSell(ctx.config.pair, coinBalance);
      const fillPrice = result.fills?.[0]?.price || 0;

      logger.info(`✅ SELL ${ctx.coin}: ${coinBalance} @ $${fillPrice.toFixed(4)}`);

      let pnl = '0%';
      if (ctx.botState.entryPrice > 0 && fillPrice > 0) {
        const pnlPct = ((fillPrice - ctx.botState.entryPrice) / ctx.botState.entryPrice) * 100;
        pnl = `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`;
      }

      TradeLogRepository.create({
        coin: ctx.coin,
        decision: 'VENDER',
        motivo: decision.motivo,
        monto: ctx.botState.montoEntrada,
        precio: fillPrice,
        rsi: indicators.rsi,
        adx: indicators.adx,
        direction: ctx.marketRegime.regime === 'TRENDING'
          ? (ctx.indicators.plusDI > ctx.indicators.minusDI ? 'BULLISH' : 'BEARISH')
          : 'UNKNOWN',
        entryPrice: ctx.botState.entryPrice,
        entryTime: ctx.botState.entryTime,
        pnl,
        timestamp: new Date().toISOString(),
      });

      BotStateRepository.markSold(ctx.coin, decision.motivo, fillPrice);

      if (pnl.startsWith('-')) {
        BotStateRepository.incrementStreak(ctx.coin);
      } else {
        BotStateRepository.resetStreak(ctx.coin);
      }

      // Emit trade event via WebSocket
      emitTradeExecuted({
        coin: ctx.coin,
        action: 'VENDER',
        price: fillPrice,
        motivo: decision.motivo,
        timestamp: new Date().toISOString(),
      });

      // Send push notification (Expo)
      this.pushNotifications.notifyTrade({
        coin: ctx.coin,
        action: 'VENDER',
        price: fillPrice,
        motivo: decision.motivo,
        pnl,
        quantity: coinBalance,
      }).catch((err) => logger.warn('Push notification failed:', err));

      // Send Telegram notification
      notificationService.notifyTrade({
        coin: ctx.coin,
        action: 'VENDER',
        price: fillPrice,
        motivo: decision.motivo,
        pnl,
        quantity: coinBalance,
        timestamp: new Date().toISOString(),
      }).catch((err) => logger.warn('Telegram notification failed:', err));
    }
  }

  // ─── Error Logging ──────────────────────────────────────────
  private logExecutionError(coin: CoinSymbol, error: unknown): void {
    ExecutionRepository.create({
      coin,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }

  // ─── Public: Get Bot Status ─────────────────────────────────
  getStatus(): { running: boolean; cycleCount: number; uptime: number } {
    return {
      running: this.isRunning,
      cycleCount: this.cycleCount,
      uptime: process.uptime(),
    };
  }
}
