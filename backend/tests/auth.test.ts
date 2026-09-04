// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Auth Middleware Tests
// Tests JWT generation, verification, authenticate, requirePlan
// ═══════════════════════════════════════════════════════════════════

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, sql } from 'drizzle-orm';
import * as schema from '../src/database/schema';

// ─── Inline DB + Auth Module Setup ──────────────────────────────

let testSqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

const JWT_SECRET = 'test-secret-key-for-testing';

function createTestDb() {
  testSqlite = new Database(':memory:');
  testSqlite.pragma('foreign_keys = ON');
  testSqlite.exec(`
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
    CREATE TABLE IF NOT EXISTS user_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      coin TEXT NOT NULL,
      risk_pct REAL,
      entry_min REAL,
      entry_max REAL,
      custom_settings TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  testDb = drizzle(testSqlite, { schema });
}

function cleanDb() {
  testSqlite.exec('DELETE FROM user_config');
  testSqlite.exec('DELETE FROM users');
}

function insertUser(email: string, password: string, name?: string, plan = 'free') {
  const hash = bcrypt.hashSync(password, 10);
  testDb.insert(schema.users).values({ email, passwordHash: hash, name, plan }).run();
  return testDb.select().from(schema.users).where(eq(schema.users.email, email)).get();
}

function getUser(email: string) {
  return testDb.select().from(schema.users).where(eq(schema.users.email, email)).get();
}

// ─── Inline Auth Functions (mirrors middleware/auth.ts) ──────────

function generateToken(user: { id: number; email: string; plan: string }): string {
  return jwt.sign({ id: user.id, email: user.email, plan: user.plan }, JWT_SECRET, { expiresIn: '24h' });
}

function verifyToken(token: string): any {
  return jwt.verify(token, JWT_SECRET);
}

interface AuthRequest extends Request {
  user?: { id: number; email: string; plan: string };
}

function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    const user = testDb.select().from(schema.users).where(eq(schema.users.id, decoded.id)).get();

    if (!user) {
      res.status(401).json({ success: false, error: 'User not found' });
      return;
    }

    req.user = { id: user.id, email: user.email, plan: user.plan };
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, error: 'Token expired' });
      return;
    }
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

function requirePlan(...plans: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }
    if (!plans.includes(req.user.plan)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions', required: plans, current: req.user.plan });
      return;
    }
    next();
  };
}

// ─── Test Apps ───────────────────────────────────────────────────

function buildProtectedApp() {
  const app = express();
  app.use(express.json());

  app.get('/api/me', authenticate, (req: AuthRequest, res) => {
    res.json({ success: true, data: req.user });
  });

  app.get('/api/admin', authenticate, requirePlan('admin'), (req: AuthRequest, res) => {
    res.json({ success: true, message: 'Admin access granted' });
  });

  app.get('/api/pro-or-admin', authenticate, requirePlan('pro', 'admin'), (req: AuthRequest, res) => {
    res.json({ success: true, message: 'Pro/Admin access granted' });
  });

  return app;
}

// ─── Tests ───────────────────────────────────────────────────────

describe('Auth Middleware', () => {
  before(() => { createTestDb(); });
  beforeEach(() => { cleanDb(); });

  // ─── Token Generation ────────────────────────────────────────

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateToken({ id: 1, email: 'test@example.com', plan: 'free' });
      assert.ok(token);
      assert.ok(typeof token === 'string');
      // JWT has 3 parts separated by dots
      assert.equal(token.split('.').length, 3);
    });

    it('should embed user data in token payload', () => {
      const token = generateToken({ id: 42, email: 'user@test.com', plan: 'pro' });
      const decoded = jwt.decode(token) as any;
      assert.equal(decoded.id, 42);
      assert.equal(decoded.email, 'user@test.com');
      assert.equal(decoded.plan, 'pro');
    });
  });

  // ─── Token Verification ──────────────────────────────────────

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const token = generateToken({ id: 1, email: 'test@example.com', plan: 'free' });
      const decoded = verifyToken(token);
      assert.equal(decoded.id, 1);
      assert.equal(decoded.email, 'test@example.com');
    });

    it('should reject an invalid token', () => {
      assert.throws(() => {
        verifyToken('invalid.token.here');
      }, /invalid/);
    });

    it('should reject a token with wrong secret', () => {
      const token = jwt.sign({ id: 1, email: 'test@test.com', plan: 'free' }, 'wrong-secret', { expiresIn: '1h' });
      assert.throws(() => {
        verifyToken(token);
      }, /invalid signature/);
    });

    it('should reject an expired token', () => {
      // Create a token that expired 1 hour ago
      const token = jwt.sign(
        { id: 1, email: 'test@test.com', plan: 'free' },
        JWT_SECRET,
        { expiresIn: '0s' }
      );
      // Wait a tiny bit to ensure it's expired
      assert.throws(() => {
        verifyToken(token);
      }, jwt.TokenExpiredError);
    });
  });

  // ─── Authenticate Middleware ──────────────────────────────────

  describe('authenticate middleware', () => {
    it('should return 401 if no Authorization header', async () => {
      const app = buildProtectedApp();
      const res = await request(app).get('/api/me');
      assert.equal(res.status, 401);
      assert.equal(res.body.error, 'No token provided');
    });

    it('should return 401 if Authorization header is not Bearer', async () => {
      const app = buildProtectedApp();
      const res = await request(app).get('/api/me').set('Authorization', 'Basic abc123');
      assert.equal(res.status, 401);
      assert.equal(res.body.error, 'No token provided');
    });

    it('should return 401 for invalid token', async () => {
      const app = buildProtectedApp();
      const res = await request(app).get('/api/me').set('Authorization', 'Bearer invalid.token.here');
      assert.equal(res.status, 401);
      assert.equal(res.body.error, 'Invalid token');
    });

    it('should return 401 for expired token', async () => {
      const app = buildProtectedApp();
      const token = jwt.sign({ id: 999, email: 'test@test.com', plan: 'free' }, JWT_SECRET, { expiresIn: '0s' });
      const res = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);
      assert.equal(res.status, 401);
      assert.equal(res.body.error, 'Token expired');
    });

    it('should return 401 if user not found in DB', async () => {
      const app = buildProtectedApp();
      const token = generateToken({ id: 999, email: 'deleted@test.com', plan: 'free' });
      const res = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);
      assert.equal(res.status, 401);
      assert.equal(res.body.error, 'User not found');
    });

    it('should attach user to request for valid token', async () => {
      insertUser('valid@test.com', 'password123', 'Valid User', 'free');
      const user = getUser('valid@test.com');
      const token = generateToken({ id: user!.id, email: user!.email, plan: user!.plan });

      const app = buildProtectedApp();
      const res = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.email, 'valid@test.com');
      assert.equal(res.body.data.plan, 'free');
    });
  });

  // ─── RequirePlan Middleware ───────────────────────────────────

  describe('requirePlan middleware', () => {
    it('should allow access if user has required plan', async () => {
      insertUser('admin@test.com', 'password123', 'Admin', 'admin');
      const user = getUser('admin@test.com');
      const token = generateToken({ id: user!.id, email: user!.email, plan: user!.plan });

      const app = buildProtectedApp();
      const res = await request(app).get('/api/admin').set('Authorization', `Bearer ${token}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.message, 'Admin access granted');
    });

    it('should deny access if user has wrong plan', async () => {
      insertUser('free@test.com', 'password123', 'Free User', 'free');
      const user = getUser('free@test.com');
      const token = generateToken({ id: user!.id, email: user!.email, plan: user!.plan });

      const app = buildProtectedApp();
      const res = await request(app).get('/api/admin').set('Authorization', `Bearer ${token}`);
      assert.equal(res.status, 403);
      assert.equal(res.body.error, 'Insufficient permissions');
      assert.deepEqual(res.body.required, ['admin']);
      assert.equal(res.body.current, 'free');
    });

    it('should allow access if user plan is in the allowed list', async () => {
      insertUser('pro@test.com', 'password123', 'Pro User', 'pro');
      const user = getUser('pro@test.com');
      const token = generateToken({ id: user!.id, email: user!.email, plan: user!.plan });

      const app = buildProtectedApp();
      const res = await request(app).get('/api/pro-or-admin').set('Authorization', `Bearer ${token}`);
      assert.equal(res.status, 200);
    });

    it('should return 401 if not authenticated at all', async () => {
      const app = buildProtectedApp();
      const res = await request(app).get('/api/admin');
      assert.equal(res.status, 401);
    });
  });

  after(() => {
    if (testSqlite) testSqlite.close();
  });
});
