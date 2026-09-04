# 🏗️ ARCHITECTURE — El Oráculo App
> Documento técnico de arquitectura del sistema completo

---

## 1. VISIÓN GENERAL

El Oráculo es un **trading bot automatizado** para cryptocurrency que:
- Ejecuta estrategias de compra/venta en Binance
- Usa indicadores técnicos (RSI, ADX, Bollinger, ATR, etc.)
- Calcula scores de entrada basados en múltiples señales
- Gestiona riesgo con trailing stop, time exit, break-even
- Provee app mobile para monitoreo y control

### Flujo de Datos
```
Binance API → Indicadores → Scoring → Decisión → Trade → Log → Notificación
     ↓                                                              ↓
  Price Data                                              Mobile App (React Native)
```

---

## 2. SISTEMA ACTUAL (n8n)

### Pipeline de 12 Nodos
```
1. CONFIG        → Configuración por moneda (14 monedas activas)
2. PARSE & MERGE → Combina datos de todas las fuentes
3. STATUS        → Verifica posición actual (COMPRADO/LÍQUIDO)
4. MARKET REGIME → Detecta condiciones del mercado
5. INDICATORS    → Calcula RSI, ADX, Bollinger, ATR, MACD, etc.
6. RISK          → Calcula stops, TP, trailing stop
7. SCORING       → Score de entrada (0-6 puntos)
8. DECISION      → Comprar / Vender / Esperar
9. EXIT          → Verifica condiciones de salida
10. OUTPUT       → Formatea resultados
11. FILTER       → Filtra decisiones
12. LOG          → Log a DB + notificaciones
```

### Problemas del Sistema Actual
| Problema | Causa | Impacto |
|----------|-------|---------|
| Congestión (500+ ejecuciones) | 9 WFs × 1min = 36 ejecuciones/min | Bot no responde |
| Sin API REST | n8n no expone endpoints | No se puede conectar mobile |
| Sin tests | Scripts manuales | Bugs como risk_pct double-division |
| No es vendible | Herramienta, no producto | Sin revenue |
| Dependencia de n8n | Framework visual | Difícil de mantener/versionar |

---

## 3. ARQUITECTURA OBJETIVO

### 3.1 Alto Nivel
```
┌─────────────────────────────────────────────────────────────┐
│                     CLOUD (Railway/Render)                    │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    BACKEND (Node.js)                      │ │
│  │                                                           │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐│ │
│  │  │ Trading  │  │ Indicat. │  │ Scoring  │  │ Risk     ││ │
│  │  │ Engine   │  │ Service  │  │ Service  │  │ Service  ││ │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘│ │
│  │       └──────────────┴──────────────┴──────────────┘      │ │
│  │                         │                                  │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐│ │
│  │  │ Exchange │  │ Database │  │ Scheduler│  │ Notif.   ││ │
│  │  │ Service  │  │ (SQLite) │  │ (Cron)   │  │ Service  ││ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘│ │
│  │                                                           │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │ │
│  │  │ REST API │  │ WebSocket│  │ Auth     │              │ │
│  │  │ (Express)│  │ (Socket) │  │ (JWT)    │              │ │
│  │  └──────────┘  └──────────┘  └──────────┘              │ │
│  └─────────────────────────────────────────────────────────┘ │
│                           │                                    │
│  ┌────────────────────────┼────────────────────────────────┐ │
│  │                  SHARED PACKAGE                          │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │ │
│  │  │ Types    │  │ Constants│  │ Utils    │              │ │
│  │  └──────────┘  └──────────┘  └──────────┘              │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                     REST API + WebSocket
                            │
┌───────────────────────────┼────────────────────────────────┐
│                     MOBILE APP (React Native)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Dashboard │  │ Trades   │  │ Settings │  │ Alerts   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Flujo de una Ejecución
```
[Cron 5min] → [Trading Engine]
    │
    ├─→ [Exchange] getBalance() → USDT available
    │
    ├─→ [Exchange] getKlines(pair, 15m, 100) → OHLCV data
    │
    ├─→ [Indicators] calculate(data)
    │   ├─→ RSI(14)
    │   ├─→ ADX(14)
    │   ├─→ Bollinger(20, 2)
    │   ├─→ ATR(14)
    │   ├─→ EMA(20, 50)
    │   └─→ Volume analysis
    │
    ├─→ [Scoring] evaluate(indicators, position)
    │   ├─→ RSI oversold? (+1)
    │   ├─→ FVG bullish? (+1)
    │   ├─→ ADX strong? (+1)
    │   └─→ Score / threshold
    │
    ├─→ [Risk] calculate(exposure, volatility)
    │   ├─→ Trailing stop (5% trail)
    │   ├─→ Hard stop (ATR × 1.5)
    │   ├─→ Take profit (dynamic)
    │   └─→ Time exit (8h max)
    │
    ├─→ [Decision] evaluate(score, risk, position)
    │   ├─→ BUY (score ≥ threshold, balance OK)
    │   ├─→ SELL (exit conditions met)
    │   └─→ WAIT (nothing to do)
    │
    └─→ [Execute + Log]
        ├─→ Exchange: marketBuy() or marketSell()
        ├─→ Database: save trade_log
        ├─→ Database: update bot_state
        └─→ Notification: Telegram + Push
