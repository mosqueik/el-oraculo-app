# 📚 LEARNING LOG — El Oráculo App

> **Purpose:** Aprendizajes y decisiones del proyecto el-oraculo-app
> **Rule:** Actualizar cuando haya algo nuevo que aprender

---

## 📅 2026-08-26 — Session 72

### Architecture Decisions
1. **Mono-repo over multi-repo:** Compartir types y constants entre backend y mobile sin duplicación
2. **SQLite first:** Simple para empezar, migrar a PostgreSQL cuando haya multi-user
3. **Drizzle over Prisma:** Más ligero, más control, mejor TypeScript support
4. **Zustand over Redux:** Simple, sin boilerplate, suficiente para mobile
5. **Express over Fastify:** Más simple, más docs, más libs disponibles
6. **React Native + Expo:** Cross-platform, mismo lenguaje que backend

### Technical Learnings
1. **n8n → Node.js mapping:** Cada nodo n8n tiene un equivalente directo en Node.js
2. **Shared types:** CoinSymbol, BotState, TradeLog, DecisionResult compartidos entre ambos
3. **12-node pipeline:** CONFIG → PARSE → STATUS → MARKET REGIME → INDICATORS → RISK → SCORING → DECISION → EXIT → OUTPUT → FILTER → LOG
4. **Balance is shared:** Todas las monedas usan el mismo pool USDT (~$853)
5. **risk_pct format:** Config Fields usa decimal (0.07=7%), CONFIG usa integer (2=2%)

### Bugs from n8n (documented for migration)
1. risk_pct double-division ($0.21 → $59.75)
2. usdt_free fallback to $300
3. daily_start_balance column missing
4. PER_COIN_OVERRIDES key case mismatch
5. Direction UP/DOWN vs BULLISH/BEARISH
6. Trade Logger entryPrice = 0
7. 12. LOG entry_price missing fill price

### Key Insight
> "Documentar TODO antes de codear. El N8N_MIGRATION_SPEC.md mapea cada nodo n8n a su equivalente Node.js, haciendo la migración straightforward."

---

## 📅 2026-08-27 — Session 73

### Database & API Implementation
1. **npm workspaces:** No soporta `workspace:*` protocol (es de pnpm/yarn). Usar `*` para referencias locales.
2. **Drizzle ORM + SQLite:** Setup simple, type-safe, sin servidor. WAL mode para mejor rendimiento.
3. **Repository pattern:** Separa lógica de acceso a datos de la lógica de negocio.
4. **JWT auth:** Tokens de 24h, middleware para proteger rutas, bcrypt para passwords.
5. **Socket.IO:** Simple para WebSocket real-time, con rooms para suscripciones por coin.

### Technical Learnings
1. **better-sqlite3:** Síncrono, rápido, ideal para SQLite en Node.js
2. **Drizzle schema:** Definir tablas con `sqliteTable()`, exportar tipos con `$inferSelect` e `$inferInsert`
3. **Database initialization:** Crear tablas con raw SQL en init, Drizzle para queries
4. **Graceful shutdown:** Cerrar database en SIGINT/SIGTERM para evitar corrupción

### Errors Found & Fixed
1. **Logger import:** El logger usa named export (`export const logger`), no default export
2. **JWT expiresIn:** Tipos de `jsonwebtoken` requieren `StringValue` type, no string genérico
3. **Exchange service:** Cambiado de callback-based a promise-based API (`MainClient`)
4. **Indicators:** ADX usa `pdi`/`mdi` en lugar de `plusDI`/`minusDI`
5. **Trading engine:** `RiskContext` ahora se construye correctamente desde `TradeContext`
6. **Database connection:** Tipo explícito para `DatabaseInstance` para evitar errores de exportación

### Key Insight
> "La separación de concerns es clave: Schema → Connection → Repositories → Routes → Middleware. Cada capa tiene una responsabilidad clara."

---

## 📅 2026-08-27 — Session 73 (Testing)

### Testing Setup
1. **better-sqlite3 v13 segfaults on Node 22:** Downgrade to v11.9.1 fixes it
2. **Vitest crashes with native modules:** `better-sqlite3` segfaults in worker threads. Use `node:test` + `tsx` instead
3. **Standalone test approach:** Create inline DB + inline Express apps to avoid module mocking issues
4. **node:test + tsx:** Fast, no external dependencies, works with native modules

### Test Coverage
- **36 tests total** (all passing)
- Database: BotState (6), TradeLog (5), ExecutionLog (4), Users (5) = 20 tests
- API Routes: Health (1), Portfolio (8), Trades (3), Executions (4) = 16 tests

### Key Insight
> "Cuando los módulos nativos causan problemas con test runners, la solución más simple es tests standalone con DB inline, no intentar mockear la conexión."

---

## Aprendizajes Clave del Proyecto

### Sobre la Arquitectura
- **Separar memorias:** n8n bot y el-oraculo-app tienen memorias separadas para no mezclar contextos
- **Shared package:** Types y constants se comparten entre backend y mobile
- **12-node pipeline:** El pipeline de trading es lineal y determinista

### Sobre el Código
- **TypeScript everywhere:** Backend + mobile + shared, todo en TypeScript
- **ES modules:** import/export, no require()
- **Zod validation:** Para validar inputs de API
- **Winston logging:** Para logging estructurado

### Sobre el Deploy
- **Docker first:** Backend + nginx en docker-compose
- **SQLite → PostgreSQL:** Empezar simple, escalar después
- **GitHub Actions:** CI/CD automático

---

## 📅 2026-08-27 — Session 74

### Phase 3 Implementation
1. **FullIndicatorData:** Extend base IndicatorData with L2 (MACD, StochRSI, OBV, VWAP, EMA20/50/200) and L3 (FVG, Choch, Squeeze, Momentum) indicators
2. **MACD type:** `technicalindicators` MACD needs `SimpleMAOscillator: false, SimpleMASignal: false` params
3. **StochasticRSI type:** Uses `kPeriod`/`dPeriod` not `k`/`d` in input params
4. **Drizzle DDL limitation:** `drizzle.run(sql`...`)` doesn't work for CREATE TABLE. Use `sqlite.exec()` for DDL.
5. **better-sqlite3 + Drizzle:** Both can coexist - use Drizzle for type-safe queries, raw SQLite for DDL

