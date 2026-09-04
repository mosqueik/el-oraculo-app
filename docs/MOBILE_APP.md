# 📱 El Oráculo — Mobile App Guide

> Complete guide for the React Native mobile app.  
> Built with Expo, React Navigation, Zustand, and react-native-chart-kit.

---

## 🏗️ Architecture

### Tech Stack
- **Framework:** React Native + Expo
- **Navigation:** React Navigation (Native Stack)
- **State Management:** Zustand + Custom Hooks
- **HTTP:** Axios with interceptors
- **WebSocket:** Socket.io client
- **Charts:** react-native-chart-kit
- **Icons:** @expo/vector-icons
- **Storage:** AsyncStorage (offline cache)
- **Biometrics:** expo-local-authentication
- **Notifications:** expo-notifications

### Project Structure

```
mobile/
├── src/
│   ├── screens/          # 13 screens
│   │   ├── DashboardScreen.tsx      # Portfolio overview
│   │   ├── CoinDetailScreen.tsx     # Coin detail + chart
│   │   ├── TradeHistoryScreen.tsx   # Trade list + export
│   │   ├── TradeDetailScreen.tsx    # Trade detail + AI
│   │   ├── AnalyticsScreen.tsx      # Performance metrics
│   │   ├── BacktestScreen.tsx       # Backtesting
│   │   ├── AlertSettingsScreen.tsx  # Alert config
│   │   ├── LoginScreen.tsx          # Login
│   │   ├── RegisterScreen.tsx       # Register
│   │   ├── SubscriptionScreen.tsx   # Plans
│   │   ├── CustomIndicatorScreen.tsx # Indicators
│   │   ├── NotificationsScreen.tsx  # Notifications
│   │   └── SettingsScreen.tsx       # Settings
│   │
│   ├── components/       # 12 components
│   │   ├── CoinCard.tsx             # Coin overview card
│   │   ├── PnLBadge.tsx             # PnL display
│   │   ├── MiniEquityCurve.tsx      # Compact chart
│   │   ├── TradeConfirmModal.tsx    # Trade confirmation
│   │   ├── EmergencyStopButton.tsx  # Emergency sell
│   │   ├── PriceChart.tsx           # Line chart
│   │   ├── ScoreGauge.tsx           # Circular gauge
│   │   ├── IndicatorGauge.tsx       # Horizontal bar
│   │   ├── LoadingSpinner.tsx       # Loading indicator
│   │   └── EmptyState.tsx           # Empty placeholder
│   │
│   ├── hooks/            # 8 custom hooks
│   │   ├── useAuth.ts               # Authentication
│   │   ├── useBiometric.ts          # Biometric auth
│   │   ├── useWebSocket.ts          # Real-time updates
│   │   ├── useNetworkStatus.ts      # Online/offline
│   │   ├── useNotifications.ts      # Push notifications
│   │   └── useTranslation.ts        # i18n
│   │
│   ├── services/
│   │   └── api.ts                   # API service (85+ methods)
│   │
│   ├── store/
│   │   └── index.ts                 # Zustand stores
│   │
│   ├── utils/
│   │   └── cache.ts                 # AsyncStorage cache
│   │
│   └── i18n/
│       ├── index.ts                 # i18n config
│       ├── en.json                  # English translations
│       └── es.json                  # Spanish translations
│
├── App.tsx               # Navigation setup
├── app.json              # Expo config
└── package.json          # Dependencies
```

---

## 📱 Screens

### DashboardScreen
Portfolio overview with real-time data.

**Features:**
- Live PnL display (% + USDT)
- Mini equity curve chart
- Coin cards with buy/sell buttons
- Emergency stop button
- Quick actions (Analytics, Backtest)

**Data Flow:**
```
WebSocket (pnl:update) → useWebSocket → DashboardScreen
REST API (getPortfolio) → apiService → DashboardScreen
```

### CoinDetailScreen
Detailed view for a specific coin.

**Features:**
- Price chart (15m, 1h, 4h)
- Indicator gauges (RSI, ADX)
- Current decision display
- Emergency sell button
- Trade history for coin

### TradeHistoryScreen
Filterable list of all trades.

**Features:**
- Filter by coin
- Export CSV/JSON
- Share via native share
- Navigate to TradeDetail
- Backtest button

### TradeDetailScreen
Detailed view of a single trade.

**Features:**
- Trade info (price, amount, PnL)
- Indicators at trade time
- AI analysis section
- Share trade

### AnalyticsScreen
Performance metrics dashboard.

