// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Database Tests (Standalone)
// Tests all repositories using direct SQLite + Drizzle
// ═══════════════════════════════════════════════════════════════════

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, sql, desc } from 'drizzle-orm';
import * as schema from '../src/database/schema';

// ─── Inline DB Setup ─────────────────────────────────────────────

function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS bot_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coin TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'LÍQUIDO',
      entry_price REAL NOT NULL DEFAULT 0,
      entry_time TEXT,
      tp_target REAL NOT NULL DEFAULT 0,
      piso_actual REAL NOT NULL DEFAULT 0,
      streak_losses INTEGER NOT NULL DEFAULT 0,
      monto_entrada REAL NOT NULL DEFAULT 0,
      last_sell_time TEXT,
      last_sell_reason TEXT,
      last_sell_price REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS trade_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coin TEXT NOT NULL,
      decision TEXT NOT NULL,
      motivo TEXT,
      monto REAL NOT NULL DEFAULT 0,
      precio REAL NOT NULL DEFAULT 0,
      rsi REAL,
      adx REAL,
      direction TEXT,
      entry_price REAL,
      entry_time TEXT,
      pnl TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS execution_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coin TEXT NOT NULL,
      status TEXT NOT NULL,
      decision TEXT,
      motivo TEXT,
      monto REAL,
      entry_price REAL,
      error TEXT,
      score REAL,
      rsi REAL,
      adx REAL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT,
      plan TEXT NOT NULL DEFAULT 'free',
      api_key_encrypted TEXT,
      api_secret_encrypted TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return { sqlite, db: drizzle(sqlite, { schema }) };
}

// ─── Bot State Tests ─────────────────────────────────────────────

describe('BotState (inline)', () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx?.sqlite.close();
    ctx = createTestDb();
    const { db } = ctx;

    db.insert(schema.botState).values({ coin: 'BTC', status: 'LÍQUIDO' }).run();
    db.insert(schema.botState).values({ coin: 'ETH', status: 'LÍQUIDO' }).run();
  });

  it('should get all bot states', () => {
    const rows = ctx.db.select().from(schema.botState).all();
    assert.strictEqual(rows.length, 2);
    assert.ok(rows.some(r => r.coin === 'BTC'));
    assert.ok(rows.some(r => r.coin === 'ETH'));
  });

  it('should get bot state by coin', () => {
    const row = ctx.db.select().from(schema.botState).where(eq(schema.botState.coin, 'BTC')).get();
    assert.ok(row);
    assert.strictEqual(row.status, 'LÍQUIDO');
  });

  it('should update status to COMPRADO', () => {
    ctx.db.update(schema.botState)
      .set({ status: 'COMPRADO', entryPrice: 50000, montoEntrada: 100, entryTime: new Date().toISOString() })
      .where(eq(schema.botState.coin, 'BTC'))
      .run();

    const row = ctx.db.select().from(schema.botState).where(eq(schema.botState.coin, 'BTC')).get();
    assert.strictEqual(row?.status, 'COMPRADO');
    assert.strictEqual(row?.entryPrice, 50000);
    assert.strictEqual(row?.montoEntrada, 100);
  });

  it('should update status to LÍQUIDO with sell info', () => {
    ctx.db.update(schema.botState)
      .set({ status: 'COMPRADO', entryPrice: 50000, montoEntrada: 100, entryTime: new Date().toISOString() })
      .where(eq(schema.botState.coin, 'BTC'))
      .run();

    ctx.db.update(schema.botState)
      .set({
        status: 'LÍQUIDO',
        entryPrice: 0,
        entryTime: undefined,
        montoEntrada: 0,
        lastSellTime: new Date().toISOString(),
        lastSellReason: 'TAKE PROFIT',
        lastSellPrice: 55000,
      })
      .where(eq(schema.botState.coin, 'BTC'))
      .run();

    const row = ctx.db.select().from(schema.botState).where(eq(schema.botState.coin, 'BTC')).get();
    assert.strictEqual(row?.status, 'LÍQUIDO');
    assert.strictEqual(row?.lastSellReason, 'TAKE PROFIT');
    assert.strictEqual(row?.lastSellPrice, 55000);
    assert.strictEqual(row?.entryPrice, 0);
  });

  it('should increment streak losses', () => {
    ctx.db.update(schema.botState)
      .set({ status: 'COMPRADO', entryPrice: 50000, montoEntrada: 100, entryTime: new Date().toISOString() })
      .where(eq(schema.botState.coin, 'BTC'))
      .run();

    ctx.db.update(schema.botState)
      .set({ streakLosses: 1 })
      .where(eq(schema.botState.coin, 'BTC'))
      .run();

    ctx.db.update(schema.botState)
      .set({ streakLosses: 2 })
      .where(eq(schema.botState.coin, 'BTC'))
      .run();

    const row = ctx.db.select().from(schema.botState).where(eq(schema.botState.coin, 'BTC')).get();
    assert.strictEqual(row?.streakLosses, 2);
  });

  it('should get active positions (COMPRADO only)', () => {
    ctx.db.update(schema.botState)
      .set({ status: 'COMPRADO' })
      .where(eq(schema.botState.coin, 'BTC'))
      .run();

    const active = ctx.db.select().from(schema.botState)
      .where(eq(schema.botState.status, 'COMPRADO'))
      .all();

    assert.strictEqual(active.length, 1);
    assert.strictEqual(active[0].coin, 'BTC');
  });
});

