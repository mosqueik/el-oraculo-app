# 🔄 MIGRATION SPEC — n8n → Node.js
> Mapeo exacto de cada nodo n8n a código Node.js

---

## NODO 1: CONFIG

### n8n Actual
```javascript
// Cada per-coin WF tiene un "Config Fields" node
// que setea: coin, RSI_LEVELS, RISK_PCT, entry_threshold, etc.
```

### Node.js
```typescript
// shared/src/constants/config.ts
export const COIN_CONFIGS: Record<CoinSymbol, CoinConfig> = {
  BTC: {
    symbol: 'BTC',
    pair: 'BTCUSDT',
    risk_pct: 0.07,
    entry_threshold: 2,
    tp_target: 1.0,
    max_hours: 8,
    precision_qty: 5,
    precision_price: 2,
    min_order_usdt: 5,
  },
  // ... 13 monedas más
};
```

---

## NODO 2: PARSE & MERGE

### n8n Actual
```javascript
// Fusión de datos de 7 inputs:
// - Config Fields (per-coin WF)
// - Set Credentials myBalance
// - Code in JavaScript4 (balance Binance)
// - Merge3 (SM Indicators)
// - Coin Real Income
// - Config Merge
// - Bot State
//
// Prioridad: Config Fields > Config Merge > defaults
```

### Node.js
```typescript
// backend/src/modules/trading/engine.ts
async function parseAndMerge(coin: CoinSymbol, context: ExecutionContext) {
  const config = COIN_CONFIGS[coin];
  const botState = await db.getBotState(coin);
  const balance = await exchange.getBalance();
  const indicators = await indicatorService.getIndicators(coin);
  const marketData = await exchange.getKlines(coin, '15m', 100);

  return {
    coin,
    config,
    botState,
    balance: balance.usdt,
    indicators,
    marketData,
    // Per-coin overrides from user_config (if exists)
    ...getUserOverrides(coin),
  };
}
```

---

## NODO 3: STATUS

### n8n Actual
```javascript
// Lee bot_state de la DB
// Si status === 'COMPRADO' → tiene posición abierta
// Si status === 'LÍQUIDO' → sin posición
```

### Node.js
```typescript
// backend/src/modules/trading/engine.ts
async function checkStatus(coin: CoinSymbol, data: MergedData) {
  const state = await db.getBotState(coin);

  return {
    hasPosition: state?.status === 'COMPRADO',
    entryPrice: state?.entry_price || 0,
    entryTime: state?.entry_time,
    piso: state?.piso_actual || 0,
    tp: state?.tp_target || 1.0,
    breakEvenActive: state?.break_even_active || false,
    streakLosses: state?.streak_losses || 0,
  };
}
```

---

## NODO 4: MARKET REGIME

### n8n Actual
```javascript
// Detecta condiciones del mercado:
// - RANGING: ADX < 25
// - TRENDING: ADX > 25
// - VOLATILE: ATR% > threshold
// - CALM: ATR% < threshold
```

### Node.js
```typescript
// backend/src/modules/indicators/service.ts
function detectMarketRegime(indicators: IndicatorData): MarketRegimeData {
  const adx = indicators.adx[ indicators.adx.length - 1];
  const atrPercent = indicators.atrPercent;
  const ema20 = indicators.ema20[indicators.ema20.length - 1];
  const ema50 = indicators.ema50[indicators.ema50.length - 1];

  let regime: 'TRENDING' | 'RANGING' | 'VOLATILE' | 'CALM';
  let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';

  // Regime
  if (adx > 25) regime = 'TRENDING';
  else if (atrPercent > 2) regime = 'VOLATILE';
  else if (adx < 20) regime = 'RANGING';
  else regime = 'CALM';

  // Direction
  if (ema20 > ema50) direction = 'BULLISH';
  else if (ema20 < ema50) direction = 'BEARISH';
  else direction = 'NEUTRAL';

  return { regime, direction, adx, atrPercent };
}
```

---

## NODO 5: INDICATORS

