# 🪙 EL ORÁCULO — Project State

> Last updated: September 1, 2026  
> Version: 1.2.0  
> Status: Production Ready

## 📋 Executive Summary

El Oráculo is a cryptocurrency trading bot with a React Native mobile app. It uses a 12-node decision pipeline to analyze 10 coins and execute trades automatically on Binance.

### Key Metrics
- **Backend:** Node.js + Express + TypeScript
- **Mobile:** React Native + Expo
- **Database:** SQLite with Drizzle ORM
- **Tests:** 153 tests passing
- **API Endpoints:** 85+
- **Mobile Screens:** 13
- **Mobile Components:** 12
- **Mobile Hooks:** 8
- **Database Tables:** 14
- **Backend Modules:** 11
- **Backend Repositories:** 9

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    EL ORÁCULO ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    MOBILE APP (React Native + Expo)      │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │   │
│  │  │Dashboard │  │CoinDetail│  │ Analytics│  │ Settings│ │   │
│  │  │+PnL Live │  │+Chart    │  │+Equity   │  │+Alerts  │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │   │
│  │  │ Trades   │  │TradeDetail│ │Indicators│  │  Auth   │ │   │
│  │  │+Export   │  │+AI       │  │Custom    │  │+Biometric│ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │   │
│  │  │Backtest  │  │Subscript.│  │Notificat.│  │ AlertSet│ │   │
│  │  │+Presets  │  │+Stripe   │  │+Push     │  │+Thresh. │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                    ┌─────────┴─────────┐                       │
│                    │  WebSocket + REST  │                       │
│                    │  + Real-time PnL   │                       │
│                    └─────────┬─────────┘                       │
│                              │                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    BACKEND (Node.js)                      │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │              TRADING ENGINE                        │   │   │
│  │  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐  │   │   │
│  │  │  │Indicatr│ │Scoring │ │  Risk  │ │ Decision │  │   │   │
│  │  │  │15m SM  │ │12-node │ │Trailing│ │ COMPRAR/ │  │   │   │
│  │  │  │FVG RSI │ │pipeline│ │  TP    │ │ VENDER   │  │   │   │
│  │  │  └────────┘ └────────┘ └────────┘ └──────────┘  │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │Exchange  │ │   AI     │ │Notificat.│ │Analytics │   │   │
│  │  │(Binance) │ │(OpenRouter)│ │(Expo Push)│ │(Learning)│  │   │
│  │  │+PriceTicker│ │Free Models│ │+WebSocket│ │+Metrics │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │Monitoring│ │ Billing  │ │  Alerts  │ │Backtest  │   │   │
│  │  │(Winston) │ │ (Stripe) │ │(60s loop)│ │(RSI+ADX) │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                    ┌─────────┴─────────┐                       │
│                    │    SQLite DB       │                       │
│                    │  (Drizzle ORM)     │                       │
│                    │  14 tables         │                       │
│                    │  9 repositories    │                       │
│                    └───────────────────┘                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
el-oraculo-app/
├── backend/                    # Node.js Backend
│   ├── src/
│   │   ├── database/          # Drizzle ORM + SQLite
│   │   │   ├── schema.ts      # 14 tables
│   │   │   ├── connection.ts  # DB connection with WAL mode
│   │   │   ├── init.ts        # Auto-migration + seeding
│   │   │   └── repositories/  # 9 repositories
│   │   ├── modules/
│   │   │   ├── trading/       # Trading engine (12-node pipeline)
│   │   │   ├── exchange/      # Binance API + Price Ticker
│   │   │   ├── indicators/    # Technical indicators
│   │   │   ├── scoring/       # Entry scoring
│   │   │   ├── risk/          # Risk management
│   │   │   ├── notifications/ # Push notifications (Expo)
│   │   │   ├── learning/      # Post-trade analysis
│   │   │   ├── monitoring/    # System monitoring (Winston)
│   │   │   ├── billing/       # Stripe subscriptions
│   │   │   ├── ai/            # OpenRouter AI analysis
│   │   │   ├── alerts/        # Profit/loss threshold alerts
│   │   │   └── backtesting/   # RSI+ADX backtesting engine
│   │   ├── routes/            # 17 route files
│   │   ├── middleware/        # Auth + Security + Rate Limiting
│   │   ├── validation/       # Zod schemas
│   │   ├── ws/               # WebSocket server (real-time PnL)
│   │   └── utils/            # Logger, helpers
│   ├── tests/                # 153 tests
│   └── Dockerfile            # Multi-stage build
├── mobile/                    # React Native App (Expo)
│   ├── src/
│   │   ├── screens/          # 13 screens
│   │   ├── components/       # 12 components
│   │   ├── hooks/            # 8 custom hooks
│   │   ├── services/         # API service with cache
│   │   ├── store/            # Zustand stores
│   │   ├── utils/            # Cache service
│   │   └── i18n/             # Translations (EN/ES)
│   └── App.tsx               # Navigation setup
├── shared/                    # Shared types
├── nginx/                     # Reverse proxy config
├── fly.toml                   # Fly.io deployment
├── docker-compose.yml         # Docker deployment
├── memory/                    # Project knowledge base
│   ├── SESSION_LOG.md         # Session history
│   └── KNOWLEDGE_ARCHITECTURE.md  # Deep architecture
├── docs/                      # Documentation
│   ├── API_REFERENCE.md       # All API endpoints
│   ├── MOBILE_APP.md          # Mobile app guide
│   └── DEPLOYMENT.md          # Deployment guide
└── scripts/                   # Deploy scripts
```

---

## 🎯 Trading Engine (12-Node Pipeline)

```
Node 1a: INDICATORS (15m)     → RSI, ADX, Momentum, FVG
Node 1b: MULTI-TIMEFRAME SM   → 15m, 1h, 4h Smart Money
Node 2: MARKET REGIME         → TRENDING / RANGING
Node 3: STATUS                → Bot state from DB
Node 4: SCORING               → Entry score calculation
Node 5: RISK                  → Stop loss, TP, trailing
Node 6: DECISION              → COMPRAR / VENDER / ESPERAR
Node 7: FILTER                → Validate decision
  └── COOLDOWN ENFORCEMENT: 15min post-sell wait
