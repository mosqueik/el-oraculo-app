// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Execution Log Repository
// ═══════════════════════════════════════════════════════════════════

import { eq, desc, sql } from 'drizzle-orm';
import { getDrizzle } from '../connection';
import {
  executionLog,
  type ExecutionLogEntry,
  type NewExecutionLogEntry,
} from '../schema';

export class ExecutionRepository {
  /**
   * Create a new execution log entry
   */
  static create(data: NewExecutionLogEntry): ExecutionLogEntry {
    const db = getDrizzle();

    const result = db
      .insert(executionLog)
      .values({
        ...data,
        timestamp: data.timestamp || new Date().toISOString(),
      })
      .run();

    return db
      .select()
      .from(executionLog)
      .where(eq(executionLog.id, Number(result.lastInsertRowid)))
      .get()!;
  }

  /**
   * Get all executions, ordered by most recent
   */
  static getAll(limit = 100, offset = 0): ExecutionLogEntry[] {
    const db = getDrizzle();
    return db
      .select()
      .from(executionLog)
      .orderBy(desc(executionLog.timestamp))
      .limit(limit)
      .offset(offset)
      .all();
  }

  /**
   * Get executions for a specific coin
   */
  static getByCoin(coin: string, limit = 100): ExecutionLogEntry[] {
    const db = getDrizzle();
    return db
      .select()
      .from(executionLog)
      .where(eq(executionLog.coin, coin))
      .orderBy(desc(executionLog.timestamp))
      .limit(limit)
      .all();
  }

  /**
   * Get execution by ID
   */
  static getById(id: number): ExecutionLogEntry | undefined {
    const db = getDrizzle();
    return db
      .select()
      .from(executionLog)
      .where(eq(executionLog.id, id))
      .get();
  }

  /**
   * Get executions by status (success/error/running)
   */
  static getByStatus(
    status: 'success' | 'error' | 'running',
    limit = 100
  ): ExecutionLogEntry[] {
    const db = getDrizzle();
    return db
      .select()
      .from(executionLog)
      .where(eq(executionLog.status, status))
      .orderBy(desc(executionLog.timestamp))
      .limit(limit)
      .all();
  }

  /**
   * Get total count of executions
   */
  static getCount(): number {
    const db = getDrizzle();
    const result = db
      .select({ count: sql<number>`count(*)` })
      .from(executionLog)
      .get();
    return result?.count || 0;
  }

  /**
   * Get recent executions (last N hours)
   */
  static getRecent(hours: number = 24): ExecutionLogEntry[] {
    const db = getDrizzle();
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    return db
      .select()
      .from(executionLog)
      .where(sql`${executionLog.timestamp} >= ${cutoff}`)
      .orderBy(desc(executionLog.timestamp))
      .all();
  }

  /**
   * Get error count in last N hours
   */
  static getErrorCount(hours: number = 24): number {
    const db = getDrizzle();
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const result = db
      .select({ count: sql<number>`count(*)` })
      .from(executionLog)
      .where(
        sql`${executionLog.status} = 'error' AND ${executionLog.timestamp} >= ${cutoff}`
      )
      .get();

    return result?.count || 0;
  }
}
