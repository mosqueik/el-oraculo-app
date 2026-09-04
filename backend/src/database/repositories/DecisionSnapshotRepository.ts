// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Decision Snapshot Repository
// ═══════════════════════════════════════════════════════════════════
//
// Logs the full pipeline state at each decision point.
// Replaces Google Sheets logging with structured database entries.
// ═══════════════════════════════════════════════════════════════════

import { eq, desc, sql, and, gte, lte } from 'drizzle-orm';
import { getDrizzle } from '../connection';
import { decisionSnapshot, type DecisionSnapshotEntry, type NewDecisionSnapshotEntry } from '../schema';

export class DecisionSnapshotRepository {
  /**
   * Create a new decision snapshot
   */
  static create(data: NewDecisionSnapshotEntry): DecisionSnapshotEntry {
    const db = getDrizzle();

    const result = db
      .insert(decisionSnapshot)
      .values({
        ...data,
        entryReasons: data.entryReasons ? JSON.stringify(data.entryReasons) : null,
        timestamp: data.timestamp || new Date().toISOString(),
      })
      .run();

    return db
      .select()
      .from(decisionSnapshot)
      .where(eq(decisionSnapshot.id, Number(result.lastInsertRowid)))
      .get()!;
  }

  /**
   * Get all snapshots, ordered by most recent
   */
  static getAll(limit = 100, offset = 0): DecisionSnapshotEntry[] {
    const db = getDrizzle();
    return db
      .select()
      .from(decisionSnapshot)
      .orderBy(desc(decisionSnapshot.timestamp))
      .limit(limit)
      .offset(offset)
      .all();
  }

  /**
   * Get snapshots for a specific coin
   */
  static getByCoin(coin: string, limit = 100): DecisionSnapshotEntry[] {
    const db = getDrizzle();
    return db
      .select()
      .from(decisionSnapshot)
      .where(eq(decisionSnapshot.coin, coin))
      .orderBy(desc(decisionSnapshot.timestamp))
      .limit(limit)
      .all();
  }

  /**
   * Get snapshots by decision type
   */
  static getByDecision(decision: string, limit = 100): DecisionSnapshotEntry[] {
    const db = getDrizzle();
    return db
      .select()
      .from(decisionSnapshot)
      .where(eq(decisionSnapshot.decision, decision))
      .orderBy(desc(decisionSnapshot.timestamp))
      .limit(limit)
      .all();
  }

  /**
   * Get snapshots within a time range
   */
  static getByTimeRange(startDate: string, endDate: string, coin?: string): DecisionSnapshotEntry[] {
    const db = getDrizzle();
    const conditions = [
      gte(decisionSnapshot.timestamp, startDate),
      lte(decisionSnapshot.timestamp, endDate),
    ];

    if (coin) {
      conditions.push(eq(decisionSnapshot.coin, coin));
    }

    return db
      .select()
      .from(decisionSnapshot)
      .where(and(...conditions))
      .orderBy(desc(decisionSnapshot.timestamp))
      .all();
  }

  /**
   * Get recent snapshots (last N hours)
   */
  static getRecent(hours: number = 24): DecisionSnapshotEntry[] {
    const db = getDrizzle();
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    return db
      .select()
      .from(decisionSnapshot)
      .where(gte(decisionSnapshot.timestamp, cutoff))
      .orderBy(desc(decisionSnapshot.timestamp))
      .all();
  }

  /**
   * Get snapshot by ID
   */
  static getById(id: number): DecisionSnapshotEntry | undefined {
    const db = getDrizzle();
    return db
      .select()
      .from(decisionSnapshot)
      .where(eq(decisionSnapshot.id, id))
      .get();
  }

  /**
   * Get total count
   */
  static getCount(): number {
    const db = getDrizzle();
    const result = db
      .select({ count: sql<number>`count(*)` })
      .from(decisionSnapshot)
      .get();
    return result?.count || 0;
  }

  /**
   * Get count by decision type
   */
  static getCountByDecision(): Record<string, number> {
    const db = getDrizzle();
    const results = db
      .select({
        decision: decisionSnapshot.decision,
        count: sql<number>`count(*)`,
      })
      .from(decisionSnapshot)
      .groupBy(decisionSnapshot.decision)
      .all();

    const counts: Record<string, number> = {};
    for (const row of results) {
      counts[row.decision] = row.count;
    }
    return counts;
  }

  /**
   * Get latest snapshot for each coin
   */
  static getLatestPerCoin(): DecisionSnapshotEntry[] {
    const db = getDrizzle();

    // Get the max ID for each coin (most recent)
    const latestIds = db
      .select({
        maxId: sql<number>`max(${decisionSnapshot.id})`,
      })
      .from(decisionSnapshot)
      .groupBy(decisionSnapshot.coin)
      .all();

    if (latestIds.length === 0) return [];

    const ids = latestIds.map(r => r.maxId);
    return db
      .select()
      .from(decisionSnapshot)
      .where(sql`${decisionSnapshot.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`)
      .all();
  }

  /**
   * Get performance stats by coin
   */
  static getPerformanceByCoin(): Array<{
    coin: string;
    totalDecisions: number;
    buys: number;
    sells: number;
    avgScore: number;
    avgCycleMs: number;
  }> {
    const db = getDrizzle();

    return db
      .select({
        coin: decisionSnapshot.coin,
        totalDecisions: sql<number>`count(*)`,
        buys: sql<number>`sum(case when ${decisionSnapshot.decision} = 'COMPRAR' then 1 else 0 end)`,
        sells: sql<number>`sum(case when ${decisionSnapshot.decision} = 'VENDER' then 1 else 0 end)`,
        avgScore: sql<number>`avg(${decisionSnapshot.entryScore})`,
        avgCycleMs: sql<number>`avg(${decisionSnapshot.cycleMs})`,
      })
      .from(decisionSnapshot)
      .groupBy(decisionSnapshot.coin)
      .all();
  }

  /**
   * Delete snapshots older than N days
   */
  static cleanupOlderThan(days: number): number {
    const db = getDrizzle();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const result = db
      .delete(decisionSnapshot)
      .where(sql`${decisionSnapshot.timestamp} < ${cutoff}`)
      .run();

    return result.changes;
  }
}
