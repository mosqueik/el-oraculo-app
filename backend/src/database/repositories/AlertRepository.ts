// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Alert Repository (Profit/Loss Alert Configs)
// ═══════════════════════════════════════════════════════════════════

import { eq, and, desc } from 'drizzle-orm';
import { getDrizzle } from '../connection';
import { alertConfig, alertHistory, type AlertConfig, type NewAlertConfig } from '../schema';

export class AlertRepository {
  /**
   * Get all alert configs
   */
  static getAll(): AlertConfig[] {
    const db = getDrizzle();
    return db.select().from(alertConfig).all();
  }

  /**
   * Get alert configs for a specific coin
   */
  static getByCoin(coin: string): AlertConfig[] {
    const db = getDrizzle();
    return db.select().from(alertConfig).where(eq(alertConfig.coin, coin)).all();
  }

  /**
   * Get alert config by ID
   */
  static getById(id: number): AlertConfig | undefined {
    const db = getDrizzle();
    return db.select().from(alertConfig).where(eq(alertConfig.id, id)).get();
  }

  /**
   * Get all enabled alert configs
   */
  static getEnabled(): AlertConfig[] {
    const db = getDrizzle();
    return db.select().from(alertConfig).where(eq(alertConfig.enabled, true)).all();
  }

  /**
   * Create a new alert config
   */
  static create(data: NewAlertConfig): AlertConfig {
    const db = getDrizzle();
    const result = db.insert(alertConfig).values({
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning().get();
    return result;
  }

  /**
   * Update an alert config
   */
  static update(id: number, data: Partial<AlertConfig>): AlertConfig | undefined {
    const db = getDrizzle();
    const existing = this.getById(id);
    if (!existing) return undefined;

    const result = db.update(alertConfig)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(alertConfig.id, id))
      .returning()
      .get();
    return result;
  }

  /**
   * Delete an alert config
   */
  static delete(id: number): boolean {
    const db = getDrizzle();
    const result = db.delete(alertConfig).where(eq(alertConfig.id, id)).run();
    return result.changes > 0;
  }

  /**
   * Mark alert as triggered
   */
  static markTriggered(id: number): void {
    const db = getDrizzle();
    db.update(alertConfig)
      .set({
        triggered: true,
        lastTriggeredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(alertConfig.id, id))
      .run();
  }

  /**
   * Reset triggered status (for daily reset)
   */
  static resetTriggered(): void {
    const db = getDrizzle();
    db.update(alertConfig)
      .set({ triggered: false, updatedAt: new Date().toISOString() })
      .run();
  }

  // ─── Alert History ─────────────────────────────────────────────

  /**
   * Get alert history (recent first)
   */
  static getHistory(limit: number = 50): any[] {
    const db = getDrizzle();
    return db.select().from(alertHistory)
      .orderBy(desc(alertHistory.timestamp))
      .limit(limit)
      .all();
  }

  /**
   * Get alert history for a specific coin
   */
  static getHistoryByCoin(coin: string, limit: number = 50): any[] {
    const db = getDrizzle();
    return db.select().from(alertHistory)
      .where(eq(alertHistory.coin, coin))
      .orderBy(desc(alertHistory.timestamp))
      .limit(limit)
      .all();
  }

  /**
   * Log an alert trigger
   */
  static logTrigger(data: {
    alertConfigId: number;
    coin: string;
    alertType: string;
    threshold: number;
    currentValue: number;
    message: string;
    sentVia?: string;
  }): void {
    const db = getDrizzle();
    db.insert(alertHistory).values({
      ...data,
      sentVia: data.sentVia || 'push',
      timestamp: new Date().toISOString(),
    }).run();
  }
}