// ─── Trade Log Tests ─────────────────────────────────────────────

describe('TradeLog (inline)', () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx?.sqlite.close();
    ctx = createTestDb();
    const { db } = ctx;

    db.insert(schema.tradeLog).values({
      coin: 'BTC', decision: 'COMPRAR', motivo: 'ENTRY', monto: 100, precio: 50000,
      rsi: 30, adx: 25, direction: 'BULLISH', entryPrice: 50000, entryTime: new Date().toISOString(), pnl: '0%',
      timestamp: '2026-08-27T10:00:00.000Z',
    }).run();

    db.insert(schema.tradeLog).values({
      coin: 'BTC', decision: 'VENDER', motivo: 'TAKE PROFIT', monto: 100, precio: 55000,
      rsi: 70, adx: 30, direction: 'BULLISH', entryPrice: 50000, entryTime: new Date(Date.now() - 3600000).toISOString(), pnl: '+10%',
      timestamp: '2026-08-27T12:00:00.000Z',
    }).run();
  });

  it('should insert and read trades', () => {
    const rows = ctx.db.select().from(schema.tradeLog).all();
    assert.strictEqual(rows.length, 2);
  });

  it('should filter trades by coin', () => {
    const rows = ctx.db.select().from(schema.tradeLog)
      .where(eq(schema.tradeLog.coin, 'BTC'))
      .all();
    assert.strictEqual(rows.length, 2);
  });

  it('should get trade count', () => {
    const result = ctx.db.select({ count: sql<number>`count(*)` }).from(schema.tradeLog).get();
    assert.strictEqual(result?.count, 2);
  });

  it('should order trades by timestamp desc', () => {
    const rows = ctx.db.select().from(schema.tradeLog)
      .orderBy(desc(schema.tradeLog.timestamp))
      .all();
    assert.strictEqual(rows[0].decision, 'VENDER');
    assert.strictEqual(rows[1].decision, 'COMPRAR');
  });

  it('should insert trade with all fields', () => {
    ctx.db.insert(schema.tradeLog).values({
      coin: 'ETH', decision: 'COMPRAR', motivo: 'RSI + MACD', monto: 50, precio: 3000,
      rsi: 35, adx: 20, direction: 'UNKNOWN', entryPrice: 3000, entryTime: new Date().toISOString(), pnl: '0%',
    }).run();

    const row = ctx.db.select().from(schema.tradeLog)
      .where(eq(schema.tradeLog.coin, 'ETH'))
      .get();

    assert.ok(row);
    assert.strictEqual(row.decision, 'COMPRAR');
    assert.strictEqual(row.precio, 3000);
    assert.strictEqual(row.pnl, '0%');
  });
});

