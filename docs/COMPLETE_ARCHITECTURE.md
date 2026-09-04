# 🏛️ El Oráculo — Complete Architecture

> **Version:** 1.0.0  
> **Last Updated:** September 2, 2026  
> **Status:** Production Ready

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Layers](#architecture-layers)
3. [Trading Pipeline](#trading-pipeline)
4. [Risk Management Stack](#risk-management-stack)
5. [Backtesting & Optimization](#backtesting--optimization)
6. [Monitoring & Logging](#monitoring--logging)
7. [API Reference](#api-reference)
8. [Database Schema](#database-schema)
9. [Deployment](#deployment)

---

## 1. System Overview

El Oráculo is a cryptocurrency trading bot that automatically trades 10 coins on Binance using a 12-node pipeline with multi-timeframe analysis, Smart Money indicators, and portfolio-level risk management.

### Key Components

```
┌─────────────────────────────────────────────────────────────┐
│                    EL ORÁCULO SYSTEM                         │
├─────────────────────────────────────────────────────────────┤
│  Mobile App (React Native + Expo)                          │
│    └── DashboardScreen, CoinDetail, Analytics, Alerts      │
├─────────────────────────────────────────────────────────────┤
│  Web Dashboard (HTML + WebSocket)                          │
│    └── Real-time monitoring, Bot controls                  │
├─────────────────────────────────────────────────────────────┤
│  Backend (Node.js + Express)                               │
│    ├── Trading Engine (12-node pipeline)                   │
│    ├── Risk Management (5 layers)                          │
│    ├── Backtesting (Walk-forward + Monte Carlo)            │
│    ├── Notifications (Telegram + Expo Push)                │
│    └── Analytics (Trade logger + Daily summaries)          │
├─────────────────────────────────────────────────────────────┤
│  Database (SQLite + Drizzle ORM)                           │
│    └── 16 tables: bot_state, trade_log, decision_snapshot  │
├─────────────────────────────────────────────────────────────┤
│  Exchange (Binance API)                                    │
│    └── Market data, Order execution, Balance               │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture Layers

### Layer 1: Shared Types & Constants

```typescript
// shared/src/types/trading.ts
CoinSymbol: 'BTC' | 'ETH' | 'SOL' | 'BNB' | 'AVAX' | 'POL' | 'SUI' | 'LINK' | 'NEAR' | 'DOGE' | 'XRP' | 'ARB' | 'ADA' | 'ESP'

// shared/src/constants/config.ts
COIN_CONFIGS: Record<CoinSymbol, CoinConfig>
  - pair, risk_pct, entry_min, stop_loss, tp_base
  - TRAILING_OFFSET, TIME_EXIT_MAX_HOURS, ATR_MULTIPLIER
```

### Layer 2: Backend Services

| Service | File | Purpose |
|---------|------|---------|
| ExchangeService | `exchange/service.ts` | Binance API wrapper |
| IndicatorService | `indicators/service.ts` | 30+ technical indicators |
| ScoringService | `scoring/service.ts` | Entry score calculation |
| RiskService | `risk/service.ts` | Per-coin risk (hard stop, trailing, TP) |
| PortfolioRiskService | `portfolioRisk/service.ts` | Portfolio-level risk |
| TradingEngine | `trading/engine.ts` | 12-node pipeline orchestration |
| TradeLoggerService | `tradeLogger/service.ts` | Decision logging |
| BacktestRunner | `backtesting/service.ts` | Historical replay |
| WalkForwardOptimizer | `backtesting/walkForward.ts` | Parameter optimization |
| NotificationService | `notifications/service.ts` | Telegram + Expo Push |

### Layer 3: Database (SQLite)

| Table | Purpose |
|-------|---------|
| `bot_state` | Current status per coin (LÍQUIDO/COMPRADO) |
| `trade_log` | All trades with entry/exit prices |
| `execution_log` | Execution attempts (success/error) |
| `decision_snapshot` | Full pipeline state at each decision |
| `daily_summary` | Aggregated daily performance |
| `users` | User accounts |
| `subscriptions` | Stripe subscriptions |
| `alert_config` | Alert thresholds |
| `rate_limits` | Rate limit counters (persistent) |

### Layer 4: API (Express + Socket.IO)

- **REST API:** 100+ endpoints for trading, analytics, risk, backtesting
- **WebSocket:** Real-time price, score, trade, PnL updates
- **Rate Limiting:** 7 layers (IP, user, trading, expensive, auth, WebSocket, login)

---

## 3. Trading Pipeline

### 12-Node Pipeline

```
Node 1: INDICATORS (15m)
  ├── RSI, ADX, MACD, BB, ATR, EMA20/50/200
  ├── OBV, VWAP, FVG, Choch, Squeeze
  └── Momentum (BULL/BEAR/NEUTRAL)

Node 1b: MULTI-TIMEFRAME SM
  ├── 15m: Order Blocks, BOS, Liquidity Zones
  ├── 1h:  Same indicators
  ├── 4h:  Same indicators
  ├── HTF Bias (4h=50%, 1h=30%, 15m=20%)
  └── Confluence Score (0-100)

Node 2: MARKET REGIME
  ├── TRENDING (ADX > 25)
  ├── VOLATILE (ATR% > 2)
  ├── RANGING (ADX < 20)
  └── CALM (ADX 20-25, ATR% < 2)

Node 3: STATUS
  └── Bot state from DB (LÍQUIDO/COMPRADO)

Node 4: SCORING
  ├── RSI score (±20)
  ├── FVG score (±15)
  ├── ADX score (±10)
  ├── Momentum (±15)
  └── Downtrend penalty (-10 if streak ≥ 2)

Node 5: RISK
  ├── Hard stop (entry - ATR×1.5)
  ├── Trailing stop (ratchets up)
  ├── Take profit (volatility-adjusted)
  └── Time exit (6h default)

Node 6: DECISION
  ├── EXIT: hard stop > trailing > TP > time > safety > BE > momentum > RSI
  └── ENTRY: score ≥ threshold AND monto ≥ entry_min

Node 7: FILTER
  ├── Balance check
  ├── Cooldown (15min post-sell)
  ├── Streak cooldown (5min extra per loss)
  └── Portfolio risk check (exposure, correlation, sector)

Node 8: OUTPUT
  └── Formatted console output

Node 9: EXECUTE
  ├── marketBuy / marketSell
  ├── Update bot_state
  └── Log to trade_log

Node 10: LOG
  ├── Execution log
  ├── Decision snapshot
  ├── Daily summary update
  └── WebSocket events

Node 11: NOTIFY
  ├── Telegram (trade alerts)
  └── Expo Push (mobile)

Node 12: LEARN
  └── Post-trade analysis (future)
```

---

## 4. Risk Management Stack

### Layer 1: Per-Coin Risk (RiskService)

```typescript
hardStop = entryPrice - (atrPrice × ATR_MULTIPLIER)  // Price level
v_piso = max(prevPiso, currentPrice × (1 - TRAILING_OFFSET))  // Trailing floor
tp_target = tp_base × volatilityMultiplier  // 1.0-1.2%
```

### Layer 2: Portfolio Risk (PortfolioRiskService)

```typescript
// Exposure limits
maxTotalExposurePct: 80%  // Max % in all positions
maxSinglePositionPct: 20% // Max % per coin

// Correlation limits
maxCorrelatedPositions: 3  // Max positions in correlated coins
correlationThreshold: 0.7  // Pearson correlation threshold

// Sector limits
maxSectorExposurePct: 40%  // Max % per sector

// Drawdown protection
maxDrawdownPct: 15%  // Circuit breaker trigger
drawdownCooldownMinutes: 60  // Pause duration
```

### Layer 3: Portfolio Heat Score

```
Heat = Exposure (0-30) + Positions (0-20) + Correlation (0-20) + Volatility (0-15) + Drawdown (0-15)

> 70: Start reducing positions
> 80: Aggressive size reduction
> 100: Circuit breaker
```

### Layer 4: Rate Limiting

```
API: 100 req/min per IP
Auth: 5 req/min per IP
Trading: 10 actions/min per user
Expensive: 5 req/min per user (backtest, AI)
WebSocket: 5 connections/IP, 30 subs/min, 50 events/s
Login: 3 attempts/15min per IP
```

### Layer 5: Circuit Breaker

```
Trigger: Portfolio drawdown > 15%
Effect: Block all new BUY decisions
Cooldown: 60 minutes
Reset: POST /api/risk/reset-circuit-breaker
```

---

## 5. Backtesting & Optimization

### Backtest Runner

```typescript
// Full pipeline replay against historical data
const result = await backtestRunner.runBacktest({
  coins: ['BTC', 'ETH'],
  startDate: '2025-01-01',
  endDate: '2025-06-30',
  initialBalance: 10000,
});

// Results include:
// - summary: winRate, PnL, drawdown, Sharpe, profitFactor
// - trades: every trade with entry/exit details
// - equityCurve: balance over time
// - smSignalAccuracy: OB/BOS/FVG win rates
```

### Walk-Forward Optimization

```typescript
// Prevents overfitting by testing on unseen data
const result = await walkForwardOptimizer.optimize({
  coins: ['BTC', 'ETH'],
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  inSampleMonths: 3,    // Optimize on 3 months
  outOfSampleMonths: 1, // Validate on 1 month
  stepMonths: 1,        // Roll forward 1 month
  optimizeFor: 'sharpe',
  monteCarloRuns: 1000,
});

// Results include:
// - bestParams: optimal parameter set
// - periods: IS/OOS results per window
// - walkForwardEfficiency: OOS/IS ratio
// - parameterStability: 0-100
// - monteCarlo: return distribution
```

### SM Signal Validation

```typescript
// Validate Smart Money indicators against price action
const signals = await backtestRunner.validateSignals({
  coins: ['BTC'],
  startDate: '2025-01-01',
  endDate: '2025-06-30',
});

// Results include:
// - orderBlocks: win rate, avg PnL at 5/10/20 candles
// - bos: Break of Structure accuracy
// - fvg: Fair Value Gap fill rate
// - premiumDiscount: Mean reversion accuracy
```

---

## 6. Monitoring & Logging

### Web Dashboard

```
http://localhost:3001/dashboard

Sections:
├── Bot Status (running, cycles, uptime, memory)
├── Today's Performance (trades, wins, losses, PnL)
├── Win Streaks (current + max)
├── Active Positions (live PnL)
├── All Coins Table (price, RSI, ADX, score, status)
├── Recent Trades (last 20)
└── System Logs (real-time)
```

### Trade Logger

```typescript
// Captures full pipeline state at each decision
TradeLoggerService.logDecision({
  coin: 'BTC',
  cycleNumber: 123,
  regime: 'TRENDING',
  rsi: 55,
  adx: 30,
  htfBias: 'BULLISH',
  confluenceScore: 75,
  entryScore: 65,
  decision: 'COMPRAR',
  motivo: 'ENTRY: RSI favorable+FVG bullish',
  hardStop: 48000,
  tpTarget: 3.0,
  vPiso: 49500,
});
```

### Telegram Notifications

```env
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=-1001234567890
TELEGRAM_THREAD_ID=99  # Optional: forum topic
TELEGRAM_SILENT=true   # Optional: no sound
```

---

## 7. API Reference

### Trading

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Bot status |
| POST | `/api/start` | Start bot |
| POST | `/api/stop` | Stop bot |
| GET | `/api/portfolio` | Portfolio overview |
| POST | `/api/trading/manual-buy/:coin` | Manual buy |
| POST | `/api/trading/manual-sell/:coin` | Manual sell |
| POST | `/api/trading/emergency-sell/:coin` | Emergency sell |

### Risk Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/risk/portfolio` | Portfolio risk state |
| GET | `/api/risk/config` | Risk configuration |
| PUT | `/api/risk/config` | Update risk config |
| GET | `/api/risk/correlation` | Correlation matrix |
| GET | `/api/risk/correlation/:c1/:c2` | Pair correlation |
| POST | `/api/risk/check` | Pre-trade risk check |
| POST | `/api/risk/reset-circuit-breaker` | Reset breaker |
| GET | `/api/risk/positions` | Risk-adjusted positions |
| GET | `/api/risk/sectors` | Sector exposure |

### Backtesting

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/backtest/run` | Full backtest |
| POST | `/api/backtest/validate-signals` | SM validation |
| POST | `/api/backtest/export` | CSV export |
| POST | `/api/walkforward/optimize` | Walk-forward optimization |
| POST | `/api/walkforward/quick` | Quick optimization |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/dashboard` | Dashboard summary |
| GET | `/api/analytics/performance` | Per-coin performance |
| GET | `/api/analytics/streaks` | Win/loss streaks |
| GET | `/api/analytics/daily` | Daily summaries |
| GET | `/api/analytics/export/json` | JSON export |
| GET | `/api/analytics/export/csv` | CSV export |

### Monitoring

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard` | Web dashboard |
| GET | `/api/dashboard/overview` | All dashboard data |
| GET | `/api/monitoring/health` | System health |
| GET | `/api/monitoring/stats` | System stats |

---

## 8. Database Schema

### Core Tables

```sql
-- Bot state per coin
CREATE TABLE bot_state (
  id INTEGER PRIMARY KEY,
  coin TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'LÍQUIDO',  -- LÍQUIDO | COMPRADO
  entry_price REAL DEFAULT 0,
  entry_time TEXT,
  tp_target REAL DEFAULT 0,
  piso_actual REAL DEFAULT 0,
  streak_losses INTEGER DEFAULT 0,
  monto_entrada REAL DEFAULT 0,
  last_sell_time TEXT,
  last_sell_reason TEXT,
  last_sell_price REAL DEFAULT 0
);

-- Full pipeline state at each decision
CREATE TABLE decision_snapshot (
  id INTEGER PRIMARY KEY,
  coin TEXT NOT NULL,
  cycle_number INTEGER,
  regime TEXT,
  rsi REAL,
  adx REAL,
  htf_bias TEXT,
  confluence_score INTEGER,
  entry_score INTEGER,
  decision TEXT NOT NULL,  -- COMPRAR | VENDER | ESPERAR
  motivo TEXT,
  hard_stop REAL,
  tp_target REAL,
  v_piso REAL,
  cycle_ms INTEGER,
  timestamp TEXT DEFAULT (datetime('now'))
);
```

---

## 9. Deployment

### Backend (Fly.io)

```bash
# Set secrets
fly secrets set \
  BINANCE_API_KEY=xxx \
  BINANCE_API_SECRET=xxx \
  JWT_SECRET=xxx \
  TELEGRAM_BOT_TOKEN=xxx \
  TELEGRAM_CHAT_ID=xxx \
  --app el-oraculo-backend

# Deploy
fly deploy --app el-oraculo-backend

# Verify
curl https://el-oraculo-backend.fly.dev/api/health
```

### Mobile (EAS Build)

```bash
cd mobile

# Login to Expo
npx expo login

# Build APK (testing)
npx eas build --platform android --profile preview

# Build AAB (Play Store)
npx eas build --platform android --profile production
```

### Docker (Local)

```bash
docker compose up -d

# Services:
# - backend: http://localhost:3001
# - nginx: http://localhost:80
# - dashboard: http://localhost:3001/dashboard
```

---

## 📊 System Metrics

| Metric | Value |
|--------|-------|
| Backend Tests | 275 ✅ |
| TypeScript Errors | 0 |
| API Endpoints | 100+ |
| Mobile Screens | 13 |
| Database Tables | 16 |
| Risk Layers | 5 |
| Indicators | 30+ |
| Coins Traded | 10 |
| Pipeline Nodes | 12 |

---

*Document generated: September 2, 2026*