```

---

## 4. MÓDULOS DETALLADOS

### 4.1 Trading Engine (`backend/src/modules/trading/engine.ts`)

**Responsabilidad:** Orquestar todo el pipeline de trading.

```typescript
class TradingEngine {
  private exchange: ExchangeService;
  private indicators: IndicatorService;
  private scoring: ScoringService;
  private risk: RiskService;
  private db: DatabaseService;
  private notifier: NotificationService;

  async run(coin: CoinSymbol): Promise<DecisionResult> {
    // 1. Get current state
    const state = await this.db.getBotState(coin);
    const balance = await this.exchange.getUSDTBalance();
    const klines = await this.exchange.getKlines(coin, '15m', 100);

    // 2. Calculate indicators
    const indicators = this.indicators.calculate(klines);

    // 3. Score entry opportunity
    const scoring = this.scoring.evaluate(indicators, state);

    // 4. Calculate risk
    const risk = this.risk.calculate(state, indicators, balance);

    // 5. Make decision
    const decision = this.decide(scoring, risk, state, balance);

    // 6. Execute if needed
    if (decision.action !== 'WAIT') {
      await this.execute(decision, coin);
    }

    // 7. Log everything
    await this.log(coin, decision, indicators, scoring);

    return decision;
  }
}
```

### 4.2 Exchange Service (`backend/src/modules/exchange/service.ts`)

**Responsabilidad:** Comunicación con Binance API.

```typescript
class ExchangeService {
  private client: Binance;

  async getBalance(): Promise<{ usdt: number; coins: Record<string, number> }> {
    const account = await this.client.accountInfo();
    return {
      usdt: account.balances.find(b => b.asset === 'USDT')?.free || 0,
      coins: Object.fromEntries(
        account.balances
          .filter(b => parseFloat(b.free) > 0)
          .map(b => [b.asset, parseFloat(b.free)])
      )
    };
  }

  async getKlines(symbol: string, interval: string, limit: number): Promise<Kline[]> {
    return this.client.getKlines({ symbol, interval, limit });
  }

  async marketBuy(symbol: string, quantity: number): Promise<Order> {
    return this.client.newOrder({
      symbol,
      side: 'BUY',
      type: 'MARKET',
      quantity: quantity.toString()
    });
  }

