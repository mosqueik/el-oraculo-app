# 📋 TODO — El Oráculo App
> Checklist detallado de implementación. Marcar con [x] al completar.

---

## 🔴 FASE 2: Database + API (Semana 3-4)

### 2.1 SQLite Database
- [ ] Install dependencies: `better-sqlite3`, `drizzle-orm`, `drizzle-kit`
- [ ] Create database schema (`backend/src/database/schema.ts`)
  - [ ] Table: `bot_state` (coin, status, entry_price, tp, piso, streak, monto, timestamps)
  - [ ] Table: `trade_log` (coin, action, price, qty, monto, pnl, motivo, timestamp)
  - [ ] Table: `execution_log` (coin, status, decision, score, rsi, adx, error)
  - [ ] Table: `users` (email, password_hash, plan, api_keys)
  - [ ] Table: `user_config` (user_id, coin, custom_settings)
- [ ] Create database initialization script (`backend/src/database/init.ts`)
- [ ] Create migration system (`backend/src/database/migrations/`)
- [ ] Create database connection singleton (`backend/src/database/connection.ts`)
- [ ] Write tests for database operations

### 2.2 Repository Pattern
- [ ] Create `BotStateRepository` (CRUD for bot_state)
- [ ] Create `TradeLogRepository` (CRUD + queries for trade_log)
- [ ] Create `ExecutionRepository` (CRUD + queries for execution_log)
- [ ] Create `UserRepository` (CRUD for users)
- [ ] Write tests for all repositories

### 2.3 REST API Endpoints
- [ ] Install dependencies: `express`, `cors`, `helmet`, `express-rate-limit`
- [ ] Create Express app setup (`backend/src/app.ts`)
- [ ] Create route structure:
  - [ ] `GET /api/health` — Health check
  - [ ] `GET /api/portfolio` — All coin states
  - [ ] `GET /api/portfolio/:coin` — Single coin state
  - [ ] `GET /api/balance` — USDT balance
  - [ ] `GET /api/trades` — Trade history
  - [ ] `GET /api/trades/:coin` — Trades per coin
  - [ ] `GET /api/executions` — Execution log
  - [ ] `POST /api/config/:coin` — Update coin config
  - [ ] `POST /api/execute/:coin` — Force execution
  - [ ] `GET /api/status` — Bot status (running/stopped)
  - [ ] `POST /api/start` — Start bot
  - [ ] `POST /api/stop` — Stop bot
- [ ] Add request validation with Zod
- [ ] Add error handling middleware
- [ ] Add request logging middleware
- [ ] Write API tests

### 2.4 Authentication
- [ ] Install dependencies: `jsonwebtoken`, `bcryptjs`
- [ ] Create auth middleware (`backend/src/middleware/auth.ts`)
- [ ] Create auth routes:
  - [ ] `POST /api/auth/register` — Register new user
  - [ ] `POST /api/auth/login` — Login
  - [ ] `GET /api/auth/me` — Current user
  - [ ] `POST /api/auth/refresh` — Refresh token
- [ ] Add JWT secret management
- [ ] Write auth tests

### 2.5 WebSocket (Real-time)
- [ ] Install dependencies: `socket.io`
- [ ] Create WebSocket server (`backend/src/ws/server.ts`)
- [ ] Create event types:
  - [ ] `trade:executed` — New trade
  - [ ] `price:update` — Price update
  - [ ] `score:update` — Score change
  - [ ] `status:update` — Bot status change
- [ ] Integrate with trading engine
- [ ] Write WebSocket tests

---

## 🟡 FASE 3: Backend Completo (Semana 5-6)

