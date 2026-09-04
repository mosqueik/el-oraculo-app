# PROJECT STATE — El Oráculo App

> **Last Session:** 92 (Sep 4, 2026)
> **Phase:** 1 ✅ | 2 ✅ | 3 ✅ | 4 🟡 In Progress (~85%)
> **Directory:** `el-oraculo-app/`
> **Backend URL:** http://<ORACLE_CLOUD_IP>:3001 (pending deployment)
> **Hosting:** Oracle Cloud Always Free (free forever, no credit card charges)

---

## 📋 INSTRUCCIONES PARA NUEVAS SESIONES

**Al inicio de cada sesión, decime:**
> "Lee memory/PROJECT_STATE.md y continuá desde donde quedamos."

**Si trabajás en el bot de n8n**, usá la memoria del bot:
> `obsidian_vault/Memory/SESSION_LOG.md`

**Si trabajás en la app**, usá ESTA memoria:
> `el-oraculo-app/memory/PROJECT_STATE.md`

---

## 1. ESTADO ACTUAL

### Fase 1: Foundation ✅ COMPLETADA
- [x] Mono-repo structure (24 archivos, 3,693 líneas)
- [x] Shared types (15+ TypeScript types)
- [x] Shared constants (14 coin configs)
- [x] Backend: Exchange, Indicators, Scoring, Risk, Trading Engine
- [x] Mobile: App skeleton, DashboardScreen, API client
- [x] Documentation: MIGRATION_PLAN, TODO, ARCHITECTURE, N8N_MIGRATION_SPEC

### Fase 2: Database + API ✅ COMPLETADA
- [x] SQLite database setup (better-sqlite3 v11.9.1 + Drizzle)
- [x] Database schema (5 tables: bot_state, trade_log, execution_log, users, user_config)
- [x] Repository pattern (BotState, TradeLog, Execution, User)
- [x] REST API endpoints (health, portfolio, trades, executions)
- [x] Authentication (JWT + bcrypt)
- [x] WebSocket (socket.io)
- [x] TypeScript errors fixed (exchange, indicators, trading engine)
- [x] Trading engine integrated with all repositories
- [x] Tests: 275 tests passing

### Fase 3: Backend Completo ✅ COMPLETADA
- [x] All missing indicators: MACD, StochasticRSI, OBV, VWAP, FVG, Choch, Squeeze
- [x] Extended IndicatorData (FullIndicatorData) with 30+ fields
- [x] Refactored trading engine (12-node pipeline: INDICATORS → MARKET_REGIME → STATUS → SCORING → RISK → DECISION → FILTER → OUTPUT → EXECUTE → LOG)
- [x] Notification service (Telegram integration)
- [x] Post-trade learning module (analyze trades, detect patterns, generate insights)
- [x] Fixed database init (raw SQLite for DDL instead of Drizzle sql template)
- [x] Drizzle migrations (drizzle.config.ts + 0000_init.sql)
- [x] Auth middleware tests (16 tests)
- [x] WebSocket server tests (15 tests)
- [x] Tests: 82 tests passing (51 old + 31 new)
- [x] SM Indicators (15m, 1h, 4h per-coin) — Order Blocks, Liquidity Zones, BOS, Volume Profile, Fib, Premium/Discount
- [x] Multi-Timeframe Analysis (15m/1h/4h) — HTF Bias, Confluence Score, Alignment detection
- [x] FullIndicatorData moved to shared types (reusable across backend)
- [x] Tests: 89 tests passing (82 old + 7 new SM tests)
- [x] Zod validation schemas for all API routes (16 schemas, 42 tests)
- [x] Validation middleware (validateBody, validateParams, validateQuery, validateRequest)
- [x] Routes updated with Zod validation (portfolio, trades, executions)
- [x] Tests: 131 tests passing (89 old + 42 validation tests)
- [x] E2E Trading Pipeline Tests (22 tests) — Full pipeline: Indicators → Scoring → Risk → Decision
- [x] Tests: 153 tests passing (131 old + 22 E2E pipeline tests)
- [x] **CRITICAL FIX:** Verified all logic matches n8n spec exactly
- [x] Fixed scoring: momentum (EMA+MACD), downtrend penalty (streak_losses)
- [x] Fixed risk: hard stop now price-based (not percentage)
- [x] Fixed decision: exit conditions compare prices (not percentages)
- [x] Fixed trailing stop: now compares currentPrice vs v_piso (not r vs v_piso)
- [x] Added CALM regime to market regime detection
- [x] Backtest runner (full pipeline replay + SM signal validation)
- [x] Telegram notifications (env vars, trade alerts, daily reports, test connection)
- [x] Rate limiting middleware (per-user, trading, expensive ops, login burst, IP blocklist)
- [x] Persistent rate limiting with SQLite store (survives restarts, auto-cleanup)
- [x] WebSocket rate limiting (connection limits, subscription spam, event flood, room caps)
- [x] EAS build config (app.json + eas.json — ready for APK/AAB builds)
- [x] Load testing (concurrent coins, API benchmarks, memory stress)
- [x] Trade Logger (DB-based, replaces Google Sheets)
- [x] Web Dashboard (real-time monitoring, WebSocket, responsive)
- [x] Walk-Forward Optimization (parameter optimization, Monte Carlo, stability analysis)
- [x] Portfolio Risk Management (exposure limits, correlation, sector limits, circuit breaker)
- [x] Database Indexes (35+ indexes for performance on all queried tables)
- [x] Prometheus Metrics (system, database, trading, counters, histograms)
- [x] Swagger/OpenAPI Documentation (auto-generated from JSDoc comments)
- [x] Admin Dashboard (user management, revenue tracking, system health)