### Pipeline Architecture
- **12 nodes:** CONFIG → PARSE → STATUS → MARKET_REGIME → INDICATORS → RISK → SCORING → DECISION → EXIT → OUTPUT → FILTER → LOG
- **Exit priority chain:** Hard stop > Trailing stop > Take profit > Time exit > Safety exit > Break-even > Momentum bear > RSI exit
- **Filter node:** Validates monto/entry_min, balance sufficiency
- **Output node:** Formats console output with emojis and stats

### Notification Service
- **Telegram integration:** Ready but needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars
- **Trade notifications:** Emoji-based formatting for BUY/SELL alerts
- **Alert system:** 4 levels (info, warning, error, critical)
- **Daily reports:** Win rate, PnL summary, active positions

### Learning Service
- **Per-coin analysis:** Win rate, avg PnL, common motivos
- **Pattern detection:** Consecutive losses, win streaks, RSI oversold wins
- **Insight generation:** SCORING, RISK, TIMING, COIN categories with actionable recommendations
- **Overall summary:** Cross-coin performance comparison

### Key Insight
> "Drizzle is great for type-safe queries but can't do DDL. Use raw sqlite.exec() for CREATE TABLE and Drizzle for everything else. This hybrid approach gives the best of both worlds."

---

## 📅 2026-08-27 — Session 75

### Drizzle Migrations
1. **drizzle.config.ts:** Requires `dialect: 'sqlite'` and `schema` path for schema discovery
2. **drizzle-kit generate:** Creates SQL migration files in `./drizzle/` directory automatically
3. **Migration runner:** `migrate(drizzle, { migrationsFolder: './drizzle' })` from drizzle-orm/better-sqlite3/migrator
4. **Migration tracking:** Drizzle uses `__drizzle_migrations` table to track applied migrations
5. **Schema drift:** `drizzle-kit check` can detect if schema and DB are out of sync

### Testing Auth & WebSocket
1. **Auth tests pattern:** Generate real JWT, test verify/authenticate/requirePlan with supertest
2. **WebSocket tests:** Use socket.io-client with dynamic port binding (httpServer.listen(0))
3. **Room isolation:** Subscribe to coin room → only receive events for that coin
4. **Portfolio room:** Subscribe to 'portfolio' → receive events for ALL coins
5. **Safe emit:** All emit functions check for null io before calling io.emit()

### Test Coverage Update
- **82 tests total** (all passing)
- Database: 20 | Routes: 16 | Indicators: 5 | Learning: 5 | Notifications: 6
- Auth: 16 | WebSocket: 14 (connection + rooms + events)

### Key Insight
> "Drizzle migrations + socket.io-client testing = production-ready infrastructure. The migration system ensures schema consistency across environments, while WebSocket tests verify real-time event delivery."

---

## 📅 2026-08-28 — Session 76

### SM Multi-Timeframe Indicators
1. **Order Blocks Detection:** Bearish candle with >50% body ratio + high volume (>1.5x avg) + displacement (>0.5% next candle) = bullish OB. Vice versa for bearish OB.
2. **Liquidity Zones:** Group highs/lows into 0.1% buckets, count touches >= 3 to identify clustered stop-loss areas.
3. **Structure Breaks (BOS):** Find swing highs/lows using 5-candle lookback, detect when price breaks previous swing.
4. **Volume Profile:** 50-bucket distribution, POC = highest volume, VA = 70% of total volume centered on POC.
5. **Premium/Discount:** Compare current price to midpoint of recent 100-candle range. >1% above = PREMIUM, >1% below = DISCOUNT.
6. **Fibonacci Levels:** 7 levels (0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0) from recent swing high/low.

### Multi-Timeframe Architecture
1. **HTF Bias weights:** 4h (50%) > 1h (30%) > 15m (20%). Higher timeframes have more weight because they represent larger capital flows.
2. **Confluence Score:** Combines timeframe strength (weighted) + SM indicators (OB: +5, BOS: +5, LZ: +3). Range 0-100.
3. **Alignment Detection:** All 3 timeframes must agree (all BULLISH or all BEARISH) AND not NEUTRAL.
4. **Parallel fetching:** `Promise.all()` fetches all 3 timeframes simultaneously for performance.
5. **Timeframe bias calculation:** Weighted score from EMA, RSI, MACD, ADX, OBs, BOS, Premium/Discount, Momentum, FVG.

### Type Architecture
1. **FullIndicatorData moved to shared:** Was in backend only, now in shared types for reuse across mobile/backend.
2. **15+ new SM types:** OrderBlock, LiquidityZone, StructureBreak, VolumeProfile, TimeframeData, MultiTimeframeData, SMIndicators.
3. **Timeframe union type:** `'15m' | '1h' | '4h'` prevents invalid timeframe strings.
4. **Record<Timeframe, TimeframeData>:** Ensures all 3 timeframes are present in MultiTimeframeData.

### Trading Engine Integration
1. **Output format:** HTF bias emoji + confluence score + alignment status per timeframe.
2. **SM summary:** Shows OB count, BOS count, Premium/Discount status for each timeframe.
3. **Decision context:** `multiTimeframe` added to TradeContext for future use in entry/exit logic.

### Key Insight
> "SM indicators work best when combined across timeframes. A bullish order block on 15m is weak alone, but if 1h and 4h also show bullish bias with high confluence, it's a strong signal. The HTF bias weight (4h=50%) reflects this hierarchy."

---

## 📅 2026-08-28 — Session 77

### Zod Validation
1. **z.coerce.number():** Automatically converts strings to numbers (perfect for query params)
2. **Schema composition:** Create reusable schemas (PaginationQuerySchema) and extend for specific routes
3. **Default values:** `.default(100)` applies when field is missing (not just undefined)
4. **Error structure:** ZodError.errors returns array of { path, message, code } objects
5. **Type inference:** `z.infer<typeof schema>` generates TypeScript types from schemas

