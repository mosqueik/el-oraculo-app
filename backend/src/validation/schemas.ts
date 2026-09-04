// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Zod Validation Schemas
// ═══════════════════════════════════════════════════════════════════

import { z } from 'zod';
import { CoinSymbol } from '@el-oraculo/shared';

// ─── Common Schemas ─────────────────────────────────────────────

/**
 * Valid coin symbols
 */
export const CoinSymbolSchema = z.enum([
  'BTC', 'ETH', 'SOL', 'BNB', 'AVAX', 'POL', 'SUI',
  'LINK', 'NEAR', 'DOGE', 'XRP', 'ARB', 'ADA', 'ESP',
]);

/**
 * Pagination query parameters
 */
export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Time range query parameters
 */
export const TimeRangeQuerySchema = z.object({
  hours: z.coerce.number().int().min(1).max(720).default(24), // max 30 days
});

// ─── Portfolio Schemas ──────────────────────────────────────────

/**
 * GET /api/portfolio/:coin - Params
 */
export const PortfolioParamsSchema = z.object({
  coin: CoinSymbolSchema,
});

/**
 * POST /api/portfolio/:coin/buy - Body
 */
export const PortfolioBuyBodySchema = z.object({
  entryPrice: z.number().positive('Entry price must be positive'),
  monto: z.number().positive('Amount must be positive'),
});

/**
 * POST /api/portfolio/:coin/sell - Body
 */
export const PortfolioSellBodySchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
  price: z.number().positive('Price must be positive'),
});

// ─── Trades Schemas ─────────────────────────────────────────────

/**
 * GET /api/trades - Query
 */
export const TradesQuerySchema = PaginationQuerySchema;

/**
 * GET /api/trades/recent - Query
 */
export const TradesRecentQuerySchema = TimeRangeQuerySchema;

/**
 * GET /api/trades/:coin - Params + Query
 */
export const TradesCoinParamsSchema = z.object({
  coin: CoinSymbolSchema,
});

export const TradesCoinQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

/**
 * GET /api/trades/:coin/action/:action - Params
 */
export const TradesActionParamsSchema = z.object({
  coin: CoinSymbolSchema,
  action: z.enum(['COMPRAR', 'VENDER', 'ESPERAR']),
});

// ─── Executions Schemas ─────────────────────────────────────────

/**
 * GET /api/executions - Query
 */
export const ExecutionsQuerySchema = PaginationQuerySchema;

/**
 * GET /api/executions/recent - Query
 */
export const ExecutionsRecentQuerySchema = TimeRangeQuerySchema;

/**
 * GET /api/executions/errors - Query
 */
export const ExecutionsErrorsQuerySchema = TimeRangeQuerySchema;

/**
 * GET /api/executions/:coin - Params + Query
 */
export const ExecutionsCoinParamsSchema = z.object({
  coin: CoinSymbolSchema,
});

export const ExecutionsCoinQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

/**
 * GET /api/executions/:id - Params
 */
export const ExecutionsIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// ─── Auth Schemas ───────────────────────────────────────────────

/**
 * POST /api/auth/register - Body
 */
export const AuthRegisterBodySchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(100).optional(),
});

/**
 * POST /api/auth/login - Body
 */
export const AuthLoginBodySchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

// ─── Type Exports ───────────────────────────────────────────────

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type TimeRangeQuery = z.infer<typeof TimeRangeQuerySchema>;
export type PortfolioParams = z.infer<typeof PortfolioParamsSchema>;
export type PortfolioBuyBody = z.infer<typeof PortfolioBuyBodySchema>;
export type PortfolioSellBody = z.infer<typeof PortfolioSellBodySchema>;
export type TradesQuery = z.infer<typeof TradesQuerySchema>;
export type TradesRecentQuery = z.infer<typeof TradesRecentQuerySchema>;
export type TradesCoinParams = z.infer<typeof TradesCoinParamsSchema>;
export type TradesCoinQuery = z.infer<typeof TradesCoinQuerySchema>;
export type TradesActionParams = z.infer<typeof TradesActionParamsSchema>;
export type ExecutionsQuery = z.infer<typeof ExecutionsQuerySchema>;
export type ExecutionsRecentQuery = z.infer<typeof ExecutionsRecentQuerySchema>;
export type ExecutionsErrorsQuery = z.infer<typeof ExecutionsErrorsQuerySchema>;
export type ExecutionsCoinParams = z.infer<typeof ExecutionsCoinParamsSchema>;
export type ExecutionsCoinQuery = z.infer<typeof ExecutionsCoinQuerySchema>;
export type ExecutionsIdParams = z.infer<typeof ExecutionsIdParamsSchema>;
export type AuthRegisterBody = z.infer<typeof AuthRegisterBodySchema>;
export type AuthLoginBody = z.infer<typeof AuthLoginBodySchema>;