### Fase 4: Mobile App 🟡 IN PROGRESS
- [x] 13 screens (Dashboard, CoinDetail, TradeDetail, Analytics, Login, Register, etc.)
- [x] 12 components (CoinCard, PriceChart, PnLBadge, etc.)
- [x] 8 hooks (useAuth, useBiometric, useWebSocket, etc.)
- [x] API client (30+ methods)
- [x] i18n (EN/ES, 150+ translations)
- [x] WebSocket real-time updates
- [x] Offline support (AsyncStorage cache)
- [x] Biometric authentication (Face ID / Fingerprint)
- [x] EAS build config (app.json + eas.json)
- [x] **Shared types inlined** (eliminated @el-oraculo/shared workspace dependency)
- [x] **Valid PNG assets created** (icon, adaptive-icon, splash, notification-icon)
- [x] **metro.config.js** for monorepo support
- [x] **EAS build submitted** (Build ID: 9fc7bb2b-898b-40ca-87ec-a59c234bdc5b)
- [ ] Wait for build result → download APK → install on phone
- [ ] Test mobile app connectivity to backend

### Fase 5: Production 🟡 IN PROGRESS
- [x] Docker (Dockerfile + docker-compose.yml)
- [x] CI/CD (GitHub Actions)
- [x] Rate limiting (7 layers: API, auth, trading, expensive, login, WebSocket, IP blocklist)
- [x] Persistent rate limiting (SQLite store)
- [x] WebSocket rate limiting (connection, subscription, event flood, room caps)
- [x] Database indexes (35+ performance indexes)
- [x] Prometheus metrics (/api/metrics)
- [x] Swagger/OpenAPI docs (/api-docs)
- [x] Admin dashboard (/admin)
- [x] Fly.io CLI installed (`~/.fly/bin/flyctl`)
- [x] **Deployed to Fly.io** (destroyed — not free)
- [x] **Oracle Cloud deployment guide** (`docs/ORACLE_CLOUD_DEPLOY.md`)
- [ ] **Create Oracle Cloud account** (needs credit card for verification)
- [ ] **Deploy to Oracle Cloud** (Docker compose on ARM VM)
- [ ] **Set env vars** (BINANCE_API_KEY, JWT_SECRET, TELEGRAM_BOT_TOKEN, etc.)
- [ ] Sentry error tracking
- [ ] Audit logging
- [ ] API key rotation