**Tabs:**
1. **Overview:** Win rate, Sharpe, drawdown, streaks
2. **By Coin:** Individual coin performance
3. **Equity:** PnL curve, drawdown chart, trade table
4. **AI Insights:** Portfolio analysis

### BacktestScreen
Run backtests with strategy presets.

**Features:**
- Coin selector (10 options)
- Date range picker
- Balance input
- 4 strategy presets
- Equity curve chart
- Results table
- Monthly returns

### AlertSettingsScreen
Configure profit/loss alert thresholds.

**Features:**
- Quick presets (4 buttons)
- Active alerts list
- Alert history
- Create custom alerts
- Enable/disable toggle

### LoginScreen / RegisterScreen
Authentication screens.

**Features:**
- Email/password login
- Password strength meter
- Biometric login option
- Error handling

### SubscriptionScreen
Plan selection and checkout.

**Features:**
- 3 plan cards (Free/Pro/Enterprise)
- Feature comparison
- Stripe checkout

### CustomIndicatorScreen
Build custom indicators (Enterprise).

**Features:**
- My indicators list
- 8 indicator templates
- Create/edit form
- Test with data

### NotificationsScreen
Notification history.

### SettingsScreen
App settings.

**Features:**
- Connection status
- Bot control (start/stop)
- Language toggle (EN/ES)
- Alert settings link
- Biometric toggle
- Account info

---

## 🧩 Components

### CoinCard
Displays coin overview with live data.

**Props:**
```typescript
interface CoinCardProps {
  coin: string;
  status: 'COMPRADO' | 'LÍQUIDO';
  price: number;
  change24h: number;
  pnl: number;
  pnlUsd?: number;
  entryPrice?: number;
  montoEntrada?: number;
  cooldownRemaining?: number;
  rsi?: number;
  adx?: number;
  score?: number;
  onPress?: () => void;
  onBuy?: () => void;
  onSell?: () => void;
}
```

**Visual:**
```
┌─────────────────────────────────────┐
│ BTC          [COMPRADO]  ▲ +0.66%  │
│                     +$66.40         │
│ $65,432.12                          │
│ ─────────────────────────────────── │
│ RSI: 52.3  ADX: 28.1  Score: 3/2   │
│ ─────────────────────────────────── │
│ Entry: $65,000.00   [🔴 SELL]      │
│ Size: $100.00                       │
└─────────────────────────────────────┘
```

### PnLBadge
Shows PnL as percentage + USDT amount.

**Props:**
```typescript
interface PnLBadgeProps {
  pnl: number;
  pnlUsd?: number;
  price?: number;
  entryPrice?: number;
  montoEntrada?: number;
  size?: 'small' | 'medium' | 'large';
}
```

**Visual:**
```
▲ +0.66% +$66.40
```

### MiniEquityCurve
Compact equity chart for Dashboard.

**Props:**
```typescript
interface MiniEquityCurveProps {
  data: number[];
  height?: number;
  color?: string;
}
```

### TradeConfirmModal
Confirmation dialog for trades.

**Props:**
```typescript
interface TradeConfirmModalProps {
  visible: boolean;
  coin: string;
  action: 'BUY' | 'SELL';
  currentPrice: number;
  entryPrice?: number;
  pnlPct?: number;
  pnlUsd?: number;
  onConfirm: (amount?: number) => void;
  onCancel: () => void;
}
```

**Features:**
- Amount input (USDT)
- Quick buttons ($25, $50, $100, $200)
- Preview of quantity
- Warning for sell

### EmergencyStopButton
Floating button for instant sell.

**Props:**
```typescript
interface EmergencyStopButtonProps {
  onPress: () => void;
  visible?: boolean;
}
```

---

## 🪝 Hooks

### useAuth
Authentication state management.

**Returns:**
```typescript
{
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name?: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
}
```

### useBiometric
Biometric authentication.

**Returns:**
```typescript
{
  isAvailable: boolean;
  biometricType: 'facial-recognition' | 'fingerprint' | null;
  isEnabled: boolean;
  hasCredentials: boolean;
  authenticate: () => Promise<boolean>;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  storeCredentials: (email: string, password: string) => Promise<void>;
  getCredentials: () => Promise<{ email: string; password: string } | null>;
}
```

### useWebSocket
Real-time data updates.

**Returns:**
```typescript
{
  connected: boolean;
  prices: Record<string, number>;
  livePnL: {
    positions: PnLPosition[];
    summary: PnLSummary;
  };
  getPnLForCoin: (coin: string) => PnLPosition | undefined;
  onTradeExecuted: (callback: (trade: any) => void) => () => void;
}
```

### useTranslation
i18n with EN/ES support.

