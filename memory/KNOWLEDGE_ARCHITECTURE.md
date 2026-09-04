# 🧠 El Oráculo — Knowledge Architecture

> Deep technical knowledge base for the El Oráculo trading bot system.  
> Read this to understand how everything connects.

---

## 🏗️ System Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER FLOW                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Mobile App (Expo)                                              │
│      │                                                          │
│      ├── REST API ──→ Express Router ──→ Controllers ──→ DB    │
│      │                                                          │
│      └── WebSocket ──→ WS Server ──→ PriceTicker ──→ Binance  │
│                                    └── PnL Calculator ──→ DB  │
│                                                                 │
│  Trading Engine (Server-side)                                   │
│      │                                                          │
│      ├── Scheduler (5min) ──→ runCycle() ──→ 12-node pipeline │
│      │                                                          │
│      ├── PriceTicker (10s) ──→ broadcast prices + PnL         │
│      │                                                          │
│      └── AlertService (60s) ──→ check thresholds ──→ push     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Trading Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRADING PIPELINE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  For each coin in [BTC, ETH, SOL, BNB, AVAX, POL, SUI, ...]:  │
│                                                                 │
│  1. INDICATORS (15m candles)                                    │
│     ├── RSI(14) ──→ momentum signal                            │
│     ├── ADX(14) ──→ trend strength                             │
│     ├── Momentum(12) ──→ direction                              │
│     └── Fair Value Gap ──→ imbalance                            │
│                                                                 │
│  2. MULTI-TIMEFRAME SMART MONEY                                 │
│     ├── 15m structure ──→ short-term bias                      │
│     ├── 1h structure ──→ medium-term bias                      │
│     └── 4h structure ──→ long-term bias                        │
│                                                                 │
│  3. MARKET REGIME                                               │
│     └── Trending? Ranging? ──→ affects scoring weights         │
│                                                                 │
│  4. STATUS                                                      │
│     └── COMPRADO? LÍQUIDO? ──→ determines available actions    │
│                                                                 │
│  5. SCORING                                                     │
│     └── Combine all signals ──→ entry score (0-5)              │
│                                                                 │
│  6. RISK                                                        │
│     ├── Calculate stop loss (hard stop + trailing)              │
│     ├── Calculate take profit                                   │
│     └── Position sizing based on risk %                        │
│                                                                 │
│  7. DECISION                                                    │
│     └── COMPRAR / VENDER / ESPERAR                             │
│                                                                 │
│  8. FILTER                                                      │
│     ├── Validate decision logic                                 │
│     └── COOLDOWN CHECK: 15min post-sell                        │
│                                                                 │
│  9. EXECUTE                                                     │
│     └── Place order on Binance (market order)                  │
│                                                                 │
│  10. LOG                                                        │
│      └── Store in trade_log + execution_log                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔌 WebSocket Architecture

### Events Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    WEBSOCKET EVENTS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PriceTicker (every 10s)                                        │
│      │                                                          │
│      ├── price:update ──→ { coin, price, change24h }           │
│      │                                                          │
│      └── pnl:update ──→ { positions[], summary{} }             │
│          (every 60s)                                            │
│                                                                 │
│  TradingEngine (on trade)                                       │
│      │                                                          │
│      ├── trade:executed ──→ { coin, action, price, motivo }    │
│      │                                                          │
│      └── status:update ──→ { coin, status, entryPrice }        │
│                                                                 │
│  Scheduler (on cycle)                                           │
│      │                                                          │
│      └── score:update ──→ { coin, score, rsi, adx }           │
│                                                                 │
│  AlertService (on trigger)                                      │
│      │                                                          │
│      └── alert:triggered ──→ { coin, type, message }           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### PnL Calculation Logic

```typescript
// Real-time PnL calculation (server-side)
function calculatePnL(position) {
  const currentPrice = getLivePrice(position.coin);
  const entryPrice = position.entryPrice;
  const montoEntrada = position.montoEntrada;

  // Percentage PnL
  const pnlPct = ((currentPrice - entryPrice) / entryPrice) * 100;

  // USDT PnL (absolute value)
  const pnlUsd = (currentPrice - entryPrice) * (montoEntrada / entryPrice);

  // Hours held
  const hoursHeld = (Date.now() - new Date(position.entryTime).getTime()) / (1000 * 60 * 60);

  // Cooldown remaining (if recently sold)
  const cooldownRemaining = getCooldownRemaining(position.coin);

  return { pnlPct, pnlUsd, hoursHeld, cooldownRemaining };
}
```

---

## 🎯 Cooldown Mechanism