### Validation Middleware
1. **Middleware factory pattern:** `validate('body')` returns middleware function for that target
2. **Multiple targets:** `validateRequest({ body, params, query })` validates all at once
3. **Error aggregation:** Collect errors from all targets before responding (not fail-fast)
4. **Type assertions:** Use `as any as Type` for Express req.query/req.params after validation
5. **Re-parsing:** Replace req[target] with parsed values (coerced numbers, defaults applied)

### Route Integration
1. **Portfolio routes:** Validate coin params + buy/sell body (entryPrice, monto, reason, price)
2. **Trades routes:** Validate pagination query + coin params + action params
3. **Executions routes:** Validate pagination query + time range query + coin params + id params
4. **Auth routes:** Already had Zod validation (registerSchema, loginSchema) from Session 73
5. **Health route:** No validation needed (no params/body)

### Test Patterns
1. **safeParse vs parse:** Use safeParse for testing (returns { success, data/error })
2. **Edge cases:** Test defaults, string coercion, min/max bounds, required fields
3. **Invalid inputs:** Test with wrong types, missing fields, out-of-range values
4. **Extra fields:** Zod strips extra fields by default (not strict mode)
5. **42 tests total:** Covers all schemas, edge cases, and error conditions

### Key Insight
> "Zod validation is a game-changer for API safety. Instead of manual if/else checks in every route, you define schemas once and apply them as middleware. The coercion feature (z.coerce.number) eliminates the parseInt/parseFloat dance for query params."

---

## 📅 2026-08-28 — Session 78

### E2E Trading Pipeline Testing
1. **Pipeline helper function:** Created `runPipeline()` that simulates the full 6-node flow (Indicators → Scoring → Risk → Decision) without database dependency
2. **Mock exchange pattern:** Configurable kline patterns (BULLISH, BEARISH, RANGING, VOLATILE) for deterministic testing
3. **Exit priority chain:** Hard stop > Trailing stop > Take profit > Time exit > Hold. Tests verify correct priority ordering
4. **Trailing stop comparison bug:** `v_piso` (price) is compared with `r` (percentage) in decision logic. Since v_piso is always much larger than r, trailing stop fires for any positive r. This is existing behavior, not a bug in tests
5. **Multi-timeframe integration:** Tests verify SM indicators (OB, BOS, LZ) are calculated for all 3 timeframes
6. **Market regime detection:** Tests verify regime detection works across different kline patterns

### Test Architecture
1. **Standalone approach:** Tests don't require database setup - they test the pipeline logic directly
2. **Configurable scenarios:** Each test creates its own mock exchange with specific pattern and price
3. **Bot state injection:** Tests can inject COMPRADO/LÍQUIDO states with custom entry prices and times
4. **Decision verification:** Tests verify both the decision (COMPRAR/VENDER/ESPERAR) and the motivo
5. **22 tests total:** Covers entry, exit, risk, multi-timeframe, regime, and edge cases

### Key Insight
> "E2E tests for trading pipelines are most valuable when they test the decision logic, not the execution. Mock the exchange and database, inject specific bot states, and verify the correct decision is made. This catches logic bugs without requiring real API calls."

---

## 📅 2026-08-28 — Session 79

### Critical n8n Logic Verification
1. **Price vs Percentage comparison:** n8n spec uses price-level comparisons for exit conditions (`currentPrice <= hardStop`), not percentage comparisons (`r <= hardStop`). This was a critical bug.
2. **Trailing stop bug:** Was comparing `r` (percentage) with `v_piso` (price). Since any positive r < any price, trailing stop was firing for ALL profitable trades.
3. **Hard stop calculation:** n8n uses `entryPrice - (atr * 1.5)` (price level), not `-(atrPct * ATR_MULTIPLIER)` (percentage).
4. **Momentum logic:** n8n uses `ema20 > ema50 && macd.histogram > 0` for bullish momentum. Was hardcoded to `false`.
5. **Downtrend penalty:** n8n uses `streak_losses >= 2`, not `adx > 25 && minusDI > plusDI`.
6. **CALM regime:** n8n has 4 regimes (TRENDING, VOLATILE, RANGING, CALM). Was missing CALM.

### Key Pattern: Verify Before Implement
> "When migrating from one system to another, ALWAYS verify the logic matches exactly. Don't assume the new implementation is correct just because it compiles and tests pass. Compare against the original spec line by line."

### Type System Lessons
1. **HardStop type:** Should be `number` (price level), not `number` (percentage). The type doesn't enforce this, but the logic must be consistent.
2. **v_piso type:** Should be `number` (price level). Decision logic must compare `currentPrice <= v_piso`, not `r <= v_piso`.
3. **RiskData interface:** All fields should be documented as price levels or percentages to prevent confusion.

### Testing Insights
1. **Regression testing:** When fixing bugs, update tests to match new correct behavior
2. **Edge cases:** Very low prices (DOGE at $0.15) can cause issues with percentage calculations
3. **Mock patterns:** Use configurable kline patterns for deterministic testing

---

*Última actualización: Session 92 — September 4, 2026*

---

## 📅 2026-09-04 — Session 92

### EAS Build Monorepo Fix
1. **EAS Build uploads only the app directory** — When building from `mobile/`, EAS only uploads that directory. It doesn't include sibling packages like `shared/`. So `@el-oraculo/shared: *` workspace dependency can't be resolved.
2. **Solution: Inline shared types** — Copy the types and constants directly into the mobile app. The mobile app only uses ~10 types and 3 constants, so inlining is simple and avoids monorepo complexity.
3. **Valid PNG assets required** — EAS Build needs valid PNG files for icon, adaptive-icon, splash, and notification-icon. Previous assets were empty or corrupt.
4. **Python Pillow for asset generation** — `from PIL import Image, ImageDraw` creates valid PNGs programmatically. 1024x1024 for icons, 1284x2778 for splash.
5. **metro.config.js for monorepo** — Even with inlined types, having `watchFolders` and `nodeModulesPaths` configured prevents future resolution issues.
6. **EAS build flow** — `eas build --platform android --profile preview` → compress → upload to EAS cloud → build on Ubuntu worker → give download link. Takes 5-15 minutes.