  async marketSell(symbol: string, quantity: number): Promise<Order> {
    return this.client.newOrder({
      symbol,
      side: 'SELL',
      type: 'MARKET',
      quantity: quantity.toString()
    });
  }
}
```

### 4.3 Indicator Service (`backend/src/modules/indicators/service.ts`)

**Responsabilidad:** Calcular todos los indicadores técnicos.

```typescript
class IndicatorService {
  calculate(klines: Kline[]): IndicatorData {
    const closes = klines.map(k => k.close);
    const highs = klines.map(k => k.high);
    const lows = klines.map(k => k.low);
    const volumes = klines.map(k => k.volume);

    return {
      rsi: RSI.calculate({ values: closes, period: 14 }),
      adx: ADX.calculate({ high: highs, low: lows, close: closes, period: 14 }),
      bb: BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 }),
      atr: ATR.calculate({ high: highs, low: lows, close: closes, period: 14 }),
      ema20: EMA.calculate({ values: closes, period: 20 }),
      ema50: EMA.calculate({ values: closes, period: 50 }),
      macd: MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }),
      volume: this.analyzeVolume(volumes),
      direction: this.calculateDirection(closes, highs, lows),
      atrPercent: (atr[atr.length - 1] / closes[closes.length - 1]) * 100
    };
  }
}
```

### 4.4 Scoring Service (`backend/src/modules/scoring/service.ts`)

**Responsabilidad:** Evaluar oportunidades de entrada.

```typescript
class ScoringService {
  evaluate(indicators: IndicatorData, state: BotState): ScoringResult {
    let score = 0;
    const reasons: string[] = [];

    // RSI signals
    if (indicators.rsi < 30) { score += 1; reasons.push('RSI_OVERSOLD'); }
    else if (indicators.rsi < 40) { score += 1; reasons.push('RSI_LOW'); }

    // FVG signal
    if (indicators.fvgBullish) { score += 1; reasons.push('FVG_BULLISH'); }

    // ADX direction
    if (indicators.adx > 25 && indicators.direction === 'BULLISH') {
      score += 1; reasons.push('ADX_BULLISH');
    }

    // Momentum
    if (indicators.ema20 > indicators.ema50) {
      score += 1; reasons.push('MOMENTUM_BULL');
    }

    // Downtrend penalty
    if (state.streak_losses >= 2) {
      score -= 1; reasons.push('DOWNTREND_PENALTY');
    }

    return {
      score: Math.max(0, score),
      threshold: state.entry_threshold || 2,
      reasons,
      ready: score >= (state.entry_threshold || 2)
    };
  }
}
```

### 4.5 Risk Service (`backend/src/modules/risk/service.ts`)

**Responsabilidad:** Gestión de riesgo y salidas.

```typescript
class RiskService {
  calculate(state: BotState, indicators: IndicatorData, balance: number): RiskData {
    if (state.status !== 'COMPRADO') {
      return { action: 'WAIT', reason: 'No position' };
    }

    const entryPrice = state.entry_price;
    const currentPrice = indicators.currentPrice;
    const pnl = ((currentPrice - entryPrice) / entryPrice) * 100;

    // Trailing stop: piso sube con precio
    const trailPercent = 0.05; // 5%
    let piso = state.piso_actual;
    if (currentPrice > entryPrice) {
      const newPiso = currentPrice * (1 - trailPercent);
      if (newPiso > piso) piso = newPiso;
    }

    // Hard stop: ATR-based
    const atr = indicators.atr[indicators.atr.length - 1];
    const hardStop = entryPrice - (atr * 1.5);

    // Take profit: dynamic based on volatility
    const tp = state.tp_target || 1.0;

    // Time exit
    const hoursHeld = (Date.now() - new Date(state.entry_time).getTime()) / (1000 * 60 * 60);
    const maxHours = state.max_hours || 8;

    // Break-even
    const beActive = state.break_even_active;
    const beThreshold = 0.3; // 0.3% to activate BE

    // Evaluate exits (priority order)
    if (currentPrice <= hardStop) {
      return { action: 'SELL', reason: 'HARD_STOP', pnl };
    }
    if (currentPrice <= piso) {
      return { action: 'SELL', reason: 'TRAILING_STOP', pnl };
    }
    if (pnl >= tp) {
      return { action: 'SELL', reason: 'TAKE_PROFIT', pnl };
    }
    if (hoursHeld >= maxHours) {
      return { action: 'SELL', reason: 'TIME_EXIT', pnl };
    }
    if (beActive && pnl < 0.1) {
      return { action: 'SELL', reason: 'BREAK_EVEN', pnl };
    }
    if (indicators.momentum === 'BEARISH' && pnl > 0.3) {
      return { action: 'SELL', reason: 'MOMENTUM_BEAR', pnl };
    }

    return { action: 'HOLD', reason: 'No exit conditions met', pnl, piso };
  }
}
```

---

## 5. BASE DE DATOS

### 5.1 Schema

```sql
-- Estado de cada moneda
CREATE TABLE bot_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coin TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'LÍQUIDO' CHECK(status IN ('LÍQUIDO', 'COMPRADO')),
  entry_price REAL DEFAULT 0,
  entry_time TEXT,
  tp_target REAL DEFAULT 1.0,
  piso_actual REAL DEFAULT 0,
  break_even_active INTEGER DEFAULT 0,
  max_hours REAL DEFAULT 8,
  streak_losses INTEGER DEFAULT 0,
  monto_entrada REAL DEFAULT 0,
  entry_threshold INTEGER DEFAULT 2,
  last_sell_time TEXT,
  last_sell_reason TEXT,
  last_sell_price REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Historial de trades