Node 8: OUTPUT                → Format results
Node 9: EXECUTE               → Place orders on Binance
Node 10: LOG                  → Store in database
```

### Coins Tracked (10)
BTC, ETH, SOL, BNB, AVAX, POL, SUI, LINK, NEAR, DOGE

### Cooldown Mechanism
After selling a coin, the bot waits **15 minutes** before buying again:
- Prevents re-buying seconds after selling
- Prevents chasing losses immediately
- Prevents overtrading in the same coin
- Configurable in `backend/src/modules/trading/engine.ts`: `COOLDOWN_MINUTES = 15`

### Manual Trading Controls
Users can override the bot and trade manually:
- **Buy:** Select coin → Enter USDT amount → Confirm → Market buy
- **Sell:** Select coin → See current PnL → Confirm → Market sell
- **Emergency:** Instant sell at market price

---

## 📊 Database Tables (14)

| Table | Purpose | Created In |
|-------|---------|-----------|
| `bot_state` | Current state per coin | 0000_init |
| `trade_log` | All executed trades | 0000_init |
| `execution_log` | Execution attempts | 0000_init |
| `users` | User accounts | 0000_init |
| `user_config` | Per-user settings | 0000_init |
| `push_tokens` | Device tokens | 0000_init |
| `notification_log` | Sent notifications | 0000_init |
| `subscriptions` | Stripe subscriptions | 0000_init |
| `invoices` | Stripe invoices | 0000_init |
| `custom_indicators` | User-defined indicators | 0000_init |
| `indicator_usage` | Indicator weights per coin | 0000_init |
| `system_config` | System settings | 0000_init |
| `alert_config` | Alert thresholds per coin | 0001_add_alerts |
| `alert_history` | Triggered alert records | 0001_add_alerts |

---

## 🔌 API Endpoints (85+)

### Core (4)
- `GET /api/health` — Health check
- `GET /api/status` — Bot status
- `POST /api/start` — Start bot
- `POST /api/stop` — Stop bot

### Portfolio (5)
- `GET /api/portfolio` — All coins
- `GET /api/portfolio/:coin` — Single coin
- `GET /api/portfolio/pnl` — Real-time PnL for all positions
- `GET /api/portfolio/pnl/:coin` — Real-time PnL for specific coin
- `GET /api/balance` — USDT balance

### Trades (3)
- `GET /api/trades` — Trade history
- `GET /api/trades/recent` — Recent trades
- `GET /api/trades/:coin` — Trades by coin

### Executions (2)
- `GET /api/executions` — Execution log
- `GET /api/executions/errors` — Errors only

### Auth (3)
- `POST /api/auth/register` — Register
- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Current user

### Trading Controls (7)
- `POST /api/trading/emergency-sell/:coin` — Emergency sell
- `POST /api/trading/manual-buy/:coin` — Manual buy with USDT amount
- `POST /api/trading/manual-sell/:coin` — Manual sell full position
- `POST /api/trading/pause/:coin` — Pause coin
- `POST /api/trading/resume/:coin` — Resume coin
- `GET /api/trading/paused` — Paused coins
- **Cooldown:** 15min wait after sell before re-buy (enforced in engine)

### Analytics (6)
- `GET /api/analytics/performance` — Performance metrics
- `GET /api/analytics/coin/:coin` — Coin analytics
- `GET /api/analytics/equity-curve` — PnL equity curve data
- `POST /api/analytics/analyze-trade/:id` — AI trade analysis
- `POST /api/analytics/analyze-portfolio` — AI portfolio analysis
- `POST /api/analytics/recommendation/:coin` — AI recommendation

### Data Export (5)
- `GET /api/export/trades` — Export trades (CSV/JSON)
- `GET /api/export/executions` — Export executions
- `GET /api/export/performance` — Export performance
- `GET /api/export/all` — Export everything
- `GET /api/export/obsidian` — Export as Obsidian markdown

### Custom Indicators (8)
- `GET /api/indicators/templates` — 8 indicator templates
- `GET /api/indicators/custom` — User's indicators
- `POST /api/indicators/custom` — Create indicator
- `PUT /api/indicators/custom/:id` — Update indicator
- `DELETE /api/indicators/custom/:id` — Delete indicator
- `POST /api/indicators/custom/:id/test` — Test indicator
- `GET /api/indicators/usage/:coin` — Usage per coin
- `POST /api/indicators/usage` — Set usage weight

### Notifications (4)
- `POST /api/notifications/register` — Register token
- `POST /api/notifications/unregister` — Unregister token
- `GET /api/notifications/history` — History
- `POST /api/notifications/test` — Send test

### Billing (5)
- `GET /api/billing/plans` — List plans
- `POST /api/billing/checkout` — Create checkout
- `POST /api/billing/portal` — Customer portal
- `GET /api/billing/subscription` — Current subscription
- `POST /api/billing/cancel` — Cancel subscription

### Monitoring (3)
- `GET /api/monitoring/health` — System health
- `GET /api/monitoring/stats` — System stats
- `GET /api/monitoring/errors` — Error stats

### Backtesting (4)
- `GET /api/backtest/coins` — Available coins
- `GET /api/backtest/presets` — Strategy presets
- `POST /api/backtest/run` — Run backtest
- `POST /api/backtest/compare` — Compare scenarios

### Alerts (9)
- `GET /api/alerts` — Get all alert configs
- `GET /api/alerts/:coin` — Get alerts for a coin
- `POST /api/alerts` — Create alert config
- `PUT /api/alerts/:id` — Update alert config
- `DELETE /api/alerts/:id` — Delete alert config
- `POST /api/alerts/check` — Manually trigger alert check
- `GET /api/alerts/history/all` — Get alert trigger history
- `GET /api/alerts/history/:coin` — Get history for a coin
- `GET /api/alerts/summary/:coin` — Get alert summary

**Alert Types:** profit_pct, loss_pct, profit_usdt, loss_usdt, price_above, price_below  
**Scheduler:** Alerts checked every 60 seconds automatically

### Klines (1)
- `GET /api/klines/:coin` — Chart data

---

## 📡 WebSocket Events

| Event | Data | Frequency |
|-------|------|-----------|
| `price:update` | `{ coin, price, change24h }` | Every 10s |
| `score:update` | `{ coin, score, rsi, adx }` | Every 30s |
| `trade:executed` | `{ coin, action, price, motivo }` | On trade |
| `status:update` | `{ coin, status, entryPrice }` | On change |
| `pnl:update` | `{ positions[], summary{} }` | Every 60s |
| `bot:status` | `{ running, uptime }` | On change |

### PnL WebSocket Payload (every 60s)
```json
{
  "positions": [{
    "coin": "BTC",
    "status": "COMPRADO",
    "currentPrice": 65432.12,
    "entryPrice": 65000.00,
    "pnlPct": 0.66,
    "pnlUsd": 66.40,
    "hoursHeld": 2.5,
    "cooldownRemaining": 0
  }],
  "summary": {
    "activeCount": 3,
    "totalPnlPct": 1.23,
    "totalPnlUsd": 123.45,
    "positionsInProfit": 2,
    "positionsInLoss": 1
  }
}
```

---

## 📱 Mobile Screens (13)

| Screen | Description | Key Features |
|--------|-------------|--------------|
| `LoginScreen` | Email/password login | Biometric login, JWT |
| `RegisterScreen` | Registration | Password strength meter |
| `DashboardScreen` | Portfolio overview | Live PnL, USDT amounts, buy/sell buttons |
| `CoinDetailScreen` | Coin detail | Price chart, indicators, emergency sell |
| `TradeHistoryScreen` | Trade list | Filter, export CSV/JSON, backtest link |
| `TradeDetailScreen` | Trade detail | AI analysis, indicators at trade time |
| `AnalyticsScreen` | Performance | Equity curve, by coin, AI insights |
| `BacktestScreen` | Backtesting | 4 presets, equity curve, monthly returns |
| `NotificationsScreen` | Notifications | History, test push |
| `SubscriptionScreen` | Subscription | 3 plans, Stripe checkout |
| `CustomIndicatorScreen` | Indicators | 8 templates, create/test, Enterprise |
| `AlertSettingsScreen` | Alerts | Profit/loss thresholds, quick presets |
| `SettingsScreen` | Settings | Language, bot control, alerts link |

---

## 🧩 Mobile Components (12)

| Component | Description | Key Features |
|-----------|-------------|--------------|
| `CoinCard` | Coin overview card | Live PnL %, USDT amount, entry info, buy/sell buttons |
| `PnLBadge` | PnL display badge | Shows % + $USDT (e.g., ▲ +0.66% +$66.40) |
| `MiniEquityCurve` | Compact equity chart | Portfolio value over time, sparkline |
| `TradeConfirmModal` | Trade confirmation | Input amount, quick buttons, preview, warnings |
| `EmergencyStopButton` | Floating emergency button | Instant sell, confirmation modal |
| `PriceChart` | Line chart | react-native-chart-kit |
| `ScoreGauge` | Circular gauge | Entry score visualization |
| `IndicatorGauge` | Horizontal bar | RSI/ADX visualization |
| `LoadingSpinner` | Loading indicator | Full screen option |
| `EmptyState` | Empty placeholder | Configurable message |

---

## 🪝 Custom Hooks (8)

| Hook | Description | Key Features |
|------|-------------|--------------|
| `useAuth` | Authentication state | login/register/logout, JWT management |
| `useBiometric` | Biometric auth | Face ID/Fingerprint, credential storage |
| `useWebSocket` | Real-time updates | Price, score, PnL, trade events |
| `useNetworkStatus` | Online/offline | Network state detection |
| `useNotifications` | Push notifications | Expo push token registration |
| `useTranslation` | i18n | EN/ES, locale detection, persistence |

---

## 📦 Backend Modules (11)

| Module | Description | Key Features |
|--------|-------------|--------------|
| `trading/engine.ts` | Trading engine | 12-node pipeline, cooldown, manual override |
| `exchange/service.ts` | Binance API | Market orders, balance, ticker |
| `exchange/priceTicker.ts` | Price broadcaster | Live prices + PnL every 10s |
| `indicators/service.ts` | Technical indicators | RSI, ADX, momentum, FVG |
| `scoring/service.ts` | Entry scoring | Multi-factor scoring |
| `risk/service.ts` | Risk management | Trailing stop, TP, hard stop |
| `notifications/service.ts` | Push notifications | Expo push, WebSocket alerts |
| `learning/service.ts` | Post-trade analysis | Pattern detection |
| `monitoring/service.ts` | System monitoring | Health, stats, errors |
| `billing/stripe.ts` | Stripe billing | 3 plans, webhooks, portal |
| `ai/service.ts` | AI analysis | OpenRouter free models |
| `alerts/service.ts` | Alert monitoring | 60s check loop, cooldowns |
| `backtesting/service.ts` | Backtesting | RSI+ADX strategy, 4 presets |

---

## 🔐 Security Features

- **Helmet** — 12+ security headers
- **Rate Limiting** — 5 different limiters
  - API: 100 req/min
  - Auth: 5 req/min (brute force protection)
  - Write: 30 req/min
  - Notifications: 2 req/min
  - WebSocket: 10 conn/min
- **CORS** — Configurable per environment
- **IP Blocklist** — In-memory blocklist
- **Request Validation** — Zod schemas
- **JWT Authentication** — Token-based auth
- **Biometric Auth** — Face ID / Fingerprint

---

## 🚀 Deployment Options

### Fly.io (Recommended - Free)
```bash
# Install fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Set secrets
fly secrets set \
  BINANCE_API_KEY=xxx \
  BINANCE_API_SECRET=xxx \
  JWT_SECRET=xxx \
  OPENROUTER_API_KEY=xxx \
  STRIPE_SECRET_KEY=xxx \
  STRIPE_WEBHOOK_SECRET=xxx \
  --app el-oraculo-backend