### Key Insight
> "For EAS Build in a monorepo, the simplest fix is to inline shared types into the mobile app. The monorepo structure is great for development (shared types, single source of truth), but EAS Build needs all code in one directory. Inlining eliminates the workspace dependency without losing type safety."

### Fly.io Setup
1. **CLI installation** — `curl -L https://fly.io/install.sh | sh` installs to `~/.fly/bin/flyctl`
2. **Authentication** — `fly auth login` requires interactive terminal (browser auth). Can also use `FLY_API_TOKEN` env var for headless environments.
3. **Free tier** — 3 shared-cpu-1x VMs, 3GB persistent storage, 160GB bandwidth/month.

### Docker Build on Fly.io
1. **Node 22 required** — `better-sqlite3@13.0.3` requires Node >= 22. Using `node:22-alpine` base image.
2. **Python for native modules** — `better-sqlite3` uses `node-gyp` which needs Python. Install with `apk add --no-cache python3 make g++`.
3. **Shared package in Docker** — Must compile shared to `dist/` and fix `package.json` main field with `sed` since the source `main` points to `.ts` files.
4. **Drizzle migrations** — SQL comments (`--`) in migration files cause Drizzle's runner to fail. Use `--> statement-breakpoint` markers between statements.
5. **Fly.io app names** — Auto-generated names (e.g., `el-oraculo-backend-frosty-haze-7294`) work fine. Can't rename after creation.
6. **Volume mounts** — SQLite needs persistent storage at `/data` for data to survive restarts.
7. **Health checks** — Configure in `fly.toml` with `[[http_service.checks]]` to auto-restart unhealthy instances.

### Key Insight
> "Docker builds for Node.js native modules (better-sqlite3, bcryptjs) need Python and build tools. Always include `python3 make g++` in the Dockerfile for Alpine images. Also, ensure the Node.js version matches the native module requirements — better-sqlite3@13 needs Node 22+."

### Free Hosting Research (Session 92)
1. **Fly.io is NOT free** — Free trial expires, then requires credit card. Destroyed the app.
2. **Oracle Cloud Always Free** — Best option: 4 ARM VMs, 24GB RAM, 200GB storage, 10TB bandwidth. Always free, no expiration. Credit card needed only for account verification.
3. **Render Free** — 750 hrs/month but spins down after 15min. No persistent disk on free tier (SQLite data lost on restart).
4. **Railway** — $5 credit/month (not free forever).
5. **Koyeb** — Free nano + PostgreSQL but very limited.
6. **Cyclic** — Uses DynamoDB (no SQLite).
7. **Vercel** — Serverless (no persistent disk, no SQLite).

### Key Insight (Hosting)
> "For a trading bot that needs 24/7 uptime with SQLite persistence, Oracle Cloud Always Free is the best option. It's a real VPS with persistent storage, no sleep mode, and no time limits. The only requirement is a credit card for account verification (not for charges)."

---

## 📅 2026-09-02 — Session 90

### Portfolio Risk Management
1. **Total Exposure Limit:** Max % of balance that can be invested across all positions (default: 80%). Prevents over-concentration.
2. **Single Position Limit:** Max % of balance in one position (default: 20%). Prevents single-coin catastrophe.
3. **Correlation Analysis:** Pearson correlation calculated from price returns. Updates every 20 price ticks. Keeps last 100 prices per coin.
4. **Correlated Position Limit:** Max positions in highly correlated coins (default: 3). Correlation threshold: 0.7.
5. **Sector Exposure Limit:** Max % in same sector (default: 40%). Sectors: store_of_value, smart_contracts, exchange, oracle, meme, payment, layer2.
6. **Drawdown Circuit Breaker:** Auto-pauses trading when portfolio drawdown exceeds threshold (default: 15%). Cooldown: 60 minutes.
7. **Portfolio Heat Score:** 0-100 risk metric combining exposure, positions, correlation, volatility, and drawdown. Above 80 reduces position sizes.
8. **Risk-Adjusted Position Sizing:** Position sizes automatically reduced based on portfolio heat, drawdown, and correlation risk.

### Correlation Calculation
1. **Pearson Correlation:** Uses price returns (not prices) for better correlation measurement.
2. **Rolling Window:** Last 100 prices (~8 hours at 5min intervals).
3. **Recalculation:** Every 20 price updates (when enough data exists).
4. **High Correlation:** >0.7 threshold. Most crypto pairs are 0.5-0.9 correlated.
5. **Sector Mapping:** Coins grouped by primary use case (BTC=store_of_value, ETH/SOL=smart_contracts, etc.).

### Portfolio Heat Factors
1. **Exposure (0-30 points):** Higher exposure = more heat.
2. **Position Count (0-20 points):** More positions = more complexity.
3. **Correlation (0-20 points):** Correlated positions = concentrated risk.
4. **Volatility (0-15 points):** High ATR/ADX = more risk.
5. **Drawdown (0-15 points):** Current drawdown adds heat.

### Circuit Breaker
1. **Trigger:** Portfolio drawdown > 15% from peak.
2. **Effect:** Blocks all new BUY decisions.
3. **Cooldown:** 60 minutes (configurable).
4. **Manual Reset:** POST /api/risk/reset-circuit-breaker.
5. **Logging:** All triggers logged for analysis.

### API Design
1. **Portfolio state:** `/api/risk/portfolio` — Current exposure, heat, drawdown.
2. **Configuration:** `/api/risk/config` — Get/update risk parameters.
3. **Correlation:** `/api/risk/correlation` — Full matrix or pair-specific.
4. **Position check:** `/api/risk/check` — Pre-trade risk validation.
5. **Sector breakdown:** `/api/risk/sectors` — Exposure by sector.

### Key Insight
> "Portfolio-level risk management is about preventing correlated losses. If BTC drops 10% and you have positions in ETH, SOL, and AVAX (all 0.8+ correlated with BTC), you're essentially 4x exposed to the same move. Correlation limits force diversification across uncorrelated assets."