### Problem Solved
Without cooldown, the bot would:
1. Sell BTC at $65,000
2. Wait 5 minutes (next cycle)
3. See good indicators again
4. Buy BTC immediately at $65,100
5. Repeat endlessly

### Solution
After selling, enforce a 15-minute cooldown before allowing another buy:

```typescript
// In engine.ts
const COOLDOWN_MINUTES = 15;

function filterDecision(decision, coin, botState) {
  if (decision.action === 'COMPRAR') {
    const lastSellTime = botState.lastSellTime;
    if (lastSellTime) {
      const minutesSinceSell = (Date.now() - new Date(lastSellTime).getTime()) / (1000 * 60);
      if (minutesSinceSell < COOLDOWN_MINUTES) {
        decision.action = 'ESPERAR';
        decision.motivo = `COOLDOWN: ${COOLDOWN_MINUTES}min post-venta (${(COOLDOWN_MINUTES - minutesSinceSell).toFixed(1)}min restante)`;
      }
    }
  }
  return decision;
}
```

### User Visibility
- Dashboard shows "⏳ 12m cooldown" badge on coins in cooldown
- AlertSettings can trigger when cooldown expires

---

## 📊 Alert System Architecture

### Alert Types

| Type | Trigger Condition | Example |
|------|-------------------|---------|
| `profit_pct` | PnL % >= threshold | BTC +5% |
| `loss_pct` | |PnL %| >= threshold | BTC -3% |
| `profit_usdt` | PnL USDT >= threshold | BTC +$20 |
| `loss_usdt` | |PnL USDT| >= threshold | BTC -$5 |
| `price_above` | Price >= threshold | BTC > $70,000 |
| `price_below` | Price <= threshold | BTC < $60,000 |

### Alert Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    ALERT CHECK FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Scheduler (every 60s)                                          │
│      │                                                          │
│      └── alertService.checkAlerts()                             │
│          │                                                      │
│          ├── Get all enabled alerts from DB                     │
│          │                                                      │
│          └── For each alert:                                    │
│              │                                                  │
│              ├── Check cooldown (if triggered recently)          │
│              │                                                  │
│              ├── Get current PnL for coin                       │
│              │                                                  │
│              ├── Compare against threshold                      │
│              │                                                  │
│              └── If triggered:                                  │
│                  ├── Mark as triggered in DB                    │
│                  ├── Log to alert_history                       │
│                  ├── Send push notification                     │
│                  └── Log to console                             │
│                                                                 │
│  Reset (daily at midnight)                                      │
│      │                                                          │
│      └── Reset all "triggered" flags for new day                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📱 Mobile App Architecture

### Navigation Structure

```
App.tsx
├── AuthStack (if not authenticated)
│   ├── LoginScreen
│   └── RegisterScreen
│
└── MainStack (if authenticated)
    ├── DashboardScreen
    │   ├── CoinCard (per coin)
    │   │   ├── PnLBadge (% + USDT)
    │   │   ├── Buy/Sell buttons
    │   │   └── Cooldown badge
    │   ├── MiniEquityCurve
    │   └── EmergencyStopButton
    │
    ├── CoinDetailScreen
    │   ├── PriceChart
    │   ├── IndicatorGauges
    │   └── EmergencySellButton
    │
    ├── TradeHistoryScreen
    │   ├── TradeList (filterable)
    │   ├── ExportButton (CSV/JSON)
    │   └── BacktestButton
    │
    ├── TradeDetailScreen
    │   ├── TradeInfo
    │   └── AIAnalysisSection
    │
    ├── AnalyticsScreen
    │   ├── OverviewTab (stats, metrics)
    │   ├── ByCoinTab (individual performance)
    │   ├── EquityTab (PnL curve, drawdown)
    │   └── AIInsightsTab (portfolio analysis)
    │
    ├── BacktestScreen
    │   ├── CoinSelector
    │   ├── DateRange
    │   ├── PresetSelector (4 options)
    │   ├── EquityCurveChart
    │   └── ResultsTable
    │
    ├── AlertSettingsScreen
    │   ├── QuickPresets (4 buttons)
    │   ├── ActiveAlerts (list)
    │   ├── AlertHistory
    │   └── CreateModal
    │
    ├── SubscriptionScreen
    │   ├── PlanCards (Free/Pro/Enterprise)
    │   └── CheckoutButton
    │
    ├── CustomIndicatorScreen
    │   ├── MyIndicators (list)
    │   ├── Templates (8 options)
    │   └── CreateForm
    │
    ├── NotificationsScreen
    │   └── NotificationHistory
    │
    └── SettingsScreen
        ├── Connection status
        ├── Bot control
        ├── Language toggle (EN/ES)
        ├── Alert settings link
        ├── Biometric toggle
        └── Account info
```

