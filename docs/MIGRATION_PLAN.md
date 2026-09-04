# 📋 PLAN DE MIGRACIÓN COMPLETO — El Oráculo
> De n8n a una app de producción vendible

---

## 🎯 OBJETIVO FINAL

Transformar el trading bot actual (n8n + cron jobs + scripts dispersos) en una **app profesional** que:
1. Se pueda **vender** como SaaS
2. Funcione en **iOS y Android** (React Native)
3. Tenga un **backend robusto** (Node.js)
4. Sea **escalable** (múltiples usuarios)
5. Sea **mantenible** (código limpio, tests, docs)

---

## 📊 ESTADO ACTUAL (n8n)

### Lo que tenemos
```
n8n Workflow (76 nodos)
├── 12 nodos del pipeline principal (CONFIG → DECISION)
├── 9 per-coin WFs (schedule cada 5 min)
├── 3 sub-WFs (SM Indicators 15m, 1h, 4h)
├── Trade Logger → Google Sheets
├── Telegram notifications
└── Obsidian memory system
```

### Problemas de n8n
| Problema | Impacto |
|----------|---------|
| Congresión (500+ ejecuciones stuck) | Bot no responde |
| Sin base de datos propia | Datos en PostgreSQL + Google Sheets |
| Sin API REST | No se puede conectar mobile app |
| Sin authentication | Cualquiera puede acceder |
| Sin tests | Bugs como risk_pct double-division |
| Sin CI/CD | Deploy manual |
| No es vendible | Es una herramienta, no un producto |

---

## 🏗️ ARQUITECTURA OBJETIVO

```
┌─────────────────────────────────────────────────────────┐
│                    MOBILE APP (React Native)              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │Dashboard │  │ Trades   │  │ Settings │  │ Alerts   │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
│       └──────────────┴──────────────┴──────────────┘      │
│                           │ REST API + WebSocket          │
└───────────────────────────┼──────────────────────────────┘
                            │
┌───────────────────────────┼──────────────────────────────┐
│                    BACKEND (Node.js)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Trading  │  │ Indicat. │  │ Scoring  │  │ Risk     │ │
│  │ Engine   │  │ Service  │  │ Service  │  │ Service  │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
│       └──────────────┴──────────────┴──────────────┘      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Exchange │  │ Database │  │ Scheduler│  │ Notif.   │ │
│  │ Service  │  │ (SQLite) │  │ (Cron)   │  │ Service  │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────┼──────────────────────────────┐
│                    SHARED PACKAGE                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ Types    │  │ Constants│  │ Utils    │               │
│  └──────────┘  └──────────┘  └──────────┘               │
└─────────────────────────────────────────────────────────┘
```

---

## 📅 PLAN DE EJECUCIÓN (Fases)

### FASE 1: Foundation (Semana 1-2) ✅ COMPLETADA
**Objetivo:** Estructura base del mono-repo

| Tarea | Estado | Archivos |
|-------|:------:|----------|
| Crear directorio structure | ✅ | `el-oraculo-app/` |
| Shared types (15+ tipos) | ✅ | `shared/src/types/trading.ts` |
| Shared constants (14 monedas) | ✅ | `shared/src/constants/config.ts` |
| Backend entry point | ✅ | `backend/src/index.ts` |
| Exchange service (Binance) | ✅ | `backend/src/modules/exchange/service.ts` |
| Indicator service | ✅ | `backend/src/modules/indicators/service.ts` |
| Scoring service | ✅ | `backend/src/modules/scoring/service.ts` |
| Risk service (trailing stop) | ✅ | `backend/src/modules/risk/service.ts` |
| Trading engine | ✅ | `backend/src/modules/trading/engine.ts` |
| Scheduler | ✅ | `backend/src/jobs/scheduler.ts` |
| Mobile App skeleton | ✅ | `mobile/App.tsx` |
| Dashboard screen | ✅ | `mobile/src/screens/DashboardScreen.tsx` |
| API service | ✅ | `mobile/src/services/api.ts` |
| PROJECT_STATE.md | ✅ | Documentación completa |
| MIGRATION_PLAN.md | ✅ | Este documento |

---

### FASE 2: Database + API (Semana 3-4)
**Objetivo:** Backend funcional con persistencia