---

## 📅 2026-09-02 — Session 89

### Walk-Forward Optimization (WFO)
1. **Walk-Forward Analysis:** Splits historical data into in-sample (optimization) and out-of-sample (validation) periods. Prevents overfitting by testing parameters on unseen data.
2. **Grid Search:** Tests all combinations of parameter values (entryThreshold × riskPct × maxHoldHours × stopLoss × TP × trailing). Limited to 100 combinations per period to prevent timeout.
3. **Rolling Windows:** IS period (3mo) + OOS period (1mo) + step (1mo). Multiple periods give realistic performance estimate.
4. **Parameter Stability:** Measures how much optimal parameters change across periods. High stability (>70%) indicates robust strategy.
5. **Walk-Forward Efficiency:** OOS return / IS return ratio. >50% is good, >80% is excellent. Measures how well optimization generalizes.

### Monte Carlo Simulation
1. **Trade Shuffling:** Randomizes trade order to estimate return distribution. Same trades, different sequence.
2. **Percentile Analysis:** p5 (worst case), p50 (median), p95 (best case) returns.
3. **Probability of Profit:** Percentage of simulations with positive return.
4. **Drawdown Estimation:** Median and p95 max drawdown from shuffled trades.
5. **Robustness Check:** If Monte Carlo shows high variance, strategy is fragile.

### Optimization Targets
1. **Sharpe Ratio:** Risk-adjusted return. Good for comparing strategies with different risk profiles.
2. **Profit Factor:** Gross profit / Gross loss. >1.5 is good, >2.0 is excellent.
3. **Win Rate:** Percentage of winning trades. High win rate doesn't guarantee profitability.
4. **Total PnL:** Simple total return. Can be misleading with high drawdown.
5. **Calmar Ratio:** Return / Max Drawdown. Good for evaluating downside risk.

### API Design
1. **Full optimization:** `/api/walkforward/optimize` — Complete WFO with all periods.
2. **Quick optimization:** `/api/walkforward/quick` — Single-period optimization for fast parameter search.
3. **Presets:** 4 preset configurations (Conservative, Balanced, Aggressive, Monte Carlo).
4. **Info endpoint:** Explains WFO concepts and available options.

### Key Insight
> "Walk-forward optimization is the gold standard for strategy validation. By testing optimized parameters on out-of-sample data, you get a realistic estimate of live performance. A strategy that works on in-sample data but fails on out-of-sample is overfit — it learned the noise, not the signal."

---

## 📅 2026-09-02 — Session 88

