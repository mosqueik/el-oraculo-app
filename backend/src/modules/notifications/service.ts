// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Notification Service (Telegram + In-App)
// ═══════════════════════════════════════════════════════════════════
//
// Sends trade alerts, system alerts, and daily reports via:
//   1. Telegram Bot API (if TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID set)
//   2. In-memory log (always, for API retrieval)
//
// Env vars:
//   TELEGRAM_BOT_TOKEN  — Bot token from @BotFather
//   TELEGRAM_CHAT_ID    — Chat/group ID to send messages to
//   TELEGRAM_THREAD_ID  — (optional) Thread/topic ID for forum groups
//   TELEGRAM_SILENT     — (optional) 'true' to send silent notifications
// ═══════════════════════════════════════════════════════════════════

import { logger } from '../../utils/logger';
import { CoinSymbol, TradeAction } from '@el-oraculo/shared';

// ─── Types ───────────────────────────────────────────────────────

export interface TradeNotification {
  coin: CoinSymbol;
  action: TradeAction;
  motivo: string;
  price: number;
  quantity: number;
  pnl?: string;
  timestamp: string;
}

export interface AlertNotification {
  level: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  coin?: CoinSymbol;
  timestamp: string;
}

export interface DailyReport {
  date: string;
  totalTrades: number;
  wins: number;
  losses: number;
  totalPnl: number;
  bestTrade: string;
  worstTrade: string;
  activePositions: Array<{ coin: CoinSymbol; pnl: string; hours: number }>;
}

export interface TelegramConfig {
  configured: boolean;
  botTokenSet: boolean;
  chatIdSet: boolean;
  threadIdSet: boolean;
  silentMode: boolean;
}

// ─── Telegram API Response Types ─────────────────────────────────

interface TelegramResponse {
  ok: boolean;
  description?: string;
  result?: any;
  error_code?: number;
}

// ─── Notification Service ────────────────────────────────────────

export class NotificationService {
  private botToken: string | null;
  private chatId: string | null;
  private threadId: string | null;
  private silent: boolean;
  private notifications: Array<TradeNotification | AlertNotification> = [];
  private sendQueue: Array<{ text: string; resolve: (ok: boolean) => void }> = [];
  private isProcessingQueue = false;
  private lastSendTime = 0;
  private readonly MIN_SEND_INTERVAL_MS = 1000; // Max 1 message per second (Telegram rate limit)

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || null;
    this.chatId = process.env.TELEGRAM_CHAT_ID || null;
    this.threadId = process.env.TELEGRAM_THREAD_ID || null;
    this.silent = process.env.TELEGRAM_SILENT === 'true';