### 3.1 Migrar Pipeline Completo
- [ ] Migrate CONFIG node → `shared/constants/config.ts` ✅
- [ ] Migrate PARSE & MERGE → `trading/engine.ts`
- [ ] Migrate STATUS → `trading/engine.ts`
- [ ] Migrate MARKET REGIME → `indicators/service.ts`
- [ ] Migrate INDICATORS (5 L1 + 6 L2 + 4 L3) → `indicators/service.ts` ✅
- [ ] Migrate RISK → `risk/service.ts` ✅
- [ ] Migrate SCORING → `scoring/service.ts` ✅
- [ ] Migrate DECISION → `trading/engine.ts` ✅
- [ ] Migrate EXIT → `trading/engine.ts`
- [ ] Migrate OUTPUT → `trading/engine.ts`
- [ ] Migrate FILTER → `trading/engine.ts`
- [ ] Migrate LOG → `logger/service.ts`

### 3.2 Indicadores Faltantes
- [ ] MACD (histogram, signal, macd)
- [ ] Stochastic RSI (k, d)
- [ ] OBV (On Balance Volume)
- [ ] VWAP
- [ ] FVG detection (SMC)
- [ ] Choch (Change of Character)
- [ ] Squeeze detection

### 3.3 Sub-Sistemas
- [ ] SM Indicators 15m (per-coin)
- [ ] 1h Indicator
- [ ] 4h Indicator
- [ ] Trade Logger (DB-based, not Google Sheets)
- [ ] Telegram notifications
- [ ] Post-Trade Learning
- [ ] Obsidian memory integration

### 3.4 Testing
- [ ] Unit tests for all services
- [ ] Integration tests for trading pipeline
- [ ] Backtest runner (compare with n8n results)
- [ ] Load testing (multiple coins concurrent)

---

## 🔵 FASE 4: Mobile App (Semana 7-8)

### 4.1 Project Setup
- [ ] Initialize Expo project
- [ ] Setup React Navigation
- [ ] Setup Zustand store
- [ ] Setup API client with auth
- [ ] Configure dark mode (default)

### 4.2 Screens
- [ ] **Dashboard** — Portfolio overview, balance, coin statuses
  - [ ] Balance card (USDT total)
  - [ ] Coin cards grid (status, price, PnL)
  - [ ] Quick actions (start/stop bot)
- [ ] **Coin Detail** — Single coin deep dive
  - [ ] Price chart (react-native-chart-kit)
  - [ ] Indicator gauges (RSI, ADX, Score)
  - [ ] Current decision (buy/sell/wait)
  - [ ] Entry/exit info
- [ ] **Trade History** — Past trades
  - [ ] Filterable list (by coin, action, date)
  - [ ] PnL summary per coin
  - [ ] Trade detail modal
- [ ] **Settings** — Configuration
  - [ ] Bot settings (start/stop, risk)
  - [ ] Notification preferences
  - [ ] API key management
  - [ ] Account settings
- [ ] **Notifications** — Alert center
  - [ ] Push notification permissions
  - [ ] Notification history
  - [ ] Alert rules configuration
- [ ] **Login/Auth** — Authentication
  - [ ] Login form
  - [ ] Register form
  - [ ] Forgot password

### 4.3 Components
- [ ] `CoinCard` — Card for dashboard grid
- [ ] `PriceChart` — Line/candle chart
- [ ] `ScoreGauge` — Circular gauge for score
- [ ] `PnLBadge` — Green/red PnL indicator
- [ ] `StatusBadge` — COMPRADO/LÍQUIDO badge
- [ ] `TradeRow` — Row in trade history
- [ ] `AlertBanner` — Top alert banner
- [ ] `LoadingSpinner` — Loading indicator
- [ ] `EmptyState` — Empty list state
- [ ] `ErrorBoundary` — Error handling

### 4.4 Features
- [ ] Real-time updates via WebSocket
- [ ] Push notifications (Expo Notifications)
- [ ] Offline support (AsyncStorage cache)
- [ ] Biometric authentication (Face ID / Fingerprint)
- [ ] Haptic feedback on trades
- [ ] Widget for iOS/Android home screen

