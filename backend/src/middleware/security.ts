// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Security Middleware
// Rate limiting, Helmet headers, CORS, request validation
// ═══════════════════════════════════════════════════════════════════

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { getRateLimitStore, createPrefixedStore } from './rateLimitStore';

// ─── Environment ─────────────────────────────────────────────────
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

// ─── Shared Store Config ────────────────────────────────────────
// Returns the SQLite store if initialized, undefined for in-memory fallback
function getStore(prefix?: string) {
  const store = getRateLimitStore();
  if (!store) return undefined; // Use default in-memory store
  if (prefix) {
    return createPrefixedStore(prefix) || undefined;
  }
  return store;
}

// ─── Helmet (Security Headers) ──────────────────────────────────
export const helmetMiddleware = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'wss:', 'ws:'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  // HSTS (HTTP Strict Transport Security)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  // Referrer Policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // X-Frame-Options
  frameguard: { action: 'deny' },
  // X-Content-Type-Options
  noSniff: true,
  // X-XSS-Protection (legacy but still useful)
  xssFilter: true,
  // Hide X-Powered-By
  hidePoweredBy: true,
  // Don't allow IE to open downloads directly
  ieNoOpen: true,
  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },
});

// ─── CORS Configuration ─────────────────────────────────────────
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    // In development, allow all origins
    if (!IS_PRODUCTION) return callback(null, true);

    // In production, check against allowed origins
    const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);

    // Default: allow Fly.io domain and any configured origins
    const flyDomain = process.env.FLY_APP_NAME
      ? `https://${process.env.FLY_APP_NAME}.fly.dev`
      : null;

    const allAllowed = [...allowedOrigins];
    if (flyDomain) allAllowed.push(flyDomain);

    if (allAllowed.length === 0 || allAllowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  maxAge: 86400, // 24 hours preflight cache
});

// ─── Rate Limiters ──────────────────────────────────────────────

/**
 * General API rate limiter
 * 100 requests per minute per IP
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: IS_PRODUCTION ? 100 : 1000, // More lenient in dev
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  store: getStore('api:'),
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
    retryAfter: 60,
  },
  keyGenerator: (req: Request) => {
    // Use X-Forwarded-For if behind proxy, else use IP
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.ip
      || 'unknown';
  },
});

/**
 * Strict rate limiter for auth endpoints
 * 5 attempts per minute (prevents brute force)
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: IS_PRODUCTION ? 5 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore('auth:'),
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again in 1 minute.',
    retryAfter: 60,
  },
  skipSuccessfulRequests: false,
});

/**
 * WebSocket connection rate limiter
 * 10 connections per minute per IP
 */
export const wsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PRODUCTION ? 10 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore('ws:'),
  message: {
    success: false,
    error: 'Too many WebSocket connections.',
  },
});

/**
 * Write operations limiter (POST, PUT, DELETE)
 * 30 requests per minute per IP
 */
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PRODUCTION ? 30 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore('write:'),
  message: {
    success: false,
    error: 'Too many write operations. Please try again later.',
  },
  skip: (req: Request) => {
    // Skip rate limiting for GET requests
    return req.method === 'GET';
  },
});

/**
 * Notification push limiter
 * 10 push requests per minute (prevents abuse)
 */
export const pushLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PRODUCTION ? 10 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore('push:'),
  message: {
    success: false,
    error: 'Too many notification requests.',
  },
});

// ─── Per-User Rate Limiter (Authenticated) ──────────────────────

/**
 * Per-user rate limiter using API key or user ID
 * Falls back to IP if no auth context available
 */
export const perUserLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PRODUCTION ? 200 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore('peruser:'),
  message: {
    success: false,
    error: 'Rate limit exceeded for your account. Please slow down.',
    retryAfter: 60,
  },
  keyGenerator: (req: Request) => {
    // Use user ID from auth middleware if available
    const user = (req as any).user;
    if (user?.id) return `user:${user.id}`;

    // Use API key if present
    const apiKey = req.headers['x-api-key'] as string;
    if (apiKey) return `apikey:${apiKey}`;

    // Fall back to IP
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.ip
      || 'unknown';
  },
});