### n8n Actual
```javascript
// 15 nodos de indicadores:
// L1: RSI, ADX, Bollinger, ATR, Volume
// L2: MACD, Stochastic, OBV, VWAP, EMA20/50
// L3: FVG, Choch, Squeeze, Momentum
```

### Node.js
```typescript
// backend/src/modules/indicators/service.ts
import { RSI, ADX, BollingerBands, ATR, EMA, MACD, Stochastic } from 'technicalindicators';

class IndicatorService {
  calculate(klines: Kline[]): IndicatorData {
    const closes = klines.map(k => k.close);
    const highs = klines.map(k => k.high);
    const lows = klines.map(k => k.low);
    const volumes = klines.map(k => k.volume);

    // L1 Indicators
    const rsi = RSI.calculate({ values: closes, period: 14 });
    const adxResult = ADX.calculate({ high: highs, low: lows, close: closes, period: 14 });
    const bb = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });
    const atr = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });

    // L2 Indicators
    const ema20 = EMA.calculate({ values: closes, period: 20 });
    const ema50 = EMA.calculate({ values: closes, period: 50 });
    const macd = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9
    });
    const stoch = Stochastic.calculate({
      high: highs, low: lows, close: closes,
      period: 14, signalPeriod: 3
    });

    // L3 Indicators (custom)
    const fvg = this.detectFVG(klines);
    const momentum = this.calculateMomentum(ema20, ema50, macd);
    const squeeze = this.detectSqueeze(bb, atr);

    return {
      rsi: rsi[rsi.length - 1],
      adx: adxResult[adxResult.length - 1]?.adx || 0,
      adxDirection: adxResult[adxResult.length - 1]?.pdi > adxResult[adxResult.length - 1]?.mdi ? 'BULLISH' : 'BEARISH',
      bb: bb[bb.length - 1],
      atr: atr[atr.length - 1],
      atrPercent: (atr[atr.length - 1] / closes[closes.length - 1]) * 100,
      ema20: ema20[ema20.length - 1],
      ema50: ema50[ema50.length - 1],
      macd: macd[macd.length - 1],
      stoch: stoch[stoch.length - 1],
      fvgBullish: fvg.bullish,
      fvgBearish: fvg.bearish,
      momentum,
      squeeze,
      direction: this.calculateDirection(closes, highs, lows),
      currentPrice: closes[closes.length - 1],
    };
  }
}
```

---

## NODO 6: RISK

### n8n Actual
```javascript
// Calcula:
// - tp_target (dinámico)
// - v_piso (trailing stop)
// - hard_stop (ATR-based)
// - break_even
// - max_hours
```

### Node.js
```typescript
// backend/src/modules/risk/service.ts
class RiskService {
  calculate(state: BotState, indicators: IndicatorData, balance: number): RiskData {
    if (state.status !== 'COMPRADO') {
      return { action: 'WAIT', piso: 0, tp: 0, hardStop: 0 };
    }

    const entry = state.entry_price;
    const price = indicators.currentPrice;
    const pnl = ((price - entry) / entry) * 100;
    const atr = indicators.atr;

    // Hard stop: ATR-based safety net
    const hardStop = entry - (atr * 1.5);

    // Trailing stop: piso sube con precio
    const trailPercent = 0.05;
    let piso = state.piso_actual || entry * 0.98;
    if (price > entry) {
      const newPiso = price * (1 - trailPercent);
      if (newPiso > piso) piso = newPiso;
    }

    // Break-even
    const beActive = state.break_even_active || false;
    const beThreshold = 0.3;

    // Time exit
    const hoursHeld = state.entry_time
      ? (Date.now() - new Date(state.entry_time).getTime()) / (1000 * 60 * 60)
      : 0;
    const maxHours = state.max_hours || 8;

    // Take profit
    const tp = state.tp_target || 1.0;

    return {
      action: 'HOLD',
      piso,
      tp,
      hardStop,
      breakEvenActive: beActive,
      hoursHeld,
      maxHours,
      pnl,
    };
  }
}
```

---

## NODO 7: SCORING