# Deploy
./scripts/fly-deploy.sh
```

### Docker
```bash
# Copy env
cp .env.example .env

# Deploy
docker compose up -d
```

### Mobile APK (EAS Build)
```bash
cd mobile
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```

---

## 🔧 Environment Variables

```bash
# Binance
BINANCE_API_KEY=
BINANCE_API_SECRET=

# Auth
JWT_SECRET=

# AI (OpenRouter - Free models)
OPENROUTER_API_KEY=

# Stripe (Optional - for subscriptions)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=
STRIPE_ENTERPRISE_PRICE_ID=

# Frontend
FRONTEND_URL=http://localhost:3000

# Deploy
NODE_ENV=production
PORT=3001
```

---

## 📈 Features Implemented

### ✅ Core Trading (6)
- [x] 12-node decision pipeline
- [x] 10 coin tracking
- [x] Auto buy/sell execution
- [x] Risk management (trailing stop, TP, hard stop)
- [x] Market regime detection
- [x] Multi-timeframe analysis

### ✅ Trading Controls (5)
- [x] Emergency sell button (instant)
- [x] Pause/resume per coin
- [x] Manual buy/sell with USDT amount
- [x] 15-minute cooldown post-sell
- [x] Confirmation modal for all trades

### ✅ Mobile App (7)
- [x] Portfolio dashboard with live PnL
- [x] Coin detail with charts
- [x] Trade history with filtering
- [x] Push notifications
- [x] Biometric authentication
- [x] Offline support with cache
- [x] Multi-language (EN/ES)

### ✅ Analytics & AI (6)
- [x] AI trade analysis (OpenRouter free models)
- [x] AI portfolio analysis
- [x] Performance metrics (win rate, Sharpe, drawdown)
- [x] PnL equity curve
- [x] PnL in USDT (not just %)
- [x] By-coin performance breakdown

### ✅ Advanced Features (7)
- [x] Custom indicator builder (8 templates)
- [x] Data export (CSV/JSON)
- [x] Obsidian markdown export
- [x] Backtesting engine (4 presets)
- [x] Configurable profit/loss alerts
- [x] Alert trigger history
- [x] 60-second alert checking scheduler

### ✅ Billing & Monetization (3)
- [x] Stripe subscription billing (Free/Pro/Enterprise)
- [x] Checkout flow
- [x] Customer portal

### ✅ Infrastructure (6)
- [x] Docker deployment
- [x] Fly.io deployment
- [x] GitHub Actions CI/CD
- [x] Rate limiting + security
- [x] Monitoring + alerts
- [x] Log rotation

---

## 🧪 Testing

```bash
cd backend
npm test           # Run all 153 tests
npx tsc --noEmit   # Type check
```

### Test Coverage
- Trading engine: 35 tests
- Indicators: 28 tests
- Validation: 22 tests
- WebSocket: 18 tests
- Auth: 15 tests
- Scoring: 12 tests
- Risk: 10 tests
- Other: 13 tests

---

## 📝 Next Steps (TODO)

### High Priority
- [ ] Telegram bot integration
- [ ] Web dashboard (admin panel)
- [ ] EAS build setup for APK generation

### Medium Priority
- [ ] Multi-exchange support
- [ ] Advanced backtesting (multi-coin, portfolio simulation)
- [ ] Walk-forward optimization

### Low Priority
- [ ] Social trading (follow top performers)
- [ ] Advanced charting (TradingView integration)
- [ ] Custom notification sounds

---

## 📚 Documentation

- `PROJECT_STATE.md` — This file (complete project overview)
- `memory/SESSION_LOG.md` — Session history
- `memory/KNOWLEDGE_ARCHITECTURE.md` — Deep architecture knowledge
- `docs/API_REFERENCE.md` — All API endpoints
- `docs/MOBILE_APP.md` — Mobile app guide
- `docs/DEPLOYMENT.md` — Deployment guide

---

## 👨‍💻 Author

Built with 🪙 by El Oráculo Team

---

*This document is auto-generated. Run `npm run docs` to update.*
