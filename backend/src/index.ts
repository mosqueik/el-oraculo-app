// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Backend Entry Point
// ═══════════════════════════════════════════════════════════════════

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { logger, logError } from './utils/logger';
import { getMonitoringService } from './modules/monitoring/service';
import { initializeDatabase } from './database/init';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec, swaggerUiOptions } from './config/swagger';
import { closeDatabase, getDb } from './database/connection';
import { initRateLimitStore, cleanupAllRateLimits } from './middleware/rateLimitStore';
import routes from './routes';
import { setEngineReferences } from './routes/status';
import { setExchangeService } from './routes/balance';
import { setExchangeServiceForKlines } from './routes/klines';
import { setTradingReferences } from './routes/trading';
import { setExchangeReference as setPortfolioExchange } from './routes/portfolio';
import { setDashboardReferences } from './routes/dashboard';
import { initWebSocket } from './ws/server';
import { TradingEngine } from './modules/trading/engine';
import { ExchangeService } from './modules/exchange/service';
import { PriceTicker } from './modules/exchange/priceTicker';
import { Scheduler } from './jobs/scheduler';
import { alertService } from './modules/alerts/service';
import {
  helmetMiddleware,
  corsMiddleware,
  apiLimiter,
  authLimiter,
  writeLimiter,
  ipBlocklist,
  securityLogger,
  requestId,
  requestSizeLimiter,
} from './middleware/security';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ─── Security Middleware Stack ───────────────────────────────────
// Order matters! Apply in this exact order:

// 1. Request ID (first, so all subsequent logs have it)
app.use(requestId);

// 2. Helmet (security headers)
app.use(helmetMiddleware);

// 3. CORS
app.use(corsMiddleware);

// 4. IP Blocklist
app.use(ipBlocklist);

// 5. Security logger (suspicious pattern detection)
app.use(securityLogger);

// 6. Request size limit
app.use(requestSizeLimiter('1mb'));

// 7. Body parser with size limit
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// 8. General rate limiter (all /api routes)
app.use('/api', apiLimiter);

// 9. Write operations rate limiter (POST, PUT, DELETE, PATCH)
app.use('/api', writeLimiter);

// 10. Strict rate limiter for auth endpoints
app.use('/api/auth', authLimiter);

// ─── Request Logging ─────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = (req as any).requestId;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'warn' : 'info';

    logger.log(level, `${req.method} ${req.url} ${res.statusCode} ${duration}ms [${requestId}]`);
  });
  next();
});

// ─── Swagger/OpenAPI Documentation ─────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});
logger.info('📚 Swagger docs available at http://localhost:' + PORT + '/api-docs');

// ─── Admin Dashboard ───────────────────────────────────────────
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});
logger.info('👤 Admin dashboard available at http://localhost:' + PORT + '/admin');

// ─── Static Files (Dashboard) ──────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// ─── API Routes ──────────────────────────────────────────────────
app.use('/api', routes);

// Legacy health check (keep for backwards compatibility)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 Handler ─────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    path: req.originalUrl,
  });
});

// ─── Error Handler ───────────────────────────────────────────────
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logError(err, 'Unhandled Error');

  res.status(500).json({
    success: false,
    error: NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ─── Initialize and Start ────────────────────────────────────────
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('📦 Database initialized');

    // Initialize SQLite rate limit store
    const db = getDb();
    initRateLimitStore(db);
    logger.info('📦 Rate limit store initialized (SQLite)');

    // Initialize WebSocket server
    initWebSocket(httpServer);
    logger.info('🔌 WebSocket initialized');

    // Start HTTP server
    httpServer.listen(PORT, () => {
      logger.info(`🪙 El Oráculo Backend running on port ${PORT}`);
      logger.info(`📡 API available at http://localhost:${PORT}/api`);
      logger.info(`🔌 WebSocket available at ws://localhost:${PORT}`);
      logger.info(`🔒 Security: Helmet + Rate Limiting + CORS enabled`);
      logger.info(`🌍 Environment: ${NODE_ENV}`);
    });

    // Initialize trading engine
    const exchange = new ExchangeService({
      apiKey: process.env.BINANCE_API_KEY || '',
      apiSecret: process.env.BINANCE_API_SECRET || '',
      testnet: false,
    });

    const engine = new TradingEngine(exchange);

    // Start scheduler (runs trading loop every 5 minutes)
    const scheduler = new Scheduler(engine);
    scheduler.start();

    // Start price ticker (broadcasts live prices every 10 seconds)
    const priceTicker = new PriceTicker(exchange, 10000);
    priceTicker.start();

    // Pass references to routes
    setEngineReferences(engine, scheduler);
    setExchangeService(exchange);
    setExchangeServiceForKlines(exchange);
    setTradingReferences(engine, exchange);
    setPortfolioExchange(exchange);
    setDashboardReferences(engine, exchange);
    alertService.setExchange(exchange);

    // Initialize monitoring
    const monitoring = getMonitoringService();
    logger.info('📊 Monitoring initialized');
    logger.info('🔔 Alert service initialized');

    // Log Telegram status
    const { notificationService } = require('./modules/notifications/service');
    const tgConfig = notificationService.getConfig();
    if (tgConfig.configured) {
      logger.info(`📬 Telegram: configured (chat=${tgConfig.chatIdSet}, thread=${tgConfig.threadIdSet}, silent=${tgConfig.silentMode})`);
    } else {
      logger.warn('📬 Telegram: NOT configured — set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID');
    }

    // Graceful shutdown
    const shutdown = (signal: string) => {
      logger.info(`${signal} received. Shutting down gracefully...`);
      scheduler.stop();
      priceTicker.stop();
      closeDatabase();
      httpServer.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Rejection:', reason);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