---

## 2. ARCHITECTURA

```
el-oraculo-app/
├── shared/           # TypeScript types + constants
├── backend/          # Node.js trading engine
├── mobile/           # React Native app
├── memory/           # ✅ ESTA MEMORIA
├── docs/             # Documentation
└── scripts/          # Deployment
```

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| Mobile | React Native + Expo |
| Database | SQLite → PostgreSQL |
| ORM | Drizzle |
| State | Zustand |
| Auth | JWT + bcrypt |
| Billing | Stripe |

---

## 3. DOCUMENTACIÓN

| Archivo | Contenido |
|---------|-----------|
| `docs/MIGRATION_PLAN.md` | 6 fases, 12 semanas, ~300h |
| `docs/TODO.md` | 100+ tareas de implementación |
| `docs/ARCHITECTURE.md` | Arquitectura técnica completa |
| `docs/N8N_MIGRATION_SPEC.md` | Mapeo nodo n8n → Node.js |
| `memory/PROJECT_STATE.md` | Este archivo (estado actual) |
| `memory/SESSION_LOG.md` | Historial de sesiones |
| `memory/LEARNING_LOG.md` | Aprendizajes |
| `memory/KNOWLEDGE_*.md` | Conocimiento del proyecto |

---

## 4. PRÓXIMOS PASOS

### Fase 2 — Database + API
- [x] Instalar dependencias
- [x] Crear schema
- [x] Crear repositorios
- [x] Crear routes
- [x] Crear middleware

### Fase 3 — Próximos pasos
1. ~~SM Indicators (15m, 1h, 4h per-coin)~~ ✅
2. ~~Telegram notifications (env vars)~~ ✅
3. ~~Backtest runner~~ ✅
4. ~~EAS build config~~ ✅
5. ~~Load testing~~ ✅
6. ~~Database indexes~~ ✅
7. ~~Prometheus metrics~~ ✅
8. ~~Swagger/OpenAPI docs~~ ✅
9. ~~Admin dashboard~~ ✅

### Fase 5 — Production
1. ✅ Fix EAS build (shared types inlined, assets created, build submitted)
2. 🟡 Deploy backend to Oracle Cloud Always Free (free forever, guide created)
3. ❌ Sentry error tracking
4. ❌ Audit logging
5. ❌ API key rotation

### Fase 6 — Remaining
1. ❌ User guide / FAQ
2. ❌ Landing page
3. ❌ Play Store listing
4. ❌ Offline support (AsyncStorage cache)
5. ❌ Biometric auth screen integration

---

## 5. DECISIONES TÉCNICAS

| Decisión | Opción | Alternativa | Por qué |
|----------|--------|-------------|---------|
| Runtime | Node.js 20 | Deno, Bun | Estable, mismo que n8n |
| Framework | Express | Fastify | Simple, más docs |
| Database | SQLite | PostgreSQL | Simple, zero-config |
| ORM | Drizzle | Prisma | Más ligero, type-safe |
| Mobile | React Native | Flutter | Mismo lenguaje que backend |
| State | Zustand | Redux | Simple, sin boilerplate |

---

*Última actualización: Session 91 — September 2, 2026*

---

## 6. SISTEMAS IMPLEMENTADOS

### Trading Engine (12-Node Pipeline)
```
INDICATORS → MARKET_REGIME → STATUS → SCORING → RISK → DECISION → FILTER → OUTPUT → EXECUTE → LOG
```

### Risk Management Stack
```
Per-Coin Risk (hard stop, trailing, TP)
  → Portfolio Risk (exposure, correlation, sectors)
  → Circuit Breaker (drawdown protection)
  → Rate Limiting (API, WebSocket, trading)
```

### Backtesting & Optimization
```
Backtest Runner (full pipeline replay)
  → Walk-Forward Optimization (IS → OOS)
  → Monte Carlo Simulation (robustness)
  → SM Signal Validation (OB, BOS, FVG accuracy)
```