### n8n Actual
```javascript
// Score entries based on:
// - RSI oversold/low: +1
// - FVG bullish: +1
// - ADX direction: +1
// - Momentum: +1
// - Downtrend penalty: -1
// Score vs threshold → ready or not
```

### Node.js
```typescript
// backend/src/modules/scoring/service.ts
class ScoringService {
  evaluate(indicators: IndicatorData, state: BotState): ScoringResult {
    let score = 0;
    const reasons: string[] = [];

    // RSI signals
    if (indicators.rsi < 30) {
      score += 1;
      reasons.push('RSI_OVERSOLD');
    } else if (indicators.rsi < 40) {
      score += 1;
      reasons.push('RSI_LOW');
    }

    // FVG signal
    if (indicators.fvgBullish) {
      score += 1;
      reasons.push('FVG_BULLISH');
    }

    // ADX direction
    if (indicators.adx > 25 && indicators.adxDirection === 'BULLISH') {
      score += 1;
      reasons.push('ADX_BULLISH');
    }

    // Momentum
    if (indicators.momentum === 'BULL') {
      score += 1;
      reasons.push('MOMENTUM_BULL');
    }

    // Downtrend penalty
    if (state.streak_losses >= 2) {
      score -= 1;
      reasons.push('DOWNTREND_PENALTY');
    }

    const threshold = state.entry_threshold || 2;

    return {
      score: Math.max(0, score),
      threshold,
      reasons,
      ready: score >= threshold,
    };
  }
}
```

---

## NODO 8: DECISION

### n8n Actual
```javascript
// Evalúa:
// - Si tiene posición → evaluar salidas (trailing, TP, time, BE, etc.)
// - Si no tiene posición → evaluar entrada (score vs threshold, balance)
// - Retorna: action (BUY/SELL/WAIT), motivo, monto
```

### Node.js
```typescript
// backend/src/modules/trading/engine.ts
function decide(
  scoring: ScoringResult,
  risk: RiskData,
  state: BotState,
  balance: number,
  config: CoinConfig
): DecisionResult {

  // === SI TIENE POSICIÓN ===
  if (state.status === 'COMPRADO') {
    const price = risk.currentPrice;
    const entry = state.entry_price;
    const pnl = ((price - entry) / entry) * 100;

    // Priority exit conditions
    if (price <= risk.hardStop) {
      return { action: 'SELL', motivo: 'HARD_STOP', monto: state.monto_entrada };
    }
    if (price <= risk.piso) {
      return { action: 'SELL', motivo: 'TRAILING_STOP', monto: state.monto_entrada };
    }
    if (pnl >= risk.tp) {
      return { action: 'SELL', motivo: 'TAKE_PROFIT', monto: state.monto_entrada };
    }
    if (risk.hoursHeld >= risk.maxHours) {
      return { action: 'SELL', motivo: 'TIME_EXIT', monto: state.monto_entrada };
    }
    if (risk.breakEvenActive && pnl < 0.1) {
      return { action: 'SELL', motivo: 'BREAK_EVEN', monto: state.monto_entrada };
    }
    if (indicators.momentum === 'BEARISH' && pnl > 0.3) {
      return { action: 'SELL', motivo: 'MOMENTUM_BEAR', monto: state.monto_entrada };
    }

    return { action: 'WAIT', motivo: 'HOLDING', monto: 0 };
  }

  // === SI NO TIENE POSICIÓN ===
  if (scoring.ready) {
    // Calculate monto
    const riskPct = config.risk_pct < 1 ? config.risk_pct : config.risk_pct / 100;
    const monto = balance * riskPct;

    if (monto < config.min_order_usdt) {
      return {
        action: 'WAIT',
        motivo: `MONTO_INSUFICIENTE: $${monto.toFixed(2)} < $${config.min_order_usdt}`,
        monto,
        score: scoring.score,
        threshold: scoring.threshold,
        reasons: scoring.reasons,
      };
    }

    return {
      action: 'BUY',
      motivo: `ENTRY_SCORE:${scoring.score}/${scoring.threshold} [${scoring.reasons.join(', ')}]`,
      monto,
      score: scoring.score,
      threshold: scoring.threshold,
      reasons: scoring.reasons,
    };
  }

  return {
    action: 'WAIT',
    motivo: `SCORING: ${scoring.score}/${scoring.threshold} [${scoring.reasons.join(', ')}]`,
    monto: 0,
    score: scoring.score,
    threshold: scoring.threshold,
    reasons: scoring.reasons,
  };
}
```

