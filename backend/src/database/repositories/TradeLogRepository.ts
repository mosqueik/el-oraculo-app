// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Trade Log Repository
// ═══════════════════════════════════════════════════════════════════

import { eq, desc, sql } from 'drizzle-orm';
import { getDrizzle } from '../connection';
import { tradeLog, type TradeLogEntry, type NewTradeLogEntry } from '../schema';

export class TradeLogRepository {
  /**
   * Create a new trade log entry
   */
  static create(data: NewTradeLogEntry): TradeLogEntry {
    const db = getDrizzle();

    const result = db
      .insert(tradeLog)
      .values({
        ...data,
        timestamp: data.timestamp || new Date().toISOString(),
      })
      .run();

    return db
      .select()
      .from(tradeLog)
      .where(eq(tradeLog.id, Number(result.lastInsertRowid)))
      .get()!;
  }

  /**
   * Get all trades, ordered by most recent
   */
  static getAll(limit = 100, offset = 0): TradeLogEntry[] {
    const db = getDrizzle();
    return db
      .select()
      .from(tradeLog)
      .orderBy(desc(tradeLog.timestamp))
      .limit(limit)
      .offset(offset)
      .all();
  }

  /**
   * Get trades for a specific coin
   */
  static getByCoin(coin: string, limit = 100): TradeLogEntry[] {
    const db = getDrizzle();
    return db
      .select()
      .from(tradeLog)
      .where(eq(tradeLog.coin, coin))
      .orderBy(desc(tradeLog.timestamp))
      .limit(limit)
      .all();
  }

  /**
   * Get trade by ID
   */
  static getById(id: number): TradeLogEntry | undefined {
    const db = getDrizzle();
    return db
      .select()
      .from(tradeLog)
      .where(eq(tradeLog.id, id))
      .get();
  }

  /**
   * Get total count of trades
   */
  static getCount(): number {
    const db = getDrizzle();
    const result = db
      .select({ count: sql<number>`count(*)` })
      .from(tradeLog)
      .get();
    return result?.count || 0;
  }

  /**
   * Get trades by action (COMPRAR/VENDER)
   */
  static getByAction(action: string, limit = 100): TradeLogEntry[] {
    const db = getDrizzle();
    return db
      .select()
      .from(tradeLog)
      .where(eq(tradeLog.decision, action))
      .orderBy(desc(tradeLog.timestamp))
      .limit(limit)
      .all();
  }

  /**
   * Get recent trades (last N hours)
   */
  static getRecent(hours: number = 24): TradeLogEntry[] {
    const db = getDrizzle();
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    return db
      .select()
      .from(tradeLog)
      .where(sql`${tradeLog.timestamp} >= ${cutoff}`)
      .orderBy(desc(tradeLog.timestamp))
      .all();
  }
}
