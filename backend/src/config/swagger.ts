// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Swagger/OpenAPI Configuration
// Auto-generated API documentation
// ═══════════════════════════════════════════════════════════════════

import swaggerJsdoc from 'swagger-jsdoc';
import { Options } from 'swagger-jsdoc';

const options: Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'El Oráculo API',
      version: '1.0.0',
      description: `
# El Oráculo — Trading Bot API

Complete REST API for the El Oráculo cryptocurrency trading bot.

## Features
- 🤖 **Trading Engine** — 12-node pipeline with multi-timeframe analysis
- 📊 **Risk Management** — Per-coin, portfolio, correlation, circuit breaker
- 🔍 **Backtesting** — Full replay, walk-forward optimization, Monte Carlo
- 📈 **Analytics** — Performance metrics, win streaks, daily summaries
- 🔔 **Alerts** — Configurable profit/loss alerts
- 📱 **Real-time** — WebSocket updates for prices, scores, trades
- 🔐 **Authentication** — JWT-based with role-based access
- 🛡️ **Rate Limiting** — SQLite-backed, per-user limits

## Authentication
Most endpoints require a JWT token in the \`Authorization\` header:
\`\`\`
Authorization: Bearer <token>
\`\`\`

## Rate Limits
| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| General API | 100 req | 1 min |
| Write operations | 30 req | 1 min |
| Auth (login/register) | 5 req | 1 min |
| Trading | 10 req | 1 min |
| Expensive (backtest/AI) | 5 req | 1 min |

## WebSocket Events
Connect to \`ws://localhost:3001\` and subscribe to:
- \`subscribe:portfolio\` — All coin updates
- \`subscribe:coin\` — Specific coin updates
- \`price:update\` — Live price updates
- \`score:update\` — Indicator score updates
- \`trade:executed\` — New trade notifications
- \`pnl:update\` — Position PnL updates
      `,
      contact: {
        name: 'El Oráculo Team',
        email: 'support@eloraculo.app',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
      {
        url: 'https://el-oraculo-backend.fly.dev',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token from /api/auth/login',
        },
      },
      schemas: {
        // ─── Common Schemas ─────────────────────────────────────
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'Error message' },
            code: { type: 'string', description: 'Error code' },
          },
        },
        Success: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            message: { type: 'string' },
          },
        },

        // ─── Bot State ──────────────────────────────────────────
        BotState: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            coin: { type: 'string', example: 'BTC' },
            status: { type: 'string', enum: ['LÍQUIDO', 'COMPRADO'], example: 'LÍQUIDO' },
            entryPrice: { type: 'number', example: 65000 },
            entryTime: { type: 'string', format: 'date-time' },
            tpTarget: { type: 'number', example: 68000 },
            pisoActual: { type: 'number', example: 63000 },
            streakLosses: { type: 'integer', example: 0 },
            montoEntrada: { type: 'number', example: 100 },
            lastSellTime: { type: 'string', format: 'date-time' },
            lastSellPrice: { type: 'number' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },

        // ─── Trade Log ──────────────────────────────────────────
        TradeLog: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            coin: { type: 'string', example: 'BTC' },
            decision: { type: 'string', enum: ['COMPRAR', 'VENDER', 'ESPERAR'] },
            motivo: { type: 'string', example: 'RSI oversold + HTF bullish' },
            monto: { type: 'number', example: 100 },
            precio: { type: 'number', example: 65000 },
            rsi: { type: 'number', example: 28.5 },
            adx: { type: 'number', example: 32.1 },
            direction: { type: 'string', enum: ['BULLISH', 'BEARISH', 'NEUTRAL'] },
            pnl: { type: 'string', example: '+5.2%' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },

        // ─── Decision Snapshot ───────────────────────────────────
        DecisionSnapshot: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            coin: { type: 'string' },
            cycleNumber: { type: 'integer' },
            regime: { type: 'string', enum: ['TRENDING', 'RANGING', 'VOLATILE', 'NEUTRAL'] },
            rsi: { type: 'number' },
            adx: { type: 'number' },
            entryScore: { type: 'integer' },
            decision: { type: 'string' },
            motivo: { type: 'string' },
            monto: { type: 'number' },
            fillPrice: { type: 'number' },
            pnlPct: { type: 'number' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },

        // ─── Portfolio ──────────────────────────────────────────
        Portfolio: {
          type: 'object',
          properties: {
            balance: {
              type: 'object',
              properties: {
                usdt_total: { type: 'number' },
                usdt_available: { type: 'number' },
                positions_value: { type: 'number' },
              },
            },
            positions: {
              type: 'array',
              items: { $ref: '#/components/schemas/BotState' },
            },
          },
        },

        // ─── Risk ───────────────────────────────────────────────
        PortfolioRisk: {
          type: 'object',
          properties: {
            totalExposure: { type: 'number', description: 'Total exposure %' },
            maxExposure: { type: 'number', description: 'Max allowed exposure %' },
            positionCount: { type: 'integer' },
            maxPositions: { type: 'integer' },
            correlatedPositions: { type: 'integer' },
            maxCorrelated: { type: 'integer' },
            heatScore: { type: 'number', description: 'Portfolio heat 0-100' },
            circuitBreaker: {
              type: 'object',
              properties: {
                active: { type: 'boolean' },
                drawdown: { type: 'number' },
                cooldownEnd: { type: 'string', format: 'date-time' },
              },
            },
          },
        },

        // ─── Analytics ──────────────────────────────────────────
        DailySummary: {
          type: 'object',
          properties: {
            date: { type: 'string', example: '2026-09-02' },
            totalTrades: { type: 'integer' },
            buys: { type: 'integer' },
            sells: { type: 'integer' },
            wins: { type: 'integer' },
            losses: { type: 'integer' },
            totalPnlPct: { type: 'number' },
            balanceStart: { type: 'number' },
            balanceEnd: { type: 'number' },
          },
        },

        WinStreaks: {
          type: 'object',
          properties: {
            currentStreak: { type: 'integer' },
            currentType: { type: 'string', enum: ['win', 'loss'] },
            maxWinStreak: { type: 'integer' },
            maxLossStreak: { type: 'integer' },
            totalTrades: { type: 'integer' },
            winRate: { type: 'number' },
          },
        },

        // ─── Backtest ───────────────────────────────────────────
        BacktestResult: {
          type: 'object',
          properties: {
            totalTrades: { type: 'integer' },
            wins: { type: 'integer' },
            losses: { type: 'integer' },
            winRate: { type: 'number' },
            totalPnl: { type: 'number' },
            maxDrawdown: { type: 'number' },
            sharpeRatio: { type: 'number' },
            profitFactor: { type: 'number' },
            trades: {
              type: 'array',
              items: { $ref: '#/components/schemas/TradeLog' },
            },
          },
        },

        WalkForwardResult: {
          type: 'object',
          properties: {
            periods: { type: 'integer' },
            walkForwardEfficiency: { type: 'number' },
            parameterStability: { type: 'number' },
            bestParams: { type: 'object' },
            oosReturn: { type: 'number' },
            isReturn: { type: 'number' },
            monteCarlo: {
              type: 'object',
              properties: {
                simulations: { type: 'integer' },
                meanReturn: { type: 'number' },
                percentiles: { type: 'object' },
              },
            },
          },
        },

        // ─── User ───────────────────────────────────────────────
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            plan: { type: 'string', enum: ['free', 'pro', 'enterprise'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },

        AuthToken: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: { $ref: '#/components/schemas/User' },
          },
        },

        // ─── Metrics ────────────────────────────────────────────
        Metrics: {
          type: 'object',
          properties: {
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'number' },
            system: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  help: { type: 'string' },
                  value: { type: 'number' },
                },
              },
            },
            database: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  help: { type: 'string' },
                  value: { type: 'number' },
                },
              },
            },
            trading: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  help: { type: 'string' },
                  value: { type: 'number' },
                },
              },
            },
          },
        },

        // ─── Dashboard ──────────────────────────────────────────
        DashboardOverview: {
          type: 'object',
          properties: {
            bot: {
              type: 'object',
              properties: {
                running: { type: 'boolean' },
                cycles: { type: 'integer' },
                uptime: { type: 'number' },
              },
            },
            portfolio: { $ref: '#/components/schemas/Portfolio' },
            today: { $ref: '#/components/schemas/DailySummary' },
            streaks: { $ref: '#/components/schemas/WinStreaks' },
            recentTrades: {
              type: 'array',
              items: { $ref: '#/components/schemas/TradeLog' },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts'], // Path to route files for JSDoc comments
};

export const swaggerSpec = swaggerJsdoc(options);

export const swaggerUiOptions = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'El Oráculo API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
  },
};