### State Management

```
┌─────────────────────────────────────────────────────────────────┐
│                    ZUSTAND STORES                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  useBotStatusStore                                              │
│      ├── running: boolean                                       │
│      ├── cycleCount: number                                     │
│      ├── uptime: number                                         │
│      └── fetchStatus()                                          │
│                                                                 │
│  useConnectionStore                                             │
│      ├── connected: boolean                                     │
│      └── lastPing: Date                                         │
│                                                                 │
│  useAuth (custom hook)                                          │
│      ├── user: User | null                                      │
│      ├── token: string | null                                   │
│      ├── login(email, password)                                 │
│      ├── register(email, password, name)                        │
│      └── logout()                                               │
│                                                                 │
│  useWebSocket (custom hook)                                     │
│      ├── prices: Record<string, number>                         │
│      ├── livePnL: PnLData                                       │
│      └── getPnLForCoin(coin)                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🧪 Backtesting Architecture

### Strategy: RSI + ADX

```
┌─────────────────────────────────────────────────────────────────┐
│                    BACKTESTING STRATEGY                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Entry Conditions (COMPRAR):                                    │
│      ├── RSI(14) < 35 (oversold)                               │
│      ├── ADX(14) > 20 (trending)                               │
│      └── Momentum > 0 (positive)                               │
│                                                                 │
│  Exit Conditions (VENDER):                                      │
│      ├── Take Profit hit (e.g., +8%)                            │
│      ├── Stop Loss hit (e.g., -5%)                              │
│      ├── Max hold time exceeded (e.g., 24h)                     │
│      └── Trailing stop triggered                                │
│                                                                 │
│  Presets:                                                       │
│      Conservative: 3% SL, 5% TP, 48h max                       │
│      Balanced:     5% SL, 8% TP, 24h max                       │
│      Aggressive:   8% SL, 15% TP, 12h max                      │
│      Scalping:    1.5% SL, 2.5% TP, 2h max                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Metrics Calculated

- **Win Rate:** % of profitable trades
- **Profit Factor:** Gross profit / Gross loss
- **Sharpe Ratio:** Risk-adjusted return
- **Max Drawdown:** Maximum peak-to-trough decline
- **Expectancy:** Average profit per trade
- **Avg Hold Time:** Average duration of trades
- **Monthly Returns:** Month-by-month breakdown
- **Equity Curve:** Portfolio value over time

---

## 🔐 Security Architecture

### Rate Limiting

