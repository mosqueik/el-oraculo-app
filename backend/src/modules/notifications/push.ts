// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Push Notification Service (Expo Push API)
// ═══════════════════════════════════════════════════════════════════

import { logger } from '../../utils/logger';
import { CoinSymbol, TradeAction } from '@el-oraculo/shared';
import { PushTokenRepository, NotificationLogRepository } from '../../database/repositories';

// ─── Types ──────────────────────────────────────────────────────
interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
}

interface ExpoPushReceipt {
  status: string;
  message?: string;
  details?: Record<string, any>;
}

// ─── Push Notification Service ───────────────────────────────────
export class PushNotificationService {
  private expoApiUrl = 'https://exp.host/--/api/v2/push/send';

  /**
   * Send a push notification to all active devices
   */
  async sendPushNotification(
    title: string,
    body: string,
    data?: Record<string, any>,
    channelId?: string
  ): Promise<{ sent: number; failed: number }> {
    const tokens = PushTokenRepository.getActive();

    if (tokens.length === 0) {
      logger.debug('📱 No active push tokens registered');
      return { sent: 0, failed: 0 };
    }

    const messages: ExpoPushMessage[] = tokens.map((t) => ({
      to: t.token,
      title,
      body,
      data: data || {},
      sound: 'default' as const,
      channelId: channelId || 'default',
    }));

    return this.sendBatch(messages, tokens.length);
  }

  /**
   * Send a trade notification via push
   */
  async notifyTrade(params: {
    coin: CoinSymbol;
    action: TradeAction;
    price: number;
    motivo: string;
    pnl?: string;
    quantity?: number;
  }): Promise<{ sent: number; failed: number }> {
    const emoji = params.action === 'COMPRAR' ? '🟢' : params.action === 'VENDER' ? '🔴' : '⏳';
    const title = `${emoji} ${params.action} — ${params.coin}`;

    const lines = [
      `💰 Precio: $${params.price.toFixed(4)}`,
      `📝 ${params.motivo}`,
    ];
    if (params.pnl) lines.unshift(`📈 PnL: ${params.pnl}`);
    if (params.quantity) lines.push(`📊 Cantidad: ${params.quantity.toFixed(6)}`);

    const body = lines.join('\n');

    const result = await this.sendPushNotification(title, body, {
      type: 'trade',
      coin: params.coin,
      action: params.action,
      price: params.price,
    }, 'trades');

    // Log to database
    NotificationLogRepository.create({
      type: 'trade',
      title,
      body,
      coin: params.coin,
      action: params.action,
      price: params.price,
      pnl: params.pnl,
      sentVia: 'push',
      sentCount: result.sent,
      errorCount: result.failed,
    });

    return result;
  }

  /**
   * Send an alert notification via push
   */
  async notifyAlert(params: {
    level: 'info' | 'warning' | 'error' | 'critical';
    title: string;
    message: string;
    coin?: CoinSymbol;
  }): Promise<{ sent: number; failed: number }> {
    const levelEmoji = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      critical: '🚨',
    }[params.level];

    const titleStr = `${levelEmoji} ${params.title}`;
    const body = params.coin
      ? `${params.message}\n🪙 ${params.coin}`
      : params.message;

    const result = await this.sendPushNotification(titleStr, body, {
      type: 'alert',
      level: params.level,
      coin: params.coin,
    }, 'alerts');

    // Log to database
    NotificationLogRepository.create({
      type: 'alert',
      title: titleStr,
      body,
      coin: params.coin,
      sentVia: 'push',
      sentCount: result.sent,
      errorCount: result.failed,
    });

    return result;
  }

  /**
   * Send a daily report via push
   */
  async sendDailyReport(report: {
    date: string;
    totalTrades: number;
    wins: number;
    losses: number;
    totalPnl: number;
    activePositions: Array<{ coin: CoinSymbol; pnl: string }>;
  }): Promise<{ sent: number; failed: number }> {
    const emoji = report.totalPnl >= 0 ? '🟢' : '🔴';
    const title = `📊 Daily Report — ${report.date}`;
    const lines = [
      `🔄 ${report.totalTrades} trades | ✅ ${report.wins}W ❌ ${report.losses}L`,
      `${emoji} PnL: ${report.totalPnl >= 0 ? '+' : ''}${report.totalPnl.toFixed(2)}%`,
    ];
    if (report.activePositions.length > 0) {
      lines.push(`📍 ${report.activePositions.length} active positions`);
    }

    const body = lines.join('\n');

    const result = await this.sendPushNotification(title, body, {
      type: 'daily_report',
      date: report.date,
    }, 'reports');

    NotificationLogRepository.create({
      type: 'daily_report',
      title,
      body,
      sentVia: 'push',
      sentCount: result.sent,
      errorCount: result.failed,
    });

    return result;
  }

  /**
   * Send a batch of push notifications via Expo API
   */
  private async sendBatch(
    messages: ExpoPushMessage[],
    totalCount: number
  ): Promise<{ sent: number; failed: number }> {
    if (messages.length === 0) {
      return { sent: 0, failed: 0 };
    }

    try {
      // Expo recommends batches of max 100
      const BATCH_SIZE = 100;
      let sent = 0;
      let failed = 0;

      for (let i = 0; i < messages.length; i += BATCH_SIZE) {
        const batch = messages.slice(i, i + BATCH_SIZE);

        const response = await fetch(this.expoApiUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batch),
        });

        if (!response.ok) {
          logger.error(`📱 Expo push API error: ${response.status}`);
          failed += batch.length;
          continue;
        }

        const result = (await response.json()) as { data: ExpoPushReceipt[] };

        if (result.data) {
          for (const receipt of result.data) {
            if (receipt.status === 'ok') {
              sent++;
            } else {
              failed++;
              // If token is invalid, deactivate it
              if (receipt.message?.includes('DeviceNotRegistered') ||
                  receipt.message?.includes('InvalidCredentials')) {
                const msgIndex = result.data.indexOf(receipt);
                const tokenIndex = i + msgIndex;
                if (tokenIndex < messages.length) {
                  const invalidToken = messages[tokenIndex].to;
                  PushTokenRepository.deactivate(invalidToken);
                  logger.warn(`📱 Deactivated invalid push token: ${invalidToken.substring(0, 20)}...`);
                }
              }
            }
          }
        }

        logger.info(`📱 Push batch: ${sent} sent, ${failed} failed (of ${totalCount} total)`);
      }

      return { sent, failed };
    } catch (error) {
      logger.error('📱 Failed to send push notifications:', error);
      return { sent: 0, failed: messages.length };
    }
  }
}