### 4.5 Testing
- [ ] Component tests (React Native Testing Library)
- [ ] Screen tests
- [ ] API client tests
- [ ] Store tests

---

## 🟢 FASE 5: Production (Semana 9-10)

### 5.1 Docker
- [ ] Backend Dockerfile
- [ ] docker-compose.yml (backend + nginx)
- [ ] Health check configuration
- [ ] Volume mounts for database
- [ ] Environment variable management

### 5.2 Deployment
- [ ] Choose hosting (Railway / Render / DigitalOcean)
- [ ] Setup domain + SSL
- [ ] Configure nginx reverse proxy
- [ ] Setup CI/CD (GitHub Actions)
- [ ] Configure auto-deploy on push

### 5.3 Monitoring
- [ ] Winston logging setup
- [ ] Sentry error tracking
- [ ] Prometheus metrics endpoint
- [ ] Uptime monitoring (UptimeRobot)
- [ ] Log rotation

### 5.4 Security
- [ ] Rate limiting (100 req/min)
- [ ] Input validation (Zod schemas)
- [ ] SQL injection prevention (parameterized queries)
- [ ] CORS configuration
- [ ] Helmet security headers
- [ ] API key rotation
- [ ] Audit logging

### 5.5 Performance
- [ ] Database indexing
- [ ] Query optimization
- [ ] Connection pooling
- [ ] Response caching (Redis optional)
- [ ] Compression (gzip)

---

## 🟣 FASE 6: Sellable Product (Semana 11-12)

### 6.1 Multi-User
- [ ] User registration flow
- [ ] Per-user API keys (Binance)
- [ ] Per-user bot configuration
- [ ] User isolation (data, bots, trades)

### 6.2 Subscription Billing
- [ ] Stripe integration
- [ ] Subscription plans (Free / Pro / Enterprise)
- [ ] Invoice generation
- [ ] Webhook handling
- [ ] Usage tracking
- [ ] Plan limits enforcement

### 6.3 Admin Dashboard
- [ ] User management
- [ ] Bot performance metrics
- [ ] Revenue tracking
- [ ] Support ticket system
- [ ] System health monitoring

### 6.4 Documentation
- [ ] API documentation (Swagger/OpenAPI)
- [ ] User guide
- [ ] Developer guide
- [ ] Deployment guide
- [ ] FAQ

### 6.5 Marketing
- [ ] Landing page
- [ ] App Store / Play Store listing
- [ ] Social media presence
- [ ] Demo video
- [ ] Case studies

---

## 📊 PRIORIDADES

| Prioridad | Fase | Impacto | Esfuerzo |
|:---------:|------|:-------:|:--------:|
| 🔴 P0 | Database + API | Alto | Medio |
| 🔴 P0 | Backend Pipeline | Alto | Alto |
| 🟡 P1 | Mobile App | Alto | Alto |
| 🟡 P1 | Production Deploy | Medio | Medio |
| 🟢 P2 | Multi-User + Billing | Alto | Alto |
| 🟢 P2 | Admin Dashboard | Medio | Medio |

---

## 📅 TIMELINE

```
Semana 1-2:  ✅ Foundation (estructura, types, services base)
Semana 3-4:  🔴 Database + API (SQLite, REST, Auth, WebSocket)
Semana 5-6:  🔴 Backend completo (pipeline migrado, indicadores, tests)
Semana 7-8:  🟡 Mobile app (screens, components, features)
Semana 9-10: 🟡 Production (Docker, deploy, monitoring, security)
Semana 11-12: 🟢 Sellable (multi-user, billing, admin, docs)
```

---

## 🎯 DEFINITION OF DONE

Una fase está "completada" cuando:
1. ✅ Todo el código está escrito
2. ✅ Tests pasan (80%+ coverage)
3. ✅ Documentación actualizada
4. ✅ Deploy funcional
5. ✅ Revisado por usuario
