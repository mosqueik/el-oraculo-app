// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Notification Log Repository
// ═══════════════════════════════════════════════════════════════════

import { eq, desc, sql } from 'drizzle-orm';
import { getDrizzle } from '../connection';
import { notificationLog, type NotificationLogEntry, type NewNotificationLogEntry } from '../schema';

export class NotificationLogRepository {
  /**
   * Create a new notification log entry
   */
  static create(data: NewNotificationLogEntry): NotificationLogEntry {
    const db = getDrizzle();

    const result = db
      .insert(notificationLog)
      .values({
        ...data,
        timestamp: data.timestamp || new Date().toISOString(),
      })
      .run();

    return db
      .select()
      .from(notificationLog)
      .where(eq(notificationLog.id, Number(result.lastInsertRowid)))
      .get()!;
  }

  /**
   * Get all notifications, ordered by most recent
   */
  static getAll(limit = 50, offset = 0): NotificationLogEntry[] {
    const db = getDrizzle();
    return db
      .select()
      .from(notificationLog)
      .orderBy(desc(notificationLog.timestamp))
      .limit(limit)
      .offset(offset)
      .all();
  }

  /**
   * Get notifications for a specific coin
   */
  static getByCoin(coin: string, limit = 50): NotificationLogEntry[] {
    const db = getDrizzle();
    return db
      .select()
      .from(notificationLog)
      .where(eq(notificationLog.coin, coin))
      .orderBy(desc(notificationLog.timestamp))
      .limit(limit)
      .all();
  }

  /**
   * Get recent notifications (last N hours)
   */
  static getRecent(hours: number = 24): NotificationLogEntry[] {
    const db = getDrizzle();
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    return db
      .select()
      .from(notificationLog)
      .where(sql`${notificationLog.timestamp} >= ${cutoff}`)
      .orderBy(desc(notificationLog.timestamp))
      .all();
  }

  /**
   * Get notifications by type
   */
  static getByType(type: string, limit = 50): NotificationLogEntry[] {
    const db = getDrizzle();
    return db
      .select()
      .from(notificationLog)
      .where(eq(notificationLog.type, type))
      .orderBy(desc(notificationLog.timestamp))
      .limit(limit)
      .all();
  }

  /**
   * Get total count
   */
  static getCount(): number {
    const db = getDrizzle();
    const result = db
      .select({ count: sql<number>`count(*)` })
      .from(notificationLog)
      .get();
    return result?.count || 0;
  }

  /**
   * Delete old notifications (older than 30 days)
   */
  static cleanup(): number {
    const db = getDrizzle();
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const result = db
      .delete(notificationLog)
      .where(sql`${notificationLog.timestamp} < ${cutoff}`)
      .run();

    return result.changes;
  }
}
