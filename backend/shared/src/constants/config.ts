// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Default Configuration Constants
// ═══════════════════════════════════════════════════════════════════

import { CoinConfig, CoinSymbol } from '../types/trading';

// Global defaults
export const DEFAULT_CONFIG = {
  ENTRY_MIN: 2,
  ENTRY_MAX: 8,
  ENTRY_FEAR: 5,
  ENTRY_GREED: 3,
  ENTRY_NEUTRAL: 2,
  RISK_PCT: 0.02,
  MIN_ORDER_USDT: 5,
  STOP_LOSS: -2.0,
  HARD_STOP: -4.5,
  TP_BASE: 1.0,
  TIME_EXIT_MAX_HOURS: 6,
  HARD_SAFETY_EXIT_HOURS: 12,
  ATR_MULTIPLIER: 3.5,
  TRAILING_OFFSET: 0.05,
  CIRCUIT_BREAKER_STREAK: 3,
  CIRCUIT_BREAKER_COOLDOWN_HOURS: 6,
  ANTI_WHIPSAW_STOP_COOLDOWN_MIN: 20,
  BE_TRIGGER_R: 0.3,
  BE_MIN_HOLD_CYCLES: 3,
  AUTOREG_LOOKBACK: 20,
  AUTOREG_BAD_WR: 0.40,
} as const;

// Per-coin configurations
export const COIN_CONFIGS: Record<CoinSymbol, CoinConfig> = {
  BTC: {
    symbol: 'BTC', pair: 'BTCUSDT', risk_pct: 0.07, entry_min: 2, entry_max: 6,
    stop_loss: -0.5, hard_stop: -0.9, tp_base: 1.0, tp_nocturno: 1.1,
    tp_hard_limit: 1.5, time_exit_max_hours: 6, sell_rsi_floor: 0,
    sell_time_exit_adjustment: 0, precision_qty: 5, precision_price: 2,
    adx_exit: 40, adx_btc_danger: 32, rsi_oversold: 35, rsi_overbought: 70,
  },
  ETH: {
    symbol: 'ETH', pair: 'ETHUSDT', risk_pct: 0.03, entry_min: 2, entry_max: 6,
    stop_loss: -1.0, hard_stop: -1.8, tp_base: 0.6, tp_nocturno: 0.7,
    tp_hard_limit: 1.0, time_exit_max_hours: 6, sell_rsi_floor: 0,
    sell_time_exit_adjustment: 0, precision_qty: 4, precision_price: 2,
    adx_exit: 40, adx_btc_danger: 32, rsi_oversold: 35, rsi_overbought: 70,
  },
  SOL: {
    symbol: 'SOL', pair: 'SOLUSDT', risk_pct: 0.10, entry_min: 4, entry_max: 6,
    stop_loss: -2.5, hard_stop: -4.5, tp_base: 0.85, tp_nocturno: 0.95,
    tp_hard_limit: 1.5, time_exit_max_hours: 8, sell_rsi_floor: 0,
    sell_time_exit_adjustment: 0, precision_qty: 1, precision_price: 2,
    adx_exit: 45, adx_btc_danger: 32, rsi_oversold: 35, rsi_overbought: 70,
  },
  BNB: {
    symbol: 'BNB', pair: 'BNBUSDT', risk_pct: 0.07, entry_min: 2, entry_max: 6,
    stop_loss: -0.8, hard_stop: -1.4, tp_base: 1.0, tp_nocturno: 1.1,
    tp_hard_limit: 1.5, time_exit_max_hours: 4, sell_rsi_floor: 0,
    sell_time_exit_adjustment: 0, precision_qty: 2, precision_price: 2,
    adx_exit: 40, adx_btc_danger: 32, rsi_oversold: 35, rsi_overbought: 70,
  },
  AVAX: {
    symbol: 'AVAX', pair: 'AVAXUSDT', risk_pct: 0.07, entry_min: 2, entry_max: 6,
    stop_loss: -0.5, hard_stop: -0.9, tp_base: 1.0, tp_nocturno: 1.1,
    tp_hard_limit: 1.7, time_exit_max_hours: 6, sell_rsi_floor: 50,
    sell_time_exit_adjustment: 2, precision_qty: 2, precision_price: 2,
    adx_exit: 40, adx_btc_danger: 32, rsi_oversold: 35, rsi_overbought: 70,
  },
  POL: {
    symbol: 'POL', pair: 'POLUSDT', risk_pct: 0.03, entry_min: 2, entry_max: 6,
    stop_loss: -1.5, hard_stop: -2.7, tp_base: 1.2, tp_nocturno: 1.3,
    tp_hard_limit: 1.5, time_exit_max_hours: 4, sell_rsi_floor: 0,
    sell_time_exit_adjustment: 0, precision_qty: 0, precision_price: 4,
    adx_exit: 48, adx_btc_danger: 32, rsi_oversold: 35, rsi_overbought: 70,
  },
  SUI: {
    symbol: 'SUI', pair: 'SUIUSDT', risk_pct: 0.05, entry_min: 2, entry_max: 6,
    stop_loss: -1.0, hard_stop: -1.85, tp_base: 0.85, tp_nocturno: 0.95,
    tp_hard_limit: 1.85, time_exit_max_hours: 12, sell_rsi_floor: 0,
    sell_time_exit_adjustment: 0, precision_qty: 1, precision_price: 4,
    adx_exit: 40, adx_btc_danger: 32, rsi_oversold: 35, rsi_overbought: 70,
  },
  LINK: {
    symbol: 'LINK', pair: 'LINKUSDT', risk_pct: 0.10, entry_min: 4, entry_max: 6,
    stop_loss: -2.2, hard_stop: -4.2, tp_base: 0.75, tp_nocturno: 1.0,
    tp_hard_limit: 1.4, time_exit_max_hours: 10, sell_rsi_floor: 0,
    sell_time_exit_adjustment: 0, precision_qty: 1, precision_price: 3,
    adx_exit: 40, adx_btc_danger: 32, rsi_oversold: 35, rsi_overbought: 70,
  },
  NEAR: {
    symbol: 'NEAR', pair: 'NEARUSDT', risk_pct: 0.08, entry_min: 5, entry_max: 6,
    stop_loss: -3.0, hard_stop: -5.0, tp_base: 1.25, tp_nocturno: 1.4,
    tp_hard_limit: 2.0, time_exit_max_hours: 14, sell_rsi_floor: 0,
    sell_time_exit_adjustment: 0, precision_qty: 0, precision_price: 3,
    adx_exit: 50, adx_btc_danger: 32, rsi_oversold: 35, rsi_overbought: 70,
  },
  DOGE: {
    symbol: 'DOGE', pair: 'DOGEUSDT', risk_pct: 0.07, entry_min: 2, entry_max: 6,
    stop_loss: -3.5, hard_stop: -6.0, tp_base: 0.8, tp_nocturno: 0.9,
    tp_hard_limit: 1.2, time_exit_max_hours: 4, sell_rsi_floor: 0,
    sell_time_exit_adjustment: 0, precision_qty: 0, precision_price: 5,
    adx_exit: 55, adx_btc_danger: 32, rsi_oversold: 35, rsi_overbought: 70,
  },
  XRP: {
    symbol: 'XRP', pair: 'XRPUSDT', risk_pct: 0.02, entry_min: 3, entry_max: 6,
    stop_loss: -0.2, hard_stop: -0.5, tp_base: 0.8, tp_nocturno: 0.85,
    tp_hard_limit: 1.25, time_exit_max_hours: 3, sell_rsi_floor: 0,
    sell_time_exit_adjustment: 0, precision_qty: 0, precision_price: 4,
    adx_exit: 40, adx_btc_danger: 32, rsi_oversold: 35, rsi_overbought: 70,
  },
  ARB: {
    symbol: 'ARB', pair: 'ARBUSDT', risk_pct: 0.015, entry_min: 4, entry_max: 6,
    stop_loss: -0.3, hard_stop: -0.6, tp_base: 1.5, tp_nocturno: 1.6,
    tp_hard_limit: 2.5, time_exit_max_hours: 4, sell_rsi_floor: 0,
    sell_time_exit_adjustment: 0, precision_qty: 0, precision_price: 3,
    adx_exit: 40, adx_btc_danger: 32, rsi_oversold: 35, rsi_overbought: 70,
  },
  ADA: {
    symbol: 'ADA', pair: 'ADAUSDT', risk_pct: 0.02, entry_min: 3, entry_max: 6,
    stop_loss: -0.5, hard_stop: -1.0, tp_base: 1.4, tp_nocturno: 1.5,
    tp_hard_limit: 2.1, time_exit_max_hours: 4, sell_rsi_floor: 0,
    sell_time_exit_adjustment: 0, precision_qty: 0, precision_price: 4,
    adx_exit: 40, adx_btc_danger: 32, rsi_oversold: 35, rsi_overbought: 70,
  },
  ESP: {
    symbol: 'ESP', pair: 'ESPUSDT', risk_pct: 0.02, entry_min: 3, entry_max: 6,
    stop_loss: -1.0, hard_stop: -2.0, tp_base: 0.8, tp_nocturno: 0.9,
    tp_hard_limit: 1.2, time_exit_max_hours: 4, sell_rsi_floor: 0,
    sell_time_exit_adjustment: 0, precision_qty: 0, precision_price: 4,
    adx_exit: 40, adx_btc_danger: 32, rsi_oversold: 35, rsi_overbought: 70,
  },
};