---

## NODO 12: LOG

### n8n Actual
```javascript
// Escribe a:
// - bot_state (DataTable): status, entry_price, piso, etc.
// - trade_log (DataTable): action, price, quantity, pnl
// - Google Sheets: historical log
// - Telegram: notification
```

### Node.js
```typescript
// backend/src/modules/logger/service.ts
class LoggerService {
  async logDecision(coin: CoinSymbol, decision: DecisionResult, indicators: IndicatorData) {
    // 1. Log to execution_log
    await db.insertExecutionLog({
      coin,
      status: decision.action,
      decision: decision.action,
      motivo: decision.motivo,
      score: decision.score,
      rsi: indicators.rsi,
      adx: indicators.adx,
      price: indicators.currentPrice,
      balance: decision.balance,
    });

    // 2. Update bot_state
    if (decision.action === 'BUY') {
      await db.updateBotState(coin, {
        status: 'COMPRADO',
        entry_price: decision.fillPrice || indicators.currentPrice,
        entry_time: new Date().toISOString(),
        monto_entrada: decision.monto,
      });
    } else if (decision.action === 'SELL') {
      await db.updateBotState(coin, {
        status: 'LÍQUIDO',
        entry_price: 0,
        entry_time: null,
        monto_entrada: 0,
        last_sell_time: new Date().toISOString(),
        last_sell_reason: decision.motivo,
        last_sell_price: indicators.currentPrice,
      });
    }

    // 3. Log trade (if BUY or SELL)
    if (decision.action === 'BUY' || decision.action === 'SELL') {
      await db.insertTradeLog({
        coin,
        action: decision.action,
        price: decision.fillPrice || indicators.currentPrice,
        quantity: decision.monto / indicators.currentPrice,
        monto: decision.monto,
        pnl_pct: decision.pnl,
        motivo: decision.motivo,
        score: decision.score,
        indicators: JSON.stringify(indicators),
      });
    }

    // 4. Send notification
    await this.notify(coin, decision);
  }
}
```

---

## MAPA COMPLETO: n8n → Node.js

| # | Nodo n8n | Módulo Node.js | Método/Función |
|---|----------|----------------|----------------|
| 1 | CONFIG | `shared/constants/config.ts` | `COIN_CONFIGS[coin]` |
| 2 | PARSE & MERGE | `trading/engine.ts` | `parseAndMerge()` |
| 3 | STATUS | `trading/engine.ts` | `checkStatus()` |
| 4 | MARKET REGIME | `indicators/service.ts` | `detectMarketRegime()` |
| 5 | INDICATORS | `indicators/service.ts` | `calculate()` |
| 6 | RISK | `risk/service.ts` | `calculate()` |
| 7 | SCORING | `scoring/service.ts` | `evaluate()` |
| 8 | DECISION | `trading/engine.ts` | `decide()` |
| 9 | EXIT | `trading/engine.ts` | (dentro de `decide()`) |
| 10 | OUTPUT | `trading/engine.ts` | `formatOutput()` |
| 11 | FILTER | `trading/engine.ts` | `filterDecision()` |
| 12 | LOG | `logger/service.ts` | `logDecision()` |
| — | Exchange | `exchange/service.ts` | `getBalance()`, `marketBuy()`, etc. |
| — | Scheduler | `jobs/scheduler.ts` | `startScheduler()` |
| — | API | `routes/*.ts` | Express routes |
| — | Auth | `middleware/auth.ts` | JWT middleware |
| — | WebSocket | `ws/server.ts` | Socket.io events |