**Returns:**
```typescript
{
  t: (key: string, params?: Record<string, any>) => string;
  locale: 'en' | 'es';
  toggleLocale: () => void;
}
```

---

## 📡 API Service

The `api.ts` file contains 85+ methods organized by category:

### Portfolio
- `getPortfolio()` — All coins
- `getPortfolioByCoin(coin)` — Single coin
- `getBalance()` — USDT balance
- `getPnL()` — Real-time PnL
- `getPnLByCoin(coin)` — PnL for coin

### Trades
- `getTradeHistory(coin?)` — Trade history
- `getRecentTrades(hours)` — Recent trades

### Trading Controls
- `manualBuy(coin, amountUsdt)` — Manual buy
- `manualSell(coin)` — Manual sell
- `emergencySell(coin)` — Emergency sell
- `pauseCoin(coin)` — Pause trading
- `resumeCoin(coin)` — Resume trading
- `getPausedCoins()` — Paused coins

### Analytics
- `getPerformance()` — Performance metrics
- `getEquityCurve()` — Equity curve data
- `getCoinAnalytics(coin)` — Coin analytics
- `analyzeTrade(tradeId)` — AI trade analysis
- `analyzePortfolio()` — AI portfolio analysis
- `getCoinRecommendation(coin)` — AI recommendation

### Alerts
- `getAlerts()` — All alerts
- `getAlertsByCoin(coin)` — Alerts for coin
- `createAlert(params)` — Create alert
- `updateAlert(id, params)` — Update alert
- `deleteAlert(id)` — Delete alert
- `checkAlerts()` — Manual check
- `getAlertHistory()` — Trigger history

### Export
- `exportTrades(format, coin?)` — Export trades
- `exportExecutions(format)` — Export executions
- `exportPerformance()` — Export performance
- `exportAll()` — Export everything
- `exportObsidian(coin?)` — Obsidian markdown

### Backtesting
- `getBacktestCoins()` — Available coins
- `getBacktestPresets()` — Strategy presets
- `runBacktest(params)` — Run backtest
- `compareBacktests(scenarios)` — Compare scenarios

---

## 🌐 i18n

### Supported Languages
- **English (en)** — Default
- **Spanish (es)** — Full translation

### Usage
```typescript
import { useTranslation } from '../hooks/useTranslation';

function MyComponent() {
  const { t, locale, toggleLocale } = useTranslation();

  return (
    <Text>{t('dashboard.title')}</Text>
    <TouchableOpacity onPress={toggleLocale}>
      <Text>{locale === 'en' ? 'ES' : 'EN'}</Text>
    </TouchableOpacity>
  );
}
```

### Translation Keys
```json
{
  "dashboard": {
    "title": "Portfolio",
    "totalPnl": "Total PnL",
    "activePositions": "Active Positions"
  },
  "trades": {
    "history": "Trade History",
    "export": "Export",
    "filter": "Filter"
  },
  "settings": {
    "language": "Language",
    "alerts": "Alert Settings"
  }
}
```

---

## 🔐 Security

### Authentication
- JWT tokens stored in memory
- Auto-refresh on app open
- Biometric login option

### Biometrics
- Face ID (iOS)
- Fingerprint (Android)
- Credentials stored in Keychain/Keystore
- Optional (can be disabled)

### Offline Support
- AsyncStorage cache with TTL
- Offline-first with fallback
- Network status detection

---

## 🚀 Running the App

### Development
```bash
cd mobile
npm install
npx expo start
```

### iOS Simulator
```bash
npx expo start --ios
```

### Android Emulator
```bash
npx expo start --android
```

### Build APK (EAS)
```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```

---

## 📊 State Management

### Zustand Stores

```typescript
// useBotStatusStore
{
  running: boolean;
  cycleCount: number;
  uptime: number;
  fetchStatus: () => Promise<void>;
}

// useConnectionStore
{
  connected: boolean;
  lastPing: Date;
}
```

### Custom Hooks
Most state is managed via custom hooks (`useAuth`, `useWebSocket`, etc.) which encapsulate API calls and local state.

---

## 🎨 Design System

### Colors
```typescript
const colors = {
  background: '#0a0a0a',
  card: '#1a1a2e',
  primary: '#00C9A7',    // Green
  secondary: '#e94560',  // Red
  text: '#ffffff',
  textSecondary: '#888888',
  border: '#333333',
  profit: '#4ade80',
  loss: '#f87171',
};
```

### Typography
```typescript
const typography = {
  h1: { fontSize: 24, fontWeight: 'bold' },
  h2: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 14 },
  caption: { fontSize: 12, color: '#666' },
};
```

---

*Generated by El Oráculo 🪙*
