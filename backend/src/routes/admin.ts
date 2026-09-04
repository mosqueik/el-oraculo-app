// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Admin Routes
// User management, revenue tracking, system health
// ═══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getDb } from '../database/connection';
import { UserRepository } from '../database/repositories';
import { logger } from '../utils/logger';

const router = Router();

// ─── Admin Middleware ────────────────────────────────────────────
function requireAdmin(req: AuthRequest, res: Response, next: Function) {
  // For now, any authenticated user is admin
  // In production, check user.role === 'admin'
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ─── GET /api/admin/dashboard ────────────────────────────────────
// Complete admin dashboard data
router.get('/admin/dashboard', authenticate, requireAdmin, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();

    // User stats
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const usersByPlan = db.prepare(`
      SELECT plan, COUNT(*) as count FROM users GROUP BY plan
    `).all() as Array<{ plan: string; count: number }>;

    // Revenue stats
    const totalRevenue = db.prepare(`
      SELECT SUM(amount) as total FROM invoices WHERE status = 'paid'
    `).get() as { total: number };
    const revenueThisMonth = db.prepare(`
      SELECT SUM(amount) as total FROM invoices 
      WHERE status = 'paid' AND created_at >= date('now', 'start of month')
    `).get() as { total: number };

    // Subscription stats
    const activeSubscriptions = db.prepare(`
      SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'
    `).get() as { count: number };
    const subscriptionsByPlan = db.prepare(`
      SELECT plan, COUNT(*) as count FROM subscriptions WHERE status = 'active' GROUP BY plan
    `).all() as Array<{ plan: string; count: number }>;

    // Trading stats
    const totalTrades = db.prepare('SELECT COUNT(*) as count FROM trade_log').get() as { count: number };
    const tradesToday = db.prepare(`
      SELECT COUNT(*) as count FROM trade_log WHERE timestamp LIKE ?
    `).get(`${new Date().toISOString().split('T')[0]}%`) as { count: number };

    // Decision stats
    const totalDecisions = db.prepare('SELECT COUNT(*) as count FROM decision_snapshot').get() as { count: number };
    const decisionsByType = db.prepare(`
      SELECT decision, COUNT(*) as count FROM decision_snapshot GROUP BY decision
    `).all() as Array<{ decision: string; count: number }>;

    // Recent activity
    const recentTrades = db.prepare(`
      SELECT * FROM trade_log ORDER BY timestamp DESC LIMIT 10
    `).all();

    const recentUsers = db.prepare(`
      SELECT id, email, name, plan, created_at FROM users ORDER BY created_at DESC LIMIT 10
    `).all();

    // System health
    const dbSize = db.prepare(`
      SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()
    `).get() as { size: number };

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers.count,
          byPlan: usersByPlan.reduce((acc, r) => ({ ...acc, [r.plan]: r.count }), {}),
        },
        revenue: {
          total: (totalRevenue.total || 0) / 100, // Convert cents to dollars
          thisMonth: (revenueThisMonth.total || 0) / 100,
        },
        subscriptions: {
          active: activeSubscriptions.count,
          byPlan: subscriptionsByPlan.reduce((acc, r) => ({ ...acc, [r.plan]: r.count }), {}),
        },
        trading: {
          totalTrades: totalTrades.count,
          tradesToday: tradesToday.count,
          totalDecisions: totalDecisions.count,
          decisionsByType: decisionsByType.reduce((acc, r) => ({ ...acc, [r.decision]: r.count }), {}),
        },
        recentTrades,
        recentUsers,
        system: {
          databaseSizeBytes: dbSize.size || 0,
          databaseSizeMB: ((dbSize.size || 0) / (1024 * 1024)).toFixed(2),
          uptime: process.uptime(),
          memoryMB: (process.memoryUsage().rss / (1024 * 1024)).toFixed(2),
        },
      },
    });
  } catch (error) {
    logger.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Failed to load admin dashboard' });
  }
});