### Monitoring & Logging
```
Web Dashboard (real-time WebSocket)
  → Trade Logger (decision snapshots)
  → Analytics API (performance, streaks, daily)
  → Telegram Notifications (trade alerts)
  → Prometheus Metrics (/api/metrics)
  → Swagger Docs (/api-docs)
  → Admin Dashboard (/admin)
```

---

## 7. API ENDPOINTS (100+)

### Core Trading
- `GET /api/status` — Bot status
- `POST /api/start` / `POST /api/stop` — Bot control
- `GET /api/portfolio` — Portfolio overview
- `POST /api/trading/manual-buy/:coin` — Manual buy
- `POST /api/trading/manual-sell/:coin` — Manual sell
- `POST /api/trading/emergency-sell/:coin` — Emergency sell

### Risk Management
- `GET /api/risk/portfolio` — Portfolio risk state
- `GET /api/risk/config` — Risk configuration
- `PUT /api/risk/config` — Update risk config
- `GET /api/risk/correlation` — Correlation matrix
- `POST /api/risk/check` — Pre-trade risk check
- `POST /api/risk/reset-circuit-breaker` — Reset breaker

### Backtesting
- `POST /api/backtest/run` — Full backtest
- `POST /api/backtest/validate-signals` — SM validation
- `POST /api/backtest/export` — CSV export
- `POST /api/walkforward/optimize` — Walk-forward optimization
- `POST /api/walkforward/quick` — Quick optimization

### Analytics
- `GET /api/analytics/dashboard` — Dashboard summary
- `GET /api/analytics/performance` — Per-coin performance
- `GET /api/analytics/streaks` — Win/loss streaks
- `GET /api/analytics/daily` — Daily summaries
- `GET /api/analytics/export/json` — JSON export
- `GET /api/analytics/export/csv` — CSV export

### Monitoring
- `GET /dashboard` — Web dashboard
- `GET /admin` — Admin dashboard
- `GET /api/dashboard/overview` — All dashboard data
- `GET /api/monitoring/health` — System health
- `GET /api/monitoring/stats` — System stats
- `GET /api/metrics` — Prometheus metrics (text format)
- `GET /api/metrics/json` — Metrics (JSON format)
- `GET /api/metrics/system` — System metrics
- `GET /api/metrics/database` — Database metrics
- `GET /api/metrics/trading` — Trading metrics

### Admin
- `GET /api/admin/dashboard` — Admin overview (users, revenue, trading)
- `GET /api/admin/users` — List users with pagination
- `GET /api/admin/users/:id` — User details
- `PUT /api/admin/users/:id/plan` — Update user plan
- `DELETE /api/admin/users/:id` — Delete user (anonymize)
- `GET /api/admin/revenue` — Revenue analytics
- `GET /api/admin/system` — System health
- `GET /api/admin/trades` — Trade analytics

### Documentation
- `GET /api-docs` — Swagger UI
- `GET /api-docs.json` — OpenAPI spec (JSON)

---

## 8. MOBILE APP (13 Screens)

| Screen | Description |
|--------|-------------|
| DashboardScreen | Main dashboard with live PnL |
| CoinDetailScreen | Coin detail with charts |
| TradeDetailScreen | Trade detail + AI analysis |
| AnalyticsScreen | Performance metrics |
| LoginScreen | Email/password login |
| RegisterScreen | User registration |
| SubscriptionScreen | Plan selection |
| CustomIndicatorScreen | Indicator builder |
| BacktestScreen | Backtesting |
| AlertSettingsScreen | Alert configuration |
| TradeHistoryScreen | Trade history + export |
| SettingsScreen | App settings |

---

## 9. DATABASE TABLES (14)

| Table | Purpose |
|-------|---------|
| bot_state | Current state per coin |
| trade_log | All trades |
| execution_log | Execution attempts |
| users | User accounts |
| user_config | Per-user settings |
| push_tokens | Mobile push tokens |
| notification_log | Notification history |
| subscriptions | Stripe subscriptions |
| invoices | Stripe invoices |
| custom_indicators | User indicators |
| indicator_usage | Indicator weights |
| alert_config | Alert thresholds |
| alert_history | Triggered alerts |
| decision_snapshot | Full pipeline state |
| daily_summary | Daily performance |
| rate_limits | Rate limit counters |

