// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Bot State Repository
// ═══════════════════════════════════════════════════════════════════

import { eq } from 'drizzle-orm';
import { getDrizzle } from '../connection';
import { botState, type BotState, type NewBotState } from '../schema';

export class BotStateRepository {
  /**
   * Get all bot states (all coins)
   */
  static getAll(): BotState[] {
    const db = getDrizzle();
    return db.select().from(botState).all();
  }

  /**
   * Get bot state for a specific coin
   */
  static getByCoin(coin: string): BotState | undefined {
    const db = getDrizzle();
    return db
      .select()
      .from(botState)
      .where(eq(botState.coin, coin))
      .get();
  }

  /**
   * Create or update bot state for a coin
   */
  static upsert(coin: string, data: Partial<NewBotState>): BotState {
    const db = getDrizzle();
    const existing = this.getByCoin(coin);

    if (existing) {
      db.update(botState)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(botState.coin, coin))
        .run();

      return this.getByCoin(coin)!;
    }

    db.insert(botState)
      .values({ coin, ...data })
      .run();

    return this.getByCoin(coin)!;
  }

  /**
   * Update bot state for a coin
   */
  static update(coin: string, data: Partial<NewBotState>): BotState | undefined {
    const db = getDrizzle();
    const existing = this.getByCoin(coin);

    if (!existing) return undefined;

    db.update(botState)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(botState.coin, coin))
      .run();

    return this.getByCoin(coin);
  }

  /**
   * Mark coin as COMPRADO (bought)
   */
  static markBought(
    coin: string,
    entryPrice: number,
    monto: number
  ): BotState | undefined {
    return this.update(coin, {
      status: 'COMPRADO',
      entryPrice,
      entryTime: new Date().toISOString(),
      montoEntrada: monto,
      tpTarget: 0, // Will be calculated by risk service
      pisoActual: 0,
    });
  }

  /**
   * Mark coin as LÍQUIDO (sold)
   */
  static markSold(
    coin: string,
    reason: string,
    price: number
  ): BotState | undefined {
    return this.update(coin, {
      status: 'LÍQUIDO',
      entryPrice: 0,
      entryTime: undefined,
      tpTarget: 0,
      pisoActual: 0,
      montoEntrada: 0,
      lastSellTime: new Date().toISOString(),
      lastSellReason: reason,
      lastSellPrice: price,
    });
  }

  /**
   * Update streak losses
   */
  static incrementStreak(coin: string): BotState | undefined {
    const current = this.getByCoin(coin);
    if (!current) return undefined;

    return this.update(coin, {
      streakLosses: current.streakLosses + 1,
    });
  }

  /**
   * Reset streak to 0
   */
  static resetStreak(coin: string): BotState | undefined {
    return this.update(coin, {
      streakLosses: 0,
    });
  }

  /**
   * Get all coins with status COMPRADO
   */
  static getActivePositions(): BotState[] {
    const db = getDrizzle();
    return db
      .select()
      .from(botState)
      .where(eq(botState.status, 'COMPRADO'))
      .all();
  }
}