    if (this.botToken && this.chatId) {
      logger.info('✅ Telegram notifications configured');
    } else {
      logger.warn('⚠️ Telegram not configured — set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get Telegram configuration status
   */
  getConfig(): TelegramConfig {
    return {
      configured: !!(this.botToken && this.chatId),
      botTokenSet: !!this.botToken,
      chatIdSet: !!this.chatId,
      threadIdSet: !!this.threadId,
      silentMode: this.silent,
    };
  }

  /**
   * Send a trade notification (BUY / SELL)
   */
  async notifyTrade(notification: TradeNotification): Promise<boolean> {
    const emoji = notification.action === 'COMPRAR' ? '🟢' : notification.action === 'VENDER' ? '🔴' : '⏳';

    // Build Telegram message
    const lines: string[] = [
      `${emoji} *${this.escapeMarkdown(notification.action)}* — \`${notification.coin}\``,
      ``,
      `💰 Precio: \`$${notification.price.toFixed(4)}\``,
      `📊 Cantidad: \`${notification.quantity}\``,
    ];

    if (notification.pnl) {
      const pnlEmoji = notification.pnl.startsWith('-') ? '📉' : '📈';
      lines.push(`${pnlEmoji} PnL: \`${notification.pnl}\``);
    }

    lines.push('');
    lines.push(`📝 ${this.escapeMarkdown(notification.motivo)}`);
    lines.push(`🕐 ${notification.timestamp}`);

    const text = lines.join('\n');

    // Store locally
    this.notifications.push(notification);

    // Send via Telegram
    const sent = await this.sendTelegram(text);

    logger.info(`📬 ${notification.action} ${notification.coin} @ $${notification.price.toFixed(4)} [Telegram: ${sent ? '✅' : '❌'}]`);

    return sent;
  }

  /**
   * Send an alert notification (info / warning / error / critical)
   */
  async notifyAlert(alert: AlertNotification): Promise<boolean> {
    const emoji = { info: 'ℹ️', warning: '⚠️', error: '❌', critical: '🚨' }[alert.level];

    const lines: string[] = [
      `${emoji} *${this.escapeMarkdown(alert.title)}*`,
      ``,
      alert.message,
    ];

    if (alert.coin) {
      lines.push(`🪙 Coin: \`${alert.coin}\``);
    }

    lines.push(`🕐 ${alert.timestamp}`);

    const text = lines.join('\n');

    // Store locally
    this.notifications.push(alert);

    // Send via Telegram
    const sent = await this.sendTelegram(text);

    // Log based on level
    switch (alert.level) {
      case 'critical': logger.error(`🚨 CRITICAL: ${alert.title} — ${alert.message}`); break;
      case 'error': logger.error(`❌ ${alert.title}: ${alert.message}`); break;
      case 'warning': logger.warn(`⚠️ ${alert.title}: ${alert.message}`); break;
      default: logger.info(`ℹ️ ${alert.title}: ${alert.message}`);
    }

    return sent;
  }

  /**
   * Send daily performance report
   */
  async sendDailyReport(report: DailyReport): Promise<boolean> {
    const emoji = report.totalPnl >= 0 ? '🟢' : '🔴';

    const lines: string[] = [
      `📊 *DAILY REPORT — ${report.date}*`,
      `${'─'.repeat(30)}`,
      ``,
      `🔄 Trades: ${report.totalTrades}`,
      `✅ Wins: ${report.wins} | ❌ Losses: ${report.losses}`,
      `📈 Win Rate: ${report.totalTrades > 0 ? ((report.wins / report.totalTrades) * 100).toFixed(1) : 0}%`,
      `${emoji} Total PnL: ${report.totalPnl >= 0 ? '+' : ''}${report.totalPnl.toFixed(2)}%`,
    ];

    if (report.bestTrade) lines.push(`🏆 Best: ${report.bestTrade}`);
    if (report.worstTrade) lines.push(`💔 Worst: ${report.worstTrade}`);

    lines.push('');
    lines.push('📍 *Active Positions:*');

    if (report.activePositions.length === 0) {
      lines.push('   _No positions_');
    } else {
      for (const pos of report.activePositions) {
        const posEmoji = pos.pnl.startsWith('-') ? '🔴' : '🟢';
        lines.push(`   ${posEmoji} ${pos.coin}: ${pos.pnl} (${pos.hours.toFixed(1)}h)`);
      }
    }

    const text = lines.join('\n');

    // Send via Telegram
    const sent = await this.sendTelegram(text);

    logger.info(`📊 Daily report sent: ${report.totalTrades} trades, PnL: ${report.totalPnl.toFixed(2)}% [Telegram: ${sent ? '✅' : '❌'}]`);

    return sent;
  }

  /**
   * Send a raw text message to Telegram (for custom notifications)
   */
  async sendMessage(text: string): Promise<boolean> {
    return this.sendTelegram(text);
  }

  /**
   * Test Telegram connection by sending a test message
   */
  async testConnection(): Promise<{ success: boolean; error?: string; chatInfo?: any }> {
    if (!this.botToken || !this.chatId) {
      return {
        success: false,
        error: 'Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.',
      };
    }

    try {
      // First, get bot info to verify token
      const botInfoUrl = `https://api.telegram.org/bot${this.botToken}/getMe`;
      const botResponse = await fetch(botInfoUrl);
      const botData = (await botResponse.json()) as TelegramResponse;

      if (!botData.ok) {
        return {
          success: false,
          error: `Invalid bot token: ${botData.description}`,
        };
      }

      // Send test message
      const testMessage = [
        '🧪 *El Oráculo — Test Message*',
        '',
        `Bot: @${botData.result?.username}`,
        `Chat ID: \`${this.chatId}\``,
        this.threadId ? `Thread: \`${this.threadId}\`` : '',
        '',
        '✅ Telegram integration is working!',
        `🕐 ${new Date().toISOString()}`,
      ].filter(Boolean).join('\n');

      const sent = await this.sendTelegram(testMessage);

      if (sent) {
        return {
          success: true,
          chatInfo: {
            botUsername: botData.result?.username,
            botName: botData.result?.first_name,
            chatId: this.chatId,
            threadId: this.threadId,
          },
        };
      } else {
        return {
          success: false,
          error: 'Failed to send test message. Check chat_id is correct and bot is added to the chat.',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get recent notifications (from in-memory log)
   */
  getRecent(limit: number = 20): Array<TradeNotification | AlertNotification> {
    return this.notifications.slice(-limit);
  }

  /**
   * Clear in-memory notification log
   */
  clear(): void {
    this.notifications = [];
  }

  // ═══════════════════════════════════════════════════════════════
  // TELEGRAM BOT API
  // ═══════════════════════════════════════════════════════════════

  /**
   * Send a message via Telegram Bot API with rate limiting and retry
   */
  private async sendTelegram(text: string): Promise<boolean> {
    if (!this.botToken || !this.chatId) {
      return false; // Silently skip if not configured
    }

    return new Promise<boolean>((resolve) => {
      this.sendQueue.push({ text, resolve });
      this.processQueue();
    });
  }

  /**
   * Process the send queue with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.sendQueue.length === 0) return;

    this.isProcessingQueue = true;

    while (this.sendQueue.length > 0) {
      const item = this.sendQueue.shift()!;
      const now = Date.now();
      const timeSinceLastSend = now - this.lastSendTime;

      // Wait if needed to respect rate limit
      if (timeSinceLastSend < this.MIN_SEND_INTERVAL_MS) {
        await new Promise(r => setTimeout(r, this.MIN_SEND_INTERVAL_MS - timeSinceLastSend));
      }

      try {
        const success = await this.doSend(item.text);
        this.lastSendTime = Date.now();
        item.resolve(success);
      } catch {
        item.resolve(false);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Actually send a message via the Telegram Bot API
   */
  private async doSend(text: string): Promise<boolean> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    const body: Record<string, any> = {
      chat_id: this.chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    };

    // Forum topic support
    if (this.threadId) {
      body.message_thread_id = parseInt(this.threadId, 10);
    }

    // Silent notification
    if (this.silent) {
      body.disable_notification = true;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as TelegramResponse;

      if (!data.ok) {
        // Handle specific Telegram errors
        if (data.error_code === 429) {
          // Rate limited — wait and retry once
          logger.warn('Telegram rate limited, retrying in 5s...');
          await new Promise(r => setTimeout(r, 5000));

          const retryResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const retryData = (await retryResponse.json()) as TelegramResponse;

          if (!retryData.ok) {
            logger.error(`Telegram retry failed: ${retryData.description}`);
            return false;
          }
          return true;
        }

        if (data.error_code === 400 && data.description?.includes('parse')) {
          // Markdown parse error — retry without parse_mode
          logger.warn('Markdown parse error, retrying as plain text...');
          const plainBody = { ...body, text, parse_mode: undefined };
          const plainResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(plainBody),
          });
          const plainData = (await plainResponse.json()) as TelegramResponse;

          if (!plainData.ok) {
            logger.error(`Telegram plain text failed: ${plainData.description}`);
            return false;
          }
          return true;
        }

        logger.error(`Telegram API error ${data.error_code}: ${data.description}`);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Telegram send failed:', error);
      return false;
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────

  /**
   * Escape Markdown special characters for Telegram
   */
  private escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
  }
}

// Singleton
export const notificationService = new NotificationService();