#### 2.1 SQLite Database
```bash
# Tablas necesarias
bot_state          # Estado de cada moneda (COMPRADO/LÍQUIDO)
trade_log          # Historial de trades
execution_log      # Log de ejecuciones
user_config        # Configuración por usuario (multi-user)
```

**Schema:**
```sql
CREATE TABLE bot_state (
  id INTEGER PRIMARY KEY,
  coin TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'LÍQUIDO',
  entry_price REAL DEFAULT 0,
  entry_time TEXT,
  tp_target REAL DEFAULT 1.0,
  piso_actual REAL DEFAULT 0,
  streak_losses INTEGER DEFAULT 0,
  monto_entrada REAL DEFAULT 0,
  last_sell_time TEXT,
  last_sell_reason TEXT,
  last_sell_price REAL DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE trade_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coin TEXT NOT NULL,
  action TEXT NOT NULL,
  price REAL NOT NULL,
  quantity REAL NOT NULL,
  monto REAL NOT NULL,
  pnl_pct REAL,
  motivo TEXT,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE execution_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coin TEXT NOT NULL,
  status TEXT NOT NULL,
  decision TEXT,
  motivo TEXT,
  score INTEGER,
  rsi REAL,
  adx REAL,
  error TEXT,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### 2.2 REST API Endpoints
```
GET  /api/health              → Health check
GET  /api/portfolio           → Estado de todas las monedas
GET  /api/portfolio/:coin     → Estado de una moneda
GET  /api/balance             → Balance USDT
GET  /api/trades              → Historial de trades
GET  /api/trades/:coin        → Trades de una moneda
GET  /api/executions          → Log de ejecuciones
POST /api/config/:coin        → Actualizar config de moneda
POST /api/execute/:coin       → Forzar ejecución manual
GET  /api/status              → Estado del bot (running/stopped)
POST /api/start               → Iniciar bot
POST /api/stop                → Detener bot
```

#### 2.3 Auth (JWT)
```
POST /api/auth/login          → Login
POST /api/auth/register       → Registro
GET  /api/auth/me             → Usuario actual
```

---

### FASE 3: Backend Completo (Semana 5-6)
**Objetivo:** Todo el logic de n8n migrado a Node.js

#### 3.1 Migrar nodos del pipeline

| Nodo n8n | Módulo Node.js | Estado |
|----------|----------------|:------:|
| 1. CONFIG | `shared/constants/config.ts` | ✅ |
| 2. PARSE & MERGE | `trading/engine.ts` | ⬜ |
| 3. STATUS | `trading/engine.ts` | ⬜ |
| 4. MARKET REGIME | `indicators/service.ts` | ⬜ |
| 5. INDICATORS | `indicators/service.ts` | ✅ |
| 6. RISK | `risk/service.ts` | ✅ |
| 7. SCORING | `scoring/service.ts` | ✅ |
| 8. DECISION | `trading/engine.ts` | ✅ |
| 9. EXIT | `trading/engine.ts` | ⬜ |
| 10. OUTPUT | `trading/engine.ts` | ⬜ |
| 11. FILTER | `trading/engine.ts` | ⬜ |
| 12. LOG | `logger/service.ts` | ⬜ |

#### 3.2 Migrar sub-sistemas

| Sistema n8n | Módulo Node.js | Estado |
|-------------|----------------|:------:|
| SM Indicators 15m | `indicators/service.ts` | ⬜ |
| 1h Indicator | `indicators/service.ts` | ⬜ |
| 4h Indicator | `indicators/service.ts` | ⬜ |
| Trade Logger | `logger/service.ts` | ⬜ |
| Google Sheets | `database/service.ts` | ⬜ |
| Telegram alerts | `notifications/service.ts` | ⬜ |
| Post-Trade Learning | `modules/learning/` | ⬜ |

#### 3.3 Indicadores faltantes
```javascript
// Implementar con technicalindicators
- MACD (para histogram)
- Stochastic RSI
- OBV (On Balance Volume)
- VWAP
- FVG detection (SMC)
- Choch (Change of Character)
- Squeeze detection
```

---

### FASE 4: Mobile App (Semana 7-8)
**Objetivo:** App completa para iOS + Android

#### 4.1 Screens

| Screen | Funcionalidad | Estado |
|--------|--------------|:------:|
| Dashboard | Portfolio overview, balance, statuses | ✅ |
| Coin Detail | Indicadores, score, decisión actual | ⬜ |
| Trade History | Lista de trades, PnL por moneda | ⬜ |
| Trade Detail | Detalle de un trade específico | ⬜ |
| Settings | Configuración del bot | ⬜ |
| Notifications | Alertas de trades | ⬜ |
| Login/Auth | Autenticación | ⬜ |

#### 4.2 Componentes
```
components/
├── CoinCard.tsx          # Card de moneda en dashboard
├── PriceChart.tsx        # Gráfico de precio
├── ScoreGauge.tsx        # Gauge de score de entrada
├── PnLBadge.tsx          # Badge de PnL
├── StatusBadge.tsx       # Badge de estado (COMPRADO/LÍQUIDO)
├── TradeRow.tsx          # Fila de trade en historia
├── AlertBanner.tsx       # Banner de alertas
└── LoadingSpinner.tsx    # Loading indicator
```

#### 4.3 Features mobile
- **Real-time updates** via WebSocket
- **Push notifications** para trades
- **Charts** con react-native-chart-kit
- **Dark mode** (default)
- **Offline support** (cache de datos)

---

### FASE 5: Production (Semana 9-10)
**Objetivo:** Deploy, monitoreo, seguridad

#### 5.1 Docker
```yaml
# docker-compose.yml
services:
  backend:
    build: ./backend
    ports: ["3001:3001"]
    environment:
      - BINANCE_API_KEY=${BINANCE_API_KEY}
      - BINANCE_API_SECRET=${BINANCE_API_SECRET}
    volumes:
      - ./data:/app/data
  
  nginx:
    image: nginx:alpine
    ports: ["443:443"]
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/nginx/certs
```

#### 5.2 SSL + Domain
- Certificados SSL (Let's Encrypt)
- Dominio personalizado
- Rate limiting

#### 5.3 Monitoreo
- **Logging:** Winston + file rotation
- **Error tracking:** Sentry
- **Metrics:** Prometheus + Grafana
- **Uptime:** Health check endpoints

#### 5.4 Seguridad
- JWT authentication
- Rate limiting (100 req/min)
- Input validation (Zod)
- SQL injection prevention
- CORS configuration

---

### FASE 6: Sellable Product (Semana 11-12)
**Objetivo:** Multi-user, billing, admin

#### 6.1 Multi-User
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  plan TEXT DEFAULT 'free',  -- free, pro, enterprise
  binance_api_key TEXT,
  binance_api_secret TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### 6.2 Plans
| Plan | Precio | Features |
|------|--------|----------|
| Free | $0/mes | 1 moneda, alerts básico |
| Pro | $29/mes | 5 monedas, trailing stop, analytics |
| Enterprise | $99/mes | Todas las monedas, custom config, API |

#### 6.3 Billing (Stripe)
```javascript
// Integration
- Subscription management
- Invoice generation
- Webhook handling
- Usage tracking
```

#### 6.4 Admin Dashboard
- User management
- Bot performance metrics
- Revenue tracking
- Support ticket system

---

## 📁 ESTRUCTURA FINAL

```
el-oraculo-app/
├── backend/
│   ├── src/
│   │   ├── config/          # Environment, database
│   │   ├── modules/
│   │   │   ├── trading/     # Engine principal
│   │   │   ├── indicators/  # RSI, ADX, MACD, etc.
│   │   │   ├── scoring/     # Entry scoring
│   │   │   ├── risk/        # Trailing stop, TP, SL
│   │   │   ├── exchange/    # Binance API
│   │   │   ├── database/    # SQLite/PostgreSQL
│   │   │   ├── logger/      # Trade logging
│   │   │   ├── notifications/ # Telegram, push
│   │   │   ├── auth/        # JWT authentication
│   │   │   └── billing/     # Stripe integration
│   │   ├── jobs/            # Cron scheduler
│   │   ├── routes/          # Express routes
│   │   ├── middleware/       # Auth, validation
│   │   └── utils/           # Logger, helpers
│   ├── tests/
│   └── migrations/          # Database migrations
│
├── mobile/
│   ├── src/
│   │   ├── screens/         # All screens
│   │   ├── components/      # Reusable components
│   │   ├── services/        # API client
│   │   ├── hooks/           # Custom hooks
│   │   ├── navigation/      # React Navigation
│   │   ├── store/           # State management
│   │   └── utils/           # Helpers
│   └── assets/              # Images, fonts
│
├── shared/
│   └── src/
│       ├── types/           # TypeScript types
│       ├── constants/       # Config, weights
│       └── utils/           # Shared helpers
│
├── admin/                   # Admin dashboard (web)
├── docs/                    # Documentation
├── scripts/                 # Deployment scripts
├── docker/                  # Docker configs
└── .github/                 # CI/CD workflows
```

---

## 🔧 HERRAMIENTAS A USAR

| Categoría | Herramienta | Por qué |
|-----------|------------|---------|
| **Runtime** | Node.js 20 LTS | Estable, fast, same as n8n |
| **Framework** | Express.js | Simple, flexible, gran ecosystem |
| **Database** | SQLite (dev) → PostgreSQL (prod) | Simple start, easy migration |
| **ORM** | Drizzle ORM | Type-safe, lightweight |
| **Mobile** | React Native + Expo | Cross-platform, fast iteration |
| **Navigation** | React Navigation 6 | Standard for RN |
| **State** | Zustand | Simple, no boilerplate |
| **Indicators** | technicalindicators | Battle-tested |
| **Charts** | react-native-chart-kit | Easy, good looking |
| **Auth** | JWT + bcrypt | Simple, secure |
| **Billing** | Stripe | Industry standard |
| **Monitoring** | Winston + Sentry | Logging + error tracking |
| **Testing** | Vitest | Fast, modern |
| **CI/CD** | GitHub Actions | Free for open source |
| **Deploy** | Docker + Railway/Vercel | Easy, scalable |

---

## 📊 MÉTRICAS DE ÉXITO

### Antes (n8n)
- ❌ 500+ ejecuciones stuck
- ❌ 0 tests
- ❌ Sin API REST
- ❌ Sin mobile app
- ❌ No es vendible

### Después (App)
- ✅ 0 ejecuciones stuck (Node.js event loop)
- ✅ 80%+ test coverage
- ✅ REST API completa
- ✅ Mobile app iOS + Android
- ✅ Multi-user + billing
- ✅ Product-ready

---

## 💰 COSTOS ESTIMADOS

### Desarrollo
| Fase | Horas | Costo estimado |
|------|:-----:|:--------------:|
| Fase 1 (Foundation) | 20h | $0 (ya hecha) |
| Fase 2 (DB + API) | 40h | — |
| Fase 3 (Backend) | 60h | — |
| Fase 4 (Mobile) | 60h | — |
| Fase 5 (Production) | 40h | — |
| Fase 6 (Sellable) | 80h | — |
| **Total** | **300h** | — |

### Infraestructura (mensual)
| Servicio | Costo | Nota |
|----------|:-----:|------|
| VPS (Railway/Render) | $20-50 | Backend + DB |
| Dominio + SSL | $15/año | .com |
| Sentry | $0 (free tier) | Error tracking |
| Stripe | 2.9% + $0.30 | Per transaction |
| **Total** | **~$30/mes** | — |

---

## 🎯 PRÓXIMOS PASOS INMEDIATOS

### Para continuar desde esta sesión:

1. **Abrir el directorio:**
   ```bash
   cd el-oraculo-app
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Continuar con Fase 2:**
   - Implementar SQLite database
   - Crear REST API endpoints
   - Conectar mobile app al backend

4. **Documentación:**
   - Leer `PROJECT_STATE.md` para contexto
   - Leer `docs/MIGRATION_PLAN.md` (este archivo)
   - Seguir el checklist de cada fase

---

## 📝 NOTAS IMPORTANTES

### Convenciones del proyecto
- **TypeScript** en todo (backend + mobile + shared)
- **ES modules** (import/export)
- **Zod** para validación de inputs
- **Winston** para logging
- **Vitest** para tests

### Decisiones técnicas
- **SQLite primero**, migrar a PostgreSQL después
- **Zustand** para state management (no Redux)
- **React Navigation** (no Expo Router)
- **Express** (no Fastify) — más simple, más docs
- **No GraphQL** — REST es suficiente para este scope

### Lo que NO cambiar
- Lógica de scoring (funciona bien)
- Configuración por moneda (funciona bien)
- Trailing stop (recién implementado)
- Time exit + break-even (funciona bien)