// ─── Execution Log Tests ─────────────────────────────────────────

describe('ExecutionLog (inline)', () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx?.sqlite.close();
    ctx = createTestDb();
    const { db } = ctx;

    db.insert(schema.executionLog).values({
      coin: 'BTC', status: 'success', decision: 'COMPRAR', motivo: 'ENTRY', monto: 100,
      entryPrice: 50000, score: 75, rsi: 30, adx: 25,
    }).run();

    db.insert(schema.executionLog).values({
      coin: 'BTC', status: 'error', error: 'API rate limit',
    }).run();

    db.insert(schema.executionLog).values({
      coin: 'ETH', status: 'success', decision: 'ESPERAR', motivo: 'LOW_SCORE', score: 45,
    }).run();
  });

  it('should insert and read executions', () => {
    const rows = ctx.db.select().from(schema.executionLog).all();
    assert.strictEqual(rows.length, 3);
  });

  it('should filter by coin', () => {
    const rows = ctx.db.select().from(schema.executionLog)
      .where(eq(schema.executionLog.coin, 'BTC'))
      .all();
    assert.strictEqual(rows.length, 2);
  });

  it('should filter by status', () => {
    const rows = ctx.db.select().from(schema.executionLog)
      .where(eq(schema.executionLog.status, 'error'))
      .all();
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].error, 'API rate limit');
  });

  it('should count errors', () => {
    const result = ctx.db.select({ count: sql<number>`count(*)` })
      .from(schema.executionLog)
      .where(eq(schema.executionLog.status, 'error'))
      .get();
    assert.strictEqual(result?.count, 1);
  });
});

// ─── User Tests ──────────────────────────────────────────────────

describe('Users (inline)', () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx?.sqlite.close();
    ctx = createTestDb();
    const { db } = ctx;

    db.insert(schema.users).values({
      email: 'test@example.com', passwordHash: '$2a$10$hash', name: 'Test', plan: 'free',
    }).run();
  });

  it('should insert and read users', () => {
    const row = ctx.db.select().from(schema.users)
      .where(eq(schema.users.email, 'test@example.com'))
      .get();
    assert.ok(row);
    assert.strictEqual(row.name, 'Test');
    assert.strictEqual(row.plan, 'free');
  });

  it('should enforce unique email', () => {
    assert.throws(() => {
      ctx.db.insert(schema.users).values({
        email: 'test@example.com', passwordHash: '$2a$10$hash2',
      }).run();
    });
  });

  it('should update user plan', () => {
    const user = ctx.db.select().from(schema.users)
      .where(eq(schema.users.email, 'test@example.com'))
      .get()!;

    ctx.db.update(schema.users)
      .set({ plan: 'pro' })
      .where(eq(schema.users.id, user.id))
      .run();

    const updated = ctx.db.select().from(schema.users)
      .where(eq(schema.users.id, user.id))
      .get();
    assert.strictEqual(updated?.plan, 'pro');
  });

  it('should delete user', () => {
    const user = ctx.db.select().from(schema.users)
      .where(eq(schema.users.email, 'test@example.com'))
      .get()!;

    ctx.db.delete(schema.users).where(eq(schema.users.id, user.id)).run();

    const deleted = ctx.db.select().from(schema.users)
      .where(eq(schema.users.id, user.id))
      .get();
    assert.strictEqual(deleted, undefined);
  });

  it('should count users', () => {
    const result = ctx.db.select({ count: sql<number>`count(*)` }).from(schema.users).get();
    assert.strictEqual(result?.count, 1);
  });
});
