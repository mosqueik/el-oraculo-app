# 📚 El Oráculo — API Reference

> Complete reference for all backend API endpoints.  
> Base URL: `http://localhost:3001/api`

---

## 🔐 Authentication

All protected endpoints require:
```
Authorization: Bearer <jwt_token>
```

---

## 🏥 Health & Status

### GET /api/health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-09-01T10:00:00Z"
}
```

### GET /api/status
Get bot status (requires auth).

**Response:**
```json
{
  "running": true,
  "uptime": 3600,
  "cycleCount": 15,
  "lastCycle": "2026-09-01T10:05:00Z"
}
```

### POST /api/start
Start the trading bot.

**Response:**
```json
{
  "success": true,
  "message": "Bot started"
}
```

### POST /api/stop
Stop the trading bot.

**Response:**
```json
{
  "success": true,
  "message": "Bot stopped"
}
```

---

## 💰 Portfolio

### GET /api/portfolio
Get all coin states.

**Response:**
```json
[
  {
    "coin": "BTC",
    "status": "COMPRADO",
    "entryPrice": 65000.00,
    "entryTime": "2026-09-01T10:00:00Z",
    "tpTarget": 68250.00,
    "pisoActual": 64500.00,
    "streakLosses": 0,
    "montoEntrada": 100.00,
    "lastSellTime": null,
    "lastSellPrice": 0,
    "updatedAt": "2026-09-01T10:00:00Z"
  }
]
```

### GET /api/portfolio/:coin
Get specific coin state.

**Params:**
- `coin` — Coin symbol (BTC, ETH, SOL, etc.)

**Response:** Single bot state object.

### GET /api/portfolio/pnl
Get real-time PnL for all positions.

**Response:**
```json
{
  "positions": [
    {
      "coin": "BTC",
      "status": "COMPRADO",
      "currentPrice": 65432.12,
      "entryPrice": 65000.00,
      "pnlPct": 0.66,
      "pnlUsd": 66.40,
      "hoursHeld": 2.5,
      "cooldownRemaining": 0
    }
  ],
  "summary": {
    "activeCount": 3,
    "totalPnlPct": 1.23,
    "totalPnlUsd": 123.45,
    "positionsInProfit": 2,
    "positionsInLoss": 1
  }
}
```

### GET /api/portfolio/pnl/:coin
Get PnL for specific coin.

**Params:**
- `coin` — Coin symbol

**Response:** Single position PnL object.

### GET /api/balance
Get USDT balance.

**Response:**
```json
{
  "usdt_free": 5000.00,
  "usdt_total": 10000.00
}
```

---

## 📊 Trades

### GET /api/trades
Get trade history.

**Query Params:**
- `coin` — Filter by coin (optional)
- `limit` — Number of trades (default: 100)

**Response:**
```json
[
  {
    "id": 1,
    "coin": "BTC",
    "decision": "COMPRAR",
    "motivo": "ENTRY: RSI_OVERSOLD+ADX_STRONG",
    "monto": 100.00,
    "precio": 65432.12,
    "rsi": 32.5,
    "adx": 18.2,
    "direction": "BULLISH",
    "entryPrice": 65432.12,
    "entryTime": "2026-09-01T10:00:00Z",
    "pnl": "0%",
    "timestamp": "2026-09-01T10:00:00Z"
  }
]
```

### GET /api/trades/recent
Get recent trades.

**Query Params:**
- `hours` — Hours to look back (default: 24)

### GET /api/trades/:coin
Get trades for specific coin.

---

## 📋 Executions

### GET /api/executions
Get execution log.

**Query Params:**
- `limit` — Number of executions (default: 50)

### GET /api/executions/errors
Get execution errors only.

**Query Params:**
- `hours` — Hours to look back (default: 24)

---

## 🔐 Auth

### POST /api/auth/register
Register new user.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "John Doe",
      "plan": "free"
    }
  }
}
```

### POST /api/auth/login
Login.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:** Same as register.

### GET /api/auth/me
Get current user (requires auth).

**Response:** User object.

---

## 🎮 Trading Controls

### POST /api/trading/emergency-sell/:coin
Emergency sell at market price.

**Params:**
- `coin` — Coin symbol

**Response:**
```json
{
  "success": true,
  "data": {
    "coin": "BTC",
    "action": "VENDER",
    "price": 65432.12,
    "pnl": "+0.66%"
  }
}
```

### POST /api/trading/manual-buy/:coin
Manual buy with USDT amount.