CREATE TABLE trade_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coin TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('COMPRAR', 'VENDER')),
  price REAL NOT NULL,
  quantity REAL NOT NULL,
  monto REAL NOT NULL,
  pnl_pct REAL,
  pnl_usd REAL,
  motivo TEXT,
  score INTEGER,
  indicators TEXT, -- JSON snapshot
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Log de ejecuciones
CREATE TABLE execution_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coin TEXT NOT NULL,
  status TEXT NOT NULL,
  decision TEXT,
  motivo TEXT,
  score INTEGER,
  rsi REAL,
  adx REAL,
  price REAL,
  balance REAL,
  error TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Usuarios (multi-user)
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  plan TEXT DEFAULT 'free' CHECK(plan IN ('free', 'pro', 'enterprise')),
  binance_api_key TEXT,
  binance_api_secret TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Configuración por usuario
CREATE TABLE user_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  coin TEXT NOT NULL,
  risk_pct REAL,
  entry_threshold INTEGER,
  tp_target REAL,
  max_hours REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 5.2 Índices

```sql
CREATE INDEX idx_bot_state_coin ON bot_state(coin);
CREATE INDEX idx_trade_log_coin ON trade_log(coin);
CREATE INDEX idx_trade_log_created ON trade_log(created_at);
CREATE INDEX idx_execution_log_coin ON execution_log(coin);
CREATE INDEX idx_execution_log_created ON execution_log(created_at);
CREATE INDEX idx_users_email ON users(email);
```

---

## 6. API REST

### 6.1 Endpoints

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|:----:|
| GET | `/api/health` | Health check | ❌ |
| POST | `/api/auth/register` | Registrar usuario | ❌ |
| POST | `/api/auth/login` | Login | ❌ |
| GET | `/api/auth/me` | Usuario actual | ✅ |
| GET | `/api/portfolio` | Todas las monedas | ✅ |
| GET | `/api/portfolio/:coin` | Estado de una moneda | ✅ |
| GET | `/api/balance` | Balance USDT | ✅ |
| GET | `/api/trades` | Historial de trades | ✅ |
| GET | `/api/trades/:coin` | Trades de una moneda | ✅ |
| GET | `/api/executions` | Log de ejecuciones | ✅ |
| POST | `/api/config/:coin` | Actualizar config | ✅ |
| POST | `/api/execute/:coin` | Forzar ejecución | ✅ |
| GET | `/api/status` | Estado del bot | ✅ |
| POST | `/api/start` | Iniciar bot | ✅ |
| POST | `/api/stop` | Detener bot | ✅ |

### 6.2 Ejemplo de Request/Response

```http
GET /api/portfolio
Authorization: Bearer <jwt_token>

Response:
{
  "balance": 853.55,
  "coins": [
    {
      "symbol": "AVAX",
      "status": "COMPRADO",
      "price": 7.22,
      "entry_price": 6.95,
      "pnl_pct": 3.88,
      "score": 2,
      "threshold": 2,
      "rsi": 41.2,
      "adx": 40.3
    },
    {
      "symbol": "BTC",
      "status": "LÍQUIDO",
      "price": 78064,
      "entry_price": 0,
      "pnl_pct": 0,
      "score": 0,
      "threshold": 2,
      "rsi": 45.1,
      "adx": 33.5
    }
  ],
  "lastUpdate": "2026-08-26T18:30:00Z"
}
```

---

## 7. MOBILE APP

### 7.1 Stack
- **Framework:** React Native + Expo
- **Navigation:** React Navigation 6
- **State:** Zustand
- **UI:** React Native Paper (Material Design)
- **Charts:** react-native-chart-kit
- **HTTP:** axios
- **WebSocket:** socket.io-client

### 7.2 Screens

