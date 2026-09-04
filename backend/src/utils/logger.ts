// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Logger (Winston + Daily Rotation)
// ═══════════════════════════════════════════════════════════════════

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

// ─── Config ─────────────────────────────────────────────────────
const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const NODE_ENV = process.env.NODE_ENV || 'development';
const MAX_FILES = process.env.LOG_MAX_FILES || '30d';
const MAX_SIZE = process.env.LOG_MAX_SIZE || '20m';

// ─── Log Format ─────────────────────────────────────────────────
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${message}${metaStr}`;
  })
);

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const simpleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level.toUpperCase().padEnd(5)}] ${message}${metaStr}`;
  })
);

// ─── Transports ─────────────────────────────────────────────────

// Console transport (always enabled)
const consoleTransport = new winston.transports.Console({
  format: consoleFormat,
  level: LOG_LEVEL,
});

// Error log (daily rotation, errors only)
const errorRotateTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  format: fileFormat,
  maxSize: MAX_SIZE,
  maxFiles: MAX_FILES,
  zippedArchive: true,
});

// Combined log (daily rotation, all levels)
const combinedRotateTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  format: fileFormat,
  maxSize: MAX_SIZE,
  maxFiles: MAX_FILES,
  zippedArchive: true,
});

// Trading log (daily rotation, trading events only)
const tradingRotateTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'trading-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'info',
  format: fileFormat,
  maxSize: MAX_SIZE,
  maxFiles: MAX_FILES,
  zippedArchive: true,
});

// ─── Create Logger ──────────────────────────────────────────────
export const logger = winston.createLogger({
  level: LOG_LEVEL,
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    trade: 2.5,  // Custom level for trading events
    http: 3,
    debug: 4,
  },
  transports: [
    consoleTransport,
    errorRotateTransport,
    combinedRotateTransport,
  ],
});

// ─── Trading Logger (separate channel) ──────────────────────────
export const tradingLogger = winston.createLogger({
  level: 'info',
  format: fileFormat,
  transports: [
    tradingRotateTransport,
    // Also log trading events to combined
    combinedRotateTransport,
  ],
});

// ─── Log rotation events ────────────────────────────────────────
errorRotateTransport.on('rotate', (oldFilename, newFilename) => {
  logger.info(`📦 Log rotated: ${oldFilename} → ${newFilename}`);
});

combinedRotateTransport.on('rotate', (oldFilename, newFilename) => {
  logger.info(`📦 Log rotated: ${oldFilename} → ${newFilename}`);
});

// ─── Helper Functions ───────────────────────────────────────────

/**
 * Log a trade event
 */
export function logTrade(params: {
  coin: string;
  action: string;
  price: number;
  motivo: string;
  pnl?: string;
}): void {
  const emoji = params.action === 'COMPRAR' ? '🟢' : params.action === 'VENDER' ? '🔴' : '⏳';
  const message = `${emoji} ${params.action} ${params.coin} @ $${params.price.toFixed(4)} | ${params.motivo}`;
  const meta: Record<string, any> = {
    coin: params.coin,
    action: params.action,
    price: params.price,
    motivo: params.motivo,
  };
  if (params.pnl) meta.pnl = params.pnl;

  tradingLogger.info(message, meta);
}

/**
 * Log an error with context
 */
export function logError(error: Error, context?: string): void {
  logger.error(`${context ? `[${context}] ` : ''}${error.message}`, {
    stack: error.stack,
    name: error.name,
    context,
  });
}

/**
 * Log HTTP request
 */
export function logRequest(method: string, url: string, status: number, duration: number): void {
  const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'http';
  logger.log(level, `${method} ${url} ${status} ${duration}ms`);
}

/**
 * Get log file paths
 */
export function getLogFiles(): string[] {
  return [
    path.join(LOG_DIR, 'error.log'),
    path.join(LOG_DIR, 'combined.log'),
    path.join(LOG_DIR, 'trading.log'),
  ];
}

/**
 * Get logger stats
 */
export function getLoggerStats(): {
  level: string;
  transports: number;
  logDir: string;
} {
  return {
    level: LOG_LEVEL,
    transports: logger.transports.length,
    logDir: LOG_DIR,
  };
}