**Params:**
- `coin` — Coin symbol

**Body:**
```json
{
  "amountUsdt": 50.00
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "coin": "BTC",
    "action": "COMPRAR",
    "amountUsdt": 50.00,
    "price": 65432.12,
    "quantity": 0.000763
  }
}
```

### POST /api/trading/manual-sell/:coin
Manual sell full position.

**Params:**
- `coin` — Coin symbol

**Response:**
```json
{
  "success": true,
  "data": {
    "coin": "BTC",
    "action": "VENDER",
    "price": 65432.12,
    "pnl": "+0.66%",
    "pnlUsd": 66.40
  }
}
```

### POST /api/trading/pause/:coin
Pause trading for a coin.

**Params:**
- `coin` — Coin symbol

### POST /api/trading/resume/:coin
Resume trading for a coin.

**Params:**
- `coin` — Coin symbol

### GET /api/trading/paused
Get list of paused coins.

**Response:**
```json
{
  "success": true,
  "data": {
    "paused": ["ADA", "DOGE"]
  }
}
```

---

## 📈 Analytics

### GET /api/analytics/performance
Get performance metrics.

**Response:**
```json
{
  "winRate": 62.5,
  "profitFactor": 1.85,
  "sharpeRatio": 1.2,
  "maxDrawdown": 12.3,
  "expectancy": 0.45,
  "totalTrades": 45,
  "winningTrades": 28,
  "losingTrades": 17,
  "avgWin": 2.3,
  "avgLoss": 1.1,
  "maxWin": 8.5,
  "maxLoss": 5.2
}
```

### GET /api/analytics/coin/:coin
Get analytics for specific coin.

**Params:**
- `coin` — Coin symbol

### GET /api/analytics/equity-curve
Get PnL equity curve data.

**Response:**
```json
{
  "equityCurve": [
    { "date": "2026-09-01", "equity": 10000 },
    { "date": "2026-09-02", "equity": 10150 }
  ],
  "drawdown": [
    { "date": "2026-09-01", "drawdown": 0 },
    { "date": "2026-09-02", "drawdown": -2.5 }
  ],
  "trades": [
    {
      "coin": "BTC",
      "pnl": 66.40,
      "cumulativePnl": 66.40,
      "timestamp": "2026-09-01T14:00:00Z"
    }
  ]
}
```

### POST /api/analytics/analyze-trade/:id
AI analysis of a specific trade.

**Params:**
- `id` — Trade ID

**Response:**
```json
{
  "analysis": {
    "summary": "BTC buy at $65,000 during oversold RSI conditions",
    "reason": "Entry was well-timed with RSI(14)=32.5 and ADX(14)=18.2",
    "riskAssessment": "Moderate risk, trailing stop protected downside",
    "lessons": "Consider waiting for ADX > 25 for stronger trend confirmation",
    "recommendation": "Good trade, repeat pattern in similar conditions"
  }
}
```

### POST /api/analytics/analyze-portfolio
AI analysis of entire portfolio.

**Response:**
```json
{
  "analysis": {
    "strengths": ["Good diversification", "Consistent entry timing"],
    "weaknesses": ["Holding losing positions too long"],
    "recommendations": ["Consider tighter stop losses", "Add more coins during trending markets"]
  }
}
```

### POST /api/analytics/recommendation/:coin
AI recommendation for a specific coin.

**Params:**
- `coin` — Coin symbol

---

## 📤 Data Export

### GET /api/export/trades
Export trades.

**Query Params:**
- `format` — `csv` or `json` (default: json)
- `coin` — Filter by coin (optional)

**Response:** CSV or JSON file.

### GET /api/export/executions
Export executions.

**Query Params:**
- `format` — `csv` or `json`

### GET /api/export/performance
Export performance report.

### GET /api/export/all
Export everything (trades + executions + performance).

### GET /api/export/obsidian
Export as Obsidian markdown.

**Query Params:**
- `coin` — Filter by coin (optional)

**Response:** Markdown string with frontmatter.

---

## 📊 Custom Indicators

### GET /api/indicators/templates
Get indicator templates.

**Response:**
```json
{
  "templates": [
    {
      "id": "rsi_divergence",
      "name": "RSI Divergence",
      "type": "momentum",
      "description": "Detects RSI divergences with price",
      "defaultParams": { "period": 14, "sensitivity": 3 }
    },
    {
      "id": "vwap_bands",
      "name": "VWAP Bands",
      "type": "volatility",
      "description": "VWAP with standard deviation bands",
      "defaultParams": { "period": 20, "multiplier": 2 }
    }
  ]
}
```

