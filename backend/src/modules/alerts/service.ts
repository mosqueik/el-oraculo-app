// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Alert Service (Profit/Loss Threshold Monitoring)
// ═══════════════════════════════════════════════════════════════════

import { AlertRepository } from '../../database/repositories';
import { BotStateRepository } from '../../database/repositories';
import { ExchangeService } from '../exchange/service';
import { COIN_CONFIGS } from '@el-oraculo/shared';
import { logger } from '../../utils/logger';

export interface AlertCheckResult {
  triggered: boolean;
  alerts: Array<{
    configId: number;
    coin: string;
    alertType: string;
    threshold: number;
    currentValue: number;
    message: string;
  }>;
}

export class AlertService {
  private exchange: ExchangeService | null = null;

  setExchange(exchange: ExchangeService) {
    this.exchange = exchange;
  }

  /**
   * Check all enabled alerts against current positions
   * Called periodically by the scheduler (every 60s)
   */
  async checkAlerts(): Promise<AlertCheckResult> {
    const result: AlertCheckResult = { triggered: false, alerts: [] };

    try {
      const enabledAlerts = AlertRepository.getEnabled();

      if (enabledAlerts.length === 0) {
        return result;
      }

      for (const alert of enabledAlerts) {
        try {
          const triggered = await this.checkSingleAlert(alert);
          if (triggered) {
            result.triggered = true;
            result.alerts.push(triggered);
          }
        } catch (error) {
          logger.debug(`Alert check error for config ${alert.id}: ${error}`);
        }
      }
    } catch (error) {
      logger.error('Alert service error:', error);
    }

    return result;
  }

  /**
   * Check a single alert config against current market data
   */
  private async checkSingleAlert(alert: any): Promise<{
    configId: number;
    coin: string;
    alertType: string;
    threshold: number;
    currentValue: number;
    message: string;
  } | null> {
    // Skip if already triggered and still in cooldown
    if (alert.triggered && alert.lastTriggeredAt) {
      const lastTriggered = new Date(alert.lastTriggeredAt).getTime();
      const cooldownMs = (alert.cooldownMinutes || 60) * 60 * 1000;
      if (Date.now() - lastTriggered < cooldownMs) {
        return null;
      }
      // Cooldown expired, reset triggered status
      AlertRepository.update(alert.id, { triggered: false });
    }

    // Get current position data
    const botState = BotStateRepository.getByCoin(alert.coin);
    if (!botState) return null;

    // Calculate current PnL
    let currentValue = 0;
    let currentPrice = 0;

    if (this.exchange) {
      const config = COIN_CONFIGS[alert.coin as keyof typeof COIN_CONFIGS];
      if (config) {
        try {
          currentPrice = await this.exchange.getTicker(config.pair);
        } catch {
          return null;
        }
      }
    }

    if (botState.status === 'COMPRADO' && botState.entryPrice > 0 && currentPrice > 0) {
      const pnlPct = ((currentPrice - botState.entryPrice) / botState.entryPrice) * 100;
      const pnlUsd = (currentPrice - botState.entryPrice) * (botState.montoEntrada / botState.entryPrice);

      switch (alert.alertType) {
        case 'profit_pct':
          currentValue = pnlPct;
          break;
        case 'loss_pct':
          currentValue = Math.abs(pnlPct); // Positive number for loss
          break;
        case 'profit_usdt':
          currentValue = pnlUsd;
          break;
        case 'loss_usdt':
          currentValue = Math.abs(pnlUsd);
          break;
        default:
          return null;
      }
    } else if (currentPrice > 0) {
      // For price alerts, use current price
      if (alert.alertType === 'price_above' || alert.alertType === 'price_below') {
        currentValue = currentPrice;
      }
    }

    // Check threshold
    let triggered = false;
    let message = '';

    switch (alert.alertType) {
      case 'profit_pct':
        if (currentValue >= alert.threshold) {
          triggered = true;
          message = `🟢 ${alert.coin} profit reached ${currentValue.toFixed(2)}% (threshold: ${alert.threshold}%)`;
        }
        break;
      case 'loss_pct':
        if (currentValue >= alert.threshold) {
          triggered = true;
          message = `🔴 ${alert.coin} loss reached ${currentValue.toFixed(2)}% (threshold: ${alert.threshold}%)`;
        }
        break;
      case 'profit_usdt':
        if (currentValue >= alert.threshold) {
          triggered = true;
          message = `🟢 ${alert.coin} profit reached $${currentValue.toFixed(2)} (threshold: $${alert.threshold})`;
        }
        break;
      case 'loss_usdt':
        if (currentValue >= alert.threshold) {
          triggered = true;
          message = `🔴 ${alert.coin} loss reached $${currentValue.toFixed(2)} (threshold: $${alert.threshold})`;
        }
        break;
      case 'price_above':
        if (currentPrice >= alert.threshold) {
          triggered = true;
          message = `📈 ${alert.coin} price reached $${currentPrice.toFixed(4)} (threshold: $${alert.threshold})`;
        }
        break;
      case 'price_below':
        if (currentPrice <= alert.threshold) {
          triggered = true;
          message = `📉 ${alert.coin} price dropped to $${currentPrice.toFixed(4)} (threshold: $${alert.threshold})`;
        }
        break;
    }

    if (triggered) {
      // Mark as triggered
      AlertRepository.markTriggered(alert.id);

      // Log to history
      AlertRepository.logTrigger({
        alertConfigId: alert.id,
        coin: alert.coin,
        alertType: alert.alertType,
        threshold: alert.threshold,
        currentValue,
        message,
        sentVia: 'push',
      });

      logger.info(`🔔 Alert triggered: ${message}`);

      return {
        configId: alert.id,
        coin: alert.coin,
        alertType: alert.alertType,
        threshold: alert.threshold,
        currentValue,
        message,
      };
    }

    return null;
  }

  /**
   * Get alert summary for a coin
   */
  getAlertSummary(coin: string): {
    activeAlerts: number;
    triggeredToday: number;
    recentAlerts: any[];
  } {
    const alerts = AlertRepository.getByCoin(coin);
    const history = AlertRepository.getHistoryByCoin(coin, 10);

    const today = new Date().toDateString();
    const triggeredToday = history.filter(
      (h: any) => new Date(h.timestamp).toDateString() === today
    ).length;

    return {
      activeAlerts: alerts.filter((a: any) => a.enabled).length,
      triggeredToday,
      recentAlerts: history,
    };
  }
}

export const alertService = new AlertService();