// ─── Expensive Operation Limiter ────────────────────────────────

/**
 * Burst protection for expensive endpoints (backtest, indicators, AI)
 * 5 requests per minute per user/IP
 */
export const expensiveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PRODUCTION ? 5 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore('expensive:'),
  message: {
    success: false,
    error: 'Too many requests to this resource. Backtesting and analysis are rate-limited to 5/min.',
    retryAfter: 60,
  },
  keyGenerator: (req: Request) => {
    const user = (req as any).user;
    if (user?.id) return `user:${user.id}`;
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.ip
      || 'unknown';
  },
});

// ─── Trading Action Limiter ─────────────────────────────────────

/**
 * Prevent rapid-fire trading actions (buy/sell/emergency)
 * 10 trading actions per minute per user
 */
export const tradingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PRODUCTION ? 10 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore('trading:'),
  message: {
    success: false,
    error: 'Too many trading actions. Maximum 10 per minute.',
    retryAfter: 60,
  },
  keyGenerator: (req: Request) => {
    const user = (req as any).user;
    if (user?.id) return `trading:user:${user.id}`;
    return `trading:ip:${req.ip || 'unknown'}`;
  },
});

// ─── Login Burst Limiter ───────────────────────────────────────

/**
 * Aggressive brute-force protection for login
 * 3 attempts per 15 minutes per IP
 */
export const loginBurstLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: IS_PRODUCTION ? 3 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore('loginburst:'),
  message: {
    success: false,
    error: 'Too many login attempts. Please wait 15 minutes.',
    retryAfter: 900,
  },
  skipSuccessfulRequests: true, // Don't count successful logins
});

// ─── Request Size Limiter ───────────────────────────────────────
export const requestSizeLimiter = (maxSize: string = '1mb') => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Express already handles this via express.json({ limit })
    // This is an additional safety check
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    const maxBytes = parseSize(maxSize);

    if (contentLength > maxBytes) {
      res.status(413).json({
        success: false,
        error: `Request too large. Maximum size is ${maxSize}.`,
      });
      return;
    }

    next();
  };
};

// ─── IP Blocklist (in-memory, for quick bans) ───────────────────
const blockedIPs = new Set<string>();

export const ipBlocklist = (req: Request, res: Response, next: NextFunction) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.ip
    || 'unknown';

  if (blockedIPs.has(ip)) {
    res.status(403).json({
      success: false,
      error: 'Access denied.',
    });
    return;
  }

  next();
};

export function blockIP(ip: string): void {
  blockedIPs.add(ip);
}

export function unblockIP(ip: string): void {
  blockedIPs.delete(ip);
}

export function getBlockedIPs(): string[] {
  return Array.from(blockedIPs);
}

// ─── Request ID Middleware ───────────────────────────────────────
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = req.headers['x-request-id'] as string
    || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  (req as any).requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

// ─── Security Logger Middleware ──────────────────────────────────
import { logger } from '../utils/logger';

export function securityLogger(req: Request, res: Response, next: NextFunction): void {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.ip
    || 'unknown';

  // Log suspicious patterns
  const suspiciousPatterns = [
    /\.\.\//,           // Path traversal
    /<script/i,         // XSS attempts
    /union.*select/i,   // SQL injection
    /exec\(/i,          // Code execution
    /eval\(/i,          // Code execution
    /javascript:/i,     // JavaScript protocol
  ];

  const fullPath = `${req.method} ${req.originalUrl}`;
  const bodyStr = JSON.stringify(req.body || {});

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(fullPath) || pattern.test(bodyStr)) {
      logger.warn(`🚨 SUSPICIOUS REQUEST from ${ip}: ${fullPath}`);
      // Don't block, just log — could be legitimate data
      break;
    }
  }

  next();
}

// ─── Helpers ─────────────────────────────────────────────────────
function parseSize(size: string): number {
  const units: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const match = size.match(/^(\d+)(b|kb|mb|gb)$/i);
  if (!match) return 1024 * 1024; // Default 1MB

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  return value * (units[unit] || 1);
}