### GET /api/indicators/custom
Get user's custom indicators.

### POST /api/indicators/custom
Create custom indicator.

**Body:**
```json
{
  "name": "My RSI Divergence",
  "description": "Custom RSI divergence detector",
  "formula": { "type": "rsi", "params": { "period": 14 } },
  "type": "momentum",
  "timeframe": "15m",
  "parameters": { "period": 14, "sensitivity": 3 }
}
```

### PUT /api/indicators/custom/:id
Update custom indicator.

### DELETE /api/indicators/custom/:id
Delete custom indicator.

### POST /api/indicators/custom/:id/test
Test custom indicator with data.

**Body:**
```json
{
  "prices": [65000, 65100, 65200, 65150, 65300]
}
```

### GET /api/indicators/usage/:coin
Get indicator usage for a coin.

### POST /api/indicators/usage
Set indicator usage weight.

**Body:**
```json
{
  "indicatorId": 1,
  "coin": "BTC",
  "weight": 1.5,
  "enabled": true
}
```

---

## 🔔 Notifications

### POST /api/notifications/register
Register push token.

**Body:**
```json
{
  "token": "ExponentPushToken[xxx]",
  "platform": "ios"
}
```

### POST /api/notifications/unregister
Unregister push token.

**Body:**
```json
{
  "token": "ExponentPushToken[xxx]"
}
```

### GET /api/notifications/history
Get notification history.

**Query Params:**
- `limit` — Number of notifications (default: 50)
- `coin` — Filter by coin (optional)

### POST /api/notifications/test
Send test push notification.

---

## 💳 Billing

### GET /api/billing/plans
List available plans.

**Response:**
```json
{
  "plans": [
    {
      "id": "free",
      "name": "Free",
      "price": 0,
      "coins": 1,
      "features": ["Basic indicators", "Notifications"]
    },
    {
      "id": "pro",
      "name": "Pro",
      "price": 29,
      "coins": 5,
      "features": ["All indicators", "SM analysis", "Custom alerts"]
    },
    {
      "id": "enterprise",
      "name": "Enterprise",
      "price": 99,
      "coins": 100,
      "features": ["Custom indicators", "API access", "White-label"]
    }
  ]
}
```

### POST /api/billing/checkout
Create Stripe checkout session.

**Body:**
```json
{
  "planId": "pro",
  "successUrl": "https://app.example.com/success",
  "cancelUrl": "https://app.example.com/cancel"
}
```

### POST /api/billing/portal
Create Stripe customer portal session.

### GET /api/billing/subscription
Get current subscription.

### POST /api/billing/cancel
Cancel subscription.

---

## 📊 Monitoring

### GET /api/monitoring/health
System health check.

**Response:**
```json
{
  "status": "healthy",
  "uptime": 86400,
  "memory": { "used": 128, "total": 256 },
  "database": "connected"
}
```

### GET /api/monitoring/stats
System statistics.

### GET /api/monitoring/errors
Error statistics.

---

## 🔬 Backtesting

### GET /api/backtest/coins
Get available coins for backtesting.

**Response:**
```json
{
  "coins": ["BTC", "ETH", "SOL", "BNB", "AVAX", "POL", "SUI", "LINK", "NEAR", "DOGE"]
}
```

### GET /api/backtest/presets
Get strategy presets.

**Response:**
```json
{
  "presets": [
    {
      "name": "Conservative",
      "stopLossPct": 3,
      "takeProfitPct": 5,
      "maxHoldHours": 48,
      "description": "Low risk, steady returns"
    },
    {
      "name": "Balanced",
      "stopLossPct": 5,
      "takeProfitPct": 8,
      "maxHoldHours": 24,
      "description": "Balanced risk/reward"
    },
    {
      "name": "Aggressive",
      "stopLossPct": 8,
      "takeProfitPct": 15,
      "maxHoldHours": 12,
      "description": "High risk, high reward"
    },
    {
      "name": "Scalping",
      "stopLossPct": 1.5,
      "takeProfitPct": 2.5,
      "maxHoldHours": 2,
      "description": "Quick in/out trades"
    }
  ]
}
```

### POST /api/backtest/run
Run backtest.

**Body:**
```json
{
  "coin": "BTC",
  "startDate": "2026-01-01",
  "endDate": "2026-09-01",
  "initialBalance": 10000,
  "riskPct": 2,
  "stopLossPct": 5,
  "takeProfitPct": 8,
  "maxHoldHours": 24
}
```

