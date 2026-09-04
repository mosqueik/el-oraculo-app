// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Custom Indicator Repository
// ═══════════════════════════════════════════════════════════════════

import { eq, and } from 'drizzle-orm';
import { getDrizzle } from '../connection';
import { customIndicators, indicatorUsage } from '../schema';

export class CustomIndicatorRepository {
  /**
   * Get all indicators for a user
   */
  static getByUserId(userId: number): any[] {
    const db = getDrizzle();
    return db.select().from(customIndicators).where(eq(customIndicators.userId, userId)).all();
  }

  /**
   * Get a single indicator by ID
   */
  static getById(id: number): any | null {
    const db = getDrizzle();
    return db.select().from(customIndicators).where(eq(customIndicators.id, id)).get() || null;
  }

  /**
   * Create a new custom indicator
   */
  static create(data: {
    userId: number;
    name: string;
    description?: string;
    formula: string;
    type: string;
    timeframe?: string;
    parameters?: string;
  }): any {
    const db = getDrizzle();
    const result = db.insert(customIndicators).values({
      userId: data.userId,
      name: data.name,
      description: data.description,
      formula: data.formula,
      type: data.type,
      timeframe: data.timeframe || '15m',
      parameters: data.parameters,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning().get();

    return result;
  }

  /**
   * Update a custom indicator
   */
  static update(id: number, data: Partial<{
    name: string;
    description: string;
    formula: string;
    type: string;
    timeframe: string;
    parameters: string;
    enabled: boolean;
  }>): any {
    const db = getDrizzle();
    return db.update(customIndicators)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(customIndicators.id, id))
      .returning()
      .get();
  }

  /**
   * Delete a custom indicator
   */
  static delete(id: number): boolean {
    const db = getDrizzle();
    // Delete usage records first
    db.delete(indicatorUsage).where(eq(indicatorUsage.indicatorId, id)).run();
    // Delete the indicator
    const result = db.delete(customIndicators).where(eq(customIndicators.id, id)).run();
    return result.changes > 0;
  }

  /**
   * Get indicator usage for a coin
   */
  static getUsageByCoin(coin: string): any[] {
    const db = getDrizzle();
    return db.select().from(indicatorUsage).where(eq(indicatorUsage.coin, coin)).all();
  }

  /**
   * Set indicator usage (weight) for a coin
   */
  static setUsage(indicatorId: number, coin: string, weight: number, enabled: boolean = true): any {
    const db = getDrizzle();
    const existing = db.select().from(indicatorUsage)
      .where(and(eq(indicatorUsage.indicatorId, indicatorId), eq(indicatorUsage.coin, coin)))
      .get();

    if (existing) {
      return db.update(indicatorUsage)
        .set({ weight, enabled })
        .where(eq(indicatorUsage.id, existing.id))
        .returning()
        .get();
    }

    return db.insert(indicatorUsage).values({
      indicatorId,
      coin,
      weight,
      enabled,
      createdAt: new Date().toISOString(),
    }).returning().get();
  }

  /**
   * Delete indicator usage
   */
  static deleteUsage(indicatorId: number, coin: string): boolean {
    const db = getDrizzle();
    const result = db.delete(indicatorUsage)
      .where(and(eq(indicatorUsage.indicatorId, indicatorId), eq(indicatorUsage.coin, coin)))
      .run();
    return result.changes > 0;
  }
}
