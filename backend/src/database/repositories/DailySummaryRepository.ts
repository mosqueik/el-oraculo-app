// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Daily Summary Repository
// ═══════════════════════════════════════════════════════════════════
//
// Aggregated daily performance summaries.
// Replaces Google Sheets daily rollup with database entries.
// ═══════════════════════════════════════════════════════════════════

import { eq, desc, sql, and, gte, lte } from 'drizzle-orm';
import { getDrizzle } from '../connection';
import { dailySummary, type DailySummaryEntry, type NewDailySummaryEntry } from '../schema';

export class DailySummaryRepository {
  /**
   * Create or update daily summary
   */
  static upsert(data: NewDailySummaryEntry): DailySummaryEntry {
    const db = getDrizzle();

    // Try to get existing entry for this date
    const existing = db
      .select()
      .from(dailySummary)
      .where(eq(dailySummary.date, data.date))
      .get();

    if (existing) {
      // Update existing
      db
        .update(dailySummary)
        .set({
          totalTrades: data.totalTrades,
          buys: data.buys,
          sells: data.sells,
          wins: data.wins,
          losses: data.losses,
          totalPnlPct: data.totalPnlPct,
          bestTrade: data.bestTrade,
          worstTrade: data.worstTrade,
          activePositions: data.activePositions,
          balanceStart: data.balanceStart,
          balanceEnd: data.balanceEnd,
        })
        .where(eq(dailySummary.date, data.date))
        .run();

      return db
        .select()
        .from(dailySummary)
        .where(eq(dailySummary.date, data.date))
        .get()!;
    }

    // Create new
    const result = db
      .insert(dailySummary)
      .values({
        ...data,
        bestTrade: data.bestTrade ? JSON.stringify(data.bestTrade) : null,
        worstTrade: data.worstTrade ? JSON.stringify(data.worstTrade) : null,
        activePositions: data.activePositions ? JSON.stringify(data.activePositions) : null,
        timestamp: new Date().toISOString(),
      })
      .run();

    return db
      .select()
      .from(dailySummary)
      .where(eq(dailySummary.id, Number(result.lastInsertRowid)))
      .get()!;
  }

  /**
   * Get all daily summaries
   */
  static getAll(limit = 30, offset = 0): DailySummaryEntry[] {
    const db = getDrizzle();
    return db
      .select()
      .from(dailySummary)
      .orderBy(desc(dailySummary.date))
      .limit(limit)
      .offset(offset)
      .all();
  }

  /**
   * Get summary for a specific date
   */
  static getByDate(date: string): DailySummaryEntry | undefined {
    const db = getDrizzle();
    return db
      .select()
      .from(dailySummary)
      .where(eq(dailySummary.date, date))
      .get();
  }

  /**
   * Get summaries within a date range
   */
  static getByDateRange(startDate: string, endDate: string): DailySummaryEntry[] {
    const db = getDrizzle();
    return db
      .select()
      .from(dailySummary)
      .where(and(
        gte(dailySummary.date, startDate),
        lte(dailySummary.date, endDate),
      ))
      .orderBy(desc(dailySummary.date))
      .all();
  }

  /**
   * Get the last N days of summaries
   */
  static getLastNDays(days: number): DailySummaryEntry[] {
    const db = getDrizzle();
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    return db
      .select()
      .from(dailySummary)
      .where(gte(dailySummary.date, startDate))
      .orderBy(desc(dailySummary.date))
      .all();
  }

  /**
   * Get aggregated stats for a period
   */
  static getAggregatedStats(startDate: string, endDate: string): {
    totalDays: number;
    totalTrades: number;
    totalWins: number;
    totalLosses: number;
    avgWinRate: number;
    totalPnlPct: number;
    avgDailyPnl: number;
    bestDay: string;
    worstDay: string;
  } {
    const db = getDrizzle();
    const summaries = this.getByDateRange(startDate, endDate);

    if (summaries.length === 0) {
      return {
        totalDays: 0, totalTrades: 0, totalWins: 0, totalLosses: 0,
        avgWinRate: 0, totalPnlPct: 0, avgDailyPnl: 0,
        bestDay: '', worstDay: '',
      };
    }

    const totalTrades = summaries.reduce((s, d) => s + d.totalTrades, 0);
    const totalWins = summaries.reduce((s, d) => s + d.wins, 0);
    const totalLosses = summaries.reduce((s, d) => s + d.losses, 0);
    const totalPnl = summaries.reduce((s, d) => s + d.totalPnlPct, 0);

    const bestDay = summaries.reduce((best, d) =>
      d.totalPnlPct > (best?.totalPnlPct || -Infinity) ? d : best, summaries[0]);
    const worstDay = summaries.reduce((worst, d) =>
      d.totalPnlPct < (worst?.totalPnlPct || Infinity) ? d : worst, summaries[0]);

    return {
      totalDays: summaries.length,
      totalTrades,
      totalWins,
      totalLosses,
      avgWinRate: totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0,
      totalPnlPct: totalPnl,
      avgDailyPnl: totalPnl / summaries.length,
      bestDay: bestDay.date,
      worstDay: worstDay.date,
    };
  }

  /**
   * Get streak info (consecutive winning/losing days)
   */
  static getStreaks(): {
    currentWinStreak: number;
    currentLoseStreak: number;
    maxWinStreak: number;
    maxLoseStreak: number;
  } {
    const summaries = this.getLastNDays(90);

    let currentWinStreak = 0;
    let currentLoseStreak = 0;
    let maxWinStreak = 0;
    let maxLoseStreak = 0;
    let tempWin = 0;
    let tempLose = 0;

    for (const day of summaries.reverse()) {
      if (day.totalPnlPct > 0) {
        tempWin++;
        tempLose = 0;
        maxWinStreak = Math.max(maxWinStreak, tempWin);
      } else if (day.totalPnlPct < 0) {
        tempLose++;
        tempWin = 0;
        maxLoseStreak = Math.max(maxLoseStreak, tempLose);
      } else {
        tempWin = 0;
        tempLose = 0;
      }
    }

    // Current streaks (from most recent)
    for (const day of summaries) {
      if (day.totalPnlPct > 0) {
        if (currentWinStreak === 0 && currentLoseStreak === 0) currentWinStreak = 1;
        else if (currentWinStreak > 0) currentWinStreak++;
        else break;
      } else if (day.totalPnlPct < 0) {
        if (currentWinStreak === 0 && currentLoseStreak === 0) currentLoseStreak = 1;
        else if (currentLoseStreak > 0) currentLoseStreak++;
        else break;
      } else {
        break;
      }
    }

    return { currentWinStreak, currentLoseStreak, maxWinStreak, maxLoseStreak };
  }

  /**
   * Delete summaries older than N days
   */
  static cleanupOlderThan(days: number): number {
    const db = getDrizzle();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const result = db
      .delete(dailySummary)
      .where(sql`${dailySummary.date} < ${cutoff}`)
      .run();

    return result.changes;
  }
}