**Response:**
```json
{
  "results": {
    "totalTrades": 45,
    "winRate": 62.5,
    "profitFactor": 1.85,
    "sharpeRatio": 1.2,
    "maxDrawdown": 12.3,
    "finalBalance": 12500,
    "totalReturn": 25.0,
    "equityCurve": [...],
    "monthlyReturns": [...],
    "trades": [...]
  }
}
```

### POST /api/backtest/compare
Compare multiple scenarios.

**Body:**
```json
{
  "scenarios": [
    { "coin": "BTC", "stopLossPct": 3, "takeProfitPct": 5 },
    { "coin": "BTC", "stopLossPct": 5, "takeProfitPct": 8 }
  ]
}
```

---

## 🔔 Alerts

### GET /api/alerts
Get all alert configs.

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "coin": "BTC",
      "alertType": "profit_usdt",
      "threshold": 20,
      "enabled": true,
      "triggered": false,
      "cooldownMinutes": 60,
      "createdAt": "2026-09-01T10:00:00Z"
    }
  ]
}
```

### GET /api/alerts/:coin
Get alerts for specific coin.

### POST /api/alerts
Create alert config.

**Body:**
```json
{
  "coin": "BTC",
  "alertType": "profit_usdt",
  "threshold": 20,
  "cooldownMinutes": 60
}
```

**Alert Types:**
- `profit_pct` — Profit percentage threshold
- `loss_pct` — Loss percentage threshold
- `profit_usdt` — Profit USDT threshold
- `loss_usdt` — Loss USDT threshold
- `price_above` — Price above threshold
- `price_below` — Price below threshold

### PUT /api/alerts/:id
Update alert config.

**Body:**
```json
{
  "threshold": 25,
  "enabled": true,
  "cooldownMinutes": 30
}
```

### DELETE /api/alerts/:id
Delete alert config.

### POST /api/alerts/check
Manually trigger alert check.

**Response:**
```json
{
  "triggered": true,
  "alerts": [
    {
      "configId": 1,
      "coin": "BTC",
      "alertType": "profit_usdt",
      "threshold": 20,
      "currentValue": 22.50,
      "message": "🟢 BTC profit reached $22.50 (threshold: $20)"
    }
  ]
}
```

### GET /api/alerts/history/all
Get alert trigger history.

**Query Params:**
- `limit` — Number of records (default: 50)

### GET /api/alerts/history/:coin
Get history for specific coin.

### GET /api/alerts/summary/:coin
Get alert summary for a coin.

**Response:**
```json
{
  "activeAlerts": 3,
  "triggeredToday": 1,
  "recentAlerts": [...]
}
```

---

## 📡 WebSocket

### Connection
```
ws://localhost:3001
```

### Events

#### price:update (every 10s)
```json
{
  "coin": "BTC",
  "price": 65432.12,
  "change24h": 2.5
}
```

#### score:update (every 30s)
```json
{
  "coin": "BTC",
  "score": 3.5,
  "rsi": 45.2,
  "adx": 28.1
}
```

#### trade:executed (on trade)
```json
{
  "coin": "BTC",
  "action": "COMPRAR",
  "price": 65432.12,
  "motivo": "ENTRY: RSI_OVERSOLD+ADX_STRONG"
}
```

#### pnl:update (every 60s)
```json
{
  "positions": [
    {
      "coin": "BTC",
      "status": "COMPRADO",
      "currentPrice": 65432.12,
      "entryPrice": 65000.00,
      "pnlPct": 0.66,
      "pnlUsd": 66.40,
      "hoursHeld": 2.5,
      "cooldownRemaining": 0
    }
  ],
  "summary": {
    "activeCount": 3,
    "totalPnlPct": 1.23,
    "totalPnlUsd": 123.45,
    "positionsInProfit": 2,
    "positionsInLoss": 1
  }
}
```

#### status:update (on change)
```json
{
  "coin": "BTC",
  "status": "COMPRADO",
  "entryPrice": 65000.00
}
```

#### bot:status (on change)
```json
{
  "running": true,
  "uptime": 3600
}
```

---

## ❌ Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message"
}
```

**Status Codes:**
- `400` — Bad request (invalid parameters)
- `401` — Unauthorized (missing/invalid token)
- `403` — Forbidden (insufficient permissions)
- `404` — Not found
- `429` — Too many requests (rate limited)
- `500` — Internal server error

---

*Generated by El Oráculo 🪙*
