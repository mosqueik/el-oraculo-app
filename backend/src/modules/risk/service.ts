// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Risk Service (Trailing Stop + Break-Even)
// ═══════════════════════════════════════════════════════════════════

import { RiskData, DEFAULT_CONFIG } from '@el-oraculo/shared';

export interface RiskContext {
  entryPrice: number;
  currentPrice: number;
  r: number; // PnL percentage
  st: string; // COMPRADO or LÍQUIDO
  pisoActual: number;
  hoursHeld: number;
  config: any;
  marketRegime: any;
}

export class RiskService {
  calculate(ctx: RiskContext): RiskData {
    const { entryPrice, currentPrice, r, st, pisoActual, hoursHeld, config, marketRegime } = ctx;

    // Hard stop (ATR-based, price level)
    // n8n spec: hardStop = entryPrice - (atr * 1.5)
    const atrPct = marketRegime?.atrPct || 0;
    let hardStopPrice: number;
    if (entryPrice > 0 && atrPct > 0) {
      // Convert ATR% to price: atr_price = entryPrice * (atrPct / 100)
      const atrPrice = entryPrice * (atrPct / 100);
      hardStopPrice = entryPrice - (atrPrice * (config.ATR_MULTIPLIER || 3.5));
      // Clamp to reasonable bounds
      const minStop = entryPrice * 0.92; // Max 8% loss
      const maxStop = entryPrice * 0.985; // Min 1.5% loss
      hardStopPrice = Math.max(hardStopPrice, minStop);
      hardStopPrice = Math.min(hardStopPrice, maxStop);
    } else {
      // Fallback: use config hard_stop as percentage
      hardStopPrice = entryPrice > 0
        ? entryPrice * (1 + (config.hard_stop || -0.9) / 100)
        : currentPrice * 0.99;
    }

    // Take profit (adjusted for volatility)
    let tpVolMult = 1.0;
    if (atrPct >= 2.0) tpVolMult = 1.2;
    else if (atrPct <= 0.5) tpVolMult = 0.8;
    const tp_target = (config.tp_base || 1.0) * tpVolMult;

    // Trailing stop — piso sube cuando el precio sube (price level)
    const prevPiso = pisoActual || 0;
    const initialFloor = entryPrice > 0
      ? entryPrice * (1 - Math.abs(config.stop_loss || 2.0) / 100)
      : currentPrice * 0.98;

    let v_piso: number;
    if (st === 'COMPRADO' && currentPrice > entryPrice) {
      // Trade is profitable — trail the floor UP
      const trailOffset = config.TRAILING_OFFSET || 0.05;
      const newPiso = currentPrice * (1 - trailOffset);
      v_piso = Math.max(prevPiso || initialFloor, newPiso);
    } else if (st === 'COMPRADO') {
      // Trade is negative — keep the floor at initial level
      v_piso = prevPiso || initialFloor;
    } else {
      v_piso = initialFloor;
    }

    // Break-even
    const beActive = false; // Will be tracked in DB

    // Anti-whipsaw
    const antiWhipsawActive = false; // Will be tracked in DB

    // Circuit breaker
    const circuitBreakerActive = false; // Will be tracked in DB

    return {
      hardStop: hardStopPrice,
      stopLoss: config.stop_loss || -2.0,
      tp_target,
      v_piso,
      hoursHeld,
      maxHoldHours: config.time_exit_max_hours || DEFAULT_CONFIG.TIME_EXIT_MAX_HOURS,
      beActive,
      antiWhipsawActive,
      circuitBreakerActive,
    };
  }
}