// ─── GET /api/admin/users ────────────────────────────────────────
// List all users with pagination
router.get('/admin/users', authenticate, requireAdmin, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const users = db.prepare(`
      SELECT id, email, name, plan, created_at, updated_at 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    const total = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total: total.count,
          pages: Math.ceil(total.count / limit),
        },
      },
    });
  } catch (error) {
    logger.error('Admin users error:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// ─── GET /api/admin/users/:id ────────────────────────────────────
// Get user details
router.get('/admin/users/:id', authenticate, requireAdmin, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const user = db.prepare(`
      SELECT id, email, name, plan, created_at, updated_at 
      FROM users WHERE id = ?
    `).get(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's subscriptions
    const subscriptions = db.prepare(`
      SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC
    `).all(id);

    // Get user's invoices
    const invoices = db.prepare(`
      SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
    `).all(id);

    // Get user's custom indicators
    const indicators = db.prepare(`
      SELECT * FROM custom_indicators WHERE user_id = ?
    `).all(id);

    // Get user's alert configs
    const alerts = db.prepare(`
      SELECT * FROM alert_config WHERE user_id = ?
    `).all(id);

    res.json({
      success: true,
      data: {
        user,
        subscriptions,
        invoices,
        indicators,
        alerts,
      },
    });
  } catch (error) {
    logger.error('Admin user detail error:', error);
    res.status(500).json({ error: 'Failed to get user details' });
  }
});

// ─── PUT /api/admin/users/:id/plan ───────────────────────────────
// Update user plan
router.put('/admin/users/:id/plan', authenticate, requireAdmin, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { plan } = req.body;

    if (!['free', 'pro', 'enterprise'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Must be: free, pro, enterprise' });
    }

    const result = db.prepare(`
      UPDATE users SET plan = ?, updated_at = datetime('now') WHERE id = ?
    `).run(plan, id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info(`👤 Admin updated user ${id} plan to ${plan}`);
    res.json({ success: true, message: `User plan updated to ${plan}` });
  } catch (error) {
    logger.error('Admin update plan error:', error);
    res.status(500).json({ error: 'Failed to update user plan' });
  }
});

// ─── DELETE /api/admin/users/:id ─────────────────────────────────
// Delete user (soft delete by anonymizing)
router.delete('/admin/users/:id', authenticate, requireAdmin, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;

    // Anonymize user data (soft delete)
    const result = db.prepare(`
      UPDATE users SET 
        email = 'deleted_' || id || '@deleted.com',
        name = 'Deleted User',
        password_hash = '',
        api_key_encrypted = '',
        api_secret_encrypted = '',
        updated_at = datetime('now')
      WHERE id = ?
    `).run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Cancel active subscriptions
    db.prepare(`
      UPDATE subscriptions SET status = 'canceled', updated_at = datetime('now')
      WHERE user_id = ? AND status = 'active'
    `).run(id);

    logger.warn(`👤 Admin deleted user ${id}`);
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    logger.error('Admin delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ─── GET /api/admin/revenue ──────────────────────────────────────
// Revenue analytics
router.get('/admin/revenue', authenticate, requireAdmin, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();

    // Monthly revenue (last 12 months)
    const monthlyRevenue = db.prepare(`
      SELECT 
        strftime('%Y-%m', created_at) as month,
        SUM(amount) / 100.0 as revenue,
        COUNT(*) as transactions
      FROM invoices 
      WHERE status = 'paid' AND created_at >= date('now', '-12 months')
      GROUP BY month
      ORDER BY month
    `).all();

    // Revenue by plan
    const revenueByPlan = db.prepare(`
      SELECT 
        s.plan,
        SUM(i.amount) / 100.0 as revenue,
        COUNT(DISTINCT i.id) as transactions
      FROM invoices i
      JOIN subscriptions s ON i.user_id = s.user_id
      WHERE i.status = 'paid'
      GROUP BY s.plan
    `).all();

    // Total metrics
    const totalRevenue = db.prepare(`
      SELECT SUM(amount) / 100.0 as total FROM invoices WHERE status = 'paid'
    `).get() as { total: number };

    const mrr = db.prepare(`
      SELECT SUM(amount) / 100.0 as total FROM subscriptions 
      WHERE status = 'active' AND plan IN ('pro', 'enterprise')
    `).get() as { total: number };

    res.json({
      success: true,
      data: {
        totalRevenue: totalRevenue.total || 0,
        mrr: mrr.total || 0,
        monthlyRevenue,
        revenueByPlan,
      },
    });
  } catch (error) {
    logger.error('Admin revenue error:', error);
    res.status(500).json({ error: 'Failed to get revenue data' });
  }
});

// ─── GET /api/admin/system ───────────────────────────────────────
// System health and performance
router.get('/admin/system', authenticate, requireAdmin, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();

    // Database stats
    const tables = [
      'trade_log', 'execution_log', 'decision_snapshot', 'daily_summary',
      'bot_state', 'users', 'subscriptions', 'invoices',
    ];

    const tableStats = tables.map(table => {
      try {
        const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
        return { table, rows: count.count };
      } catch {
        return { table, rows: 0 };
      }
    });

    // Memory usage
    const mem = process.memoryUsage();

    // Event loop lag
    const eventLoopLag = new Promise<number>((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1e6;
        resolve(lag);
      });
    });

    eventLoopLag.then(lag => {
      res.json({
        success: true,
        data: {
          uptime: process.uptime(),
          memory: {
            heapUsed: (mem.heapUsed / (1024 * 1024)).toFixed(2) + ' MB',
            heapTotal: (mem.heapTotal / (1024 * 1024)).toFixed(2) + ' MB',
            rss: (mem.rss / (1024 * 1024)).toFixed(2) + ' MB',
          },
          eventLoopLag: lag.toFixed(2) + ' ms',
          tables: tableStats,
          nodeVersion: process.version,
          platform: process.platform,
        },
      });
    });
  } catch (error) {
    logger.error('Admin system error:', error);
    res.status(500).json({ error: 'Failed to get system info' });
  }
});

// ─── GET /api/admin/trades ───────────────────────────────────────
// Trade analytics for admin
router.get('/admin/trades', authenticate, requireAdmin, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const days = parseInt(req.query.days as string) || 7;

    // Trades per day
    const tradesPerDay = db.prepare(`
      SELECT 
        date(timestamp) as date,
        COUNT(*) as total,
        SUM(CASE WHEN decision = 'COMPRAR' THEN 1 ELSE 0 END) as buys,
        SUM(CASE WHEN decision = 'VENDER' THEN 1 ELSE 0 END) as sells
      FROM trade_log
      WHERE timestamp >= date('now', '-${days} days')
      GROUP BY date(timestamp)
      ORDER BY date
    `).all();

    // Win rate by coin
    const winRateByCoin = db.prepare(`
      SELECT 
        coin,
        COUNT(*) as totalSells,
        SUM(CASE WHEN CAST(pnl AS REAL) > 0 THEN 1 ELSE 0 END) as wins
      FROM trade_log
      WHERE decision = 'VENDER' AND pnl IS NOT NULL
      GROUP BY coin
    `).all();

    // Average PnL by coin
    const avgPnlByCoin = db.prepare(`
      SELECT 
        coin,
        AVG(CAST(pnl AS REAL)) as avgPnl,
        MIN(CAST(pnl AS REAL)) as minPnl,
        MAX(CAST(pnl AS REAL)) as maxPnl
      FROM trade_log
      WHERE decision = 'VENDER' AND pnl IS NOT NULL
      GROUP BY coin
    `).all();

    res.json({
      success: true,
      data: {
        tradesPerDay,
        winRateByCoin: winRateByCoin.map((r: any) => ({
          ...r,
          winRate: r.totalSells > 0 ? ((r.wins / r.totalSells) * 100).toFixed(1) + '%' : '0%',
        })),
        avgPnlByCoin,
      },
    });
  } catch (error) {
    logger.error('Admin trades error:', error);
    res.status(500).json({ error: 'Failed to get trade analytics' });
  }
});

export default router;
