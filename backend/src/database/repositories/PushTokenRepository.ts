// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Push Token Repository
// ═══════════════════════════════════════════════════════════════════

import { eq, desc, sql } from 'drizzle-orm';
import { getDrizzle } from '../connection';
import { pushTokens, type PushToken, type NewPushToken } from '../schema';

export class PushTokenRepository {
  /**
   * Register a new push token
   */
  static register(data: NewPushToken): PushToken {
    const db = getDrizzle();

    // Check if token already exists
    const existing = this.getByToken(data.token);
    if (existing) {
      // Update last used time and active status
      db.update(pushTokens)
        .set({
          active: true,
          lastUsedAt: new Date().toISOString(),
          ...(data.userId ? { userId: data.userId } : {}),
          ...(data.platform ? { platform: data.platform } : {}),
        })
        .where(eq(pushTokens.token, data.token))
        .run();

      return this.getByToken(data.token)!;
    }

    const result = db
      .insert(pushTokens)
      .values({
        ...data,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      })
      .run();

    return db
      .select()
      .from(pushTokens)
      .where(eq(pushTokens.id, Number(result.lastInsertRowid)))
      .get()!;
  }

  /**
   * Get all active push tokens
   */
  static getActive(): PushToken[] {
    const db = getDrizzle();
    return db
      .select()
      .from(pushTokens)
      .where(eq(pushTokens.active, true))
      .orderBy(desc(pushTokens.lastUsedAt))
      .all();
  }

  /**
   * Get push token by token string
   */
  static getByToken(token: string): PushToken | undefined {
    const db = getDrizzle();
    return db
      .select()
      .from(pushTokens)
      .where(eq(pushTokens.token, token))
      .get();
  }

  /**
   * Get push tokens for a specific user
   */
  static getByUserId(userId: number): PushToken[] {
    const db = getDrizzle();
    return db
      .select()
      .from(pushTokens)
      .where(eq(pushTokens.userId, userId))
      .orderBy(desc(pushTokens.lastUsedAt))
      .all();
  }

  /**
   * Deactivate a push token
   */
  static deactivate(token: string): void {
    const db = getDrizzle();
    db.update(pushTokens)
      .set({ active: false })
      .where(eq(pushTokens.token, token))
      .run();
  }

  /**
   * Deactivate all tokens for a user
   */
  static deactivateAllForUser(userId: number): void {
    const db = getDrizzle();
    db.update(pushTokens)
      .set({ active: false })
      .where(eq(pushTokens.userId, userId))
      .run();
  }

  /**
   * Delete old inactive tokens (older than 30 days)
   */
  static cleanup(): number {
    const db = getDrizzle();
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const result = db
      .delete(pushTokens)
      .where(
        sql`${pushTokens.active} = 0 AND ${pushTokens.lastUsedAt} < ${cutoff}`
      )
      .run();

    return result.changes;
  }

  /**
   * Get total active token count
   */
  static getActiveCount(): number {
    const db = getDrizzle();
    const result = db
      .select({ count: sql<number>`count(*)` })
      .from(pushTokens)
      .where(eq(pushTokens.active, true))
      .get();
    return result?.count || 0;
  }
}