```
┌─────────────────────────────────────────────────────────────────┐
│                    RATE LIMITING                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  API General: 100 requests per minute                           │
│      └── Applies to all /api routes                             │
│                                                                 │
│  Auth: 5 requests per minute                                    │
│      └── /api/auth/* (login, register)                          │
│      └── Prevents brute force                                   │
│                                                                 │
│  Write: 30 requests per minute                                  │
│      └── POST, PUT, DELETE, PATCH                               │
│      └── Prevents data flooding                                 │
│                                                                 │
│  Notifications: 2 requests per minute                           │
│      └── /api/notifications/*                                   │
│      └── Prevents spam                                          │
│                                                                 │
│  WebSocket: 10 connections per minute                           │
│      └── Per IP address                                         │
│      └── Prevents DoS                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTH FLOW                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Register:                                                      │
│      POST /api/auth/register                                   │
│      ├── Validate email + password (Zod)                        │
│      ├── Hash password (bcrypt)                                 │
│      ├── Store in users table                                   │
│      └── Return JWT token                                       │
│                                                                 │
│  Login:                                                         │
│      POST /api/auth/login                                      │
│      ├── Find user by email                                     │
│      ├── Compare password (bcrypt)                              │
│      ├── Generate JWT token (24h expiry)                        │
│      └── Return token + user data                               │
│                                                                 │
│  Protected Routes:                                              │
│      Authorization: Bearer <jwt_token>                          │
│      ├── Verify JWT signature                                   │
│      ├── Check expiry                                           │
│      ├── Attach user to request                                 │
│      └── Continue to handler                                    │
│                                                                 │
│  Biometric (Mobile):                                            │
│      ├── Store credentials in Keychain/Keystore                 │
│      ├── Authenticate with Face ID/Fingerprint                  │
│      ├── Retrieve stored credentials                            │
│      └── Call login API with stored credentials                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Deployment Architecture

### Fly.io Deployment

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLY.IO DEPLOYMENT                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  fly.toml                                                       │
│      ├── app: el-oraculo-backend                                │
│      ├── primary_region: ar (Buenos Aires)                      │
│      ├── VM: shared-cpu-1x (free tier)                          │
│      ├── Memory: 256MB                                          │
│      └── Auto-scaling: 0-1 instances                            │
│                                                                 │
│  Secrets (encrypted):                                           │
│      ├── BINANCE_API_KEY                                        │
│      ├── BINANCE_API_SECRET                                     │
│      ├── JWT_SECRET                                             │
│      ├── OPENROUTER_API_KEY                                     │
│      ├── STRIPE_SECRET_KEY                                      │
│      └── STRIPE_WEBHOOK_SECRET                                  │
│                                                                 │
│  Deploy Process:                                                │
│      1. Push to GitHub                                          │
│      2. GitHub Actions runs tests                               │
│      3. If tests pass, deploy to Fly.io                         │
│      4. Fly.io builds Docker image                              │
│      5. Deploys to VM                                           │
│      6. Health check passes                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Export Formats

### CSV Format
```csv
ID,Coin,Action,Price,Monto,RSI,ADX,Direction,Entry Price,Entry Time,PnL,Reason,Timestamp
1,BTC,COMPRAR,65432.12,100.00,32.5,18.2,BULLISH,65432.12,2026-09-01T10:00:00,0%,ENTRY: RSI_OVERSOLD+ADX_STRONG,2026-09-01T10:00:00
2,BTC,VENDER,66000.00,100.00,68.2,22.1,BULLISH,65432.12,2026-09-01T10:00:00,+0.87%,EXIT: TRAILING_STOP,2026-09-01T14:00:00
```

### JSON Format
```json
{
  "trades": [
    {
      "id": 1,
      "coin": "BTC",
      "decision": "COMPRAR",
      "precio": 65432.12,
      "monto": 100.00,
      "rsi": 32.5,
      "adx": 18.2,
      "direction": "BULLISH",
      "entryPrice": 65432.12,
      "pnl": "0%",
      "motivo": "ENTRY: RSI_OVERSOLD+ADX_STRONG",
      "timestamp": "2026-09-01T10:00:00Z"
    }
  ]
}
```

### Obsidian Markdown
```markdown
---
title: El Oráculo Trade Log
date: 2026-09-01
total_trades: 45
win_rate: 62%
---

# Trade Log

## BTC

| Time | Action | Price | PnL | Reason |
|------|--------|-------|-----|--------|
| 10:00 | COMPRAR | $65,432 | - | RSI_OVERSOLD |
| 14:00 | VENDER | $66,000 | +0.87% | TRAILING_STOP |
```

---

## 🔧 Environment Variables Reference

### Required
```bash
BINANCE_API_KEY=           # Binance API key
BINANCE_API_SECRET=        # Binance API secret
JWT_SECRET=                # JWT signing secret (min 32 chars)
```

### Optional
```bash
OPENROUTER_API_KEY=        # OpenRouter API key (free models work)
STRIPE_SECRET_KEY=         # Stripe secret key (for subscriptions)
STRIPE_WEBHOOK_SECRET=     # Stripe webhook secret
STRIPE_PRO_PRICE_ID=       # Stripe price ID for Pro plan
STRIPE_ENTERPRISE_PRICE_ID= # Stripe price ID for Enterprise plan
PORT=3001                  # Backend port (default: 3001)
NODE_ENV=production        # Environment (development/production)
FRONTEND_URL=              # Frontend URL for CORS
```

### Mobile (Expo)
```bash
EXPO_PUBLIC_API_URL=       # Backend URL (default: http://localhost:3001)
```

---

## 📝 Migration History

| Migration | Tables Added | Description |
|-----------|--------------|-------------|
| 0000_init | 12 tables | Initial schema (bot_state, trade_log, users, etc.) |
| 0001_add_alerts | 2 tables | Alert config + alert history |

---

## 🎯 Performance Considerations

### Database
- SQLite with WAL mode for concurrent reads
- Drizzle ORM for type-safe queries
- Repositories pattern for clean data access

### WebSocket
- PnL broadcast every 60s (not every tick)
- Price updates every 10s
- Lazy connections (only when screen is active)

### Mobile
- AsyncStorage cache with TTL
- Offline-first with fallback
- Lazy loading of screens

### Backend
- Rate limiting on all endpoints
- Request size limits (1mb)
- Graceful shutdown handling

---

*Generated by El Oráculo 🪙*
