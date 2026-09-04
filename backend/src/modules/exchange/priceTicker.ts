// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Price Ticker (Live Price Broadcasts)
// Periodically fetches prices and emits via WebSocket
// ═══════════════════════════════════════════════════════════════════

import { ExchangeService } from './service';
import { emitPriceUpdate, emitScoreUpdate, emitPnLUpdate, PnLEvent } from '../../ws/server';
import { ACTIVE_COINS, COIN_CONFIGS } from '@el-oraculo/shared';
import { logger } from '../../utils/logger';
import { BotStateRepository } from '../../database/repositories';

// ─── Price Cache ────────────────────────────────────────────────
interface CachedPrice {
  coin: string;
  price: number;
  previousPrice: number;
  change24h: number;
  lastUpdate: number;
}

const priceCache: Map<string, CachedPrice> = new Map();

export class PriceTicker {
  private exchange: ExchangeService;
  private intervalId: NodeJS.Timeout | null = null;
  private pnlIntervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private intervalMs: number;
  private pnlIntervalMs: number = 60000; // PnL broadcast every 60s

  constructor(exchange: ExchangeService, intervalMs: number = 10000) {
    this.exchange = exchange;
    this.intervalMs = intervalMs;
  }

  /**
   * Start the price ticker
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    logger.info(`📈 Price ticker started (every ${this.intervalMs / 1000}s)`);

    // Initial fetch
    this.fetchAndBroadcast();

    // Periodic fetch
    this.intervalId = setInterval(() => {
      this.fetchAndBroadcast();
    }, this.intervalMs);

    // PnL broadcast (every 60s)
    this.pnlIntervalId = setInterval(() => {
      this.broadcastPnL();
    }, this.pnlIntervalMs);
  }

  /**
   * Stop the price ticker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.pnlIntervalId) {
      clearInterval(this.pnlIntervalId);
      this.pnlIntervalId = null;
    }
    this.isRunning = false;
    logger.info('📈 Price ticker stopped');
  }

  /**
   * Fetch prices for all active coins and broadcast
   */
  private async fetchAndBroadcast(): Promise<void> {
    try {
      // Fetch all prices in parallel (batch)
      const pricePromises = ACTIVE_COINS.map(async (coin) => {
        const config = COIN_CONFIGS[coin];
        try {
          const price = await this.exchange.getTicker(config.pair);
          return { coin, price };
        } catch (error) {
          // Silently skip failed fetches
          return null;
        }
      });

      const results = await Promise.allSettled(pricePromises);

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          const { coin, price } = result.value;

          // Get previous price from cache
          const cached = priceCache.get(coin);
          const previousPrice = cached?.price || price;
          const change24h = cached ? ((price - cached.price) / cached.price) * 100 : 0;

          // Update cache
          priceCache.set(coin, {
            coin,
            price,
            previousPrice,
            change24h,
            lastUpdate: Date.now(),
          });

          // Emit price update via WebSocket
          emitPriceUpdate({
            coin,
            price,
            change24h,
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      // Don't spam logs on price fetch errors
      if (this.isRunning) {
        logger.debug('Price ticker fetch error (suppressed)');
      }
    }
  }

  /**
   * Get cached price for a coin
   */
  getCachedPrice(coin: string): CachedPrice | undefined {
    return priceCache.get(coin);
  }

  /**
   * Broadcast PnL data for all positions
   */
  private async broadcastPnL(): Promise<void> {
    try {
      const allStates = BotStateRepository.getAll();
      const positions: PnLEvent['positions'] = [];

      for (const state of allStates) {
        const config = COIN_CONFIGS[state.coin as keyof typeof COIN_CONFIGS];
        if (!config) continue;

        let currentPrice = 0;
        let pnlPct = 0;
        let pnlUsd = 0;
        let hoursHeld = 0;
        let cooldownRemaining = 0;

        try {
          currentPrice = await this.exchange.getTicker(config.pair);
        } catch {
          continue;
        }

        if (state.status === 'COMPRADO' && state.entryPrice > 0 && currentPrice > 0) {
          pnlPct = ((currentPrice - state.entryPrice) / state.entryPrice) * 100;
          pnlUsd = (currentPrice - state.entryPrice) * (state.montoEntrada / state.entryPrice);

          if (state.entryTime) {
            hoursHeld = (Date.now() - new Date(state.entryTime).getTime()) / (1000 * 60 * 60);
          }
        }

        if (state.lastSellTime) {
          const minutesSinceSell = (Date.now() - new Date(state.lastSellTime).getTime()) / (1000 * 60);
          if (minutesSinceSell < 15) {
            cooldownRemaining = parseFloat((15 - minutesSinceSell).toFixed(1));
          }
        }

        positions.push({
          coin: state.coin,
          status: state.status,
          currentPrice,
          entryPrice: state.entryPrice,
          pnlPct: parseFloat(pnlPct.toFixed(4)),
          pnlUsd: parseFloat(pnlUsd.toFixed(4)),
          hoursHeld: parseFloat(hoursHeld.toFixed(2)),
          cooldownRemaining,
        });
      }

      const activePositions = positions.filter(p => p.status === 'COMPRADO');
      const summary = {
        activeCount: activePositions.length,
        totalPnlPct: parseFloat(activePositions.reduce((sum, p) => sum + p.pnlPct, 0).toFixed(4)),
        totalPnlUsd: parseFloat(activePositions.reduce((sum, p) => sum + p.pnlUsd, 0).toFixed(4)),
        positionsInProfit: activePositions.filter(p => p.pnlPct > 0).length,
        positionsInLoss: activePositions.filter(p => p.pnlPct < 0).length,
      };

      emitPnLUpdate({
        positions,
        summary,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.debug('PnL broadcast error (suppressed)');
    }
  }

  /**
   * Get all cached prices
   */
  getAllCachedPrices(): CachedPrice[] {
    return Array.from(priceCache.values());
  }

  /**
   * Force an immediate price fetch
   */
  async forceUpdate(): Promise<void> {
    await this.fetchAndBroadcast();
  }
}