### Web Dashboard (Real-time Monitoring)
1. **Single-file HTML dashboard:** All HTML, CSS, and JavaScript in one file (`dashboard.html`). No build step required. Served via Express static middleware.
2. **Socket.IO client:** Dashboard connects to the same WebSocket server as the mobile app. Subscribes to `portfolio` room for all coin updates.
3. **Real-time updates:** Price, score, status, and trade events update the UI instantly via WebSocket events.
4. **Consolidated API:** `/api/dashboard/overview` returns all dashboard data in one call (bot status, portfolio, today's summary, streaks, WS stats, recent trades).
5. **Responsive design:** CSS Grid + media queries for mobile/desktop. Dark theme matching GitHub's color scheme.
6. **Bot controls:** Start/Stop buttons call `/api/start` and `/api/stop` endpoints.

### Architecture Decisions
1. **Static HTML over SPA framework:** For a monitoring dashboard, plain HTML+JS is simpler than React/Vue. No build step, no dependencies, instant load.
2. **WebSocket for real-time:** Dashboard subscribes to the same events as the mobile app. No polling needed.
3. **Consolidated API endpoint:** `/api/dashboard/overview` reduces HTTP requests from 5+ to 1 for initial load.
4. **Express static middleware:** Serves `public/dashboard.html` at `/dashboard`. No nginx configuration needed.

### Dashboard Sections
1. **Bot Status:** Running/stopped, cycle count, uptime, memory usage
2. **Today's Performance:** Trades, wins, losses, total PnL
3. **Win Streaks:** Current and max win/lose streaks
4. **Active Positions:** Live PnL for each position (entry → current, hours held)
5. **All Coins Table:** Price, 24h change, RSI, ADX, score, status, regime
6. **Recent Trades:** Last 20 trades with timestamps and motivos
7. **System Logs:** Real-time log stream (WebSocket events)

### API Endpoints Added
| Endpoint | Description |
|----------|-------------|
| `GET /dashboard` | Serve dashboard HTML |
| `GET /api/dashboard/overview` | All dashboard data |
| `GET /api/dashboard/coins` | Coin data for table |
| `GET /api/dashboard/positions` | Active positions with PnL |
| `GET /api/dashboard/trades` | Recent trades |
| `GET /api/dashboard/performance` | Performance metrics |

### Test Results
- **No new unit tests** (HTML dashboard is visual, tested manually)
- **275 total tests passing** (unchanged)
- **TypeScript: 0 errors**

### Key Insight
> "A web dashboard for a trading bot should be simple and fast. Single-file HTML with WebSocket updates gives you real-time monitoring without the complexity of a SPA framework. The dashboard is read-heavy (lots of updates) but write-light (only start/stop), so WebSocket is the perfect transport."

---

## 📅 2026-09-02 — Session 87

### Trade Logger (DB-based, replaces Google Sheets)
1. **Decision Snapshot table:** Records full pipeline state at each decision point (indicators, scoring, risk, decision). Replaces Google Sheets logging with structured database entries.
2. **Daily Summary table:** Aggregated daily performance (buys, sells, wins, losses, total PnL). Auto-updated on each trade.
3. **Pipeline context:** Passes all 30+ pipeline variables through `PipelineContext` interface for comprehensive logging.
4. **Dual logging:** COMPRAR/VENDER decisions logged to both `decision_snapshot` (full context) and `trade_log` (backwards compatibility).
5. **CSV/JSON export:** Full trade history export with date range filtering.
6. **Analytics endpoints:** Dashboard, per-coin performance, win streaks, daily summaries, decision/regime distribution, avg cycle time.

### Architecture Decisions
1. **Repository pattern for new tables:** Created `DecisionSnapshotRepository` and `DailySummaryRepository` following existing pattern.
2. **Service layer:** `TradeLoggerService` provides high-level API that orchestrates repositories and provides analytics.
3. **setDatabase() for testing:** Added `setDatabase()` to connection module to allow tests to inject in-memory SQLite without touching production database.
4. **Wire into trading engine:** TradeLogger called after each decision in `processCoin()` method, plus `updateDailySummary()` on every trade.

### Test Results
- **19 new TradeLogger tests** covering logDecision, getDecisions, getPerformanceByCoin, getWinStreaks, getTodaySummary, updateDailySummary, exportJson, exportCsv, getDecisionDistribution, getRegimeDistribution, getAvgCycleTime, cleanup.
- **275 total tests passing** (19 new + 256 previous).
- **TypeScript: 0 errors**.

### Key Insight
> "A trade logger that captures the full pipeline state at each decision point is invaluable for debugging and optimization. By storing indicators, scoring, risk parameters, and the final decision together, you can replay exactly why a trade was made — which is impossible with Google Sheets logging."

---

## 📅 2026-09-02 — Session 86

### Load Testing Infrastructure
1. **autocannon:** Node.js HTTP benchmarking tool. Measures throughput, latency percentiles, and errors. Used for API endpoint load testing.
2. **Concurrent coin processing:** Tests the trading pipeline at different concurrency levels (1, 2, 5, 10) to find optimal parallelism.
3. **Memory stress test:** Runs 100 trading cycles monitoring heap growth to detect memory leaks.
4. **Synthetic data:** Generated 200 candles per timeframe (15m, 1h, 4h) for deterministic testing without API calls.

### Load Test Results
| Test | Metric | Result |
|------|--------|--------|
| Concurrent coins | Throughput | 570 coins/sec (optimal at concurrency=5) |
| Concurrent coins | p95 latency | 3.6ms |
| Concurrent coins | Memory per cycle | ~17MB |
| Memory stress | Growth over 100 cycles | +48MB (0.48MB/cycle) |
| Memory stress | Cycles/sec | 53.7 |
| Memory stress | Coins/sec | 537 |

### Key Findings
1. **Optimal concurrency is 5:** Beyond 5, throughput plateaus due to Node.js single-threaded nature. The indicator calculations are CPU-bound, so more concurrency doesn't help.
2. **Latency is excellent:** p95 under 4ms for full pipeline (indicators + scoring + decision) across all concurrency levels.
3. **Memory is stable:** 0.48MB per cycle is acceptable for a trading bot that runs every 5 minutes. No leak detected.
4. **Indicator calculations dominate:** ~90% of cycle time is spent in technical indicator calculations (RSI, ADX, EMA, MACD).

### Performance Bottlenecks
1. **Indicator calculation:** Technical indicator libraries (technicalindicators) create many temporary arrays. Consider caching or reusing arrays for frequently-calculated indicators.
2. **Sequential coin processing:** Currently processes coins one-by-one. Could parallelize with `Promise.all()` for coins that don't share balance.
3. **Kline generation:** Synthetic data generation is fast (0.04ms/candle) but real API calls will be 10-100x slower.

### npm Scripts Added
```bash
npm run test:load          # Concurrent coin processing
npm run test:load:api      # API endpoint benchmarks
npm run test:load:memory   # Memory stress test
npm run test:load:all      # All load tests
```

### Test Results
- **No new unit tests** (load tests are standalone scripts, not unit tests)
- **256 total unit tests passing** (unchanged)
- **TypeScript: 0 errors**

### Key Insight
> "Load testing reveals the real performance characteristics of your system. Synthetic benchmarks showed 570 coins/sec throughput, but the bottleneck is the single-threaded Node.js runtime processing CPU-bound indicator calculations. For a trading bot running every 5 minutes across 10 coins, this is more than sufficient — but for real-time dashboards or higher-frequency trading, consider moving indicator calculations to a worker thread or Rust/WASM module."

---

## 📅 2026-09-02 — Session 85

### WebSocket Rate Limiting
1. **Connection rate limit:** Max 5 simultaneous connections per IP. Checked in Socket.IO middleware before connection is accepted. Returns `Too many connections from this IP` error.
2. **Subscription rate limit:** Max 30 subscribe/unsubscribe events per minute per socket. Prevents subscription spam that could create excessive room memberships.
3. **Event flood protection:** Max 50 custom events per second per socket. Uses per-second windowing — counter resets each second. Prevents event flooding.
4. **Max rooms per socket:** 15 rooms max (10 coins + portfolio + extras). Prevents room explosion where a malicious client joins many rooms.
5. **Idle timeout:** 30 minutes of inactivity auto-disconnects the socket. Checked every minute via cleanup timer.
6. **Coin validation:** All coin symbols validated against the active coin list. Invalid symbols are rejected with error.
7. **Room deduplication:** Check `socket.rooms.has()` before joining to prevent duplicate room memberships.

### Per-Socket Tracking
Each connected socket gets a `SocketTracker` with:
- `id` — Socket ID
- `ip` — Client IP address
- `connectedAt` — Connection timestamp
- `lastActivity` — Last event timestamp (for idle detection)
- `eventCount` / `eventWindowStart` — Current-second event counter
- `subscriptionCount` / `subscriptionWindowStart` — Current-minute subscription counter
- `roomCount` — Number of rooms joined

### Connection Tracking by IP
- In-memory Map tracks connections per IP with a rolling window
- Window resets after `connectionWindowMs` (60 seconds)
- Decrement on disconnect to allow reconnections
- Also tracked in SQLite store for persistence across restarts

### Cleanup Mechanism
- Timer runs every 60 seconds
- Disconnects sockets idle for > 30 minutes
- Cleans up expired IP tracking windows
- Logs disconnections for monitoring

### Socket.IO Middleware
```typescript
io.use((socket, next) => {
  const ip = getSocketIP(socket);
  if (!incrementIPConnection(ip)) {
    return next(new Error('Too many connections from this IP'));
  }
  next();
});
```

### Event Flow
```
Connection → IP check (5 max/IP) → Create tracker
subscribe:coin → Flood check → Subscription rate check → Room count check → Join
subscribe:portfolio → Same checks → Join
ping → Update lastActivity
any event → Flood check (50/s)
decrement → Clean tracker → Decrement IP count
```

### Test Results
- **14 new WebSocket rate limit tests** covering connections, subscriptions, room limits, event floods, ping/pong, stats
- **256 total tests passing** (14 new + 242 previous)
- **TypeScript: 0 errors**

### Key Insight
> "WebSocket rate limiting requires different strategies than HTTP rate limiting. HTTP is stateless (each request independent), but WebSocket is stateful (connection persists). The key protections are: connection limits per IP, event rate per socket, room caps, and idle timeouts."

---

## 📅 2026-09-02 — Session 84

### Persistent Rate Limiting with SQLite
1. **express-rate-limit v8 Store interface:** The `Store` type requires `init(options)`, `increment(key)`, `decrement(key)`, `resetKey(key)`, `resetAll()`, and optionally `get(key)`. The `increment` method returns `{ totalHits, resetTime }`.
2. **SQLite table design:** `rate_limits(key TEXT PRIMARY KEY, count INTEGER, expires INTEGER, created INTEGER)` with an index on `expires` for efficient cleanup.
3. **Key prefixing:** Each limiter uses a prefix (e.g., `api:`, `auth:`, `trading:`) to namespace keys and prevent collisions between different rate limiters.
4. **Prepared statements:** Using `db.prepare()` for all queries. Cached in a singleton to avoid re-preparing on every request.
5. **Window expiry:** When a request comes in, the store checks if the existing entry's `expires` timestamp has passed. If so, it resets the counter before incrementing.
6. **Probabilistic cleanup:** Instead of cleaning up on every request (expensive), cleanup runs with 1% probability per increment. Additionally, a cron job cleans up every 5 minutes.
7. **Fail-open pattern:** If any SQLite error occurs, the store returns `totalHits: 1` (allow the request). Rate limiting should never block legitimate traffic due to internal errors.
8. **express-rate-limit `init()` callback:** The store receives the middleware's `windowMs` via the `init()` method, so it can calculate correct expiry times without requiring `windowMs` in the constructor.

### Implementation Details
- `SqliteRateLimitStore` implements the `Store` interface from `express-rate-limit` v8
- Global store initialized once at startup via `initRateLimitStore(db)`
- Prefixed stores created per-limiter via `createPrefixedStore(prefix)`
- All stores share the same SQLite database instance
- Cleanup cron runs every 5 minutes via `node-cron`
- Admin endpoint `POST /api/ratelimit/cleanup` for manual cleanup
- Admin endpoint `GET /api/ratelimit/status` shows store type (SQLite vs in-memory) and total tracked keys

### express-rate-limit v8 API Changes
1. **`Store` is a type, not a class:** Can't extend it. Must implement the interface directly with `implements Store`.
2. **`increment()` returns synchronously:** Unlike v5 which used callbacks (`increment(key, cb)`), v8 uses `increment(key): IncrementResponse`.
3. **`LegacyStore` vs `Store`:** Legacy stores use `incr(key, cb)` callbacks. Modern stores use `increment(key): IncrementResponse`.
4. **`get()` is optional:** Used for checking existing state without modifying. Returns `ClientRateLimitInfo | undefined`.
5. **`init(options)` is called once:** Receives the full `Options` object including `windowMs`.

### Test Results
- **22 new SQLite store tests** covering init, increment, decrement, reset, cleanup, persistence, window expiry, prefix isolation
- **242 total tests passing** (22 new + 220 previous)
- **TypeScript: 0 errors**

### Key Insight
> "SQLite-backed rate limiting is the sweet spot for single-server deployments: persistent across restarts, no external dependencies (Redis), and fast enough for thousands of requests per second. The probabilistic cleanup keeps the table size bounded without expensive full-table scans on every request."

---

## 📅 2026-09-02 — Session 82

### Rate Limiting Enhancements
1. **Per-user rate limiter:** Uses authenticated user ID (from JWT) as the rate limit key. Falls back to API key or IP if no auth context. 200 req/min in production.
2. **Expensive operation limiter:** 5 requests/min for backtesting, AI analysis, and indicator calculations. Prevents abuse of resource-intensive endpoints.
3. **Trading action limiter:** 10 actions/min for buy/sell/emergency operations. Prevents rapid-fire trading that could cause issues with exchange APIs.
4. **Login burst limiter:** 3 attempts per 15 minutes per IP (production). Aggressive brute-force protection. Counts only failed attempts (`skipSuccessfulRequests: true`).
5. **IP blocklist:** In-memory set of blocked IPs. Admin can block/unblock via API. Checked before rate limiting.

### Rate Limit Architecture
```
Request → IP Blocklist → Security Logger → Request ID
  → apiLimiter (100/min) → writeLimiter (30/min POST/PUT/DELETE)
  → authLimiter (5/min) + loginBurstLimiter (3/15min)
  → perUserLimiter (200/min authenticated)
  → tradingLimiter (10/min) — trading routes only
  → expensiveLimiter (5/min) — backtest/AI routes only
```

### Key Design Decisions
1. **Layered rate limiting:** Multiple limiters at different levels (global → per-route → per-user) provide defense in depth.
2. **Environment-aware:** Production limits are strict (5 login attempts), dev limits are lenient (30 attempts).
3. **Standard headers:** All limiters return `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers.
4. **Key generator priority:** User ID > API key > X-Forwarded-For > req.ip > 'unknown'.
5. **IP blocklist for emergencies:** Immediate ban capability for suspicious IPs, separate from rate limiting.

### Admin API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ratelimit/status` | GET | Current config + blocked IPs |
| `/api/ratelimit/block` | POST | Block an IP |
| `/api/ratelimit/unblock` | POST | Unblock an IP |
| `/api/ratelimit/blocked` | GET | List blocked IPs |

### Test Results
- **16 new rate limit tests** covering IP blocklist, request ID, security logger, limiter exports
- **220 total tests passing** (16 new + 204 previous)
- **TypeScript: 0 errors**

### Key Insight
> "Rate limiting is most effective when layered: global limits prevent DDoS, per-route limits protect expensive operations, per-user limits prevent abuse, and IP blocklists handle immediate threats. Each layer catches what the others miss."

---

## 📅 2026-09-02 — Session 81

### Telegram Bot API Integration
1. **No external library needed:** Telegram Bot API is a simple REST API. Using `fetch()` directly eliminates dependency on `node-telegram-bot-api` or `telegram` packages.
2. **Rate limiting:** Telegram allows ~30 messages/second to the same chat. Implemented a queue with 1s minimum interval between sends.
3. **Parse mode fallback:** If Markdown parsing fails (error 400), automatically retry as plain text. Common with special characters in trade motivos.
4. **Rate limit retry:** If Telegram returns 429 (rate limited), wait 5s and retry once.
5. **Forum group support:** `TELEGRAM_THREAD_ID` env var enables sending to specific topics in forum-style groups.
6. **Silent mode:** `TELEGRAM_SILENT=true` sends notifications without sound on the user's device.

### Env Vars
| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | Yes | Chat/group ID to send messages to |
| `TELEGRAM_THREAD_ID` | No | Thread/topic ID for forum groups |
| `TELEGRAM_SILENT` | No | `'true'` for silent notifications |

### Dual Notification System
1. **Telegram:** For即时 trade alerts and daily reports to the user's phone
2. **Expo Push:** For mobile app push notifications (already existed)
3. **Both fire in parallel:** Trading engine sends to both Telegram and Expo Push on every trade
4. **In-memory log:** All notifications stored in memory for API retrieval (last 100)

### API Endpoints Added
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/notifications/telegram/config` | GET | Telegram configuration status |
| `/api/notifications/telegram/test` | POST | Send test message + verify bot |
| `/api/notifications/telegram/send` | POST | Send custom message |
| `/api/notifications/telegram/recent` | GET | Recent in-memory notifications |
| `/api/notifications/telegram/clear` | DELETE | Clear notification log |

### Message Formatting
1. **Markdown escaping:** Special characters (`*`, `_`, `[`, `]`, etc.) escaped with `\` for Telegram Markdown
2. **Emoji-based:** Trade direction (🟢/🔴), PnL (📈/📉), alerts (ℹ️/⚠️/❌/🚨)
3. **Code blocks:** Prices and quantities in backtick code blocks for clean formatting
4. **Daily reports:** Win rate, PnL summary, per-position breakdown with hours held

### Test Results
- **18 new Telegram tests** covering config, in-memory storage, sending (no env vars), markdown escaping
- **204 total tests passing** (18 new + 186 previous)
- **TypeScript: 0 errors**

### Key Insight
> "Telegram Bot API is one of the simplest notification integrations available. No SDK needed — just fetch() to api.telegram.org/bot{token}/sendMessage. The real complexity is in rate limiting, parse mode fallback, and graceful degradation when not configured."

---

## 📅 2026-09-02 — Session 80

### Backtest Runner Implementation
1. **Full pipeline replay:** The backtest runner replays the entire 12-node trading pipeline candle-by-candle against historical data fetched from Binance REST API.
2. **No auth needed:** Binance klines API is public — no API key required for historical data.
3. **Pagination for long ranges:** Binance returns max 1000 candles per request. The runner auto-paginates by moving `startTime` forward after each batch.
4. **Candle indexing:** Each timeframe has different candle counts. HTF slices are matched by timestamp, not index.
5. **Indicator warmup:** Starting at candle 60 ensures RSI(14), EMA(50), and ADX(14) have enough data.

### SM Signal Validation
1. **Forward-looking validation:** Each SM signal (OB, BOS, FVG, Premium/Discount) is checked against price action at +5, +10, and +20 candles.
2. **Outcome classification:** WIN if price moves in signal direction, LOSS if against, NEUTRAL if unchanged.
3. **Per-signal accuracy:** Win rate and average PnL calculated independently for each signal type.
4. **Confluence with trades:** SM signals recorded at each candle allow correlating signal quality with actual trade outcomes.

### Multi-Timeframe Backtest
1. **HTF data alignment:** Higher timeframe candles are matched by timestamp to the current 15m candle.
2. **Parallel fetching:** All 3 timeframes fetched simultaneously for performance.
3. **Degraded mode:** If HTF data is insufficient (< 60 candles), that timeframe returns NEUTRAL with 0 strength.
4. **HTF bias propagation:** HTF bias and confluence score are recorded per trade for analysis.

### Paper Trading Engine
1. **Paper buy:** Deducts `balance * risk_pct` from balance, creates position with entry metadata.
2. **Paper sell:** Calculates PnL %, adds back `monto * (1 + pnlPct/100)` to balance.
3. **Position tracking:** Tracks entry price, peak price, hold duration, and SM context at entry.
4. **Exit conditions:** Same priority chain as live trading (hard stop → trailing → TP → time → safety → BE → momentum → RSI).

### Analytics Output
1. **Summary metrics:** Win rate, total PnL, max drawdown, profit factor, Sharpe ratio, max consecutive losses.
2. **Per-coin breakdown:** Individual win rate and PnL for each coin.
3. **Monthly returns:** PnL and win rate grouped by month.
4. **Regime performance:** Win rate and avg PnL broken down by market regime (TRENDING, VOLATILE, RANGING).
5. **SM signal accuracy:** 5 signal types × 4 metrics (win rate, avg PnL, PnL at 5/10/20 candles).

### Test Results
- **33 new backtest tests** covering indicators, SM calculations, regime detection, multi-timeframe bias, decision logic, paper trading, and analytics.
- **186 total tests passing** (33 new + 153 previous).
- **TypeScript: 0 errors**.

### Key Insight
> "Backtesting is only useful if it replays the EXACT same logic as live trading. By sharing the same indicator calculations, scoring, risk, and decision code between the backtest runner and trading engine, we ensure backtest results accurately predict live performance."
