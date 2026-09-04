# 🚀 Next Session Start — Quick Reference

> Read this at the start of the next session to get oriented quickly.  
> Last updated: September 1, 2026

---

## 📊 Current State

| Metric | Value |
|--------|-------|
| Version | 1.2.0 |
| Backend Tests | 153 ✅ |
| TypeScript | Compiles clean |
| API Endpoints | 85+ |
| Mobile Screens | 13 |
| Database Tables | 14 |

---

## 🎯 Today's Achievements (42 tasks completed)

### What Was Built
- Complete trading bot with 12-node pipeline
- React Native mobile app with 13 screens
- Real-time PnL with USDT display (not just %)
- Emergency sell and manual trading controls
- AI trade analysis with OpenRouter free models
- Backtesting engine with 4 strategy presets
- Configurable profit/loss alerts (6 types)
- Complete documentation suite (6 files)

### Key Features Added
1. **Cooldown Mechanism** — 15min wait after sell before re-buy
2. **Real-time PnL** — WebSocket broadcasts every 60s
3. **Manual Trading** — Buy/sell buttons on each CoinCard
4. **Emergency Stop** — Instant sell with confirmation
5. **AI Analysis** — Trade and portfolio analysis
6. **Backtesting** — RSI+ADX strategy with 4 presets
7. **Alerts** — Profit/loss thresholds with 60s checking
8. **i18n** — English/Spanish support
9. **Data Export** — CSV/JSON/Obsidian markdown

---

## 📁 Key Files to Read

### For Overview
- `PROJECT_STATE.md` — Complete project overview (start here!)

### For Deep Understanding
- `memory/KNOWLEDGE_ARCHITECTURE.md` — Deep architecture knowledge
- `memory/SESSION_LOG.md` — Session history

### For API Reference
- `docs/API_REFERENCE.md` — All 85+ endpoints

### For Mobile
- `docs/MOBILE_APP.md` — Complete mobile app guide

### For Deployment
- `docs/DEPLOYMENT.md` — Deployment guide

---

## 🚀 Quick Commands

### Backend
```bash
# Run tests (153 tests)
cd backend && npm test

# Type check
cd backend && npx tsc --noEmit

# Start dev server
cd backend && npm run dev

# Deploy to Fly.io
cd backend && fly deploy
```

### Mobile
```bash
# Start Expo
cd mobile && npx expo start

# iOS simulator
cd mobile && npx expo start --ios

# Android emulator
cd mobile && npx expo start --android

# Build APK (requires EAS setup)
cd mobile && eas build --platform android --profile preview
```

### Docker
```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f backend

# Stop services
docker compose down
```

---

## 🎯 Next Session Priorities

### 1. EAS Build Setup (HIGH)
- Configure eas.json for APK generation
- Set up Apple Developer account for iOS
- Generate first APK for Android testing

### 2. Telegram Integration (MEDIUM)
- Bot commands for trade alerts
- Portfolio status via Telegram
- Manual trade execution via Telegram

### 3. Web Dashboard (MEDIUM)
- Admin panel for monitoring
- Real-time charts
- Trade history visualization

### 4. Advanced Backtesting (LOW)
- Multi-coin portfolio simulation
- Walk-forward optimization
- Custom strategy builder

---

## 🔧 Environment Variables

### Required
```bash
BINANCE_API_KEY=
BINANCE_API_SECRET=
JWT_SECRET=
```

### Optional
```bash
OPENROUTER_API_KEY=       # Free AI models
STRIPE_SECRET_KEY=        # Subscriptions
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=
STRIPE_ENTERPRISE_PRICE_ID=
```

### Mobile
```bash
EXPO_PUBLIC_API_URL=      # Backend URL
```

---

## 🐛 Known Issues to Fix

1. **EAS Build Configuration** — Need to set up eas.json
2. **Push Notification Sounds** — Currently using default sounds
3. **Chart Timeframes** — Only 15m available, need 1h/4h
4. **Offline Mode** — Cache needs manual refresh

---

## 📊 Architecture Quick Reference

### Trading Pipeline
```
Indicators → Multi-Timeframe → Regime → Status → Scoring → Risk → Decision → Filter → Execute → Log
```

### Cooldown
```
Sell → 15min cooldown → Can buy again
```

### Alert System
```
Every 60s → Check all enabled alerts → Compare threshold → Trigger if exceeded → Push notification
```

### PnL Calculation
```
pnlPct = ((currentPrice - entryPrice) / entryPrice) * 100
pnlUsd = (currentPrice - entryPrice) * (montoEntrada / entryPrice)
```

---

## 🎯 Success Criteria for Next Session

- [ ] APK built and installed on Android device
- [ ] Telegram bot sending trade alerts
- [ ] Web dashboard showing real-time data
- [ ] All 153 tests still passing
- [ ] No TypeScript errors

---

## 💡 Tips

1. **Always run tests first** — `cd backend && npm test`
2. **Check types before committing** — `cd backend && npx tsc --noEmit`
3. **Read PROJECT_STATE.md** for complete overview
4. **Check memory/KNOWLEDGE_ARCHITECTURE.md** for deep understanding
5. **Use existing patterns** — Follow the codebase conventions

---

## 📚 Documentation Index

| File | Purpose | When to Read |
|------|---------|--------------|
| `PROJECT_STATE.md` | Complete overview | Start here! |
| `memory/SESSION_LOG.md` | Session history | To understand what was done |
| `memory/KNOWLEDGE_ARCHITECTURE.md` | Deep architecture | To understand how it works |
| `docs/API_REFERENCE.md` | API endpoints | When working with API |
| `docs/MOBILE_APP.md` | Mobile app guide | When working with mobile |
| `docs/DEPLOYMENT.md` | Deployment guide | When deploying |

---

*Ready for next session! 🪙*