```
App
├── Auth Stack
│   ├── LoginScreen
│   ├── RegisterScreen
│   └── ForgotPasswordScreen
│
├── Main Tab Navigator
│   ├── Dashboard Tab
│   │   ├── DashboardScreen (portfolio grid)
│   │   └── CoinDetailScreen (single coin)
│   │
│   ├── History Tab
│   │   ├── TradeHistoryScreen
│   │   └── TradeDetailScreen
│   │
│   ├── Settings Tab
│   │   ├── SettingsScreen
│   │   ├── NotificationSettings
│   │   └── AccountSettings
│   │
│   └── Alerts Tab
│       └── NotificationsScreen
```

### 7.3 Componentes Principales

```typescript
// CoinCard - Card de moneda en dashboard
interface CoinCardProps {
  coin: CoinSymbol;
  status: 'COMPRADO' | 'LÍQUIDO';
  price: number;
  entryPrice: number;
  pnl: number;
  score: number;
  onPress: () => void;
}

// ScoreGauge - Gauge circular de score
interface ScoreGaugeProps {
  score: number;
  threshold: number;
  size?: number;
}

// PriceChart - Gráfico de precio
interface PriceChartProps {
  data: number[];
  entryPrice?: number;
  piso?: number;
  tp?: number;
  period: '1h' | '4h' | '1d';
}
```

---

## 8. DEPLOYMENT

### 8.1 Docker

```dockerfile
# backend/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - BINANCE_API_KEY=${BINANCE_API_KEY}
      - BINANCE_API_SECRET=${BINANCE_API_SECRET}
      - JWT_SECRET=${JWT_SECRET}
      - DB_PATH=/app/data/el-oraculo.db
    volumes:
      - ./data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/nginx/certs
    depends_on:
      - backend
    restart: unless-stopped
```

### 8.2 CI/CD (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Railway
        run: railway up
```

---

## 9. SEGURIDAD

### 9.1 Autenticación
- JWT tokens (15min expiry)
- Refresh tokens (7 days)
- Password hashing (bcrypt, 12 rounds)
- API key encryption (AES-256)

### 9.2 Rate Limiting
```typescript
// 100 requests per minute per user
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.user?.id || req.ip
});
```

### 9.3 Input Validation
```typescript
// Zod schemas for all inputs
const BuySchema = z.object({
  coin: z.enum(['BTC', 'ETH', 'SOL', 'BNB', 'LINK', 'NEAR', 'AVAX', 'POL', 'SUI', 'DOGE']),
  amount: z.number().positive().max(10000)
});
```

---

## 10. MONITOREO

### 10.1 Logging
```typescript
// Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

### 10.2 Metrics
```typescript
// Prometheus metrics
const metrics = {
  tradesTotal: new Counter({ name: 'trades_total', help: 'Total trades', labelNames: ['coin', 'action'] }),
  tradePnL: new Histogram({ name: 'trade_pnl_pct', help: 'Trade PnL %', labelNames: ['coin'] }),
  executionDuration: new Histogram({ name: 'execution_duration_ms', help: 'Execution time', labelNames: ['coin'] }),
  activePositions: new Gauge({ name: 'active_positions', help: 'Active positions count' })
};
```

---

## 11. DECISIONES TÉCNICAS

| Decisión | Opción Elegida | Alternativas | Por qué |
|----------|---------------|--------------|---------|
| Runtime | Node.js 20 | Deno, Bun | Estable, mismo que n8n, gran ecosistema |
| Framework | Express | Fastify, Hono | Más simple, más docs, más libs |
| Database | SQLite | PostgreSQL, MongoDB | Simple, zero-config, suficiente para single-user inicial |
| ORM | Drizzle | Prisma, TypeORM | Más ligero, mejor TypeScript, más control |
| Mobile | React Native + Expo | Flutter, Swift/Kotlin | Cross-platform, mismo lenguaje que backend |
| State | Zustand | Redux, MobX | Simple, sin boilerplate, suficiente |
| Auth | JWT | Sessions, OAuth | Stateless, simple, mobile-friendly |
| Billing | Stripe | Paddle, LemonSqueezy | Industry standard, mejor docs |

---

## 12. MÉTRICAS DE ÉXITO

### Performance
- < 100ms response time (API)
- < 5s execution time (per coin)
- 99.9% uptime
- 0 data loss

### Code Quality
- 80%+ test coverage
- 0 critical bugs in production
- < 24h response to issues

### Business
- 100+ users in first month
- $1000+ MRR in first quarter
- 4.5+ star rating on app stores