// Blocked coins (negative backtests)
export const BLOCKED_COINS: CoinSymbol[] = ['ADA', 'ESP', 'ARB'];

// Active coins
export const ACTIVE_COINS: CoinSymbol[] = ['BTC', 'ETH', 'SOL', 'BNB', 'AVAX', 'POL', 'SUI', 'LINK', 'NEAR', 'DOGE'];

// RSI levels
export const RSI_LEVELS = {
  OVERSOLD_EXTREME: 25,
  OVERSOLD: 35,
  LOW: 40,
  MID_LOW: 45,
  MID: 50,
  MID_HIGH: 55,
  HIGH: 65,
  OVERBOUGHT: 70,
  OVERBOUGHT_EXTREME: 75,
} as const;

// Scoring weights
export const SCORING_WEIGHTS = {
  RSI_OVERSOLD: 1,
  RSI_LOW: 1,
  FVG_BULL: 1,
  FVG_BEAR: -1,
  ADX_BULL: 1,
  ADX_BEAR: -1,
  MOM_BULL: 2,
  MOM_BEAR: -2,
  SQUEEZE_RELEASE: 1,
  CHoCH_BULL: 2,
  CHoCH_BEAR: -2,
  CORRELATION_BULL: 1,
  CORRELATION_BEAR: -1,
  DOWNTREND_PENALTY: -1,
} as const;