---

## 10. ENV VARS

```env
# Exchange
BINANCE_API_KEY=xxx
BINANCE_API_SECRET=xxx

# Auth
JWT_SECRET=xxx

# Telegram
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_CHAT_ID=xxx
TELEGRAM_THREAD_ID=xxx
TELEGRAM_SILENT=true

# AI
OPENROUTER_API_KEY=xxx

# Stripe
STRIPE_SECRET_KEY=xxx
STRIPE_WEBHOOK_SECRET=xxx

# Database
DB_PATH=./data/oraculo.db

# Server
PORT=3001
NODE_ENV=production
CORS_ORIGIN=*
```

---

## 11. DEPLOYMENT

### Backend (Fly.io)
```bash
fly secrets set BINANCE_API_KEY=xxx JWT_SECRET=xxx TELEGRAM_BOT_TOKEN=xxx --app el-oraculo-backend
fly deploy --app el-oraculo-backend
```

### Mobile (EAS Build)
```bash
cd mobile
npx eas build --platform android --profile preview  # APK
npx eas build --platform android --profile production  # AAB for Play Store
```

### Dashboard
```
http://localhost:3001/dashboard  # Local
https://el-oraculo-backend.fly.dev/dashboard  # Production
```

---

## 12. SESSION 92 — WHAT WAS DONE

### EAS Build Fix
- Created valid PNG assets (icon 1024x1024, adaptive-icon, splash 1284x2778, notification-icon 96x96) using Python Pillow
- Created `mobile/tsconfig.json` (Expo base config)
- Created `mobile/metro.config.js` (monorepo watchFolders + nodeModulesPaths)
- Created `mobile/src/types/trading.ts` — local copy of shared types
- Created `mobile/src/constants/config.ts` — local copy of shared constants
- Created `mobile/src/shared.ts` — barrel export
- Updated 10 files to import from `'../shared'` instead of `'@el-oraculo/shared'`
- Removed `@el-oraculo/shared` dependency from mobile/package.json
- EAS build submitted successfully (Build ID: 9fc7bb2b)
- Build URL: https://expo.dev/accounts/mosqueik/projects/el-oraculo/builds/9fc7bb2b-898b-40ca-87ec-a59c234bdc5b

### Backend Deployment
- Installed Fly.io CLI (`flyctl v0.4.99`)
- **BLOCKED:** `fly auth login` requires interactive terminal + API token
- **NEXT SESSION:** Login with `fly auth login` or set `FLY_API_TOKEN` env var

### Key Files Created/Modified (Session 92)
| File | Change |
|------|--------|
| `mobile/assets/icon.png` | New — 1024x1024 PNG |
| `mobile/assets/adaptive-icon.png` | New — 1024x1024 PNG |
| `mobile/assets/splash.png` | New — 1284x2778 PNG |
| `mobile/assets/notification-icon.png` | New — 96x96 PNG |
| `mobile/tsconfig.json` | New — TypeScript config |
| `mobile/metro.config.js` | New — Monorepo Metro config |
| `mobile/src/types/trading.ts` | New — Local copy of shared types |
| `mobile/src/constants/config.ts` | New — Local copy of shared constants |
| `mobile/src/shared.ts` | New — Barrel export |
| `mobile/package.json` | Removed @el-oraculo/shared dependency |
| 10 mobile files | Updated imports from @el-oraculo/shared to ../shared |
| `mobile/eas.json` | Updated API URL to fly.dev |
| `fly.toml` | New — Fly.io deployment config |
| `backend/Dockerfile` | Updated: Node 22, Python build tools, shared build |
| `backend/drizzle/0001_add_alerts.sql` | Fixed: removed comments, added breakpoints |
| `backend/src/database/migrate.ts` | Fixed: graceful error handling for existing tables |

---

*Última actualización: Session 92 — September 4, 2026*
