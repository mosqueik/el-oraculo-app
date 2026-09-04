// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — API Route Tests (Standalone)
// Tests HTTP endpoints using supertest + in-memory SQLite
// ═══════════════════════════════════════════════════════════════════

import { describe, it, beforeEach, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, sql } from 'drizzle-orm';
import * as schema from '../src/database/schema';

// ─── Shared Test DB ──────────────────────────────────────────────

let testSqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

function createTestDb() {
  testSqlite = new Database(':memory:');
  testSqlite.pragma('foreign_keys = ON');
  testSqlite.exec(`
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
  testDb = drizzle(testSqlite, { schema });
}

function cleanDb() {
  testSqlite.exec('DELETE FROM users');
  testSqlite.exec('DELETE FROM execution_log');
  testSqlite.exec('DELETE FROM trade_log');
  testSqlite.exec('DELETE FROM bot_state');
}

// ─── Inline Repository Functions (avoid module mocking) ──────────

function insertBotState(coin: string, status = 'LÍQUIDO', extra: Record<string, any> = {}) {
  testDb.insert(schema.botState).values({ coin, status, ...extra }).run();
}

function getBotState(coin: string) {
  return testDb.select().from(schema.botState).where(eq(schema.botState.coin, coin)).get();
}

function updateBotState(coin: string, data: Record<string, any>) {
  testDb.update(schema.botState).set(data).where(eq(schema.botState.coin, coin)).run();
}

function insertTradeLog(data: Record<string, any>) {
  testDb.insert(schema.tradeLog).values(data).run();
}

function insertExecution(data: Record<string, any>) {
  testDb.insert(schema.executionLog).values(data).run();
}

function getTradeLogs() {
  return testDb.select().from(schema.tradeLog).all();
}

function getExecutions() {
  return testDb.select().from(schema.executionLog).all();
}

// ─── Build Express Apps ──────────────────────────────────────────

function buildPortfolioApp() {
  const app = express();
  app.use(express.json());

  app.get('/api/portfolio', (req, res) => {
    const allStates = testDb.select().from(schema.botState).all();
    res.json({ success: true, data: allStates, count: allStates.length });
  });

  app.get('/api/portfolio/active', (req, res) => {
    const active = testDb.select().from(schema.botState)
      .where(eq(schema.botState.status, 'COMPRADO')).all();
    res.json({ success: true, data: active, count: active.length });
  });

  app.get('/api/portfolio/:coin', (req, res) => {
    const state = testDb.select().from(schema.botState)
      .where(eq(schema.botState.coin, req.params.coin.toUpperCase())).get();
    if (!state) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: state });
  });

  app.post('/api/portfolio/:coin/buy', (req, res) => {
    const { entryPrice, monto } = req.body;
    if (!entryPrice || !monto) return res.status(400).json({ success: false, error: 'Missing fields' });
    updateBotState(req.params.coin.toUpperCase(), {
      status: 'COMPRADO', entryPrice, montoEntrada: monto, entryTime: new Date().toISOString(),
    });
    const state = getBotState(req.params.coin.toUpperCase());
    res.json({ success: true, data: state });
  });

  app.post('/api/portfolio/:coin/sell', (req, res) => {
    const { reason, price } = req.body;
    if (!reason || !price) return res.status(400).json({ success: false, error: 'Missing fields' });
    updateBotState(req.params.coin.toUpperCase(), {
      status: 'LÍQUIDO', entryPrice: 0, lastSellReason: reason, lastSellPrice: price,
    });
    const state = getBotState(req.params.coin.toUpperCase());
    res.json({ success: true, data: state });
  });

  return app;
}

function buildTradesApp() {
  const app = express();

  app.get('/api/trades', (req, res) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const trades = testDb.select().from(schema.tradeLog).all().slice(0, limit);
    res.json({ success: true, data: trades, count: trades.length });
  });

  app.get('/api/trades/:coin', (req, res) => {
    const trades = testDb.select().from(schema.tradeLog)
      .where(eq(schema.tradeLog.coin, req.params.coin.toUpperCase())).all();
    res.json({ success: true, data: trades, count: trades.length });
  });

  return app;
}

function buildExecutionsApp() {
  const app = express();

  app.get('/api/executions', (req, res) => {
    const executions = getExecutions();
    res.json({ success: true, data: executions, count: executions.length });
  });

  app.get('/api/executions/errors', (req, res) => {
    const errors = testDb.select().from(schema.executionLog)
      .where(eq(schema.executionLog.status, 'error')).all();
    res.json({ success: true, data: errors, errorCount: errors.length });
  });

  app.get('/api/executions/:coin', (req, res) => {
    const executions = testDb.select().from(schema.executionLog)
      .where(eq(schema.executionLog.coin, req.params.coin.toUpperCase())).all();
    res.json({ success: true, data: executions, count: executions.length });
  });

  return app;
}

function buildHealthApp() {
  const app = express();
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  return app;
}

// ─── Tests ───────────────────────────────────────────────────────

describe('Health API', () => {
  const app = buildHealthApp();

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
    assert.ok(res.body.timestamp);
  });
});

describe('Portfolio API', () => {
  before(() => { createTestDb(); });
  beforeEach(() => { cleanDb(); insertBotState('BTC'); insertBotState('ETH'); });

  it('GET /api/portfolio returns all coins', async () => {
    const app = buildPortfolioApp();
    const res = await request(app).get('/api/portfolio');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.length, 2);
  });

  it('GET /api/portfolio/active returns only COMPRADO', async () => {
    updateBotState('BTC', { status: 'COMPRADO' });
    const app = buildPortfolioApp();
    const res = await request(app).get('/api/portfolio/active');
    assert.strictEqual(res.body.data.length, 1);
    assert.strictEqual(res.body.data[0].coin, 'BTC');
  });

  it('GET /api/portfolio/BTC returns single coin', async () => {
    const app = buildPortfolioApp();
    const res = await request(app).get('/api/portfolio/BTC');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.coin, 'BTC');
  });

  it('GET /api/portfolio/DOGE returns 404', async () => {
    const app = buildPortfolioApp();
    const res = await request(app).get('/api/portfolio/DOGE');
    assert.strictEqual(res.status, 404);
  });

  it('POST /api/portfolio/BTC/buy marks as COMPRADO', async () => {
    const app = buildPortfolioApp();
    const res = await request(app).post('/api/portfolio/BTC/buy').send({ entryPrice: 50000, monto: 100 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.status, 'COMPRADO');
    assert.strictEqual(res.body.data.entryPrice, 50000);
  });

  it('POST /api/portfolio/BTC/buy returns 400 if missing fields', async () => {
    const app = buildPortfolioApp();
    const res = await request(app).post('/api/portfolio/BTC/buy').send({ entryPrice: 50000 });
    assert.strictEqual(res.status, 400);
  });

  it('POST /api/portfolio/BTC/sell marks as LÍQUIDO', async () => {
    updateBotState('BTC', { status: 'COMPRADO', entryPrice: 50000 });
    const app = buildPortfolioApp();
    const res = await request(app).post('/api/portfolio/BTC/sell').send({ reason: 'TAKE PROFIT', price: 55000 });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.status, 'LÍQUIDO');
    assert.strictEqual(res.body.data.lastSellReason, 'TAKE PROFIT');
  });

  it('POST /api/portfolio/BTC/sell returns 400 if missing fields', async () => {
    const app = buildPortfolioApp();
    const res = await request(app).post('/api/portfolio/BTC/sell').send({ reason: 'TP' });
    assert.strictEqual(res.status, 400);
  });
});

describe('Trades API', () => {
  before(() => { createTestDb(); });
  beforeEach(() => {
    cleanDb();
    insertTradeLog({ coin: 'BTC', decision: 'COMPRAR', motivo: 'ENTRY', monto: 100, precio: 50000, timestamp: '2026-08-27T10:00:00.000Z' });
    insertTradeLog({ coin: 'ETH', decision: 'VENDER', motivo: 'TP', monto: 50, precio: 3500, timestamp: '2026-08-27T12:00:00.000Z' });
  });

  it('GET /api/trades returns all trades', async () => {
    const app = buildTradesApp();
    const res = await request(app).get('/api/trades');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.length, 2);
  });

  it('GET /api/trades/BTC returns BTC trades only', async () => {
    const app = buildTradesApp();
    const res = await request(app).get('/api/trades/BTC');
    assert.strictEqual(res.body.data.length, 1);
    assert.strictEqual(res.body.data[0].coin, 'BTC');
  });

  it('GET /api/trades/ADA returns empty array', async () => {
    const app = buildTradesApp();
    const res = await request(app).get('/api/trades/ADA');
    assert.strictEqual(res.body.data.length, 0);
  });
});

describe('Executions API', () => {
  before(() => { createTestDb(); });
  beforeEach(() => {
    cleanDb();
    insertExecution({ coin: 'BTC', status: 'success', decision: 'COMPRAR', motivo: 'ENTRY', score: 75 });
    insertExecution({ coin: 'BTC', status: 'error', error: 'Rate limit' });
    insertExecution({ coin: 'ETH', status: 'success', decision: 'ESPERAR' });
  });

  it('GET /api/executions returns all', async () => {
    const app = buildExecutionsApp();
    const res = await request(app).get('/api/executions');
    assert.strictEqual(res.body.data.length, 3);
  });

  it('GET /api/executions/errors returns error count', async () => {
    const app = buildExecutionsApp();
    const res = await request(app).get('/api/executions/errors');
    assert.strictEqual(res.body.errorCount, 1);
    assert.strictEqual(res.body.data[0].status, 'error');
  });

  it('GET /api/executions/BTC returns BTC executions', async () => {
    const app = buildExecutionsApp();
    const res = await request(app).get('/api/executions/BTC');
    assert.strictEqual(res.body.data.length, 2);
  });

  it('GET /api/executions/ADA returns empty', async () => {
    const app = buildExecutionsApp();
    const res = await request(app).get('/api/executions/ADA');
    assert.strictEqual(res.body.data.length, 0);
  });

  after(() => { testSqlite?.close(); });
});
